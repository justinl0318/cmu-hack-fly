import type { Plugin } from 'vite';
import type { Server } from 'node:http';
import { attachDemoRelay } from './demo-relay';
export function demoRelayPlugin(): Plugin {
  return {
    name: 'flycircuit-demo-relay',
    apply: 'serve',
    configureServer(server) {
      if (!server.httpServer) return;
      const stop = attachDemoRelay(server.httpServer as Server);
      server.httpServer.once('close', stop);
      server.middlewares.use('/__fly_room/status', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        res.end(JSON.stringify({ available: true, protocol: 3 }));
      });
    },
  };
}
