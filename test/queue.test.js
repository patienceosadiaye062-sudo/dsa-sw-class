import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addTier,
  bookTickets,
  createEvent,
  createStore,
  joinWaitlist,
  publishEvent
} from '../src/domain/Inventory.js';
import { Queue } from '../src/domain/waitlistQueue.js';

test('Queue is FIFO, reports its size, and can be reused after becoming empty', () => {
  const queue = new Queue();
  assert.equal(queue.size, 0);
  assert.equal(queue.peek(), undefined);
  assert.equal(queue.dequeue(), undefined);

  queue.enqueue('Ada');
  queue.enqueue('Bayo');
  assert.equal(queue.size, 2);
  assert.equal(queue.peek(), 'Ada');
  assert.equal(queue.dequeue(), 'Ada');
  assert.equal(queue.dequeue(), 'Bayo');
  assert.equal(queue.size, 0);

  queue.enqueue('Chidi');
  assert.equal(queue.dequeue(), 'Chidi');
  assert.equal(queue.dequeue(), undefined);
});

test('waitlist preserves FIFO order when attendees join', () => {
  const store = createStore();
  const event = createEvent(store, {
    title: 'Summer Sounds',
    city: 'Lagos',
    venue: 'City Hall',
    date: '2026-12-05',
    capacity: 3
  });
  const tier = addTier(store, event.id, { name: 'General', priceCents: 100, capacity: 3 });
  publishEvent(store, event.id);
  bookTickets(store, { tierId: tier.id, attendeeName: 'Sold Out Attendee', quantity: 3 });
  joinWaitlist(store, { eventId: event.id, attendeeName: 'Ada', quantity: 2 });
  joinWaitlist(store, { eventId: event.id, attendeeName: 'Bayo', quantity: 1 });

  assert.equal(event.waitlist.size, 2);
  assert.equal(event.waitlist.dequeue().attendeeName, 'Ada');
  assert.equal(event.waitlist.dequeue().attendeeName, 'Bayo');
  assert.equal(event.waitlist.dequeue(), undefined);
});

test('waitlist is unavailable for drafts or while the requested quantity is available', () => {
  const store = createStore();
  const draft = createEvent(store, {
    title: 'Draft',
    city: 'Lagos',
    venue: 'City Hall',
    date: '2026-12-05',
    capacity: 2
  });
  assert.throws(
    () => joinWaitlist(store, { eventId: draft.id, attendeeName: 'Ada' }),
    error => error.code === 'INVALID_STATE'
  );

  const event = createEvent(store, {
    title: 'Published',
    city: 'Lagos',
    venue: 'City Hall',
    date: '2026-12-06',
    capacity: 2
  });
  const tier = addTier(store, event.id, { name: 'General', priceCents: 100, capacity: 2 });
  publishEvent(store, event.id);
  assert.throws(
    () => joinWaitlist(store, { eventId: event.id, attendeeName: 'Ada', quantity: 2 }),
    error => error.code === 'NOT_SOLD_OUT'
  );
  assert.equal(tier.booked, 0);
  assert.equal(event.waitlist.size, 0);
});

test('waitlist accepts a quantity that no single ticket tier can fulfill', () => {
  const store = createStore();
  const event = createEvent(store, {
    title: 'Mixed Tiers',
    city: 'Lagos',
    venue: 'City Hall',
    date: '2026-12-07',
    capacity: 4
  });
  const general = addTier(store, event.id, { name: 'General', priceCents: 100, capacity: 2 });
  const vip = addTier(store, event.id, { name: 'VIP', priceCents: 200, capacity: 2 });
  publishEvent(store, event.id);
  bookTickets(store, { tierId: general.id, attendeeName: 'Ada', quantity: 1 });
  bookTickets(store, { tierId: vip.id, attendeeName: 'Bayo', quantity: 1 });

  const entry = joinWaitlist(store, { eventId: event.id, attendeeName: 'Chidi', quantity: 2 });
  assert.equal(entry.quantity, 2);
  assert.equal(event.waitlist.size, 1);
});
