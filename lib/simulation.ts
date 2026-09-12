import {
  FINISH_Z,
  FOOD,
  courseX,
  KITCHEN_PROPS,
  KITCHEN_BOXES,
  HAZARDS,
  hazardActive,
  // @ts-expect-error Node native tests require an explicit TypeScript extension.
} from './kitchen.ts';
/** Arcade biomechanics: real connectome activity, deliberately invented muscle mapping. */
export const CHANNELS = ['left', 'right'].flatMap((side, sideIndex) =>
  ['Downstroke', 'Upstroke', 'Pronation', 'Supination', 'Stroke extent'].map(
    (label, i) => ({
      id: sideIndex * 5 + i,
      key: ['q', 'w', 'e', 'r', 't', 'a', 's', 'd', 'f', 'g'][
        sideIndex * 5 + i
      ],
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
    }),
  ),
);
export const RINGS = [
  [0, 5, 18],
  [0, 5, 38],
  [2.5, 6, 60],
  [-2, 5, 84],
  [3, 7, 108],
  [0, 6, 134],
  [-3, 5, 162],
  [0, 5, FINISH_Z],
].map(([x, y, z], i) => ({ x, y, z, radius: i < 2 ? 4.2 : 2.7 }));
export interface Vector {
  x: number;
  y: number;
  z: number;
}
export interface FlightState {
  position: Vector;
  velocity: Vector;
  angularVelocity: Vector;
  roll: number;
  pitch: number;
  yaw: number;
  elapsed: number;
  checkpoint: number;
  launched: boolean;
  finished: boolean;
  crashed: boolean;
  stunRemaining: number;
  recoveryRemaining: number;
  fatigue: number[];
  muscle: number[];
  distance: number;
  stability: number;
  boostRemaining: number;
  collectedFood: number[];
}
export function createFlightState(): FlightState {
  return {
    position: { x: 0, y: 5, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 },
    roll: 0,
    pitch: 0,
    yaw: 0,
    elapsed: 0,
    checkpoint: 0,
    launched: false,
    finished: false,
    crashed: false,
    stunRemaining: 0,
    recoveryRemaining: 0,
    fatigue: Array(10).fill(0),
    muscle: Array(10).fill(0),
    distance: 0,
    stability: 1,
    boostRemaining: 0,
    collectedFood: [],
  };
}
const clamp = (v: number, low: number, high: number) =>
  Math.min(high, Math.max(low, v));
