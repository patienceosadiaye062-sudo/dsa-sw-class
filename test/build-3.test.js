import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { BOOKING_STATES, assertTransition, canTransition } from '../src/domain/bookingStateMachine.js';
import { getConfig } from '../src/config.js';
import { createApp } from '../src/http/app.js';
import { createRouter } from '../src/http/router.js';

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
      assert.throws(
        () => assertTransition(from, to),
        error => error.code === 'INVALID_TRANSITION'
      );
    }
  }
});

test('booking state machine rejects unknown states', () => {
  assert.equal(canTransition('unknown', 'paid'), false);
  assert.throws(() => assertTransition('pending', 'unknown'), { code: 'INVALID_TRANSITION' });
});

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

test('configuration defaults to port 3000 and validates configured ports', () => {
  assert.deepEqual(getConfig({}), { port: 3000 });
  assert.deepEqual(getConfig({ PORT: '4321' }), { port: 4321 });
  for (const PORT of ['0', '65536', '3.5', 'not-a-port']) {
    assert.throws(() => getConfig({ PORT }), /PORT must be an integer/);
  }
});

async function withServer(run, options) {
  const server = createApp(options);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    server.closeAllConnections();
    await once(server, 'close');
  }
}

test('HTTP server responds to /health with JSON', async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: 'ok' });
  });
});

test('HTTP server serves public files and returns consistent JSON errors', async () => {
  await withServer(async baseUrl => {
    const page = await fetch(baseUrl);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Event Ticketing/);

    const missing = await fetch(`${baseUrl}/api/missing`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), {
      error: { code: 'NOT_FOUND', message: 'API route was not found.' }
    });

    const invalidJson = await fetch(`${baseUrl}/api/example`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{'
    });
    assert.equal(invalidJson.status, 400);
    assert.deepEqual(await invalidJson.json(), {
      error: { code: 'INVALID_JSON', message: 'Request body must contain valid JSON.' }
    });

    const traversal = await fetch(`${baseUrl}/%2e%2e/package.json`);
    assert.equal(traversal.status, 404);
    assert.deepEqual(await traversal.json(), {
      error: { code: 'NOT_FOUND', message: 'File was not found.' }
    });

    const windowsTraversal = await fetch(`${baseUrl}/%2e%2e%5cpackage.json`);
    assert.equal(windowsTraversal.status, 404);
    assert.deepEqual(await windowsTraversal.json(), {
      error: { code: 'NOT_FOUND', message: 'File was not found.' }
    });
  });
});

test('unexpected handler errors return a generic JSON 500 without a stack trace', async () => {
  const router = createRouter();
  router.add('GET', '/api/failure', () => {
    throw new Error('sensitive internal details');
  });
  await withServer(async baseUrl => {
    const serverResponse = await fetch(`${baseUrl}/api/failure`);
    assert.equal(serverResponse.status, 500);
    const body = await serverResponse.json();
    assert.deepEqual(body, {
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' }
    });
    assert.doesNotMatch(JSON.stringify(body), /sensitive internal details|Error:/);
  }, { router });
});
