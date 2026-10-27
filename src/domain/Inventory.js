import { DomainError } from './errors.js';
import { newId, newReference } from './ids.js';
import { Queue } from './waitlistQueue.js';
import { parseIsoDate } from './dateUtils.js';

export function createStore() {
  return { events: new Map(), tiers: new Map(), bookings: new Map(), bookingsByReference: new Map(), waitlists: new Map() };
}

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new DomainError('VALIDATION', label + ' must be an object.');
  return value;
}
function requireStore(store) {
  if (!store || !(store.events instanceof Map) || !(store.tiers instanceof Map) || !(store.bookings instanceof Map) || !(store.bookingsByReference instanceof Map) || !(store.waitlists instanceof Map)) throw new DomainError('VALIDATION', 'A valid store is required.');
}
function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new DomainError('VALIDATION', label + ' must be a non-empty string.');
  return value.trim();
}
function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new DomainError('VALIDATION', label + ' must be a positive safe integer.');
  return value;
}

export function createEvent(store, input) {
  requireStore(store);
  const { title, city, venue, date, capacity } = requireObject(input, 'Event');
  const eventTitle = requiredText(title, 'Event title');
  const eventCity = requiredText(city, 'Event city');
  const eventVenue = requiredText(venue, 'Event venue');
  parseIsoDate(date, 'Event date');
  const event = {
    id: newId(),
    title: eventTitle,
    name: eventTitle,
    city: eventCity,
    venue: eventVenue,
    date,
    status: 'draft',
    capacity: positiveInteger(capacity, 'Capacity'),
    tierIds: new Set(),
    waitlist: new Queue()
  };
  store.events.set(event.id, event);
  store.waitlists.set(event.id, event.waitlist);
  return event;
}

export function addTier(store, eventId, input) {
  requireStore(store);
  const { name, priceCents, capacity } = requireObject(input, 'Tier');
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event was not found.');
  requiredText(name, 'Tier name');
  if (!Number.isSafeInteger(priceCents) || priceCents < 0) throw new DomainError('VALIDATION', 'Price must be a non-negative whole number of cents.');
  positiveInteger(capacity, 'Tier capacity');
  const totalTierCapacity = [...event.tierIds].reduce((sum, id) => sum + store.tiers.get(id).capacity, 0);
  if (totalTierCapacity + capacity > event.capacity) throw new DomainError('VALIDATION', 'Ticket tier capacity cannot exceed event capacity.');
  const tier = {
    id: newId(),
    eventId,
    name: name.trim(),
    priceCents,
    capacity,
    booked: 0,
    get seatsLeft() { return this.capacity - this.booked; }
  };
  store.tiers.set(tier.id, tier);
  event.tierIds.add(tier.id);
  return tier;
}

export function publishEvent(store, eventId) {
  requireStore(store);
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event was not found.');
  if (event.tierIds.size === 0) throw new DomainError('INVALID_STATE', 'An event needs at least one ticket tier before it can be published.');
  event.status = 'published';
  return event;
}

export function unpublishEvent(store, eventId) {
  requireStore(store);
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event was not found.');
  event.status = 'draft';
  return event;
}

export function listEventSummaries(store, options = {}) {
  requireStore(store);
  const { publishedOnly = true } = requireObject(options, 'List options');
  if (typeof publishedOnly !== 'boolean') throw new DomainError('VALIDATION', 'publishedOnly must be a boolean.');
  return [...store.events.values()]
    .filter(event => !publishedOnly || event.status === 'published')
    .map(event => {
      const tiers = [...event.tierIds].map(id => {
        const tier = store.tiers.get(id);
        return {
          id: tier.id,
          name: tier.name,
          priceCents: tier.priceCents,
          capacity: tier.capacity,
          booked: tier.booked,
          seatsLeft: tier.seatsLeft
        };
      });
      return {
        id: event.id,
        title: event.title,
        name: event.title,
        city: event.city,
        venue: event.venue,
        date: event.date,
        status: event.status,
        tiers
      };
    });
}

export function bookTickets(store, input) {
  requireStore(store);
  const { tierId, attendeeName, quantity } = requireObject(input, 'Booking');
  requiredText(attendeeName, 'Attendee name');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) throw new DomainError('VALIDATION', 'A booking must contain between 1 and 10 tickets.');
  const tier = store.tiers.get(tierId);
  if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier was not found.');
  const event = store.events.get(tier.eventId);
  if (event.status !== 'published') throw new DomainError('INVALID_STATE', 'Tickets can only be booked for published events.');
  if (tier.capacity - tier.booked < quantity) throw new DomainError('SOLD_OUT', 'Not enough seats remain in this ticket tier.');
  const totalPriceCents = tier.priceCents * quantity;
  if (!Number.isSafeInteger(totalPriceCents)) throw new DomainError('VALIDATION', 'Booking total must be a safe whole number of cents.');
  const booking = {
    id: newId(),
    reference: newReference(),
    tierId,
    eventId: tier.eventId,
    attendeeName: attendeeName.trim(),
    quantity,
    unitPriceCents: tier.priceCents,
    totalPriceCents,
    status: 'PENDING'
  };
  tier.booked += quantity;
  store.bookings.set(booking.id, booking);
  store.bookingsByReference.set(booking.reference, booking);
  return booking;
}

export function cancelBooking(store, reference) {
  requireStore(store);
  requiredText(reference, 'Booking reference');
  const booking = store.bookingsByReference.get(reference.trim().toUpperCase());
  if (!booking) throw new DomainError('NOT_FOUND', 'Booking was not found.');
  if (booking.status === 'CANCELLED') throw new DomainError('VALIDATION', 'Booking has already been cancelled.');
  const tier = store.tiers.get(booking.tierId);
  tier.booked -= booking.quantity;
  booking.status = 'CANCELLED';
  return booking;
}

export function findBookingByReference(store, reference) {
  requireStore(store);
  requiredText(reference, 'Booking reference');
  const booking = store.bookingsByReference.get(reference.trim().toUpperCase());
  if (!booking) throw new DomainError('NOT_FOUND', 'Booking was not found.');
  return booking;
}

export function joinWaitlist(store, input) {
  requireStore(store);
  const { eventId, attendeeName, quantity = 1 } = requireObject(input, 'Waitlist entry');
  const event = store.events.get(eventId);
  if (!event) throw new DomainError('NOT_FOUND', 'Event was not found.');
  const name = requiredText(attendeeName, 'Attendee name');
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) throw new DomainError('VALIDATION', 'Waitlist quantity must be between 1 and 10.');
  const entry = { id: newId(), eventId, attendeeName: name, quantity, joinedAt: new Date().toISOString() };
  event.waitlist.enqueue(entry);
  return entry;
}