/** A hit knocks the fly down; the rest timer starts only after landing. */
function stun(s: FlightState) {
  if (s.stunRemaining > 0 || s.recoveryRemaining > 0) return;
  s.stunRemaining = 1.2;
  s.velocity = { x: 0, y: -8, z: 0 };
  s.angularVelocity = { x: 0, y: 0, z: 0 };
  s.roll = 0;
  s.pitch = 0;
  // Push clear of solid footprints so the fly can rest on the counter.
  for (const prop of KITCHEN_PROPS) {
    const dx = s.position.x - prop.x,
      dz = s.position.z - prop.z;
    const distance = Math.hypot(dx, dz),
      radius = prop.radius + 0.55;
    if (distance < radius) {
      s.position.x = prop.x + (distance > 1e-6 ? dx / distance : 1) * radius;
      s.position.z = prop.z + (distance > 1e-6 ? dz / distance : 0) * radius;
    }
  }
}
export function stepFlight(
  s: FlightState,
  activations: number[],
  delta: number,
): FlightState {
  if (s.finished || s.crashed || !Number.isFinite(delta) || delta <= 0)
    return s;
  // The launch perch is a preparation state, not an airborne hover assist.
  // All four primary wing outputs must fire before the race clock/gravity starts.
  if (!s.launched) {
    if (
      ![0, 1, 5, 6].every(
        (i) => Number.isFinite(activations[i]) && activations[i] >= 0.5,
      )
    )
      return s;
    s.launched = true;
    s.muscle = Array.from({ length: 10 }, (_, i) =>
      clamp(activations[i] || 0, 0, 1),
    );
  }
  // Fixed maximum substeps keep collisions and integration stable after frame stalls.
  let remaining = Math.min(delta, 0.25);
  while (remaining > 1e-8 && !s.crashed && !s.finished) {
    const dt = Math.min(remaining, 1 / 120);
    remaining -= dt;

    s.elapsed += dt;
    s.boostRemaining = Math.max(0, s.boostRemaining - dt);
    if (s.stunRemaining > 0) {
      s.muscle.fill(0);
      s.velocity.y -= 24 * dt;
      s.position.y = Math.max(0.45, s.position.y + s.velocity.y * dt);
      if (s.position.y <= 0.45) {
        s.velocity.y = 0;
        s.stunRemaining = Math.max(0, s.stunRemaining - dt);
        if (s.stunRemaining === 0) s.recoveryRemaining = 2;
      }
      continue;
    }
    s.recoveryRemaining = Math.max(0, s.recoveryRemaining - dt);
    for (let i = 0; i < 10; i++) {
      const a = clamp(
        Number.isFinite(activations[i]) ? activations[i] : 0,
        0,
        1,
      );
      s.fatigue[i] = clamp(
        s.fatigue[i] + dt * (a * 0.022 - (1 - a) * 0.09),
        0,
        0.8,
      );
      s.muscle[i] +=
        (a * (1 - 0.25 * s.fatigue[i]) - s.muscle[i]) *
        (1 - Math.exp(-dt * 13));
    }
    const m = s.muscle;
    const wing = (i: number) =>
      (m[i] * 0.73 + Math.sqrt(m[i] * m[i + 1]) * 0.47) * (1 + m[i + 4] * 0.32);
    const left = wing(0),
      right = wing(5);
    const lift = (left + right) * 3.9;
    const twist = (m[2] + m[7] - m[3] - m[8]) * 0.5;
    const av = s.angularVelocity;
    av.z += ((left - right) * 3.2 - s.roll * 4.5 - av.z * 4.5) * dt;
    av.x += (twist * 0.95 - s.pitch * 1.5 - av.x * 2.8) * dt;
    av.y += ((m[2] - m[3] - (m[7] - m[8])) * 2.2 - av.y * 3.5) * dt;
    s.roll = clamp(s.roll + av.z * dt, -0.65, 0.65);
    s.pitch = clamp(s.pitch + av.x * dt, -0.8, 0.8);
    s.yaw = clamp(s.yaw + av.y * dt, -1.2, 1.2);
    const thrust =
      (left + right) *
      Math.max(0, 1.75 + Math.max(-0.65, twist) * 3.5) *
      (s.boostRemaining > 0 ? 1.7 : 1);
    s.velocity.x +=
      (Math.sin(s.roll) * lift * 1.7 +
        Math.sin(s.yaw) * thrust -
        s.velocity.x * 1.2) *
      dt;
    s.velocity.y +=
      (Math.cos(s.roll) * Math.cos(s.pitch) * lift -
        4.8 -
        Math.max(0, s.position.y - 6) * 0.8 -
        s.velocity.y * 3.8) *
      dt;
    s.velocity.z += (Math.cos(s.yaw) * thrust - s.velocity.z * 0.4) * dt;
    for (const k of ['x', 'y', 'z'] as const)
      s.position[k] += s.velocity[k] * dt;
    s.distance = Math.max(s.distance, s.position.z);
    s.stability = clamp(
      1 - Math.abs(s.roll) / 1.3 - Math.abs(s.pitch) / 2,
      0,
      1,
    );
    // Landmarks measure progress; no mandatory gates or collision deaths.
    s.checkpoint = RINGS.filter((r) => s.position.z >= r.z).length;
    for (const h of HAZARDS) {
      if (
        Math.hypot(s.position.x - h.x, s.position.z - h.z) > h.radius ||
        s.position.y > h.height ||
        !hazardActive(h.kind, s.elapsed)
      )
        continue;
      if (h.kind === 'jam') {
        s.velocity.x *= Math.exp(-dt * 2);
        s.velocity.z *= Math.exp(-dt * 2);
      }
      if (h.kind === 'juice') s.velocity.z += dt * 5;
      if (h.kind === 'fan') {
        s.velocity.x += dt * 5;
        s.velocity.y += dt * 2;
      }
      if (h.kind === 'splash' || h.kind === 'swatter') stun(s);
    }
    if (s.stunRemaining > 0) continue;
    for (const prop of KITCHEN_PROPS) {
      const dx = s.position.x - prop.x,
        dz = s.position.z - prop.z;
      const distance = Math.hypot(dx, dz),
        radius = prop.radius + 0.4;
      if (distance >= radius || s.position.y >= prop.height + 0.45) continue;
      const impact = Math.hypot(s.velocity.x, s.velocity.y, s.velocity.z);
      if (s.position.y > prop.height) {
        s.position.y = prop.height + 0.45;
        s.velocity.y = Math.max(0.6, s.velocity.y);
      } else {
        const nx = distance > 1e-6 ? dx / distance : 1,
          nz = distance > 1e-6 ? dz / distance : 0;
        s.position.x = prop.x + nx * radius;
        s.position.z = prop.z + nz * radius;
        const inward = s.velocity.x * nx + s.velocity.z * nz;
        if (inward < 0) {
          s.velocity.x -= inward * 1.3 * nx;
          s.velocity.z -= inward * 1.3 * nz;
        }
      }
      if (impact > 0.5) stun(s);
    }
    if (s.stunRemaining > 0) continue;
    for (const box of KITCHEN_BOXES) {
      const offsets = {
        x: s.position.x - box.x,
        y: s.position.y - box.y,
        z: s.position.z - box.z,
      };
      const penetration = {
        x: box.w / 2 + 0.4 - Math.abs(offsets.x),
        y: box.h / 2 + 0.4 - Math.abs(offsets.y),
        z: box.d / 2 + 0.4 - Math.abs(offsets.z),
      };
      if (penetration.x <= 0 || penetration.y <= 0 || penetration.z <= 0)
        continue;
      const axis =
        penetration.x < penetration.y && penetration.x < penetration.z
          ? 'x'
          : penetration.y < penetration.z
            ? 'y'
            : 'z';
      const sign = offsets[axis] >= 0 ? 1 : -1;
      s.position[axis] += sign * penetration[axis];
      if (s.velocity[axis] * sign < 0) {
        const impact = Math.abs(s.velocity[axis]);
        s.velocity[axis] *= -0.3;
        if (impact > 0.5) stun(s);
      }
    }
    if (s.stunRemaining > 0) continue;
    for (const [axis, low, high] of [
      ['x', courseX(s.position.z) - 23, courseX(s.position.z) + 23],
      ['y', 0.45, 24],
      ['z', -5, FINISH_Z + 2],
    ] as const) {
      if (s.position[axis] < low) {
        if (axis !== 'y') stun(s);
        s.position[axis] = low;
        s.velocity[axis] = Math.abs(s.velocity[axis]) * 0.3;
      }
      if (s.position[axis] > high) {
        stun(s);
        s.position[axis] = high;
        s.velocity[axis] = -Math.abs(s.velocity[axis]) * 0.3;
      }
    }
    if (s.stunRemaining === 0)
      for (const food of FOOD) {
        if (
          !s.collectedFood.includes(food.id) &&
          Math.hypot(
            s.position.x - food.x,
            s.position.y - food.y,
            s.position.z - food.z,
          ) < food.radius
        ) {
          s.collectedFood.push(food.id);
          s.boostRemaining = 2.5;
        }
      }
    if (s.stunRemaining === 0 && s.position.z >= FINISH_Z) {
      s.finished = true;
      s.checkpoint = RINGS.length;
    }
  }
  return s;
}
