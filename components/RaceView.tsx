'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RINGS, type FlightState } from '@/lib/simulation';

export default function RaceView({ state }: { state: FlightState }) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(state);
  useEffect(() => {
    latest.current = state;
  }, [state]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      queueMicrotask(() => setError('WebGL is unavailable on this device.'));
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor('#0b1517');
    element.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2('#0b1517', 0.022);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 250);
    scene.add(new THREE.HemisphereLight('#d6f3ed', '#25302b', 2.5));
    const light = new THREE.DirectionalLight('#d6ff6b', 3);
    light.position.set(-8, 15, -5);
    scene.add(light);
    const grid = new THREE.GridHelper(360, 120, '#3a5550', '#203432');
    grid.position.z = 110;
    scene.add(grid);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(360, 360),
      new THREE.MeshStandardMaterial({ color: '#0b1718', roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.03, 110);
    scene.add(ground);
    const ringMeshes: THREE.Mesh[] = [];
    for (let i = 0; i < RINGS.length; i++) {
      const r = RINGS[i];
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r.radius, 0.065, 10, 96),
        new THREE.MeshBasicMaterial({ color: '#d6ff6b' }),
      );
      ring.position.set(r.x, r.y, r.z);
      scene.add(ring);
      ringMeshes.push(ring);
      const outer = new THREE.Mesh(
        new THREE.TorusGeometry(r.radius + 0.2, 0.016, 6, 96),
        new THREE.MeshBasicMaterial({
          color: '#718962',
          transparent: true,
          opacity: 0.45,
        }),
      );
      outer.position.copy(ring.position);
      scene.add(outer);
      const plinth = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, r.y - r.radius, 8),
        new THREE.MeshBasicMaterial({ color: '#617b63' }),
      );
      plinth.position.set(r.x, (r.y - r.radius) / 2, r.z);
      scene.add(plinth);
    }
    // Course markers and blocks provide depth and speed cues without obscuring flight.
    const markerGeo = new THREE.BoxGeometry(0.08, 0.06, 1.4),
      markerMat = new THREE.MeshBasicMaterial({ color: '#547471' });
    for (let z = -10; z < 220; z += 4) {
      for (const x of [-7, 7]) {
        const marker = new THREE.Mesh(markerGeo, markerMat);
        marker.position.set(x, 0.03, z);
        scene.add(marker);
      }
    }
    const fly = new THREE.Group();
    scene.add(fly);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#798e85',
      roughness: 0.45,
      metalness: 0.35,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: '#293b38',
      roughness: 0.45,
      metalness: 0.25,
    });
    const ellipsoid = (
      scale: [number, number, number],
      position: [number, number, number],
      material: THREE.Material,
    ) => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 16),
        material,
      );
      mesh.scale.set(...scale);
      mesh.position.set(...position);
      fly.add(mesh);
      return mesh;
    };
    ellipsoid([0.24, 0.23, 0.34], [0, 0, 0], bodyMat);
    ellipsoid([0.19, 0.18, 0.38], [0, -0.04, -0.46], darkMat);
    ellipsoid([0.23, 0.2, 0.2], [0, 0.04, 0.35], darkMat);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: '#c49d68',
      metalness: 0.35,
      roughness: 0.25,
    });
    ellipsoid([0.09, 0.13, 0.12], [-0.18, 0.09, 0.39], eyeMat);
    ellipsoid([0.09, 0.13, 0.12], [0.18, 0.09, 0.39], eyeMat);
    const wingMat = new THREE.MeshPhysicalMaterial({
      color: '#c7e6dc',
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
      wings.push(pivot);
      for (let j = 0; j < 3; j++) {
        const path = [
          new THREE.Vector3(sign * 0.13, -0.1, 0.2 - j * 0.22),
          new THREE.Vector3(sign * 0.36, -0.35, 0.15 - j * 0.28),
          new THREE.Vector3(sign * 0.5, -0.43, 0.28 - j * 0.35),
        ];
        const leg = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(path),
          new THREE.LineBasicMaterial({ color: '#92a79e' }),
        );
        fly.add(leg);
      }
    }
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 32),
      new THREE.MeshBasicMaterial({
        color: '#000000',
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.015;
    scene.add(shadow);
    const target = new THREE.Vector3(),
      cameraTarget = new THREE.Vector3();
    let frame = 0;
    let previousTime = 0;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      const s = latest.current;
      const dt = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      fly.position.set(s.position.x, s.position.y, s.position.z);
      fly.rotation.set(s.pitch, s.yaw, -s.roll, 'YXZ');
      for (let i = 0; i < 2; i++) {
        const offset = i * 5;
        const m = s.muscle;
        const power = (m[offset] ?? 0) + (m[offset + 1] ?? 0);
        wings[i].rotation.z =
          (i === 0 ? 1 : -1) *
          Math.sin(s.elapsed * 80) *
          (0.12 + power * 0.3 + (m[offset + 4] ?? 0) * 0.3);
        wings[i].rotation.x =
          ((m[offset + 2] ?? 0) - (m[offset + 3] ?? 0)) * 0.5;
      }
      shadow.position.set(s.position.x, 0.015, s.position.z);
      shadow.scale.setScalar(1 + s.position.y * 0.08);
      cameraTarget.set(
        s.position.x * 0.7,
        s.position.y + 3.1,
        s.position.z - 10.5,
      );
      if (time < 100) camera.position.copy(cameraTarget);
      else camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 4));
      target.set(s.position.x * 0.8, s.position.y + 0.1, s.position.z + 8);
      camera.lookAt(target);
      for (let i = 0; i < ringMeshes.length; i++) {
        (ringMeshes[i].material as THREE.MeshBasicMaterial).color.set(
          i < s.checkpoint
            ? '#365854'
            : i === s.checkpoint
              ? '#d6ff6b'
              : '#6c9690',
        );
      }
      renderer.render(scene, camera);
    };
    camera.position.set(0, 8, -10.5);
    const resize = () => {
      renderer.setSize(element.clientWidth, element.clientHeight, false);
      camera.aspect = element.clientWidth / Math.max(element.clientHeight, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            m.dispose(),
          );
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div
      ref={host}
      style={{
        width: '100%',
        height: '100%',
        minHeight: 300,
        position: 'relative',
      }}
    >
      {error && <p style={{ padding: 24, color: '#d6ff6b' }}>{error}</p>}
    </div>
  );
}
