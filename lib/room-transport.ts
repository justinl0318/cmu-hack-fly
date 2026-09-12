export interface RoomConnection {
  peer: string;
  open: boolean;
  peerConnection?: RTCPeerConnection;
  dataChannel: { bufferedAmount: number };
  send(data: unknown): unknown;
  close(): void;
  on(event: 'open' | 'close', callback: () => void): unknown;
  on(event: 'data', callback: (data: unknown) => void): unknown;
  on(event: 'error', callback: (error: { type: string }) => void): unknown;
  on(
    event: 'iceStateChanged',
    callback: (state: RTCIceConnectionState) => void,
  ): unknown;
}
export interface RoomTransport {
  connect(
    id: string,
    options?: { reliable: boolean; serialization: 'binary' },
  ): RoomConnection;
  destroy(): void;
  on(event: 'open', callback: (id: string) => void): unknown;
  on(
    event: 'connection',
    callback: (connection: RoomConnection) => void,
  ): unknown;
  on(event: 'error', callback: (error: { type: string }) => void): unknown;
  on(event: 'disconnected', callback: () => void): unknown;
}
