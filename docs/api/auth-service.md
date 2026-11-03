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


# Auth Service

Owns user identity: registration (driver vs. pending-manager), login, JWT +
refresh-token issuance, Google OAuth, profile management, and - via
`AdminController` - user administration and manager-application approval.

⚠️ Note on routing: `AdminController`'s **existing** user-management endpoints
live under `/api/v1/auth/users/...` (they match the Gateway's `auth-route`),
while its **manager-application** endpoints live under `/api/v1/admin/...`
(they match the Gateway's separate `auth-admin-route`). Both are documented here
since both belong to the Auth service. For the admin pages see also `admin.md`, which takes priority if the two ever disagree.

## Enums

| Enum | Wire values (exact strings, case-sensitive) | Used in |
|---|---|---|
| `UserRole` | `"Driver"` \| `"Manager"` \| `"Admin"` | `UserDto.role`, `UserSummaryDto.role`, query param `role` on `GET /users` |
| `ApplicationStatus` | `"Pending"` \| `"Approved"` \| `"Rejected"` | `ManagerApplicationDto.status`, query param `status` on `GET /manager-applications` |

`UserSummaryDto.status` (new) is a third string field with these values:

| status | Meaning |
|---|---|
| `"Active"` | can sign in |
| `"Suspended"` | blocked by an admin |
| `"PendingApproval"` | manager waiting for approval |
| `"Rejected"` | manager application rejected |

Both are always emitted as **strings** in responses (the DTOs are declared as
`string`, populated via `.ToString()`). For the `role`/`status` **query-string**
filters, ASP.NET Core binds by enum name (case-insensitive), so send the same
string values.

## Endpoints

### `POST /api/v1/auth/register/driver`
Anonymous. Rate limit: **5 requests / 60s per IP** (Gateway `auth-login` policy - applies to this route too, since it matches `/api/v1/auth/register/{**catch-all}`).

Request body - `PlateNumber`/`Phone` optional, all else required:
```json
{
  "fullName": "Alice Sharma",
  "email": "alice@example.com",
  "password": "Secret123",
  "phone": "9876543210"
}
```
`phone` is optional (nullable). Password rule: min 8 chars, needs uppercase + lowercase + digit.

Success (201):
```json
{
  "success": true,
  "message": "Registration successful.",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "base64-random-64-bytes...",
    "expiresAt": "2026-09-16T15:30:00Z",
    "user": {
      "userId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
      "fullName": "Alice Sharma",
      "email": "alice@example.com",
      "role": "Driver",
      "profilePicUrl": null
    }
  },
  "errors": null
}
```
Errors: 409 (email already registered), 422 (validation).

### `POST /api/v1/auth/register/manager`
Anonymous. Same rate limit as above (`auth-login` policy also matches `register/{**catch-all}`).

Request - all fields required:
```json
{
  "fullName": "Rohan Mehta",
  "email": "rohan@example.com",
  "password": "Secret123",
  "phone": "9123456780",
  "businessName": "Mehta Parking Pvt Ltd",
  "parkingAddress": "45 MG Road, Bangalore"
}
```

Success (201) - note: **no tokens returned**, account is `IsActive=false` until admin approves:
```json
{
  "success": true,
  "message": "Application submitted. Awaiting admin approval.",
  "data": {
    "applicationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "userId": "5f2504e0-4f89-11d3-9a0c-0305e82c3302",
    "fullName": "Rohan Mehta",
    "email": "rohan@example.com",
    "phone": "9123456780",
    "businessName": "Mehta Parking Pvt Ltd",
    "parkingAddress": "45 MG Road, Bangalore",
    "status": "Pending",
    "createdAt": "2026-09-16T15:30:00Z"
  },
  "errors": null
}
```
Errors: 409 (email registered), 422 (validation).

### `POST /api/v1/auth/login`
Anonymous. Rate limit: **5 requests / 60s per IP**.

Request:
```json
{ "email": "alice@example.com", "password": "Secret123" }
```

Success (200): same shape as register/driver's `data` object above (`accessToken`, `refreshToken`, `expiresAt`, `user`).

Errors - all 401 with a generic-ish message, frontend cannot distinguish "wrong password" from "no such account" (intentional, no user enumeration), **except** manager-pending and suspended have distinct messages:
```json
{ "success": false, "message": "Invalid email or password.", "data": null, "errors": null }
```
```json
{ "success": false, "message": "Your manager account is pending admin approval.", "data": null, "errors": null }
```
```json
{ "success": false, "message": "Account is suspended. Contact support.", "data": null, "errors": null }
```

### `GET /api/v1/health`
Anonymous. No rate-limit override (global default applies).

Success (200):
```json
{
  "success": true,
  "message": null,
  "data": { "status": "healthy", "service": "ParkEase.Auth", "timestamp": "2026-09-16T15:30:00Z" },
  "errors": null
}
```

### `GET /api/v1/auth/profile`
Requires JWT.

Success (200):
```json
{
  "success": true, "message": null,
  "data": {
    "userId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
    "fullName": "Alice Sharma",
    "email": "alice@example.com",
    "role": "Driver",
    "profilePicUrl": null
  },
  "errors": null
}
```

### `PUT /api/v1/auth/profile`
Requires JWT.

Request - `fullName` required, `phone`/`profilePicUrl` optional (nullable):
```json
{ "fullName": "Alice K. Sharma", "phone": "9876543211", "profilePicUrl": "https://cdn.example.com/pics/alice.jpg" }
```
Success (200): same `UserDto` shape as `GET /profile`, message `"Profile updated successfully."`
Errors: 422 (validation - e.g. bad phone pattern or non-absolute URL).

### `PUT /api/v1/auth/password`
Requires JWT.

Request:
```json
{ "oldPassword": "Secret123", "newPassword": "NewSecret456" }
```
Success (200):
```json
{ "success": true, "message": "Password changed successfully.", "data": {}, "errors": null }
```
Errors: 401 (`"Old password is incorrect."`), 409 (`"OAuth users cannot change password."`), 422.

### `DELETE /api/v1/auth/deactivate`
Requires JWT. Deactivates the caller's own account.

Success (200): `{ "success": true, "message": "Account deactivated.", "data": {}, "errors": null }`

### `POST /api/v1/auth/refresh`
Anonymous (the refresh token itself is the credential).

Request: `{ "refreshToken": "base64-random-64-bytes..." }`
Success (200): new `AuthResponse`, message `"Token refreshed."` - old refresh token is revoked (one-time use, rotates on every refresh).
Errors: 401 (`"Invalid refresh token."` or `"Refresh token has expired or been revoked."`).

### `POST /api/v1/auth/logout`
Anonymous (idempotent - silently no-ops if the token is already invalid/unknown).

Request: `{ "refreshToken": "base64-random-64-bytes..." }`
Success (200): `{ "success": true, "message": "Logged out successfully.", "data": {}, "errors": null }`

### `POST /api/v1/auth/oauth/google`
Anonymous.

Request: `{ "code": "4/0AY0e-g7...oauth-authorization-code..." }`
Success (200): `AuthResponse` shape, message `"OAuth login successful."`
Errors: 401 (`"Account is suspended. Contact support."`), or 500 if Google's token/userinfo call fails (⚠️ verify - `GoogleOAuthService` calls `EnsureSuccessStatusCode()`, which throws an unhandled `HttpRequestException` on Google-side failure; this isn't caught anywhere specific to OAuth, so it likely surfaces as a generic 500, not a clean 4xx).

---

### `GET /api/v1/auth/users` - Requires role: `Admin`
Query params: `role` (optional, `UserRole` string; an unknown value is ignored and returns all roles), `page` (default 1, below 1 becomes 1), `pageSize` (default 10, clamped to 1..50). Newest first, with a stable tie-breaker so pages never overlap.

Success (200):
```json
{
  "success": true, "message": null,
  "data": {
    "items": [
      { "userId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301", "fullName": "Alice Sharma", "email": "alice@example.com", "role": "Driver", "isActive": true, "createdAt": "2026-08-01T09:00:00Z", "status": "Active" }
    ],
    "totalCount": 42, "page": 1, "pageSize": 10, "totalPages": 5
  },
  "errors": null
}
```

### `GET /api/v1/auth/users/{id}` - Requires role: `Admin`
Success (200): single `UserSummaryDto` (shape as one item above). Errors: 404.

### `PUT /api/v1/auth/users/{id}/suspend` - Requires role: `Admin`
No body. Success (200): `{ "success": true, "message": "User suspended.", "data": {}, "errors": null }`. The user's refresh tokens are revoked, but their current access token keeps working until it expires (up to 60 minutes), so do not promise an instant logout.
Errors: 404 (`"User '<id>' not found."`), 409 with one of these messages, checked in this order:
1. `"You can't suspend your own account."`
2. `"Admin accounts can't be suspended here."`
3. `"Only active users can be suspended."`

### `PUT /api/v1/auth/users/{id}/reactivate` - Requires role: `Admin`
No body. Success (200): message `"User reactivated."` Errors: 404, 409 with one of:
- `"Admin accounts can't be changed here."`
- `"Only suspended users can be reactivated. Approve pending managers from Manager Applications."`

### `DELETE /api/v1/auth/users/{id}` - Requires role: `Admin`
Success (200): message `"User deleted."` Errors: 404. Exists but is not used by any page (no guard against deleting yourself or an Admin yet), so do not call it from the UI.

---

### `GET /api/v1/admin/manager-applications` - Requires role: `Admin`
Query params: `status` (optional, `ApplicationStatus` string; an unknown value is ignored), `page` (default 1), `pageSize` (default 10, clamped to 1..50). Newest first.

Success (200): paged list of `ManagerApplicationDto` (same shape as register/manager's `data` object), envelope identical to `GET /users` pattern.

### `PUT /api/v1/admin/approve-manager/{applicationId}` - Requires role: `Admin`
No body. Approves the application **and** activates the user (both happen atomically in `AdminService`).

Success (200): `{ "success": true, "message": "Manager application approved. User is now active.", "data": {}, "errors": null }`
Errors: 404, 409 (`"Cannot approve an application with status 'Approved'."` - already processed).

### `PUT /api/v1/admin/reject-manager/{applicationId}` - Requires role: `Admin`
No body. Success (200): message `"Manager application rejected."` Errors: 404, 409 (already processed).

---

### Internal only (not reachable via Gateway)
`GET /internal/users/{id}` - `X-Internal-Key` header, used by Notification service (REST fallback; gRPC `AuthInternalService.GetUserContact` is the primary path per `protos/auth.proto`). Not for frontend use.

---

