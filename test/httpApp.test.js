import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import { getConfig } from '../src/config.js';
import { createApp } from '../src/http/app.js';
import { createRouter } from '../src/http/router.js';

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

test('configuration defaults to port 3000 and validates configured ports', () => {
  assert.deepEqual(getConfig({}), { port: 3000 });
  assert.deepEqual(getConfig({ PORT: '4321' }), { port: 4321 });
  for (const PORT of ['0', '65536', '3.5', 'not-a-port']) {
    assert.throws(() => getConfig({ PORT }), /PORT must be an integer/);
  }
});

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

    for (const pathname of ['/%2e%2e/package.json', '/%2e%2e%5cpackage.json']) {
      const traversal = await fetch(`${baseUrl}${pathname}`);
      assert.equal(traversal.status, 404);
      assert.deepEqual(await traversal.json(), {
        error: { code: 'NOT_FOUND', message: 'File was not found.' }
      });
    }
  });
});

test('unexpected handler errors return a generic JSON 500 without a stack trace', async () => {
  const router = createRouter();
  router.add('GET', '/api/failure', () => {
    throw new Error('sensitive internal details');
  });
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/api/failure`);
    assert.equal(response.status, 500);
    const body = await response.json();
    assert.deepEqual(body, {
      error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' }
    });
    assert.doesNotMatch(JSON.stringify(body), /sensitive internal details|Error:/);
  }, { router });
});
