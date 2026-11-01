build-1

# Build 1 - Domain Foundation

## Goal
Create core domain for ticketing system with O(1) lookup.

## Tasks Done
- src/domain/errors.js - DomainError with code
- src/domain/ids.js - newId() UUID and newReference() without ambiguous characters
- src/domain/waitlistQueue.js - Queue FIFO with O(1) linked-list operations
- src/domain/Inventory.js - Booking rules: check availability, `SOLD_OUT`
  errors, cancel pending bookings, and join the waitlist only for a published
  event when the requested seats are unavailable
- scripts/demo.js - Story: Summer Sounds 3 seats, Ada books 2, Bayo books last seat, waitlist 2, Ada cancels, Chidi next
- scripts/benchmark-lookup.js - Compare Array.find with Map.get for booking-reference lookups

## Result
`npm run demo` and `npm run benchmark` run successfully. Benchmark timings vary by machine.
Ready for Build 2.

## status: Done