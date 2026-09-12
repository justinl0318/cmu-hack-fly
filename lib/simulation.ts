/** Arcade biomechanics: real connectome activity, deliberately invented muscle mapping. */
export const CHANNELS = ['left', 'right'].flatMap((side, sideIndex) =>
  ['Downstroke', 'Upstroke', 'Pronation', 'Supination', 'Stroke extent'].map((label, i) => ({
    id: sideIndex * 5 + i,
    key: ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g'][sideIndex * 5 + i],
    label,
    side,
    color: sideIndex === 0 ? '#c7ff4d' : '#a99bff',
    description: [
      'Power the wing down; match the opposite wing to resist rolling.',
      'Recover the wing upward; combine with power for a full wingbeat.',
      'Rotate the wing forward to turn lift into thrust.',
      'Rotate the wing back to brake and lift the nose.',
      'Extend the stroke arc for more lift, at a higher fatigue cost.',
    ][i],
  })),
);
export const RINGS = [
  [0, 5, 18], [0, 5, 38], [2.5, 6, 60], [-2, 5, 84],
  [3, 7, 108], [0, 6, 134], [-3, 5, 162], [0, 5, 192],
].map(([x, y, z], i) => ({ x, y, z, radius: i < 2 ? 4.2 : 2.7 }));
export interface Vector { x: number; y: number; z: number }
export interface FlightState {
  position: Vector; velocity: Vector; angularVelocity: Vector;
  roll: number; pitch: number; yaw: number; elapsed: number; checkpoint: number;
  finished: boolean; crashed: boolean; fatigue: number[]; muscle: number[];
  distance: number; stability: number;
}
export function createFlightState(): FlightState {
  return { position: { x: 0, y: 5, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 }, roll: 0, pitch: 0, yaw: 0,
    elapsed: 0, checkpoint: 0, finished: false, crashed: false,
    fatigue: Array(10).fill(0), muscle: Array(10).fill(0), distance: 0, stability: 1 };
}
const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
export function stepFlight(s: FlightState, activations: number[], delta: number): FlightState {
  if (s.finished || s.crashed || !Number.isFinite(delta) || delta <= 0) return s;
  // Fixed maximum substeps keep collisions and integration stable after frame stalls.
  let remaining = Math.min(delta, .25);
  while (remaining > 1e-8 && !s.crashed && !s.finished) {
    const dt = Math.min(remaining, 1 / 120); remaining -= dt;
    const old = { ...s.position };
    s.elapsed += dt;
    for (let i = 0; i < 10; i++) {
      const a = clamp(Number.isFinite(activations[i]) ? activations[i] : 0, 0, 1);
      s.fatigue[i] = clamp(s.fatigue[i] + dt * (a * .085 - (1 - a) * .16), 0, .8);
      s.muscle[i] += (a * (1 - .38 * s.fatigue[i]) - s.muscle[i]) * (1 - Math.exp(-dt * 13));
    }
    const m = s.muscle;
    const wing = (i: number) => (m[i] * .73 + Math.sqrt(m[i] * m[i + 1]) * .47) * (1 + m[i + 4] * .32);
    const left = wing(0), right = wing(5);
    const lift = (left + right) * 7.7;
    const twist = (m[2] + m[7] - m[3] - m[8]) * .5;
    const av = s.angularVelocity;
    av.z += ((left - right) * 2.5 - s.roll * .75 - av.z * 2.8) * dt;
    av.x += (twist * .95 - s.pitch * 1.5 - av.x * 2.8) * dt;
    av.y += (((m[2] - m[3]) - (m[7] - m[8])) * .8 - av.y * 2.5) * dt;
    s.roll = clamp(s.roll + av.z * dt, -1.45, 1.45);
    s.pitch = clamp(s.pitch + av.x * dt, -.8, .8);
    s.yaw = clamp(s.yaw + av.y * dt, -1.2, 1.2);
    const thrust = (left + right) * (1.6 + Math.max(-.65, twist) * 3.5);
    s.velocity.x += (Math.sin(s.roll) * lift * .60 + Math.sin(s.yaw) * thrust - s.velocity.x * .9) * dt;
    s.velocity.y += (Math.cos(s.roll) * Math.cos(s.pitch) * lift - 9.81 - s.velocity.y * 1.6) * dt;
    s.velocity.z += (Math.cos(s.yaw) * thrust - s.velocity.z * .40) * dt;
    for (const k of ['x', 'y', 'z'] as const) s.position[k] += s.velocity[k] * dt;
    s.distance = Math.max(s.distance, s.position.z);
    s.stability = clamp(1 - Math.abs(s.roll) / 1.3 - Math.abs(s.pitch) / 2, 0, 1);
    const ring = RINGS[s.checkpoint];
    if (ring && old.z <= ring.z && s.position.z >= ring.z) {
      const t = (ring.z - old.z) / Math.max(1e-8, s.position.z - old.z);
      const x = old.x + (s.position.x - old.x) * t;
      const y = old.y + (s.position.y - old.y) * t;
      if (Math.hypot(x - ring.x, y - ring.y) < ring.radius) s.checkpoint++;
      else s.crashed = true;
      if (s.checkpoint === RINGS.length) s.finished = true;
    }
    if (s.position.y < .45 || s.position.y > 32 || Math.abs(s.position.x) > 24) s.crashed = true;
    s.position.y = Math.max(.45, s.position.y);
  }
  return s;
}
