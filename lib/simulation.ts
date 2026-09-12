import {
  nearestTrackProjection,
  OPEN_RACER_SECTOR_NAMES,
  type RaceCourse,
} from './openRacerCourse';

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
export interface Vector { x: number; y: number; z: number }
export const RACE_SECTOR_COUNT = OPEN_RACER_SECTOR_NAMES.length;
export interface FlightState {
  position: Vector; velocity: Vector; angularVelocity: Vector;
  roll: number; pitch: number; yaw: number; elapsed: number; checkpoint: number;
  launched: boolean; finished: boolean; crashed: boolean; fatigue: number[]; muscle: number[];
  distance: number; stability: number; wallHits: number;
  groundHeight: number; grounded: boolean;
}
export function createFlightState(): FlightState {
  return { position: { x: 0, y: .95, z: 0 }, velocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 0, z: 0 }, roll: 0, pitch: 0, yaw: 0,
    elapsed: 0, checkpoint: 0, launched: false, finished: false, crashed: false,
    fatigue: Array(10).fill(0), muscle: Array(10).fill(0), distance: 0, stability: 1, wallHits: 0,
    groundHeight: 0, grounded: false };
}
const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
const wrapAngle = (angle: number) => Math.atan2(Math.sin(angle), Math.cos(angle));
export function stepFlight(s: FlightState, activations: number[], delta: number, course?: RaceCourse): FlightState {
  if (s.finished || s.crashed || !Number.isFinite(delta) || delta <= 0) return s;
  // The launch perch is a preparation state, not an airborne hover assist.
  // All four primary wing outputs must fire before the race clock/gravity starts.
  if (!s.launched) {
    if (![0, 1, 5, 6].every(i => Number.isFinite(activations[i]) && activations[i] >= .5)) return s;
    s.launched = true;
    s.muscle = Array.from({ length: 10 }, (_, i) => clamp(activations[i] || 0, 0, 1));
  }
  // Fixed maximum substeps keep collisions and integration stable after frame stalls.
  let remaining = Math.min(delta, .25);
  while (remaining > 1e-8 && !s.crashed && !s.finished) {
    const dt = Math.min(remaining, 1 / 120); remaining -= dt;
    const old = { ...s.position };
    s.elapsed += dt;
    for (let i = 0; i < 10; i++) {
      const a = clamp(Number.isFinite(activations[i]) ? activations[i] : 0, 0, 1);
      s.fatigue[i] = clamp(s.fatigue[i] + dt * (a * .022 - (1 - a) * .09), 0, .8);
      s.muscle[i] += (a * (1 - .25 * s.fatigue[i]) - s.muscle[i]) * (1 - Math.exp(-dt * 13));
    }
    const m = s.muscle;
    const wing = (i: number) => (m[i] * .73 + Math.sqrt(m[i] * m[i + 1]) * .47) * (1 + m[i + 4] * .32);
    const left = wing(0), right = wing(5);
    const lift = (left + right) * 3.9;
    const twist = (m[2] + m[7] - m[3] - m[8]) * .5;
    const av = s.angularVelocity;
    av.z += ((left - right) * 3.2 - s.roll * .75 - av.z * 2.8) * dt;
    av.x += (twist * .95 - s.pitch * 1.5 - av.x * 2.8) * dt;
    // A full circuit needs a full heading range. The previous ±1.2 rad clamp
    // made the fly physically unable to follow the return half of the lap.
    av.y += (((m[2] - m[3]) - (m[7] - m[8])) * 2.35 - av.y * 3.15) * dt;
    s.roll = clamp(s.roll + av.z * dt, -1.45, 1.45);
    s.pitch = clamp(s.pitch + av.x * dt, -.8, .8);
    s.yaw = wrapAngle(s.yaw + av.y * dt);
    const thrust = (left + right) * Math.max(0, 2.3 + Math.max(-.65, twist) * 3.5);
    s.velocity.x += (Math.sin(s.roll) * lift * 1.7 + Math.sin(s.yaw) * thrust - s.velocity.x * .9) * dt;
    s.velocity.y += (Math.cos(s.roll) * Math.cos(s.pitch) * lift - 4.8 - s.velocity.y * 2.8) * dt;
    s.velocity.z += (Math.cos(s.yaw) * thrust - s.velocity.z * .40) * dt;
    for (const k of ['x', 'y', 'z'] as const) s.position[k] += s.velocity[k] * dt;
    s.distance += Math.hypot(s.position.x - old.x, s.position.y - old.y, s.position.z - old.z);
    s.stability = clamp(1 - Math.abs(s.roll) / 1.3 - Math.abs(s.pitch) / 2, 0, 1);
    let groundHeight = Number.isFinite(s.groundHeight) ? s.groundHeight : 0;
    if (course) {
      const road = nearestTrackProjection(course.segments, s.position.x, s.position.z);
      if (road) groundHeight = road.y;
      if (road && road.distance > course.wallRadius) {
        let nx = (s.position.x - road.x) / road.distance;
        let nz = (s.position.z - road.z) / road.distance;
        if (!Number.isFinite(nx) || !Number.isFinite(nz)) {
          const dx = road.segment.b.x - road.segment.a.x;
          const dz = road.segment.b.z - road.segment.a.z;
          const length = Math.hypot(dx, dz) || 1;
          nx = -dz / length; nz = dx / length;
        }
        s.position.x = road.x + nx * course.wallRadius;
        s.position.z = road.z + nz * course.wallRadius;
        const outwardVelocity = s.velocity.x * nx + s.velocity.z * nz;
        if (outwardVelocity > 0) {
          // Tangential velocity survives; only the component into the wall is
          // reflected, making boundary hits feel physical rather than fatal.
          s.velocity.x -= nx * outwardVelocity * 1.72;
          s.velocity.z -= nz * outwardVelocity * 1.72;
        }
        s.velocity.x *= .94;
        s.velocity.z *= .94;
        s.angularVelocity.z *= .72;
        s.wallHits++;
      }
      const activeSector = course.sectors[s.checkpoint];
      const activeProgress = activeSector
        ? nearestTrackProjection(activeSector, s.position.x, s.position.z)
        : null;
      if (s.checkpoint < course.sectors.length - 1) {
        const nextSector = nearestTrackProjection(
          course.sectors[s.checkpoint + 1],
          s.position.x,
          s.position.z,
        );
        // The source road meshes meet with small authored gaps (~1.9 m). A
        // sector advances only after the fly has reached the end of its active
        // ribbon *and* is within the next ribbon's generous join zone. This
        // prevents both false skips at crossings and apparent dead ends.
        if (
          activeProgress && activeProgress.progress > .6 &&
          nextSector && nextSector.distance < course.wallRadius * .82
        ) s.checkpoint++;
      } else if (
        s.elapsed > 2 && activeProgress && activeProgress.progress > .72 &&
        Math.hypot(s.position.x - course.finish.x, s.position.z - course.finish.z) < course.wallRadius * .72
      ) {
        s.finished = true;
      }
    }
    s.groundHeight = groundHeight;
    s.grounded = false;
    // Falling is recoverable in the circuit mode: the ground cushions the fly
    // and the player can rebuild lift instead of being sent to a fail screen.
    const landingHeight = groundHeight + .36;
    if (s.position.y < landingHeight) {
      s.position.y = landingHeight;
      s.velocity.y = Math.max(0, -s.velocity.y * .24);
      s.angularVelocity.x *= .7;
      s.angularVelocity.z *= .7;
      s.grounded = true;
    }
    if (s.position.y > groundHeight + 28) {
      s.position.y = groundHeight + 28;
      s.velocity.y = Math.min(0, s.velocity.y);
    }
  }
  return s;
}
