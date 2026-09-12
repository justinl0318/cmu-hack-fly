import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Native tests use explicit extensions.
import { ConnectionDeadline, connectionTimeout } from './room-connection.ts';
void test('slow cross-device negotiation does not consume the admission window', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let expired = 0;
  const deadline = new ConnectionDeadline(() => expired++);
  t.mock.timers.tick(30000);
  assert.equal(expired, 0);
  deadline.channelOpened();
  t.mock.timers.tick(9999);
  assert.equal(expired, 0);
  t.mock.timers.tick(1);
  assert.equal(expired, 1);
});
void test('unreachable peers expire, admitted peers cancel their timer', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let expired = 0;
  const admitted = new ConnectionDeadline(() => expired++);
  admitted.channelOpened();
  admitted.clear();
  new ConnectionDeadline(() => expired++);
  t.mock.timers.tick(44999);
  assert.equal(expired, 0);
  t.mock.timers.tick(1);
  assert.equal(expired, 1);
});
void test('failure text distinguishes signaling, ICE and admission', () => {
  assert.match(connectionTimeout('signaling', 'new'), /matching service/);
  assert.match(connectionTimeout('channel', 'checking'), /ICE: checking/);
  assert.match(connectionTimeout('join', 'connected'), /channel opened/);
});
