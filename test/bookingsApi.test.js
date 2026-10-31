import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublishedEvent, request, withApi } from '../test-support/apiTestHelpers.js';

test('API creates bookings and rejects sold-out or invalid quantities without changing inventory', async () => {
  await withApi(async (baseUrl, { repository }) => {
    const { tier } = await createPublishedEvent(baseUrl, {
      title: 'Small Show',
      capacity: 1,
      tierCapacity: 1,
      priceCents: 250
    });

    const first = await request(baseUrl, 'POST', '/api/bookings', {
      userId: 'attendee-1',
      body: { tierId: tier.id, quantity: 1 }
    });
    assert.equal(first.status, 201);
    const booking = await first.json();
    assert.equal(booking.status, 'pending');
    assert.equal(booking.totalPriceCents, 250);

    const soldOut = await request(baseUrl, 'POST', '/api/bookings', {
      userId: 'attendee-2',
      body: { tierId: tier.id, quantity: 1 }
    });
    assert.equal(soldOut.status, 409);
    assert.equal((await soldOut.json()).error.code, 'SOLD_OUT');

    const invalid = await request(baseUrl, 'POST', '/api/bookings', {
      userId: 'attendee-3',
      body: { tierId: tier.id, quantity: 11 }
    });
    assert.equal(invalid.status, 400);
    assert.equal((await repository.getTier(tier.id)).booked, 1);
    assert.equal((await repository.listBookings()).length, 1);
  });
});

test('API enforces identity and organizer ownership and only releases seats once on cancellation', async () => {
  await withApi(async (baseUrl, { repository }) => {
    const eventResponse = await request(baseUrl, 'POST', '/api/events', {
      userId: 'organizer-1',
      body: { title: 'Show', city: 'Lagos', venue: 'Hall', date: '2026-12-05', capacity: 1 }
    });
    const event = await eventResponse.json();

    const missingIdentity = await request(baseUrl, 'POST', `/api/events/${event.id}/publish`);
    assert.equal(missingIdentity.status, 401);
    assert.equal((await missingIdentity.json()).error.code, 'UNAUTHORIZED');

    const wrongOrganizer = await request(baseUrl, 'POST', `/api/events/${event.id}/tiers`, {
      userId: 'other-organizer',
      body: { name: 'General', priceCents: 100, capacity: 1 }
    });
    assert.equal(wrongOrganizer.status, 403);
    assert.equal((await wrongOrganizer.json()).error.code, 'FORBIDDEN');

    const tier = await (await request(baseUrl, 'POST', `/api/events/${event.id}/tiers`, {
      userId: 'organizer-1',
      body: { name: 'General', priceCents: 100, capacity: 1 }
    })).json();
    await request(baseUrl, 'POST', `/api/events/${event.id}/publish`, { userId: 'organizer-1' });
    const booking = await (await request(baseUrl, 'POST', '/api/bookings', {
      userId: 'attendee-1',
      body: { tierId: tier.id, quantity: 1 }
    })).json();

    const wrongAttendee = await request(baseUrl, 'POST', `/api/bookings/${booking.reference}/cancel`, {
      userId: 'attendee-2'
    });
    assert.equal(wrongAttendee.status, 403);
    assert.equal((await wrongAttendee.json()).error.code, 'FORBIDDEN');

    const cancelled = await request(baseUrl, 'POST', `/api/bookings/${booking.reference}/cancel`, {
      userId: 'attendee-1'
    });
    assert.equal(cancelled.status, 200);
    assert.equal((await cancelled.json()).status, 'cancelled');
    assert.equal((await repository.getTier(tier.id)).booked, 0);

    const duplicateCancel = await request(baseUrl, 'POST', `/api/bookings/${booking.reference}/cancel`, {
      userId: 'attendee-1'
    });
    assert.equal(duplicateCancel.status, 409);
    assert.equal((await duplicateCancel.json()).error.code, 'INVALID_TRANSITION');
    assert.equal((await repository.getTier(tier.id)).booked, 0);

    const replacementBooking = await request(baseUrl, 'POST', '/api/bookings', {
      userId: 'attendee-2',
      body: { tierId: tier.id, quantity: 1 }
    });
    assert.equal(replacementBooking.status, 201);
  });
});
