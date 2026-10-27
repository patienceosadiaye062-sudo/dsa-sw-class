# Build 3 Architecture

## Layers

```mermaid
flowchart TD
  Routes --> Services
  Services --> Rules
  Services --> Repositories
  Repositories --> Data[(Database)]
```

- **Routes** translate HTTP requests and responses; they may call services but may not contain business rules or access data directly.
- **Services** coordinate use cases; they may call domain rules and repositories but may not handle HTTP details or call routes.
- **Rules** enforce pure domain behavior; they may not perform I/O or depend on services, routes, or repositories.
- **Data** is accessed through repositories; repositories may read and write persistence but may not call business rules, services, or routes.

## Data model

```mermaid
erDiagram
  USER ||--o{ EVENT : organizes
  EVENT ||--|{ TICKET_TIER : offers
  EVENT ||--o{ BOOKING : receives
  TICKET_TIER ||--o{ BOOKING : reserves
  USER ||--o{ BOOKING : places
  USER {
    string id
    string name
    string email
    string role
  }
  EVENT {
    string id
    string organizer_id
    string title
    string city
    string venue
    string date
    string status
  }
  TICKET_TIER {
    string id
    string event_id
    string name
    integer price_cents
    integer capacity
  }
  BOOKING {
    string id
    string attendee_id
    string tier_id
    integer quantity
    integer total_price_cents
    string status
  }
```

## Booking life cycle

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> paid
  pending --> cancelled
  paid --> checked_in
  paid --> refunded
  paid --> cancelled
  cancelled --> [*]
  refunded --> [*]
  checked_in --> [*]
```

The terminal states are `cancelled`, `refunded`, and `checked_in`; no transitions leave them.
