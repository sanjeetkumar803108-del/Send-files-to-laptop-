import mqtt, { type MqttClient } from 'mqtt';

export interface CloudSignalingCallbacks {
  onOpen: () => void;
  onClose: () => void;
  onError: (err: any) => void;
  onMessage: (msg: any) => void;
  onBinaryChunk?: (buffer: ArrayBuffer) => void;
}

// Dual-broker mesh: connects to both public WSS brokers simultaneously.
// If one ISP/carrier blocks one broker or port, the other seamlessly bridges laptop & mobile!
const PUBLIC_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
];

interface BrokerSlot {
  url: string;
  client: MqttClient | null;
  connected: boolean;
  subscribed: boolean;
}

export class CloudSignalingClient {
  private slots: BrokerSlot[] = [];
  private hasNotifiedOpen = false;
  private isDestroyed = false;
  private pendingQueue: any[] = [];
  private announceTimer: ReturnType<typeof setInterval> | null = null;
  private seenMsgIds: Set<string> = new Set();
  private msgSeq = 0;

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

  public get isConnected(): boolean {
    return this.slots.some((s) => s.connected && s.subscribed);
  }

  private get broadcastTopic(): string {
    return `hsd/v2/${this.roomId}/b`;
  }

  private get privateTopic(): string {
    return `hsd/v2/${this.roomId}/p/${this.peerId}`;
  }

  // Also subscribe to v1 topic for backward compatibility if one side has an older cached build
  private get legacyBroadcastTopic(): string {
    return `hsd/v1/${this.roomId}/b`;
  }

  private get legacyPrivateTopic(): string {
    return `hsd/v1/${this.roomId}/p/${this.peerId}`;
  }

  public connect() {
    this.isDestroyed = false;
    this.hasNotifiedOpen = false;
    this.teardownSlots();

    this.slots = PUBLIC_BROKERS.map((url) => ({
      url,
      client: null,
      connected: false,
      subscribed: false,
    }));

    for (const slot of this.slots) {
      this.initSlot(slot);
    }
  }

  public reconnect() {
    if (this.isDestroyed) return;
    if (!this.isConnected) {
      console.log('[CloudSignaling] No broker connected, re-initializing dual-broker mesh...');
      this.connect();
    } else {
      // Reconnect any dead individual slot in background
      for (const slot of this.slots) {
        if (!slot.connected && !slot.client) {
          this.initSlot(slot);
        }
      }
      this.announcePresence();
    }
  }

  public announcePresence() {
    this.publishBroadcast({
      type: 'join',
      roomId: this.roomId,
      peerId: this.peerId,
      name: this.deviceName,
      deviceType: this.deviceType,
    });
  }

  public startDiscoveryAnnouncement() {
    this.stopDiscoveryAnnouncement();
    this.announceTimer = setInterval(() => {
      if (this.isConnected && !this.isDestroyed) {
        this.announcePresence();
      }
    }, 2200);
  }

  public stopDiscoveryAnnouncement() {
    if (this.announceTimer) {
      clearInterval(this.announceTimer);
      this.announceTimer = null;
    }
  }

  private teardownSlots() {
    for (const slot of this.slots) {
      if (slot.client) {
        try {
          slot.client.removeAllListeners();
          slot.client.end(true);
        } catch {}
        slot.client = null;
      }
      slot.connected = false;
      slot.subscribed = false;
    }
    this.slots = [];
  }

