import * as THREE from 'three';
import { DEFAULT_LOOK, type FlyLook } from './profile';
export function createFly(look: FlyLook = DEFAULT_LOOK) {
  const fly = new THREE.Group();
  fly.scale.setScalar(1.35);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: look.color,
    roughness: 0.45,
    metalness: 0.05,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(look.color).multiplyScalar(0.55),
    roughness: 0.45,
    metalness: 0.05,
  });
  const ellipsoid = (
    scale: [number, number, number],
    position: [number, number, number],
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), material);
    mesh.scale.set(...scale);
    mesh.position.set(...position);
    fly.add(mesh);
    return mesh;
  };
  ellipsoid([0.24, 0.23, 0.34], [0, 0, 0], bodyMat);
  ellipsoid([0.19, 0.18, 0.38], [0, -0.04, -0.46], darkMat);
  ellipsoid([0.29, 0.25, 0.24], [0, 0.06, 0.35], bodyMat);
  const eyeMat = new THREE.MeshStandardMaterial({
    color: '#ee493f',
    metalness: 0.05,
    roughness: 0.25,
  });
  ellipsoid([0.17, 0.21, 0.17], [-0.21, 0.12, 0.46], eyeMat);
  ellipsoid([0.17, 0.21, 0.17], [0.21, 0.12, 0.46], eyeMat);
  const glintMat = new THREE.MeshBasicMaterial({ color: '#fff9eb' });
  for (const sign of [-1, 1]) {
    ellipsoid([0.05, 0.065, 0.025], [sign * 0.25, 0.21, 0.6], glintMat);
    const antenna = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.018, 0.17, 4, 8),
      darkMat,
    );
    antenna.position.set(sign * 0.13, 0.32, 0.4);
    antenna.rotation.z = -sign * 0.35;
    fly.add(antenna);
    ellipsoid([0.035, 0.035, 0.035], [sign * 0.16, 0.42, 0.4], bodyMat);
  }
  const wingMat = new THREE.MeshPhysicalMaterial({
    color: '#fff1d9',
    transparent: true,
    opacity: 0.48,
    side: THREE.DoubleSide,
    roughness: 0.25,
    metalness: 0.05,
  });
  const wings: THREE.Group[] = [];
  for (const sign of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sign * 0.17, 0.12, 0.02);
    fly.add(pivot);
    const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), wingMat);
    wing.scale.set(0.73, 0.012, 0.27);
    wing.position.set(sign * 0.65, 0, -0.12);
    wing.rotation.y = sign * 0.23;
    pivot.add(wing);
    pivot.name = `wing-${wings.length}`;
    wings.push(pivot);
    for (let j = 0; j < 3; j++) {
      const path = [
        new THREE.Vector3(sign * 0.13, -0.1, 0.2 - j * 0.22),
        new THREE.Vector3(sign * 0.36, -0.35, 0.15 - j * 0.28),
        new THREE.Vector3(sign * 0.5, -0.43, 0.28 - j * 0.35),
      ];
      const leg = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(path),
          8,
          0.025,
          6,
          false,
        ),
        darkMat,
      );
      fly.add(leg);
    }
  }

  const accessoryMat = new THREE.MeshStandardMaterial({
    color: look.hat === 'crown' ? '#ffd669' : look.color,
    roughness: 0.4,
  });
  const add = (
    geometry: THREE.BufferGeometry,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
  ) => {
    const m = new THREE.Mesh(geometry, mat);
    m.position.set(x, y, z);
    fly.add(m);
    return m;
  };
  if (look.hat === 'cap') {
    add(
      new THREE.SphereGeometry(0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      accessoryMat,
      0,
      0.3,
      0.35,
    );
    const brim = add(
      new THREE.SphereGeometry(1, 16, 8),
      accessoryMat,
      0,
      0.32,
      0.62,
    );
    brim.scale.set(0.29, 0.025, 0.2);
  }
  if (look.hat === 'crown') {
    add(
      new THREE.CylinderGeometry(0.24, 0.24, 0.13, 12, 1, true),
      accessoryMat,
      0,
      0.4,
      0.35,
    );
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      add(
        new THREE.ConeGeometry(0.075, 0.2, 4),
        accessoryMat,
        Math.cos(angle) * 0.2,
        0.54,
        0.35 + Math.sin(angle) * 0.2,
      );
    }
  }
  if (look.hat === 'wizard') {
    add(
      new THREE.CylinderGeometry(0.36, 0.36, 0.04, 24),
      accessoryMat,
      0,
      0.35,
      0.35,
    );
    add(new THREE.ConeGeometry(0.24, 0.65, 24), accessoryMat, 0, 0.66, 0.35);
    add(new THREE.OctahedronGeometry(0.07), glintMat, 0, 0.64, 0.54);
  }
  if (look.shoes !== 'none')
    for (const sign of [-1, 1])
      for (let j = 0; j < 3; j++) {
        const shoe = add(
          new THREE.SphereGeometry(1, 16, 10),
          accessoryMat,
          sign * 0.5,
          -0.43,
          0.28 - j * 0.35,
        );
        shoe.scale.set(0.1, look.shoes === 'boots' ? 0.13 : 0.065, 0.14);
        const sole = add(
          new THREE.BoxGeometry(0.19, 0.035, 0.25),
          glintMat,
          sign * 0.5,
          -0.5,
          0.28 - j * 0.35,
        );
        sole.rotation.y = sign * 0.12;
      }
  return { fly, wings };
}
export function disposeFly(fly: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  fly.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
        materials.add(m),
      );
    }
  });
  materials.forEach((m) => m.dispose());
}
export function flyPortrait(look: FlyLook, size = 400): string {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(size, size);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#fff9ed', '#7a626b', 3));
  const light = new THREE.DirectionalLight('#fff6dc', 3);
  light.position.set(-2, 4, 4);
  scene.add(light);
  const { fly, wings } = createFly(look);
  scene.add(fly);
  wings[0].rotation.z = 0.18;
  wings[1].rotation.z = -0.18;
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 20);
  camera.position.set(3.6, 2.3, 6);
  camera.lookAt(0, 0.2, 0);
  try {
    renderer.render(scene, camera);
    return renderer.domElement.toDataURL('image/png');
  } finally {
    disposeFly(fly);
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
