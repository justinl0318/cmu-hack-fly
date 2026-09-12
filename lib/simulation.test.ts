import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
// @ts-expect-error Node's native TypeScript runner requires the explicit .ts extension.
import { createFlightState, stepFlight, RINGS } from './simulation.ts';

void test('unstimulated fly falls under gravity', () => {
  const s = createFlightState();
  for (let i = 0; i < 300; i++) stepFlight(s, [], 1 / 120);
  assert.equal(s.crashed, true);
  assert.equal(s.position.y, .45);
});
void test('matched muscles balance roll; unilateral wing muscles cause roll', () => {
  const balanced = createFlightState(), asymmetric = createFlightState();
  for (let i = 0; i < 100; i++) {
    stepFlight(balanced, [.7, .5, 0, 0, 0, .7, .5, 0, 0, 0], 1 / 120);
    stepFlight(asymmetric, [.7, .5, 0, 0, 0, 0, 0, 0, 0, 0], 1 / 120);
  }
  assert.equal(balanced.roll, 0);
  assert.ok(asymmetric.roll > .15);
  assert.ok(balanced.position.z > 0);
});
void test('checkpoint crossing uses segment intersection and rejects misses', () => {
  const hit = createFlightState(), miss = createFlightState();
  for (const s of [hit, miss]) { s.position.z = RINGS[0].z - .02; s.velocity.z = 30; }
  miss.position.x = 10;
  stepFlight(hit, [], .02); stepFlight(miss, [], .02);
  assert.equal(hit.checkpoint, 1);
  assert.equal(miss.checkpoint, 0);
  assert.equal(miss.crashed, true);
});
void test('flight is deterministic and reset restores fatigue', () => {
  const a = createFlightState(), b = createFlightState();
  for (let i = 0; i < 120; i++) for (const s of [a, b]) stepFlight(s, Array(10).fill(.7), 1 / 120);
  assert.deepEqual(a, b);
  assert.ok(a.fatigue[0] > 0);
  assert.equal(createFlightState().fatigue[0], 0);
});
function workerRun(withEdge: boolean) {
  let tick: () => void = () => {};
  const messages: { activations?: number[]; spikes?: string[] }[] = [];
  const self: { onmessage?: (event: { data: unknown }) => void } = {};
  vm.runInNewContext(fs.readFileSync(new URL('../public/neural-worker.js', import.meta.url), 'utf8'), {
    self, postMessage: (m: object) => messages.push(m),
    clearInterval: () => {}, setInterval: (fn: () => void) => { tick = fn; return 1; },
  });
  const send = (data: unknown) => self.onmessage!({ data });
  send({ type: 'init', circuit: { neurons: [{ id: 'input' }, { id: 'output' }],
    edges: withEdge ? [{ source: 'input', target: 'output', weight: 20 }] : [],
    channels: [{ inputIds: ['input'], outputIds: ['output'] }] } });
  send({ type: 'start' }); send({ type: 'input', pressed: ['q'] });
  for (let i = 0; i < 50; i++) tick();
  return { messages, send, tick };
}
void test('connectome edge ablation blocks muscle output while input still fires', () => {
  const connected = workerRun(true), disconnected = workerRun(false);
  assert.ok(connected.messages.some(m => (m.activations?.[0] || 0) > .5));
  assert.ok(disconnected.messages.some(m => m.spikes?.includes('input')));
  assert.ok(disconnected.messages.every(m => !m.activations?.[0]));
});
void test('key release allows activity to decay and pause stops events', () => {
  const w = workerRun(true);
  w.send({ type: 'input', pressed: [] });
  for (let i = 0; i < 100; i++) w.tick();
  assert.ok(w.messages.at(-1)!.activations![0] < .001);
  w.send({ type: 'pause', paused: true });
  const count = w.messages.length; w.tick(); assert.equal(w.messages.length, count);
});

const realCircuit = JSON.parse(fs.readFileSync(new URL('../public/data/circuit.json', import.meta.url), 'utf8'));
function realWorker() {
  let tick: () => void = () => {};
  let activations: number[] = Array(10).fill(0);
  const self: { onmessage?: (event: { data: unknown }) => void } = {};
  vm.runInNewContext(fs.readFileSync(new URL('../public/neural-worker.js', import.meta.url), 'utf8'), {
    self, postMessage: (m: { activations?: number[] }) => { if (m.activations) activations = m.activations; },
    clearInterval: () => {}, setInterval: (fn: () => void) => { tick = fn; return 1; },
  });
  const send = (data: unknown) => self.onmessage!({ data });
  send({ type: 'init', circuit: realCircuit }); send({ type: 'start' });
  return (pressed: string[]) => { send({ type: 'input', pressed }); tick(); return activations; };
}
void test('each real selected pathway activates its own muscle independently', () => {
  'qwertasdfg'.split('').forEach((key, channel) => {
    const worker = realWorker(); let activity: number[] = [];
    for (let i = 0; i < 50; i++) activity = worker([key]);
    assert.ok(activity[channel] > .6, `channel ${key} must reach motor output`);
    assert.ok(activity.every((v, i) => i === channel || v === 0), `channel ${key} must be independently playable`);
  });
});
void test('coordinated real-key stimulation can complete all eight gates', () => {
  const worker = realWorker(), s = createFlightState();
  // Feedback pilot uses six muscle keys; no direct force or output injection.
  for (let i = 0; i < 6000 && !s.crashed && !s.finished; i++) {
    const target = RINGS[s.checkpoint], keys: string[] = [];
    if (s.position.y + s.velocity.y * .5 < target.y) keys.push('q', 'w', 'a', 's');
    const desiredRoll = Math.max(-.3, Math.min(.3, (target.x - s.position.x) * .08 - s.velocity.x * .16));
    if (desiredRoll > s.roll + s.angularVelocity.z * .3 + .02) keys.push('t');
    if (desiredRoll < s.roll + s.angularVelocity.z * .3 - .02) keys.push('g');
    stepFlight(s, worker(keys), .02);
  }
  assert.equal(s.crashed, false);
  assert.equal(s.finished, true);
  assert.equal(s.checkpoint, 8);
});
void test('holding every real control does not win', () => {
  const worker = realWorker(), s = createFlightState();
  for (let i = 0; i < 3000 && !s.crashed && !s.finished; i++) stepFlight(s, worker('qwertasdfg'.split('')), .02);
  assert.equal(s.finished, false);
  assert.equal(s.crashed, true);
});
