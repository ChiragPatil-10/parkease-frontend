# ParkEase API Reference

**Source of truth for frontend integration.** All routes below are written as they
are called **through the Gateway** (`http://localhost:5000` in dev), based on the
YARP route table in `ParkEase.Gateway.API/appsettings.json`. Internal
service-to-service endpoints (`/internal/...`) are **not** reachable through the
Gateway. They are called only by other services and are listed separately per
service for completeness only.

## Conventions used everywhere

**Response envelope.** Every endpoint (success or failure) returns this shape,
serialized camelCase:

```json
{
  "success": true,
  "message": "Human-readable message or null",
  "data": { "...": "endpoint-specific payload, or null on failure" },
  "errors": null
}
```

On a 422 validation failure, `errors` is populated instead of `data`:

```json
{
  "success": false,
  "message": "Validation failed.",
  "data": null,
  "errors": {
    "Email": ["A valid email address is required."],
    "Password": ["Password must be at least 8 characters."]
  }
}
```

**Timestamps.** All timestamps are UTC ISO 8601 strings ending in `Z`.

**Auth header.** `Authorization: Bearer <accessToken>` for every endpoint marked
"Requires JWT" or "Requires role: X".

**Common error shapes.** Unless noted per endpoint, services map exceptions like this:

| Status | When |
|---|---|
| 400 | Malformed or invalid input (`ArgumentException`) |
| 401 | Missing or invalid JWT. On Booking, Spot, Vehicle and ParkingLot also an ownership failure (see the Booking service note) |
| 403 | Ownership failure on the Payment service only; also a valid JWT with the wrong role |
| 404 | Entity not found |
| 409 | Business rule conflict, or a concurrent update (refetch and retry) |
| 422 | Validation failure, see the `errors` object above |
| 429 | Rate limit exceeded (Gateway) |
| 500 | Unhandled exception |

**Rate limiting (Gateway).** Routes without their own policy use a token bucket:
100 tokens, refilled 20 every 10 seconds, partitioned by user id (IP when
anonymous). Auth login and register use 5 requests per minute per IP. Payment
routes use a shared concurrency limit (see the Payment doc).

---

# Booking Service

Owns the booking lifecycle. A MassTransit saga coordinates the Spot reservation
and the Payment order behind the scenes. The frontend only calls the REST
endpoints below and polls `GET /api/bookings/{id}` to see progress.

Bookings are **prepaid**. A booking stays `Pending` until the driver pays (see
`payment.md`, `POST /api/payments/verify`). Only then does it become `Confirmed`.

## Enums

