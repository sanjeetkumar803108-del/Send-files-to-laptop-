import { PeerDevice, ConnectionMode, TransferProgress, SharedSnippet } from '../types/transfer';
import { playStartChime, playSuccessChime } from '../utils/audio';
import { resolveSignalingUrl, isNativePlatform } from '../utils/format';
import { CloudSignalingClient } from './cloudSignaling';

const CHUNK_SIZE = 32 * 1024 - 16; // 32 KB chunk: completely safe across all Android WebViews, iOS, and PC without SCTP overflow
const READ_BLOCK_SIZE = 2 * 1024 * 1024; // 2 MB fast disk read block
const BUFFERED_THRESHOLD = 2 * 1024 * 1024; // 2 MB buffer limit for high throughput without SCTP congestion
const LOW_BUFFER_THRESHOLD = 512 * 1024; // 512 KB resume threshold
const SEGMENT_FLUSH_BYTES = 8 * 1024 * 1024; // 8 MB: Flush every 8MB into a Blob to keep JS Heap < 16MB regardless of file size

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
  // Segmented Blob Streaming - eliminates Out Of Memory crashes on large files (100MB - 10GB+)
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
  private isSettingRemoteAnswerPending = false;
  private p2pTimeoutTimer: NodeJS.Timeout | null = null;
  private autoDownloadEnabled = true;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private lastPeerHeartbeat = Date.now();
  private reconnectTimer: NodeJS.Timeout | null = null;

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
    this.earlyChunksBuffer.clear();
    this.onPeersChange?.([]);
    this.setMode('disconnected');
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
          this.dataChannel.send(JSON.stringify({ type: 'hb-ping' }));
        } catch {}
      } else if (this.connectedPeers.length > 0) {
        this.sendSignaling({
          type: 'relay-text',
          targetPeerId: this.connectedPeers[0].id,
          text: '__HB__',
          isHeartbeat: true,
        });
      }

      // If peer stopped responding for more than 16 seconds, clear stale connection
      if (now - this.lastPeerHeartbeat > 16000) {
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
        this.connectedPeers = peers;
        this.onPeersChange?.(peers);

        if (peers.length > 0) {
          this.lastPeerHeartbeat = Date.now();
          const targetId = peers[0].id;
          // Only start handshake if DataChannel is not open and peer connection is not active
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
        // Check if not already added
        if (!this.connectedPeers.some((p) => p.id === newPeer.id)) {
          this.connectedPeers = [...this.connectedPeers, newPeer];
          this.onPeersChange?.(this.connectedPeers);
        }
        // Only start handshake if DataChannel is not open and peer connection is not active
        const isChannelOpen = this.dataChannel && this.dataChannel.readyState === 'open';
        const isPcActive =
          this.peerConnection &&
          (this.peerConnection.connectionState === 'connecting' ||
            this.peerConnection.connectionState === 'connected');
        if (!isChannelOpen && !isPcActive) {
          this.setMode('connecting');
          const asInitiator = this.peerId > newPeer.id;
          this.initiatePeerConnection(newPeer.id, asInitiator);
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
        this.handlePeerSignal(msg.fromPeerId, msg.signal);
        break;
      }

      // --- Fallback Relay Message Handlers ---
      case 'relay-meta': {
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
  private initiatePeerConnection(targetPeerId: string, asInitiator: boolean) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      console.log('[WebRTC] DataChannel already open, skipping re-negotiation');
      return;
    }

    if (
      this.peerConnection &&
      (this.peerConnection.connectionState === 'connected' || this.peerConnection.iceConnectionState === 'connected')
    ) {
      console.log('[WebRTC] PeerConnection already connected, skipping re-negotiation');
      return;
    }

    this.isInitiator = asInitiator;
    this.pendingCandidates = [];

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
            'turn:openrelay.metered.ca:80',
            'turn:openrelay.metered.ca:443',
            'turn:openrelay.metered.ca:443?transport=tcp',
          ],
          username: 'openrelay',
          credential: 'openrelay',
        },
      ],
      bundlePolicy: 'max-bundle',
      iceCandidatePoolSize: 10,
    };

    const pc = new RTCPeerConnection(config);
    this.peerConnection = pc;

    // Timeout safety: if P2P isn't ready in 12 seconds, fallback to relay
    if (this.p2pTimeoutTimer) clearTimeout(this.p2pTimeoutTimer);
    this.p2pTimeoutTimer = setTimeout(() => {
      if (this.connectionMode !== 'direct_p2p' && this.connectedPeers.length > 0) {
        console.log('WebRTC P2P timeout - seamlessly switching to Relay Mode');
        this.setMode('relay');
      }
    }, 12000);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignaling({
          type: 'signal',
          targetPeerId,
          signal: { candidate: event.candidate },
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE Connection State:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (this.p2pTimeoutTimer) clearTimeout(this.p2pTimeoutTimer);
        this.cloudClient?.stopDiscoveryAnnouncement();
        this.setMode('direct_p2p');
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        this.cloudClient?.startDiscoveryAnnouncement();
        if (this.connectedPeers.length > 0 && this.connectionMode !== 'direct_p2p') {
          this.setMode('relay');
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Peer Connection State:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        if (this.p2pTimeoutTimer) clearTimeout(this.p2pTimeoutTimer);
        this.cloudClient?.stopDiscoveryAnnouncement();
        this.setMode('direct_p2p');
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.cloudClient?.startDiscoveryAnnouncement();
        if (this.connectedPeers.length > 0 && this.connectionMode !== 'direct_p2p') {
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
        if (this.isMakingOffer || pc.signalingState !== 'stable') return;
        try {
          this.isMakingOffer = true;
          const offer = await pc.createOffer();
          if (pc.signalingState !== 'stable') return;
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
      setTimeout(makeOffer, 80);
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
      this.cloudClient?.stopDiscoveryAnnouncement();
      this.setMode('direct_p2p');
      console.log('⚡ Direct P2P DataChannel opened successfully');
    };

    channel.onclose = () => {
      this.cloudClient?.startDiscoveryAnnouncement();
      if (this.connectedPeers.length > 0) {
        this.setMode('relay');
      }
    };

    channel.onerror = (err) => {
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
    if (!this.peerConnection) return;
    const pc = this.peerConnection;

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

        this.isSettingRemoteAnswerPending = description.type === 'answer';
        await pc.setRemoteDescription(description);
        this.isSettingRemoteAnswerPending = false;

        // Flush any buffered ICE candidates that arrived before remote description was ready
        while (this.pendingCandidates.length > 0) {
          const cand = this.pendingCandidates.shift();
          if (cand) {
            try {
              await pc.addIceCandidate(cand);
            } catch (err) {
              console.warn('Error applying buffered candidate:', err);
            }
          }
        }

        if (description.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.sendSignaling({
            type: 'signal',
            targetPeerId: fromPeerId,
            signal: { description: pc.localDescription },
          });
        }
      } else if (signal.candidate) {
        if (!pc.remoteDescription || this.isSettingRemoteAnswerPending || pc.signalingState !== 'stable') {
          this.pendingCandidates.push(signal.candidate);
        } else {
          try {
            await pc.addIceCandidate(signal.candidate);
          } catch (err) {
            if (!this.isSettingRemoteAnswerPending) {
              console.warn('Error adding ice candidate, buffering for retry:', err);
              this.pendingCandidates.push(signal.candidate);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error handling peer signal:', err);
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
      case 'header-ack':
      case 'transfer-ack':
        this.lastPeerHeartbeat = Date.now();
        break;
      case 'hb-ping':
        try {
          this.dataChannel?.send(JSON.stringify({ type: 'hb-pong' }));
          this.lastPeerHeartbeat = Date.now();
        } catch {}
        break;
      case 'hb-pong':
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

  // --- File Reception Logic (Segmented Blob Streaming for High Speed & Low RAM) ---
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

    const activeFile: ActiveReceivingFile = {
      fileId,
      fileIdHash: this.hashString(fileId),
      name,
      size,
      mimeType: mimeType || 'application/octet-stream',
      totalChunks,
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

      // Sequential flush of contiguous chunks into blob segments to free JS Heap memory
      while (targetFile.pendingChunks.has(targetFile.nextFlushedIndex)) {
        const chunk = targetFile.pendingChunks.get(targetFile.nextFlushedIndex)!;
        targetFile.pendingChunks.delete(targetFile.nextFlushedIndex);
        targetFile.currentSegmentChunks.push(chunk);
        targetFile.currentSegmentBytes += chunk.byteLength;
        targetFile.nextFlushedIndex++;

        // Flush into a Blob segment once segment reaches SEGMENT_FLUSH_BYTES (8 MB)
        if (targetFile.currentSegmentBytes >= SEGMENT_FLUSH_BYTES) {
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

    // Flush any remaining chunks in the active segment
    if (active.currentSegmentChunks.length > 0) {
      const remainingBlob = new Blob(active.currentSegmentChunks as unknown as BlobPart[], {
        type: 'application/octet-stream',
      });
      active.blobSegments.push(remainingBlob);
      active.currentSegmentChunks = [];
      active.currentSegmentBytes = 0;
    }

    // If there were any out-of-order chunks still in pendingChunks, sort and flush them
    if (active.pendingChunks.size > 0) {
      const remainingIndices = Array.from(active.pendingChunks.keys()).sort((a, b) => a - b);
      const stragglers: Uint8Array[] = [];
      for (const idx of remainingIndices) {
        stragglers.push(active.pendingChunks.get(idx)!);
      }
      active.blobSegments.push(new Blob(stragglers as unknown as BlobPart[], { type: 'application/octet-stream' }));
      active.pendingChunks.clear();
    }

    // Direct Blob creation from lightweight segments (uses negligible heap memory)
    const blob = new Blob(active.blobSegments as unknown as BlobPart[], { type: active.mimeType });
    active.blobSegments = []; // Release segment references
    const downloadUrl = URL.createObjectURL(blob);

    const progress = this.transfers.get(fileId);
    if (progress) {
      progress.status = 'completed';
      progress.progressPercent = 100;
      progress.transferredBytes = active.size;
      progress.speedBytesPerSec = 0;
      progress.etaSeconds = 0;
      progress.blob = blob;
      progress.downloadUrl = downloadUrl;
      this.notifyProgress();
    }

    this.activeReceiving.delete(fileId);
    if (active.fileIdHash) {
      this.activeReceivingByHash.delete(active.fileIdHash);
      this.earlyChunksBuffer.delete(active.fileIdHash);
    }
    playSuccessChime();

    // Trigger auto-download if enabled
    if (this.autoDownloadEnabled) {
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
    if (active?.fileIdHash) {
      this.activeReceivingByHash.delete(active.fileIdHash);
    }
    this.activeReceiving.delete(fileId);
  }

  private cancelIncomingTransfer(fileId: string) {
    const active = this.activeReceiving.get(fileId);
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
    let isDirectP2P = !!(this.dataChannel && this.dataChannel.readyState === 'open');
    const isLocalWs = !!(this.ws && this.ws.readyState === WebSocket.OPEN);

    // If P2P DataChannel is not open yet, wait up to 10 seconds for WebRTC handshake to complete
    if (!isDirectP2P && !isLocalWs) {
      console.log('[WebRTC] Waiting for DataChannel to be ready before starting transfer...');
      let waitCount = 0;
      while ((!this.dataChannel || this.dataChannel.readyState !== 'open') && waitCount < 40) {
        if (this.cancelledTransfers.has(fileId)) return;
        await new Promise((r) => setTimeout(r, 250));
        waitCount++;
      }
      isDirectP2P = !!(this.dataChannel && this.dataChannel.readyState === 'open');
    }

    // Large files (> 5MB) cannot be transferred over public MQTT brokers without broker rate-limit termination
    if (!isDirectP2P && !isLocalWs && file.size > 5 * 1024 * 1024) {
      throw new Error(
        'Direct P2P DataChannel connect nahi hua. Kripya dono devices ko same Wi-Fi / Hotspot pe connect karein aur dobara try karein.'
      );
    }

    const chunkSize = CHUNK_SIZE; // 32 KB safe chunks
    const totalChunks = Math.ceil(file.size / chunkSize);

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
        mode: isDirectP2P ? 'direct_p2p' : 'relay',
        peerName,
        timestamp: Date.now(),
      };
      this.transfers.set(fileId, progress);
    } else {
      progress.status = 'transferring';
      progress.mode = isDirectP2P ? 'direct_p2p' : 'relay';
    }

    this.notifyProgress();
    playStartChime();

    try {
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

      // Small 35ms pause so receiver initializes transfer state and UI renders before binary streaming
      await new Promise((r) => setTimeout(r, 35));

      let offset = 0;
      let chunkIndex = 0;
      let bytesSent = 0;
      let lastProgressTime = Date.now();
      let lastBytesSent = 0;
      const fileIdHash = this.hashString(fileId);

      // Fast block-buffered streaming: reads 2 MB blocks to slash disk I/O latency
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
                let timer: any;
                const onLow = () => {
                  clearTimeout(timer);
                  this.dataChannel?.removeEventListener('bufferedamountlow', onLow);
                  resolve();
                };
                timer = setTimeout(() => {
                  this.dataChannel?.removeEventListener('bufferedamountlow', onLow);
                  resolve();
                }, 35);
                this.dataChannel?.addEventListener('bufferedamountlow', onLow);
              });
            }

            // Resilient send loop with direct retry on DataChannel (never divert binary chunks to MQTT)
            let sent = false;
            let retryCount = 0;
            while (!sent && retryCount < 30) {
              if (this.cancelledTransfers.has(fileId)) break;
              try {
                if (this.dataChannel && this.dataChannel.readyState === 'open') {
                  this.dataChannel.send(packet.buffer);
                  sent = true;
                  this.lastPeerHeartbeat = Date.now();
                } else {
                  await new Promise((r) => setTimeout(r, 80));
                  retryCount++;
                }
              } catch (sendErr) {
                // Buffer momentarily saturated or backpressure: wait and retry directly on DataChannel
                retryCount++;
                await new Promise((r) => setTimeout(r, 30));
              }
            }

            if (!sent && !this.cancelledTransfers.has(fileId)) {
              throw new Error('DataChannel connection interrupted during transfer.');
            }

            // Yield every 16 chunks (~512KB) to keep UI and network loop responsive
            if (chunkIndex % 16 === 0) {
              await new Promise((r) => setTimeout(r, 2));
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
          } else if (this.cloudClient) {
            // Small file relay fallback via MQTT (< 5MB)
            let binary = '';
            const len = chunkPayload.byteLength;
            for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(chunkPayload[i]);
            }
            const base64Data = btoa(binary);
            this.sendSignaling({
              type: 'relay-chunk',
              targetPeerId,
              fileId,
              chunkIndex,
              data: base64Data,
            });
            await new Promise((r) => setTimeout(r, 12));
          } else {
            throw new Error('Connection establish hone ka intezaar karein.');
          }

          blockPos += currentChunkLength;
          offset += currentChunkLength;
          bytesSent += currentChunkLength;
          chunkIndex++;

          // Throttle UI updates to 150ms to keep 100% CPU focused on network throughput
          const now = Date.now();
          if (now - lastProgressTime > 150 || offset >= file.size) {
            const timeDiff = (now - lastProgressTime) / 1000;
            let speed = 0;
            if (timeDiff > 0.05) {
              speed = (bytesSent - lastBytesSent) / timeDiff;
              lastProgressTime = now;
              lastBytesSent = bytesSent;
            }

            const percent = Math.min(100, Math.round((bytesSent / file.size) * 100));
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
        progress.speedBytesPerSec = 0;
        progress.etaSeconds = 0;
        this.notifyProgress();
        playSuccessChime();
      }
    } catch (err: any) {
      console.error('File send error:', err);
      if (progress) {
        progress.status = 'error';
        progress.speedBytesPerSec = 0;
        this.notifyProgress();
      }
      this.onTransferError?.(file.name, err.message || 'Transfer failed');
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
