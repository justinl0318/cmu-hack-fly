// @ts-expect-error Native Node tests use explicit TypeScript extensions.
import { courseX, FOOD, FINISH_Z } from './kitchen.ts';
// @ts-expect-error Native Node tests use explicit TypeScript extensions.
import { muscleInputs, CONTROLS } from './controls.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
// @ts-expect-error Node's native TypeScript runner requires the explicit .ts extension.
import { createFlightState, stepFlight, RINGS } from './simulation.ts';

void test('launch perch is safe indefinitely without balanced wing output', () => {
  const s = createFlightState(),
    initial = createFlightState();
  for (let i = 0; i < 1200; i++) stepFlight(s, [], 0.1);
  assert.deepEqual(s, initial);
  for (let i = 0; i < 120; i++) stepFlight(s, [1, 1], 0.1);
  assert.deepEqual(s, initial);
  stepFlight(s, [0.5, 0.5, 0, 0, 0, 0.5, 0.5], 0.02);
  assert.equal(s.launched, true);
  assert.ok(s.elapsed > 0);
});
void test('matched muscles balance roll; unilateral wing muscles cause roll', () => {
  const balanced = createFlightState(),
    asymmetric = createFlightState();
  balanced.launched = true;
  asymmetric.launched = true;
  for (let i = 0; i < 100; i++) {
    stepFlight(balanced, [0.7, 0.5, 0, 0, 0, 0.7, 0.5, 0, 0, 0], 1 / 120);
    stepFlight(asymmetric, [0.7, 0.5, 0, 0, 0, 0, 0, 0, 0, 0], 1 / 120);
  }
  assert.equal(balanced.roll, 0);
  assert.ok(asymmetric.roll > 0.15);
  assert.ok(balanced.position.z > 0);
});
void test('landmark progress accepts any route without mandatory gates', () => {
  const hit = createFlightState(),
    miss = createFlightState();
  for (const s of [hit, miss]) {
    s.launched = true;
    s.position.z = RINGS[0].z - 0.02;
    s.velocity.z = 30;
  }
  miss.position.x = 10;
  stepFlight(hit, [], 0.02);
  stepFlight(miss, [], 0.02);
  assert.equal(hit.checkpoint, 1);
  assert.equal(miss.checkpoint, 1);
  assert.equal(miss.crashed, false);
});
void test('flight is deterministic and reset restores fatigue', () => {
  const a = createFlightState(),
    b = createFlightState();
  for (let i = 0; i < 120; i++)
    for (const s of [a, b]) stepFlight(s, Array(10).fill(1), 1 / 120);
  assert.deepEqual(a, b);
  assert.ok(a.fatigue[0] > 0);
  assert.equal(createFlightState().fatigue[0], 0);
});
function workerRun(withEdge: boolean) {
  let tick: () => void = () => {};
  const messages: { activations?: number[]; spikes?: string[] }[] = [];
  const self: { onmessage?: (event: { data: unknown }) => void } = {};
  vm.runInNewContext(
    fs.readFileSync(
      new URL('../public/neural-worker.js', import.meta.url),
      'utf8',
    ),
    {
      self,
      postMessage: (m: object) => messages.push(m),
      clearInterval: () => {},
      setInterval: (fn: () => void) => {
        tick = fn;
        return 1;
      },
    },
  );
  const send = (data: unknown) => self.onmessage!({ data });
  send({
    type: 'init',
    circuit: {
      neurons: [{ id: 'input' }, { id: 'output' }],
      edges: withEdge
        ? [{ source: 'input', target: 'output', weight: 20 }]
        : [],
      channels: [{ inputIds: ['input'], outputIds: ['output'] }],
    },
  });
  send({ type: 'start' });
  send({ type: 'input', pressed: ['q'] });
  for (let i = 0; i < 50; i++) tick();
  return { messages, send, tick };
}
void test('connectome edge ablation blocks muscle output while input still fires', () => {
  const connected = workerRun(true),
    disconnected = workerRun(false);
  assert.ok(connected.messages.some((m) => (m.activations?.[0] || 0) > 0.5));
  assert.ok(disconnected.messages.some((m) => m.spikes?.includes('input')));
  assert.ok(disconnected.messages.every((m) => !m.activations?.[0]));
});
void test('key release allows activity to decay and pause stops events', () => {
  const w = workerRun(true);
  w.send({ type: 'input', pressed: [] });
  for (let i = 0; i < 100; i++) w.tick();
  assert.ok(w.messages.at(-1)!.activations![0] < 0.001);
  w.send({ type: 'pause', paused: true });
  const count = w.messages.length;
  w.tick();
  assert.equal(w.messages.length, count);
});

