export const CONNECTION_TIMEOUT_MS = 45000;
export const JOIN_TIMEOUT_MS = 10000;
export type ConnectionStage =
  | 'signaling'
  | 'peer'
  | 'channel'
  | 'join'
  | 'connected';

export function connectionTimeout(stage: ConnectionStage, ice: string) {
  if (stage === 'signaling')
    return 'Room matching service did not respond. Both computers need Internet access to PeerJS. Reload both pages and retry.';
  if (stage === 'join')
    return 'The data channel opened, but the host did not admit you. Keep the host tab visible, reload both pages to the same version, and create a new room.';
  return `WebRTC could not open a data channel (ICE: ${ice}). The website loading does not confirm a peer connection. Try both computers on the same phone hotspot, or configure a reachable TURN relay. Reload both pages and recreate the room.`;
}

/** Negotiation gets its own budget; admission starts only after the channel opens. */
export class ConnectionDeadline {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private expired: () => void;
  constructor(expired: () => void) {
    this.expired = expired;
    this.arm(CONNECTION_TIMEOUT_MS);
  }
  channelOpened() {
    this.arm(JOIN_TIMEOUT_MS);
  }
  private arm(ms: number) {
    this.clear();
    this.timer = setTimeout(this.expired, ms);
  }
  clear() {
    clearTimeout(this.timer);
  }
}
