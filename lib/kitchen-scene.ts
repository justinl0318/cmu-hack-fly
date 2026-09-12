import * as THREE from 'three';
import { FINISH_Z, HAZARDS, FOOD, courseX, hazardActive } from './kitchen';

/** Original procedural props: no external models, textures or licensing dependencies. */
export function buildKitchen(scene: THREE.Scene) {
  const materials = new Map<string, THREE.MeshStandardMaterial>();
  const mat = (color: string) => {
    if (!materials.has(color))
      materials.set(
        color,
        new THREE.MeshStandardMaterial({ color, roughness: 0.65 }),
      );
    return materials.get(color)!;
  };
  const mesh = (
    geometry: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = scene,
  ) => {
    const m = new THREE.Mesh(geometry, mat(color));
    m.position.set(x + (parent === scene ? courseX(z) : 0), y, z);
    parent.add(m);
    return m;
  };
  const box = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    parent: THREE.Object3D = scene,
  ) => mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, parent);
  const sphere = (
    x: number,
    y: number,
    z: number,
    r: number,
    color: string,
    parent: THREE.Object3D = scene,
  ) => mesh(new THREE.SphereGeometry(r, 20, 12), color, x, y, z, parent);
  const cylinder = (
    x: number,
    y: number,
    z: number,
    top: number,
    bottom: number,
    h: number,
    color: string,
  ) => mesh(new THREE.CylinderGeometry(top, bottom, h, 32), color, x, y, z);
  const label = (
    text: string,
    x: number,
    y: number,
    z: number,
    color = '#254449',
  ) => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff9e9';
    ctx.beginPath();
    ctx.roundRect(0, 0, 768, 128, 32);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 384, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, depthTest: true }),
    );
    sprite.position.set(x, y, z);
    sprite.scale.set(12, 2, 1);
    scene.add(sprite);
    return sprite;
  };
  const logoTexture = new THREE.TextureLoader().load('/cmu-logo.png');
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  const logoMaterial = new THREE.MeshBasicMaterial({
    map: logoTexture,
    side: THREE.DoubleSide,
  });
  // Stickers sit on props; the kitchen palette and floating-label policy stay intact.
  for (const [x, z] of [
    [-11, 28],
    [11, 226],
  ]) {
    const sticker = new THREE.Mesh(
      new THREE.CylinderGeometry(
        4.015,
        4.015,
        3.2,
        32,
        1,
        true,
        Math.PI - 0.4,
        0.8,
      ),
      logoMaterial,
    );
    sticker.position.set(x + courseX(z), 5.3, z);
    scene.add(sticker);
  }
  for (const [x, z] of [
    [11, 97],
    [-12, 312],
  ]) {
    const sticker = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 2.3),
      logoMaterial,
    );
    sticker.rotation.y = Math.PI;
    sticker.position.set(x + courseX(z), 6.1, z - 2.94);
    scene.add(sticker);
  }
  const boardSticker = new THREE.Mesh(
    new THREE.PlaneGeometry(3, 3),
    logoMaterial,
  );
  boardSticker.rotation.x = -Math.PI / 2;
  boardSticker.position.set(courseX(178.5), 4.81, 178.5);
  scene.add(boardSticker);
  const roadVertices: number[] = [],
    roadIndices: number[] = [];
  for (let i = 0; i <= FINISH_Z + 28; i++) {
    const z = i - 10;
    roadVertices.push(courseX(z) - 24, 0, z, courseX(z) + 24, 0, z);
    if (i < FINISH_Z + 28) {
      const k = i * 2;
      roadIndices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const road = new THREE.BufferGeometry();
  road.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(roadVertices, 3),
  );
  road.setIndex(roadIndices);
  road.computeVertexNormals();
  mesh(road, '#edc38c', 0, -0.03, 0);
  for (let z = -8; z < FINISH_Z + 18; z += 2)
    for (const x of [-24, 24]) {
      const curb = box(
        x,
        0.55,
        z,
        1,
        1.1,
        2.2,
        Math.floor(z / 2) % 2 ? '#f58f78' : '#fff5d8',
      );
      curb.rotation.y = Math.atan2(courseX(z + 1) - courseX(z - 1), 2);
    }

  // Pale tiles and wooden counter edges establish human-scale surroundings.
  box(0, 16, FINISH_Z + 19, 58, 34, 2, '#cae5d6');
  for (let x = -28; x <= 28; x += 7)
    box(x, 16, FINISH_Z + 17.9, 0.08, 34, 0.05, '#f8f4da');
  for (let y = 0; y < 34; y += 6)
    box(0, y, FINISH_Z + 17.8, 58, 0.08, 0.05, '#f8f4da');

  for (let z = -4; z < FINISH_Z; z += 4) {
    for (const x of [-4, 4]) box(x, 0.025, z, 0.16, 0.05, 1.8, '#4ba994');
    if (z % 12 === 8) {
      const arrow = mesh(
        new THREE.ConeGeometry(0.65, 1.6, 3),
        '#fff8dc',
        0,
        0.07,
        z,
      );
      arrow.rotation.x = Math.PI / 2;
      arrow.scale.z = 0.06;
    }
    for (const x of [-21, 21]) box(x, 0.03, z, 0.2, 0.06, 2, '#fff0cc');
  }
  cylinder(-11, 5, 28, 4, 3.7, 10, '#3d9ddb');
  cylinder(-11, 10.03, 28, 3.55, 3.55, 0.08, '#56392f');
  const rim = mesh(
    new THREE.TorusGeometry(3.8, 0.25, 10, 40),
    '#bceafa',
    -11,
    10.1,
    28,
  );
  rim.rotation.x = Math.PI / 2;
  const handle = mesh(
    new THREE.TorusGeometry(2.5, 0.65, 12, 32),
    '#3d9ddb',
    -16,
    5.5,
    28,
  );
  handle.rotation.y = Math.PI / 2;
  // Jam toast, readable as a golden slice with a raspberry-colored center.
  box(10, 0.45, 47, 8, 0.9, 8, '#b76c35');
  box(10, 0.95, 47, 7.4, 0.2, 7.4, '#ffe1a0');
  box(10, 1.12, 47, 6.3, 0.15, 6.3, '#ce4175');
  // A wedge of pizza on a large white plate.
  cylinder(-11, 0.2, 72, 6.2, 6.2, 0.4, '#fff9e9');
  const shape = new THREE.Shape();
  shape.moveTo(-4, -3);
  shape.lineTo(4, -3);
  shape.lineTo(0, 5);
  shape.closePath();
  const slice = mesh(
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.6,
      bevelEnabled: true,
      bevelSize: 0.15,
      bevelThickness: 0.15,
      bevelSegments: 2,
      steps: 1,
    }),
    '#ffc857',
    -11,
    1,
    72,
  );
  slice.rotation.x = Math.PI / 2;
  box(-11, 1.1, 69, 8.2, 0.9, 1, '#da8e41');
  for (const [x, z] of [
    [-13, 71],
    [-10, 71],
    [-11, 74],
  ])
    cylinder(x, 1.1, z, 0.8, 0.8, 0.15, '#ce503c');
  for (let i = 0; i < 15; i++)
    box(-5 + Math.sin(i * 8) * 3, 0.2, 70 + i * 0.7, 0.35, 0.4, 0.3, '#ed9e43');
  cylinder(11, 6, 97, 2.6, 3, 12, '#ec5544');
  cylinder(11, 13, 97, 1.1, 2.6, 2, '#ec5544');
  cylinder(11, 15, 97, 1.2, 1.2, 2, '#fff1d8');
  box(11, 7, 94.25, 3.8, 4.5, 0.15, '#fff4d8');
  // Raised fruit bowl, with readable citrus and strawberry silhouettes.
  cylinder(-12, 1.6, 121, 5, 3.4, 3.2, '#86bea0');
  for (const [x, y, z, color] of [
    [-14, 4, 120, '#ffae39'],
    [-10, 4.5, 122, '#f07857'],
    [-12, 5, 118, '#b2cf56'],
  ] as const) {
    sphere(x, y, z, 2.2, color);
    const leaf = sphere(x + 0.4, y + 2, z, 0.6, '#4d9964');
    leaf.scale.set(1.5, 0.2, 0.6);
  }
  for (let i = 0; i < 6; i++) {
    const fruit = sphere(
      -5 + i * 0.8,
      0.45,
      116 + i * 1.7,
      0.55,
      i % 2 ? '#f8855c' : '#ffce61',
    );
    fruit.scale.y = 0.55;
  }
  // Sink inset: walkable dark lower surface visually reads as a basin, not a void.
  box(-10, 0.05, 156, 15, 0.1, 19, '#799fa8');
  for (const x of [-18, -2]) box(x, 0.5, 156, 1, 1, 21, '#c7e0de');
  for (const z of [146, 166]) box(-10, 0.5, z, 16, 1, 1, '#c7e0de');
  cylinder(-10, 0.16, 157, 1.5, 1.5, 0.15, '#435b64');
  const tap = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-17 + courseX(165), 0, 165),
    new THREE.Vector3(-17 + courseX(165), 12, 165),
    new THREE.Vector3(-10 + courseX(163), 12, 163),
    new THREE.Vector3(-10 + courseX(160), 8, 160),
  ]);
  mesh(new THREE.TubeGeometry(tap, 32, 0.65, 12, false), '#d6e8e2', 0, 0, 0);
  box(12, 1, 151, 7, 2, 5, '#ffda61');
  box(12, 2.2, 151, 7, 0.5, 5, '#67ab85');
  // Elevated dishes provide a low fly-through tunnel with an upper route.
  for (const z of [175, 182]) {
    for (const x of [-13, 13]) box(x, 2, z, 0.8, 4, 0.8, '#d99e77');
  }
  box(0, 4.4, 178.5, 28, 0.8, 9, '#f5dcc1');
  cylinder(-10, 5.1, 179, 3.8, 3.8, 0.55, '#fffdf0');
  cylinder(10, 5.1, 179, 3.8, 3.8, 0.55, '#fffdf0');
  // The extension keeps the same kitchen objects, colors and generous fly-through lanes.
  cylinder(11, 5, 226, 4, 3.7, 10, '#3d9ddb');
  cylinder(11, 10.03, 226, 3.55, 3.55, 0.08, '#56392f');
  const secondHandle = mesh(
    new THREE.TorusGeometry(2.5, 0.65, 12, 32),
    '#3d9ddb',
    16,
    5.5,
    226,
  );
  secondHandle.rotation.y = Math.PI / 2;
  box(-11, 0.45, 253, 8, 0.9, 8, '#b76c35');
  box(-11, 0.95, 253, 7.4, 0.2, 7.4, '#ffe1a0');
  box(-11, 1.12, 253, 6.3, 0.15, 6.3, '#ce4175');
  cylinder(12, 1.6, 281, 5, 3.4, 3.2, '#86bea0');
  for (const [x, z, color] of [
    [10, 280, '#ffae39'],
    [14, 282, '#f07857'],
    [12, 278, '#b2cf56'],
  ] as const)
    sphere(x, 4.8, z, 2.2, color);
  cylinder(-12, 6, 312, 2.6, 3, 12, '#ec5544');
  cylinder(-12, 13, 312, 1.1, 2.6, 2, '#ec5544');
  cylinder(-12, 15, 312, 1.2, 1.2, 2, '#fff1d8');
  box(11, 1, 347, 7, 2, 5, '#ffda61');
  box(11, 2.2, 347, 7, 0.5, 5, '#67ab85');
  for (const z of [241, 268, 297, 335, 367])
    for (const x of [-16, 16]) cylinder(x, 0.22, z, 3.5, 3.5, 0.4, '#fff9e9');
  for (const x of [-22, 22]) box(x, 12, FINISH_Z, 0.6, 24, 0.6, '#438b7b');
  for (let i = 0; i < 22; i++)
    for (let j = 0; j < 2; j++)
      box(
        -21 + i * 2,
        22 + j,
        FINISH_Z,
        2,
        1,
        0.3,
        (i + j) % 2 ? '#fff8e8' : '#344b4e',
      );
  box(0, 0.08, FINISH_Z, 46, 0.1, 1, '#fff8e8');
  label('FINISH · BON APPÉTIT!', 0, 19, FINISH_Z);
  // Clearly marked hazard footprints; timed hazards pulse before activating.
  const zones = HAZARDS.map((h) => {
    const color =
      h.kind === 'jam'
        ? '#d84787'
        : h.kind === 'juice'
          ? '#ffb52e'
          : h.kind === 'swatter'
            ? '#f47858'
            : '#65cbd4';
    const disc = mesh(
      new THREE.CircleGeometry(h.radius, 40),
      color,
      h.x,
      0.12,
      h.z,
    );
    disc.position.x = h.x;
    disc.rotation.x = -Math.PI / 2;
    disc.material = new THREE.MeshStandardMaterial({
      color,
      transparent: true,
      opacity: 0.55,
      roughness: 0.3,
    });
    return disc;
  });
  const fan = new THREE.Group();
  fan.position.set(-19 + courseX(101), 6, 101);
  scene.add(fan);
  const guard = mesh(
    new THREE.TorusGeometry(3.5, 0.25, 8, 32),
    '#71b4bb',
    0,
    0,
    0,
    fan,
  );
  guard.rotation.y = Math.PI / 2;
  const blades = new THREE.Group();
  fan.add(blades);
  for (let i = 0; i < 3; i++) {
    const blade = sphere(0, 0, 0, 1, '#a6dcd8', blades);
    blade.scale.set(0.2, 2.8, 0.7);
    blade.rotation.x = (i * Math.PI) / 3;
  }
  const swatter = new THREE.Group();
  swatter.position.set(5 + courseX(126), 12, 126);
  scene.add(swatter);
  box(0, 0, 0, 6, 0.3, 6, '#ff8065', swatter);
  box(0, 0, 6, 0.45, 0.35, 8, '#f5c265', swatter);
  for (let i = -2; i <= 2; i++) {
    box(i, -0.2, 0, 0.08, 0.1, 5, '#ffe9cf', swatter);
    box(0, -0.2, i, 5, 0.1, 0.08, '#ffe9cf', swatter);
  }
  const drops = Array.from({ length: 14 }, (_, i) => {
    const d = sphere(
      -9 + Math.sin(i * 7) * 4,
      1,
      155 + Math.cos(i * 7) * 4,
      0.22,
      '#83dbea',
    );
    d.scale.y = 1.8;
    return d;
  });
  const snacks = FOOD.map((food) => {
    const fruit = new THREE.Group();
    fruit.position.set(food.x, food.y, food.z);
    scene.add(fruit);
    sphere(0, 0, 0, 0.55, food.id % 2 ? '#ff755c' : '#ffbe37', fruit);
    const leaf = sphere(0.1, 0.55, 0, 0.22, '#41885f', fruit);
    leaf.scale.set(1.5, 0.3, 0.7);
    const halo = mesh(
      new THREE.TorusGeometry(0.85, 0.035, 6, 24),
      '#fff7af',
      0,
      0,
      0,
      fruit,
    );
    halo.rotation.x = Math.PI / 2;
    return fruit;
  });
  return {
    update(elapsed: number, collected: number[] = []) {
      snacks.forEach((fruit, i) => {
        fruit.visible = !collected.includes(i);
        fruit.rotation.y = elapsed * 1.2;
        fruit.position.y = FOOD[i].y + Math.sin(elapsed * 2 + i) * 0.15;
      });
      blades.rotation.x = elapsed * 8;
      swatter.position.y = hazardActive('swatter', elapsed)
        ? 2.5 + Math.abs(Math.sin(elapsed * 7)) * 4
        : 12;
      zones.forEach((zone, i) => {
        (zone.material as THREE.MeshStandardMaterial).opacity = hazardActive(
          HAZARDS[i].kind,
          elapsed,
        )
          ? 0.5 + Math.sin(elapsed * 8) * 0.12
          : 0.18;
      });
      drops.forEach((d, i) => {
        d.visible = hazardActive('splash', elapsed);
        d.position.y = 0.5 + ((elapsed * 7 + i * 0.6) % 8);
      });
    },
    dispose() {
      logoTexture.dispose();
      logoMaterial.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Sprite) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
    },
  };
}
