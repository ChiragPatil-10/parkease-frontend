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


# Payment Service

Owns payment records — one per booking. **Fully event-driven**: it never
creates or mutates a payment in response to an HTTP call. All writes happen
internally via RabbitMQ consumers reacting to Booking's lifecycle events (a
real Razorpay test-mode order is created when a booking is created, captured
on completion, voided/refunded on cancellation). The only HTTP surface is
read-only.

## Enums

| Enum | Wire values | Used in |
|---|---|---|
| `PaymentStatus` | `"Held"` → `"Captured"` \| `"Voided"` \| `"Refunded"` \| `"Failed"` | response `status` only |

## Rate limiting
Both endpoints below sit behind the Gateway's `payment-ops` policy: a
**concurrency limiter**, not a time-window one — max **10 simultaneous
in-flight requests** across all callers combined, with a **queue depth of 5**
for excess requests before they're rejected. This protects the
Razorpay-adjacent path, not literal payment-writing calls (since this service
has none) — but it still applies to these read endpoints because the route
match is on the whole `/api/payments/{**catch-all}` prefix. Under heavy
concurrent load a 429 here means "too many simultaneous payment-status
lookups," not a per-user throttle — don't treat it as a signal to back off a
specific user's requests.

## Endpoints

### `GET /api/payments/booking/{bookingId}`
Requires JWT (any role). A Driver may only view their own payment; Manager/Admin may view any.

Success (200):
```json
{
  "success": true, "message": null,
  "data": {
    "paymentId": "6c9e6679-7425-40de-944b-e07fc1f90ae9",
    "bookingId": "4c9e6679-7425-40de-944b-e07fc1f90ae8",
    "driverId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    "amount": 50.00,
    "status": "Held",
    "gatewayOrderId": "order_NJ8x92hK7QwErT",
    "failureReason": null,
    "createdAt": "2026-09-16T15:30:05Z",
    "updatedAt": "2026-09-16T15:30:05Z"
  },
  "errors": null
}
```
If the Razorpay order creation failed at booking-creation time, expect `status: "Failed"`, `gatewayOrderId: ""`, and `failureReason` populated instead.

Errors: **403** (not the owning driver and not privileged — ⚠️ this is the one service where an ownership failure is genuinely 403, thrown as `UnauthorizedAccessException` and mapped to `Forbidden` explicitly in this service's exception middleware, unlike ParkingLot/Spot/Vehicle/Booking which map the same exception type to 401), 404 (`"No payment found for booking '...'."` — e.g. queried before the async consumer has processed `BookingCreatedEvent` yet; frontend should treat this as "still processing," not a hard error, and may want to poll briefly).

### `GET /api/payments/{id}` — Requires role: `Manager` or `Admin`
Success (200): same `PaymentResponse` shape as above. Errors: 404.

---

