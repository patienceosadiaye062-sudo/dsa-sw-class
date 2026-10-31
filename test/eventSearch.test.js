import assert from 'node:assert/strict';
import test from 'node:test';
import { filterEvents, searchEvents } from '../src/domain/eventSearch.js';

test('text search ignores case and matches title or venue', () => {
  const summaries = [
    { title: 'Lagos Tech Meetup', venue: 'City Hall', city: 'Lagos', date: '2026-12-05', id: '1', tiers: [] },
    { title: 'Abuja Jazz Night', venue: 'Blue Note', city: 'Abuja', date: '2026-12-06', id: '2', tiers: [] }
  ];
  assert.deepEqual(filterEvents(summaries, { q: 'JAZZ' }), [summaries[1]]);
  assert.deepEqual(filterEvents(summaries, { q: 'CITY HALL' }), [summaries[0]]);
});

test('city matching ignores case', () => {
  const summaries = [
    { title: 'Lagos Event', city: 'Lagos', date: '2026-12-05', id: '1', tiers: [] },
    { title: 'Abuja Event', city: 'Abuja', date: '2026-12-06', id: '2', tiers: [] }
  ];
  assert.deepEqual(filterEvents(summaries, { city: 'lagos' }), [summaries[0]]);
});

test('maximum price uses the cheapest tier and excludes events without tiers', () => {
  const summaries = [
    { title: 'Priced', id: '1', tiers: [{ priceCents: 900 }, { priceCents: 300 }] },
    { title: 'Too costly', id: '2', tiers: [{ priceCents: 301 }] },
    { title: 'No tiers', id: '3', tiers: [] }
  ];
  assert.deepEqual(searchEvents(summaries, { maxPriceCents: 300 }, 'price'), [summaries[0]]);
});

test('date bounds include their boundary dates', () => {
  const summaries = [
    { title: 'First day', date: '2026-12-05', id: '1', tiers: [] },
    { title: 'Last day evening', date: '2026-12-07T23:59:00.000Z', id: '2', tiers: [] },
    { title: 'After range', date: '2026-12-08', id: '3', tiers: [] }
  ];
  assert.deepEqual(filterEvents(summaries, { from: '2026-12-05', to: '2026-12-07' }), summaries.slice(0, 2));
});

test('date-only upper bound includes all events on that calendar date', () => {
  const event = { title: 'Evening Show', id: '1', date: '2026-12-05T17:00:00.000Z' };
  assert.deepEqual(filterEvents([event], { to: '2026-12-05' }), [event]);
});

test('availability filter excludes sold-out events', () => {
  const summaries = [
    { title: 'Available', tiers: [{ capacity: 4, booked: 3 }] },
    { title: 'Sold Out', tiers: [{ capacity: 2, booked: 2 }] }
  ];
  assert.deepEqual(filterEvents(summaries, { onlyAvailable: true }), [summaries[0]]);
});

test('filtering leaves its input list unchanged', () => {
  const first = { title: 'Zulu', id: '2', city: 'Lagos', date: '2026-12-05', tiers: [] };
  const second = { title: 'Alpha', id: '1', city: 'Lagos', date: '2026-12-04', tiers: [] };
  const original = [first, second];
  assert.deepEqual(filterEvents(original, { city: 'lagos' }), original);
  assert.deepEqual(original, [first, second]);
});

test('invalid criteria produce VALIDATION errors', () => {
  assert.throws(() => filterEvents([], { from: 'not-a-date' }), { code: 'VALIDATION' });
  assert.throws(() => filterEvents([], { maxPriceCents: 1.5 }), { code: 'VALIDATION' });
  assert.throws(() => filterEvents([], { onlyAvailable: 'true' }), { code: 'VALIDATION' });
  assert.throws(() => filterEvents(null), { code: 'VALIDATION' });
});
