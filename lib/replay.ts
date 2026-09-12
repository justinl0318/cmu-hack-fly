import type { FlightState, Vector } from './simulation';
export interface ReplayFrame {
  at: number;
  flight: FlightState;
  activations: number[];
  spikes: string[];
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const vector = (a: Vector, b: Vector, t: number): Vector => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
  z: lerp(a.z, b.z, t),
});
/** Interpolate continuous values only. Events retain their recorded frame boundary. */
export function interpolateReplay(
  a: ReplayFrame,
  b: ReplayFrame,
  at: number,
): ReplayFrame {
  const t = Math.max(0, Math.min(1, (at - a.at) / Math.max(1e-8, b.at - a.at)));
  if (t === 1) return b;
  const x = a.flight,
    y = b.flight;
  return {
    at,
    spikes: a.spikes,
    activations: a.activations.map((v, i) => lerp(v, b.activations[i], t)),
    flight: {
      ...x,
      position: vector(x.position, y.position, t),
      velocity: vector(x.velocity, y.velocity, t),
      angularVelocity: vector(x.angularVelocity, y.angularVelocity, t),
      roll: lerp(x.roll, y.roll, t),
      pitch: lerp(x.pitch, y.pitch, t),
      yaw: lerp(x.yaw, y.yaw, t),
      elapsed: lerp(x.elapsed, y.elapsed, t),
      distance: lerp(x.distance, y.distance, t),
      stability: lerp(x.stability, y.stability, t),
      muscle: x.muscle.map((v, i) => lerp(v, y.muscle[i], t)),
      fatigue: x.fatigue.map((v, i) => lerp(v, y.fatigue[i], t)),
    },
  };
}