  private initSlot(slot: BrokerSlot) {
    if (this.isDestroyed) return;
    if (slot.client) {
      try {
        slot.client.removeAllListeners();
        slot.client.end(true);
      } catch {}
      slot.client = null;
    }

    try {
      const client = mqtt.connect(slot.url, {
        clientId: `hsd_${Math.random().toString(36).substring(2, 12)}`,
        clean: true,
        connectTimeout: 8000,
        keepalive: 25,
        reconnectPeriod: 3000,
      });

      slot.client = client;

      client.on('connect', () => {
        if (this.isDestroyed) return;
        slot.connected = true;
        console.log('[CloudSignaling] Connected to broker:', slot.url);

        const topics = [
          this.broadcastTopic,
          this.privateTopic,
          this.legacyBroadcastTopic,
          this.legacyPrivateTopic,
        ];

        client.subscribe(topics, { qos: 1 }, (err) => {
          if (this.isDestroyed) return;
          if (err) {
            console.warn('[CloudSignaling] Subscription error on', slot.url, err);
            return;
          }

          slot.subscribed = true;

          // Flush pending messages as soon as any broker is subscribed
          while (this.pendingQueue.length > 0) {
            const queued = this.pendingQueue.shift();
            if (queued) {
              this.send(queued);
            }
          }

          // Announce presence immediately on this newly connected broker
          this.announcePresence();
          if (!this.announceTimer) {
            this.startDiscoveryAnnouncement();
          }

          if (!this.hasNotifiedOpen) {
            this.hasNotifiedOpen = true;
            this.callbacks.onOpen();
          }
        });
      });

      client.on('message', (_topic: string, payload: any) => {
        if (this.isDestroyed) return;
        try {
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
        slot.connected = false;
        slot.subscribed = false;
        if (!this.isDestroyed && !this.isConnected && this.hasNotifiedOpen) {
          this.hasNotifiedOpen = false;
          console.warn('[CloudSignaling] All brokers temporarily disconnected, auto-reconnecting...');
          this.callbacks.onClose();
        }
      });

      client.on('error', (err) => {
        console.warn('[CloudSignaling] Broker error on', slot.url, err?.message || err);
        if (!this.isDestroyed && !this.isConnected) {
          this.callbacks.onError(err);
        }
      });
    } catch (err) {
      console.error('[CloudSignaling] Setup failed for', slot.url, err);
      if (!this.isConnected) {
        this.callbacks.onError(err);
      }
    }
  }

  private recordSeen(msgId?: string): boolean {
    if (!msgId) return false;
    if (this.seenMsgIds.has(msgId)) return true;
    this.seenMsgIds.add(msgId);
    if (this.seenMsgIds.size > 600) {
      // Evict oldest entries
      const first = this.seenMsgIds.values().next().value;
      if (first) this.seenMsgIds.delete(first);
    }
    return false;
  }

  private handleIncomingMessage(_topic: string, msg: any) {
    if (!msg || typeof msg !== 'object') return;

    // Ignore messages originating from self
    if (msg.fromPeerId === this.peerId || msg.peerId === this.peerId) {
      return;
    }

    // Deduplicate across dual brokers and dual v1/v2 topics
    if (msg._mid && this.recordSeen(msg._mid)) {
      return;
    }

    switch (msg.type) {
      case 'join': {
        const newPeer = {
          id: msg.peerId,
          name: msg.name || 'Device',
          deviceType: msg.deviceType || 'mobile',
        };

        const isNew = !this.knownPeers.has(newPeer.id);
        this.knownPeers.set(newPeer.id, newPeer);

        // Always reply to the joiner with our identity (both private and broadcast)
        const joinedPayload = {
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
        };

        this.publishPrivate(newPeer.id, joinedPayload);
        this.publishBroadcast(joinedPayload);

        this.callbacks.onMessage({
          type: 'peer-joined',
          peer: newPeer,
          isRejoin: !isNew,
        });
        break;
      }

      case 'joined': {
        // Ignore joined replies meant for another peer
        if (msg.yourPeerId && msg.yourPeerId !== this.peerId) {
          return;
        }
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
        if (this.knownPeers.size === 0) {
          this.startDiscoveryAnnouncement();
        }
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
    if (!this.isConnected) {
      if (this.pendingQueue.length < 100) {
        this.pendingQueue.push(msg);
      }
      return;
    }

    const enriched = {
      ...msg,
      fromPeerId: this.peerId,
      _mid: `${this.peerId}_${++this.msgSeq}_${Date.now()}`,
    };

    if (enriched.targetPeerId) {
      this.publishPrivate(enriched.targetPeerId, enriched);
    } else {
      this.publishBroadcast(enriched);
    }
  }

  public checkRoom(_targetRoomId: string): Promise<{ isValid: boolean; peerCount: number }> {
    return Promise.resolve({ isValid: true, peerCount: 1 });
  }

  private publishBroadcast(msg: any) {
    if (!this.isConnected) return;
    const payloadObj = msg._mid
      ? msg
      : { ...msg, fromPeerId: this.peerId, _mid: `${this.peerId}_${++this.msgSeq}_${Date.now()}` };
    const payload = JSON.stringify(payloadObj);
    const qos = msg.type === 'relay-chunk' ? 0 : 1;

    for (const slot of this.slots) {
      if (slot.client && slot.connected && slot.subscribed) {
        try {
          slot.client.publish(this.broadcastTopic, payload, { qos });
          slot.client.publish(this.legacyBroadcastTopic, payload, { qos: 0 });
        } catch {}
      }
    }
  }

  private publishPrivate(targetPeerId: string, msg: any) {
    if (!this.isConnected) return;
    const payloadObj = msg._mid
      ? msg
      : { ...msg, fromPeerId: this.peerId, _mid: `${this.peerId}_${++this.msgSeq}_${Date.now()}` };
    const payload = JSON.stringify(payloadObj);
    const qos = msg.type === 'relay-chunk' || msg.isHeartbeat ? 0 : 1;
    const v2Topic = `hsd/v2/${this.roomId}/p/${targetPeerId}`;
    const v1Topic = `hsd/v1/${this.roomId}/p/${targetPeerId}`;

    for (const slot of this.slots) {
      if (slot.client && slot.connected && slot.subscribed) {
        try {
          slot.client.publish(v2Topic, payload, { qos });
          slot.client.publish(v1Topic, payload, { qos: 0 });
        } catch {}
      }
    }
  }

  public disconnect() {
    this.isDestroyed = true;
    this.stopDiscoveryAnnouncement();
    this.pendingQueue = [];
    if (this.isConnected) {
      try {
        this.publishBroadcast({
          type: 'peer-left',
          peerId: this.peerId,
        });
      } catch {}
    }
    this.teardownSlots();
    this.hasNotifiedOpen = false;
    this.seenMsgIds.clear();
  }
}
