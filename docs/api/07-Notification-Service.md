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


# Notification Service

Owns email dispatch and a per-user notification history log. **Fully
event-driven** on the write side (15 RabbitMQ consumers across Booking,
Payment, Vehicle, ParkingLot, and Auth events render an HTML template and send
via Brevo) — the only HTTP surface is a read-only history feed for a future
"notifications bell" UI.

## Enums

| Enum | Wire values | Used in |
|---|---|---|
| `NotificationStatus` | `"Sent"` \| `"Failed"` (⚠️ `"Pending"` exists in the enum but I found no code path that persists a log row with that status — every write path is `CreateSent` or `CreateFailed`; treat `"Pending"` as theoretical) | response `status` |

## Endpoints

### `GET /api/v1/notifications/me`
Requires JWT (any role). Recipient is taken from the JWT's `email` claim — no user-id param.

Query: `page` (default 1), `pageSize` (default 20).

Success (200):
```json
{
  "success": true, "message": null,
  "data": [
    {
      "id": "8c9e6679-7425-40de-944b-e07fc1f90aea",
      "recipientEmail": "alice@example.com",
      "eventType": "BookingConfirmed",
      "subject": "Booking Confirmed 🎉",
      "status": "Sent",
      "errorMessage": null,
      "sentAt": "2026-09-16T15:30:10Z",
      "relatedEntityId": "4c9e6679-7425-40de-944b-e07fc1f90ae8"
    }
  ],
  "errors": null
}
```
⚠️ `data` here is a **flat array**, not a `PagedResponse` wrapper (no `totalCount`/`totalPages`) — unlike every paged list endpoint elsewhere in this API. Don't assume paging metadata is present; the frontend will need to infer "more pages exist" purely from whether a full page of `pageSize` items came back.

**`eventType` values you may see** (all 15 consumer types, useful for a filter dropdown or icon-per-type mapping): `BookingCreated`, `BookingConfirmed`, `BookingCancelled`, `BookingCompleted`, `BookingNoShow`, `PaymentCaptured`, `PaymentRefunded`, `VehicleDeactivated`, `LotApproved`, `ManagerApplicationApproved`, `ManagerApplicationRejected`, `UserSuspended`, `UserReactivated`, `PasswordChanged`, `UserRegistered`.

---

