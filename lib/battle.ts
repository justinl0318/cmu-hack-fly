// @ts-expect-error Native Node tests use explicit extensions.
import { normalizeProfile, type PlayerProfile } from './profile.ts';
import {
  createFlightState,
  stepFlight,
  stun,
  type FlightState,
  // @ts-expect-error Native Node tests use explicit extensions.
} from './simulation.ts';

export const ATTACK_COOLDOWN = 1.5;
export const ATTACK_RANGE = 8;
export interface Racer {
  id: string;
  name: string;
  color: string;
  profile: PlayerProfile;
  topSpeed: number;
  turnEffort: number;
  imbalance: number;
  activeTime: number;
  boostTime: number;
  neuralReplay: NeuralFrame[];
  state: FlightState;
  activations: number[];
  spikes: string[];
  cooldown: number;
  attackFlash: number;
  hits: number;
  finishTime: number | null;
}
export interface NeuralFrame {
  at: number;
  activations: number[];
  spikes: string[];
}
export interface RaceSnapshot {
  speedMultiplier?: number;
  results?: Racer[];
  phase: 'lobby' | 'countdown' | 'racing' | 'results';
  clock: number;
  countdown: number;
  players: Racer[];
}
export function createRacer(
  id: string,
  name: string,
  slot: number,
  profile?: PlayerProfile,
): Racer {
  const personal = normalizeProfile(profile ?? { name });
  const state = createFlightState();
  state.position.x = ((slot % 4) - 1.5) * 2;
  state.position.y += Math.floor(slot / 4) * 2;
  return {
    id,
    name: personal.name,
    color: personal.look.color,
    profile: personal,
    topSpeed: 0,
    turnEffort: 0,
    imbalance: 0,
    activeTime: 0,
    boostTime: 0,
    neuralReplay: [],
    state,
    activations: Array(10).fill(0),
    spikes: [],
    cooldown: 0,
    attackFlash: 0,
    hits: 0,
    finishTime: null,
  };
}
/** The room owner's browser is the sole authority for progress and hits. */
export function attack(race: RaceSnapshot, id: string) {
  const a = race.players.find((p) => p.id === id);
  if (
    race.phase !== 'racing' ||
    !a ||
    a.cooldown > 0 ||
    a.state.stunRemaining > 0 ||
    a.state.finished ||
    !a.state.launched
  )
    return false;
  a.cooldown = ATTACK_COOLDOWN;
  a.attackFlash = 0.3;
  for (const b of race.players) {
    if (
      b === a ||
      b.state.finished ||
      !b.state.launched ||
      b.state.stunRemaining > 0 ||
      b.state.recoveryRemaining > 0
    )
      continue;
    const dx = b.state.position.x - a.state.position.x,
      dz = b.state.position.z - a.state.position.z;
    const dy = b.state.position.y - a.state.position.y;
    const distance = Math.hypot(dx, dy, dz);
    const forward = dx * Math.sin(a.state.yaw) + dz * Math.cos(a.state.yaw);
    if (
      distance <= ATTACK_RANGE &&
      Math.abs(dy) <= 3 &&
      forward > 0 &&
      forward / Math.max(0.001, Math.hypot(dx, dz)) >= 0.65
    ) {
      stun(b.state);
      a.hits++;
    }
  }
  return true;
}
export function advanceRace(race: RaceSnapshot, dt: number) {
  if (race.phase === 'countdown') {
    race.countdown = Math.max(0, race.countdown - dt);
    if (!race.countdown) race.phase = 'racing';
    return;
  }
  if (race.phase !== 'racing') return;
  race.clock += dt;
  for (const p of race.players) {
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.attackFlash = Math.max(0, p.attackFlash - dt);
    stepFlight(p.state, p.activations, dt, race.speedMultiplier ?? 1);
    if (p.state.launched && p.state.stunRemaining === 0) {
      p.topSpeed = Math.max(
        p.topSpeed,
        Math.hypot(p.state.velocity.x, p.state.velocity.y, p.state.velocity.z),
      );
      p.activeTime += dt;
      p.turnEffort += Math.abs(p.state.angularVelocity.y) * dt;
      p.imbalance += Math.abs(p.activations[0] - p.activations[5]) * dt;
      if (p.state.boostRemaining > 0) p.boostTime += dt;
    }
    if (p.state.finished && p.finishTime === null) p.finishTime = race.clock;
  }
  if (race.players.some((p) => p.state.finished)) {
    race.phase = 'results';
    race.results = structuredClone(race.players);
  }
}

/** Labels summarize game telemetry, not personality or biological traits. */
export function neuralStyle(p: Racer) {
  if (p.activeTime < 1) return 'Finding My Wings';
  if (p.turnEffort / p.activeTime > 0.23) return 'Aggressive Cornering';
  if (p.boostTime / p.activeTime > 0.15) return 'Snack-Powered Sprinter';
  if (p.imbalance / p.activeTime > 0.14) return 'Freestyle Flier';
  return 'Balanced Wingbeats';
}
