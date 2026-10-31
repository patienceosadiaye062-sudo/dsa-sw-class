import { DomainError } from '../domain/errors.js';
import { parseIsoDate } from '../domain/dateUtils.js';
import { newId } from '../domain/ids.js';
import { searchEvents } from '../domain/eventSearch.js';

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${label} must be an object.`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new DomainError('VALIDATION', `${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainError('VALIDATION', `${label} must be a positive safe integer.`);
  }
  return value;
}

function requireOwner(event, userId) {
  if (event.organizerId !== userId) {
    throw new DomainError('FORBIDDEN', 'Only the event organizer can change this event.');
  }
}

export function createEventService(repository) {
  if (!repository) throw new TypeError('An event repository is required.');

  return {
    async createEvent(userId, input) {
      requireObject(input, 'Event');
      const { title, city, venue, date, capacity } = input;
      const eventTitle = requireText(title, 'Event title');
      const event = {
        id: newId(),
        organizerId: userId,
        title: eventTitle,
        name: eventTitle,
        city: requireText(city, 'Event city'),
        venue: requireText(venue, 'Event venue'),
        date,
        status: 'draft',
        capacity: requirePositiveInteger(capacity, 'Capacity')
      };
      parseIsoDate(date, 'Event date');
      return repository.saveEvent(event);
    },

    async addTier(userId, eventId, input) {
      requireObject(input, 'Ticket tier');
      const event = await repository.getEvent(eventId);
      if (!event) throw new DomainError('NOT_FOUND', 'Event was not found.');
      requireOwner(event, userId);

      const { name, priceCents, capacity } = input;
      const tierName = requireText(name, 'Ticket tier name');
      if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
        throw new DomainError('VALIDATION', 'Price must be a non-negative whole number of cents.');
      }
      const tierCapacity = requirePositiveInteger(capacity, 'Ticket tier capacity');
      const existingTiers = await repository.listTiersForEvent(eventId);
      const totalCapacity = existingTiers.reduce((sum, tier) => sum + tier.capacity, 0);
      if (totalCapacity + tierCapacity > event.capacity) {
        throw new DomainError('VALIDATION', 'Ticket tier capacity cannot exceed event capacity.');
      }

      return repository.saveTier({
        id: newId(),
        eventId,
        name: tierName,
        priceCents,
        capacity: tierCapacity,
        booked: 0
      });
    },

    async publishEvent(userId, eventId) {
      const event = await repository.getEvent(eventId);
      if (!event) throw new DomainError('NOT_FOUND', 'Event was not found.');
      requireOwner(event, userId);
      if (event.status === 'published') {
        throw new DomainError('INVALID_STATE', 'Event is already published.');
      }
      const tiers = await repository.listTiersForEvent(eventId);
      if (tiers.length === 0) {
        throw new DomainError('INVALID_STATE', 'An event needs at least one ticket tier before it can be published.');
      }
      event.status = 'published';
      return repository.saveEvent(event);
    },

    async search(criteria = {}, sortBy = 'date') {
      const events = (await repository.listEvents()).filter(event => event.status === 'published');
      const summaries = await Promise.all(events.map(async event => ({
        id: event.id,
        title: event.title,
        name: event.title,
        city: event.city,
        venue: event.venue,
        date: event.date,
        status: event.status,
        tiers: (await repository.listTiersForEvent(event.id)).map(tier => ({
          id: tier.id,
          name: tier.name,
          priceCents: tier.priceCents,
          capacity: tier.capacity,
          booked: tier.booked,
          seatsLeft: tier.capacity - tier.booked
        }))
      })));
      return searchEvents(summaries, criteria, sortBy);
    }
  };
}
