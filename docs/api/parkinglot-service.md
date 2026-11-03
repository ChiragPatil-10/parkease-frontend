# ParkEase API Reference

**Source of truth for frontend integration.** All routes below are written as they
are called **through the Gateway** (`http://localhost:5000` in dev), based on the
YARP route table in `ParkEase.Gateway.API/appsettings.json`. Internal
service-to-service endpoints (`/internal/...`) are **not** reachable through the
Gateway (no route maps to them) - they're called only by other services, over
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
| 400 | `ArgumentException` - malformed input the model binder let through |
| 401 | Missing/invalid JWT, or wrong password/internal key. A 401 from the JWT check itself has an EMPTY body (no envelope); handle it by status code |
| 403 | Logged in but wrong role: EMPTY body (no envelope). Payment also returns 403 for ownership; ParkingLot `GET /lots/manager/{id}` returns 403 for another manager's id |
| 404 | Entity not found |
| 409 | `InvalidOperationException` (business-rule conflict) or `DbUpdateConcurrencyException` (optimistic-concurrency clash on a spot/booking/vehicle/payment update - client should refetch and retry) |
| 422 | FluentValidation failure - see `errors` dict shape above |
| 429 | Rate limit exceeded (Gateway). JSON envelope plus a `Retry-After` header, see the Gateway section |
| 500 | Unhandled exception |

**Rate limiting (Gateway-wide).** Every route **not** individually called out below
uses the Gateway's global default: a token-bucket limiter, 100-token capacity,
refilling 20 tokens every 10s, partitioned by authenticated user id (falls back
to IP for anonymous calls). Two routes override this: Auth login/register (5 per 60s
per IP) and Payment (10 in flight plus a queue of 5). A rejected request gets a 429
with a `Retry-After` header, see the Gateway section.

---


# ParkingLot Service

Owns parking-lot records: CRUD, Nominatim-based auto-geocoding of the address,
admin approval and rejection, open/closed toggling, city/nearby search, and the
available-spot counter that Spot/Booking keep in sync via gRPC.

## Enums
⚠️ `VehicleType` exists in `ParkEase.ParkingLot.Domain.Enums` (`Any, Car, Motorcycle, Truck, Van`) but **does not appear on any DTO I found** in this service's Application layer - it looks unused/dead in the current API surface. Don't build UI around it for ParkingLot; the vehicle-type story lives in Spot/Vehicle instead (see their own enums below, which use a **different** set of values: `TwoWheeler, FourWheeler, Heavy`).

## Lot object changes (approval status)

Every endpoint that returns a lot (`LotResponse`) now also sends:
- `approvalStatus`: `"Pending"`, `"Approved"` or `"Rejected"`. Use this for labels.
  `isApproved` is still sent and is true only when `approvalStatus` is `"Approved"`.
- `managerName`: string or null. Filled only by `GET /lots/pending` and `GET /lots/all`
  (one lookup per distinct manager). Null on every other endpoint, and null if the
  lookup failed, so show a fallback such as "Unknown manager".

State rules:
- A lot starts Pending, and creation auto-approves it (see create below).
- Approve and Reject only work from Pending. Anything else gives 409 `"Lot is not pending approval."`
- Editing a Rejected lot (`PUT /lots/{id}`) sends it back to Pending. It is NOT auto-approved again.

For the admin pages see also `admin.md`, which takes priority if the two ever disagree.

## Endpoints

### `POST /api/v1/lots` - Requires role: `Manager`
Request - all fields required except `description`. **Do not send `latitude`/`longitude`** - the backend geocodes `address` via Nominatim automatically:
```json
{
  "name": "MG Road Multilevel Parking",
  "address": "45 MG Road, Bangalore, Karnataka, India",
  "city": "Bangalore",
  "totalSpots": 120,
  "minPricePerHour": 20.00,
  "maxPricePerHour": 60.00,
  "openTime": "06:00:00",
  "closeTime": "23:00:00",
  "description": "Covered multilevel parking near MG Road metro station"
}
```
`openTime`/`closeTime` are `TimeOnly` → serialized `"HH:mm:ss"` strings.

Success (201) - the lot is **auto-approved** on creation (see note below):
```json
{
  "success": true, "message": "Parking lot created and approved. Coordinates resolved automatically.",
  "data": {
    "lotId": "9c858901-8a57-4791-81fe-4c455b099bc9",
    "name": "MG Road Multilevel Parking",
    "address": "45 MG Road, Bangalore, Karnataka, India",
    "city": "bangalore",
    "latitude": 12.9757,
    "longitude": 77.6069,
    "totalSpots": 120,
    "availableSpots": 120,
    "minPricePerHour": 20.00,
    "maxPricePerHour": 60.00,
    "openTime": "06:00:00",
    "closeTime": "23:00:00",
    "isApproved": true,
    "approvalStatus": "Approved",
    "managerName": null,
    "isOpen": false,
    "description": "Covered multilevel parking near MG Road metro station",
    "approvalFeedback": "Auto-approved: manager account is verified.",
    "approvedAt": "2026-09-16T15:30:00Z",
    "managerId": "5f2504e0-4f89-11d3-9a0c-0305e82c3302",
    "createdAt": "2026-09-16T15:30:00Z",
    "updatedAt": "2026-09-16T15:30:00Z"
  },
  "errors": null
}
```
⚠️ **Important frontend gotcha:** `CreateAsync` creates the lot as Pending and then approves it straight away (a deliberate choice), so **every new lot is already Approved when it is returned**. `GET /pending` is normally empty. It only holds older lots that were never approved and Rejected lots that a manager edited and resubmitted. Don't build a "wait for admin approval" flow expecting pending lots to show up from normal creation. `city` is lowercased server-side on write - display it back with your own casing if needed.

