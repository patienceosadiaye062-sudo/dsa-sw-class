import { once } from 'node:events';
import { createApiRouter } from '../src/http/apiRoutes.js';
import { createApp } from '../src/http/app.js';
import { createMemoryRepository } from '../src/repositories/memory.js';
import { createBookingService } from '../src/services/bookingService.js';
import { createEventService } from '../src/services/eventService.js';

export async function withApi(run) {
  const repository = createMemoryRepository();
  let gatewayCalls = 0;
  let gatewayInput;
  const paymentGateway = {
    async charge(input) {
      gatewayCalls += 1;
      gatewayInput = input;
      return { success: input.outcome !== 'decline' };
    }
  };
  const eventService = createEventService(repository);
  const bookingService = createBookingService(repository, paymentGateway);
  const server = createApp({ router: createApiRouter({ eventService, bookingService }) });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await run(`http://127.0.0.1:${server.address().port}`, {
      repository,
      getGatewayCalls: () => gatewayCalls,
      getGatewayInput: () => gatewayInput
    });
  } finally {
    server.close();
    server.closeAllConnections();
    await once(server, 'close');
  }
}

export async function request(baseUrl, method, pathname, { userId, body } = {}) {
  const headers = {};
  if (userId) headers['x-user-id'] = userId;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export async function createPublishedEvent(baseUrl, {
  organizerId = 'organizer-1',
  title = 'Lagos Tech Meetup',
  capacity = 10,
  tierCapacity = capacity,
  priceCents = 4500,
  publish = true
} = {}) {
  const eventResponse = await request(baseUrl, 'POST', '/api/events', {
    userId: organizerId,
    body: { title, city: 'Lagos', venue: 'City Hall', date: '2026-12-05', capacity }
  });
  const event = await eventResponse.json();
  const tierResponse = await request(baseUrl, 'POST', `/api/events/${event.id}/tiers`, {
    userId: organizerId,
    body: { name: 'General', priceCents, capacity: tierCapacity }
  });
  const tier = await tierResponse.json();
  const publishResponse = publish
    ? await request(baseUrl, 'POST', `/api/events/${event.id}/publish`, { userId: organizerId })
    : null;
  return { event, tier, publishResponse };
}
