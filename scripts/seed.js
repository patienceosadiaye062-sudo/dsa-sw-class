import { createDatabase } from '../src/db/connection.js';
import { createSqliteRepository } from '../src/repositories/sqlite.js';

const database = createDatabase();
const repository = createSqliteRepository(database);

try {
  const eventId = 'seed-lagos-tech-meetup';
  const tierId = 'seed-lagos-tech-general';
  let event = await repository.getEvent(eventId);

  if (!event) {
    event = {
      id: eventId,
      organizerId: 'seed-organizer',
      title: 'Lagos Tech Meetup',
      name: 'Lagos Tech Meetup',
      city: 'Lagos',
      venue: 'City Hall',
      date: '2027-01-15',
      status: 'published',
      capacity: 100
    };
    await repository.saveEvent(event);
  }

  if (!(await repository.getTier(tierId))) {
    await repository.saveTier({
      id: tierId,
      eventId,
      name: 'General',
      priceCents: 4500,
      capacity: 100,
      booked: 0
    });
  }

  console.log(`Seed event ready: ${eventId}`);
} finally {
  database.close();
}