Errors: 400 (`"Could not resolve coordinates for address: '...'"` - geocoding failed), 422 (validation: name max 200, address 10 to 500 characters, city max 100, totalSpots above 0, minPricePerHour 0 or more, maxPricePerHour not below min, description max 1000).

### `GET /api/v1/lots/{id}`
Anonymous. Success (200): single `LotResponse` (shape above). Errors: 404.

### `PUT /api/v1/lots/{id}` - Requires role: `Manager`
Same body shape as create (`UpdateLotRequest` - identical fields, no `latitude`/`longitude`). Re-geocodes only if `address` actually changed (case-insensitive string compare). Success (200): updated `LotResponse`, message `"Parking lot updated. Coordinates re-resolved if address changed."` If the lot was Rejected, a successful edit returns it to `approvalStatus` `"Pending"` (not auto-approved). Errors: 401 (not the owning manager, message `"You do not own this parking lot."`; this service maps it to **401**, not 403), 404, 400 (re-geocode failure), 422.

### `DELETE /api/v1/lots/{id}` - Requires role: `Manager` or `Admin`
No body. Managers can only delete their own lots; Admins can delete any. Success (200): message `"Parking lot deleted."` Errors: 401, 404.

### `PUT /api/v1/lots/{id}/toggle-open` - Requires role: `Manager`
No body. Flips `isOpen`. Success (200): updated `LotResponse`. Errors: 409 (`"Cannot open a lot that has not been approved."` - this now applies to Pending and Rejected lots), 401, 404.

### `PUT /api/v1/lots/{id}/approve` - Requires role: `Admin`
A JSON body is required; send `{}` (an empty body gives 400). `feedback` is optional: `{ "feedback": "Looks good, welcome aboard." }`
Success (200): updated `LotResponse` (`approvalStatus` `"Approved"`), message `"Lot approved."` - publishes `LotApprovedEvent` → Notification emails the manager. Errors: 404, 409 (`"Lot is not pending approval."`).

### `PUT /api/v1/lots/{id}/reject` - Requires role: `Admin`
Body optional: `{ "feedback": "Please add a clearer address." }`. Feedback is trimmed, an empty value becomes null, maximum 500 characters.
Success (200): updated `LotResponse` (`approvalStatus` `"Rejected"`, `approvalFeedback` set), message `"Lot rejected."` - publishes `LotRejectedEvent` → Notification emails the manager with the feedback.
Errors: 400 (`"Feedback must not exceed 500 characters."`), 404, 409 (`"Lot is not pending approval."`).

### `GET /api/v1/lots/manager/{managerId}` - Requires role: `Manager` or `Admin`
A Manager may only query their own id (403 with an empty body via `Forbid()` if mismatched; this is the one place in ParkingLot that returns 403). Success (200): flat array of `LotResponse`, newest first, including Pending and Rejected lots (so the manager can see their lot's `approvalStatus` and `approvalFeedback`).

### `GET /api/v1/lots/pending` - Requires role: `Admin`
Success (200): flat array (not paged) of lots with `approvalStatus` `"Pending"`, oldest first, each with `managerName`. Rejected lots are not included. See the auto-approve caveat above: expect this to be empty in normal operation.

### `GET /api/v1/lots/all` - Requires role: `Admin`
Query: `page` (default 1, below 1 becomes 1), `pageSize` (default 10, clamped to 1..50). Success (200): `PagedResponse<LotResponse>` (same paging shape as Auth's `GET /users`), every lot of any status, newest first, each with `managerName`.

### `GET /api/v1/lots/search`
Anonymous. Query: `city` (required), `minPrice`, `maxPrice` (optional), `page`, `pageSize`. Only returns Approved lots (`isApproved=true`), sorted with available lots first then by min price. Success (200): `PagedResponse<LotResponse>`.

### `GET /api/v1/lots/nearby`
Anonymous. Query: `latitude` (required), `longitude` (required), `radiusKm` (default 2.0), `minPrice`, `maxPrice` (optional). **Get lat/lng from browser GPS - do not geocode the driver's location.** Returns up to 10 results, open + with availability only, sorted nearest-first.

Success (200):
```json
{
  "success": true, "message": null,
  "data": [
    {
      "lotId": "9c858901-8a57-4791-81fe-4c455b099bc9",
      "name": "MG Road Multilevel Parking",
      "address": "45 MG Road, Bangalore, Karnataka, India",
      "city": "bangalore",
      "latitude": 12.9757, "longitude": 77.6069,
      "availableSpots": 87,
      "minPricePerHour": 20.00, "maxPricePerHour": 60.00,
      "isOpen": true,
      "distanceKm": 0.42
    }
  ],
  "errors": null
}
```

### Internal only (not reachable via Gateway)
`PUT /internal/lots/{id}/decrement-available`, `PUT /internal/lots/{id}/increment-available` - `X-Internal-Key`; superseded by gRPC `LotService.DecrementAvailable`/`IncrementAvailable` for real callers (Booking, Spot).

---

