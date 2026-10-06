import mqtt, { type MqttClient } from 'mqtt';

export interface CloudSignalingCallbacks {
  onOpen: () => void;
  onClose: () => void;
  onError: (err: any) => void;
  onMessage: (msg: any) => void;
  onBinaryChunk?: (buffer: ArrayBuffer) => void;
}

const PRIMARY_BROKER = 'wss://broker.emqx.io:8084/mqtt';

export class CloudSignalingClient {
  private client: MqttClient | null = null;
  private currentBroker = PRIMARY_BROKER;
  private isConnected = false;
  private isDestroyed = false;
  private pendingQueue: any[] = [];

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
      // Re-announce join in room
      this.publishBroadcast({
        type: 'join',
        roomId: this.roomId,
        peerId: this.peerId,
        name: this.deviceName,
        deviceType: this.deviceType,
      });
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

        // Subscribe to room broadcast and peer's private topic
        client.subscribe([this.broadcastTopic, this.privateTopic], { qos: 1 }, (err) => {
          if (err) {
            console.warn('[CloudSignaling] Subscription error:', err);
            return;
          }

          // Announce join to room
          this.publishBroadcast({
            type: 'join',
            roomId: this.roomId,
            peerId: this.peerId,
            name: this.deviceName,
            deviceType: this.deviceType,
          });

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

      client.on('message', (topic: string, payload: Buffer) => {
        if (this.isDestroyed) return;
        try {
          const str = payload.toString('utf-8');
          const msg = JSON.parse(str);
          this.handleIncomingMessage(topic, msg);
        } catch (e) {
          console.error('[CloudSignaling] Error parsing message on topic', topic, e);
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
        this.callbacks.onError(err);
      });
    } catch (err) {
      console.error('[CloudSignaling] Setup failed:', err);
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
        // Reply that room is active
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
      // Queue message so it sends as soon as MQTT connection is ready
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
    // Instant non-blocking resolution
    return Promise.resolve({ isValid: true, peerCount: 1 });
  }

  private publishBroadcast(msg: any) {
    if (!this.client || !this.isConnected) return;
    try {
      this.client.publish(this.broadcastTopic, JSON.stringify(msg), { qos: 1 });
    } catch {}
  }

  private publishPrivate(targetPeerId: string, msg: any) {
    if (!this.client || !this.isConnected) return;
    try {
      const topic = `hsd/v1/${this.roomId}/p/${targetPeerId}`;
      this.client.publish(topic, JSON.stringify(msg), { qos: 1 });
    } catch {}
  }

  public disconnect() {
    this.isDestroyed = true;
    this.pendingQueue = [];
    if (this.client && this.isConnected) {
      try {
        // Announce leave before closing
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
