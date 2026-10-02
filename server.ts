import express from 'express';
import http from 'http';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { setupSignalingServer } from './src/server/signaling';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

function getLocalIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hotspot-drop-signaling' });
});

// Network IP endpoint for hotspot connection
app.get('/api/network-ip', (_req, res) => {
  res.json({ ips: getLocalIpAddresses() });
});

import fs from 'fs';

// Serve frontend build if built, otherwise provide signaling server status
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
} else {
  app.get('/', (_req, res) => {
    res.json({
      status: 'online',
      service: 'HotSpot Drop WebSocket Signaling Server',
      websocket: '/ws',
      info: 'Signaling server is active and ready for WebRTC connections',
    });
  });
}

const server = http.createServer(app);
setupSignalingServer(server);

server.listen(port, () => {
  console.log(`HotSpot Drop server running on port ${port}`);
});
