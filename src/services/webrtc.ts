import { PeerDevice, ConnectionMode, TransferProgress, SharedSnippet } from '../types/transfer';
import { playStartChime, playSuccessChime } from '../utils/audio';
import { resolveSignalingUrl, isNativePlatform } from '../utils/format';
import { CloudSignalingClient } from './cloudSignaling';

const CHUNK_SIZE = 32 * 1024 - 16; // 32 KB default safe chunk for WebRTC SCTP
const READ_BLOCK_SIZE = 2 * 1024 * 1024; // 2 MB fast disk read block
const BUFFERED_THRESHOLD = 1024 * 1024; // 1 MB buffer ceiling prevents SCTP congestion on mobile Wi-Fi
const LOW_BUFFER_THRESHOLD = 256 * 1024; // 256 KB resume threshold
const SEGMENT_FLUSH_BYTES = 8 * 1024 * 1024; // 8 MB: Flush every 8MB into a Blob to keep JS Heap low on desktop
const NATIVE_FLUSH_BYTES = 512 * 1024; // 512 KB: Stream directly to Android Downloads/HotSpotDrop with near-zero RAM

interface AndroidFileBridgeAPI {
  isAvailable(): boolean;
  setKeepScreenOn(keepOn: boolean): void;
  startFile(fileId: string, fileName: string, mimeType: string): boolean;
  writeChunkBase64(fileId: string, base64Data: string): boolean;
  finishFile(fileId: string): string;
  cancelFile(fileId: string): void;
}

function getAndroidFileBridge(): AndroidFileBridgeAPI | null {
  if (typeof window === 'undefined') return null;
  const bridge = (window as any).AndroidFileBridge as AndroidFileBridgeAPI | undefined;
  if (bridge && typeof bridge.isAvailable === 'function') {
    try {
      return bridge.isAvailable() ? bridge : null;
    } catch {
      return null;
    }
  }
  return null;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000; // 32KB slices avoid call stack overflow
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    parts.push(String.fromCharCode.apply(null, sub as unknown as number[]));
  }
  return btoa(parts.join(''));
}

export type ConnectionCallback = (mode: ConnectionMode) => void;
export type PeersCallback = (peers: PeerDevice[]) => void;
export type ProgressCallback = (items: TransferProgress[]) => void;
export type SnippetCallback = (snippet: SharedSnippet) => void;
export type TransferErrorCallback = (fileName: string, reason: string) => void;
export type SignalingStatusCallback = (status: 'connected' | 'connecting' | 'disconnected', url: string) => void;

interface ActiveReceivingFile {
  fileId: string;
  fileIdHash: number;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  // Native Android streaming writer flag (zero-RAM disk streaming for 1GB-10GB+ files)
  useNativeBridge: boolean;
  // Segmented Blob Streaming - eliminates Out Of Memory crashes on desktop browsers
  blobSegments: Blob[];
  currentSegmentChunks: Uint8Array[];
  currentSegmentBytes: number;
  pendingChunks: Map<number, Uint8Array>;
  nextFlushedIndex: number;
  receivedBytes: number;
  receivedChunks: number;
  startTime: number;
  lastProgressUpdate: number;
  lastBytesCount: number;
  speed: number;
  senderName: string;
  receivedCompleteSignal?: boolean;
}

export class TransferEngine {
  private ws: WebSocket | null = null;
  private cloudClient: CloudSignalingClient | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;

  private sendSignaling(msg: any) {
    if (this.cloudClient) {
      this.cloudClient.send(msg);
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch (err) {
        console.warn('Error sending WebSocket signaling:', err);
      }
    }
  }
  
  public roomId: string;
  public peerId: string;
  public deviceName: string;
  public deviceType: 'mobile' | 'laptop';

  public connectionMode: ConnectionMode = 'connecting';
  public connectedPeers: PeerDevice[] = [];
  public transfers: Map<string, TransferProgress> = new Map();
  public snippets: SharedSnippet[] = [];

  private activeReceiving: Map<string, ActiveReceivingFile> = new Map();
  private activeReceivingByHash: Map<number, ActiveReceivingFile> = new Map();
  private earlyChunksBuffer: Map<number, Array<{ chunkIndex: number; payload: Uint8Array }>> = new Map();
  private sendQueue: { fileId: string; file: File; targetPeerId: string }[] = [];
  private isSending = false;
  private cancelledTransfers = new Set<string>();

  // Signaling state
  private currentSignalingUrl = '';
  private signalingStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';
  private onSignalingStatusChange?: SignalingStatusCallback;

  // Callbacks
  private onConnectionChange?: ConnectionCallback;
  private onPeersChange?: PeersCallback;
  private onProgressChange?: ProgressCallback;
  private onSnippetReceived?: SnippetCallback;
  private onTransferError?: TransferErrorCallback;

  // WebRTC negotiation state
  private isInitiator = false;
  private isMakingOffer = false;
  private isSettingRemoteDescription = false;
  private p2pTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private handshakeRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private handshakeRetryCount = 0;
  private autoDownloadEnabled = true;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastPeerHeartbeat = Date.now();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private updateKeepScreenOn() {
    const bridge = getAndroidFileBridge();
    if (!bridge) return;
    try {
      const active = this.isBusy() || this.activeReceiving.size > 0;
      bridge.setKeepScreenOn(active);
    } catch {}
  }

  constructor(
    roomId: string,
    peerId: string,
    deviceName: string,
    deviceType: 'mobile' | 'laptop'
  ) {
    this.roomId = roomId;
    this.peerId = peerId;
    this.deviceName = deviceName;
    this.deviceType = deviceType;
  }

  public setSignalingUrl(newUrl: string) {
    const trimmed = newUrl.trim();
    if (this.currentSignalingUrl === trimmed && this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    this.currentSignalingUrl = trimmed;
    if (typeof window !== 'undefined' && trimmed) {
      localStorage.setItem('hotspot_drop_signaling_url', trimmed);
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.connectSignaling();
  }

  public getSignalingUrl(): string {
    return this.currentSignalingUrl || resolveSignalingUrl();
  }

  public getSignalingStatus(): 'connected' | 'connecting' | 'disconnected' {
    return this.signalingStatus;
  }

  private handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      console.log('App returned to foreground, verifying connection health...');
      this.checkAndRecoverConnection();
    }
  };

  private handleWindowFocus = () => {
    this.checkAndRecoverConnection();
  };

  private handleOnline = () => {
    console.log('Network online detected, verifying connection...');
    this.checkAndRecoverConnection();
  };

  public setCallbacks(
    onConnectionChange: ConnectionCallback,
    onPeersChange: PeersCallback,
    onProgressChange: ProgressCallback,
    onSnippetReceived: SnippetCallback,
    onTransferError?: TransferErrorCallback,
    onSignalingStatusChange?: SignalingStatusCallback
  ) {
    this.onConnectionChange = onConnectionChange;
    this.onPeersChange = onPeersChange;
    this.onProgressChange = onProgressChange;
    this.onSnippetReceived = onSnippetReceived;
    this.onTransferError = onTransferError;
    this.onSignalingStatusChange = onSignalingStatusChange;
  }

  public setAutoDownload(enabled: boolean) {
    this.autoDownloadEnabled = enabled;
  }

  public checkRoom(targetRoomId: string): Promise<{ isValid: boolean; peerCount: number }> {
    if (this.cloudClient) {
      return this.cloudClient.checkRoom(targetRoomId);
    }
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return resolve({ isValid: true, peerCount: 1 });
      }

