# ParkEase API Reference

**Source of truth for frontend integration.** All routes below are written as they
are called **through the Gateway** (`http://localhost:5000` in dev), based on the
YARP route table in `ParkEase.Gateway.API/appsettings.json`. Internal
service-to-service endpoints (`/internal/...`) are **not** reachable through the
Gateway (no route maps to them) — they're called only by other services, over
gRPC in most cases, and are listed separately per service for completeness only.

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

**Auth header.** `Authorization: Bearer <accessToken>` for every endpoint marked
"Requires JWT" or "Requires role: X".

**Common error shapes.** Unless noted otherwise per-endpoint, every service maps
exceptions the same way:

| Status | When |
|---|---|
| 400 | `ArgumentException` — malformed input the model binder let through |
| 401 | Missing/invalid JWT, or wrong password/internal key |
| 403 | `UnauthorizedAccessException` on Payment only (ownership check) — other services use 401 for ownership too, ⚠️ verify per-service, see notes below |
| 404 | Entity not found |
| 409 | `InvalidOperationException` (business-rule conflict) or `DbUpdateConcurrencyException` (optimistic-concurrency clash on a spot/booking/vehicle/payment update — client should refetch and retry) |
| 422 | FluentValidation failure — see `errors` dict shape above |
| 429 | Rate limit exceeded (Gateway-level, see per-endpoint notes) |
| 500 | Unhandled exception |

**Rate limiting (Gateway-wide).** Every route **not** individually called out below
uses the Gateway's global default: a token-bucket limiter, 100-token capacity,
refilling 20 tokens every 10s, partitioned by authenticated user id (falls back
to IP for anonymous calls). Two routes override this — flagged inline where they
apply (Auth login/register, Payment).

---


# Booking Service

The orchestrator. Owns the booking lifecycle end-to-end, driven by a
MassTransit saga (`BookingFulfillmentStateMachine`) that coordinates Spot
reservation and Payment holding behind the scenes — the frontend only ever
calls the REST endpoints below and polls/refetches to observe saga progress.

## Enums

| Enum | Wire values | Used in |
|---|---|---|
| `BookingStatus` | `"Pending"` → `"Confirmed"` → `"CheckedIn"` → `"Completed"` \| `"Cancelled"` \| `"NoShow"` | response `status` only |
| `VehicleType` (Booking's own copy) | `"TwoWheeler"` \| `"FourWheeler"` \| `"Heavy"` | response `vehicleType` only — **not** a request field (see note below) |

**Saga flow the frontend should understand:** `POST /` creates the booking in
`Pending` and kicks off the saga asynchronously — the response you get back is
still `Pending`/whatever the entity's DB state was *at the instant of the HTTP
response*, not necessarily its final state. The saga then (in the background)
reserves the spot, requests a payment hold from the Payment service, and moves
the booking to `Confirmed` — or fails and moves it to `Cancelled` with
compensation (releasing the spot). **Poll `GET /{id}` after creating a booking
to observe the transition from `Pending` → `Confirmed` (or `Cancelled` on
failure)** rather than assuming the create response reflects final state.
Same asynchronous-completion caveat applies to `POST /{id}/checkout` (returns
immediately while still `CheckedIn`; the saga moves it to `Completed`
afterward) and `POST /{id}/cancel`.

## Endpoints

### `POST /api/bookings` — Requires role: `Driver`
Request — all fields required. `vehicleId` must belong to the caller and be
active; `spotId` must be `Available`; if the spot `isEvCharging`, the vehicle
must be electric:
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
`idempotencyKey`: **generate a fresh unique value per distinct booking attempt** (e.g. `crypto.randomUUID()`), and **reuse the exact same value if retrying after a network error** — replaying the same key returns the already-created booking instead of creating a duplicate (frontend can detect this via the `X-Idempotent-Replay: true` response header).

Success (201):
```json
{
  "success": true, "message": "Booking created — confirmation pending.",
  "data": {
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
    "createdAt": "2026-09-16T15:30:00Z", "updatedAt": "2026-09-16T15:30:00Z"
  },
  "errors": null
}
```
Errors: 404 (`"Vehicle '...' not found."` or `"Spot '...' not found."`), 409 (`"This vehicle is not active."`, `"This spot is reserved for electric vehicles only."`, or `"A booking request with this idempotency key is already being processed."` — a concurrent duplicate submit), 401 (vehicle doesn't belong to caller), 422.

### `GET /api/bookings/my` — Requires role: `Driver`
Success (200): array of `BookingResponse` for the caller, newest first.

### `GET /api/bookings/{id}` — Requires role: `Driver`
Only the owning driver may fetch it. Success (200): single `BookingResponse`. Errors: 401 (not owner), 404.

### `GET /api/bookings/lot/{lotId}` — Requires role: `Manager`
⚠️ No ownership check visible in the controller/service against the lot's `managerId` — any authenticated Manager appears able to query any lot's bookings by id. Verify this is intended before relying on it for a "my lot's bookings" screen; you may want to also validate lot ownership client-side (or check with the lot's `managerId` from `GET /api/v1/lots/{lotId}` first) until confirmed.

Success (200): array of `BookingResponse` for that lot, newest first.

### `POST /api/bookings/{id}/checkin` — Requires role: `Driver`
**Synchronous, not saga-driven** — calls Spot's Occupy transition directly, so failures surface immediately. Only valid from `status="Confirmed"`. No body.

Success (200): updated `BookingResponse` with `status="CheckedIn"`, message `"Checked in."` Errors: 401 (not owner), 404, 409 (wrong status, or Spot rejects the occupy transition).

### `POST /api/bookings/{id}/checkout` — Requires role: `Driver`
Triggers the saga's completion path — **response reflects the still-`CheckedIn` state**, not the final `Completed` state (see saga note above). Only valid from `status="CheckedIn"`. No body.

Success (200): `BookingResponse` (status still `"CheckedIn"` at response time), message `"Checkout in progress."` Errors: 401, 404, 409 (wrong status).

### `POST /api/bookings/{id}/cancel` — Requires role: `Driver`
Triggers the saga's cancellation/compensation path (releases the spot if reserved). Not valid once `Completed`/`Cancelled`/`NoShow`.

Request: `{ "reason": "Change of plans" }`
Success (200): `BookingResponse` (status not yet updated at response time — saga drives it to `"Cancelled"` asynchronously), message `"Cancellation in progress."` Errors: 401, 404, 409 (`"Cannot cancel a booking in status 'Completed'."` etc).

### Internal only (not reachable via Gateway)
`GET /internal/bookings/vehicle/{vehicleId}/active-count` — `X-Internal-Key`; superseded by gRPC `ActiveBookingsService.CheckActiveBookings` (Vehicle service calls this before allowing an unconfirmed vehicle delete). Not for frontend use.

---

