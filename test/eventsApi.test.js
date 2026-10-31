import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublishedEvent, request, withApi } from '../test-support/apiTestHelpers.js';

test('API creates draft events, publishes them, and searches published events', async () => {
  await withApi(async baseUrl => {
    const { event, tier } = await createPublishedEvent(baseUrl, {
      capacity: 10,
      tierCapacity: 5,
      publish: false
    });

    assert.equal(event.status, 'draft');
    assert.equal(tier.name, 'General');
    assert.deepEqual(await (await fetch(`${baseUrl}/api/events`)).json(), []);
    const publishResponse = await request(baseUrl, 'POST', `/api/events/${event.id}/publish`, {
      userId: 'organizer-1'
    });
    assert.equal(publishResponse.status, 200);
    assert.equal((await publishResponse.json()).status, 'published');

    const searchResponse = await fetch(
      `${baseUrl}/api/events?q=tech&city=lagos&from=2026-12-01&to=2026-12-31&maxPriceCents=4500&onlyAvailable=true&sort=price`
    );
    assert.equal(searchResponse.status, 200);
    assert.equal((await searchResponse.json())[0].id, event.id);
  });
});

test('event search rejects invalid query parameters using the standard error shape', async () => {
  await withApi(async baseUrl => {
    const invalidSearch = await fetch(`${baseUrl}/api/events?onlyAvailable=yes`);
    assert.equal(invalidSearch.status, 400);
    assert.deepEqual(await invalidSearch.json(), {
      error: { code: 'VALIDATION', message: 'onlyAvailable must be true or false.' }
    });
  });
});
