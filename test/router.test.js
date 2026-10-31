import assert from 'node:assert/strict';
import test from 'node:test';
import { createRouter } from '../src/http/router.js';

test('router matches methods, static paths, and named parameters', () => {
  const handler = () => 'matched';
  const router = createRouter();
  router.add('GET', '/events/:eventId/bookings/:reference', handler);

  assert.deepEqual(router.match('GET', '/events/event-1/bookings/ABCD'), {
    handler,
    params: { eventId: 'event-1', reference: 'ABCD' }
  });
  assert.equal(router.match('POST', '/events/event-1/bookings/ABCD'), null);
  assert.equal(router.match('GET', '/events/event-1'), null);
});
