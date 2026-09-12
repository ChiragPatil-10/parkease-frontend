# ParkEase API Reference — 02. ParkingLot Service

> See `00-gateway-and-conventions.md` for the response envelope, field-type conventions, and rate-limit policy details.

**Owns:** parking lot CRUD, geocoding (address → lat/lng via OpenStreetMap Nominatim, automatic), open/close status, admin approval, city search, and GPS-based nearby search.

Controller route verified: `ParkingLotController` → `[Route("api/v1/lots")]`, matching Gateway's `/api/v1/lots/{**catch-all}`.

**Important behavioral note (verified from `ParkingLotService.CreateAsync`):** lots are **auto-approved at creation time** (`lot.Approve("Auto-approved: manager account is verified.")` runs immediately after `Create`). The `/approve` endpoint and `IsApproved` flag still exist and are enforced elsewhere (Spot Service won't let a manager add spots to an unapproved lot), but in practice a lot created through this endpoint is already `isApproved: true` — `GET /pending` will typically be empty unless something changes this behavior later.

---

## Enums

None of this service's request or response DTOs use an enum on the wire. (The `VehicleType` enum defined in `ParkEase.ParkingLot.Domain.Enums` — `Any, Car, Motorcycle, Truck, Van` — is **dead code**: verified via search, it is not referenced anywhere in this service's Application or API layers. Do not build against it; it has no HTTP surface.)

---

## Endpoints

### `POST /api/v1/lots`
- **Auth:** requires JWT, role `Manager`
- **Request body** — all fields required except `description`:
```json
{
  "name": "Central Mall Parking",
  "address": "123 MG Road, Bangalore, India",
  "city": "Bangalore",
  "totalSpots": 50,
  "minPricePerHour": 20.00,
  "maxPricePerHour": 80.00,
  "openTime": "06:00:00",
  "closeTime": "23:00:00",
  "description": "Covered multi-level parking near the mall entrance"
}
```
  - **Do not send `latitude`/`longitude`** — the backend geocodes `address` server-side via Nominatim. This is intentional, not an oversight.
  - `address`: 10–500 chars. `name`: 1–200 chars. `city`: 1–100 chars. `totalSpots`: >0. `minPricePerHour`: ≥0. `maxPricePerHour`: ≥ `minPricePerHour`. `description` (optional): ≤1000 chars.
- **Success — `201 Created`:**
```json
{
  "success": true,
  "message": "Parking lot created and approved. Coordinates resolved automatically.",
  "data": {
    "lotId": "b1c2d3e4-...",
    "name": "Central Mall Parking",
    "address": "123 MG Road, Bangalore, India",
    "city": "Bangalore",
    "latitude": 12.9716,
    "longitude": 77.5946,
    "totalSpots": 50,
    "availableSpots": 50,
    "minPricePerHour": 20.00,
    "maxPricePerHour": 80.00,
    "openTime": "06:00:00",
    "closeTime": "23:00:00",
    "isApproved": true,
    "isOpen": false,
    "description": "Covered multi-level parking near the mall entrance",
    "approvalFeedback": "Auto-approved: manager account is verified.",
    "approvedAt": "2026-09-06T14:00:00Z",
    "managerId": "a1b2c3d4-...",
    "createdAt": "2026-09-06T14:00:00Z",
    "updatedAt": "2026-09-06T14:00:00Z"
  },
  "errors": null
}
```
  - ⚠️ Note `isOpen: false` by default at creation — confirmed from the entity default; the manager must explicitly call the toggle-open endpoint before driver-facing nearby/search results will surface this lot (both search paths filter or weight on `isOpen`).
- **Errors:**
  - `409` — Nominatim couldn't resolve the address: `{"success":false,"message":"Could not resolve coordinates for address: '123 Fake St'. Please provide a more specific address (include city and country).","data":null,"errors":null}`
  - `422` — validation failure

### `GET /api/v1/lots/{id}`
- **Auth:** anonymous
- **Success — `200 OK`:** single `LotResponse` (shape above). **Errors:** `404`.

### `PUT /api/v1/lots/{id}`
- **Auth:** requires JWT, role `Manager` (must own the lot — enforced server-side, mismatched manager gets `401`)
- **Request body:** same shape as create, all required except `description` (no lat/lng here either — re-geocoded automatically if `address` changed):
```json
{
  "name": "Central Mall Parking — East Wing",
  "address": "123 MG Road, Bangalore, India",
  "city": "Bangalore",
  "totalSpots": 60,
  "minPricePerHour": 25.00,
  "maxPricePerHour": 90.00,
  "openTime": "06:00:00",
  "closeTime": "23:30:00",
  "description": "Now with 10 more spots"
}
```
- **Success — `200 OK`:** updated `LotResponse`, message `"Parking lot updated. Coordinates re-resolved if address changed."`
- **Errors:** `401` (not the owning manager), `404`, `409` (geocode failure if address changed), `422`

