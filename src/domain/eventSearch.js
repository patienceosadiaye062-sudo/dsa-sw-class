import { DomainError } from './errors.js';
import { isDateOnly, parseIsoDate } from './dateUtils.js';
import { mergeSort } from './sorting.js';

function requireSummaries(summaries) {
  if (!Array.isArray(summaries)) throw new DomainError('VALIDATION', 'Event summaries must be an array.');
}

function requiredCents(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new DomainError('VALIDATION', label + ' must be a non-negative whole number of cents.');
  return value;
}

function cheapestPrice(event) {
  if (Number.isSafeInteger(event.cheapestPriceCents) && event.cheapestPriceCents >= 0) return event.cheapestPriceCents;
  if (!Array.isArray(event.tiers) || event.tiers.length === 0) return null;
  return Math.min(...event.tiers.map(tier => requiredCents(tier.priceCents, 'Tier price')));
}

function seatsAvailable(event) {
  if (!Array.isArray(event.tiers)) return 0;
  return event.tiers.reduce((sum, tier) => {
    const remaining = Number.isSafeInteger(tier.seatsLeft)
      ? tier.seatsLeft
      : Number.isSafeInteger(tier.capacity) && Number.isSafeInteger(tier.booked)
        ? tier.capacity - tier.booked
        : 0;
    return sum + Math.max(remaining, 0);
  }, 0);
}

function normalized(value) {
  return typeof value === 'string' ? value.toLocaleLowerCase() : '';
}

export function filterEvents(summaries, criteria = {}) {
  requireSummaries(summaries);
  if (criteria === null || typeof criteria !== 'object' || Array.isArray(criteria)) {
    throw new DomainError('VALIDATION', 'Search criteria must be an object.');
  }
  const { q, city, from, to, maxPriceCents, onlyAvailable } = criteria;
  if (q !== undefined && typeof q !== 'string') throw new DomainError('VALIDATION', 'Search text must be a string.');
  if (city !== undefined && typeof city !== 'string') throw new DomainError('VALIDATION', 'City must be a string.');
  const fromTimestamp = from === undefined ? undefined : parseIsoDate(from, 'From date');
  const toTimestamp = to === undefined ? undefined : parseIsoDate(to, 'To date');
  if (maxPriceCents !== undefined) requiredCents(maxPriceCents, 'Maximum price');
  if (onlyAvailable !== undefined && typeof onlyAvailable !== 'boolean') {
    throw new DomainError('VALIDATION', 'onlyAvailable must be a boolean.');
  }

  const query = normalized(q);
  const normalizedCity = normalized(city);

  return summaries.filter(event => {
    if (query && !normalized(event.title).includes(query) && !normalized(event.venue).includes(query)) return false;
    if (normalizedCity && normalized(event.city) !== normalizedCity) return false;

    if (fromTimestamp !== undefined || toTimestamp !== undefined) {
      const eventTimestamp = parseIsoDate(event.date, 'Event date');
      if (fromTimestamp !== undefined) {
        const matchesFrom = isDateOnly(from)
          ? event.date.slice(0, 10) >= from
          : eventTimestamp >= fromTimestamp;
        if (!matchesFrom) return false;
      }
      if (toTimestamp !== undefined) {
        const matchesTo = isDateOnly(to)
          ? event.date.slice(0, 10) <= to
          : eventTimestamp <= toTimestamp;
        if (!matchesTo) return false;
      }
    }

    if (maxPriceCents !== undefined) {
      const price = cheapestPrice(event);
      if (price === null || price > maxPriceCents) return false;
    }
    if (onlyAvailable && seatsAvailable(event) === 0) return false;
    return true;
  });
}

function compareText(left, right) {
  return String(left ?? '').localeCompare(String(right ?? ''), undefined, { sensitivity: 'base' })
    || String(left ?? '').localeCompare(String(right ?? ''));
}

export function sortEvents(summaries, sortBy) {
  requireSummaries(summaries);
  const comparators = {
    date: (left, right) => {
      parseIsoDate(left.date, 'Event date');
      parseIsoDate(right.date, 'Event date');
      return left.date.slice(0, 10).localeCompare(right.date.slice(0, 10));
    },
    price: (left, right) => {
      const leftPrice = cheapestPrice(left);
      const rightPrice = cheapestPrice(right);
      if (leftPrice === null) return rightPrice === null ? 0 : 1;
      if (rightPrice === null) return -1;
      return leftPrice - rightPrice;
    },
    availability: (left, right) => seatsAvailable(right) - seatsAvailable(left)
  };
  const comparePrimary = comparators[sortBy];
  if (!comparePrimary) throw new DomainError('VALIDATION', 'Sort must be date, price, or availability.');
  return mergeSort(summaries, (left, right) =>
    comparePrimary(left, right) || compareText(left.title, right.title) || compareText(left.id, right.id)
  );
}

export function searchEvents(summaries, criteria, sortBy = 'date') {
  return sortEvents(filterEvents(summaries, criteria), sortBy);
}
