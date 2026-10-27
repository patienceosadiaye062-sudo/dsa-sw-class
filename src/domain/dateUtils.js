import { DomainError } from './errors.js';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/;

export function parseIsoDate(value, label = 'Date') {
  if (typeof value !== 'string') {
    throw new DomainError('VALIDATION', label + ' must be a valid ISO date or date-time.');
  }
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) throw new DomainError('VALIDATION', label + ' must be a valid ISO date or date-time.');

  const calendarDate = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== `${match[1]}-${match[2]}-${match[3]}`) {
    throw new DomainError('VALIDATION', label + ' must be a real date.');
  }

  const dateTimeWithoutZone = value.length > 10 && !/(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  const timestamp = Date.parse(dateTimeWithoutZone ? `${value}Z` : value);
  if (!Number.isFinite(timestamp)) throw new DomainError('VALIDATION', label + ' must be a valid ISO date or date-time.');
  return timestamp;
}

export function isDateOnly(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
