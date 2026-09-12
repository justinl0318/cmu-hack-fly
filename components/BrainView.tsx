'use client';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import shellManifest from '@/public/data/brain-shells.json';
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
export interface Circuit {
  source: string;
  sourceUrl: string;
  license: string;
  neurons: {
    id: string;
    name: string;
    side?: string;
    type?: string;
    points: number[][];
    segments: number[][];
  }[];
  edges: { source: string; target: string; weight: number }[];
  channels: {
    id: string;
    inputIds: string[];
    outputIds: string[];
    pathIds: string[];
    motorType?: string;
    side?: string;
  }[];
}
type Props = {
  circuit: Circuit;
  spikes: string[];
  activations: number[];
  replay?: boolean;
};
export default function BrainView(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  }, [props]);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [shellError, setShellError] = useState('');
  useEffect(() => {
    if (!container.current || !props.circuit) return;
    const host = container.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      queueMicrotask(() =>
        setError('WebGL is unavailable. Neural simulation is still active.'),
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive MaleCNS neuron subset. Drag to orbit, scroll to zoom, click to identify neurons.',
    );
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
      const points = neuron.points;
      const indexed = new Map<number, THREE.Vector3>();
      const samples: THREE.Vector3[] = [];
      for (let j = 0; j < points.length; j++) {
        const p = points[j];
        const pos = new THREE.Vector3(p[0], p[1], p[2]);
        if (!Number.isFinite(pos.x + pos.y + pos.z)) continue;
        indexed.set(j, pos);
        samples.push(pos);
        bounds.expandByPoint(pos);
      }
      const segments: number[] = [];
      for (const [aIndex, bIndex] of neuron.segments) {
        const a = indexed.get(aIndex),
          b = indexed.get(bIndex);
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
        id: neuron.id,
        label: neuron.name,
        channel: Math.max(
          0,
          props.circuit.channels.findIndex((c) =>
            c.pathIds.includes(neuron.id),
          ),
        ),
        segments,
        samples: travel,
      });
    }
    for (const shell of shellManifest.shells) {
      bounds.expandByPoint(
        new THREE.Vector3(...(shell.min as [number, number, number])),
      );
      bounds.expandByPoint(
        new THREE.Vector3(...(shell.max as [number, number, number])),
      );
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
    pulses.frustumCulled = false;
    root.add(pulses);
    const shellPulses = Array.from(
      { length: 30 },
      () => new THREE.Vector4(100, 100, 100, 0),
    );
    const shellMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: { signals: { value: shellPulses } },
      vertexShader: `varying vec3 p; varying vec3 n; varying vec3 eye;
        void main() { p=position; n=normalize(normalMatrix*normal); vec4 v=modelViewMatrix*vec4(position,1.); eye=normalize(-v.xyz); gl_Position=projectionMatrix*v; }`,
      fragmentShader: `uniform vec4 signals[30]; varying vec3 p; varying vec3 n; varying vec3 eye;
        void main() {
          float glow=0.;
          for(int i=0;i<30;i++) { float d=distance(p,signals[i].xyz);
            glow+=signals[i].w*exp(-d*d/0.012)*(.65+.35*cos(d*80.-signals[i].w*8.)); }
          glow=clamp(glow,0.,1.);
          float rim=pow(1.-abs(dot(normalize(n),normalize(eye))),2.);
          vec3 color=mix(vec3(.22,.53,.62),vec3(.63,1.,.61),glow);
          gl_FragColor=vec4(color,.065+rim*.25+glow*.6);
        }`,
    });
    const abort = new AbortController();
    let disposed = false;
    Promise.all(
      shellManifest.shells.map(async (shell) => {
        const response = await fetch('/data/' + shell.file, {
          signal: abort.signal,
        });
        if (!response.ok) throw new Error('Anatomical shell could not load.');
        const data = await response.arrayBuffer();
        if (disposed) return;
        const header = new DataView(data),
          count = header.getUint32(0, true),
          indexCount = header.getUint32(4, true);
        if (data.byteLength !== 8 + count * 12 + indexCount * 4)
          throw new Error('Invalid anatomical mesh.');
        const source = new Float32Array(data, 8, count * 3),
          points = new Float32Array(count * 3);
        for (let i = 0; i < count; i++)
          points.set(
            normalize(
              new THREE.Vector3(
                source[i * 3],
                source[i * 3 + 1],
                source[i * 3 + 2],
              ),
            ).toArray(),
            i * 3,
          );
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
        geometry.setIndex(
          new THREE.BufferAttribute(
            new Uint32Array(data, 8 + count * 12, indexCount),
            1,
          ),
        );
        geometry.computeVertexNormals();
        root.add(new THREE.Mesh(geometry, shellMaterial));
      }),
    ).catch(() => {
      if (!disposed)
        setShellError('Shell unavailable · neuron view remains active');
    });
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
        v.material.opacity = 0.045 + Math.max(0, 1 - age) * 0.65;
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
        shellPulses[i]?.set(
          p?.x ?? 100,
          p?.y ?? 100,
          p?.z ?? 100,
          p ? Math.max(0, 1 - age) : 0,
        );
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
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerup', pick);
      scene.traverse((o) => {
        if (
          o instanceof THREE.LineSegments ||
          o instanceof THREE.Points ||
          o instanceof THREE.Mesh
        ) {
          o.geometry.dispose();
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => m.dispose());
        }
      });
      shellMaterial.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [props.circuit]);
  return (
    <div
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
        {shellError || 'MALECNS BRAIN + VNC SHELL · LOCAL SPIKE GLOW'}
        <br />
        SURFACE GLOW IS AN ILLUSTRATIVE PROJECTION
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
