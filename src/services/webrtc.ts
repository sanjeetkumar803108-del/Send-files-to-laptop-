import { PeerDevice, ConnectionMode, TransferProgress, SharedSnippet } from '../types/transfer';
import { playStartChime, playSuccessChime } from '../utils/audio';

const CHUNK_SIZE = 64 * 1024; // 64 KB standard chunk
const BUFFERED_THRESHOLD = 2 * 1024 * 1024; // 2 MB buffer backpressure limit
const LOW_BUFFER_THRESHOLD = 256 * 1024; // 256 KB threshold to resume sending

export type ConnectionCallback = (mode: ConnectionMode) => void;
export type PeersCallback = (peers: PeerDevice[]) => void;
export type ProgressCallback = (items: TransferProgress[]) => void;
export type SnippetCallback = (snippet: SharedSnippet) => void;

interface ActiveReceivingFile {
  fileId: string;
  fileIdHash: number;
  name: string;
  size: number;
  mimeType: string;
  totalChunks: number;
  chunks: (Uint8Array | null)[];
  receivedBytes: number;
  receivedChunks: number;
  startTime: number;
  lastProgressUpdate: number;
  lastBytesCount: number;
  speed: number;
  senderName: string;
}

export class TransferEngine {
  private ws: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  
  public roomId: string;
  public peerId: string;
  public deviceName: string;
  public deviceType: 'mobile' | 'laptop';

  public connectionMode: ConnectionMode = 'connecting';
  public connectedPeers: PeerDevice[] = [];
  public transfers: Map<string, TransferProgress> = new Map();
  public snippets: SharedSnippet[] = [];

  private activeReceiving: Map<string, ActiveReceivingFile> = new Map();
  private sendQueue: { file: File; targetPeerId: string }[] = [];
  private isSending = false;
  private cancelledTransfers = new Set<string>();

  // Callbacks
  private onConnectionChange?: ConnectionCallback;
  private onPeersChange?: PeersCallback;
  private onProgressChange?: ProgressCallback;
  private onSnippetReceived?: SnippetCallback;

  // WebRTC negotiation state
  private isInitiator = false;
  private isMakingOffer = false;
  private isSettingRemoteAnswerPending = false;
  private p2pTimeoutTimer: NodeJS.Timeout | null = null;
  private autoDownloadEnabled = true;

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

  public setCallbacks(
    onConnectionChange: ConnectionCallback,
    onPeersChange: PeersCallback,
    onProgressChange: ProgressCallback,
    onSnippetReceived: SnippetCallback
  ) {
    this.onConnectionChange = onConnectionChange;
    this.onPeersChange = onPeersChange;
    this.onProgressChange = onProgressChange;
    this.onSnippetReceived = onSnippetReceived;
  }

  public setAutoDownload(enabled: boolean) {
    this.autoDownloadEnabled = enabled;
  }

