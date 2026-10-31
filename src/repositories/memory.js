import { DomainError } from '../domain/errors.js';

export function createMemoryRepository() {
  const events = new Map();
  const tiers = new Map();
  const bookings = new Map();
  const bookingsByReference = new Map();

  return {
    async saveEvent(event) {
      events.set(event.id, event);
      return event;
    },
    async getEvent(id) {
      return events.get(id) ?? null;
    },
    async listEvents() {
      return [...events.values()];
    },
    async saveTier(tier) {
      tiers.set(tier.id, tier);
      return tier;
    },
    async getTier(id) {
      return tiers.get(id) ?? null;
    },
    async listTiersForEvent(eventId) {
      return [...tiers.values()].filter(tier => tier.eventId === eventId);
    },
    async saveBooking(booking) {
      bookings.set(booking.id, booking);
      bookingsByReference.set(booking.reference, booking);
      return booking;
    },
    async createBooking(booking) {
      const tier = tiers.get(booking.tierId);
      if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier was not found.');
      if (tier.capacity - tier.booked < booking.quantity) {
        throw new DomainError('SOLD_OUT', 'Not enough seats remain in this ticket tier.');
      }
      tier.booked += booking.quantity;
      bookings.set(booking.id, booking);
      bookingsByReference.set(booking.reference, booking);
      return booking;
    },
    async cancelBooking(booking) {
      const current = bookings.get(booking.id);
      if (!current) throw new DomainError('NOT_FOUND', 'Booking was not found.');
      if (current.status !== 'pending') {
        throw new DomainError('INVALID_TRANSITION', `Booking cannot transition from "${current.status}" to "cancelled".`);
      }
      const tier = tiers.get(current.tierId);
      if (!tier || tier.booked < current.quantity) {
        throw new Error('Booking seats could not be released consistently.');
      }
      tier.booked -= current.quantity;
      current.status = 'cancelled';
      return current;
    },
    async getBookingByReference(reference) {
      return bookingsByReference.get(reference.trim().toUpperCase()) ?? null;
    },
    async listBookings() {
      return [...bookings.values()];
    }
  };
}
