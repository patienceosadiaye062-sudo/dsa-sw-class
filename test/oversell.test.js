import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createEventService } from '../src/services/eventService.js';

test('50 simultaneous bookings for the last seat produce one booking', async () => {
  const database = createDatabase(':memory:');
  try {
    const repository = createSqliteRepository(database);
    const eventService = createEventService(repository);
    const bookingService = createBookingService(repository, createMockPaymentGateway());

    const event = await eventService.createEvent('organizer-1', {
      title: 'One Seat',
      city: 'Lagos',
      venue: 'Hall',
      date: '2027-01-15',
      capacity: 50
    });
    const tier = await eventService.addTier('organizer-1', event.id, {
      name: 'General',
      priceCents: 100,
      capacity: 50
    });
    tier.booked = 49;
    await repository.saveTier(tier);
    await eventService.publishEvent('organizer-1', event.id);

    const attempts = await Promise.allSettled(
      Array.from({ length: 50 }, (_, index) =>
        bookingService.createBooking(`attendee-${index + 1}`, { tierId: tier.id, quantity: 1 })
      )
    );
    const successes = attempts.filter(result => result.status === 'fulfilled');
    const soldOut = attempts.filter(
      result => result.status === 'rejected' && result.reason.code === 'SOLD_OUT'
    );

    assert.equal(successes.length, 1);
    assert.equal(soldOut.length, 49);
    assert.equal((await repository.getTier(tier.id)).booked, 50);
    assert.equal((await repository.listBookings()).length, 1);
  } finally {
    database.close();
  }
});

test('cancelling a pending SQLite booking releases its seats exactly once', async () => {
  const database = createDatabase(':memory:');
  try {
    const repository = createSqliteRepository(database);
    const eventService = createEventService(repository);
    const bookingService = createBookingService(repository, createMockPaymentGateway());

    const event = await eventService.createEvent('organizer-1', {
      title: 'Cancellation',
      city: 'Lagos',
      venue: 'Hall',
      date: '2027-01-15',
      capacity: 2
    });
    const tier = await eventService.addTier('organizer-1', event.id, {
      name: 'General',
      priceCents: 100,
      capacity: 2
    });
    await eventService.publishEvent('organizer-1', event.id);
    const booking = await bookingService.createBooking('attendee-1', { tierId: tier.id, quantity: 1 });

    await bookingService.cancelBooking('attendee-1', booking.reference);
    await assert.rejects(
      bookingService.cancelBooking('attendee-1', booking.reference),
      error => error.code === 'INVALID_TRANSITION'
    );
    assert.equal((await repository.getTier(tier.id)).booked, 0);
    assert.equal((await repository.getBookingByReference(booking.reference)).status, 'cancelled');
  } finally {
    database.close();
  }
});

test('SQLite data remains available after reopening the database', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ticketing-build5-'));
  const databasePath = path.join(directory, 'ticketing.sqlite');
  let database = createDatabase(databasePath);

  try {
    const repository = createSqliteRepository(database);
    await repository.saveEvent({
      id: 'persistent-event',
      organizerId: 'organizer-1',
      title: 'Persistent event',
      name: 'Persistent event',
      city: 'Lagos',
      venue: 'Hall',
      date: '2027-01-15',
      status: 'draft',
      capacity: 1
    });
    database.close();

    database = createDatabase(databasePath);
    const reopenedRepository = createSqliteRepository(database);
    assert.equal((await reopenedRepository.getEvent('persistent-event')).title, 'Persistent event');
  } finally {
    database.close();
    await rm(directory, { recursive: true, force: true });
  }
});
