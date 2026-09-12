export const FINISH_Z = 384;
export function courseX(z: number) {
  const t = Math.max(0, Math.min(FINISH_Z / 192, z / 192));
  return 18 * Math.sin(t * Math.PI * 3) * Math.sin(t * Math.PI);
}
export const FOOD = Array.from({ length: 48 }, (_, id) => {
  const z = 12 + id * ((FINISH_Z - 28) / 47);
  return {
    id,
    x: courseX(z) + Math.sin(id * 1.7) * 2.4,
    y: 3.5 + Math.sin(id * 0.6) * 1.2,
    z,
    radius: 1.5,
  };
});
export const KITCHEN_PROPS = [
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
export const HAZARDS = [
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
export const KITCHEN_BOXES = [
  { x: 0, y: 4.4, z: 178.5, w: 28, h: 0.8, d: 9 },
  ...[-13, 13].flatMap((x) =>
    [175, 182].map((z) => ({ x, y: 2, z, w: 0.8, h: 4, d: 0.8 })),
  ),
].map((p) => ({ ...p, x: p.x + courseX(p.z) }));
