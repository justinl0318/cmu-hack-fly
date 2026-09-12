'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  createOpenRacerCourse,
  OPEN_RACER_SCALE,
  OPEN_RACER_SOURCE_START,
  OPEN_RACER_YAW,
  type OpenRacerCircuit,
  type OpenRacerScene,
  type RaceCourse,
} from '@/lib/openRacerCourse';
import type { FlightState } from '@/lib/simulation';

type SourceMaterial = {
  colorTexture?: string;
  textureTile?: [number, number];
  textureOffset?: [number, number];
  shininess?: number;
};
type SourceScene = OpenRacerScene & {
  textures: Record<string, { file: string }>;
  materials: Record<string, SourceMaterial>;
};

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const AVAILABLE_TEXTURES = new Set([
  'grass512.jpg', 'fence512.png', 'buildings512.jpg', 'path_tile256.jpg',
  'sky1024.jpg', 'road512.jpg', 'road-bump512.jpg', 'ground2048.jpg',
  'track_tile256.jpg', 'horizon512.png', 'alpha1024.png', 'atlas1024.jpg',
]);
const NON_ROUTE_SCENE_MESHES = new Set(['path_tile', 'road_tile', 'track_tile']);

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, position?: THREE.Vector3, scale?: [number, number, number]) {
  const result = new THREE.Mesh(geometry, material);
  if (position) result.position.copy(position);
  if (scale) result.scale.set(...scale);
  result.castShadow = true;
  result.receiveShadow = true;
  parent.add(result);
  return result;
}

function flyModel(scene: THREE.Scene) {
  const fly = new THREE.Group();
  // The real-scale OpenRacer track is broad, so the fly reads as a small,
  // friendly racer rather than a giant insect laid over the asphalt.
  fly.scale.setScalar(.58);
  scene.add(fly);
  const thorax = new THREE.MeshStandardMaterial({ color: '#4a403d', roughness: .63, metalness: .05 });
  const abdomen = new THREE.MeshStandardMaterial({ color: '#c88d50', roughness: .64, metalness: .02 });
  const head = new THREE.MeshStandardMaterial({ color: '#5a4a43', roughness: .6 });
  const antenna = new THREE.MeshStandardMaterial({ color: '#74594a', roughness: .68 });
  const eye = new THREE.MeshPhysicalMaterial({ color: '#922e3f', emissive: '#3d0d1c', emissiveIntensity: .3, roughness: .19, metalness: .08, clearcoat: .62 });
  const glint = new THREE.MeshStandardMaterial({ color: '#fff8e9', emissive: '#fff3df', emissiveIntensity: .6, roughness: .3 });
  const wing = new THREE.MeshPhysicalMaterial({ color: '#c8edf2', transparent: true, opacity: .52, roughness: .1, metalness: .04, side: THREE.DoubleSide, depthWrite: false });
  const wingEdge = new THREE.MeshStandardMaterial({ color: '#9ebeb8', emissive: '#4e7772', emissiveIntensity: .12, roughness: .4 });
  const legMaterial = new THREE.MeshStandardMaterial({ color: '#5e5049', roughness: .78, metalness: .01 });
  const oval = (scale: [number, number, number], at: [number, number, number], material: THREE.Material) =>
    mesh(fly, new THREE.SphereGeometry(1, 20, 14), material, new THREE.Vector3(...at), scale);
  oval([.62, .51, .64], [0, .03, -.02], thorax);
  oval([.68, .57, .95], [0, -.04, -.72], abdomen);
  oval([.61, .53, .52], [0, .08, .58], head);
  for (const side of [-1, 1]) {
    oval([.34, .4, .31], [side * .4, .13, .67], eye);
    mesh(fly, new THREE.SphereGeometry(.065, 10, 8), glint, new THREE.Vector3(side * .48, .28, .88));
    const feeler = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(side * .17, .48, .78), new THREE.Vector3(side * .35, .76, 1.02)]),
      new THREE.LineBasicMaterial({ color: '#74594a' }),
    );
    fly.add(feeler);
    mesh(fly, new THREE.SphereGeometry(.07, 10, 8), antenna, new THREE.Vector3(side * .35, .76, 1.02));
  }
  const wings: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * .25, .22, -.02);
    fly.add(pivot);
    const surface = mesh(pivot, new THREE.SphereGeometry(1, 16, 10), wing, new THREE.Vector3(side * .72, .02, .04), [.82, .028, .42]);
    surface.rotation.y = side * .18;
    const outline = mesh(pivot, new THREE.TorusGeometry(.47, .025, 6, 24), wingEdge, new THREE.Vector3(side * .71, .02, .04), [1.45, .08, 1]);
    outline.rotation.x = Math.PI / 2;
    wings.push(pivot);
  }
  // Six short, rounded legs keep the silhouette friendly rather than insect-
  // realistic. They remain still until a dedicated leg-neuron pathway exists.
  for (const side of [-1, 1]) {
    [-.43, -.02, .38].forEach((z) => {
      const rig = new THREE.Group();
      rig.position.set(side * .31, -.18, z);
      fly.add(rig);
      const upper = new THREE.Group();
      upper.rotation.z = side * .62;
      rig.add(upper);
      mesh(upper, new THREE.CylinderGeometry(.042, .052, .32, 8), legMaterial, new THREE.Vector3(0, -.16, 0));
      const lower = new THREE.Group();
      lower.position.set(side * .18, -.28, .03);
      lower.rotation.z = -side * .74;
      upper.add(lower);
      mesh(lower, new THREE.CylinderGeometry(.032, .043, .27, 8), legMaterial, new THREE.Vector3(0, -.135, .055));
      mesh(lower, new THREE.SphereGeometry(.065, 8, 6), legMaterial, new THREE.Vector3(side * .1, -.27, .12), [1.2, .62, 1.45]);
    });
  }
  return { fly, wings };
}

