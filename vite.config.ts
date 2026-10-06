import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import os from 'os';
import { defineConfig, type Plugin } from 'vite';
import { setupSignalingServer } from './src/server/signaling.ts';

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

function signalingPlugin(): Plugin {
  return {
    name: 'signaling-server',
    configureServer(server) {
      if (server.httpServer) {
        setupSignalingServer(server.httpServer);
      }
      server.middlewares.use('/api/network-ip', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify({
          ips: getLocalIpAddresses(),
        }));
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), signalingPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        mqtt: path.resolve(__dirname, 'node_modules/mqtt/dist/mqtt.esm.js'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
