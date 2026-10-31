import { DomainError } from '../domain/errors.js';
import { createRouter } from './router.js';

function requireUserId(request) {
  const userId = request.headers['x-user-id'];
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new DomainError('UNAUTHORIZED', 'The x-user-id header is required.');
  }
  return userId.trim();
}

function queryBoolean(value, name) {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new DomainError('VALIDATION', `${name} must be true or false.`);
}

function queryCents(value) {
  if (value === undefined) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new DomainError('VALIDATION', 'Maximum price must be a non-negative whole number of cents.');
  }
  const cents = Number(value);
  if (!Number.isSafeInteger(cents)) {
    throw new DomainError('VALIDATION', 'Maximum price must be a non-negative whole number of cents.');
  }
  return cents;
}

export function createApiRouter({ eventService, bookingService }) {
  if (!eventService || !bookingService) throw new TypeError('Event and booking services are required.');

  const router = createRouter();
  router.add('POST', '/api/events', async ({ request, body }) => ({
    status: 201,
    body: await eventService.createEvent(requireUserId(request), body)
  }));
  router.add('POST', '/api/events/:id/tiers', async ({ request, params, body }) => ({
    status: 201,
    body: await eventService.addTier(requireUserId(request), params.id, body)
  }));
  router.add('POST', '/api/events/:id/publish', async ({ request, params }) => ({
    body: await eventService.publishEvent(requireUserId(request), params.id)
  }));
  router.add('GET', '/api/events', async ({ request }) => {
    const query = new URL(request.url, 'http://localhost').searchParams;
    const criteria = {
      q: query.get('q') ?? undefined,
      city: query.get('city') ?? undefined,
      from: query.get('from') ?? undefined,
      to: query.get('to') ?? undefined,
      maxPriceCents: queryCents(query.get('maxPriceCents') ?? undefined),
      onlyAvailable: queryBoolean(query.get('onlyAvailable') ?? undefined, 'onlyAvailable')
    };
    return { body: await eventService.search(criteria, query.get('sort') ?? 'date') };
  });
  router.add('POST', '/api/bookings', async ({ request, body }) => ({
    status: 201,
    body: await bookingService.createBooking(requireUserId(request), body)
  }));
  router.add('POST', '/api/bookings/:reference/pay', async ({ request, params, body }) => ({
    body: await bookingService.payBooking(requireUserId(request), params.reference, body)
  }));
  router.add('POST', '/api/bookings/:reference/cancel', async ({ request, params }) => ({
    body: await bookingService.cancelBooking(requireUserId(request), params.reference)
  }));
  return router;
}
