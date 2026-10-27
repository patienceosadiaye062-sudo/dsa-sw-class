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
