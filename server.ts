import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupSignalingServer } from './src/server/signaling';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hotspot-drop-signaling' });
});

// Serve frontend build
app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const server = http.createServer(app);
setupSignalingServer(server);

server.listen(port, () => {
  console.log(`HotSpot Drop server running on port ${port}`);
});
