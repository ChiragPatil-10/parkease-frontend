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


# Gateway

The Gateway (YARP) is pure routing + cross-cutting concerns - it exposes
**no business endpoints of its own** for the frontend to call, beyond:

### `GET /health`
Anonymous. Gateway's own liveness probe (does **not** aggregate downstream
service health - each service's `/health` is checked independently by YARP's
active health-check, used internally for load-balancing/failover, not exposed
as an aggregate status endpoint).

```json
{ "status": "Healthy" }
```
⚠️ This is YARP's default ASP.NET Core health-check output format (plain
`{"status": "..."}`, not the `ApiResponse<T>` envelope every other endpoint in
this document uses) - don't expect the `success`/`data`/`errors` shape here.

### Everything else
All other Gateway behavior is transparent to the frontend: it forwards to the
matching downstream service by path prefix (see the route table implicit in
every service section above), validates the JWT just enough to populate
`ClaimsPrincipal` for rate-limit partitioning (a missing/invalid/expired token
here does **not** itself produce a 401 - the request still flows through, and
each downstream service enforces its own `[Authorize]`), and applies the rate
limits below. A 429 from any endpoint means the Gateway rejected it before it ever
reached the service.

### Empty 401 and 403
401 (missing or bad token) and 403 (wrong role) come from ASP.NET itself with an
EMPTY body, not the envelope. Handle them by status code only.

### Rate limits
| Routes | Limit |
|---|---|
| `/api/v1/auth/login` and `/api/v1/auth/register/*` | 5 requests per 60 seconds per IP (login and register share this limit) |
| `/api/payments/*` | at most 10 in flight, plus a queue of 5 |
| Everything else | token bucket per user (IP when anonymous): 100 capacity, 20 refilled every 10 seconds |

### 429 response
```
HTTP 429 Too Many Requests
Content-Type: application/json; charset=utf-8
Retry-After: <whole seconds, at least 1>
Access-Control-Expose-Headers: X-Idempotent-Replay,Retry-After
```
```json
{ "success": false, "message": "Too many requests. Please try again later.", "data": null, "errors": null }
```
`Retry-After` is a whole number of seconds (at least 1). When the limiter gives no
value the Gateway falls back to 60 for login/register, 10 for the default limiter and
1 for payments. Both `X-Idempotent-Replay` and `Retry-After` are exposed to the
browser through CORS. The frontend should read `Retry-After` to tell the user how long
to wait, and fall back to a generic message if the header is missing.
