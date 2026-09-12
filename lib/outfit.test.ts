import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Native Node tests use explicit extensions.
import { explainOutfit, randomOutfit } from './outfit.ts';
// @ts-expect-error Native Node tests use explicit extensions.
import { FLY_COLORS } from './profile.ts';
void test('random outfit changes color and accessories and never picks the empty outfit', () => {
  for (let i = 0; i < 200; i++) {
    const current = { color: '#97745d', hat: 'none', shoes: 'none' } as const;
    const next = randomOutfit(current, Math.random);
    assert.ok(FLY_COLORS.includes(next.color));
    assert.notEqual(next.color, current.color);
    assert.ok(next.hat !== 'none' || next.shoes !== 'none');
    const again = randomOutfit(next, Math.random);
    assert.notEqual(again.color, next.color);
    assert.ok(again.hat !== next.hat || again.shoes !== next.shoes);
  }
  assert.deepEqual(
    randomOutfit({ color: '#97745d', hat: 'none', shoes: 'none' }, () => 0),
    { color: '#a99bff', hat: 'none', shoes: 'sneakers' },
  );
});
void test('outfit note explains color, hat and shoes using the resume interests', () => {
  const note = explainOutfit(
    { interests: 'Computer Vision · Robotics · RL', school: 'CMU MSCV ’27' },
    { color: '#80b9e8', hat: 'wizard', shoes: 'boots' },
  );
  assert.match(note, /Sky blue/);
  assert.match(note, /Computer Vision/);
  assert.match(note, /wizard hat/i);
  assert.match(note, /Robotics/);
  assert.match(note, /boots/i);
  assert.match(note, /RL/);
  const fallback = explainOutfit(
    { interests: '', school: '' },
    { color: '#123456', hat: 'none', shoes: 'sneakers' },
  );
  assert.match(fallback, /custom color/i);
  assert.match(fallback, /your work/);
  assert.match(fallback, /sneakers/i);
});
