# Build 5: SQLite and the overselling fix

*Week 8 of the course. Starts from the finished state of Build 4.*

**You deliver:** data stored in SQLite, and the last-ticket problem reproduced
and then fixed.

**You practise:** SQL, constraints, parameterised queries, atomic operations,
and concurrency.

## Done when

- A script shows 50 people trying to buy the last ticket, and exactly one
  succeeds.
- A test proves it, and fails if the fix is removed.
- Data survives a server restart.
- The tables use primary keys, foreign keys, unique constraints, and checks;
  every query uses placeholders.

## User story

### S08: As an attendee, I want to be certain the last ticket is sold to only one person

- **Given** exactly 1 seat left
- **When** 50 attendees try to book it at the same moment
- **Then** exactly 1 booking succeeds, 49 get `SOLD_OUT`, and seats sold never
  exceeds capacity.
- **Given** the database fix is removed
- **When** the overselling test runs
- **Then** the test fails.

## Prompt 1: move to SQLite and reproduce the problem

Give your AI tool the project instructions, this file, and everything in
`src/` first. The repository interfaces and service behavior are in
[`src/repositories/memory.js`](../src/repositories/memory.js) and
[`src/services/bookingService.js`](../src/services/bookingService.js).

```text
We are building Build 5 of the Event Ticketing capstone, in plain JavaScript
(ES modules, Node 22.13 or newer, no outside packages). Read the project
instructions, docs/build-5.md and everything in src/ before you write anything.

1. Add src/db/schema.sql and src/db/connection.js using node:sqlite. Create
   tables for users, events, ticket_tiers and bookings, with PRIMARY KEY,
   FOREIGN KEY, UNIQUE and CHECK constraints. Include
   CHECK (booked >= 0 AND booked <= capacity).
2. Add src/repositories/sqlite.js with the same methods as memory.js, so the
   services do not change. Every query uses placeholders (?); never build SQL
   by joining strings.
3. Add scripts/seed.js that fills the database once, and a "seed" script in
   package.json. The server must keep its data after a restart.
4. Add scripts/oversell-demo.js: create an event with exactly 1 seat left,
   then fire 50 booking requests at it at the same moment using Promise.all.
   Print how many bookings succeeded and how many seats were sold.

Do not fix any overselling yet. We want to see the problem first. Add
"oversell" to package.json scripts. When done, list every file changed and any
rule from this prompt that you were unsure about.
```

## Prompt 2: fix it

```text
The demo shows more than one booking for the last seat. Fix it in the database,
not in JavaScript.

- Reserve seats with one atomic statement, for example
  UPDATE ticket_tiers SET booked = booked + ? WHERE id = ? AND booked + ? <= capacity,
  and use the number of changed rows to know whether we won the seat. If no
  row changed, throw SOLD_OUT.
- Do not use a lock variable, and do not check twice. Explain in two sentences
  why those do not work.
- Add test/oversell.test.js: 50 simultaneous bookings for 1 seat give exactly
  1 success and 49 SOLD_OUT. The test must fail if the fix is removed.
- Show the demo again with the numbers before and after.

List every file changed and anything you were unsure about.
```

A JavaScript lock only coordinates code that shares that one process; it cannot
protect the data from another process or survive a restart. A separate
availability check and later update are not atomic, so concurrent requests can
both observe the same last seat before either reserves it.

## Running

Run `npm run seed` to add the sample event once, `npm start` to start the API,
and `npm run oversell` to run the last-ticket demonstration. Set
`DATABASE_PATH` to choose another SQLite file. Run `npm test` for the
regression test.

## Definition of done

The Definition of done in [`user-stories.md`](user-stories.md) applies to every
story in this build.

[Build 4](build-4.md) | [Build 6](build-6.md)