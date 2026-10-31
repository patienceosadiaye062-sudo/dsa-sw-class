import assert from 'node:assert/strict';
import test from 'node:test';
import { BOOKING_STATES, assertTransition, canTransition } from '../src/domain/bookingStateMachine.js';

const allowedTransitions = new Set([
  'pending:paid',
  'pending:cancelled',
  'paid:checked_in',
  'paid:refunded',
  'paid:cancelled'
]);

test('booking state machine permits every specified transition', () => {
  for (const transition of allowedTransitions) {
    const [from, to] = transition.split(':');
    assert.equal(canTransition(from, to), true);
    assert.doesNotThrow(() => assertTransition(from, to));
  }
});

test('booking state machine rejects every other transition between known states', () => {
  for (const from of BOOKING_STATES) {
    for (const to of BOOKING_STATES) {
      if (allowedTransitions.has(`${from}:${to}`)) continue;
      assert.equal(canTransition(from, to), false, `${from} -> ${to}`);
      assert.throws(() => assertTransition(from, to), { code: 'INVALID_TRANSITION' });
    }
  }
});

test('booking state machine rejects unknown states', () => {
  assert.equal(canTransition('unknown', 'paid'), false);
  assert.throws(() => assertTransition('pending', 'unknown'), { code: 'INVALID_TRANSITION' });
});
