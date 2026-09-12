import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Native Node tests use explicit extensions.
import { normalizeProfile, safeProfileUrl, raceTime } from './profile.ts';
// @ts-expect-error Native Node tests use explicit extensions.
import { createRacer, neuralStyle } from './battle.ts';
void test('profile fields and appearance are bounded and sanitized at the host boundary', () => {
  const p = normalizeProfile({
    name: 'x'.repeat(100),
    bio: 'b'.repeat(500),
    look: { color: 'url(evil)', hat: 'unknown', shoes: 'boots' },
  });
  assert.equal(p.name.length, 40);
  assert.equal(p.bio.length, 160);
  assert.equal(p.look.color, '#97745d');
  assert.equal(p.look.hat, 'none');
  assert.equal(p.look.shoes, 'boots');
  assert.equal(normalizeProfile(null).name, 'Friendly Fly');
  for (const url of [
    'javascript:alert(1)',
    'data:text/html,bad',
    'file:///secret',
    'https://user:password@example.com',
  ])
    assert.equal(safeProfileUrl(url), '');
  assert.equal(
    safeProfileUrl('https://example.com/me'),
    'https://example.com/me',
  );
});
void test('custom profile survives racer creation while all match statistics start fresh', () => {
  const profile = normalizeProfile({
    name: 'Max Lung',
    school: 'CMU MSCV 27',
    interests: 'Vision',
    look: { color: '#a99bff', hat: 'crown', shoes: 'sneakers' },
  });
  const racer = createRacer('a', 'ignored', 0, profile);
  assert.deepEqual(racer.profile, profile);
  assert.equal(racer.color, profile.look.color);
  assert.equal(racer.name, profile.name);
  assert.equal(racer.topSpeed, 0);
});
void test('neural styles use recorded gameplay telemetry and clock uses centiseconds', () => {
  const p = createRacer('a', 'Fly', 0);
  assert.equal(neuralStyle(p), 'Finding My Wings');
  p.activeTime = 10;
  p.turnEffort = 3;
  assert.equal(neuralStyle(p), 'Aggressive Cornering');
  p.turnEffort = 0;
  p.boostTime = 3;
  assert.equal(neuralStyle(p), 'Snack-Powered Sprinter');
  p.boostTime = 0;
  p.imbalance = 2;
  assert.equal(neuralStyle(p), 'Freestyle Flier');
  p.imbalance = 0;
  assert.equal(neuralStyle(p), 'Balanced Wingbeats');
  assert.equal(raceTime(84.38), '01:24.38');
  assert.equal(raceTime(60), '01:00.00');
});