### `DELETE /api/v1/lots/{id}`
- **Auth:** requires JWT, role `Manager` **or** `Admin` (Admin can delete any lot; Manager only their own — ownership check is skipped entirely when caller is Admin)
- **Success — `200 OK`:** `{"success":true,"message":"Parking lot deleted.","data":{},"errors":null}`
- **Errors:** `401` (Manager attempting to delete someone else's lot), `404`

### `PUT /api/v1/lots/{id}/toggle-open`
- **Auth:** requires JWT, role `Manager` (owner only)
- **Request body:** none
- **Success — `200 OK`:** updated `LotResponse` reflecting the flipped `isOpen`.
- **Errors:** `401` (not owner), `404`

### `PUT /api/v1/lots/{id}/approve`
- **Auth:** requires JWT, role `Admin`
- **Request body** — optional:
```json
{ "feedback": "Looks good, approved for public listing." }
```
- **Success — `200 OK`:** updated `LotResponse`, message `"Lot approved."` — in practice this is mostly a no-op re-approval / feedback-attach action since lots are already auto-approved at creation (see note at top of file).
- **Errors:** `404`

### `GET /api/v1/lots/manager/{managerId}`
- **Auth:** requires JWT, role `Manager` (only own id) or `Admin` (any id) — mismatched Manager id gets `403 Forbid()` (⚠️ this specific action uses ASP.NET's `Forbid()` helper directly rather than throwing `UnauthorizedAccessException`, so it does **not** go through the standard exception-middleware mapping — it's a native ASP.NET `403`, and the response body is likely the framework default, **not** the `ApiResponse` envelope. Verify this specific case at runtime.)
- **Success — `200 OK`:** `ApiResponse<IEnumerable<LotResponse>>` — flat array, not paged.

### `GET /api/v1/lots/pending`
- **Auth:** requires JWT, role `Admin`
- **Success — `200 OK`:** `ApiResponse<IEnumerable<LotResponse>>` of lots where `isApproved == false` — expect this to usually be empty (see auto-approval note above).

### `GET /api/v1/lots/all`
- **Auth:** requires JWT, role `Admin`
- **Query params:** `page` (default `1`), `pageSize` (default `10`)
- **Success — `200 OK`:** `PagedResponse<LotResponse>` (same paging shape as Auth's user list).

### `GET /api/v1/lots/search`
- **Auth:** anonymous
- **Query params:** `city` (required, string), `minPrice`/`maxPrice` (optional decimals), `page` (default `1`), `pageSize` (default `10`, max `50`)
- **Success — `200 OK`:** `PagedResponse<LotResponse>`.
- **Errors:** `422` if `city` empty, `pageSize` outside `1–50`, or `maxPrice < minPrice`.

### `GET /api/v1/lots/nearby`
- **Auth:** anonymous
- **Query params:** `latitude` (required, double, driver's GPS — **do not geocode this**, it's raw coordinates), `longitude` (required), `radiusKm` (optional, default **`2.0`** — ⚠️ note the controller's own default differs from the `NearbyLotsRequest` DTO's record default of `5.0`; the controller's `2.0` is what actually applies when the query param is omitted), `minPrice`/`maxPrice` (optional decimals)
- **Success — `200 OK`:**
```json
{
  "success": true,
  "message": null,
  "data": [
    {
      "lotId": "b1c2d3e4-...",
      "name": "Central Mall Parking",
      "address": "123 MG Road, Bangalore, India",
      "city": "Bangalore",
      "latitude": 12.9716,
      "longitude": 77.5946,
      "availableSpots": 12,
      "minPricePerHour": 20.00,
      "maxPricePerHour": 80.00,
      "isOpen": true,
      "distanceKm": 0.84
    }
  ],
  "errors": null
}
```
  - Flat array (not paged), max 10 results, sorted nearest-first, pre-filtered to `isOpen == true && availableSpots > 0`.
- **Errors:** `422` if `latitude`/`longitude`/`radiusKm` fail validation (`latitude` ∈ [-90,90], `longitude` ∈ [-180,180], `radiusKm` ∈ [0.1,100]).

---

## Not exposed through the Gateway (internal service-to-service only)

### `PUT /internal/lots/{id}/decrement-available` and `PUT /internal/lots/{id}/increment-available`
- Protected by `X-Internal-Key`. Called by Booking/Spot to keep `availableSpots` in sync when a spot is reserved/occupied/released. Success body: `{"success":true,"message":null,"data":{"availableSpots":11},"errors":null}`. Not reachable via Gateway.
- Note: these REST endpoints coexist with an equivalent gRPC `LotService` (proto: `GetLot`, `DecrementAvailable`, `IncrementAvailable`) used by Booking's and Spot's actual gRPC clients — the REST versions may be legacy/unused in the current call path, but both exist in the codebase.