const realCircuit = JSON.parse(
  fs.readFileSync(
    new URL('../public/data/circuit.json', import.meta.url),
    'utf8',
  ),
);
function realWorker() {
  let tick: () => void = () => {};
  let activations: number[] = Array(10).fill(0);
  const self: { onmessage?: (event: { data: unknown }) => void } = {};
  vm.runInNewContext(
    fs.readFileSync(
      new URL('../public/neural-worker.js', import.meta.url),
      'utf8',
    ),
    {
      self,
      postMessage: (m: { activations?: number[] }) => {
        if (m.activations) activations = m.activations;
      },
      clearInterval: () => {},
      setInterval: (fn: () => void) => {
        tick = fn;
        return 1;
      },
    },
  );
  const send = (data: unknown) => self.onmessage!({ data });
  send({ type: 'init', circuit: realCircuit });
  send({ type: 'start' });
  return (pressed: string[]) => {
    send({ type: 'input', pressed });
    tick();
    return activations;
  };
}
void test('each real selected pathway activates its own muscle independently', () => {
  'qwertasdfg'.split('').forEach((key, channel) => {
    const worker = realWorker();
    let activity: number[] = [];
    for (let i = 0; i < 50; i++) activity = worker([key]);
    assert.ok(
      activity[channel] > 0.6,
      `channel ${key} must reach motor output`,
    );
    assert.ok(
      activity.every((v, i) => i === channel || v === 0),
      `channel ${key} must be independently playable`,
    );
  });
});
void test('deliberate real-key holds reach the kitchen finish at human decision cadence', () => {
  // All feedback is sampled at 0.6, 0.8 or 1.0 seconds. Keys cannot change in
  // between decisions, so every new hold/release lasts at least that interval.
  for (const decisionSeconds of [0.6, 0.8, 1]) {
    const worker = realWorker(),
      s = createFlightState();
    const decisionSteps = Math.round(decisionSeconds / 0.02);
    let keys: string[] = [];
    for (let i = 0; i < 6000 && !s.crashed && !s.finished; i++) {
      if (i % decisionSteps === 0) {
        const target =
          s.position.z > 150 ? { x: 0, y: 8 } : RINGS[s.checkpoint];
        keys = [];
        if (!s.launched || s.position.y + s.velocity.y * 0.6 < target.y)
          keys.push('q', 'w', 'a', 's');
        const desiredRoll = Math.max(
          -0.3,
          Math.min(0.3, (target.x - s.position.x) * 0.08 - s.velocity.x * 0.2),
        );
        if (desiredRoll > s.roll + s.angularVelocity.z * 0.5 + 0.02)
          keys.push('t');
        if (desiredRoll < s.roll + s.angularVelocity.z * 0.5 - 0.02)
          keys.push('g');
      }
      stepFlight(s, worker(keys), 0.02);
    }
    assert.equal(
      s.crashed,
      false,
      `${decisionSeconds}s decision cadence must be playable`,
    );
    assert.equal(s.finished, true);
    assert.equal(s.checkpoint, 8);
  }
});
void test('holding primary wing muscles provides time to learn; landing is safe', () => {
  const worker = realWorker(),
    s = createFlightState();
  for (let i = 0; i < 150; i++)
    stepFlight(s, worker(['q', 'w', 'a', 's']), 0.02);
  assert.equal(s.launched, true);
  assert.equal(s.crashed, false);
  assert.ok(s.position.y > 5);
  for (let i = 0; i < 50; i++) stepFlight(s, worker([]), 0.02);
  assert.equal(s.crashed, false, 'one second of release gives time to react');
  for (let i = 0; i < 600 && !s.crashed; i++) stepFlight(s, worker([]), 0.02);
  assert.equal(s.crashed, false);
  assert.equal(s.position.y, 0.45);
});
void test('walls, ceiling and floor bounce without resetting progress', () => {
  for (const [axis, position, velocity] of [
    ['x', 22.99, 20],
    ['x', -22.99, -20],
    ['y', 0.46, -20],
    ['y', 23.99, 20],
  ] as const) {
    const s = createFlightState();
    s.launched = true;
    s.position.z = 60;
    s.position[axis] = position + (axis === 'x' ? courseX(60) : 0);
    s.velocity[axis] = velocity;
    stepFlight(s, [], 0.02);
    assert.equal(s.crashed, false);
    assert.equal(s.launched, true);
    assert.ok(s.position.z >= 60);
    assert.ok(s.stunRemaining > 0 || s.velocity[axis] * velocity <= 0);
  }
});
void test('finish accepts low, high and side routes without prior checkpoints', () => {
  for (const x of [-20, 0, 20])
    for (const y of [1, 10, 23]) {
      const s = createFlightState();
      s.launched = true;
      s.position = { x, y, z: FINISH_Z - 0.1 };
      s.velocity.z = 30;
      stepFlight(s, [], 0.02);
      assert.equal(s.finished, true);
      assert.equal(s.crashed, false);
      const frozen = structuredClone(s);
      stepFlight(s, Array(10).fill(1), 0.1);
      assert.deepEqual(s, frozen);
    }
});
void test('blue mug pushes the fly away instead of respawning', () => {
  const s = createFlightState();
  s.launched = true;
  s.position = { x: -11 + courseX(28), y: 5, z: 23.7 };
  s.velocity.z = 10;
  stepFlight(s, [], 0.02);
  assert.equal(s.crashed, false);
  assert.ok(s.position.z <= 23.6);
  assert.ok(s.stunRemaining > 0);
});
void test('jam slows, juice boosts and timed water stuns without death', () => {
  const run = (x: number, z: number, elapsed = 0) => {
    const s = createFlightState();
    s.launched = true;
    s.position = { x: x + courseX(z), y: 1, z };
    s.velocity.z = 5;
    s.elapsed = elapsed;
    stepFlight(s, [], 0.1);
    return s;
  };
  assert.ok(run(10, 54).velocity.z < run(0, 54).velocity.z);
  assert.ok(run(-3, 39).velocity.z > run(0, 60).velocity.z);
  assert.ok(run(-9, 155, 4).stunRemaining > 0);
  assert.equal(run(-9, 155, 0).stunRemaining, 0);
  assert.equal(run(-9, 155, 4).crashed, false);
});

