'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Racer } from '@/lib/battle';
import { trackPoint, FINISH_Z } from '@/lib/kitchen';
import { type FlightState } from '@/lib/simulation';

import { createFly, disposeFly } from '@/lib/fly-model';
import { DEFAULT_LOOK, type FlyLook } from '@/lib/profile';
import { buildKitchen } from '@/lib/kitchen-scene';

export default function RaceView({
  state,
  replay = false,
  opponents = [],
  attackFlash = 0,
  look = DEFAULT_LOOK,
}: {
  state: FlightState;
  replay?: boolean;
  opponents?: Racer[];
  attackFlash?: number;
  look?: FlyLook;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(state);
  const rivals = useRef(opponents);
  useEffect(() => {
    rivals.current = opponents;
  }, [opponents]);
  const attack = useRef(attackFlash);
  useEffect(() => {
    attack.current = attackFlash;
  }, [attackFlash]);
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
    const { fly, wings } = createFly({
      color: look.color,
      hat: look.hat,
      shoes: look.shoes,
    });
    scene.add(fly);
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
    const remote = new Map<string, THREE.Group>();
    const pulses = new Map<string, THREE.Mesh>();
    const showPulse = (
      id: string,
      position: { x: number; y: number; z: number },
      yaw: number,
      flash: number,
    ) => {
      let pulse = pulses.get(id);
      if (!pulse) {
        pulse = new THREE.Mesh(
          new THREE.RingGeometry(0.5, 1, 32, 1, -0.85, 1.7),
          new THREE.MeshBasicMaterial({
            color: '#fff8a0',
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.6,
            depthWrite: false,
          }),
        );
        scene.add(pulse);
        pulses.set(id, pulse);
      }
      pulse.visible = flash > 0;
      pulse.position.set(position.x, position.y, position.z);
      pulse.rotation.set(-Math.PI / 2, 0, Math.PI / 2 - yaw);
      pulse.scale.setScalar(2 + (1 - flash / 0.3) * 6);
    };
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
      showPulse('self', s.position, s.yaw, attack.current);
      const activeIds = new Set(rivals.current.map((p) => p.id));
      for (const [id, model] of remote)
        if (!activeIds.has(id)) {
          model.visible = false;
          const pulse = pulses.get(id);
          if (pulse) pulse.visible = false;
        }
      for (const p of rivals.current) {
        let model = remote.get(p.id);
        if (!model) {
          model = createFly(p.profile.look).fly;
          remote.set(p.id, model);
          scene.add(model);
          model.position.set(
            p.state.position.x,
            p.state.position.y,
            p.state.position.z,
          );
        }
        model.visible = true;
        model.position.lerp(
          new THREE.Vector3(
            p.state.position.x,
            p.state.position.y,
            p.state.position.z,
          ),
          1 - Math.exp(-dt * 18),
        );
        model.rotation.set(
          p.state.pitch,
          p.state.yaw,
          p.state.stunRemaining > 0 ? Math.PI / 2 : -p.state.roll,
          'YXZ',
        );
        const pivots = model.children.filter((c) => c.name.startsWith('wing-'));
        pivots.forEach((pivot, i) => {
          pivot.rotation.z =
            (i === 0 ? 1 : -1) *
            Math.sin(time * 0.08) *
            0.45 *
            (p.state.stunRemaining > 0 ? 0 : 1);
        });
        showPulse(p.id, p.state.position, p.state.yaw, p.attackFlash);
      }
      shadow.position.set(s.position.x, 0.015, s.position.z);
      shadow.scale.setScalar(1 + s.position.y * 0.08);
      cameraTarget.set(
        s.position.x - Math.sin(s.yaw) * 10.5,
        s.position.y + 3.1,
        s.position.z - Math.cos(s.yaw) * 10.5,
      );
      if (snapCamera.current || Math.abs(s.elapsed - previousElapsed) > 1) {
        camera.position.copy(cameraTarget);
        snapCamera.current = false;
      } else camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 4));
      previousElapsed = s.elapsed;
      target.set(
        s.position.x + Math.sin(s.yaw) * 5,
        s.position.y + 0.1,
        s.position.z + Math.cos(s.yaw) * 8,
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
      for (const model of remote.values()) disposeFly(model);
      kitchen.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [look.color, look.hat, look.shoes]);
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
      <svg
        aria-label="Circuit overview: start and finish share one line"
        viewBox="-35 -115 245 230"
        style={{
          position: 'absolute',
          right: 12,
          bottom: 12,
          width: 130,
          height: 125,
          background: '#18251ecc',
          borderRadius: 12,
          pointerEvents: 'none',
        }}
      >
        <path
          d={Array.from({ length: 129 }, (_, i) => {
            const p = trackPoint((i / 128) * FINISH_Z);
            return `${i ? 'L' : 'M'} ${p.x} ${-p.z}`;
          }).join(' ')}
          fill="none"
          stroke="#add6b8"
          strokeWidth={8}
        />
        <path d="M -10 0 L 10 0" stroke="white" strokeWidth={5} />
        {opponents.map((p) => (
          <circle
            key={p.id}
            cx={p.state.position.x}
            cy={-p.state.position.z}
            r={5}
            fill={p.color}
          />
        ))}
        <circle
          cx={state.position.x}
          cy={-state.position.z}
          r={6}
          fill="#fff"
          stroke="#334235"
          strokeWidth={2}
        />
        <text x={80} y={108} fill="white" textAnchor="middle" fontSize={13}>
          LAP {state.lap} / 1
        </text>
      </svg>
    </div>
  );
}
