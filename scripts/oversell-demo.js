import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';
import { createMockPaymentGateway } from '../src/lib/mockPaymentGateway.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createEventService } from '../src/services/eventService.js';

const database = createDatabase(':memory:');
const repository = createSqliteRepository(database);
const eventService = createEventService(repository);
const bookingService = createBookingService(repository, createMockPaymentGateway());

try {
  const event = await eventService.createEvent('demo-organizer', {
    title: 'Last Ticket Demo',
    city: 'Lagos',
    venue: 'City Hall',
    date: '2027-01-15',
    capacity: 50
  });
  const tier = await eventService.addTier('demo-organizer', event.id, {
    name: 'General',
    priceCents: 4500,
    capacity: 50
  });
  tier.booked = 49;
  await repository.saveTier(tier);
  await eventService.publishEvent('demo-organizer', event.id);

  const attempts = await Promise.allSettled(
    Array.from({ length: 50 }, (_, index) =>
      bookingService.createBooking(`demo-attendee-${index}`, { tierId: tier.id, quantity: 1 })
    )
  );
  const succeeded = attempts.filter(result => result.status === 'fulfilled').length;
  const soldOut = attempts.filter(
    result => result.status === 'rejected' && result.reason.code === 'SOLD_OUT'
  ).length;
  const finalTier = await repository.getTier(tier.id);

  console.log(`50 booking attempts: ${succeeded} succeeded, ${soldOut} SOLD_OUT.`);
  console.log(`Seats booked: ${finalTier.booked}/${finalTier.capacity}.`);
  if (succeeded !== 1 || soldOut !== 49 || finalTier.booked !== finalTier.capacity) {
    throw new Error('The overselling check did not produce the expected result.');
  }
} finally {
  database.close();
}
