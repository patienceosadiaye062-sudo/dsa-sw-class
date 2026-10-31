import assert from 'node:assert/strict';
import test from 'node:test';
import { createEvent, createStore, joinWaitlist } from '../src/domain/Inventory.js';
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
  joinWaitlist(store, { eventId: event.id, attendeeName: 'Ada', quantity: 2 });
  joinWaitlist(store, { eventId: event.id, attendeeName: 'Bayo', quantity: 1 });

  assert.equal(event.waitlist.size, 2);
  assert.equal(event.waitlist.dequeue().attendeeName, 'Ada');
  assert.equal(event.waitlist.dequeue().attendeeName, 'Bayo');
  assert.equal(event.waitlist.dequeue(), undefined);
});