function rootTransform(root: THREE.Group) {
  root.scale.setScalar(OPEN_RACER_SCALE);
  root.rotation.y = OPEN_RACER_YAW;
  const sourceStart = new THREE.Vector3(OPEN_RACER_SOURCE_START.x, OPEN_RACER_SOURCE_START.y, OPEN_RACER_SOURCE_START.z)
    .multiplyScalar(OPEN_RACER_SCALE)
    .applyAxisAngle(UP, OPEN_RACER_YAW);
  root.position.copy(sourceStart.multiplyScalar(-1));
}

function addOpenRacerScene(scene: THREE.Scene, circuit: OpenRacerCircuit, source: SourceScene) {
  const track = new THREE.Group();
  track.name = 'OpenRacer GPLv3 circuit';
  rootTransform(track);
  scene.add(track);

  const textureLoader = new THREE.TextureLoader();
  const textures = new Map<string, THREE.Texture>();
  const textureFor = (name?: string, bump = false) => {
    if (!name || textures.has(`${name}:${bump}`)) return name ? textures.get(`${name}:${bump}`) : undefined;
    const file = source.textures[name]?.file;
    if (!file || !AVAILABLE_TEXTURES.has(file)) return undefined;
    const texture = textureLoader.load(`/assets/openracer/images/${file}`);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    if (!bump) texture.colorSpace = THREE.SRGBColorSpace;
    textures.set(`${name}:${bump}`, texture);
    return texture;
  };
  const materials = new Map<string, THREE.Material>();
  const materialFor = (name: string) => {
    const cached = materials.get(name);
    if (cached) return cached;
    const sourceMaterial = source.materials[name] ?? {};
    const textureName = sourceMaterial.colorTexture;
    const colorMap = textureFor(textureName);
    const isRoad = textureName === 'road';
    const isAlpha = name === 'alpha_mat' || textureName === 'alpha';
    const material = new THREE.MeshStandardMaterial({
      color: colorMap ? '#ffffff' : isRoad ? '#25282c' : '#6e7a63',
      map: colorMap,
      bumpMap: isRoad ? textureFor('road-bump', true) : undefined,
      bumpScale: isRoad ? .16 : 0,
      roughness: isRoad ? .52 : .82,
      metalness: isRoad ? .08 : 0,
      transparent: isAlpha,
      opacity: isAlpha ? .92 : 1,
      side: isAlpha ? THREE.DoubleSide : THREE.FrontSide,
      depthWrite: !isAlpha,
    });
    if (colorMap && sourceMaterial.textureTile) colorMap.repeat.set(...sourceMaterial.textureTile);
    if (colorMap && sourceMaterial.textureOffset) colorMap.offset.set(...sourceMaterial.textureOffset);
    materials.set(name, material);
    return material;
  };

  const nodes = new Map<number, THREE.Group>();
  for (const transform of source.transforms) {
    // OpenRacer's source fences are scenery-only meshes. In a flying game they
    // read as solid cross-track walls while the flight physics (correctly)
    // does not collide with them, so omit them rather than present a fake
    // obstacle. The coloured lane rails below are the visible physical edge.
    // These three giant tile meshes form OpenRacer's auxiliary elevated road
    // layers. They are not part of r0–r9 (the course used by our physics), so
    // a fly could otherwise pass below them and mistake an overpass for a
    // broken, non-colliding road boundary.
    if (
      transform.renderer === 'fence_mat' ||
      (transform.mesh && NON_ROUTE_SCENE_MESHES.has(transform.mesh))
    ) continue;
    const node = new THREE.Group();
    node.name = transform.name;
    node.position.fromArray(transform.position ?? [0, 0, 0]);
    node.rotation.fromArray(transform.rotation ?? [0, 0, 0]);
    if (transform.uid !== undefined) nodes.set(transform.uid, node);
    if (transform.mesh && transform.renderer) {
      const raw = circuit[transform.mesh];
      if (raw?.vertices?.length && raw.tris?.length) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(raw.vertices, 3));
        geometry.setIndex(raw.tris);
        if (raw.uv1?.length === raw.vertices.length / 3 * 2) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(raw.uv1, 2));
        geometry.computeVertexNormals();
        geometry.computeBoundingSphere();
        const object = mesh(node, geometry, materialFor(transform.renderer));
        object.castShadow = false;
      }
    }
  }
  for (const transform of source.transforms) {
    const node = transform.uid === undefined ? undefined : nodes.get(transform.uid);
    if (!node) continue;
    const parent = transform.parent === undefined ? undefined : nodes.get(transform.parent);
    (parent ?? track).add(node);
  }
  return track;
}

