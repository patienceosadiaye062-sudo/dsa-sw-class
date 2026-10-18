import { createStore, createEvent, addTier, bookTickets, cancelBooking, findBookingByReference, joinWaitlist } from '../src/domain/inventory.js';

const store = createStore();
const event = createEvent(store, { name: 'Summer Sounds', capacity: 3 });
const tier = addTier(store, event.id, { name: 'General Admission', priceCents: 4500, capacity: 3 });
console.log('Event:', event.name, '—', tier.capacity, 'seats available.');
const ada = bookTickets(store, { tierId: tier.id, attendeeName: 'Ada', quantity: 2 });
console.log('Ada books 2 tickets. Reference:', ada.reference);
try { bookTickets(store, { tierId: tier.id, attendeeName: 'Bayo', quantity: 2 }); } catch (error) { console.log('Bayo is refused:', error.code, error.message); }
const bayo = bookTickets(store, { tierId: tier.id, attendeeName: 'Bayo', quantity: 1 });
console.log('Bayo books the last seat. Event is sold out. Reference:', bayo.reference);
joinWaitlist(store, { eventId: event.id, attendeeName: 'Chika' });
joinWaitlist(store, { eventId: event.id, attendeeName: 'Dayo' });
console.log('Waitlist:', event.waitlist.size, 'people.');
console.log('Lookup by reference found:', findBookingByReference(store, ada.reference).attendeeName);
cancelBooking(store, ada.reference);
console.log('Ada cancels. Seats now available:', tier.capacity - tier.booked);
console.log('Next person in line:', event.waitlist.peek().attendeeName);
