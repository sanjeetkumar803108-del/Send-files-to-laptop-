import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

export interface PeerInfo {
  id: string;
  name: string;
  deviceType: 'mobile' | 'laptop' | 'tablet' | 'desktop';
  ws: WebSocket;
  roomId: string;
  joinedAt: number;
}

interface Room {
  id: string;
  peers: Map<string, PeerInfo>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setupSignalingServer(httpServer: any) {
  if (!httpServer) return null;
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const rooms = new Map<string, Room>();

  wss.on('connection', (ws: WebSocket) => {
    let currentPeerId: string | null = null;
    let currentRoomId: string | null = null;

    // Send ping every 20 seconds to prevent proxy disconnects
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 20000);

    ws.on('message', (messageBuffer: any, isBinary: boolean) => {
      try {
        // Fast-path: forward raw binary file chunks directly without JSON/string parsing
        if (isBinary) {
          if (!currentRoomId || !currentPeerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          room.peers.forEach((peer, pId) => {
            if (pId !== currentPeerId && peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(messageBuffer, { binary: true });
            }
          });
          return;
        }

        const messageStr = messageBuffer.toString();
        const msg = JSON.parse(messageStr);

        switch (msg.type) {
          case 'check-room': {
            const { checkRoomId } = msg;
            const room = rooms.get(checkRoomId);
            const activePeers = room
              ? Array.from(room.peers.values()).filter((p) => p.ws.readyState === WebSocket.OPEN)
              : [];
            ws.send(
              JSON.stringify({
                type: 'room-check-result',
                roomId: checkRoomId,
                isValid: activePeers.length > 0,
                peerCount: activePeers.length,
              })
            );
            break;
          }

          case 'join': {
            const { roomId, peerId, name, deviceType } = msg;
            if (!roomId || !peerId) return;

            currentPeerId = peerId;
            currentRoomId = roomId;

            let room = rooms.get(roomId);
            if (!room) {
              room = { id: roomId, peers: new Map() };
              rooms.set(roomId, room);
            }

            // Remove existing peer with same ID if any
            if (room.peers.has(peerId)) {
              const oldPeer = room.peers.get(peerId);
              if (oldPeer && oldPeer.ws !== ws && oldPeer.ws.readyState === WebSocket.OPEN) {
                oldPeer.ws.close();
              }
            }

            const newPeer: PeerInfo = {
              id: peerId,
              name: name || (deviceType === 'mobile' ? 'Mobile Device' : 'Laptop'),
              deviceType: deviceType || 'laptop',
              ws,
              roomId,
              joinedAt: Date.now(),
            };

            room.peers.set(peerId, newPeer);

            // Get existing other peers in room
            const otherPeers: Array<{ id: string; name: string; deviceType: string }> = [];
            room.peers.forEach((peer, pId) => {
              if (pId !== peerId && peer.ws.readyState === WebSocket.OPEN) {
                otherPeers.push({
                  id: peer.id,
                  name: peer.name,
                  deviceType: peer.deviceType,
                });
              }
            });

            // Acknowledge join to the sender
            ws.send(JSON.stringify({
              type: 'joined',
              yourPeerId: peerId,
              roomId,
              peers: otherPeers,
            }));

            // Notify other peers in this room
            const joinNotification = JSON.stringify({
              type: 'peer-joined',
              peer: {
                id: newPeer.id,
                name: newPeer.name,
                deviceType: newPeer.deviceType,
              },
            });

            room.peers.forEach((peer, pId) => {
              if (pId !== peerId && peer.ws.readyState === WebSocket.OPEN) {
                peer.ws.send(joinNotification);
              }
            });
            break;
          }

          case 'signal': {
            // Forward WebRTC signaling (offer/answer/ice candidate)
            const { targetPeerId, signal } = msg;
            if (!currentRoomId || !currentPeerId) return;

            const room = rooms.get(currentRoomId);
            if (!room) return;

            let targetPeer = targetPeerId ? room.peers.get(targetPeerId) : null;
            if (!targetPeer || targetPeer.ws.readyState !== WebSocket.OPEN) {
              for (const [pId, p] of room.peers.entries()) {
                if (pId !== currentPeerId && p.ws.readyState === WebSocket.OPEN) {
                  targetPeer = p;
                  break;
                }
              }
            }

            if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
              targetPeer.ws.send(JSON.stringify({
                type: 'signal',
                fromPeerId: currentPeerId,
                signal,
              }));
            }
            break;
          }

          case 'relay-meta':
          case 'relay-chunk':
          case 'relay-complete':
          case 'relay-cancel':
          case 'relay-text': {
            // Forward fallback relay packets directly between peers
            const { targetPeerId } = msg;
            if (!currentRoomId || !currentPeerId) return;

            const room = rooms.get(currentRoomId);
            if (!room) return;

            let targetPeer = targetPeerId ? room.peers.get(targetPeerId) : null;
            if (!targetPeer || targetPeer.ws.readyState !== WebSocket.OPEN) {
              for (const [pId, p] of room.peers.entries()) {
                if (pId !== currentPeerId && p.ws.readyState === WebSocket.OPEN) {
                  targetPeer = p;
                  break;
                }
              }
            }

            if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
              msg.fromPeerId = currentPeerId;
              targetPeer.ws.send(JSON.stringify(msg));
            }
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('Signaling server error handling message:', err);
      }
    });

    const cleanup = () => {
      clearInterval(pingInterval);
      if (currentRoomId && currentPeerId) {
        const room = rooms.get(currentRoomId);
        if (room) {
          room.peers.delete(currentPeerId);

          // Broadcast peer-left to remaining peers
          const leaveNotification = JSON.stringify({
            type: 'peer-left',
            peerId: currentPeerId,
          });

          room.peers.forEach((peer) => {
            if (peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(leaveNotification);
            }
          });

          if (room.peers.size === 0) {
            rooms.delete(currentRoomId);
          }
        }
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  return wss;
}