/** Visible counterparts to the simulator's invisible corridor walls. */
function addRouteGuidance(scene: THREE.Scene, course: RaceCourse) {
  const guide = new THREE.Group();
  guide.name = 'closed circuit flight lane guides';
  scene.add(guide);
  const sectorColors = [
    new THREE.Color('#9ff05e'), new THREE.Color('#52e2ff'),
    new THREE.Color('#ba9cff'), new THREE.Color('#ff9f5a'),
    new THREE.Color('#ffcf5b'), new THREE.Color('#ff7da9'),
    new THREE.Color('#92d86c'), new THREE.Color('#64a8ff'),
    new THREE.Color('#d7a2ff'), new THREE.Color('#7ee4b2'),
  ];

  const railMaterial = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#8f8f8f',
    emissiveIntensity: .9,
    roughness: .32,
    metalness: .18,
  });
  const railGeometry = new THREE.BoxGeometry(.12, .28, 1);
  const rails = new THREE.InstancedMesh(
    railGeometry,
    railMaterial,
    course.segments.length * 2,
  );
  rails.name = 'visible flight lane boundaries';
  rails.castShadow = false;
  rails.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  let railIndex = 0;
  for (const segment of course.segments) {
    const dx = segment.b.x - segment.a.x;
    const dz = segment.b.z - segment.a.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-5) continue;
    const normalX = -dz / length;
    const normalZ = dx / length;
    rotation.setFromEuler(new THREE.Euler(0, Math.atan2(dx, dz), 0));
    for (const side of [-1, 1]) {
      position.set(
        (segment.a.x + segment.b.x) / 2 + normalX * course.wallRadius * side,
        ((segment.a.y ?? 0) + (segment.b.y ?? 0)) / 2 + .13,
        (segment.a.z + segment.b.z) / 2 + normalZ * course.wallRadius * side,
      );
      scale.set(1, 1, length + .035);
      matrix.compose(position, rotation, scale);
      rails.setMatrixAt(railIndex++, matrix);
      rails.setColorAt(railIndex - 1, sectorColors[segment.sector % sectorColors.length]);
    }
  }
  rails.count = railIndex;
  rails.instanceMatrix.needsUpdate = true;
  if (rails.instanceColor) rails.instanceColor.needsUpdate = true;
  guide.add(rails);

  // A sparse, colour-matched centre line points forward through the scenery.
  // It makes the approaching bend visible well before a fly reaches it.
  const stride = Math.max(16, Math.floor(course.segments.length / 44));
  const dashCount = Math.ceil(course.segments.length / stride);
  const dashes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(.2, .035, .9),
    new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#7b7b7b',
      emissiveIntensity: .95,
      roughness: .36,
    }),
    dashCount,
  );
  dashes.name = 'forward route markers';
  dashes.castShadow = false;
  let dashIndex = 0;
  for (let i = Math.floor(stride / 2); i < course.segments.length; i += stride) {
    const segment = course.segments[i];
    const dx = segment.b.x - segment.a.x;
    const dz = segment.b.z - segment.a.z;
    if (Math.hypot(dx, dz) < 1e-5) continue;
    position.set(
      (segment.a.x + segment.b.x) / 2,
      ((segment.a.y ?? 0) + (segment.b.y ?? 0)) / 2 + .055,
      (segment.a.z + segment.b.z) / 2,
    );
    rotation.setFromEuler(new THREE.Euler(0, Math.atan2(dx, dz), 0));
    scale.set(1, 1, 1);
    matrix.compose(position, rotation, scale);
    dashes.setMatrixAt(dashIndex++, matrix);
    dashes.setColorAt(dashIndex - 1, sectorColors[segment.sector % sectorColors.length]);
  }
  dashes.count = dashIndex;
  dashes.instanceMatrix.needsUpdate = true;
  if (dashes.instanceColor) dashes.instanceColor.needsUpdate = true;
  guide.add(dashes);

  // Large flat arrows are deliberately sparse: at speed they make the
  // direction through sharp curves unambiguous without turning the circuit
  // into a tunnel of gates.
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(0, .62);
  arrowShape.lineTo(-.38, .08);
  arrowShape.lineTo(-.16, .08);
  arrowShape.lineTo(-.16, -.54);
  arrowShape.lineTo(.16, -.54);
  arrowShape.lineTo(.16, .08);
  arrowShape.lineTo(.38, .08);
  arrowShape.closePath();
  const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
  arrowGeometry.rotateX(Math.PI / 2);
  const arrowStride = Math.max(30, Math.floor(course.segments.length / 34));
  const arrows = new THREE.InstancedMesh(
    arrowGeometry,
    new THREE.MeshStandardMaterial({
      color: '#ffffff', emissive: '#777777', emissiveIntensity: 1.1,
      roughness: .28, metalness: .08, side: THREE.DoubleSide,
    }),
    Math.ceil(course.segments.length / arrowStride),
  );
  arrows.name = 'turn direction arrows';
  arrows.castShadow = false;
  let arrowIndex = 0;
  for (let i = arrowStride; i < course.segments.length; i += arrowStride) {
    const segment = course.segments[i];
    const dx = segment.b.x - segment.a.x;
    const dz = segment.b.z - segment.a.z;
    if (Math.hypot(dx, dz) < 1e-5) continue;
    position.set(
      (segment.a.x + segment.b.x) / 2,
      ((segment.a.y ?? 0) + (segment.b.y ?? 0)) / 2 + .085,
      (segment.a.z + segment.b.z) / 2,
    );
    rotation.setFromEuler(new THREE.Euler(0, Math.atan2(dx, dz), 0));
    scale.set(1, 1, 1);
    matrix.compose(position, rotation, scale);
    arrows.setMatrixAt(arrowIndex++, matrix);
    arrows.setColorAt(arrowIndex - 1, sectorColors[segment.sector % sectorColors.length]);
  }
  arrows.count = arrowIndex;
  arrows.instanceMatrix.needsUpdate = true;
  if (arrows.instanceColor) arrows.instanceColor.needsUpdate = true;
  guide.add(arrows);
}

