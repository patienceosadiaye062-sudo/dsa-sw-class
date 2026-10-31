import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublishedEvent, request, withApi } from '../test-support/apiTestHelpers.js';

test('API pays a pending booking once', async () => {
  await withApi(async (baseUrl, { getGatewayCalls }) => {
    const { tier } = await createPublishedEvent(baseUrl, { capacity: 5, tierCapacity: 5 });
    const booking = await (await request(baseUrl, 'POST', '/api/bookings', {
      userId: 'attendee-1',
      body: { tierId: tier.id, quantity: 2 }
    })).json();
    assert.equal(booking.totalPriceCents, 9000);

    const payment = await request(baseUrl, 'POST', `/api/bookings/${booking.reference}/pay`, {
      userId: 'attendee-1',
      body: { outcome: 'success' }
    });
    assert.equal(payment.status, 200);
    assert.equal((await payment.json()).status, 'paid');

    const duplicatePayment = await request(baseUrl, 'POST', `/api/bookings/${booking.reference}/pay`, {
      userId: 'attendee-1',
      body: { outcome: 'success' }
    });
    assert.equal(duplicatePayment.status, 409);
    assert.equal((await duplicatePayment.json()).error.code, 'INVALID_TRANSITION');
    assert.equal(getGatewayCalls(), 1);
  });
});

test('declined payment leaves booking pending and does not send card details to the gateway', async () => {
  await withApi(async (baseUrl, { repository, getGatewayCalls, getGatewayInput }) => {
    const { tier } = await createPublishedEvent(baseUrl, {
      title: 'Payment Retry',
      capacity: 2,
      tierCapacity: 2,
      priceCents: 100
    });
    const booking = await (await request(baseUrl, 'POST', '/api/bookings', {
      userId: 'attendee-1',
      body: { tierId: tier.id, quantity: 1 }
    })).json();

    const declined = await request(baseUrl, 'POST', `/api/bookings/${booking.reference}/pay`, {
      userId: 'attendee-1',
      body: { outcome: 'decline', cardNumber: 'must-not-reach-gateway' }
    });
    assert.equal(declined.status, 402);
    assert.equal((await declined.json()).error.code, 'PAYMENT_DECLINED');
    assert.equal((await repository.getBookingByReference(booking.reference)).status, 'pending');
    assert.deepEqual(getGatewayInput(), { outcome: 'decline' });

    const retry = await request(baseUrl, 'POST', `/api/bookings/${booking.reference}/pay`, {
      userId: 'attendee-1',
      body: { outcome: 'success' }
    });
    assert.equal(retry.status, 200);
    assert.equal((await retry.json()).status, 'paid');
    assert.equal(getGatewayCalls(), 2);
  });
});

test('only the attendee who booked can pay', async () => {
  await withApi(async baseUrl => {
    const { tier } = await createPublishedEvent(baseUrl, {
      title: 'Private Booking',
      capacity: 1,
      tierCapacity: 1,
      priceCents: 100
    });
    const booking = await (await request(baseUrl, 'POST', '/api/bookings', {
      userId: 'attendee-1',
      body: { tierId: tier.id, quantity: 1 }
    })).json();

    const wrongAttendee = await request(baseUrl, 'POST', `/api/bookings/${booking.reference}/pay`, {
      userId: 'attendee-2',
      body: { outcome: 'success' }
    });
    assert.equal(wrongAttendee.status, 403);
    assert.equal((await wrongAttendee.json()).error.code, 'FORBIDDEN');
  });
});

test('a cancelled booking cannot be paid', async () => {
  await withApi(async (baseUrl, { repository }) => {
    const { tier } = await createPublishedEvent(baseUrl, {
      title: 'Cancelled Booking',
      capacity: 1,
      tierCapacity: 1,
      priceCents: 100
    });
    const booking = await (await request(baseUrl, 'POST', '/api/bookings', {
      userId: 'attendee-1',
      body: { tierId: tier.id, quantity: 1 }
    })).json();
    await request(baseUrl, 'POST', `/api/bookings/${booking.reference}/cancel`, {
      userId: 'attendee-1'
    });

    const payment = await request(baseUrl, 'POST', `/api/bookings/${booking.reference}/pay`, {
      userId: 'attendee-1',
      body: { outcome: 'success' }
    });
    assert.equal(payment.status, 409);
    assert.equal((await payment.json()).error.code, 'INVALID_TRANSITION');
    assert.equal((await repository.getBookingByReference(booking.reference)).status, 'cancelled');
  });
});
