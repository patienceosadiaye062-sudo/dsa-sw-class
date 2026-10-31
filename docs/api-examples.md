# Build 4 API examples

Start the server with `npm start`. It listens on port `3000` by default.
Until Build 7, identify the caller with `x-user-id`. These examples use
`curl.exe` syntax on Windows; use `curl` on other platforms.

## 1. Create an event

```sh
curl.exe -i -X POST http://localhost:3000/api/events ^
  -H "x-user-id: organizer-1" -H "content-type: application/json" ^
  -d "{\"title\":\"Lagos Tech Meetup\",\"city\":\"Lagos\",\"venue\":\"City Hall\",\"date\":\"2026-12-05\",\"capacity\":100}"
```

Copy the returned event `id` for the following requests.

## 2. Add a ticket tier

```sh
curl.exe -i -X POST http://localhost:3000/api/events/EVENT_ID/tiers ^
  -H "x-user-id: organizer-1" -H "content-type: application/json" ^
  -d "{\"name\":\"General\",\"priceCents\":4500,\"capacity\":100}"
```

Copy the returned tier `id` for booking.

## 3. Publish the event

```sh
curl.exe -i -X POST http://localhost:3000/api/events/EVENT_ID/publish ^
  -H "x-user-id: organizer-1"
```

## 4. Search published events

```sh
curl.exe "http://localhost:3000/api/events?q=tech&city=Lagos&from=2026-12-01&to=2026-12-31&maxPriceCents=5000&onlyAvailable=true&sort=date"
```

The supported filters are `q`, `city`, `from`, `to`, `maxPriceCents`,
`onlyAvailable`, and `sort` (`date`, `price`, or `availability`).

## 5. Book tickets

```sh
curl.exe -i -X POST http://localhost:3000/api/bookings ^
  -H "x-user-id: attendee-1" -H "content-type: application/json" ^
  -d "{\"tierId\":\"TIER_ID\",\"quantity\":2}"
```

Copy the returned booking `reference` to pay or cancel it.

## 6. Pay with the mock gateway

```sh
curl.exe -i -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/pay ^
  -H "x-user-id: attendee-1" -H "content-type: application/json" ^
  -d "{\"outcome\":\"success\"}"
```

To simulate a decline, set `"outcome":"decline"`. A declined attempt returns
`PAYMENT_DECLINED` and leaves the booking pending so the attendee can retry.
No card number is accepted by or sent to the mock gateway.

## 7. Cancel an unpaid booking

```sh
curl.exe -i -X POST http://localhost:3000/api/bookings/BOOKING_REFERENCE/cancel ^
  -H "x-user-id: attendee-1"
```

Cancellation is allowed only for the attendee's pending booking.
