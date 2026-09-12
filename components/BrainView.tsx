'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const COLORS = [
  '#d6ff6b',
  '#9deba5',
  '#58d9c7',
  '#6dccf0',
  '#96b7ff',
  '#bc9afb',
  '#ea9bdb',
  '#ffaf97',
  '#efca80',
  '#d5e895',
];
type Props = {
  circuit: any;
  spikes: string[];
  activations: number[];
  replay?: boolean;
};
export default function BrainView(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  useEffect(() => {
    if (!container.current || !props.circuit) return;
    const host = container.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setError('WebGL is unavailable. Neural simulation is still active.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.style.cssText =
      'width:100%;height:100%;display:block;touch-action:none';
    const scene = new THREE.Scene();
    const root = new THREE.Group();
    scene.add(root);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
    camera.position.set(0, 0.15, 4.4);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 1.5;
    controls.maxDistance = 9;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    const neurons = props.circuit.neurons ?? [];
    const bounds = new THREE.Box3();
    const raw: {
      id: string;
      label: string;
      channel: number;
      segments: number[];
      samples: THREE.Vector3[];
    }[] = [];
    for (let n = 0; n < neurons.length; n++) {
      const neuron = neurons[n];
      const points = neuron.nodes ?? neuron.points ?? neuron.skeleton ?? [];
      const indexed = new Map<number, THREE.Vector3>();
      const samples: THREE.Vector3[] = [];
      for (let j = 0; j < points.length; j++) {
        const p = points[j];
        const pos = Array.isArray(p)
          ? new THREE.Vector3(
              p.length >= 7 ? p[2] : p[0],
              p.length >= 7 ? p[3] : p[1],
              p.length >= 7 ? p[4] : p[2],
            )
          : new THREE.Vector3(p.x, p.y, p.z);
        if (!Number.isFinite(pos.x + pos.y + pos.z)) continue;
        indexed.set(
          Array.isArray(p) && p.length >= 7 ? p[0] : (p.id ?? j),
          pos,
        );
        samples.push(pos);
        bounds.expandByPoint(pos);
      }
      const segments: number[] = [];
      if (neuron.segments)
        for (const seg of neuron.segments) {
          if (Array.isArray(seg) && seg.length === 6) segments.push(...seg);
          else if (Array.isArray(seg) && seg.length === 2) {
            const a = indexed.get(seg[0]),
              b = indexed.get(seg[1]);
            if (a && b) segments.push(...a.toArray(), ...b.toArray());
          }
        }
      else
        for (let j = 0; j < points.length; j++) {
          const p = points[j];
          const id = Array.isArray(p) && p.length >= 7 ? p[0] : (p.id ?? j);
          const parent =
            Array.isArray(p) && p.length >= 7
              ? p[6]
              : (p.parent ?? p.parentId ?? -1);
          const a = indexed.get(id),
            b = indexed.get(parent);
          if (a && b) segments.push(...a.toArray(), ...b.toArray());
        }
      // Follow a connected path through the actual morphology rather than point-file order.
      let travel = samples;
      if (neuron.segments?.length && neuron.segments[0].length === 2) {
        const graph = new Map<number, number[]>();
        for (const [a, b] of neuron.segments) {
          graph.set(a, [...(graph.get(a) ?? []), b]);
          graph.set(b, [...(graph.get(b) ?? []), a]);
        }
        const walk = (start: number) => {
          const parents = new Map<number, number>([[start, -1]]),
            queue = [start];
          for (let q = 0; q < queue.length; q++)
            for (const next of graph.get(queue[q]) ?? [])
              if (!parents.has(next)) {
                parents.set(next, queue[q]);
                queue.push(next);
              }
          return { last: queue[queue.length - 1], parents };
        };
        const start = graph.keys().next().value;
        if (start !== undefined) {
          const first = walk(start);
          const second = walk(first.last);
          const path: THREE.Vector3[] = [];
          let current = second.last;
          while (current !== -1) {
            const p = indexed.get(current);
            if (p) path.push(p);
            current = second.parents.get(current) ?? -1;
          }
          if (path.length > 1) travel = path;
        }
      }
      raw.push({
        id: String(neuron.id ?? neuron.bodyId ?? n),
        label:
          neuron.name ?? neuron.label ?? neuron.type ?? String(neuron.id ?? n),
        channel:
          neuron.channel ??
          Math.max(
            0,
            (props.circuit.channels ?? []).findIndex((c: any) =>
              (
                c.pathIds ?? [...(c.inputIds ?? []), ...(c.outputIds ?? [])]
              ).includes(String(neuron.id)),
            ),
          ),
        segments,
        samples: travel,
      });
    }
    const center = bounds.getCenter(new THREE.Vector3()),
      size = bounds.getSize(new THREE.Vector3());
    const scale = 2.8 / Math.max(size.x, size.y, size.z, 1);
    const normalize = (p: THREE.Vector3) =>
      p
        .clone()
        .sub(center)
        .multiplyScalar(scale)
        .multiply(new THREE.Vector3(1, -1, 1));
    const views = raw.map((n) => {
      const vertices: number[] = [];
      for (let i = 0; i < n.segments.length; i += 3)
        vertices.push(
          ...normalize(
            new THREE.Vector3(
              ...(n.segments.slice(i, i + 3) as [number, number, number]),
            ),
          ).toArray(),
        );
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      const material = new THREE.LineBasicMaterial({
        color: COLORS[n.channel % 10],
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.LineSegments(geometry, material);
      line.userData = { label: n.label, id: n.id };
      root.add(line);
      return {
        ...n,
        line,
        material,
        samples: n.samples.map(normalize),
        fired: -999,
      };
    });
    const pulseGeometry = new THREE.BufferGeometry();
    const pulsePositions = new Float32Array(Math.max(views.length, 1) * 3);
    pulseGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(pulsePositions, 3),
    );
    const pulseMaterial = new THREE.PointsMaterial({
      color: '#e9ffb4',
      size: 0.035,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pulses = new THREE.Points(pulseGeometry, pulseMaterial);
    root.add(pulses);
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line = { threshold: 0.018 };
    const pointer = new THREE.Vector2();
    const pick = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(views.map((v) => v.line))[0];
      if (hit) setSelected(hit.object.userData.label);
    };
    renderer.domElement.addEventListener('pointerup', pick);
    const resize = () => {
      const w = host.clientWidth,
        h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();
    let frame = 0;
    let previous: string[] = [];
    const animate = (time: number) => {
      frame = requestAnimationFrame(animate);
      const current = latest.current;
      if (current.spikes !== previous) {
        for (const id of current.spikes) {
          const v = views.find((v) => v.id === String(id));
          if (v) v.fired = time;
        }
        previous = current.spikes;
      }
      for (let i = 0; i < views.length; i++) {
        const v = views[i];
        const age = (time - v.fired) / (current.replay ? 1800 : 700);
        v.material.opacity = 0.13 + Math.max(0, 1 - age) * 0.85;
        const progress = age * Math.max(v.samples.length - 1, 0);
        const index = Math.max(
          0,
          Math.min(v.samples.length - 2, Math.floor(progress)),
        );
        const p =
          age >= 0 && age < 1 && v.samples.length > 1
            ? v.samples[index]
                .clone()
                .lerp(v.samples[index + 1], progress - index)
            : null;
        pulsePositions[i * 3] = p?.x ?? 100;
        pulsePositions[i * 3 + 1] = p?.y ?? 100;
        pulsePositions[i * 3 + 2] = p?.z ?? 100;
      }
      pulseGeometry.attributes.position.needsUpdate = true;
      controls.update();
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerup', pick);
      scene.traverse((o) => {
        if (o instanceof THREE.LineSegments || o instanceof THREE.Points) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.circuit]);
  return (
    <div
      role="img"
      aria-label="Interactive three-dimensional MaleCNS neuron subset. Drag to orbit and click a neuron to identify it."
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 300,
      }}
    >
      <div ref={container} style={{ position: 'absolute', inset: 0 }} />
      {error && (
        <div style={{ position: 'absolute', inset: 30, color: '#e6e9db' }}>
          {error}
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 18,
          fontSize: 9,
          letterSpacing: '.08em',
          lineHeight: 1.8,
          color: '#8b9c94',
          pointerEvents: 'none',
        }}
      >
        REAL MALECNS SKELETONS · {props.circuit?.neurons?.length ?? 0} NEURON
        SUBSET
        <br />
        PULSE TRAVEL IS ILLUSTRATIVE
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 18,
          right: 18,
          fontSize: 10,
          color: selected ? '#d6ff6b' : '#8b9c94',
          pointerEvents: 'none',
        }}
      >
        {selected
          ? `NEURON / ${selected}`
          : 'DRAG TO ORBIT · SCROLL TO ZOOM · CLICK TO IDENTIFY'}
      </div>
    </div>
  );
}
