# ParkEase API Reference — 01. Auth Service

> See `00-gateway-and-conventions.md` for the response envelope, field-type conventions, and rate-limit policy details referenced below.

**Owns:** user identity, registration (driver/manager split), login, JWT + refresh-token issuance, profile management, Google OAuth, and admin-side user/manager-application moderation.

Controller routes verified: `AuthController` → `[Route("api/v1/auth")]`, `AdminController` → explicit full paths under `api/v1/auth/users` and `api/v1/admin`, `InternalController` → `/internal/users/{id}` (not Gateway-exposed).

---

## Enums used by this service

**`UserRole`** (string in every response; accepted as case-insensitive string in the `role` query filter on `GET /api/v1/auth/users`):
`"Driver"`, `"Manager"`, `"Admin"`

**`ApplicationStatus`** (string in responses; accepted as case-insensitive string in the `status` query filter on `GET /api/v1/admin/manager-applications`):
`"Pending"`, `"Approved"`, `"Rejected"`

---

## Endpoints

### `POST /api/v1/auth/register/driver`
- **Auth:** anonymous
- **Rate limit:** `auth-login` policy — **5 req / 60s per IP**
- **Request body** — all fields required except `phone`:
```json
{
  "fullName": "Alice Sharma",
  "email": "alice@example.com",
  "password": "Secret1!",
  "phone": "9876543210"
}
```
  - `password` must be ≥8 chars and match `^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$` (at least one upper, one lower, one digit).
  - `phone` (optional): if present, must match `^[0-9+\-\s]{5,20}$`.
- **Success — `201 Created`:**
```json
{
  "success": true,
  "message": "Registration successful.",
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "base64-random-64-bytes",
    "expiresAt": "2026-09-06T15:30:00Z",
    "user": {
      "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "fullName": "Alice Sharma",
      "email": "alice@example.com",
      "role": "Driver",
      "profilePicUrl": null
    }
  },
  "errors": null
}
```
- **Errors:**
  - `409` — email already registered: `{"success":false,"message":"Email 'alice@example.com' is already registered.","data":null,"errors":null}`
  - `422` — validation failure (see envelope doc §1 for shape)

### `POST /api/v1/auth/register/manager`
- **Auth:** anonymous
- **Rate limit:** `auth-login` — **5 req / 60s per IP**
- **Request body** — all fields required except `phone` is required here (not optional, unlike driver):
```json
{
  "fullName": "Bob Manager",
  "email": "bob@example.com",
  "password": "Secret1!",
  "phone": "9876543211",
  "businessName": "Bob's Parking",
  "parkingAddress": "123 MG Road, Bangalore"
}
```
- **Success — `201 Created`:** note this returns a **`ManagerApplicationDto`**, not an `AuthResponse` — the account is created but **inactive** (`IsActive:false`) until an Admin approves it, so no token is issued yet.
```json
{
  "success": true,
  "message": "Application submitted. Awaiting admin approval.",
  "data": {
    "applicationId": "b2c3d4e5-...",
    "userId": "a1b2c3d4-...",
    "fullName": "Bob Manager",
    "email": "bob@example.com",
    "phone": "9876543211",
    "businessName": "Bob's Parking",
    "parkingAddress": "123 MG Road, Bangalore",
    "status": "Pending",
    "createdAt": "2026-09-06T14:00:00Z"
  },
  "errors": null
}
```
- **Errors:** `409` (email taken), `422` (validation)

### `POST /api/v1/auth/login`
- **Auth:** anonymous
- **Rate limit:** `auth-login` — **5 req / 60s per IP**
- **Request body:**
```json
{ "email": "alice@example.com", "password": "Secret1!" }
```
- **Success — `200 OK`:** same `AuthResponse` shape as driver registration above.
- **Errors — all `401`, same generic message `"Invalid email or password."` for both bad email and bad password (deliberately not distinguished, to avoid user enumeration), plus two role-specific 401 messages:**
  - Unknown email or wrong password: `{"success":false,"message":"Invalid email or password.","data":null,"errors":null}`
  - Manager account not yet approved: `{"success":false,"message":"Your manager account is pending admin approval.","data":null,"errors":null}`
  - Suspended account: `{"success":false,"message":"Account is suspended. Contact support.","data":null,"errors":null}`
  - OAuth-only account attempting password login: `{"success":false,"message":"Please use your OAuth provider to sign in.","data":null,"errors":null}`

### `GET /api/v1/health`
- **Auth:** anonymous
- **Note:** this is **Auth's own** JSON health endpoint (distinct from the bare `/health` used for YARP's active health checks, which is plain-text and not routed through the Gateway).
- **Success — `200 OK`:**
```json
{
  "success": true,
  "message": null,
  "data": {
    "status": "healthy",
    "service": "ParkEase.Auth",
    "timestamp": "2026-09-06T14:00:00Z"
  },
  "errors": null
}
```

### `GET /api/v1/auth/profile`
- **Auth:** requires JWT (any role)
- **Success — `200 OK`:**
```json
{
  "success": true,
  "message": null,
  "data": {
    "userId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "fullName": "Alice Sharma",
    "email": "alice@example.com",
    "role": "Driver",
    "profilePicUrl": null
  },
  "errors": null
}
```

