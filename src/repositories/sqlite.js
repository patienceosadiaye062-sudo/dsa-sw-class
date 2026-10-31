import { DomainError } from '../domain/errors.js';

function eventFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    organizerId: row.organizer_id,
    title: row.title,
    name: row.title,
    city: row.city,
    venue: row.venue,
    date: row.date,
    status: row.status,
    capacity: row.capacity
  };
}

function tierFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    priceCents: row.price_cents,
    capacity: row.capacity,
    booked: row.booked
  };
}

function bookingFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    reference: row.reference,
    userId: row.user_id,
    eventId: row.event_id,
    tierId: row.tier_id,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    totalPriceCents: row.total_price_cents,
    status: row.status
  };
}

function inTransaction(database, run) {
  database.exec('BEGIN IMMEDIATE');
  try {
    const result = run();
    database.exec('COMMIT');
    return result;
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
}

export function createSqliteRepository(database) {
  if (!database) throw new TypeError('A SQLite database connection is required.');

  const statements = {
    ensureUser: database.prepare('INSERT INTO users (id) VALUES (?) ON CONFLICT (id) DO NOTHING'),
    getEvent: database.prepare('SELECT * FROM events WHERE id = ?'),
    listEvents: database.prepare('SELECT * FROM events'),
    getTier: database.prepare('SELECT * FROM ticket_tiers WHERE id = ?'),
    listTiersForEvent: database.prepare('SELECT * FROM ticket_tiers WHERE event_id = ?'),
    getBookingByReference: database.prepare('SELECT * FROM bookings WHERE reference = ?'),
    listBookings: database.prepare('SELECT * FROM bookings'),
    reserveSeats: database.prepare(
      'UPDATE ticket_tiers SET booked = booked + ? WHERE id = ? AND booked + ? <= capacity'
    ),
    insertBooking: database.prepare(`
      INSERT INTO bookings (
        id, reference, user_id, event_id, tier_id, quantity,
        unit_price_cents, total_price_cents, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),
    saveBooking: database.prepare(`
      INSERT INTO bookings (
        id, reference, user_id, event_id, tier_id, quantity,
        unit_price_cents, total_price_cents, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET reference = excluded.reference,
        user_id = excluded.user_id, event_id = excluded.event_id,
        tier_id = excluded.tier_id, quantity = excluded.quantity,
        unit_price_cents = excluded.unit_price_cents,
        total_price_cents = excluded.total_price_cents, status = excluded.status
    `),
    cancelBooking: database.prepare(
      "UPDATE bookings SET status = 'cancelled' WHERE id = ? AND status = 'pending'"
    ),
    releaseSeats: database.prepare(
      'UPDATE ticket_tiers SET booked = booked - ? WHERE id = ? AND booked >= ?'
    )
  };

  return {
    async saveEvent(event) {
      statements.ensureUser.run(event.organizerId);
      database.prepare(`
        INSERT INTO events (id, organizer_id, title, city, venue, date, status, capacity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET organizer_id = excluded.organizer_id,
          title = excluded.title, city = excluded.city, venue = excluded.venue,
          date = excluded.date, status = excluded.status, capacity = excluded.capacity
      `).run(event.id, event.organizerId, event.title, event.city, event.venue, event.date, event.status, event.capacity);
      return event;
    },

    async getEvent(id) {
      return eventFromRow(statements.getEvent.get(id));
    },

    async listEvents() {
      return statements.listEvents.all().map(eventFromRow);
    },

    async saveTier(tier) {
      database.prepare(`
        INSERT INTO ticket_tiers (id, event_id, name, price_cents, capacity, booked)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET event_id = excluded.event_id, name = excluded.name,
          price_cents = excluded.price_cents, capacity = excluded.capacity, booked = excluded.booked
      `).run(tier.id, tier.eventId, tier.name, tier.priceCents, tier.capacity, tier.booked);
      return tier;
    },

    async getTier(id) {
      return tierFromRow(statements.getTier.get(id));
    },

    async listTiersForEvent(eventId) {
      return statements.listTiersForEvent.all(eventId).map(tierFromRow);
    },

    async createBooking(booking) {
      return inTransaction(database, () => {
        statements.ensureUser.run(booking.userId);
        const reservation = statements.reserveSeats.run(booking.quantity, booking.tierId, booking.quantity);
        if (Number(reservation.changes) === 0) {
          if (!statements.getTier.get(booking.tierId)) {
            throw new DomainError('NOT_FOUND', 'Ticket tier was not found.');
          }
          throw new DomainError('SOLD_OUT', 'Not enough seats remain in this ticket tier.');
        }
        statements.insertBooking.run(
          booking.id,
          booking.reference,
          booking.userId,
          booking.eventId,
          booking.tierId,
          booking.quantity,
          booking.unitPriceCents,
          booking.totalPriceCents,
          booking.status
        );
        return booking;
      });
    },

    async saveBooking(booking) {
      statements.ensureUser.run(booking.userId);
      statements.saveBooking.run(
        booking.id,
        booking.reference,
        booking.userId,
        booking.eventId,
        booking.tierId,
        booking.quantity,
        booking.unitPriceCents,
        booking.totalPriceCents,
        booking.status
      );
      return booking;
    },

    async cancelBooking(booking) {
      return inTransaction(database, () => {
        const statusUpdate = statements.cancelBooking.run(booking.id);
        if (Number(statusUpdate.changes) === 0) {
          const current = database.prepare('SELECT status FROM bookings WHERE id = ?').get(booking.id);
          if (!current) throw new DomainError('NOT_FOUND', 'Booking was not found.');
          throw new DomainError('INVALID_TRANSITION', `Booking cannot transition from "${current.status}" to "cancelled".`);
        }
        const release = statements.releaseSeats.run(booking.quantity, booking.tierId, booking.quantity);
        if (Number(release.changes) === 0) {
          throw new Error('Booking seats could not be released consistently.');
        }
        return { ...booking, status: 'cancelled' };
      });
    },

    async getBookingByReference(reference) {
      return bookingFromRow(statements.getBookingByReference.get(reference.trim().toUpperCase()));
    },

    async listBookings() {
      return statements.listBookings.all().map(bookingFromRow);
    }
  };
}
