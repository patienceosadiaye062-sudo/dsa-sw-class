import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTier,
  bookTickets,
  createEvent,
  createStore,
  listEventSummaries,
  publishEvent,
  unpublishEvent
} from '../src/domain/Inventory.js';
import { filterEvents, searchEvents, sortEvents } from '../src/domain/eventSearch.js';
import { mergeSort } from '../src/domain/sorting.js';

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

test('S02: events are saved as drafts and drafts are absent from the public list', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());
  assert.ok(event.id);
  assert.equal(event.status, 'draft');
  assert.equal(event.title, 'Lagos Tech Meetup');
  assert.deepEqual(listEventSummaries(store), []);
  assert.equal(listEventSummaries(store, { publishedOnly: false })[0].id, event.id);
});

test('S02: missing title or city and invalid calendar dates fail without saving', () => {
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

test('S03: a tier starts with zero sold and its full capacity left', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());
  const tier = addTier(store, event.id, { name: 'General', priceCents: 500_000, capacity: 100 });
  assert.equal(tier.booked, 0);
  assert.equal(tier.seatsLeft, 100);
});

test('S03: fractional prices, invalid capacities, and unknown event ids are rejected', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());
  assertCode('VALIDATION', () => addTier(store, event.id, { name: 'General', priceCents: 1.5, capacity: 10 }));
  assertCode('VALIDATION', () => addTier(store, event.id, { name: 'General', priceCents: 1, capacity: 0 }));
  assertCode('NOT_FOUND', () => addTier(store, 'missing', { name: 'General', priceCents: 1, capacity: 10 }));
  assert.equal(store.tiers.size, 0);
});

test('S04: publishing a tiered draft exposes it and unpublishing hides it again', () => {
  const store = createStore();
  const { event } = createPublishedEvent(store);
  assert.equal(event.status, 'published');
  assert.equal(listEventSummaries(store).length, 1);
  unpublishEvent(store, event.id);
  assert.equal(event.status, 'draft');
  assert.deepEqual(listEventSummaries(store), []);
});

test('S04: publishing an event without ticket tiers fails with INVALID_STATE', () => {
  const store = createStore();
  const event = createEvent(store, eventInput());
  assertCode('INVALID_STATE', () => publishEvent(store, event.id));
  assert.equal(event.status, 'draft');
  assertCode('NOT_FOUND', () => publishEvent(store, 'missing'));
});

test('S05: text search ignores case and matches title or venue', () => {
  const summaries = [
    { title: 'Lagos Tech Meetup', venue: 'City Hall', city: 'Lagos', date: '2026-12-05', id: '1', tiers: [] },
    { title: 'Abuja Jazz Night', venue: 'Blue Note', city: 'Abuja', date: '2026-12-06', id: '2', tiers: [] }
  ];
  assert.deepEqual(filterEvents(summaries, { q: 'JAZZ' }), [summaries[1]]);
  assert.deepEqual(filterEvents(summaries, { q: 'CITY HALL' }), [summaries[0]]);
});

test('S05: city matching ignores case', () => {
  const summaries = [
    { title: 'Lagos Event', city: 'Lagos', date: '2026-12-05', id: '1', tiers: [] },
    { title: 'Abuja Event', city: 'Abuja', date: '2026-12-06', id: '2', tiers: [] }
  ];
  assert.deepEqual(filterEvents(summaries, { city: 'lagos' }), [summaries[0]]);
});

test('S05: maximum price uses the cheapest tier and excludes events without tiers', () => {
  const summaries = [
    { title: 'Priced', id: '1', tiers: [{ priceCents: 900 }, { priceCents: 300 }] },
    { title: 'Too costly', id: '2', tiers: [{ priceCents: 301 }] },
    { title: 'No tiers', id: '3', tiers: [] }
  ];
  assert.deepEqual(searchEvents(summaries, { maxPriceCents: 300 }, 'price'), [summaries[0]]);
});

test('S05: date sorting puts earlier events first and same-day titles in order', () => {
  const summaries = [
    { title: 'Zulu', id: '1', date: '2026-12-05T08:00:00.000Z' },
    { title: 'Alpha', id: '2', date: '2026-12-05T17:00:00.000Z' },
    { title: 'Earlier', id: '3', date: '2026-12-04T20:00:00.000Z' }
  ];
  assert.deepEqual(sortEvents(summaries, 'date').map(event => event.title), ['Earlier', 'Alpha', 'Zulu']);
});

