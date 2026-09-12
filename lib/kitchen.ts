export const FINISH_Z = 384;
export function courseX(z: number) {
  const t = Math.max(0, Math.min(FINISH_Z / 192, z / 192));
  return 18 * Math.sin(t * Math.PI * 3) * Math.sin(t * Math.PI);
}
export const LOCAL_FOOD = Array.from({ length: 48 }, (_, id) => {
  const z = 12 + id * ((FINISH_Z - 28) / 47);
  return {
    id,
    x: courseX(z) + Math.sin(id * 1.7) * 2.4,
    y: 3.5 + Math.sin(id * 0.6) * 1.2,
    z,
    radius: 1.5,
  };
});
export const LOCAL_PROPS = [
  { kind: 'mug', x: -11, z: 28, radius: 4, height: 10 },
  { kind: 'toast', x: 10, z: 47, radius: 4.5, height: 1.2 },
  { kind: 'pizza', x: -11, z: 72, radius: 6, height: 1 },
  { kind: 'bottle', x: 11, z: 97, radius: 3, height: 16 },
  { kind: 'fruit', x: -12, z: 121, radius: 5, height: 7 },
  { kind: 'sponge', x: 12, z: 151, radius: 4, height: 2.5 },
  { kind: 'mug', x: 11, z: 226, radius: 4, height: 10 },
  { kind: 'toast', x: -11, z: 253, radius: 4.5, height: 1.2 },
  { kind: 'fruit', x: 12, z: 281, radius: 5, height: 7 },
  { kind: 'bottle', x: -12, z: 312, radius: 3, height: 16 },
  { kind: 'sponge', x: 11, z: 347, radius: 4, height: 2.5 },
].map((p) => ({ ...p, x: p.x + courseX(p.z) }));
export const LOCAL_HAZARDS = [
  { kind: 'juice', x: -3, z: 39, radius: 3.5, height: 1.8 },
  { kind: 'jam', x: 10, z: 54, radius: 4, height: 2 },
  { kind: 'fan', x: -9, z: 101, radius: 6, height: 10 },
  { kind: 'swatter', x: 5, z: 126, radius: 4, height: 7 },
  { kind: 'splash', x: -9, z: 155, radius: 6, height: 9 },
].map((p) => ({ ...p, x: p.x + courseX(p.z) }));
export function hazardActive(kind: string, elapsed: number) {
  if (kind === 'swatter') return elapsed % 6 >= 4.5;
  if (kind === 'splash') return elapsed % 5 >= 3.5;
  return true;
}

// Raised board and supports leave a genuine 3.6-unit tunnel underneath.
export const LOCAL_BOXES = [
  { x: 0, y: 4.4, z: 178.5, w: 28, h: 0.8, d: 9 },
  ...[-13, 13].flatMap((x) =>
    [175, 182].map((z) => ({ x, y: 2, z, w: 0.8, h: 4, d: 0.8 })),
  ),
].map((p) => ({ ...p, x: p.x + courseX(p.z) }));

export const LAPS = 1;
export const TRACK_WIDTH = 23;
// Closed, smooth oval with broad alternating bends. Parameter uses the original
// kitchen's longitudinal units so every original prop keeps its place in order.
export function trackPoint(progress: number, lateral = 0) {
  const t = (progress / FINISH_Z) * Math.PI * 2;
  const x = 76 * (1 - Math.cos(t)) + 9 * (1 - Math.cos(3 * t));
  const z = 76 * Math.sin(t) + 9 * Math.sin(2 * t);
  const dx = 76 * Math.sin(t) + 27 * Math.sin(3 * t);
  const dz = 76 * Math.cos(t) + 18 * Math.cos(2 * t);
  const yaw = Math.atan2(dx, dz);
  return {
    x: x + Math.cos(yaw) * lateral,
    z: z - Math.sin(yaw) * lateral,
    yaw,
  };
}
const SAMPLES = 768;
const centerline = Array.from({ length: SAMPLES + 1 }, (_, i) =>
  trackPoint((i / SAMPLES) * FINISH_Z),
);
export function projectTrack(x: number, z: number) {
  let best = Infinity,
    progress = 0,
    px = 0,
    pz = 0,
    yaw = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const a = centerline[i],
      b = centerline[i + 1];
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(
      0,
      Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)),
    );
    const cx = a.x + t * dx,
      cz = a.z + t * dz;
    const d = (x - cx) ** 2 + (z - cz) ** 2;
    if (d < best) {
      best = d;
      progress = ((i + t) / SAMPLES) * FINISH_Z;
      px = cx;
      pz = cz;
      yaw = Math.atan2(dx, dz);
    }
  }
  return {
    progress,
    x: px,
    z: pz,
    yaw,
    lateral: (x - px) * Math.cos(yaw) - (z - pz) * Math.sin(yaw),
    distance: Math.sqrt(best),
  };
}
const world = <T extends { x: number; z: number }>(p: T) => ({
  ...p,
  ...trackPoint(p.z, p.x - courseX(p.z)),
});
export const FOOD = LOCAL_FOOD.map(world);
export const KITCHEN_PROPS = LOCAL_PROPS.map(world);
export const HAZARDS = LOCAL_HAZARDS.map(world);
export const KITCHEN_BOXES = LOCAL_BOXES.map(world);
