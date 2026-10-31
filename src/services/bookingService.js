import { DomainError } from '../domain/errors.js';
import { assertTransition } from '../domain/bookingStateMachine.js';
import { newId, newReference } from '../domain/ids.js';

const MAX_TICKETS_PER_BOOKING = 10;

function requireObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new DomainError('VALIDATION', `${label} must be an object.`);
  }
  return value;
}

function requireOwner(booking, userId) {
  if (booking.userId !== userId) {
    throw new DomainError('FORBIDDEN', 'Only the attendee who made this booking can change it.');
  }
}

function requirePendingTransition(booking, nextStatus) {
  assertTransition(booking.status, nextStatus);
}

export function createBookingService(repository, paymentGateway) {
  if (!repository) throw new TypeError('A booking repository is required.');
  if (!paymentGateway || typeof paymentGateway.charge !== 'function') {
    throw new TypeError('A payment gateway is required.');
  }

  return {
    async createBooking(userId, input) {
      requireObject(input, 'Booking');
      const { tierId, quantity } = input;
      if (typeof tierId !== 'string' || !tierId.trim()) {
        throw new DomainError('VALIDATION', 'Ticket tier id must be a non-empty string.');
      }
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_TICKETS_PER_BOOKING) {
        throw new DomainError('VALIDATION', `A booking must contain between 1 and ${MAX_TICKETS_PER_BOOKING} tickets.`);
      }

      const tier = await repository.getTier(tierId);
      if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier was not found.');
      const event = await repository.getEvent(tier.eventId);
      if (!event || event.status !== 'published') {
        throw new DomainError('INVALID_STATE', 'Tickets can only be booked for published events.');
      }
      const totalPriceCents = tier.priceCents * quantity;
      if (!Number.isSafeInteger(totalPriceCents)) {
        throw new DomainError('VALIDATION', 'Booking total must be a safe whole number of cents.');
      }

      let reference = newReference();
      while (await repository.getBookingByReference(reference)) reference = newReference();
      const booking = {
        id: newId(),
        reference,
        userId,
        eventId: event.id,
        tierId,
        quantity,
        unitPriceCents: tier.priceCents,
        totalPriceCents,
        status: 'pending'
      };
      return repository.createBooking(booking);
    },

    async payBooking(userId, reference, input = {}) {
      requireObject(input, 'Payment');
      const booking = await repository.getBookingByReference(reference);
      if (!booking) throw new DomainError('NOT_FOUND', 'Booking was not found.');
      requireOwner(booking, userId);
      requirePendingTransition(booking, 'paid');

      const outcome = input.outcome ?? 'success';
      if (outcome !== 'success' && outcome !== 'decline') {
        throw new DomainError('VALIDATION', 'Payment outcome must be success or decline.');
      }
      const result = await paymentGateway.charge({ outcome });
      if (!result.success) {
        throw new DomainError('PAYMENT_DECLINED', 'Mock payment was declined.');
      }

      booking.status = 'paid';
      return repository.saveBooking(booking);
    },

    async cancelBooking(userId, reference) {
      const booking = await repository.getBookingByReference(reference);
      if (!booking) throw new DomainError('NOT_FOUND', 'Booking was not found.');
      requireOwner(booking, userId);
      requirePendingTransition(booking, 'cancelled');

      const tier = await repository.getTier(booking.tierId);
      if (!tier) throw new DomainError('NOT_FOUND', 'Ticket tier was not found.');
      return repository.cancelBooking(booking);
    }
  };
}
