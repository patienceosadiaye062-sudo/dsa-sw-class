# Build 3 - Architecture, State Machine, and Server Skeleton

## Goal

Define the application layers and booking life cycle, then add a small Node.js
HTTP server that serves `/health` and static files from `public/`.

## Deliverables

- `docs/architecture.md` documents the layers, data model, and booking states.
- `src/domain/bookingStateMachine.js` defines legal transitions and rejects
  invalid transitions with `INVALID_TRANSITION`.
- `src/http/router.js` matches HTTP methods and paths with named parameters.
- `src/http/app.js` handles health checks, static files, API 404s, and JSON errors.
- `src/config.js` reads the server port from `PORT` (default `3000`).
- `src/server.js` starts the server; run it with `npm start`.
- `test/build-3.test.js` covers transitions, routing, and HTTP behavior.

## Done When

- The architecture and every booking state transition are documented.
- Tests cover all allowed and illegal booking transitions.
- `/health` returns `{"status":"ok"}`.
- Static files are served only from `public/`.
- Malformed JSON and unknown API routes return JSON errors without stack traces.
- `npm test` and `npm start` run successfully.
