import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attack,
  advanceRace,
  createRacer,
  type RaceSnapshot,
  // @ts-expect-error Native Node tests use explicit extensions.
} from './battle.ts';
const setup = (): RaceSnapshot => {
  const players = [
    createRacer('host', 'Host', 0),
    createRacer('guest', 'Guest', 1),
  ];
  players.forEach((p) => {
    p.state.launched = true;
    p.state.position = { x: 0, y: 5, z: 0 };
  });
  players[1].state.position.z = 5;
  return { phase: 'racing', clock: 0, countdown: 0, players };
};
void test('room speed applies to all racers while race clock and attack cooldown stay real-time', () => {
  const normal = setup(),
    fast = setup();
  fast.speedMultiplier = 5;
  for (const race of [normal, fast])
    for (const p of race.players) {
      p.activations = [1, 1, 0, 0, 0, 1, 1, 0, 0, 0];
      p.state.muscle = [...p.activations];
      p.cooldown = 1;
    }
  advanceRace(normal, 0.1);
  advanceRace(fast, 0.1);
  assert.equal(normal.clock, fast.clock);
  for (let i = 0; i < fast.players.length; i++) {
    assert.ok(
      fast.players[i].state.velocity.z >
        normal.players[i].state.velocity.z * 4.8,
    );
    assert.equal(fast.players[i].cooldown, normal.players[i].cooldown);
  }
});
void test('innate forward attack hits without pickups, respects cooldown and immunity', () => {
  const race = setup();
  assert.equal(attack(race, 'host'), true);
  assert.equal(race.players[0].hits, 1);
  assert.ok(race.players[1].state.stunRemaining > 0);
  assert.equal(attack(race, 'host'), false);
  race.players[0].cooldown = 0;
  race.players[1].state.stunRemaining = 0;
  race.players[1].state.recoveryRemaining = 2;
  attack(race, 'host');
  assert.equal(race.players[0].hits, 1);
  assert.equal(race.players[1].state.stunRemaining, 0);
});
void test('attacks cannot hit behind, out of range, above, or before the countdown ends', () => {
  for (const position of [
    { x: 0, y: 5, z: -3 },
    { x: 0, y: 5, z: 10 },
    { x: 0, y: 9, z: 4 },
    { x: 6, y: 5, z: 1 },
  ]) {
    const race = setup();
    race.players[1].state.position = position;
    attack(race, 'host');
    assert.equal(race.players[1].state.stunRemaining, 0);
  }
  const race = setup();
  race.phase = 'countdown';
  assert.equal(attack(race, 'host'), false);
  race.phase = 'racing';
  race.players[0].state.stunRemaining = 1;
  assert.equal(attack(race, 'host'), false);
});
void test('host countdown holds all players, then race clock and result times share one authority', () => {
  const race = setup();
  race.phase = 'countdown';
  race.countdown = 3;
  const initial = structuredClone(race.players);
  advanceRace(race, 2);
  assert.deepEqual(race.players, initial);
  assert.equal(race.clock, 0);
  advanceRace(race, 1);
  assert.equal(race.phase, 'racing');
  race.players[0].state.finished = true;
  advanceRace(race, 0.02);
  assert.equal(race.players[0].finishTime, 0.02);
  assert.equal(race.phase, 'results');
  const frozen = structuredClone(race);
  advanceRace(race, 2);
  assert.deepEqual(race, frozen);
  assert.equal(race.results?.[1].finishTime, null);
  race.players[1].state.finished = true;
  advanceRace(race, 0.02);
  assert.equal(race.phase, 'results');
  assert.equal(race.players[1].finishTime, null);
});

void test('race telemetry tracks top speed and survives frozen result snapshot', () => {
  const race = setup();
  race.players[0].state.velocity.z = 10;
  advanceRace(race, 0.02);
  assert.ok(race.players[0].topSpeed > 9);
  assert.ok(race.players[0].activeTime > 0);
  race.players[0].state.finished = true;
  advanceRace(race, 0.02);
  assert.equal(race.results?.[0].topSpeed, race.players[0].topSpeed);
  const rematch = createRacer('host', 'ignored', 0, race.players[0].profile);
  assert.deepEqual(rematch.profile, race.players[0].profile);
  assert.equal(rematch.topSpeed, 0);
  assert.deepEqual(rematch.neuralReplay, []);
});
