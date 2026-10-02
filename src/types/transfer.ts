export type DeviceType = 'mobile' | 'laptop' | 'tablet' | 'desktop';

export interface PeerDevice {
  id: string;
  name: string;
  deviceType: DeviceType;
  joinedAt?: number;
}

export type ConnectionMode = 'direct_p2p' | 'relay' | 'connecting' | 'disconnected';

export interface TransferFile {
  id: string;
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  blob?: Blob;
  url?: string;
  timestamp: number;
}

export interface TransferProgress {
  fileId: string;
  name: string;
  size: number;
  type: string;
  transferredBytes: number;
  progressPercent: number; // 0 to 100
  speedBytesPerSec: number;
  etaSeconds: number;
  status: 'queued' | 'transferring' | 'completed' | 'cancelled' | 'error';
  direction: 'outgoing' | 'incoming';
  mode: ConnectionMode;
  peerName: string;
  error?: string;
  blob?: Blob;
  downloadUrl?: string;
  timestamp: number;
}

export interface SharedSnippet {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
}
