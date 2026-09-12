import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { WebSocket } from 'ws';
// @ts-expect-error Native tests use explicit extensions.
import { attachDemoRelay } from './demo-relay.ts';

void test(
  'same-port relay joins clients, isolates rooms, transfers large results and removes departed hosts',
  { timeout: 10000 },
  async (t) => {
    const server = createServer();
    const stop = attachDemoRelay(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = (server.address() as { port: number }).port;
    const origin = `http://127.0.0.1:${port}`;
    t.after(() => {
      stop();
      server.close();
    });
    const client = async (id?: string) => {
      const ws = new WebSocket(
        `ws://127.0.0.1:${port}/__fly_room/socket`,
        'vite-flycircuit-v3',
        {
          origin,
        },
      );
      const queue: Record<string, unknown>[] = [];
      const waiters: ((m: Record<string, unknown>) => void)[] = [];
      ws.on('message', (data) => {
        const bytes = Array.isArray(data)
          ? Buffer.concat(data)
          : Buffer.from(data as ArrayBuffer);
        const m = JSON.parse(bytes.toString('utf8'));
        const next = waiters.shift();
        if (next) next(m);
        else queue.push(m);
      });
      const next = () =>
        queue.length
          ? Promise.resolve(queue.shift()!)
          : new Promise<Record<string, unknown>>((resolve) =>
              waiters.push(resolve),
            );
      await once(ws, 'open');
      const send = (m: unknown) => ws.send(JSON.stringify(m));
      send({ type: 'register', id });
      const registered = await next();
      assert.equal(registered.type, 'registered');
      return { ws, send, next, id: registered.id as string };
    };
    const host = await client('flycircuit-v3-ABCDEFGH');
    const guest = await client();
    const other = await client('flycircuit-v3-JKLMNPQR');
    guest.send({ type: 'connect', to: host.id });
    assert.equal((await host.next()).peer, guest.id);
    assert.equal((await guest.next()).type, 'linked');
    guest.send({
      type: 'data',
      to: host.id,
      data: { type: 'join', profile: { name: 'Guest' } },
    });
    assert.deepEqual((await host.next()).data, {
      type: 'join',
      profile: { name: 'Guest' },
    });
    // A socket outside the linked room must not be able to inject snapshots.
    other.send({ type: 'data', to: guest.id, data: 'forged' });
    const result = {
      type: 'snapshot',
      race: { phase: 'results', replay: 's'.repeat(200000) },
    };
    host.send({ type: 'data', to: guest.id, data: result });
    assert.deepEqual((await guest.next()).data, result);
    const left = guest.next();
    host.ws.close();
    assert.equal((await left).type, 'left');
    guest.send({ type: 'connect', to: host.id });
    assert.equal((await guest.next()).error, 'peer-unavailable');
    guest.send({ type: 'connect', to: other.id });
    assert.equal((await other.next()).type, 'incoming');
    assert.equal((await guest.next()).type, 'linked');
    guest.ws.close();
    other.ws.close();
  },
);
