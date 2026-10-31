# Build 4: Working REST API (in memory)

*Week 7 of the course. Starts from the finished state of Build 3.*

**You deliver:** an API that works end to end with data held in memory: create
events and tiers, publish, search, book, pay with a mock payment, and cancel an
unpaid booking.

## Done when

- The calls in [api-examples.md](api-examples.md) work with curl.
- Errors use the same JSON shape as the server's other routes.
- Event and booking business rules live in injected services.
- Mock payment declines leave bookings pending; cards are never passed to the gateway.
- Attendees can only pay or cancel their own bookings.
- `npm test` includes real-server API tests.

## Running

Run `npm start` to start the API on port `3000` (or the value of `PORT`), and
`npm test` to run the test suite. API request examples are in
[api-examples.md](api-examples.md).