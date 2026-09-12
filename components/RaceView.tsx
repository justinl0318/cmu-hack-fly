'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { type FlightState } from '@/lib/simulation';

import { buildKitchen } from '@/lib/kitchen-scene';

export default function RaceView({
  state,
  replay = false,
}: {
  state: FlightState;
  replay?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(state);
  const snapCamera = useRef(true);
  useEffect(() => {
    snapCamera.current = true;
  }, [replay]);
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
    renderer.setClearColor('#f6e6bd');
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    element.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog('#f6e6bd', 65, 190);
    const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 300);
    scene.add(new THREE.HemisphereLight('#fff8e5', '#ad8864', 2.7));
    const light = new THREE.DirectionalLight('#fff0c5', 3);
    light.position.set(-25, 45, -15);
    scene.add(light);
    const kitchen = buildKitchen(scene);
    const fly = new THREE.Group();
    scene.add(fly);
    fly.scale.setScalar(1.35);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#97745d',
      roughness: 0.45,
      metalness: 0.05,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: '#60483e',
      roughness: 0.45,
      metalness: 0.05,
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
    const dizzy = new THREE.Group();
    scene.add(dizzy);
    for (let i = 0; i < 5; i++) {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.12),
        new THREE.MeshBasicMaterial({ color: '#ffcf45' }),
      );
      star.position.set(
        Math.cos((i * Math.PI * 2) / 5) * 0.65,
        0,
        Math.sin((i * Math.PI * 2) / 5) * 0.65,
      );
      dizzy.add(star);
    }
    const target = new THREE.Vector3(),
      cameraTarget = new THREE.Vector3();
    let frame = 0;
    let previousTime = 0;
    let previousElapsed = 0;
    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      const s = latest.current;
      const dt = Math.min((time - previousTime) / 1000, 0.05);
      previousTime = time;
      fly.position.set(s.position.x, s.position.y, s.position.z);
      fly.rotation.set(
        s.pitch,
        s.launched ? s.yaw : Math.PI + 0.3,
        s.stunRemaining > 0 ? Math.PI / 2 : -s.roll,
        'YXZ',
      );
      dizzy.visible = s.stunRemaining > 0;
      dizzy.position.set(s.position.x, s.position.y + 1, s.position.z);
      dizzy.rotation.y = s.elapsed * 5;
      for (let i = 0; i < 2; i++) {
        const offset = i * 5;
        const m = s.muscle;
        const power = (m[offset] ?? 0) + (m[offset + 1] ?? 0);
        wings[i].rotation.z =
          (i === 0 ? 1 : -1) *
          (s.stunRemaining > 0 ? 0 : Math.sin(s.elapsed * 80)) *
          (0.12 + power * 0.3 + (m[offset + 4] ?? 0) * 0.3);
        wings[i].rotation.x =
          ((m[offset + 2] ?? 0) - (m[offset + 3] ?? 0)) * 0.5;
      }
      shadow.position.set(s.position.x, 0.015, s.position.z);
      shadow.scale.setScalar(1 + s.position.y * 0.08);
      cameraTarget.set(s.position.x, s.position.y + 3.1, s.position.z - 10.5);
      if (snapCamera.current || Math.abs(s.elapsed - previousElapsed) > 1) {
        camera.position.copy(cameraTarget);
        snapCamera.current = false;
      } else camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 4));
      previousElapsed = s.elapsed;
      target.set(
        s.position.x + Math.sin(s.yaw) * 5,
        s.position.y + 0.1,
        s.position.z + 8,
      );
      camera.lookAt(target);
      kitchen.update(s.elapsed, s.collectedFood);
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
      kitchen.dispose();
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
