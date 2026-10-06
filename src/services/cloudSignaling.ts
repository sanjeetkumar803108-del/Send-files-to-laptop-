import mqtt, { type MqttClient } from 'mqtt';

export interface CloudSignalingCallbacks {
  onOpen: () => void;
  onClose: () => void;
  onError: (err: any) => void;
  onMessage: (msg: any) => void;
  onBinaryChunk?: (buffer: ArrayBuffer) => void;
}

const PUBLIC_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

export class CloudSignalingClient {
  private client: MqttClient | null = null;
  private brokerIndex = 0;
  private isConnected = false;
  private isDestroyed = false;
  private pendingQueue: any[] = [];
  private announceTimer: any = null;

  public roomId: string;
  public peerId: string;
  public deviceName: string;
  public deviceType: string;

  private callbacks: CloudSignalingCallbacks;
  private knownPeers: Map<string, { id: string; name: string; deviceType: string }> = new Map();

  constructor(
    roomId: string,
    peerId: string,
    deviceName: string,
    deviceType: string,
    callbacks: CloudSignalingCallbacks
  ) {
    this.roomId = roomId;
    this.peerId = peerId;
    this.deviceName = deviceName;
    this.deviceType = deviceType;
    this.callbacks = callbacks;
  }

  private get currentBroker(): string {
    return PUBLIC_BROKERS[this.brokerIndex % PUBLIC_BROKERS.length];
  }

  private get broadcastTopic(): string {
    return `hsd/v1/${this.roomId}/b`;
  }

  private get privateTopic(): string {
    return `hsd/v1/${this.roomId}/p/${this.peerId}`;
  }

  public connect() {
    this.isDestroyed = false;
    this.initClient(this.currentBroker);
  }

  public reconnect() {
    if (this.isDestroyed) return;
    if (!this.isConnected || !this.client) {
      console.log('[CloudSignaling] Reconnecting to broker...');
      this.initClient(this.currentBroker);
    } else {
      this.announcePresence();
    }
  }

  private announcePresence() {
    this.publishBroadcast({
      type: 'join',
      roomId: this.roomId,
      peerId: this.peerId,
      name: this.deviceName,
      deviceType: this.deviceType,
    });
  }

  private startDiscoveryAnnouncement() {
    this.stopDiscoveryAnnouncement();
    this.announceTimer = setInterval(() => {
      // While we are waiting and have no known peers, keep announcing every 3 seconds so
      // newly arriving mobile or laptop pairs discover each other instantly
      if (this.isConnected && !this.isDestroyed && this.knownPeers.size === 0) {
        this.announcePresence();
      }
    }, 3000);
  }

  private stopDiscoveryAnnouncement() {
    if (this.announceTimer) {
      clearInterval(this.announceTimer);
      this.announceTimer = null;
    }
  }

  private initClient(brokerUrl: string) {
    if (this.client) {
      try { this.client.end(true); } catch {}
      this.client = null;
    }

    try {
      const client = mqtt.connect(brokerUrl, {
        clientId: `hsd_${this.peerId}_${Math.random().toString(36).substring(2, 7)}`,
        clean: true,
        connectTimeout: 8000,
        keepalive: 30,
        reconnectPeriod: 2500,
      });

      this.client = client;

      client.on('connect', () => {
        if (this.isDestroyed) return;
        this.isConnected = true;
        console.log('[CloudSignaling] Connected to relay broker:', brokerUrl);

        // Subscribe to room broadcast and peer's private inbox topic
        client.subscribe([this.broadcastTopic, this.privateTopic], { qos: 0 }, (err) => {
          if (err) {
            console.warn('[CloudSignaling] Subscription error:', err);
            return;
          }

          // Announce join to room immediately
          this.announcePresence();
          this.startDiscoveryAnnouncement();

          // Flush any pending queued signaling messages
          while (this.pendingQueue.length > 0) {
            const queued = this.pendingQueue.shift();
            if (queued) {
              this.send(queued);
            }
          }

          this.callbacks.onOpen();
        });
      });

      client.on('message', (_topic: string, payload: any) => {
        if (this.isDestroyed) return;
        try {
          // CRITICAL FIX: In browsers/WebViews, MQTT.js returns a Uint8Array.
          // Calling Uint8Array.prototype.toString('utf-8') does NOT decode UTF-8;
          // it returns comma-separated bytes (e.g. "123,34,97..."), breaking JSON.parse.
          // We use TextDecoder to guarantee correct UTF-8 string decoding across all devices!
          let str = '';
          if (typeof payload === 'string') {
            str = payload;
          } else if (payload instanceof Uint8Array || (typeof Buffer !== 'undefined' && Buffer.isBuffer(payload))) {
            str = new TextDecoder('utf-8').decode(payload);
          } else if (payload && payload.buffer instanceof ArrayBuffer) {
            str = new TextDecoder('utf-8').decode(new Uint8Array(payload.buffer));
          } else {
            str = String(payload);
          }

          const msg = JSON.parse(str);
          this.handleIncomingMessage(_topic, msg);
        } catch (e) {
          console.error('[CloudSignaling] Error parsing message on topic', _topic, e);
        }
      });

      client.on('close', () => {
        if (this.isConnected) {
          this.isConnected = false;
          console.warn('[CloudSignaling] Connection temporarily closed, will auto-reconnect');
          this.callbacks.onClose();
        }
      });

      client.on('error', (err) => {
        console.warn('[CloudSignaling] Connection error:', err);
        // If broker failed, try alternate broker on next reconnection attempt
        this.brokerIndex++;
        this.callbacks.onError(err);
      });
    } catch (err) {
      console.error('[CloudSignaling] Setup failed:', err);
      this.brokerIndex++;
      this.callbacks.onError(err);
    }
  }