void test('cruise is faster and paired wing pitch controls accelerate and brake', () => {
  function flight(extraKeys: string[]) {
    const s = createFlightState(),
      worker = realWorker();
    for (let i = 0; i < 150; i++) {
      const keys = ['q', 'w', 'a', 's', ...(i < 50 ? [] : extraKeys)];
      stepFlight(s, worker(keys), 0.02);
    }
    return s;
  }
  const cruise = flight([]),
    accelerate = flight(['e', 'd']),
    brake = flight(['r', 'f']);
  // Before this tuning the same real-key 3-second run covered 7.85 units.
  assert.ok(
    cruise.position.z > 10.4,
    'at least 32% more forward progress than the previous cruise',
  );
  assert.ok(cruise.velocity.z > 6);
  assert.ok(accelerate.velocity.z > cruise.velocity.z * 1.5);
  assert.ok(brake.velocity.z < cruise.velocity.z * 0.5);
  assert.ok(brake.velocity.z >= 0, 'braking should not invent reverse thrust');
});
void test('stroke extent creates opposite banks: T toward positive X and G negative X', () => {
  function bank(key: string) {
    const s = createFlightState(),
      worker = realWorker();
    for (let i = 0; i < 100; i++)
      stepFlight(s, worker(['q', 'w', 'a', 's', key]), 0.02);
    return s;
  }
  const t = bank('t'),
    g = bank('g');
  assert.ok(t.position.x > 0.5 && t.roll > 0.1);
  assert.ok(g.position.x < -0.5 && g.roll < -0.1);
  assert.ok(Math.abs(t.position.x + g.position.x) < 1e-8);
});

void test('hit falls, rests on the floor despite input, then recovers without reset', () => {
  const s = createFlightState();
  s.launched = true;
  s.position = { x: -11 + courseX(28), y: 5, z: 23.7 };
  s.velocity.z = 10;
  stepFlight(s, [], 0.02);
  const hitZ = s.position.z;
  for (let i = 0; i < 200 && s.position.y > 0.45; i++)
    stepFlight(s, Array(10).fill(1), 0.02);
  assert.equal(s.position.y, 0.45);
  assert.ok(s.stunRemaining > 1.1, 'rest starts after landing');
  for (let i = 0; i < 40; i++) stepFlight(s, Array(10).fill(1), 0.02);
  assert.equal(s.position.y, 0.45);
  assert.equal(s.position.z, hitZ);
  assert.ok(s.stunRemaining > 0);
  assert.ok(s.muscle.every((v) => v === 0));
  for (let i = 0; i < 30; i++) stepFlight(s, [1, 1, 0, 0, 0, 1, 1], 0.02);
  assert.equal(s.stunRemaining, 0);
  assert.ok(s.recoveryRemaining > 0);
  assert.ok(s.position.y > 0.45);
  assert.equal(s.crashed, false);
  assert.equal(s.launched, true);
});
void test('recovery protection prevents repeated trap hits, then expires', () => {
  const s = createFlightState();
  s.launched = true;
  s.recoveryRemaining = 2;
  s.position = { x: -9 + courseX(155), y: 1, z: 155 };
  s.elapsed = 4;
  stepFlight(s, [], 0.1);
  assert.equal(s.stunRemaining, 0);
  s.recoveryRemaining = 0;
  stepFlight(s, [], 0.1);
  assert.ok(s.stunRemaining > 0);
  const reset = createFlightState();
  assert.equal(reset.stunRemaining, 0);
  assert.equal(reset.recoveryRemaining, 0);
});
void test('swatter only stuns during its active attack window', () => {
  for (const [elapsed, hit] of [
    [1, false],
    [5, true],
  ] as const) {
    const s = createFlightState();
    s.launched = true;
    s.elapsed = elapsed;
    s.position = { x: 5 + courseX(126), y: 4, z: 126 };
    stepFlight(s, [], 0.02);
    assert.equal(s.stunRemaining > 0, hit);
  }
});

