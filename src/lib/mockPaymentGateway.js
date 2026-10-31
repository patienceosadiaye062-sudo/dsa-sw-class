import { DomainError } from '../domain/errors.js';

export function createMockPaymentGateway() {
  return {
    async charge({ outcome = 'success' } = {}) {
      if (outcome === 'decline') return { success: false };
      if (outcome !== 'success') {
        throw new DomainError('VALIDATION', 'Payment outcome must be success or decline.');
      }
      return { success: true };
    }
  };
}
