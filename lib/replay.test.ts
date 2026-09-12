import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Native Node tests require TypeScript extensions.
import { interpolateReplay, type ReplayFrame } from './replay.ts';
// @ts-expect-error Native Node tests require TypeScript extensions.
import { createFlightState } from './simulation.ts';
const frame = (at: number, z: number): ReplayFrame => ({
  at,
  flight: {
    ...createFlightState(),
    position: { x: z / 2, y: 5, z },
    elapsed: at,
  },
  activations: Array(10).fill(z / 10),
  spikes: [],
});
void test('replay moves between samples at every display frame, using actual recorded timestamps', () => {
  const a = frame(1, 0),
    b = frame(1.06, 6),
    saved = structuredClone([a, b]);
  const samples = Array.from({ length: 10 }, (_, i) =>
    interpolateReplay(a, b, 1 + (i + 1) / 600),
  );
  for (let i = 1; i < samples.length; i++)
    assert.ok(samples[i].flight.position.z > samples[i - 1].flight.position.z);
  assert.ok(
    Math.abs(interpolateReplay(a, b, 1.03).flight.position.z - 3) < 1e-9,
  );
  assert.deepEqual([a, b], saved);
});
void test('collection, stun, finish and spike events change on recorded boundaries only', () => {
  const a = frame(0, 0),
    b = frame(0.04, 1);
  b.flight.collectedFood = [2];
  b.flight.stunRemaining = 1.2;
  b.flight.finished = true;
  b.spikes = ['neuron'];
  const midway = interpolateReplay(a, b, 0.02);
  assert.deepEqual(midway.flight.collectedFood, []);
  assert.equal(midway.flight.stunRemaining, 0);
  assert.equal(midway.flight.finished, false);
  assert.equal(midway.spikes, a.spikes);
  const end = interpolateReplay(a, b, 0.04);
  assert.equal(end, b);
});
void test('interpolation clamps before/after recording and safely handles duplicate timestamps', () => {
  const a = frame(2, 3),
    b = frame(2, 4);
  assert.equal(interpolateReplay(a, b, 1).flight.position.z, 3);
  assert.equal(interpolateReplay(a, b, 3).flight.position.z, 4);
  assert.ok(Number.isFinite(interpolateReplay(a, b, 2).flight.position.x));
});