| Enum | Wire values | Used in |
|---|---|---|
| `BookingStatus` | `"Pending"`, `"Confirmed"`, `"CheckedIn"`, `"Completed"`, `"Cancelled"`, `"NoShow"` | response `status` |
| `VehicleType` (Booking's copy) | `"TwoWheeler"`, `"FourWheeler"`, `"Heavy"` | response `vehicleType` only, not a request field |

## Lifecycle the frontend should understand

1. `POST /api/bookings` creates the booking as `Pending`. The saga then reserves
   the spot and asks Payment to create a Razorpay order. This takes a moment, so
   `GET /api/payments/booking/{bookingId}` can return 404 for a short time.
2. The booking **stays `Pending` while it waits for payment.** `paymentDueAt` tells
   you when it will be cancelled automatically if still unpaid (15 minutes after
   creation by default).
3. After the driver pays and `POST /api/payments/verify` succeeds, the booking
   becomes `Confirmed` asynchronously, normally within 1 to 2 seconds. **Poll
   `GET /api/bookings/{id}`** to see it. The verify response does not mean the
   booking is already `Confirmed`.
4. If the order cannot be created, the spot cannot be reserved, or the payment
   window passes, the booking becomes `Cancelled` and the spot is released.
5. Checkout and cancel also finish asynchronously: the response shows the state
   at that instant, and the saga moves it on afterward. Poll to see the result.

## Response object (`BookingResponse`)

```json
{
  "bookingId": "4c9e6679-7425-40de-944b-e07fc1f90ae8",
  "driverId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  "lotId": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "spotId": "1b4e28ba-2fa1-11d2-883f-0016d3cca427",
  "vehicleId": "2b4e28ba-2fa1-11d2-883f-0016d3cca428",
  "vehicleType": "FourWheeler",
  "startTime": "2026-09-16T16:00:00Z",
  "endTime": null,
  "totalAmount": 50.00,
  "status": "Pending",
  "createdAt": "2026-09-16T15:30:00Z",
  "updatedAt": "2026-09-16T15:30:00Z",
  "paymentDueAt": "2026-09-16T15:45:00Z"
}
```

- `paymentDueAt` is set only while `status` is `"Pending"`, otherwise `null`.
- `endTime` is `null` until the booking ends (checkout, cancel or no-show).
- The response has no lot name, spot label or cancel reason. Read the lot and spot
  from their own services (`parkinglot.md`, `spot.md`).

## Endpoints

### `POST /api/bookings` (Requires role: `Driver`)

All fields are required.

```json
{
  "lotId": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "spotId": "1b4e28ba-2fa1-11d2-883f-0016d3cca427",
  "vehicleId": "2b4e28ba-2fa1-11d2-883f-0016d3cca428",
  "startTime": "2026-09-16T16:00:00Z",
  "totalAmount": 50.00,
  "idempotencyKey": "a-client-generated-uuid-or-similar-unique-string"
}
```

Rules checked by the server:
- `lotId` must be the lot the spot belongs to.
- `startTime` cannot be more than 2 minutes in the past and cannot be more than 24 hours ahead.
- `totalAmount` must equal the spot's `pricePerHour` times a **whole number of hours from 1 to 4**. A free spot (price 0) only accepts 0.
- The vehicle must exist, be active and belong to the caller. If the spot is EV charging, the vehicle must be electric.
- The spot must be `Available`.

`idempotencyKey`: generate a fresh value per booking attempt (for example
`crypto.randomUUID()`, max 100 characters) and **reuse the same value when retrying**
after a network error. Replaying a key returns the existing booking with the
response header `X-Idempotent-Replay: true`.

Success (201), message `"Booking created - confirmation pending."`, `data` is a
`BookingResponse` with `status: "Pending"` and `paymentDueAt` set.

Errors:
- 400: bad input (`"Start time cannot be in the past."`, `"Start time cannot be more than 24 hours in the future."`, `"The lot does not match the selected spot."`, or the amount message `"Total amount must equal the spot's price per hour (X.XX) multiplied by a whole number of hours between 1 and 4."`)
- 401: the vehicle does not belong to the caller (`"You do not own this vehicle."`)
- 404: vehicle or spot not found
- 409: `"This vehicle is not active."`, `"This spot is reserved for electric vehicles only."`, `"This spot is not available."`, or `"A booking request with this idempotency key is already being processed."`
- 422: a required field is missing

### `GET /api/bookings/my` (Requires role: `Driver`)

Array of `BookingResponse` for the caller, newest first.

### `GET /api/bookings/{id}` (Requires role: `Driver`)

Single `BookingResponse`. Only the owning driver may read it.

Errors: **401** when the booking belongs to another driver (this service maps
ownership failures to 401, not 403), 404 when it does not exist.

> Frontend note: because a not-owner result is a 401, make sure the auth
> interceptor does not log the user out on every 401 from this endpoint.

### `GET /api/bookings/lot/{lotId}` (Requires role: `Manager`)

Array of `BookingResponse` for that lot, newest first.

Unconfirmed: the code does not check that the lot belongs to the calling manager,
so any manager can query any lot by id. Check the lot's `managerId` yourself
(`GET /api/v1/lots/{lotId}`) if a screen must show only the manager's own lots.

### `POST /api/bookings/{id}/checkin` (Requires role: `Driver`)

Synchronous. No body. Only valid from `Confirmed`.

Success (200), message `"Checked in."`, `status: "CheckedIn"`.
Errors: 401 (not owner), 404, 409 (wrong status, or Spot rejects the occupy request).

### `POST /api/bookings/{id}/checkout` (Requires role: `Driver`)

No body. Only valid from `CheckedIn`. The response still shows `CheckedIn`; the
saga completes the booking afterward, so poll for `Completed`.

Success (200), message `"Checkout in progress."`.
Errors: 401, 404, 409 (`"Cannot check out a booking in status 'X' - must be CheckedIn."`).

### `POST /api/bookings/{id}/cancel` (Requires role: `Driver`)

Request: `{ "reason": "Change of plans" }`

Valid from `Pending` and `Confirmed`. A paid booking is refunded automatically.
The response still shows the old status; the saga moves it to `Cancelled`, so poll.

Success (200), message `"Cancellation in progress."`.
Errors:
- 401: not the owner
- 404
- 409: `"Cannot cancel a booking in status 'Completed'."` (same for `Cancelled` and `NoShow`), or `"Cannot cancel after check-in."` for `CheckedIn` (check out instead)

### Internal only (not reachable through the Gateway)

`GET /internal/bookings/vehicle/{vehicleId}/active-count` uses the `X-Internal-Key`
header and is called by the Vehicle service. Not for frontend use.

---