void test('six physical keys stimulate paired wings and independent bank/yaw pathways', () => {
  assert.equal(CONTROLS.length, 6);
  assert.deepEqual(muscleInputs(['w', 'o']), ['q', 'w', 'a', 's']);
  assert.deepEqual(muscleInputs(['q', 'p']), ['t', 'g']);
  assert.deepEqual(muscleInputs(['e', 'i']), ['e', 'd']);
  assert.deepEqual(muscleInputs(['a', 's', 't', 'g']), []);
});
void test('new paired wing controls launch; yaw and bank stay distinct and recover', () => {
  const fly = (extra: string) => {
    const s = createFlightState(),
      w = realWorker();
    for (let i = 0; i < 80; i++)
      stepFlight(s, w(muscleInputs(['w', 'o', extra])), 0.02);
    return { s, w };
  };
  const bank = fly('q'),
    yaw = fly('e'),
    opposite = fly('i');
  assert.ok(bank.s.roll > 0.05);
  assert.ok(Math.abs(bank.s.yaw) < 0.01);
  assert.ok(yaw.s.yaw > 0.1);
  assert.ok(opposite.s.yaw < -0.1);
  const roll = bank.s.roll;
  for (let i = 0; i < 120; i++)
    stepFlight(bank.s, bank.w(muscleInputs(['w', 'o'])), 0.02);
  assert.ok(Math.abs(bank.s.roll) < roll * 0.25, 'bank release levels the fly');
});
void test('food is consumed once, boosts forward motion, expires and resets', () => {
  const s = createFlightState();
  s.launched = true;
  s.position = { ...FOOD[0] };
  stepFlight(s, [], 0.02);
  assert.deepEqual(s.collectedFood, [0]);
  assert.ok(s.boostRemaining > 2);
  stepFlight(s, [], 0.02);
  assert.deepEqual(s.collectedFood, [0]);
  const control = structuredClone(s);
  control.boostRemaining = 0;
  const power = [1, 1, 0, 0, 0, 1, 1];
  stepFlight(s, power, 0.2);
  stepFlight(control, power, 0.2);
  assert.ok(s.velocity.z > control.velocity.z);
  s.position = { x: courseX(80) + 20, y: 5, z: 80 };
  s.velocity = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 150; i++) stepFlight(s, [], 0.02);
  assert.equal(s.boostRemaining, 0);
  assert.deepEqual(createFlightState().collectedFood, []);
});

void test('six-key pilot follows S bends and finishes at a human correction cadence', () => {
  const s = createFlightState(),
    worker = realWorker();
  let keys: string[] = [];
  for (let i = 0; i < 7000 && !s.finished; i++) {
    if (i % 20 === 0) {
      keys = [];
      const altitude = s.position.z > 155 ? 8 : 4.5;
      if (!s.launched || s.position.y + s.velocity.y * 0.5 < altitude)
        keys.push('w', 'o');
      const heading = Math.max(
        -0.7,
        Math.min(
          0.7,
          Math.atan2(courseX(s.position.z + 12) - s.position.x, 12),
        ),
      );
      if (s.yaw + s.angularVelocity.y * 0.3 < heading - 0.06) keys.push('e');
      if (s.yaw + s.angularVelocity.y * 0.3 > heading + 0.06) keys.push('i');
    }
    stepFlight(s, worker(muscleInputs(keys)), 0.02);
  }
  assert.equal(s.finished, true, JSON.stringify(s.position));
  assert.equal(s.crashed, false);
});
