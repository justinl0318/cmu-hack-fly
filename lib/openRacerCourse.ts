/**
 * Runtime interpretation of the GPLv3 OpenRacer circuit data.  The source
 * scene is old Three.js JSON, so this module keeps the course math independent
 * from the renderer and lets the flight simulator use the very same road data.
 */

export type OpenRacerMesh = { vertices: number[]; tris?: number[]; uv1?: number[] };
export type OpenRacerCircuit = Record<string, OpenRacerMesh>;
export type OpenRacerTransform = {
  uid?: number;
  name: string;
  parent?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  renderer?: string;
  mesh?: string;
};
export type OpenRacerScene = { transforms: OpenRacerTransform[] };

export type TrackPoint = { x: number; y?: number; z: number; width: number };
export type TrackSegment = {
  a: TrackPoint;
  b: TrackPoint;
  sector: number;
};
export type TrackProjection = {
  segment: TrackSegment;
  x: number;
  y: number;
  z: number;
  distance: number;
  progress: number;
};
export type RaceCourse = {
  sectors: TrackSegment[][];
  segments: TrackSegment[];
  wallRadius: number;
  start: TrackPoint;
  finish: TrackPoint;
  finishDirection: { x: number; z: number };
};

export const OPEN_RACER_SCALE = .16;
// The original circuit begins at r9, close to this source-space position.
// Rotating its opening tangent toward +Z preserves the fly's natural launch.
export const OPEN_RACER_SOURCE_START = { x: 1.821, y: .058, z: 3.927 };
export const OPEN_RACER_YAW = -1.504;
// Preserve the complete OpenRacer lap. The rendered lane treatment below
// makes every turn and the r0 return leg explicit for aerial navigation.
export const OPEN_RACER_SECTOR_NAMES = ['r9', 'r8', 'r7', 'r6', 'r5', 'r4', 'r3', 'r2', 'r1', 'r0'] as const;

const cosYaw = Math.cos(OPEN_RACER_YAW);
const sinYaw = Math.sin(OPEN_RACER_YAW);

export function transformOpenRacerPoint(x: number, z: number) {
  const localX = x - OPEN_RACER_SOURCE_START.x;
  const localZ = z - OPEN_RACER_SOURCE_START.z;
  return {
    x: (cosYaw * localX + sinYaw * localZ) * OPEN_RACER_SCALE,
    z: (-sinYaw * localX + cosYaw * localZ) * OPEN_RACER_SCALE,
  };
}

/** OpenRacer's world transform only rotates around Y, so height is scaled directly. */
export function transformOpenRacerHeight(y: number) {
  return (y - OPEN_RACER_SOURCE_START.y) * OPEN_RACER_SCALE;
}

function pointDistance(a: TrackPoint, b: TrackPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Build road capsules from OpenRacer's paired ribbon vertices. */
export function createOpenRacerCourse(circuit: OpenRacerCircuit, scene: OpenRacerScene): RaceCourse {
  const transforms = new Map(scene.transforms.map((transform) => [transform.name, transform]));
  const sectors: TrackSegment[][] = [];
  for (let sector = 0; sector < OPEN_RACER_SECTOR_NAMES.length; sector++) {
    const name = OPEN_RACER_SECTOR_NAMES[sector];
    const mesh = circuit[name];
    const transform = transforms.get(name);
    if (!mesh || !transform) throw Error(`OpenRacer sector ${name} is missing.`);
    const [offsetX = 0, offsetY = 0, offsetZ = 0] = transform.position ?? [];
    const nodes: TrackPoint[] = [];
    for (let i = 0; i + 5 < mesh.vertices.length; i += 6) {
      const ax = mesh.vertices[i] + offsetX;
      const ay = mesh.vertices[i + 1] + offsetY;
      const az = mesh.vertices[i + 2] + offsetZ;
      const bx = mesh.vertices[i + 3] + offsetX;
      const by = mesh.vertices[i + 4] + offsetY;
      const bz = mesh.vertices[i + 5] + offsetZ;
      const centre = transformOpenRacerPoint((ax + bx) / 2, (az + bz) / 2);
      const width = Math.max(.28, Math.hypot(ax - bx, az - bz) * OPEN_RACER_SCALE / 2);
      const node = { ...centre, y: transformOpenRacerHeight((ay + by) / 2), width };
      if (!nodes.length || pointDistance(nodes.at(-1)!, node) > .008) nodes.push(node);
    }
    const segments: TrackSegment[] = [];
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1], b = nodes[i];
      // A mesh may pack disconnected road strips together. Do not create a
      // phantom shortcut between those strips just because their arrays meet.
      if (pointDistance(a, b) > .025 && pointDistance(a, b) < 1.6) {
        segments.push({ a, b, sector });
      }
    }
    if (!segments.length) throw Error(`OpenRacer sector ${name} contains no road ribbon.`);
    sectors.push(segments);
  }
  const all = sectors.flat();
  const first = sectors[0][0];
  const last = sectors.at(-1)!.at(-1)!;
  const dx = last.b.x - last.a.x;
  const dz = last.b.z - last.a.z;
  const length = Math.hypot(dx, dz) || 1;
  return {
    sectors,
    segments: all,
    // The visual asphalt is narrow at this scale. The wall defines a forgiving
    // aerial lane centred on it, not a thin line that a fly cannot occupy.
    wallRadius: 2.75,
    start: first.a,
    finish: last.b,
    finishDirection: { x: dx / length, z: dz / length },
  };
}