      const handler = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'room-check-result' && msg.roomId === targetRoomId) {
            this.ws?.removeEventListener('message', handler);
            resolve({ isValid: msg.isValid, peerCount: msg.peerCount });
          }
        } catch {}
      };

      this.ws.addEventListener('message', handler);
      this.ws.send(JSON.stringify({ type: 'check-room', checkRoomId: targetRoomId }));

      setTimeout(() => {
        this.ws?.removeEventListener('message', handler);
        // Fallback: If network has latency or offline hotspot mode, allow connection attempt
        resolve({ isValid: true, peerCount: 1 });
      }, 2500);
    });
  }

  public start() {
    if (typeof window !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      window.addEventListener('focus', this.handleWindowFocus);
      window.addEventListener('online', this.handleOnline);
    }
    this.connectSignaling();
    this.startHeartbeat();
  }

  public stop() {
    if (typeof window !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      window.removeEventListener('focus', this.handleWindowFocus);
      window.removeEventListener('online', this.handleOnline);
    }
    this.stopHeartbeat();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.p2pTimeoutTimer) clearTimeout(this.p2pTimeoutTimer);
    if (this.handshakeRetryTimer) clearTimeout(this.handshakeRetryTimer);
    // Cancel any open native file streams
    const bridge = getAndroidFileBridge();
    if (bridge) {
      for (const active of this.activeReceiving.values()) {
        if (active.useNativeBridge) {
          try { bridge.cancelFile(active.fileId); } catch {}
        }
      }
      try { bridge.setKeepScreenOn(false); } catch {}
    }
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }
    if (this.cloudClient) {
      try { this.cloudClient.disconnect(); } catch {}
      this.cloudClient = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.connectedPeers = [];
    this.activeReceiving.clear();
    this.activeReceivingByHash.clear();
    this.earlyChunksBuffer.clear();
    this.onPeersChange?.([]);
    this.setMode('disconnected');
  }

  public forceReconnect() {
    console.log('[Recovery] Force reconnecting signaling & WebRTC...');
    this.handshakeRetryCount = 0;
    if (this.handshakeRetryTimer) {
      clearTimeout(this.handshakeRetryTimer);
      this.handshakeRetryTimer = null;
    }
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }
    if (this.cloudClient) {
      this.cloudClient.reconnect();
      this.cloudClient.startDiscoveryAnnouncement();
    } else {
      this.connectSignaling();
    }
    if (this.connectedPeers.length > 0) {
      const targetId = this.connectedPeers[0].id;
      this.setMode('connecting');
      this.initiatePeerConnection(targetId, this.peerId > targetId, true);
    }
  }

  public checkAndRecoverConnection() {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }

    if (this.cloudClient) {
      this.cloudClient.reconnect();
      this.sendSignaling({
        type: 'join',
        roomId: this.roomId,
        peerId: this.peerId,
        name: this.deviceName,
        deviceType: this.deviceType,
      });

      const isChannelOpen = this.dataChannel && this.dataChannel.readyState === 'open';
      if (!isChannelOpen && this.connectedPeers.length > 0 && !this.isBusy() && this.activeReceiving.size === 0) {
        console.log('[Recovery] Cloud DataChannel not open, re-initiating WebRTC handshake...');
        this.initiatePeerConnection(this.connectedPeers[0].id, this.isInitiator);
      }
      return;
    }

    // 1. Re-open WebSocket if disconnected
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      console.log('[Recovery] WebSocket closed, reconnecting now...');
      this.connectSignaling();
      return;
    }

    // 2. Re-register presence in room if socket is open
    if (this.ws.readyState === WebSocket.OPEN) {
      this.sendSignaling({
        type: 'join',
        roomId: this.roomId,
        peerId: this.peerId,
        name: this.deviceName,
        deviceType: this.deviceType,
      });
    }

    // 3. Check WebRTC DataChannel liveness
    const isChannelOpen = this.dataChannel && this.dataChannel.readyState === 'open';
    if (!isChannelOpen && this.connectedPeers.length > 0 && !this.isBusy() && this.activeReceiving.size === 0) {
      console.log('[Recovery] DataChannel not open, re-initiating WebRTC handshake...');
      this.initiatePeerConnection(this.connectedPeers[0].id, this.isInitiator);
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.lastPeerHeartbeat = Date.now();

    this.heartbeatInterval = setInterval(() => {
      if (this.connectedPeers.length === 0) return;
      const now = Date.now();

      // CRITICAL FIX: While actively transferring or receiving files, NEVER disconnect!
      const isActivelyTransferring = this.isBusy() || this.activeReceiving.size > 0;
      if (isActivelyTransferring) {
        this.lastPeerHeartbeat = now;
        return;
      }

      // Send ping over DataChannel if direct P2P
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(
            JSON.stringify({
              type: 'hb-ping',
              peer: { id: this.peerId, name: this.deviceName, deviceType: this.deviceType },
            })
          );
        } catch {}
      } else if (this.connectedPeers.length > 0) {
        this.sendSignaling({
          type: 'relay-text',
          targetPeerId: this.connectedPeers[0].id,
          text: '__HB__',
          senderName: this.deviceName,
          deviceType: this.deviceType,
          isHeartbeat: true,
        });
      }

      // If peer stopped responding for more than 25 seconds, clear stale connection
      if (now - this.lastPeerHeartbeat > 25000) {
        console.warn('[Heartbeat] Peer heartbeat timed out');
        this.connectedPeers = [];
        this.onPeersChange?.([]);
        this.setMode('connecting');

        // Refresh room registry on signaling server
        this.sendSignaling({
          type: 'join',
          roomId: this.roomId,
          peerId: this.peerId,
          name: this.deviceName,
          deviceType: this.deviceType,
        });
      }
    }, 3000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private setMode(mode: ConnectionMode) {
    if (this.connectionMode !== mode) {
      this.connectionMode = mode;
      this.onConnectionChange?.(mode);
    }
  }

  private notifyProgress() {
    const list = Array.from(this.transfers.values()).sort((a, b) => b.timestamp - a.timestamp);
    this.onProgressChange?.(list);
  }

  // --- Signaling Connection (WebSocket or Cloud Relay) ---
  private connectSignaling() {
    // Teardown existing connections
    if (this.cloudClient) {
      try { this.cloudClient.disconnect(); } catch {}
      this.cloudClient = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }

    const wsUrl = resolveSignalingUrl(this.currentSignalingUrl);
    this.currentSignalingUrl = wsUrl;

    // If explicit custom ws:// or wss:// server given (e.g. Render or local IP), use WebSocket
    if (wsUrl && (wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://'))) {
      this.connectWebSocket(wsUrl);
      return;
    }

    // Default for Vercel and Android APK: Connect via Cloud Public Relay (zero configuration needed)
    this.connectCloudRelay();
  }

  private connectCloudRelay() {
    this.signalingStatus = 'connecting';
    this.onSignalingStatusChange?.('connecting', 'Cloud Relay (Zero-Config)');

    const client = new CloudSignalingClient(
      this.roomId,
      this.peerId,
      this.deviceName,
      this.deviceType,
      {
        onOpen: () => {
          console.log('[Signaling] Cloud relay active for room:', this.roomId);
          this.signalingStatus = 'connected';
          this.onSignalingStatusChange?.('connected', 'Cloud Relay (Zero-Config)');
        },
        onClose: () => {
          this.signalingStatus = 'disconnected';
          this.onSignalingStatusChange?.('disconnected', 'Cloud Relay (Zero-Config)');
        },
        onError: (err) => {
          console.warn('[Signaling] Cloud relay error:', err);
          this.signalingStatus = 'disconnected';
          this.onSignalingStatusChange?.('disconnected', 'Cloud Relay (Zero-Config)');
        },
        onMessage: (msg) => {
          this.handleSignalingMessage(msg);
        },
      }
    );

    this.cloudClient = client;
    client.connect();
  }

  private connectWebSocket(wsUrl: string) {
    this.signalingStatus = 'connecting';
    this.onSignalingStatusChange?.('connecting', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log('[Signaling] Connected to custom server:', wsUrl);
        this.signalingStatus = 'connected';
        this.onSignalingStatusChange?.('connected', wsUrl);

        this.sendSignaling({
          type: 'join',
          roomId: this.roomId,
          peerId: this.peerId,
          name: this.deviceName,
          deviceType: this.deviceType,
        });
      };

      this.ws.onmessage = async (event) => {
        if (event.data instanceof ArrayBuffer) {
          this.handleIncomingBinaryChunk(event.data);
          return;
        }
        if (event.data instanceof Blob) {
          try {
            const buf = await event.data.arrayBuffer();
            this.handleIncomingBinaryChunk(buf);
          } catch (e) {
            console.error('Error reading WebSocket Blob:', e);
          }
          return;
        }

        try {
          const msg = JSON.parse(event.data);
          this.handleSignalingMessage(msg);
        } catch (err) {
          console.error('Error parsing signaling message:', err);
        }
      };

      this.ws.onclose = () => {
        console.warn('Signaling socket closed for:', wsUrl);
        this.signalingStatus = 'disconnected';
        this.onSignalingStatusChange?.('disconnected', wsUrl);

        if (this.connectionMode !== 'direct_p2p') {
          if (this.connectedPeers.length > 0) {
            this.connectedPeers = [];
            this.onPeersChange?.([]);
          }
          this.setMode('disconnected');
          let hasActive = false;
          this.transfers.forEach((progress) => {
            if (progress.status === 'transferring' || progress.status === 'queued') {
              progress.status = 'error';
              progress.speedBytesPerSec = 0;
              this.onTransferError?.(progress.name, 'Connection lost');
              hasActive = true;
            }
          });
          if (hasActive) {
            this.notifyProgress();
          }
        }
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            this.connectSignaling();
          }
        }, 3500);
      };

      this.ws.onerror = (err) => {
        console.warn('Signaling socket error for:', wsUrl, err);
        this.signalingStatus = 'disconnected';
        this.onSignalingStatusChange?.('disconnected', wsUrl);
      };
    } catch (e) {
      console.error('Failed to connect to signaling socket:', e);
      this.signalingStatus = 'disconnected';
      this.onSignalingStatusChange?.('disconnected', wsUrl);
      this.connectedPeers = [];
      this.onPeersChange?.([]);
      this.setMode('disconnected');
    }
  }

  private handleSignalingMessage(msg: any) {
    switch (msg.type) {
      case 'joined': {
        const peers: PeerDevice[] = msg.peers || [];
        // Merge peers without losing existing peer metadata
        peers.forEach((p) => this.ensurePeer(p.id, p.name, p.deviceType as 'mobile' | 'laptop'));

        if (this.connectedPeers.length > 0) {
          this.lastPeerHeartbeat = Date.now();
          const targetId = this.connectedPeers[0].id;
          const isChannelOpen = this.dataChannel && this.dataChannel.readyState === 'open';
          const isPcActive =
            this.peerConnection &&
            (this.peerConnection.connectionState === 'connecting' ||
              this.peerConnection.connectionState === 'connected');
          if (!isChannelOpen && !isPcActive) {
            this.setMode('connecting');
            const asInitiator = this.peerId > targetId;
            this.initiatePeerConnection(targetId, asInitiator);
          }
        } else {
          this.setMode('connecting');
        }
        break;
      }

      case 'peer-joined': {
        const newPeer: PeerDevice = msg.peer;
        this.lastPeerHeartbeat = Date.now();
        this.ensurePeer(newPeer.id, newPeer.name, newPeer.deviceType as 'mobile' | 'laptop');

        const isChannelOpen = this.dataChannel && this.dataChannel.readyState === 'open';
        const isPcActive =
          this.peerConnection &&
          (this.peerConnection.connectionState === 'connecting' ||
            this.peerConnection.connectionState === 'connected');

        if (!isChannelOpen && (!isPcActive || msg.isRejoin)) {
          this.setMode('connecting');
          const asInitiator = this.peerId > newPeer.id;
          // If peer rejoined while our old PC wasn't open yet, force fresh negotiation
          this.initiatePeerConnection(newPeer.id, asInitiator, !!msg.isRejoin && !isPcActive);
        }
        break;
      }

      case 'peer-left': {
        console.log('Peer left event received for:', msg.peerId);
        this.transfers.forEach((progress) => {
          if (progress.status === 'transferring' || progress.status === 'queued') {
            progress.status = 'error';
            progress.speedBytesPerSec = 0;
            this.onTransferError?.(progress.name, 'Device disconnected');
          }
        });
        this.notifyProgress();
        this.connectedPeers = this.connectedPeers.filter((p) => p.id !== msg.peerId);
        this.onPeersChange?.(this.connectedPeers);
        if (this.connectedPeers.length === 0) {
          if (this.dataChannel) {
            try { this.dataChannel.close(); } catch {}
            this.dataChannel = null;
          }
          if (this.peerConnection) {
            try { this.peerConnection.close(); } catch {}
            this.peerConnection = null;
          }
          this.setMode('connecting');
        }
        break;
      }

      case 'signal': {
        this.ensurePeer(msg.fromPeerId);
        this.handlePeerSignal(msg.fromPeerId, msg.signal);
        break;
      }

      // --- Fallback Relay Message Handlers ---
      case 'relay-meta': {
        this.ensurePeer(msg.fromPeerId, msg.senderName);
        this.handleIncomingFileHeader(msg.fileId, msg.name, msg.size, msg.mimeType, msg.totalChunks, this.getPeerName(msg.fromPeerId));
        break;
      }

      case 'relay-chunk': {
        this.handleIncomingRelayChunk(msg.fileId, msg.chunkIndex, msg.data);
        break;
      }

      case 'relay-complete': {
        this.handleIncomingFileComplete(msg.fileId);
        break;
      }

      case 'relay-text': {
        this.ensurePeer(msg.fromPeerId, msg.senderName, msg.deviceType);
        if (msg.isHeaderAck) {
          this.lastPeerHeartbeat = Date.now();
          break;
        }

        if (msg.isHeartbeat) {
          this.lastPeerHeartbeat = Date.now();
          if (msg.text === '__HB__') {
            this.sendSignaling({
              type: 'relay-text',
              targetPeerId: msg.fromPeerId,
              text: '__HB_ACK__',
              isHeartbeat: true,
            });
          }
          break;
        }

        const snippet: SharedSnippet = {
          id: 'snip_' + Date.now(),
          senderName: this.getPeerName(msg.fromPeerId),
          text: msg.text,
          timestamp: Date.now(),
          direction: 'incoming',
        };
        this.snippets = [snippet, ...this.snippets];
        this.onSnippetReceived?.(snippet);
        playSuccessChime();
        break;
      }

      case 'relay-cancel': {
        this.cancelIncomingTransfer(msg.fileId);
        break;
      }
    }
  }

  // --- WebRTC Peer-to-Peer Negotiation ---
  private initiatePeerConnection(targetPeerId: string, asInitiator: boolean, forceReset = false) {
    if (!forceReset && this.dataChannel && this.dataChannel.readyState === 'open') {
      console.log('[WebRTC] DataChannel already open, skipping re-negotiation');
      return;
    }

    if (
      !forceReset &&
      this.peerConnection &&
      (this.peerConnection.connectionState === 'connected' || this.peerConnection.iceConnectionState === 'connected')
    ) {
      console.log('[WebRTC] PeerConnection already connected, skipping re-negotiation');
      return;
    }

    this.isInitiator = asInitiator;
    this.isMakingOffer = false;
    this.isSettingRemoteDescription = false;
    this.pendingCandidates = [];

    if (this.handshakeRetryTimer) {
      clearTimeout(this.handshakeRetryTimer);
      this.handshakeRetryTimer = null;
    }

    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }

    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:stun.services.mozilla.com' },
        {
          urls: [
            'stun:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:80?transport=tcp',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
            'turns:openrelay.metered.ca:443?transport=tcp',
          ],
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
      bundlePolicy: 'max-bundle',
      iceCandidatePoolSize: 8,
    };

    const pc = new RTCPeerConnection(config);
    this.peerConnection = pc;

    // Auto-retry handshake if DataChannel doesn't open within 7 seconds
    this.handshakeRetryTimer = setTimeout(() => {
      if (this.peerConnection !== pc) return;
      const isOpen = this.dataChannel && this.dataChannel.readyState === 'open';
      if (!isOpen && this.connectedPeers.length > 0 && this.handshakeRetryCount < 4) {
        this.handshakeRetryCount++;
        console.warn(`[WebRTC] Handshake retry #${this.handshakeRetryCount} for ${targetPeerId}...`);
        // Initiator retries offer; non-initiator re-announces presence to nudge initiator
        if (this.peerId > targetPeerId) {
          this.initiatePeerConnection(targetPeerId, true, true);
        } else {
          this.cloudClient?.announcePresence();
          this.sendSignaling({
            type: 'join',
            roomId: this.roomId,
            peerId: this.peerId,
            name: this.deviceName,
            deviceType: this.deviceType,
          });
        }
      }
    }, 7000);

    // Timeout safety: if P2P isn't ready in 18 seconds, switch badge to relay while keeping retries possible
    if (this.p2pTimeoutTimer) clearTimeout(this.p2pTimeoutTimer);
    this.p2pTimeoutTimer = setTimeout(() => {
      if (this.peerConnection !== pc) return;
      const isOpen = this.dataChannel && this.dataChannel.readyState === 'open';
      if (!isOpen && this.connectedPeers.length > 0) {
        console.log('WebRTC P2P timeout - switching to Relay Mode');
        this.setMode('relay');
      }
    }, 18000);

    pc.onicecandidate = (event) => {
      if (this.peerConnection !== pc) return;
      if (event.candidate) {
        this.sendSignaling({
          type: 'signal',
          targetPeerId,
          signal: { candidate: event.candidate },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (this.peerConnection !== pc) return;
      console.log('[WebRTC] ICE Connection State:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (this.p2pTimeoutTimer) clearTimeout(this.p2pTimeoutTimer);
        if (this.handshakeRetryTimer) clearTimeout(this.handshakeRetryTimer);
        this.handshakeRetryCount = 0;
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          this.cloudClient?.stopDiscoveryAnnouncement();
          this.setMode('direct_p2p');
        }
      } else if (pc.iceConnectionState === 'failed') {
        console.warn('[WebRTC] ICE failed, attempting restart/re-negotiation...');
        this.cloudClient?.startDiscoveryAnnouncement();
        if (this.connectedPeers.length > 0) {
          this.setMode('connecting');
          if (this.peerId > targetPeerId && this.handshakeRetryCount < 4) {
            this.handshakeRetryCount++;
            setTimeout(() => {
              if (this.peerConnection === pc && pc.iceConnectionState === 'failed') {
                this.initiatePeerConnection(targetPeerId, true, true);
              }
            }, 1200);
          }
        }
      } else if (pc.iceConnectionState === 'disconnected') {
        this.cloudClient?.startDiscoveryAnnouncement();
      }
    };

    pc.onconnectionstatechange = () => {
      if (this.peerConnection !== pc) return;
      console.log('[WebRTC] Peer Connection State:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        if (this.p2pTimeoutTimer) clearTimeout(this.p2pTimeoutTimer);
        if (this.handshakeRetryTimer) clearTimeout(this.handshakeRetryTimer);
        this.handshakeRetryCount = 0;
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          this.cloudClient?.stopDiscoveryAnnouncement();
          this.setMode('direct_p2p');
        }
      } else if (pc.connectionState === 'failed') {
        this.cloudClient?.startDiscoveryAnnouncement();
        if (this.connectedPeers.length > 0) {
          this.setMode('relay');
        }
      }
    };

    if (asInitiator) {
      // Create DataChannel as initiator
      const channel = pc.createDataChannel('hotspot-drop-channel', {
        ordered: true,
      });
      this.setupDataChannel(channel, targetPeerId);

      const makeOffer = async () => {
        if (this.peerConnection !== pc || this.isMakingOffer || pc.signalingState !== 'stable') return;
        try {
          this.isMakingOffer = true;
          const offer = await pc.createOffer();
          if (this.peerConnection !== pc || pc.signalingState !== 'stable') return;
          await pc.setLocalDescription(offer);
          this.sendSignaling({
            type: 'signal',
            targetPeerId,
            signal: { description: pc.localDescription },
          });
        } catch (err) {
          console.error('[WebRTC] Error creating offer:', err);
        } finally {
          this.isMakingOffer = false;
        }
      };

      pc.onnegotiationneeded = () => {
        makeOffer();
      };
      setTimeout(makeOffer, 60);
    } else {
      // Receiver sets up channel when received
      pc.ondatachannel = (event) => {
        console.log('[WebRTC] Remote DataChannel received');
        this.setupDataChannel(event.channel, targetPeerId);
      };
    }
  }

  private setupDataChannel(channel: RTCDataChannel, targetPeerId: string) {
    this.dataChannel = channel;
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = LOW_BUFFER_THRESHOLD;

    channel.onopen = () => {
      if (this.p2pTimeoutTimer) clearTimeout(this.p2pTimeoutTimer);
      if (this.handshakeRetryTimer) clearTimeout(this.handshakeRetryTimer);
      this.handshakeRetryCount = 0;
      this.cloudClient?.stopDiscoveryAnnouncement();
      this.setMode('direct_p2p');
      this.ensurePeer(targetPeerId);

      // Exchange device profile over direct DataChannel so both devices show exact name and type immediately
      try {
        channel.send(
          JSON.stringify({
            type: 'peer-info',
            id: this.peerId,
            name: this.deviceName,
            deviceType: this.deviceType,
          })
        );
      } catch {}

      console.log('⚡ Direct P2P DataChannel opened successfully');
    };

    channel.onclose = () => {
      if (this.dataChannel !== channel) return;
      this.cloudClient?.startDiscoveryAnnouncement();
      if (this.connectedPeers.length > 0) {
        this.setMode('relay');
      }
    };

    channel.onerror = (err) => {
      if (this.dataChannel !== channel) return;
      console.warn('DataChannel error:', err);
      this.cloudClient?.startDiscoveryAnnouncement();
      if (this.connectedPeers.length > 0) {
        this.setMode('relay');
      }
    };

    channel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          this.handleChannelControlMessage(msg, targetPeerId);
        } catch (e) {
          console.error('DataChannel JSON parse error:', e);
        }
      } else if (event.data instanceof ArrayBuffer) {
        this.handleIncomingBinaryChunk(event.data);
      } else if (event.data instanceof Blob) {
        try {
          const buf = await event.data.arrayBuffer();
          this.handleIncomingBinaryChunk(buf);
        } catch (e) {
          console.error('Error reading DataChannel Blob:', e);
        }
      }
    };
  }

  private async handlePeerSignal(fromPeerId: string, signal: any) {
    // CRITICAL FIX: Never drop an incoming offer or ICE candidate if PeerConnection hasn't been created yet!
    if (
      !this.peerConnection ||
      this.peerConnection.signalingState === 'closed' ||
      this.peerConnection.connectionState === 'failed'
    ) {
      if (signal.description?.type === 'offer') {
        console.log('[WebRTC] Offer arrived before PC init — creating receiver PeerConnection immediately');
        this.initiatePeerConnection(fromPeerId, false, true);
      } else if (signal.candidate) {
        this.pendingCandidates.push(signal.candidate);
        return;
      } else {
        return;
      }
    }

    const pc = this.peerConnection;
    if (!pc) return;

    try {
      if (signal.description) {
        const description = signal.description;
        const isPolite = this.peerId < fromPeerId;
        const offerCollision =
          description.type === 'offer' &&
          (this.isMakingOffer || pc.signalingState !== 'stable');

        const ignoreOffer = !isPolite && offerCollision;
        if (ignoreOffer) {
          console.warn('[WebRTC] Impolite peer ignoring colliding offer from', fromPeerId);
          return;
        }

        if (offerCollision && isPolite) {
          console.log('[WebRTC] Polite peer rolling back colliding offer for', fromPeerId);
          try {
            await pc.setLocalDescription({ type: 'rollback' });
          } catch (e) {
            console.warn('[WebRTC] Rollback error (ignoring):', e);
          }
        }

        // Ignore duplicate/stale answer if already stable
        if (description.type === 'answer' && pc.signalingState === 'stable') {
          console.log('[WebRTC] Ignoring duplicate answer in stable state');
          return;
        }

        this.isSettingRemoteDescription = true;
        try {
          await pc.setRemoteDescription(description);
        } finally {
          this.isSettingRemoteDescription = false;
        }

        // Flush any buffered ICE candidates as soon as remoteDescription is set
        await this.flushPendingCandidates(pc);

        if (description.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.sendSignaling({
            type: 'signal',
            targetPeerId: fromPeerId,
            signal: { description: pc.localDescription },
          });
          // Flush any candidates that arrived while creating/setting answer
          await this.flushPendingCandidates(pc);
        }
      } else if (signal.candidate) {
        if (!pc.remoteDescription || this.isSettingRemoteDescription) {
          this.pendingCandidates.push(signal.candidate);
        } else {
          try {
            await pc.addIceCandidate(signal.candidate);
          } catch (err) {
            console.warn('Error adding ice candidate, buffering for retry:', err);
            this.pendingCandidates.push(signal.candidate);
          }
        }
      }
    } catch (err) {
      console.error('Error handling peer signal:', err);
    }
  }

  private async flushPendingCandidates(pc: RTCPeerConnection) {
    while (this.pendingCandidates.length > 0 && pc.remoteDescription && pc.signalingState !== 'closed') {
      const cand = this.pendingCandidates.shift();
      if (cand) {
        try {
          await pc.addIceCandidate(cand);
        } catch (err) {
          console.warn('Error applying buffered candidate:', err);
        }
      }
    }
  }

  // --- Channel Control Messages (P2P) ---
  private handleChannelControlMessage(msg: any, senderPeerId: string) {
    switch (msg.type) {
      case 'file-header':
        this.handleIncomingFileHeader(
          msg.fileId,
          msg.name,
          msg.size,
          msg.mimeType,
          msg.totalChunks,
          this.getPeerName(senderPeerId)
        );
        break;
      case 'file-complete':
        this.handleIncomingFileComplete(msg.fileId);
        break;
      case 'file-cancel':
        this.cancelIncomingTransfer(msg.fileId);
        break;
      case 'peer-info':
        this.ensurePeer(msg.id, msg.name, msg.deviceType);
        break;
      case 'header-ack':
      case 'transfer-ack':
        this.lastPeerHeartbeat = Date.now();
        break;
      case 'hb-ping':
        if (msg.peer) {
          this.ensurePeer(msg.peer.id, msg.peer.name, msg.peer.deviceType);
        }
        try {
          this.dataChannel?.send(
            JSON.stringify({
              type: 'hb-pong',
              peer: { id: this.peerId, name: this.deviceName, deviceType: this.deviceType },
            })
          );
        } catch {}
        this.lastPeerHeartbeat = Date.now();
        break;
      case 'hb-pong':
        if (msg.peer) {
          this.ensurePeer(msg.peer.id, msg.peer.name, msg.peer.deviceType);
        }
        this.lastPeerHeartbeat = Date.now();
        break;
      case 'text-snippet': {
        const snippet: SharedSnippet = {
          id: 'snip_' + Date.now(),
          senderName: this.getPeerName(senderPeerId),
          text: msg.text,
          timestamp: Date.now(),
          direction: 'incoming',
        };
        this.snippets = [snippet, ...this.snippets];
        this.onSnippetReceived?.(snippet);
        playSuccessChime();
        break;
      }
    }
  }

  private flushNativeChunks(active: ActiveReceivingFile): boolean {
    if (!active.useNativeBridge || active.currentSegmentChunks.length === 0) return true;
    const bridge = getAndroidFileBridge();
    if (!bridge) return false;

    const merged = new Uint8Array(active.currentSegmentBytes);
    let offset = 0;
    for (const c of active.currentSegmentChunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    active.currentSegmentChunks = [];
    active.currentSegmentBytes = 0;

    const ok = bridge.writeChunkBase64(active.fileId, uint8ArrayToBase64(merged));
    if (!ok) {
      console.error('[NativeBridge] Failed to write chunk for', active.fileId);
    }
    return ok;
  }

  // --- File Reception Logic (Native Disk Streaming on Android + Segmented Blob on Desktop) ---
  private handleIncomingFileHeader(
    fileId: string,
    name: string,
    size: number,
    mimeType: string,
    totalChunks: number,
    senderName: string
  ) {
    // If already registered via dual signaling, do not recreate
    if (this.activeReceiving.has(fileId)) {
      return;
    }

    const isAnotherReceiving = Array.from(this.activeReceiving.values()).some(
      (f) => f.receivedChunks < f.totalChunks && !this.cancelledTransfers.has(f.fileId)
    );

    const initialStatus = isAnotherReceiving ? 'queued' : 'transferring';

    if (!isAnotherReceiving) {
      playStartChime();
    }

    // On Android APK, stream directly to Downloads/HotSpotDrop/ with near-zero RAM!
    const bridge = getAndroidFileBridge();
    let useNativeBridge = false;
    if (bridge) {
      try {
        useNativeBridge = bridge.startFile(fileId, name, mimeType || 'application/octet-stream');
      } catch (e) {
        console.warn('[NativeBridge] startFile failed, falling back to Blob:', e);
        useNativeBridge = false;
      }
    }

    const activeFile: ActiveReceivingFile = {
      fileId,
      fileIdHash: this.hashString(fileId),
      name,
      size,
      mimeType: mimeType || 'application/octet-stream',
      totalChunks,
      useNativeBridge,
      blobSegments: [],
      currentSegmentChunks: [],
      currentSegmentBytes: 0,
      pendingChunks: new Map(),
      nextFlushedIndex: 0,
      receivedBytes: 0,
      receivedChunks: 0,
      startTime: Date.now(),
      lastProgressUpdate: Date.now(),
      lastBytesCount: 0,
      speed: 0,
      senderName,
      receivedCompleteSignal: false,
    };

    this.activeReceiving.set(fileId, activeFile);
    this.activeReceivingByHash.set(activeFile.fileIdHash, activeFile);
    this.updateKeepScreenOn();

    const progress: TransferProgress = {
      fileId,
      name,
      size,
      type: mimeType,
      transferredBytes: 0,
      progressPercent: 0,
      speedBytesPerSec: 0,
      etaSeconds: 0,
      status: initialStatus,
      direction: 'incoming',
      mode: this.connectionMode,
      peerName: senderName,
      timestamp: Date.now(),
    };

    this.transfers.set(fileId, progress);
    this.notifyProgress();

    // Send ACK back so sender knows receiver is ready
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'header-ack', fileId }));
      } catch {}
    }
    if (this.connectedPeers.length > 0) {
      this.sendSignaling({
        type: 'relay-text',
        targetPeerId: this.connectedPeers[0].id,
        text: `__ACK__:${fileId}`,
        isHeaderAck: true,
      });
    }

    // Handle 0-byte empty files immediately
    if (totalChunks === 0 || size === 0) {
      this.handleIncomingFileComplete(fileId);
      return;
    }

    // Apply any chunks that arrived early before the header was processed
    const earlyChunks = this.earlyChunksBuffer.get(activeFile.fileIdHash);
    if (earlyChunks && earlyChunks.length > 0) {
      for (const item of earlyChunks) {
        this.applyChunk(activeFile, item.chunkIndex, item.payload);
      }
      this.earlyChunksBuffer.delete(activeFile.fileIdHash);
    }
  }

  // Direct Binary Chunk Receiver (WebRTC P2P)
  // Header: 12 bytes = [uint32 fileIdHash, uint32 chunkIndex, uint32 totalChunks]
  private handleIncomingBinaryChunk(buffer: ArrayBuffer) {
    if (buffer.byteLength < 12) return;
    const view = new DataView(buffer);
    const fileIdHash = view.getUint32(0);
    const chunkIndex = view.getUint32(4);
    const payload = new Uint8Array(buffer, 12);

    // Instant O(1) lookup by pre-computed fileIdHash
    const targetFile = this.activeReceivingByHash.get(fileIdHash);
    if (!targetFile) {
      // Buffer early arriving chunk so no packet is lost due to event loop order
      if (!this.earlyChunksBuffer.has(fileIdHash)) {
        this.earlyChunksBuffer.set(fileIdHash, []);
      }
      this.earlyChunksBuffer.get(fileIdHash)!.push({ chunkIndex, payload });
      return;
    }
    this.applyChunk(targetFile, chunkIndex, payload);
  }

  // Relay Base64 Chunk Receiver
  private handleIncomingRelayChunk(fileId: string, chunkIndex: number, base64Data: string) {
    const targetFile = this.activeReceiving.get(fileId);
    if (!targetFile) return;

    // Decode base64 to Uint8Array
    const binaryStr = atob(base64Data);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    this.applyChunk(targetFile, chunkIndex, bytes);
  }

  private applyChunk(targetFile: ActiveReceivingFile, chunkIndex: number, payload: Uint8Array) {
    if (this.cancelledTransfers.has(targetFile.fileId)) return;
    this.lastPeerHeartbeat = Date.now();

    const progress = this.transfers.get(targetFile.fileId);
    if (progress && progress.status === 'queued') {
      progress.status = 'transferring';
      playStartChime();
      this.notifyProgress();
    }

    // Only process chunk if not already recorded
    if (!targetFile.pendingChunks.has(chunkIndex)) {
      targetFile.pendingChunks.set(chunkIndex, payload);
      targetFile.receivedBytes += payload.byteLength;
      targetFile.receivedChunks += 1;

      // Sequential flush of contiguous chunks into native disk stream (Android) or Blob segments (Desktop)
      while (targetFile.pendingChunks.has(targetFile.nextFlushedIndex)) {
        const chunk = targetFile.pendingChunks.get(targetFile.nextFlushedIndex)!;
        targetFile.pendingChunks.delete(targetFile.nextFlushedIndex);
        targetFile.currentSegmentChunks.push(chunk);
        targetFile.currentSegmentBytes += chunk.byteLength;
        targetFile.nextFlushedIndex++;

        if (targetFile.useNativeBridge) {
          if (targetFile.currentSegmentBytes >= NATIVE_FLUSH_BYTES) {
            this.flushNativeChunks(targetFile);
          }
        } else if (targetFile.currentSegmentBytes >= SEGMENT_FLUSH_BYTES) {
          const segBlob = new Blob(targetFile.currentSegmentChunks as unknown as BlobPart[], {
            type: 'application/octet-stream',
          });
          targetFile.blobSegments.push(segBlob);
          targetFile.currentSegmentChunks = [];
          targetFile.currentSegmentBytes = 0;
        }
      }

      // Send periodic ACK to sender every 250 chunks (~8MB) to keep DataChannel and heartbeat fresh
      if (targetFile.receivedChunks % 250 === 0 && this.dataChannel && this.dataChannel.readyState === 'open') {
        try {
          this.dataChannel.send(
            JSON.stringify({
              type: 'transfer-ack',
              fileId: targetFile.fileId,
              receivedChunks: targetFile.receivedChunks,
            })
          );
        } catch {}
      }
    }

    const now = Date.now();
    // Update progress throttled to 150ms or on completion to prevent mobile JS thread choke
    if (now - targetFile.lastProgressUpdate > 150 || targetFile.receivedChunks === targetFile.totalChunks) {
      const timeDiff = (now - targetFile.lastProgressUpdate) / 1000;
      if (timeDiff > 0.05) {
        const bytesDiff = targetFile.receivedBytes - targetFile.lastBytesCount;
        targetFile.speed = bytesDiff / timeDiff;
        targetFile.lastProgressUpdate = now;
        targetFile.lastBytesCount = targetFile.receivedBytes;
      }

      const percent = Math.min(100, Math.round((targetFile.receivedBytes / targetFile.size) * 100));
      const remainingBytes = Math.max(0, targetFile.size - targetFile.receivedBytes);
      const eta = targetFile.speed > 0 ? remainingBytes / targetFile.speed : 0;

      if (progress) {
        progress.transferredBytes = targetFile.receivedBytes;
        progress.progressPercent = percent;
        progress.speedBytesPerSec = Math.round(targetFile.speed);
        progress.etaSeconds = eta;
        this.notifyProgress();
      }
    }

    if (
      targetFile.receivedChunks === targetFile.totalChunks ||
      (targetFile.receivedCompleteSignal && targetFile.receivedChunks === targetFile.totalChunks)
    ) {
      this.handleIncomingFileComplete(targetFile.fileId);
    }
  }

  private handleIncomingFileComplete(fileId: string) {
    const active = this.activeReceiving.get(fileId);
    if (!active) return;

    // If chunks are still in flight, defer until the final chunk is applied
    if (active.receivedChunks < active.totalChunks) {
      console.log(`[Transfer] File complete signal arrived early for ${fileId} (${active.receivedChunks}/${active.totalChunks} chunks). Deferring completion.`);
      active.receivedCompleteSignal = true;
      return;
    }

    // If there were any out-of-order chunks still in pendingChunks, append them in order
    if (active.pendingChunks.size > 0) {
      const remainingIndices = Array.from(active.pendingChunks.keys()).sort((a, b) => a - b);
      for (const idx of remainingIndices) {
        const chunk = active.pendingChunks.get(idx)!;
        active.currentSegmentChunks.push(chunk);
        active.currentSegmentBytes += chunk.byteLength;
      }
      active.pendingChunks.clear();
    }

    let blob: Blob | undefined;
    let downloadUrl: string | undefined;
    let savedPath: string | undefined;

    if (active.useNativeBridge) {
      // Flush final bytes directly to Android Downloads/HotSpotDrop/
      this.flushNativeChunks(active);
      const bridge = getAndroidFileBridge();
      if (bridge) {
        try {
          savedPath = bridge.finishFile(fileId) || `Downloads/HotSpotDrop/${active.name}`;
        } catch (e) {
          console.error('[NativeBridge] finishFile error:', e);
        }
      }
    } else {
      // Flush any remaining chunks in the active segment
      if (active.currentSegmentChunks.length > 0) {
        const remainingBlob = new Blob(active.currentSegmentChunks as unknown as BlobPart[], {
          type: 'application/octet-stream',
        });
        active.blobSegments.push(remainingBlob);
        active.currentSegmentChunks = [];
        active.currentSegmentBytes = 0;
      }

      // Direct Blob creation from lightweight segments (uses negligible heap memory)
      blob = new Blob(active.blobSegments as unknown as BlobPart[], { type: active.mimeType });
      active.blobSegments = []; // Release segment references
      downloadUrl = URL.createObjectURL(blob);
    }

    const progress = this.transfers.get(fileId);
    if (progress) {
      progress.status = 'completed';
      progress.progressPercent = 100;
      progress.transferredBytes = active.size;
      progress.speedBytesPerSec = 0;
      progress.etaSeconds = 0;
      progress.blob = blob;
      progress.downloadUrl = downloadUrl;
      progress.savedPath = savedPath;
      this.notifyProgress();
    }

    this.activeReceiving.delete(fileId);
    if (active.fileIdHash) {
      this.activeReceivingByHash.delete(active.fileIdHash);
      this.earlyChunksBuffer.delete(active.fileIdHash);
    }
    this.updateKeepScreenOn();
    playSuccessChime();

    // Trigger browser auto-download if enabled (desktop / mobile browser; Android APK already saved natively!)
    if (this.autoDownloadEnabled && downloadUrl && !active.useNativeBridge) {
      this.triggerDownload(downloadUrl, active.name);
    }

    // Activate next queued incoming file if any exists
    for (const otherProgress of this.transfers.values()) {
      if (otherProgress.direction === 'incoming' && otherProgress.status === 'queued') {
        otherProgress.status = 'transferring';
        playStartChime();
        this.notifyProgress();
        break;
      }
    }
  }

  public triggerDownload(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  public cancelTransfer(fileId: string) {
    this.cancelledTransfers.add(fileId);
    // Remove from sendQueue if pending
    this.sendQueue = this.sendQueue.filter((item) => item.fileId !== fileId);

    const progress = this.transfers.get(fileId);
    if (progress && (progress.status === 'transferring' || progress.status === 'queued')) {
      progress.status = 'cancelled';
      progress.speedBytesPerSec = 0;
      this.notifyProgress();
      this.onTransferError?.(progress.name, 'Transfer cancelled');

      // Notify peer
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({ type: 'file-cancel', fileId }));
      } else if (this.connectedPeers.length > 0) {
        this.sendSignaling({
          type: 'relay-cancel',
          targetPeerId: this.connectedPeers[0].id,
          fileId,
        });
      }
    }
    const active = this.activeReceiving.get(fileId);
    if (active?.useNativeBridge) {
      try { getAndroidFileBridge()?.cancelFile(fileId); } catch {}
    }
    if (active?.fileIdHash) {
      this.activeReceivingByHash.delete(active.fileIdHash);
    }
    this.activeReceiving.delete(fileId);
    this.updateKeepScreenOn();
  }

  private cancelIncomingTransfer(fileId: string) {
    const active = this.activeReceiving.get(fileId);
    if (active?.useNativeBridge) {
      try { getAndroidFileBridge()?.cancelFile(fileId); } catch {}
    }
    if (active?.fileIdHash) {
      this.activeReceivingByHash.delete(active.fileIdHash);
    }
    this.activeReceiving.delete(fileId);
    const progress = this.transfers.get(fileId);
    if (progress) {
      progress.status = 'cancelled';
      progress.speedBytesPerSec = 0;
      this.notifyProgress();
      this.onTransferError?.(progress.name, 'Cancelled by sender');
    }
    this.updateKeepScreenOn();
  }

  public isBusy(): boolean {
    if (this.isSending || this.sendQueue.length > 0) return true;
    for (const t of this.transfers.values()) {
      if (t.status === 'transferring') return true;
    }
    return false;
  }

  // --- Sending Files ---
  public queueFiles(files: FileList | File[], targetPeerId?: string) {
    const peerId = targetPeerId || (this.connectedPeers[0] ? this.connectedPeers[0].id : null);
    if (!peerId || this.connectedPeers.length === 0) {
      this.checkAndRecoverConnection();
      throw new Error('Device connect nahi hai! Kripya pehle connect hone ka intezaar karein.');
    }

    const isDirectP2P = !!(this.dataChannel && this.dataChannel.readyState === 'open');
    const isWsOpen = !!(this.ws && this.ws.readyState === WebSocket.OPEN);
    const isCloudOpen = !!(this.cloudClient);
    if (!isDirectP2P && !isWsOpen && !isCloudOpen) {
      this.checkAndRecoverConnection();
      throw new Error('Connection re-sync ho raha hai, 2 second baad dobara send karein.');
    }

    const peerName = this.getPeerName(peerId);
    const now = Date.now();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = 'file_' + now + '_' + Math.random().toString(36).substring(2, 7) + '_' + i;

      // Register immediately in transfers so user sees it in queue instantly
      const progress: TransferProgress = {
        fileId,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        transferredBytes: 0,
        progressPercent: 0,
        speedBytesPerSec: 0,
        etaSeconds: 0,
        status: 'queued',
        direction: 'outgoing',
        mode: isDirectP2P ? 'direct_p2p' : 'relay',
        peerName,
        timestamp: now + i,
      };

      this.transfers.set(fileId, progress);
      this.sendQueue.push({ fileId, file, targetPeerId: peerId });
    }

    this.notifyProgress();
    this.processSendQueue();
  }

  private async processSendQueue() {
    if (this.isSending || this.sendQueue.length === 0) return;
    this.isSending = true;

    try {
      while (this.sendQueue.length > 0) {
        const item = this.sendQueue.shift();
        if (!item) break;

        // Skip if user cancelled while queued
        if (this.cancelledTransfers.has(item.fileId)) {
          continue;
        }

        // Activate transfer status
        const progress = this.transfers.get(item.fileId);
        if (progress) {
          progress.status = 'transferring';
          progress.mode = this.connectionMode;
          this.notifyProgress();
        }

        // Resolve active target peer (prefer connected peer)
        const targetId = this.connectedPeers.some((p) => p.id === item.targetPeerId)
          ? item.targetPeerId
          : (this.connectedPeers[0]?.id || item.targetPeerId);

        await this.sendFile(item.file, item.fileId, targetId);
      }
    } catch (err) {
      console.error('Error processing send queue:', err);
    } finally {
      this.isSending = false;
    }
  }

  private async sendFile(file: File, fileId: string, targetPeerId: string) {
    if (this.cancelledTransfers.has(fileId)) return;

    const peerName = this.getPeerName(targetPeerId);
    let progress = this.transfers.get(fileId);
    if (!progress) {
      progress = {
        fileId,
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        transferredBytes: 0,
        progressPercent: 0,
        speedBytesPerSec: 0,
        etaSeconds: 0,
        status: 'transferring',
        direction: 'outgoing',
        mode: this.connectionMode,
        peerName,
        timestamp: Date.now(),
      };
      this.transfers.set(fileId, progress);
    } else {
      progress.status = 'transferring';
    }

    this.updateKeepScreenOn();
    this.notifyProgress();

    try {
      let isDirectP2P = !!(this.dataChannel && this.dataChannel.readyState === 'open');
      const isLocalWs = !!(this.ws && this.ws.readyState === WebSocket.OPEN);

      // If P2P DataChannel is not open yet, actively ensure handshake is running and wait up to 15s
      if (!isDirectP2P && !isLocalWs) {
        const isPcConnecting =
          this.peerConnection &&
          (this.peerConnection.connectionState === 'connecting' ||
            this.peerConnection.iceConnectionState === 'checking');
        if (!isPcConnecting) {
          console.log('[WebRTC] Proactively initiating P2P handshake before transfer...');
          this.initiatePeerConnection(targetPeerId, this.peerId > targetPeerId, true);
        }

        console.log('[WebRTC] Waiting for DataChannel to be ready before starting transfer...');
        let waitCount = 0;
        while ((!this.dataChannel || this.dataChannel.readyState !== 'open') && waitCount < 60) {
          if (this.cancelledTransfers.has(fileId)) return;
          await new Promise((r) => setTimeout(r, 250));
          waitCount++;
        }
        isDirectP2P = !!(this.dataChannel && this.dataChannel.readyState === 'open');
      }

      // Large files (> 5MB) require Direct P2P or Local WebSocket (public MQTT brokers rate-limit large payloads)
      if (!isDirectP2P && !isLocalWs && file.size > 5 * 1024 * 1024) {
        throw new Error(
          'Direct P2P DataChannel connect nahi hua. Kripya dono devices ko same Wi-Fi / Hotspot pe rakhein ya Reconnect dabakar dobara try karein.'
        );
      }

      // Dynamically respect SCTP maxMessageSize across all Android WebViews & browsers
      const maxSctpMsg = this.peerConnection?.sctp?.maxMessageSize || 65536;
      const chunkSize = isDirectP2P
        ? Math.min(CHUNK_SIZE, Math.max(16 * 1024 - 16, maxSctpMsg - 64))
        : CHUNK_SIZE;
      const totalChunks = file.size === 0 ? 0 : Math.ceil(file.size / chunkSize);

      progress.mode = isDirectP2P ? 'direct_p2p' : 'relay';
      this.notifyProgress();
      playStartChime();

      // 1. Send Header - DUAL ANNOUNCEMENT for Guaranteed Receipt
      const headerMsg = {
        type: 'file-header',
        fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks,
      };

      // Announce over DataChannel if open for direct P2P path
      if (isDirectP2P) {
        try {
          this.dataChannel!.send(JSON.stringify(headerMsg));
        } catch (e) {
          console.warn('Failed to send file-header over DataChannel:', e);
        }
      }

      // Also announce over signaling relay-meta so receiver's UI is GUARANTEED to register and display the transfer immediately
      this.sendSignaling({
        type: 'relay-meta',
        targetPeerId,
        fileId,
        name: file.name,
        size: file.size,
        mimeType: file.type || 'application/octet-stream',
        totalChunks,
      });

      // Small 40ms pause so receiver initializes transfer state (and native disk file on Android) before binary streaming
      await new Promise((r) => setTimeout(r, 40));

      let offset = 0;
      let chunkIndex = 0;
      let bytesSent = 0;
      let lastProgressTime = Date.now();
      let lastBytesSent = 0;
      const fileIdHash = this.hashString(fileId);

      // Fast block-buffered streaming: reads 2 MB blocks to slash disk I/O latency without using RAM
      while (offset < file.size) {
        if (this.cancelledTransfers.has(fileId)) {
          break;
        }

        const blockEnd = Math.min(file.size, offset + READ_BLOCK_SIZE);
        const blockSlice = file.slice(offset, blockEnd);
        const blockBuffer = await blockSlice.arrayBuffer();
        const blockBytes = new Uint8Array(blockBuffer);

        let blockPos = 0;
        while (blockPos < blockBytes.byteLength) {
          if (this.cancelledTransfers.has(fileId)) {
            break;
          }

          const currentChunkLength = Math.min(chunkSize, blockBytes.byteLength - blockPos);
          const chunkPayload = blockBytes.subarray(blockPos, blockPos + currentChunkLength);

          // 12-byte header: [uint32 fileIdHash, uint32 chunkIndex, uint32 totalChunks]
          const packet = new Uint8Array(12 + chunkPayload.byteLength);
          const view = new DataView(packet.buffer);
          view.setUint32(0, fileIdHash);
          view.setUint32(4, chunkIndex);
          view.setUint32(8, totalChunks);
          packet.set(chunkPayload, 12);

          const canSendP2P = !!(this.dataChannel && this.dataChannel.readyState === 'open');

          if (canSendP2P) {
            // Strict backpressure loop: wait until buffer drains below threshold to prevent SCTP congestion
            while (
              this.dataChannel &&
              this.dataChannel.readyState === 'open' &&
              this.dataChannel.bufferedAmount > BUFFERED_THRESHOLD
            ) {
              if (this.cancelledTransfers.has(fileId)) break;
              await new Promise<void>((resolve) => {
                let timer: ReturnType<typeof setTimeout>;
                const onLow = () => {
                  clearTimeout(timer);
                  this.dataChannel?.removeEventListener('bufferedamountlow', onLow);
                  resolve();
                };
                timer = setTimeout(() => {
                  this.dataChannel?.removeEventListener('bufferedamountlow', onLow);
                  resolve();
                }, 30);
                this.dataChannel?.addEventListener('bufferedamountlow', onLow);
              });
            }

            // Resilient send loop with direct retry on DataChannel (never divert binary chunks to MQTT)
            let sent = false;
            let retryCount = 0;
            while (!sent && retryCount < 40) {
              if (this.cancelledTransfers.has(fileId)) break;
              try {
                if (this.dataChannel && this.dataChannel.readyState === 'open') {
                  this.dataChannel.send(packet.buffer);
                  sent = true;
                  this.lastPeerHeartbeat = Date.now();
                } else {
                  await new Promise((r) => setTimeout(r, 100));
                  retryCount++;
                }
              } catch {
                // Buffer momentarily saturated or backpressure: wait and retry directly on DataChannel
                retryCount++;
                await new Promise((r) => setTimeout(r, 35));
              }
            }

            if (!sent && !this.cancelledTransfers.has(fileId)) {
              throw new Error('DataChannel connection interrupted during transfer.');
            }

            // Yield every 64 chunks (~2MB) to keep UI responsive without throttling throughput
            if (chunkIndex % 64 === 0) {
              await new Promise((r) => setTimeout(r, 0));
            }
          } else if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            // Direct Raw Binary over WebSocket (Local network mode)
            while (this.ws && this.ws.bufferedAmount > 2 * 1024 * 1024) {
              await new Promise((r) => setTimeout(r, 10));
            }

            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
              throw new Error('WebSocket connection interrupted during transfer');
            }

            this.ws.send(packet.buffer);
            this.lastPeerHeartbeat = Date.now();
          } else if (this.cloudClient && file.size <= 5 * 1024 * 1024) {
            // Small file relay fallback via MQTT (< 5MB)
            const base64Data = uint8ArrayToBase64(chunkPayload);
            this.sendSignaling({
              type: 'relay-chunk',
              targetPeerId,
              fileId,
              chunkIndex,
              data: base64Data,
            });
            await new Promise((r) => setTimeout(r, 12));
          } else {
            throw new Error('P2P connection interrupted during transfer. Please retry.');
          }

          blockPos += currentChunkLength;
          offset += currentChunkLength;
          bytesSent += currentChunkLength;
          chunkIndex++;

          // Throttle UI updates to 150ms to keep CPU focused on network throughput
          const now = Date.now();
          if (now - lastProgressTime > 150 || offset >= file.size) {
            const timeDiff = (now - lastProgressTime) / 1000;
            let speed = 0;
            if (timeDiff > 0.05) {
              speed = (bytesSent - lastBytesSent) / timeDiff;
              lastProgressTime = now;
              lastBytesSent = bytesSent;
            }

            const percent = file.size > 0 ? Math.min(100, Math.round((bytesSent / file.size) * 100)) : 100;
            const remainingBytes = Math.max(0, file.size - bytesSent);
            const eta = speed > 0 ? remainingBytes / speed : 0;

            progress.transferredBytes = bytesSent;
            progress.progressPercent = percent;
            progress.speedBytesPerSec = Math.round(speed);
            progress.etaSeconds = eta;
            this.notifyProgress();
          }
        }
      }

      if (!this.cancelledTransfers.has(fileId)) {
        // Await buffer to fully drain before announcing completion to prevent premature 100% false completion
        while (
          !this.cancelledTransfers.has(fileId) &&
          ((isDirectP2P && this.dataChannel && this.dataChannel.bufferedAmount > 0) ||
           (!isDirectP2P && this.ws && this.ws.bufferedAmount > 0))
        ) {
          await new Promise((r) => setTimeout(r, 30));
        }

        if (this.cancelledTransfers.has(fileId)) return;

        // Send completion signal via both DataChannel and signaling relay
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          try {
            this.dataChannel.send(JSON.stringify({ type: 'file-complete', fileId }));
          } catch {}
        }
        this.sendSignaling({
          type: 'relay-complete',
          targetPeerId,
          fileId,
        });

        progress.status = 'completed';
        progress.progressPercent = 100;
        progress.transferredBytes = file.size;
        progress.speedBytesPerSec = 0;
        progress.etaSeconds = 0;
        this.notifyProgress();
        playSuccessChime();
      }
    } catch (err: any) {
      console.error('File send error:', err);
      if (progress) {
        progress.status = 'error';
        progress.error = err?.message || 'Transfer failed';
        progress.speedBytesPerSec = 0;
        this.notifyProgress();
      }
      this.onTransferError?.(file.name, err?.message || 'Transfer failed');
    } finally {
      this.updateKeepScreenOn();
    }
  }

  // --- Text Snippet / Clipboard Share ---
  public sendSnippet(text: string, targetPeerId?: string) {
    if (!text.trim()) return;
    const peerId = targetPeerId || (this.connectedPeers[0] ? this.connectedPeers[0].id : null);
    if (!peerId) {
      throw new Error('No device connected. Please pair your mobile or laptop first!');
    }

    const snippet: SharedSnippet = {
      id: 'snip_' + Date.now(),
      senderName: 'You (' + this.deviceName + ')',
      text,
      timestamp: Date.now(),
      direction: 'outgoing',
    };
    this.snippets = [snippet, ...this.snippets];
    this.onSnippetReceived?.(snippet);

    const isDirectP2P = this.dataChannel && this.dataChannel.readyState === 'open';
    if (isDirectP2P) {
      this.dataChannel!.send(
        JSON.stringify({
          type: 'text-snippet',
          text,
        })
      );
    } else {
      this.sendSignaling({
        type: 'relay-text',
        targetPeerId: peerId,
        text,
      });
    }
  }

  public ensurePeer(peerId: string, name?: string, deviceType?: 'mobile' | 'laptop') {
    if (!peerId || peerId === this.peerId) return;
    const existing = this.connectedPeers.find((p) => p.id === peerId);
    if (!existing) {
      const defaultName = name || (this.deviceType === 'mobile' ? 'Laptop' : 'Mobile');
      const defaultType = deviceType || (this.deviceType === 'mobile' ? 'laptop' : 'mobile');
      const newPeer: PeerDevice = {
        id: peerId,
        name: defaultName,
        deviceType: defaultType,
      };
      this.connectedPeers = [...this.connectedPeers, newPeer];
      this.onPeersChange?.(this.connectedPeers);
    } else {
      let updated = false;
      if (name && existing.name !== name && name !== 'Connected Device' && name !== 'Laptop' && name !== 'Mobile') {
        existing.name = name;
        updated = true;
      }
      if (deviceType && existing.deviceType !== deviceType) {
        existing.deviceType = deviceType;
        updated = true;
      }
      if (updated) {
        this.onPeersChange?.([...this.connectedPeers]);
      }
    }
  }

  private getPeerName(peerId: string): string {
    const peer = this.connectedPeers.find((p) => p.id === peerId);
    return peer ? peer.name : 'Connected Device';
  }

  // Hash helper for 4-byte identifier
  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 33) ^ str.charCodeAt(i);
    }
    return hash >>> 0;
  }
}