  public checkRoom(targetRoomId: string): Promise<{ isValid: boolean; peerCount: number }> {
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
        resolve({ isValid: false, peerCount: 0 });
      }, 2500);
    });
  }

  public start() {
    this.connectSignaling();
  }

  public stop() {
    if (this.p2pTimeoutTimer) clearTimeout(this.p2pTimeoutTimer);
    if (this.dataChannel) {
      try { this.dataChannel.close(); } catch {}
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }
    if (this.ws) {
      try { this.ws.close(); } catch {}
      this.ws = null;
    }
    this.setMode('disconnected');
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

  // --- WebSocket Signaling Server Connection ---
  private connectSignaling() {
    try {
      const isHttps = window.location.protocol === 'https:';
      const wsProtocol = isHttps ? 'wss:' : 'ws:';
      const customWs = (import.meta.env.VITE_SIGNALING_URL as string | undefined)?.trim();
      const wsUrl = customWs || `${wsProtocol}//${window.location.host}/ws`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Register peer to room
        this.ws?.send(
          JSON.stringify({
            type: 'join',
            roomId: this.roomId,
            peerId: this.peerId,
            name: this.deviceName,
            deviceType: this.deviceType,
          })
        );
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleSignalingMessage(msg);
        } catch (err) {
          console.error('Error parsing signaling message:', err);
        }
      };

      this.ws.onclose = () => {
        if (this.connectionMode !== 'direct_p2p') {
          this.setMode('disconnected');
        }
        // Attempt reconnection after 3 seconds
        setTimeout(() => {
          if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
            this.connectSignaling();
          }
        }, 3000);
      };

      this.ws.onerror = (err) => {
        console.warn('Signaling socket error:', err);
      };
    } catch (e) {
      console.error('Failed to connect to signaling socket:', e);
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
          // A peer is already here; we initiate WebRTC connection
          this.setMode('connecting');
          this.initiatePeerConnection(peers[0].id, true);
        } else {
          this.setMode('connecting');
        }
        break;
      }

      case 'peer-joined': {
        const newPeer: PeerDevice = msg.peer;
        // Check if not already added
        if (!this.connectedPeers.some((p) => p.id === newPeer.id)) {
          this.connectedPeers = [...this.connectedPeers, newPeer];
          this.onPeersChange?.(this.connectedPeers);
        }
        // Prepare receiver side for incoming peer connection
        this.initiatePeerConnection(newPeer.id, false);
        break;
      }

      case 'peer-left': {
        this.connectedPeers = this.connectedPeers.filter((p) => p.id !== msg.peerId);
        this.onPeersChange?.(this.connectedPeers);
        if (this.connectedPeers.length === 0) {
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
        this.handleIncomingFileHeader(msg.fileId, msg.name, msg.size, msg.mimeType, msg.totalChunks, msg.fromPeerId || 'Unknown');
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
    this.isInitiator = asInitiator;

    if (this.peerConnection) {
      try { this.peerConnection.close(); } catch {}
      this.peerConnection = null;
    }

    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 4,
    };

    const pc = new RTCPeerConnection(config);
    this.peerConnection = pc;

    // Timeout safety: if P2P isn't ready in 5 seconds, fallback to relay
    if (this.p2pTimeoutTimer) clearTimeout(this.p2pTimeoutTimer);
    this.p2pTimeoutTimer = setTimeout(() => {
      if (this.connectionMode !== 'direct_p2p' && this.connectedPeers.length > 0) {
        console.log('WebRTC P2P timeout - seamlessly switching to Relay Mode');
        this.setMode('relay');
      }
    }, 5000);

    pc.onicecandidate = (event) => {
      if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: 'signal',
            targetPeerId,
            signal: { candidate: event.candidate },
          })
        );
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        if (this.p2pTimeoutTimer) clearTimeout(this.p2pTimeoutTimer);
        this.setMode('direct_p2p');
      } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        // Fallback to relay
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

      pc.onnegotiationneeded = async () => {
        try {
          this.isMakingOffer = true;
          const offer = await pc.createOffer();
          if (pc.signalingState !== 'stable') return;
          await pc.setLocalDescription(offer);
          this.ws?.send(
            JSON.stringify({
              type: 'signal',
              targetPeerId,
              signal: { description: pc.localDescription },
            })
          );
        } catch (err) {
          console.error('Error creating offer:', err);
        } finally {
          this.isMakingOffer = false;
        }
      };
    } else {
      // Receiver sets up channel when received
      pc.ondatachannel = (event) => {
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
      this.setMode('direct_p2p');
      console.log('Direct P2P DataChannel opened successfully');
    };

    channel.onclose = () => {
      if (this.connectedPeers.length > 0) {
        this.setMode('relay');
      }
    };

    channel.onerror = (err) => {
      console.warn('DataChannel error:', err);
      if (this.connectedPeers.length > 0) {
        this.setMode('relay');
      }
    };

    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          this.handleChannelControlMessage(msg, targetPeerId);
        } catch (e) {
          console.error('DataChannel JSON parse error:', e);
        }
      } else if (event.data instanceof ArrayBuffer) {
        this.handleIncomingBinaryChunk(event.data);
      }
    };
  }

  private async handlePeerSignal(fromPeerId: string, signal: any) {
    if (!this.peerConnection) return;
    const pc = this.peerConnection;

    try {
      if (signal.description) {
        const description = signal.description;
        const offerCollision =
          description.type === 'offer' &&
          (this.isMakingOffer || pc.signalingState !== 'stable');

        const ignoreOffer = !this.isInitiator && offerCollision;
        if (ignoreOffer) return;

        this.isSettingRemoteAnswerPending = description.type === 'answer';
        await pc.setRemoteDescription(description);
        this.isSettingRemoteAnswerPending = false;

        if (description.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.ws?.send(
            JSON.stringify({
              type: 'signal',
              targetPeerId: fromPeerId,
              signal: { description: pc.localDescription },
            })
          );
        }
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch (err) {
          if (!this.isSettingRemoteAnswerPending) {
            console.warn('Error adding ice candidate:', err);
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

  // --- File Reception Logic ---
  private handleIncomingFileHeader(
    fileId: string,
    name: string,
    size: number,
    mimeType: string,
    totalChunks: number,
    senderName: string
  ) {
    playStartChime();

    const activeFile: ActiveReceivingFile = {
      fileId,
      fileIdHash: this.hashString(fileId),
      name,
      size,
      mimeType: mimeType || 'application/octet-stream',
      totalChunks,
      chunks: new Array(totalChunks).fill(null),
      receivedBytes: 0,
      receivedChunks: 0,
      startTime: Date.now(),
      lastProgressUpdate: Date.now(),
      lastBytesCount: 0,
      speed: 0,
      senderName,
    };

    this.activeReceiving.set(fileId, activeFile);

    const progress: TransferProgress = {
      fileId,
      name,
      size,
      type: mimeType,
      transferredBytes: 0,
      progressPercent: 0,
      speedBytesPerSec: 0,
      etaSeconds: 0,
      status: 'transferring',
      direction: 'incoming',
      mode: this.connectionMode,
      peerName: senderName,
      timestamp: Date.now(),
    };

    this.transfers.set(fileId, progress);
    this.notifyProgress();
  }

  // Direct Binary Chunk Receiver (WebRTC P2P)
  // Header: 12 bytes = [uint32 fileIdHash, uint32 chunkIndex, uint32 totalChunks]
  private handleIncomingBinaryChunk(buffer: ArrayBuffer) {
    if (buffer.byteLength < 12) return;
    const view = new DataView(buffer);
    const fileIdHash = view.getUint32(0);
    const chunkIndex = view.getUint32(4);
    const payload = new Uint8Array(buffer, 12);

    // Fast lookup by pre-computed fileIdHash
    let targetFile: ActiveReceivingFile | undefined;
    for (const file of this.activeReceiving.values()) {
      if (file.fileIdHash === fileIdHash) {
        targetFile = file;
        break;
      }
    }

    if (!targetFile) return;
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
    if (targetFile.chunks[chunkIndex] === null) {
      targetFile.chunks[chunkIndex] = payload;
      targetFile.receivedBytes += payload.byteLength;
      targetFile.receivedChunks += 1;
    }

    const now = Date.now();
    // Update progress throttled to 100ms or on completion
    if (now - targetFile.lastProgressUpdate > 100 || targetFile.receivedChunks === targetFile.totalChunks) {
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

      const progress = this.transfers.get(targetFile.fileId);
      if (progress) {
        progress.transferredBytes = targetFile.receivedBytes;
        progress.progressPercent = percent;
        progress.speedBytesPerSec = Math.round(targetFile.speed);
        progress.etaSeconds = eta;
        this.notifyProgress();
      }
    }

    if (targetFile.receivedChunks === targetFile.totalChunks) {
      this.handleIncomingFileComplete(targetFile.fileId);
    }
  }

  private handleIncomingFileComplete(fileId: string) {
    const active = this.activeReceiving.get(fileId);
    if (!active) return;

    // Direct Blob creation from chunks without duplicate array allocation
    const chunks = active.chunks;
    active.chunks = []; // Release reference so garbage collector can free chunks memory once Blob takes ownership
    const blob = new Blob(chunks as unknown as BlobPart[], { type: active.mimeType });
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
    playSuccessChime();

    // Trigger auto-download if enabled
    if (this.autoDownloadEnabled) {
      this.triggerDownload(downloadUrl, active.name);
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
    const progress = this.transfers.get(fileId);
    if (progress && progress.status === 'transferring') {
      progress.status = 'cancelled';
      progress.speedBytesPerSec = 0;
      this.notifyProgress();

      // Notify peer
      if (this.dataChannel && this.dataChannel.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({ type: 'file-cancel', fileId }));
      } else if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connectedPeers.length > 0) {
        this.ws.send(JSON.stringify({
          type: 'relay-cancel',
          targetPeerId: this.connectedPeers[0].id,
          fileId,
        }));
      }
    }
    this.activeReceiving.delete(fileId);
  }

  private cancelIncomingTransfer(fileId: string) {
    this.activeReceiving.delete(fileId);
    const progress = this.transfers.get(fileId);
    if (progress) {
      progress.status = 'cancelled';
      progress.speedBytesPerSec = 0;
      this.notifyProgress();
    }
  }

  // --- Sending Files ---
  public queueFiles(files: FileList | File[], targetPeerId?: string) {
    const peerId = targetPeerId || (this.connectedPeers[0] ? this.connectedPeers[0].id : null);
    if (!peerId) {
      throw new Error('No device connected yet. Please pair your mobile or laptop first!');
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      this.sendQueue.push({ file, targetPeerId: peerId });
    }

    this.processSendQueue();
  }

  private async processSendQueue() {
    if (this.isSending || this.sendQueue.length === 0) return;
    this.isSending = true;

    while (this.sendQueue.length > 0) {
      const item = this.sendQueue.shift();
      if (!item) break;
      await this.sendFile(item.file, item.targetPeerId);
    }

    this.isSending = false;
  }

  private async sendFile(file: File, targetPeerId: string) {
    const fileId = 'file_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const peerName = this.getPeerName(targetPeerId);

    const progress: TransferProgress = {
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
    this.notifyProgress();
    playStartChime();

    const isDirectP2P = this.dataChannel && this.dataChannel.readyState === 'open';

    // 1. Send Header
    const headerMsg = {
      type: 'file-header',
      fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks,
    };

    if (isDirectP2P) {
      this.dataChannel!.send(JSON.stringify(headerMsg));
    } else {
      this.ws?.send(
        JSON.stringify({
          type: 'relay-meta',
          targetPeerId,
          fileId,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          totalChunks,
        })
      );
    }

    let offset = 0;
    let chunkIndex = 0;
    let bytesSent = 0;
    let lastProgressTime = Date.now();
    let lastBytesSent = 0;
    const fileIdHash = this.hashString(fileId);

    while (offset < file.size) {
      if (this.cancelledTransfers.has(fileId)) {
        break;
      }

      // Read chunk
      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const chunkBuffer = await slice.arrayBuffer();

      if (isDirectP2P) {
        // Backpressure flow control for WebRTC: pause if buffer is full with safety timeout
        if (this.dataChannel!.bufferedAmount > BUFFERED_THRESHOLD) {
          await new Promise<void>((resolve) => {
            if (!this.dataChannel || this.dataChannel.readyState !== 'open') return resolve();
            let timeoutId: any;
            const onLow = () => {
              clearTimeout(timeoutId);
              this.dataChannel?.removeEventListener('bufferedamountlow', onLow);
              resolve();
            };
            timeoutId = setTimeout(() => {
              this.dataChannel?.removeEventListener('bufferedamountlow', onLow);
              resolve();
            }, 600);
            this.dataChannel.addEventListener('bufferedamountlow', onLow);
          });
        }

        // Pack 12-byte header + binary chunk payload
        const packet = new Uint8Array(12 + chunkBuffer.byteLength);
        const view = new DataView(packet.buffer);
        view.setUint32(0, fileIdHash);
        view.setUint32(4, chunkIndex);
        view.setUint32(8, totalChunks);
        packet.set(new Uint8Array(chunkBuffer), 12);

        this.dataChannel!.send(packet.buffer);
      } else {
        // Fast batch binary to base64 conversion
        const bytes = new Uint8Array(chunkBuffer);
        let binary = '';
        const batchSize = 8192;
        for (let i = 0; i < bytes.byteLength; i += batchSize) {
          binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + batchSize)));
        }
        const base64 = btoa(binary);

        // Flow control for WebSocket relay
        if (this.ws && this.ws.bufferedAmount > 1024 * 1024) {
          await new Promise((r) => setTimeout(r, 20));
        }

        this.ws?.send(
          JSON.stringify({
            type: 'relay-chunk',
            targetPeerId,
            fileId,
            chunkIndex,
            totalChunks,
            data: base64,
          })
        );

        if (chunkIndex % 8 === 0) {
          await new Promise((r) => setTimeout(r, 4));
        }
      }

      offset += chunkBuffer.byteLength;
      bytesSent += chunkBuffer.byteLength;
      chunkIndex++;

      // Update progress metrics
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

    if (!this.cancelledTransfers.has(fileId)) {
      // Send completion signal
      if (isDirectP2P) {
        this.dataChannel!.send(JSON.stringify({ type: 'file-complete', fileId }));
      } else {
        this.ws?.send(
          JSON.stringify({
            type: 'relay-complete',
            targetPeerId,
            fileId,
          })
        );
      }

      progress.status = 'completed';
      progress.progressPercent = 100;
      progress.speedBytesPerSec = 0;
      progress.etaSeconds = 0;
      this.notifyProgress();
      playSuccessChime();
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
      this.ws?.send(
        JSON.stringify({
          type: 'relay-text',
          targetPeerId: peerId,
          text,
        })
      );
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