function addFinishLine(scene: THREE.Scene, course: RaceCourse) {
  const line = new THREE.Group();
  line.name = 'start-finish line';
  line.position.set(course.finish.x, (course.finish.y ?? 0) + .08, course.finish.z);
  line.rotation.y = Math.atan2(course.finishDirection.x, course.finishDirection.z);
  scene.add(line);
  const pale = new THREE.MeshStandardMaterial({ color: '#f4eee3', roughness: .7 });
  const dark = new THREE.MeshStandardMaterial({ color: '#1a2226', roughness: .7 });
  for (let row = 0; row < 2; row++) for (let col = 0; col < 10; col++) {
    mesh(line, new THREE.BoxGeometry(.55, .035, .42), (row + col) % 2 ? pale : dark, new THREE.Vector3((col - 4.5) * .55, 0, (row - .5) * .42));
  }
  const marker = new THREE.MeshStandardMaterial({ color: '#f4f1d8', emissive: '#d7b942', emissiveIntensity: .7, roughness: .45 });
  for (const side of [-1, 1]) {
    mesh(line, new THREE.CylinderGeometry(.09, .13, 2.8, 8), marker, new THREE.Vector3(side * 2.95, 1.4, 0));
    mesh(line, new THREE.SphereGeometry(.16, 10, 8), marker, new THREE.Vector3(side * 2.95, 2.83, 0));
  }
  mesh(line, new THREE.BoxGeometry(6.05, .16, .18), marker, new THREE.Vector3(0, 2.72, 0));
}

function disposeScene(scene: THREE.Scene) {
  const textures = new Set<THREE.Texture>();
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
      object.geometry.dispose();
      const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of objectMaterials) {
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
        material.dispose();
      }
    }
  });
  textures.forEach((texture) => texture.dispose());
}