test('S05: from-date filtering is inclusive and availability sorting puts most seats first', () => {
  const summaries = [
    { title: 'Few Seats', id: '1', date: '2026-12-05', tiers: [{ capacity: 4, booked: 3 }] },
    { title: 'More Seats', id: '2', date: '2026-12-06', tiers: [{ capacity: 10, booked: 2 }] },
    { title: 'Sold Out', id: '3', date: '2026-12-07', tiers: [{ capacity: 2, booked: 2 }] }
  ];
  assert.deepEqual(filterEvents(summaries, { from: '2026-12-05' }), summaries);
  assert.deepEqual(sortEvents(summaries, 'availability').map(event => event.title), ['More Seats', 'Few Seats', 'Sold Out']);
  assert.deepEqual(filterEvents(summaries, { onlyAvailable: true }).map(event => event.title), ['Few Seats', 'More Seats']);
});

test('S05: price sorting puts events without ticket tiers last', () => {
  const summaries = [
    { title: 'No Tiers', id: '3', tiers: [] },
    { title: 'Expensive', id: '2', tiers: [{ priceCents: 500 }] },
    { title: 'Cheap', id: '1', tiers: [{ priceCents: 200 }] }
  ];
  assert.deepEqual(sortEvents(summaries, 'price').map(event => event.title), ['Cheap', 'Expensive', 'No Tiers']);
});

test('S05: a date-only upper bound includes all events on that calendar date', () => {
  const event = { title: 'Evening Show', id: '1', date: '2026-12-05T17:00:00.000Z' };
  assert.deepEqual(filterEvents([event], { to: '2026-12-05' }), [event]);
});

test('S05: invalid dates, fractional prices, and unknown sort options fail with VALIDATION', () => {
  assertCode('VALIDATION', () => filterEvents([], { from: 'not-a-date' }));
  assertCode('VALIDATION', () => filterEvents([], { maxPriceCents: 1.5 }));
  assertCode('VALIDATION', () => sortEvents([], 'unknown'));
});

test('S05: filtering and sorting leave their input list unchanged', () => {
  const first = { title: 'Zulu', id: '2', city: 'Lagos', date: '2026-12-05', tiers: [] };
  const second = { title: 'Alpha', id: '1', city: 'Lagos', date: '2026-12-04', tiers: [] };
  const original = [first, second];
  const snapshot = [...original];
  filterEvents(original, { city: 'lagos' });
  const sorted = sortEvents(original, 'date');
  assert.deepEqual(original, snapshot);
  assert.notStrictEqual(sorted, original);
});

test('mergeSort is stable, returns a new array, and handles empty input', () => {
  const items = [{ key: 1, order: 'first' }, { key: 1, order: 'second' }, { key: 0, order: 'zero' }];
  const sorted = mergeSort(items, (left, right) => left.key - right.key);
  assert.deepEqual(sorted.map(item => item.order), ['zero', 'first', 'second']);
  assert.notStrictEqual(sorted, items);
  assert.deepEqual(items.map(item => item.order), ['first', 'second', 'zero']);
  assert.deepEqual(mergeSort([], () => 0), []);
});

test('S06: booking creates a pending booking priced in whole cents and reserves seats', () => {
  const store = createStore();
  const { tier } = createPublishedEvent(store, eventInput({ capacity: 3 }), {
    name: 'General',
    priceCents: 4_500,
    capacity: 3
  });
  const booking = bookTickets(store, { tierId: tier.id, attendeeName: 'Ada', quantity: 2 });
  assert.equal(booking.status, 'PENDING');
  assert.equal(booking.quantity, 2);
  assert.equal(booking.unitPriceCents, 4_500);
  assert.equal(booking.totalPriceCents, 9_000);
  assert.equal(tier.seatsLeft, 1);
});

test('S06: sold-out booking is rejected without changing inventory', () => {
  const store = createStore();
  const { tier } = createPublishedEvent(store, eventInput({ capacity: 3 }), {
    name: 'General',
    priceCents: 4_500,
    capacity: 3
  });
  bookTickets(store, { tierId: tier.id, attendeeName: 'Ada', quantity: 2 });
  assertCode('SOLD_OUT', () => bookTickets(store, { tierId: tier.id, attendeeName: 'Bayo', quantity: 2 }));
  assert.equal(tier.booked, 2);
  assert.equal(store.bookings.size, 1);
});

test('S06: quantities outside 1 through 10 are rejected', () => {
  const store = createStore();
  const { tier } = createPublishedEvent(store);
  for (const quantity of [0, -1, 1.5, 11]) {
    assertCode('VALIDATION', () => bookTickets(store, { tierId: tier.id, attendeeName: 'Ada', quantity }));
  }
  assert.equal(store.bookings.size, 0);
  assert.equal(tier.booked, 0);
});
