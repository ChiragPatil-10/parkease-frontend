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


# Spot Service

Owns individual parking spots within a lot: creation (single + bulk), spot-type/
vehicle-type compatibility rules, pricing, and the Reserve→Occupy→Release state
machine that Booking drives during the booking saga.

## Enums
Spot's controller **explicitly registers `JsonStringEnumConverter`** — confirmed
in `Program.cs`. This means, unlike other services (see Vehicle below), Spot's
JSON request bodies accept enum values as **strings**, matching what it emits.

| Enum | Wire values | Used in |
|---|---|---|
| `SpotType` | `"Compact"` \| `"Standard"` \| `"Large"` \| `"Motorbike"` \| `"EV"` | create/update spot requests + response `spotType` |
| `VehicleType` (Spot's own copy) | `"TwoWheeler"` \| `"FourWheeler"` \| `"Heavy"` | create/update spot requests + response `vehicleType` |
| `SpotStatus` | `"Available"` \| `"Reserved"` \| `"Occupied"` | response `status` only (never client-set directly — driven by the transition endpoints) |

**Compatibility matrix enforced server-side** (violating this → 400 `ArgumentException`):
| SpotType | Allowed VehicleType(s) |
|---|---|
| `Compact` | `FourWheeler` |
| `Standard` | `FourWheeler` |
| `Large` | `FourWheeler`, `Heavy` |
| `Motorbike` | `TwoWheeler` |
| `EV` | `FourWheeler`, `TwoWheeler` |

Additional guards: `SpotType.EV` **requires** `isEvCharging: true` (and no other type may set it); `SpotType.Motorbike` **cannot** be `isHandicapped: true`.

## Endpoints

### `POST /api/v1/spots` — Requires role: `Manager`
Request — all fields required:
```json
{
  "lotId": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "spotNumber": "A-101",
  "floor": 1,
  "spotType": "Standard",
  "vehicleType": "FourWheeler",
  "isEvCharging": false,
  "isHandicapped": false,
  "pricePerHour": 25.00
}
```
Success (201):
```json
{
  "success": true, "message": "Parking spot created successfully.",
  "data": {
    "spotId": "1b4e28ba-2fa1-11d2-883f-0016d3cca427",
    "lotId": "9c858901-8a57-4791-81fe-4c455b099bc9",
    "managerId": "5f2504e0-4f89-11d3-9a0c-0305e82c3302",
    "spotNumber": "A-101",
    "floor": 1,
    "spotType": "Standard",
    "vehicleType": "FourWheeler",
    "status": "Available",
    "isHandicapped": false,
    "isEvCharging": false,
    "pricePerHour": 25.00,
    "createdAt": "2026-09-16T15:30:00Z",
    "updatedAt": "2026-09-16T15:30:00Z"
  },
  "errors": null
}
```
Errors: 404 (`"Lot not found."`), 409 (`"Cannot add spots to a lot that has not been approved."`), 400 (compatibility-matrix violation), 422.

### `POST /api/v1/spots/bulk` — Requires role: `Manager`
Request:
```json
{
  "lotId": "9c858901-8a57-4791-81fe-4c455b099bc9",
  "spots": [
    { "spotNumber": "A-101", "floor": 1, "spotType": "Standard", "vehicleType": "FourWheeler", "isEvCharging": false, "isHandicapped": false, "pricePerHour": 25.00 },
    { "spotNumber": "A-102", "floor": 1, "spotType": "Motorbike", "vehicleType": "TwoWheeler", "isEvCharging": false, "isHandicapped": false, "pricePerHour": 10.00 }
  ]
}
```
Success (201): `data` is an **array** of `SpotResponse` (same shape as single-create). Errors: same as single create, applies per-item — ⚠️ verify whether one bad item fails the whole batch (looks like yes, since `Select(...).ToList()` runs eagerly inside the same method before any DB write — a single invalid item throws before `AddRangeAsync` is called, so the whole batch is atomic-by-accident).

### `GET /api/v1/spots/{id}`
Anonymous. Success (200): single `SpotResponse`. Errors: 404.

### `GET /api/v1/spots/lot/{lotId}`
Anonymous. Success (200): array of `SpotResponse`, ordered by floor then spot number (all statuses, not just available).

### `PUT /api/v1/spots/{id}` — Requires role: `Manager` or `Admin`
Request — all fields required:
```json
{ "spotType": "Standard", "vehicleType": "FourWheeler", "isEvCharging": false, "isHandicapped": false, "pricePerHour": 30.00, "floor": 1 }
```
Success (200): updated `SpotResponse`, message `"Spot updated."` Errors: 401 (not owning manager), 404, 400 (compatibility), 409 (concurrent modification).

### `PATCH /api/v1/spots/{id}/price` — Requires role: `Manager` or `Admin`
Request: `{ "pricePerHour": 35.00 }`
Success (200): updated `SpotResponse`, message `"Spot price updated."` Errors: 401, 404, 422 (negative price).

### `DELETE /api/v1/spots/{id}` — Requires role: `Manager` or `Admin`
No body. Only deletable while `status = "Available"`. Success (200): message `"Spot deleted."` Errors: 401, 404, 409 (`"Cannot delete a spot that is not Available."`).

### `GET /api/v1/spots/lot/{lotId}/available`
Anonymous. Query (all optional): `spotType`, `vehicleType`, `isEV` (bool), `isHandicapped` (bool). Success (200): array of `SpotResponse`, `status="Available"` only, filtered.

### `GET /api/v1/spots/lot/{lotId}/available/count`
Anonymous. Success (200):
```json
{ "success": true, "message": null, "data": { "lotId": "9c858901-8a57-4791-81fe-4c455b099bc9", "availableCount": 87 }, "errors": null }
```

### Internal only (not reachable via Gateway)
`PUT /internal/spots/{id}/reserve|occupy|release` — `X-Internal-Key` + `X-Actor-Id` header; superseded by gRPC `SpotService.Reserve/Occupy/Release` for Booking's saga calls. Not for frontend use — these transitions only ever happen as a side effect of the Booking endpoints below.

---