### `PUT /api/v1/auth/profile`
- **Auth:** requires JWT (any role)
- **Request body** — `fullName` required, `phone`/`profilePicUrl` optional:
```json
{
  "fullName": "Alice K. Sharma",
  "phone": "9876543210",
  "profilePicUrl": "https://cdn.example.com/avatars/alice.jpg"
}
```
  - `profilePicUrl`, if present, must be a valid absolute URI and ≤500 chars.
- **Success — `200 OK`:** returns updated `UserDto` (same shape as profile GET above).
- **Errors:** `422` (validation)

### `PUT /api/v1/auth/password`
- **Auth:** requires JWT (any role)
- **Request body:**
```json
{ "oldPassword": "Secret1!", "newPassword": "NewSecret2!" }
```
  - `newPassword`: ≥8 chars, upper+lower+digit, and must differ from `oldPassword`.
- **Success — `200 OK`:**
```json
{ "success": true, "message": "Password changed successfully.", "data": {}, "errors": null }
```
- **Errors:** `401` if old password wrong or account is OAuth-only (⚠️ verify exact message — `AuthService.ChangePasswordAsync` wasn't fully re-read in this pass, inferred from the general auth-failure pattern), `422` (validation)

### `DELETE /api/v1/auth/deactivate`
- **Auth:** requires JWT (any role)
- **Request body:** none
- **Success — `200 OK`:**
```json
{ "success": true, "message": "Account deactivated.", "data": {}, "errors": null }
```

### `POST /api/v1/auth/refresh`
- **Auth:** anonymous (the refresh token itself is the credential)
- **Request body:**
```json
{ "refreshToken": "base64-random-64-bytes" }
```
- **Success — `200 OK`:** new `AuthResponse` (new access + refresh token pair).
- **Errors:** `401` if the refresh token is invalid, expired, or already revoked.

### `POST /api/v1/auth/logout`
- **Auth:** anonymous (endpoint itself has no `[Authorize]`; it just revokes whatever token is passed)
- **Request body:**
```json
{ "refreshToken": "base64-random-64-bytes" }
```
- **Success — `200 OK`:**
```json
{ "success": true, "message": "Logged out successfully.", "data": {}, "errors": null }
```

### `POST /api/v1/auth/oauth/google`
- **Auth:** anonymous
- **Request body:**
```json
{ "code": "4/0AY0e-g7...google-oauth-authorization-code..." }
```
- **Success — `200 OK`:** `AuthResponse` (creates the user on first login, role is always `Driver` for OAuth signups — verified from `User.CreateOAuth`).
- **Errors:** `401` on any OAuth exchange failure with Google.

---

## Admin endpoints (all under the same `AuthController`/`AdminController`, all require `[Authorize(Roles = "Admin")]`)

### `GET /api/v1/auth/users`
- **Auth:** requires JWT, role `Admin`
- **Query params:** `role` (optional, string, case-insensitive — `driver`/`manager`/`admin`), `page` (default `1`), `pageSize` (default `10`)
- **Success — `200 OK`:**
```json
{
  "success": true,
  "message": null,
  "data": {
    "items": [
      {
        "userId": "3fa85f64-...",
        "fullName": "Alice Sharma",
        "email": "alice@example.com",
        "role": "Driver",
        "isActive": true,
        "createdAt": "2026-08-01T10:00:00Z"
      }
    ],
    "totalCount": 42,
    "page": 1,
    "pageSize": 10,
    "totalPages": 5
  },
  "errors": null
}
```

### `GET /api/v1/auth/users/{id}`
- **Auth:** Admin only. **Success:** single `UserSummaryDto` (shape as one item above). **Errors:** `404` if not found.

### `PUT /api/v1/auth/users/{id}/suspend`
- **Auth:** Admin only. No body. **Success `200`:** `{"success":true,"message":"User suspended.","data":{},"errors":null}`. **Errors:** `404`.

### `PUT /api/v1/auth/users/{id}/reactivate`
- Same shape as suspend, message `"User reactivated."`

### `DELETE /api/v1/auth/users/{id}`
- Same shape, message `"User deleted."` — this is a hard delete (`_users.DeleteAsync`), not a soft-delete flag.

### `GET /api/v1/admin/manager-applications`
- **Auth:** Admin only
- **Query params:** `status` (optional, string, case-insensitive — `pending`/`approved`/`rejected`), `page` (default `1`), `pageSize` (default `10`)
- **Success — `200 OK`:** `PagedResponse<ManagerApplicationDto>` — same paging envelope shape as `GET /users` but `items` are `ManagerApplicationDto` (shape shown under `register/manager` above, but here `status` may also be `"Approved"`/`"Rejected"`).

### `PUT /api/v1/admin/approve-manager/{applicationId}`
- **Auth:** Admin only. No body.
- **Success `200`:** `{"success":true,"message":"Manager application approved. User is now active.","data":{},"errors":null}`
- **Errors:** `404` (application not found), `409` (application isn't in `Pending` status — e.g. already approved/rejected)

### `PUT /api/v1/admin/reject-manager/{applicationId}`
- Same shape, message `"Manager application rejected."`, same `404`/`409` error cases.

---

## Not exposed through the Gateway (internal service-to-service only)

### `GET /internal/users/{id}`
- Protected by `X-Internal-Key` header (not JWT). Called by Notification's gRPC-fronted user-contact lookup (mirrors the same logic as the gRPC `AuthGrpcService.GetUserContact`). Returns `{userId, email, fullName}`. Not reachable via the Gateway — no matching route exists for `/internal/*`.
