# ParkEase API Reference — Gateway & Global Conventions

> **Read this file first.** It defines conventions that apply to every service file in this set (01–07). Per-service files do not repeat these rules — they only call out where a service *deviates* from them.

All client traffic goes through the **YARP Gateway** (`ParkEase.Gateway.API`). The Gateway does **not** implement any business logic or its own JSON endpoints — it only does JWT-presence parsing (for rate-limit partitioning), rate limiting, and reverse-proxying. Every route below is what the frontend actually calls; the Gateway rewrites nothing (path-based routing, no prefix stripping).

---

## 1. Global response envelope

Every service wraps every response (success and error) in the same envelope shape. This is verified identically across all 7 services' `ApiResponse<T>` class:

```json
{
  "success": true,
  "message": "Optional human-readable message, may be null",
  "data": { "...": "endpoint-specific payload, may be null" },
  "errors": null
}
```

On a validation failure (`422`), `errors` is populated and `data` is `null`:

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

⚠️ **Verify against actual runtime**: error-dictionary keys are very likely **PascalCase** (matching the C# record property name used in `RuleFor(x => x.PropertyName)`, e.g. `"FullName"`, `"Email"`), not camelCase, because FluentValidation's `AddFluentValidationAutoValidation()` integration keys `ModelState` by the property name from the validator, not the incoming JSON casing. Successful response bodies (`data`) **are** camelCase (see §2). This PascalCase-vs-camelCase split between `data` and `errors` is a real inconsistency in the API — confirmed from the validator/middleware source, but not observed from a live HTTP response, so treat the exact casing as needing a quick smoke-test before you build error-mapping UI around it.

On a non-validation failure (`401/403/404/409/500`), `data` and `errors` are both `null`:

```json
{
  "success": false,
  "message": "Booking 'a1b2c3d4-...' not found.",
  "data": null,
  "errors": null
}
```

## 2. Field/type conventions (verified from DTOs + framework defaults)

| C# type | Wire format | Example |
|---|---|---|
| `Guid` | string | `"3fa85f64-5717-4562-b3fc-2c963f66afa6"` |
| `DateTime` | ISO-8601 string | `"2026-09-06T14:30:00Z"` |
| `DateTime?` | ISO-8601 string or `null` | `null` |
| `decimal` | JSON number (not string) | `45.50` |
| `TimeOnly` | ⚠️ time string — verify exact format at runtime, expected `"08:00:00"` (.NET's built-in `TimeOnly` converter; may include fractional seconds) | `"08:00:00"` |
| `bool` | JSON boolean | `true` |
| C# enum used **only in a response DTO** | string (every response DTO maps enums via `.ToString()` in AutoMapper/manual mapping — verified in Booking/Spot/Vehicle/Payment) | `"Confirmed"` |
| C# enum used **in a request DTO** | ⚠️ **service-dependent — see §3.** Do not assume string. |
| Property casing, all response bodies | camelCase (ASP.NET Core's default `System.Text.Json` output policy; no service overrides this) | `spotId`, `pricePerHour` |

## 3. ⚠️ Critical: enum wire format differs by service on REQUEST bodies

This is verified directly from each service's `Program.cs` — **only `ParkEase.Spot` registers a `JsonStringEnumConverter`.** No other service does.

| Service | Registers `JsonStringEnumConverter`? | Effect on request bodies containing a raw enum field |
|---|---|---|
| **Spot** | ✅ Yes | Accepts **and** requires the enum **name as a string** (e.g. `"spotType": "Standard"`, `"vehicleType": "FourWheeler"`). |
| **Vehicle** | ❌ No | `CreateVehicleRequest.VehicleType` is a raw enum field with **no converter registered**. System.Text.Json's default behavior for enums with no converter is to require the **integer ordinal** (e.g. `"vehicleType": 1` for `FourWheeler`), and a JSON **string** value will fail deserialization (400-level error before validators even run). **Recommend confirming this with one real request before wiring the frontend** — this is the single highest-risk integration detail in the whole API and is called out again in the Vehicle service file. |
| Auth, Booking, ParkingLot, Payment, Notification | N/A | These services' request DTOs contain **no raw enum fields at all** (role/status filters are passed as plain query-string `string` and parsed server-side with `Enum.TryParse`, case-insensitive) — so this issue doesn't arise for them. |

**Enum-to-int mapping** (C# enums serialize as their declaration-order ordinal, starting at 0), for the one place this matters (Vehicle's `VehicleType`):

| Value | Ordinal |
|---|---|
| `TwoWheeler` | `0` |
| `FourWheeler` | `1` |
| `Heavy` | `2` |

## 4. Authentication

- Scheme: `Authorization: Bearer <access_token>` (HMAC-SHA256 JWT, minted by Auth).
- The Gateway itself does **not** enforce `[Authorize]` — it only parses the JWT (if present) to decide the rate-limit partition key. **Every actual authorization check happens in the downstream service.** A request with a missing/garbage token that hits an anonymous endpoint (e.g. `/api/v1/lots/search`) will succeed; the same request against an `[Authorize]`-protected route will get a `401` from that service, not from the Gateway.
- Claims inside the access token (verified from `TokenService.cs`): `sub` (user id, GUID), `email`, `role` (`ClaimTypes.Role` — one of `Driver`/`Manager`/`Admin`), `jti`, `full_name`.
- Token lifetimes are configuration-driven (`Jwt:AccessTokenExpiryMinutes`, default `60`; `Jwt:RefreshTokenExpiryDays`, default `30`) — ⚠️ verify actual configured values against the deployed `appsettings.json`, don't hardcode 60/30 in the frontend.

## 5. Rate limiting (enforced only at the Gateway — verified from `ServiceCollectionExtensions.cs`)

| Policy | Applies to | Algorithm | Limit | Partition key |
|---|---|---|---|---|
| `auth-login` | `POST /api/v1/auth/login`, `POST /api/v1/auth/register/*` | Fixed window | **5 requests / 60 seconds**, queue = 0 (extra requests are rejected immediately, not queued) | Caller IP |
| `payment-ops` | `/api/payments/*` (all methods) | Concurrency limiter (not a time window) | **10 concurrent in-flight requests**, queue = 5 (11th–15th requests wait; 16th+ rejected) | One shared bucket for **all** callers, not per-user |
| *(default, unnamed)* | Every other route on every other service | Token bucket | **100 token capacity, refills 20 tokens per 10 seconds** | Authenticated user id if JWT present and valid, else caller IP |

On rejection: **`429 Too Many Requests`**, no JSON body is guaranteed (this is `RejectionStatusCode`, set directly on the ASP.NET Core rate limiter, bypassing the downstream service's `ApiResponse` envelope) — ⚠️ verify actual response body shape for 429s; it is very likely an empty body or a plain-text/default framework response, **not** the `{success, message, data, errors}` envelope the rest of this API uses.

## 6. Full routing table (Gateway path → downstream service)

| Path pattern | Downstream cluster | Rate limit policy | Notes |
|---|---|---|---|
| `POST /api/v1/auth/login` | Auth | `auth-login` | |
| `POST /api/v1/auth/register/{**catch-all}` | Auth | `auth-login` | matches `register/driver`, `register/manager` |
| `/api/v1/auth/{**catch-all}` | Auth | default | all other `/api/v1/auth/*` routes |
| `/api/v1/admin/{**catch-all}` | Auth | default | manager-application admin endpoints |
| `GET /api/v1/health` | Auth | default | this is **Auth's own health JSON endpoint**, not a Gateway-level health check — see file 01 |
| `/api/v1/lots/{**catch-all}` | ParkingLot | default | |
| `/api/v1/spots/{**catch-all}` | Spot | default | |
| `/api/vehicles/{**catch-all}` | Vehicle | default | ⚠️ no `/v1/` segment — inconsistent with most other services |
| `/api/bookings/{**catch-all}` | Booking | default | ⚠️ no `/v1/` segment |
| `/api/payments/{**catch-all}` | Payment | `payment-ops` | ⚠️ no `/v1/` segment |
| `/api/v1/notifications/{**catch-all}` | Notification | default | |

**Not reachable through the Gateway at all** (no matching route exists in `ReverseProxy:Routes`): any path starting with `/internal/...` on any service, and each service's own bare `/health` (that's YARP's own active-health-check target, hit directly by the Gateway, not exposed to the internet). Every `/internal/...` endpoint documented in files 01–07 is service-to-service only (protected by an `X-Internal-Key` header, not JWT) — flagged individually in each file, listed for completeness in case you're building an admin/ops tool that talks to a service directly rather than through the Gateway, but **do not** call these from the regular frontend.

## 7. What's NOT verified / inferred in this whole document set

- Exact `429` response body shape (§5).
- Exact `TimeOnly` JSON string format (§2).
- Exact casing of `errors` dictionary keys (§1).
- Whether Vehicle's enum-as-integer requirement (§3) has been hit in practice — it's a direct reading of the absence of a converter, not an observed failure.

Anywhere a per-service file uses "⚠️ verify against actual controller/response", it means: the field name, type, or presence is based on reading the DTO/controller/validator source directly (high confidence) but was not confirmed against a live HTTP response in this conversation.
