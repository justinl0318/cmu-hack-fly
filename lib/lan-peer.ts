/** Browser adapter for the demo relay on the existing website's HTTP port. */
type Events = {
  open: (id: string) => void;
  data: (data: unknown) => void;
  close: () => void;
  error: (error: { type: string }) => void;
  disconnected: () => void;
  connection: (connection: LanConnection) => void;
  iceStateChanged: (state: RTCIceConnectionState) => void;
};
class EventsHub {
  private listeners = new Map<string, Set<(...args: never[]) => void>>();
  on<K extends keyof Events>(event: K, fn: Events[K]) {
    const list = this.listeners.get(event) ?? new Set();
    list.add(fn as (...args: never[]) => void);
    this.listeners.set(event, list);
    return this;
  }
  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>) {
    this.listeners.get(event)?.forEach((fn) => fn(...(args as never[])));
  }
}
export class LanConnection extends EventsHub {
  open = false;
  peerConnection: RTCPeerConnection | undefined;
  constructor(
    public peer: string,
    private owner: LanPeer,
  ) {
    super();
  }
  get dataChannel() {
    return { bufferedAmount: this.owner.socket.bufferedAmount };
  }
  send(data: unknown) {
    if (this.open) this.owner.send({ type: 'data', to: this.peer, data });
  }
  close() {
    this.owner.send({ type: 'leave', to: this.peer });
    this.end();
  }
  end() {
    this.open = false;
    if (this.owner.connections.delete(this.peer)) this.emit('close');
  }
}
export class LanPeer extends EventsHub {
  socket: WebSocket;
  connections = new Map<string, LanConnection>();
  private destroyed = false;
  constructor(id?: string) {
    super();
    const url = new URL('/__fly_room/socket', window.location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    // Cloudflare's dev plugin leaves Vite-prefixed protocols to local plugins.
    this.socket = new WebSocket(url, 'vite-flycircuit-v3');
    this.socket.onopen = () => this.send({ type: 'register', id });
    this.socket.onmessage = (event) => {
      const m = JSON.parse(String(event.data));
      if (m.type === 'registered') this.emit('open', m.id);
      else if (m.type === 'error') this.emit('error', { type: m.error });
      else if (m.type === 'incoming' || m.type === 'linked') {
        const conn =
          this.connections.get(m.peer) ?? new LanConnection(m.peer, this);
        this.connections.set(m.peer, conn);
        if (m.type === 'incoming') this.emit('connection', conn);
        conn.open = true;
        conn.emit('open', '');
      } else if (m.type === 'data')
        this.connections.get(m.peer)?.emit('data', m.data);
      else if (m.type === 'left') this.connections.get(m.peer)?.end();
    };
    this.socket.onerror = () => {
      if (!this.destroyed) this.emit('error', { type: 'lan-unavailable' });
    };
    this.socket.onclose = (event) => {
      if (!this.destroyed)
        this.emit('error', { type: `lan-closed-${event.code}` });
      for (const conn of this.connections.values()) conn.end();
    };
  }
  send(message: unknown) {
    if (this.socket.readyState === WebSocket.OPEN)
      this.socket.send(JSON.stringify(message));
  }
  connect(id: string, _options?: unknown) {
    const conn = new LanConnection(id, this);
    this.connections.set(id, conn);
    this.send({ type: 'connect', to: id });
    return conn;
  }
  destroy() {
    this.destroyed = true;
    this.socket.close();
    for (const conn of this.connections.values()) conn.end();
  }
}
