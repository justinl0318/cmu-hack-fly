import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

/** Transport only. Race simulation, admission, attacks and results stay in the host browser. */
export function attachDemoRelay(server: Server) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 2 * 1024 * 1024,
  });
  const peers = new Map<string, WebSocket>();
  const links = new Map<string, Set<string>>();
  const send = (socket: WebSocket | undefined, message: unknown) => {
    if (socket?.readyState !== WebSocket.OPEN) return;
    if (socket.bufferedAmount > 4 * 1024 * 1024) {
      socket.close(1013, 'Slow connection');
      return;
    }
    socket.send(JSON.stringify(message));
  };
  // Only claim our own path; Vite's HMR socket keeps its existing upgrade handler.
  const onUpgrade = (
    request: import('node:http').IncomingMessage,
    socket: import('node:stream').Duplex,
    head: Buffer,
  ) => {
    if (request.url?.split('?')[0] !== '/__fly_room/socket') return;
    let sameOrigin = false;
    try {
      sameOrigin =
        new URL(request.headers.origin ?? '').host === request.headers.host;
    } catch {
      /* reject */
    }
    if (!sameOrigin) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (ws) =>
      wss.emit('connection', ws, request),
    );
  };
  server.on('upgrade', onUpgrade);
  wss.on('connection', (socket) => {
    let id = '';
    const registration = setTimeout(
      () => socket.close(1008, 'Register first'),
      10000,
    );
    socket.on('error', () => socket.close());
    socket.on('message', (raw) => {
      let m: { type?: string; id?: unknown; to?: unknown; data?: unknown };
      try {
        const bytes = Array.isArray(raw)
          ? Buffer.concat(raw)
          : Buffer.from(raw as ArrayBuffer);
        m = JSON.parse(bytes.toString('utf8'));
      } catch {
        socket.close(1008, 'Invalid JSON');
        return;
      }
      if (!m || typeof m !== 'object') return;
      if (m.type === 'register' && !id) {
        const requested = m.id === undefined ? `guest-${randomUUID()}` : m.id;
        if (
          typeof requested !== 'string' ||
          !/^(flycircuit-v3-[A-HJ-NP-Z2-9]{8}|guest-[a-f0-9-]{36})$/.test(
            requested,
          )
        ) {
          send(socket, { type: 'error', error: 'invalid-id' });
          return;
        }
        if (peers.has(requested)) {
          send(socket, { type: 'error', error: 'unavailable-id' });
          return;
        }
        id = requested;
        clearTimeout(registration);
        peers.set(id, socket);
        links.set(id, new Set());
        send(socket, { type: 'registered', id });
      } else if (id && typeof m.to === 'string') {
        const to = m.to;
        if (m.type === 'connect') {
          if (
            !id.startsWith('guest-') ||
            !to.startsWith('flycircuit-v3-') ||
            !peers.has(to)
          ) {
            send(socket, { type: 'error', error: 'peer-unavailable' });
            return;
          }
          if (links.get(id)!.size || links.get(to)!.size >= 7) {
            send(socket, { type: 'error', error: 'room-full' });
            return;
          }
          links.get(id)!.add(to);
          links.get(to)!.add(id);
          send(peers.get(to), { type: 'incoming', peer: id });
          send(socket, { type: 'linked', peer: to });
        } else if (links.get(id)?.has(to)) {
          if (m.type === 'data')
            send(peers.get(to), { type: 'data', peer: id, data: m.data });
          else if (m.type === 'leave') {
            links.get(id)?.delete(to);
            links.get(to)?.delete(id);
            send(peers.get(to), { type: 'left', peer: id });
          }
        }
      }
    });
    socket.on('close', () => {
      clearTimeout(registration);
      if (!id) return;
      for (const other of links.get(id) ?? []) {
        links.get(other)?.delete(id);
        send(peers.get(other), { type: 'left', peer: id });
      }
      peers.delete(id);
      links.delete(id);
    });
  });
  const stop = () => {
    server.off('upgrade', onUpgrade);
    for (const socket of wss.clients) socket.terminate();
    wss.close();
  };
  return stop;
}
