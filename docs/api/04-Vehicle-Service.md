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


# Vehicle Service

Owns a driver's registered vehicles: registration, listing, and a
confirm-before-delete flow that checks for active bookings first.

## Enums
✅ Confirmed by re-reading the source: `Program.cs` for this service calls only `builder.Services.AddControllers();` — no `.AddJsonOptions(...)`, no `JsonStringEnumConverter` anywhere in this project (unlike Spot's, which explicitly registers one — see that service's note). With System.Text.Json's default behavior, a bare enum property on a request DTO (`CreateVehicleRequest.VehicleType`) deserializes from its **integer** ordinal, not its string name.

⚠️ What's still unverified is only the *runtime* confirmation (I haven't sent a live request) — but the source gives no other path (no custom `JsonConverter` attribute on the DTO property either) by which a string would work. Send integers:

| Enum | Wire value in requests | Wire value in responses (verified — DTOs map to `string`) |
|---|---|---|
| `VehicleType` | `0` = TwoWheeler, `1` = FourWheeler, `2` = Heavy | `"TwoWheeler"` \| `"FourWheeler"` \| `"Heavy"` |

Additional guard: `isElectric: true` is rejected when `vehicleType` is `Heavy` (`2`).

## Endpoints

### `POST /api/vehicles` — Requires role: `Driver`
Request — `isElectric` optional (defaults `false`), all else required:
```json
{ "plateNumber": "KA01AB1234", "vehicleType": 1, "make": "Honda", "model": "City", "isElectric": false }
```
Success (201):
```json
{
  "success": true, "message": "Vehicle registered successfully.",
  "data": {
    "vehicleId": "2b4e28ba-2fa1-11d2-883f-0016d3cca428",
    "driverId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    "plateNumber": "KA01AB1234",
    "vehicleType": "FourWheeler",
    "make": "Honda", "model": "City",
    "isElectric": false, "isActive": true,
    "createdAt": "2026-09-16T15:30:00Z", "updatedAt": "2026-09-16T15:30:00Z"
  },
  "errors": null
}
```
Errors: 409 (`"A vehicle with plate number '...' is already registered."` — plate uniqueness is global, not per-driver), 400 (heavy+electric guard), 422.

### `GET /api/vehicles/my` — Requires role: `Driver`
Success (200): array of `VehicleResponse` for the caller, oldest first.

### `GET /api/vehicles/{id}` — Requires role: `Driver`
Only the owning driver may fetch it. Success (200): single `VehicleResponse`. Errors: 401 (not owner), 404.

### `DELETE /api/vehicles/{id}?confirm=true` — Requires role: `Driver`
Two-step confirm flow:
1. Call **without** `confirm` (or `confirm=false`) first. If the vehicle has any non-terminal (Pending/Confirmed/CheckedIn) booking, this returns **409** instead of deleting:
```json
{
  "success": false,
  "message": "This vehicle has an upcoming booking — deleting it will cancel that booking. Resend the request with confirm=true to proceed.",
  "data": null, "errors": null
}
```
2. Re-call with `?confirm=true` to force the delete regardless.

Success (200): message `"Vehicle deleted."` Errors: 401 (not owner), 404, 409 (as above, only when `confirm` is absent/false).

### Internal only (not reachable via Gateway)
`GET /internal/vehicles/{id}/validate` — `X-Internal-Key`; superseded by gRPC `VehicleService.Validate` (Booking calls this to validate a vehicle at booking-creation time). Not for frontend use.

---

