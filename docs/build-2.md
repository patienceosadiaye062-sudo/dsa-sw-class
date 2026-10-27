# Build 2 - Event Search, Sorting, Backlog, and First Tests

## Goal
Add event creation and publication rules, pure event search/filter/sort functions,
and the project's first automated tests using Node's built-in test runner.

## Delivered
- Event creation validates title, city, venue, date, and capacity; new events are drafts.
- Ticket tiers validate whole-cent prices and capacity, and expose seats left.
- Events can be published when they have at least one tier and unpublished back to draft.
- Public event summaries exclude drafts by default.
- Event filtering supports case-insensitive title/venue search and city matching,
  inclusive date ranges, maximum cheapest-tier price, and availability.
- A stable, non-mutating merge sort orders events by date, price, or availability,
  with title and id tie-breakers.
- Ticket booking requires a published event, enforces quantity and availability,
  and stores pending booking prices as whole cents.
- `npm test` runs the built-in Node test suite without external packages.

## Acceptance-Criteria Coverage
- **S02:** Draft creation; missing title/city and invalid date rejected without saving.
- **S03:** Tier starts with zero sold and full capacity left; invalid price/capacity and
  unknown event are rejected.
- **S04:** Tiered drafts can be published; unpublishing hides them; publishing
  without tiers is rejected.
- **S05:** Case-insensitive title/venue search and city filtering; cheapest-tier price
  filtering; date and availability sorting; inclusive date bounds; invalid input
  errors; filters and sorting do not mutate the input; stable merge sort and empty
  input behavior.
- **S06:** Published-event booking reserves seats and records whole-cent prices;
  sold-out and invalid-quantity bookings are rejected without changing inventory.
- **S16 (Build 2 portion):** `npm test` runs the test suite and exits unsuccessfully
  if a test fails. Running tests on every GitHub push is scheduled for Build 9.

## Done When
- Search, filtering, and sorting work without modifying their input list: **Done**.
- Acceptance criteria are documented and covered by tests: **Done**.
- `npm test` runs and passes: **Done** (19 tests passed).

## Verification
- `npm test` - passed, 19 tests.
- `npm run demo` - passed.
- `npm run benchmark` - passed.
- `git diff --check` - passed.

## Scope Note
This milestone implements domain rules and tests. The REST API and website
surfaces are delivered in later builds; this does not claim their end-to-end
acceptance criteria are complete.

## Status
Build 2 domain milestone: **Done**.