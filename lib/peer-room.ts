import { normalizeProfile, type PlayerProfile } from './profile';
import Peer from 'peerjs';
import { LanPeer } from './lan-peer';
import type { RoomConnection, RoomTransport } from './room-transport';
import { normalizeFlightSpeed } from './simulation';
import {
  advanceRace,
  attack,
  createRacer,
  type NeuralFrame,
  type RaceSnapshot,
} from './battle';
import { muscleInputs } from './controls';
import type { Circuit } from '@/components/BrainView';
import {
  ConnectionDeadline,
  connectionTimeout,
  CONNECTION_TIMEOUT_MS,
  JOIN_TIMEOUT_MS,
  type ConnectionStage,
} from './room-connection';

const PREFIX = 'flycircuit-v3-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function roomCode() {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (n) => ALPHABET[n % 32],
  ).join('');
}
export class PeerRoom {
  peer: RoomTransport;
  id = '';
  code: string;
  host: boolean;
  race: RaceSnapshot = { phase: 'lobby', clock: 0, countdown: 3, players: [] };
  connections = new Map<string, RoomConnection>();
  workers = new Map<string, Worker>();
  recordings = new Map<string, NeuralFrame[]>();
  lastInput = new Map<string, number>();
  timer: ReturnType<typeof setInterval>;
  timeout: ReturnType<typeof setTimeout>;
  closed = false;
  private stage: ConnectionStage = 'signaling';
  private ice = 'new';
  private pending = new Map<RoomConnection, ConnectionDeadline>();
  constructor(
    host: boolean,
    code: string,
    private profile: PlayerProfile,
    private circuit: Circuit,
    private snapshot: (s: RaceSnapshot) => void,
    private status: (message: string, connected?: boolean) => void,
    private transport: 'lan' | 'webrtc' = 'webrtc',
    speedMultiplier = 1,
  ) {
    this.host = host;
    this.race.speedMultiplier = normalizeFlightSpeed(speedMultiplier);
    this.code = host ? roomCode() : code.trim().toUpperCase();
    this.peer =
      transport === 'lan'
        ? new LanPeer(host ? PREFIX + this.code : undefined)
        : host
          ? new Peer(PREFIX + this.code)
          : new Peer();
    this.timeout = setTimeout(
      () => this.fail(this.timeoutMessage()),
      CONNECTION_TIMEOUT_MS,
    );
    this.status(
      transport === 'lan'
        ? '1/3 · Connecting through this website…'
        : '1/3 · Contacting room matching service…',
    );
    this.peer.on('open', (id) => {
      if (this.closed) return;
      this.id = id;
      if (host) {
        clearTimeout(this.timeout);
        this.add(id, this.profile);
        this.status('Room ready', true);
        this.publish();
      } else {
        this.stage = 'peer';
        clearTimeout(this.timeout);
        this.timeout = setTimeout(
          () => this.fail(this.timeoutMessage()),
          CONNECTION_TIMEOUT_MS,
        );
        this.status(
          transport === 'lan'
            ? '2/3 · Finding the host on this website…'
            : '2/3 · Matching service connected. Opening a channel to the host…',
        );
        const conn = this.peer.connect(PREFIX + this.code, {
          reliable: true,
          serialization: 'binary',
        });
        this.connections.set(conn.peer, conn);
        conn.on('iceStateChanged', (state) => {
          this.ice = state;
          if (this.closed || this.stage === 'connected') return;
          if (conn.peerConnection?.remoteDescription) this.stage = 'channel';
          this.status(`2/3 · Opening WebRTC channel · ICE: ${state}…`);
        });
        conn.on('open', () => {
          this.stage = 'join';
          clearTimeout(this.timeout);
          this.timeout = setTimeout(
            () => this.fail(this.timeoutMessage()),
            JOIN_TIMEOUT_MS,
          );
          this.status('3/3 · Channel open. Waiting for room admission…');
          void conn.send({ type: 'join', profile: this.profile });
        });
        conn.on('data', (data) => {
          const m = data as {
            type?: string;
            race?: RaceSnapshot;
            message?: string;
          };
          if (!m || typeof m !== 'object') return;
          if (
            m.type === 'snapshot' &&
            m.race &&
            Array.isArray(m.race.players) &&
            m.race.players.some((p) => p.id === this.id)
          ) {
            clearTimeout(this.timeout);
            this.race = m.race;
            this.snapshot(m.race);
            if (this.stage !== 'connected') {
              this.stage = 'connected';
              this.status('Connected', true);
            }
          } else if (m.type === 'error')
            this.fail(m.message || 'Room unavailable');
        });
        conn.on('close', () =>
          this.fail(
            this.stage === 'connected'
              ? 'The host left or the connection was lost. This room has ended.'
              : this.timeoutMessage(),
          ),
        );
        conn.on('error', () =>
          this.fail(
            this.stage === 'connected'
              ? 'Connection lost. Rejoin from the lobby.'
              : this.timeoutMessage(),
          ),
        );
      }
    });
    this.peer.on('connection', (conn) => {
      if (!host) {
        conn.close();
        return;
      }
      let admitted = false;
      const deadline = new ConnectionDeadline(() => {
        this.pending.delete(conn);
        if (!admitted) conn.close();
      });
      this.pending.set(conn, deadline);
      conn.on('open', () => {
        if (!admitted) deadline.channelOpened();
      });
      conn.on('data', (data) => {
        const m = data as { type?: string; profile?: unknown; keys?: unknown };
        if (!m || typeof m !== 'object') return;
        if (m.type === 'join' && !admitted) {
          if (
            this.race.phase !== 'lobby' ||
            this.race.players.length >= 8 ||
            this.connections.has(conn.peer)
          ) {
            void conn.send({
              type: 'error',
              message: 'Room is full or the race has already started.',
            });
            return;
          }
          admitted = true;
          deadline.clear();
          this.pending.delete(conn);
          this.connections.set(conn.peer, conn);
          this.add(conn.peer, normalizeProfile(m.profile));
          this.publish();
        } else if (admitted && m.type === 'input' && Array.isArray(m.keys))
          this.applyInput(
            conn.peer,
            m.keys
              .filter((k): k is string => typeof k === 'string')
              .slice(0, 7),
          );
      });
      const remove = () => {
        deadline.clear();
        this.pending.delete(conn);
        if (!admitted) return;
        admitted = false;
        this.connections.delete(conn.peer);
        this.workers.get(conn.peer)?.terminate();
        this.workers.delete(conn.peer);
        this.lastInput.delete(conn.peer);
        this.race.players = this.race.players.filter((p) => p.id !== conn.peer);
        this.publish();
      };
      conn.on('close', remove);
      conn.on('error', remove);
    });
    this.peer.on('error', (error) => {
      // A failed guest negotiation must not destroy the host's entire room.
      if (
        host &&
        this.id &&
        ['webrtc', 'peer-unavailable'].includes(error.type)
      ) {
        this.status(
          `A guest could not connect (${error.type}). Room is still open; ask them to retry on the same hotspot.`,
          true,
        );
        return;
      }
      this.fail(
        error.type === 'lan-unavailable' || error.type.startsWith('lan-closed-')
          ? `Same-website connection unavailable (${error.type}). Restart npm run dev on the website computer, then reload both pages. This mode needs the updated demo website.`
          : error.type === 'room-full'
            ? 'This room is full. Ask the host to create another room.'
            : error.type === 'peer-unavailable'
              ? 'Room not found. Both players must use the SAME connection mode and website server. Reload both pages, ask the host to create a NEW room, and copy its code.'
              : `Connection error: ${error.type}. Try again or use a shared hotspot.`,
      );
    });
    this.peer.on('disconnected', () =>
      this.fail(
        transport === 'lan'
          ? 'Connection to the demo website was lost. Keep the website running, then create or join a new room.'
          : 'Signaling connection lost. Please create or join a new room.',
      ),
    );
    let last = performance.now(),
      accumulator = 0,
      broadcast = 0;
    this.timer = setInterval(() => {
      if (!host || this.closed) return;
      const now = performance.now();
      accumulator += Math.min((now - last) / 1000, 0.1);
      last = now;
      for (const [id, time] of this.lastInput)
        if (now - time > 600)
          this.workers.get(id)?.postMessage({ type: 'input', pressed: [] });
      while (accumulator >= 1 / 60) {
        const wasRacing = this.race.phase === 'racing';
        advanceRace(this.race, 1 / 60);
        if (wasRacing && this.race.phase === 'results') {
          this.race.results = this.race.players.map((p) => ({
            ...structuredClone(p),
            neuralReplay: structuredClone(this.recordings.get(p.id) ?? []),
          }));
          for (const w of this.workers.values())
            w.postMessage({ type: 'pause', paused: true });
          this.publish();
        }
        accumulator -= 1 / 60;
      }
      broadcast++;
      if (
        broadcast % 2 === 0 &&
        ['countdown', 'racing'].includes(this.race.phase)
      )
        this.publish();
    }, 1000 / 60);
  }
  private timeoutMessage() {
    return this.transport === 'lan'
      ? 'Same-website connection timed out. Restart the updated npm run dev, open the SAME website address on both computers, select Same website on both, and create a new room. Keep the host tab visible.'
      : connectionTimeout(this.stage, this.ice);
  }
  private add(id: string, profile: PlayerProfile) {
    this.race.players.push(
      createRacer(id, profile.name, this.race.players.length, profile),
    );
    const w = new Worker('/neural-worker.js');
    this.workers.set(id, w);
    w.onmessage = (event) => {
      const p = this.race.players.find((p) => p.id === id),
        m = event.data;
      if (m.type === 'ready') w.postMessage({ type: 'pause', paused: false });
      if (p && m.type === 'frame' && this.race.phase !== 'results') {
        p.activations = m.activations;
        p.spikes = m.spikes;
        if (this.race.phase === 'racing') {
          const frames = this.recordings.get(id) ?? [];
          if (
            !frames.length ||
            this.race.clock - frames[frames.length - 1].at >= 0.095
          ) {
            frames.push({
              at: this.race.clock,
              activations: [...m.activations],
              spikes: [...m.spikes],
            });
            while (frames.length > 30) frames.shift();
            this.recordings.set(id, frames);
          }
        }
      }
    };
    w.onerror = () =>
      this.fail('A neural worker stopped. Please recreate the room.');
    w.postMessage({ type: 'init', circuit: this.circuit });
  }
  private applyInput(id: string, keys: string[]) {
    this.lastInput.set(id, performance.now());
    const active = this.race.phase === 'racing';
    this.workers.get(id)?.postMessage({
      type: 'input',
      pressed: active ? muscleInputs(keys) : [],
    });
    if (active && keys.includes('f')) attack(this.race, id);
  }
  input(keys: string[]) {
    if (this.host) this.applyInput(this.id, keys);
    else
      for (const c of this.connections.values())
        if (c.open && c.dataChannel.bufferedAmount < 65536)
          void c.send({ type: 'input', keys });
  }
  start() {
    if (
      !this.host ||
      this.race.players.length < 2 ||
      !['lobby', 'results'].includes(this.race.phase)
    )
      return;
    this.race.players = this.race.players.map((p, i) =>
      createRacer(p.id, p.name, i, p.profile),
    );
    for (const w of this.workers.values()) {
      w.postMessage({ type: 'reset' });
      w.postMessage({ type: 'pause', paused: false });
    }
    this.recordings.clear();
    this.race.results = undefined;
    this.race.phase = 'countdown';
    this.race.countdown = 3;
    this.race.clock = 0;
    this.publish();
  }
  private publish() {
    if (this.closed) return;
    const s = structuredClone(this.race);
    this.snapshot(s);
    for (const c of this.connections.values())
      if (
        c.open &&
        (s.phase === 'results' || c.dataChannel.bufferedAmount < 65536)
      )
        void c.send({ type: 'snapshot', race: s });
  }
  private fail(message: string) {
    if (this.closed) return;
    this.status(message, false);
    this.close();
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    clearTimeout(this.timeout);
    for (const [conn, deadline] of this.pending) {
      deadline.clear();
      conn.close();
    }
    this.pending.clear();
    for (const w of this.workers.values()) w.terminate();
    for (const c of this.connections.values()) c.close();
    this.peer.destroy();
  }
}