  private handleIncomingMessage(_topic: string, msg: any) {
    if (!msg || typeof msg !== 'object') return;

    // Ignore messages originating from self
    if (msg.fromPeerId === this.peerId || msg.peerId === this.peerId) {
      return;
    }

    switch (msg.type) {
      case 'join': {
        const newPeer = {
          id: msg.peerId,
          name: msg.name || 'Device',
          deviceType: msg.deviceType || 'mobile',
        };

        this.knownPeers.set(newPeer.id, newPeer);

        // Reply to the new joiner with current peers list
        this.publishPrivate(newPeer.id, {
          type: 'joined',
          yourPeerId: newPeer.id,
          roomId: this.roomId,
          fromPeerId: this.peerId,
          peers: [
            {
              id: this.peerId,
              name: this.deviceName,
              deviceType: this.deviceType,
            },
          ],
        });

        // Emit peer-joined locally
        this.callbacks.onMessage({
          type: 'peer-joined',
          peer: newPeer,
        });
        break;
      }

      case 'joined': {
        const peers = msg.peers || [];
        peers.forEach((p: any) => {
          if (p.id !== this.peerId) {
            this.knownPeers.set(p.id, p);
          }
        });
        this.callbacks.onMessage(msg);
        break;
      }

      case 'check-room': {
        this.publishPrivate(msg.fromPeerId, {
          type: 'room-check-result',
          roomId: this.roomId,
          isValid: true,
          peerCount: 1,
        });
        break;
      }

      case 'peer-left': {
        this.knownPeers.delete(msg.peerId);
        this.callbacks.onMessage(msg);
        break;
      }

      case 'signal':
      case 'relay-meta':
      case 'relay-chunk':
      case 'relay-complete':
      case 'relay-cancel':
      case 'relay-text': {
        this.callbacks.onMessage(msg);
        break;
      }
    }
  }

  public send(msg: any) {
    if (!this.isConnected || !this.client) {
      this.pendingQueue.push(msg);
      return;
    }

    msg.fromPeerId = this.peerId;
    if (msg.targetPeerId) {
      this.publishPrivate(msg.targetPeerId, msg);
    } else {
      this.publishBroadcast(msg);
    }
  }

  public checkRoom(_targetRoomId: string): Promise<{ isValid: boolean; peerCount: number }> {
    return Promise.resolve({ isValid: true, peerCount: 1 });
  }

  private publishBroadcast(msg: any) {
    if (!this.client || !this.isConnected) return;
    try {
      this.client.publish(this.broadcastTopic, JSON.stringify(msg), { qos: 0 });
    } catch {}
  }

  private publishPrivate(targetPeerId: string, msg: any) {
    if (!this.client || !this.isConnected) return;
    try {
      const topic = `hsd/v1/${this.roomId}/p/${targetPeerId}`;
      this.client.publish(topic, JSON.stringify(msg), { qos: 0 });
    } catch {}
  }

  public disconnect() {
    this.isDestroyed = true;
    this.stopDiscoveryAnnouncement();
    this.pendingQueue = [];
    if (this.client && this.isConnected) {
      try {
        this.publishBroadcast({
          type: 'peer-left',
          peerId: this.peerId,
        });
        this.client.end(true);
      } catch {}
    }
    this.client = null;
    this.isConnected = false;
  }
}
