import { createStore, createEvent, addTier, bookTickets, cancelBooking, findBookingByReference, joinWaitlist, publishEvent } from '../src/domain/Inventory.js';

const store = createStore();
const event = createEvent(store, {
  title: 'Summer Sounds',
  city: 'Lagos',
  venue: 'City Arena',
  date: '2026-12-05T17:00:00.000Z',
  capacity: 3
});
const tier = addTier(store, event.id, { name: 'General Admission', priceCents: 4500, capacity: 3 });
console.log('Event:', event.name, '—', tier.capacity, 'seats available.');
publishEvent(store, event.id);
const ada = bookTickets(store, { tierId: tier.id, attendeeName: 'Ada', quantity: 2 });
console.log('Ada books 2 tickets. Reference:', ada.reference);
try { bookTickets(store, { tierId: tier.id, attendeeName: 'Bayo', quantity: 2 }); } catch (error) { console.log('Bayo is refused:', error.code, error.message); }
const bayo = bookTickets(store, { tierId: tier.id, attendeeName: 'Bayo', quantity: 1 });
console.log('Bayo books the last seat. Event is sold out. Reference:', bayo.reference);
joinWaitlist(store, { eventId: event.id, attendeeName: 'Chidi' });
joinWaitlist(store, { eventId: event.id, attendeeName: 'Dayo' });
console.log('Waitlist:', event.waitlist.size, 'people.');
console.log('Lookup by reference found:', findBookingByReference(store, ada.reference).attendeeName);
cancelBooking(store, ada.reference);
console.log('Ada cancels. Seats now available:', tier.capacity - tier.booked);
console.log('Next person in line:', event.waitlist.peek().attendeeName);
