import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function unusedPort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  return port;
}

function startServer(port, databasePath) {
  return spawn(process.execPath, ['src/server.js'], {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_PATH: databasePath, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

async function waitForServer(child, baseUrl) {
  let output = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { output += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { output += chunk; });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited before becoming ready:\n${output}`);
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  throw new Error(`Server did not become ready:\n${output}`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill();
  await exited;
}

async function postJson(baseUrl, pathname, userId, body) {
  const headers = { 'x-user-id': userId };
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${baseUrl}${pathname}`, {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

test('SQLite-backed API retains events, tiers, and bookings after server restart', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ticketing-server-restart-'));
  const databasePath = path.join(directory, 'ticketing.sqlite');
  const port = await unusedPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let child;

  try {
    child = startServer(port, databasePath);
    await waitForServer(child, baseUrl);

    const eventResponse = await postJson(baseUrl, '/api/events', 'organizer-1', {
      title: 'Persistent Show',
      city: 'Lagos',
      venue: 'City Hall',
      date: '2027-01-15',
      capacity: 2
    });
    assert.equal(eventResponse.status, 201);
    const event = await eventResponse.json();

    const tierResponse = await postJson(baseUrl, `/api/events/${event.id}/tiers`, 'organizer-1', {
      name: 'General',
      priceCents: 4500,
      capacity: 2
    });
    assert.equal(tierResponse.status, 201);
    const tier = await tierResponse.json();

    const publishResponse = await postJson(baseUrl, `/api/events/${event.id}/publish`, 'organizer-1');
    assert.equal(publishResponse.status, 200);
    const bookingResponse = await postJson(baseUrl, '/api/bookings', 'attendee-1', {
      tierId: tier.id,
      quantity: 1
    });
    assert.equal(bookingResponse.status, 201);
    const booking = await bookingResponse.json();

    await stopServer(child);
    child = startServer(port, databasePath);
    await waitForServer(child, baseUrl);

    const events = await (await fetch(`${baseUrl}/api/events`)).json();
    assert.equal(events.length, 1);
    assert.equal(events[0].id, event.id);
    assert.equal(events[0].tiers[0].id, tier.id);
    assert.equal(events[0].tiers[0].booked, 1);

    const paymentResponse = await postJson(
      baseUrl,
      `/api/bookings/${booking.reference}/pay`,
      'attendee-1',
      { outcome: 'success' }
    );
    assert.equal(paymentResponse.status, 200);
    assert.equal((await paymentResponse.json()).status, 'paid');
  } finally {
    await stopServer(child);
    await rm(directory, { recursive: true, force: true });
  }
});
