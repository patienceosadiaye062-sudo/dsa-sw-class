build-1

# Build 1 - Domain Foundation

## Goal
Create core domain for ticketing system with O(1) lookup.

## Tasks Done
- src/domain/errors.js - DomainError with code
- src/domain/ids.js - generateId() UUID and generateShortRef() without I,O
- src/domain/waitlistQueue.js - FIFO queue with O(1) linked list
- src/domain/Inventory.js - Booking rules: check availability, sold_out error, cancel, waitlist
- scripts/demo.js - Story: Summer Sounds 3 seats, Ada books 2 (ZS9PS7CD), Bayo books last seat, waitlist 2, Ada cancels, Chidi next
- scripts/benchmark-lookup.js - Compare Array.find (1832ms) vs Map.get (0.4ms) ~4541x faster

## Result
npm run demo works, npm run bench works. Ready for Build 2.

## status: Done