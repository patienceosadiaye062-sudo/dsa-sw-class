## Build 1

### Prompt 1: Build 1 prompt (docs/build-1.md)
- **What I asked:** Build the Build 1 ticketing domain foundation described in `docs/build-1.md`: event and tier inventory, bookings, cancellation, a FIFO waitlist, reference lookup, and runnable demo/benchmark scripts.
- **What came back:** The core domain and scripts were already present. I checked them and corrected the demo's import to match the case-sensitive `Inventory.js` filename, changed the first waitlist attendee to Chidi to match the milestone example, and updated the Build 1 notes to use the actual API names and `npm run benchmark` command.
- **What was wrong (or "nothing"):** The demo imported `inventory.js` even though the file is named `Inventory.js`, which can fail on case-sensitive systems. The demo and milestone notes also had mismatched waitlist names/API names, and the notes used a benchmark timing that is machine-dependent. The demo and notes were corrected; the core booking, lookup, and queue logic needed no Build 1 changes.

## Build 2

### Prompt 1: Build 2 implementation
- **What I asked:** Implement event creation and publication, stable merge sorting, pure event search/filtering, ticket booking rules, and Node built-in tests from the Build 2 acceptance criteria.
- **What came back:** Added the domain functions, test coverage, and an `npm test` command; updated the demo to create and publish a complete event.
- **What was wrong (or "nothing"):** The first date comparator considered times within the same day, but the acceptance criteria require same-day events to be ordered by title. The comparator and test were corrected to compare calendar dates before title and id. Build 1's event data also lacked the title, city, venue, and date fields now required by Build 2, so the demo was updated to supply them.

## Build 3

### Prompt 1: Build 3 architecture and server
- **What I asked:** Implement the Build 3 booking state machine, layered architecture diagrams, parameterized router, Node HTTP server with health and static-file routes, JSON error handling, configuration, and tests.
- **What came back:** Added the state machine and HTTP server layers, documented the architecture, added a public landing page and tests, and configured `npm start`.
- **What was wrong (or "nothing"):** The repository has no `README.md` or `docs/user-stories.md`, and `docs/build-3.md` was empty, so those requested background files could not be read. The supplied Build 3 prompt was used as the specification. I added verification for malformed JSON, unknown API routes, path traversal, and all allowed and disallowed known-state transitions.
## Build 4

### Prompt 1: Build 4 REST API
- **What I asked:** Implement the in-memory async repository, injected event and booking services, mock payment gateway, REST endpoints, API examples, and real-server API tests.
- **What came back:** Added the service and repository layers, wired the routes into the existing HTTP server, documented the API calls, and added end-to-end coverage.
- **What was wrong (or "nothing"):** The existing domain inventory stores booking statuses in uppercase, while the Build 3 state machine uses lowercase states. The API service uses the state machine's lowercase states directly without changing the existing Build 2 demo/inventory behavior. Tests verify declined-payment retry, ownership, cancellation transitions, and that card-number fields never reach the gateway.

## Build 5

### Prompt 1: SQLite persistence and overselling
- **What I asked:** Move the API repository to SQLite with constraints, keep data across restarts, add an idempotent seed script, and reproduce the last-ticket race with 50 concurrent booking attempts.
- **What came back:** Added a SQLite schema and repository, connected the server to a persistent database, and added seed and overselling scripts plus regression tests.
- **What was wrong (or "nothing"):** Before the fix, the memory-backed service allowed all 50 attempts to succeed and stored 99 bookings against a capacity of 50. A JavaScript lock only coordinates code in one process and is not durable; a separate availability check and update are not atomic, so concurrent requests can both see the same seat.

### Prompt 2: atomic reservation
- **What I asked:** Reserve seats with one conditional SQL update, use its changed-row count to reject losing requests, and test that 50 requests for one remaining ticket produce one success and 49 `SOLD_OUT` results.
- **What came back:** Seat reservation and booking insertion now run in one SQLite transaction. The post-fix demo and regression test report 1 success, 49 sold-out responses, and exactly 50 of 50 seats booked.
- **What was wrong (or "nothing"):** The original service checked availability in JavaScript and saved the tier and booking separately, which caused overselling. Both reservation and cancellation now update their related rows transactionally; the test also verifies that cancellation cannot release the same seats twice.

### Review: Builds 1–5 consistency and regression fixes
- **What I asked:** Review the Build 1–5 milestone docs and implementation, then correct verified inconsistencies.
- **What came back:** The review found Build 1 allowed waitlist entry before an event was published or while enough seats remained, and its in-memory inventory allowed non-pending bookings to be cancelled. The Build 3 doc referred to an obsolete test filename, the Build 1 doc used the wrong `SOLD_OUT` casing, and the Build 5 persistence test reopened SQLite without restarting the actual API server.
- **What was wrong (or "nothing"):** Added the missing Build 1 guards and regression tests, corrected the doc references and architecture field names, and added an API process-restart test that verifies events, tiers, bookings, and payment remain usable after restart.
