import assert from 'node:assert/strict';
import test from 'node:test';
import { sortEvents } from '../src/domain/eventSearch.js';
import { mergeSort } from '../src/domain/sorting.js';

test('date sorting orders calendar dates and same-day titles', () => {
  const summaries = [
    { title: 'Zulu', id: '1', date: '2026-12-05T08:00:00.000Z' },
    { title: 'Alpha', id: '2', date: '2026-12-05T17:00:00.000Z' },
    { title: 'Earlier', id: '3', date: '2026-12-04T20:00:00.000Z' }
  ];
  assert.deepEqual(sortEvents(summaries, 'date').map(event => event.title), ['Earlier', 'Alpha', 'Zulu']);
});

test('availability sorting puts events with more seats first', () => {
  const summaries = [
    { title: 'Few Seats', id: '1', tiers: [{ capacity: 4, booked: 3 }] },
    { title: 'More Seats', id: '2', tiers: [{ capacity: 10, booked: 2 }] },
    { title: 'Sold Out', id: '3', tiers: [{ capacity: 2, booked: 2 }] }
  ];
  assert.deepEqual(sortEvents(summaries, 'availability').map(event => event.title), ['More Seats', 'Few Seats', 'Sold Out']);
});

test('price sorting puts events without ticket tiers last', () => {
  const summaries = [
    { title: 'No Tiers', id: '3', tiers: [] },
    { title: 'Expensive', id: '2', tiers: [{ priceCents: 500 }] },
    { title: 'Cheap', id: '1', tiers: [{ priceCents: 200 }] }
  ];
  assert.deepEqual(sortEvents(summaries, 'price').map(event => event.title), ['Cheap', 'Expensive', 'No Tiers']);
});

test('sorting leaves its input unchanged and returns a new list', () => {
  const events = [
    { title: 'Zulu', id: '2', date: '2026-12-05', tiers: [] },
    { title: 'Alpha', id: '1', date: '2026-12-04', tiers: [] }
  ];
  const sorted = sortEvents(events, 'date');
  assert.deepEqual(events.map(event => event.title), ['Zulu', 'Alpha']);
  assert.notStrictEqual(sorted, events);
});

test('mergeSort is stable, returns a new array, and handles empty input', () => {
  const items = [{ key: 1, order: 'first' }, { key: 1, order: 'second' }, { key: 0, order: 'zero' }];
  const sorted = mergeSort(items, (left, right) => left.key - right.key);
  assert.deepEqual(sorted.map(item => item.order), ['zero', 'first', 'second']);
  assert.notStrictEqual(sorted, items);
  assert.deepEqual(items.map(item => item.order), ['first', 'second', 'zero']);
  assert.deepEqual(mergeSort([], () => 0), []);
});

test('unknown sort options produce a VALIDATION error', () => {
  assert.throws(() => sortEvents([], 'unknown'), { code: 'VALIDATION' });
});