export default function RaceView({ state, onCourseReady }: { state: FlightState; onCourseReady?: (course: RaceCourse) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(state);
  const callback = useRef(onCourseReady);
  const [error, setError] = useState('');
  useEffect(() => { latest.current = state; }, [state]);
  useEffect(() => { callback.current = onCourseReady; }, [onCourseReady]);

  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); }
    catch { queueMicrotask(() => setError('WebGL is unavailable on this device.')); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    element.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#7898ad');
    scene.fog = new THREE.FogExp2('#7793a1', .012);
    const camera = new THREE.PerspectiveCamera(58, 1, .1, 260);
    scene.add(new THREE.HemisphereLight('#d9ebff', '#25331e', 1.9));
    const sun = new THREE.DirectionalLight('#fff0d4', 3.4);
    sun.position.set(-25, 44, -20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
    scene.add(sun);
    const world = new THREE.Group();
    scene.add(world);
    const { fly, wings } = flyModel(scene);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(.58, 24), new THREE.MeshBasicMaterial({ color: '#101613', transparent: true, opacity: .24, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    scene.add(shadow);

    let live = true;
    let track: THREE.Group | undefined;
    void Promise.all([
      fetch('/assets/openracer/circuit.json').then((response) => response.ok ? response.json() as Promise<OpenRacerCircuit> : Promise.reject(Error('OpenRacer circuit data is unavailable.'))),
      fetch('/assets/openracer/circuitScene.json').then((response) => response.ok ? response.json() as Promise<SourceScene> : Promise.reject(Error('OpenRacer scene data is unavailable.'))),
    ]).then(([circuit, source]) => {
      if (!live) return;
      const course = createOpenRacerCourse(circuit, source);
      track = addOpenRacerScene(scene, circuit, source);
      addRouteGuidance(scene, course);
      addFinishLine(scene, course);
      callback.current?.(course);
    }).catch((reason: unknown) => {
      if (live) setError(reason instanceof Error ? reason.message : 'The OpenRacer circuit could not load.');
    });

    const cameraTarget = new THREE.Vector3();
    const lookAt = new THREE.Vector3();
    const smoothLookAt = new THREE.Vector3();
    let request = 0;
    let previous = 0;
    const draw = (time: number) => {
      request = requestAnimationFrame(draw);
      const s = latest.current;
      const dt = Math.min((time - previous) / 1000, .05);
      previous = time;
      fly.position.set(s.position.x, s.position.y, s.position.z);
      fly.rotation.set(s.pitch, s.yaw, -s.roll, 'YXZ');
      for (let i = 0; i < 2; i++) {
        const offset = i * 5;
        const power = (s.muscle[offset] ?? 0) + (s.muscle[offset + 1] ?? 0);
        // No decorative idle flapping: every visible wing movement is
        // proportional to the motor-neuron output for that wing.
        wings[i].rotation.z = (i ? -1 : 1) * Math.sin(s.elapsed * 82) * (power * .28 + (s.muscle[offset + 4] ?? 0) * .24);
        wings[i].rotation.x = ((s.muscle[offset + 2] ?? 0) - (s.muscle[offset + 3] ?? 0)) * .45;
      }
      const groundHeight = s.groundHeight ?? 0;
      shadow.position.set(s.position.x, groundHeight + .025, s.position.z);
      const flightHeight = Math.max(0, s.position.y - groundHeight);
      shadow.scale.setScalar(.55 + flightHeight * .055);
      (shadow.material as THREE.MeshBasicMaterial).opacity = Math.max(.045, .24 - flightHeight * .012);
      const direction = FORWARD.clone().applyEuler(fly.rotation).normalize();
      cameraTarget.set(s.position.x - direction.x * 8.2, s.position.y + 3.2, s.position.z - direction.z * 8.2);
      lookAt.set(s.position.x + direction.x * 7.4, s.position.y + .15, s.position.z + direction.z * 7.4);
      if (time < 100) { camera.position.copy(cameraTarget); smoothLookAt.copy(lookAt); }
      else { camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 4)); smoothLookAt.lerp(lookAt, 1 - Math.exp(-dt * 3.3)); }
      camera.lookAt(smoothLookAt);
      renderer.render(scene, camera);
    };
    const resize = () => {
      renderer.setSize(element.clientWidth, element.clientHeight, false);
      camera.aspect = element.clientWidth / Math.max(element.clientHeight, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    request = requestAnimationFrame(draw);
    return () => {
      live = false;
      cancelAnimationFrame(request);
      observer.disconnect();
      if (track) track.removeFromParent();
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div ref={host} style={{ width: '100%', height: '100%', minHeight: 300, position: 'relative' }}>{error && <p style={{ padding: 24, color: '#f5e9ad' }}>{error}</p>}</div>;
}