export function nearestTrackProjection(segments: TrackSegment[], x: number, z: number): TrackProjection | null {
  let closest: TrackProjection | null = null;
  for (const segment of segments) {
    const dx = segment.b.x - segment.a.x;
    const dz = segment.b.z - segment.a.z;
    const lengthSquared = dx * dx + dz * dz;
    const progress = lengthSquared < 1e-8 ? 0 : Math.max(0, Math.min(1, ((x - segment.a.x) * dx + (z - segment.a.z) * dz) / lengthSquared));
    const hitX = segment.a.x + dx * progress;
    const hitY = (segment.a.y ?? 0) + ((segment.b.y ?? 0) - (segment.a.y ?? 0)) * progress;
    const hitZ = segment.a.z + dz * progress;
    const distance = Math.hypot(x - hitX, z - hitZ);
    if (!closest || distance < closest.distance) closest = { segment, x: hitX, y: hitY, z: hitZ, distance, progress };
  }
  return closest;
}

/**
 * A point ahead of the fly on the ordered road ribbon.
 *
 * Returning the nearest segment endpoint made the old demo target flip from
 * one end of a segment to the other midway through it. More importantly, it
 * gave it no warning before a corner. This walks forward through the actual
 * OpenRacer ribbon, so a controller can line up for the next bend instead of
 * discovering it at the invisible wall.
 */
export function getCourseTarget(
  course: RaceCourse,
  x: number,
  z: number,
  checkpoint: number,
  lookAhead = 3,
) {
  const sectorIndex = Math.min(Math.max(0, checkpoint), course.sectors.length - 1);
  const sector = course.sectors[sectorIndex] ?? course.segments;
  const nearest = nearestTrackProjection(sector, x, z);
  if (!nearest) return { x: course.finish.x, z: course.finish.z };

  let segmentIndex = course.segments.indexOf(nearest.segment);
  if (segmentIndex < 0) return { x: nearest.segment.b.x, z: nearest.segment.b.z };
  let segment = nearest.segment;
  let progress = nearest.progress;
  let remaining = Math.max(.5, lookAhead);

  // Each road mesh sector is an ordered ribbon. At a sector boundary continue
  // to the next one, but never wrap a finished lap back to the starting grid.
  while (segmentIndex < course.segments.length) {
    const dx = segment.b.x - segment.a.x;
    const dz = segment.b.z - segment.a.z;
    const length = Math.hypot(dx, dz);
    const available = length * (1 - progress);
    if (length > 1e-8 && remaining <= available) {
      const nextProgress = progress + remaining / length;
      return {
        x: segment.a.x + dx * nextProgress,
        z: segment.a.z + dz * nextProgress,
      };
    }
    remaining -= available;
    segmentIndex++;
    if (segmentIndex >= course.segments.length) break;
    segment = course.segments[segmentIndex];
    progress = 0;
  }
  return { x: course.finish.x, z: course.finish.z };
}
