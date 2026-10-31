import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addTier,
  bookTickets,
  cancelBooking,
  createEvent,
  createStore,
  findBookingByReference,
  listEventSummaries,
  publishEvent,
  unpublishEvent
} from '../src/domain/Inventory.js';
import { newId, newReference } from '../src/domain/ids.js';

function eventInput(overrides = {}) {
  return {
    title: 'Lagos Tech Meetup',
    city: 'Lagos',
    venue: 'City Hall',
    date: '2026-12-05T17:00:00.000Z',
    capacity: 100,
    ...overrides
  };
}

function createPublishedEvent(store, input = eventInput(), tier = { name: 'General', priceCents: 500_000, capacity: 100 }) {
  const event = createEvent(store, input);
  const ticketTier = addTier(store, event.id, tier);
  publishEvent(store, event.id);
  return { event, tier: ticketTier };
}

function assertCode(code, action) {
  assert.throws(action, error => error.code === code);
}

test('ids are unique UUIDs and booking references use readable codes', () => {
  const id = newId();
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  assert.notEqual(newId(), id);
  assert.match(newReference(), /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
});

test('events are saved as drafts and hidden from public summaries', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());
  assert.ok(event.id);
  assert.equal(event.status, 'draft');
  assert.equal(event.title, 'Lagos Tech Meetup');
  assert.deepEqual(listEventSummaries(store), []);
  assert.equal(listEventSummaries(store, { publishedOnly: false })[0].id, event.id);
});

test('invalid event fields and dates fail without saving', () => {
  const store = createStore();
  for (const input of [
    eventInput({ title: '' }),
    eventInput({ title: undefined }),
    eventInput({ city: '' }),
    eventInput({ date: '2026-02-30' })
  ]) {
    assertCode('VALIDATION', () => createEvent(store, input));
    assert.equal(store.events.size, 0);
  }
});

test('tier starts with all its seats available', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500_000, capacity: 100 });
  assert.equal(tier.booked, 0);
  assert.equal(tier.seatsLeft, 100);
});

test('invalid tier prices, capacities, and event ids are rejected', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());
  assertCode('VALIDATION', () => addTier(store, event.id, { name: 'General', priceCents: 1.5, capacity: 10 }));
  assertCode('VALIDATION', () => addTier(store, event.id, { name: 'General', priceCents: 1, capacity: 0 }));
  assertCode('NOT_FOUND', () => addTier(store, 'missing', { name: 'General', priceCents: 1, capacity: 10 }));
  assert.equal(store.tiers.size, 0);
});

test('tier capacity cannot exceed event capacity', () => {
  const store = createStore();
  const event = createEvent(store, eventInput({ capacity: 5 }));
  addTier(store, event.id, { name: 'General', priceCents: 100, capacity: 4 });
  assertCode('VALIDATION', () => addTier(store, event.id, { name: 'VIP', priceCents: 200, capacity: 2 }));
  assert.equal(event.tierIds.size, 1);
});

test('publishing requires a tier and unpublishing hides the event', () => {
  const store = createStore();
  const draft = createEvent(store, eventInput());
  assertCode('INVALID_STATE', () => publishEvent(store, draft.id));
  assert.equal(draft.status, 'draft');

  const { event } = createPublishedEvent(store);
  assert.equal(event.status, 'published');
  assert.equal(listEventSummaries(store).length, 1);
  unpublishEvent(store, event.id);
  assert.equal(event.status, 'draft');
  assert.deepEqual(listEventSummaries(store), []);
  assertCode('NOT_FOUND', () => publishEvent(store, 'missing'));
});

test('booking reserves seats and prices tickets in whole cents', () => {
  const store = createStore();
  const { tier } = createPublishedEvent(store, eventInput({ capacity: 3 }), {
    name: 'General',
    priceCents: 4500,
    capacity: 3
  });
  const booking = bookTickets(store, { tierId: tier.id, attendeeName: 'Ada', quantity: 2 });
  assert.equal(booking.status, 'PENDING');
  assert.equal(booking.quantity, 2);
  assert.equal(booking.unitPriceCents, 4500);
  assert.equal(booking.totalPriceCents, 9000);
  assert.equal(tier.seatsLeft, 1);
});

test('sold-out and invalid-quantity bookings do not change inventory', () => {
  const store = createStore();
  const { tier } = createPublishedEvent(store, eventInput({ capacity: 3 }), {
    name: 'General',
    priceCents: 4500,
    capacity: 3
  });
  bookTickets(store, { tierId: tier.id, attendeeName: 'Ada', quantity: 2 });
  assertCode('SOLD_OUT', () => bookTickets(store, { tierId: tier.id, attendeeName: 'Bayo', quantity: 2 }));
  for (const quantity of [0, -1, 1.5, 11]) {
    assertCode('VALIDATION', () => bookTickets(store, { tierId: tier.id, attendeeName: 'Ada', quantity }));
  }
  assert.equal(tier.booked, 2);
  assert.equal(store.bookings.size, 1);
});

test('reference lookup is case-insensitive and reports missing bookings', () => {
  const store = createStore();
  const { tier } = createPublishedEvent(store);
  const booking = bookTickets(store, { tierId: tier.id, attendeeName: 'Ada', quantity: 1 });
  assert.equal(findBookingByReference(store, booking.reference), booking);
  assert.equal(findBookingByReference(store, booking.reference.toLowerCase()), booking);
  assertCode('NOT_FOUND', () => findBookingByReference(store, 'MISSING1'));
});

test('cancellation frees seats once and rejects a repeated cancellation', () => {
  const store = createStore();
  const { tier } = createPublishedEvent(store, eventInput({ capacity: 2 }), {
    name: 'General',
    priceCents: 100,
    capacity: 2
  });
  const booking = bookTickets(store, { tierId: tier.id, attendeeName: 'Ada', quantity: 2 });
  cancelBooking(store, booking.reference);
  assert.equal(booking.status, 'CANCELLED');
  assert.equal(tier.booked, 0);
  assert.equal(bookTickets(store, { tierId: tier.id, attendeeName: 'Bayo', quantity: 2 }).quantity, 2);
  assertCode('VALIDATION', () => cancelBooking(store, booking.reference));
  assert.equal(tier.booked, 2);
});
