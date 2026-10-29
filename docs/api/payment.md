# ParkEase API Reference

**Source of truth for frontend integration.** All routes below are written as they
are called **through the Gateway** (`http://localhost:5000` in dev), based on the
YARP route table in `ParkEase.Gateway.API/appsettings.json`. Internal
service-to-service endpoints (`/internal/...`) are **not** reachable through the
Gateway. They are called only by other services and are listed separately per
service for completeness only.

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

**Timestamps.** All timestamps are UTC ISO 8601 strings ending in `Z`.

**Auth header.** `Authorization: Bearer <accessToken>` for every endpoint marked
"Requires JWT" or "Requires role: X".

**Common error shapes.** Unless noted per endpoint, services map exceptions like this:

| Status | When |
|---|---|
| 400 | Malformed or invalid input (`ArgumentException`) |
| 401 | Missing or invalid JWT. On Booking, Spot, Vehicle and ParkingLot also an ownership failure (see the Booking service note) |
| 403 | Ownership failure on the Payment service only; also a valid JWT with the wrong role |
| 404 | Entity not found |
| 409 | Business rule conflict, or a concurrent update (refetch and retry) |
| 422 | Validation failure, see the `errors` object above |
| 429 | Rate limit exceeded (Gateway) |
| 500 | Unhandled exception |

**Rate limiting (Gateway).** Routes without their own policy use a token bucket:
100 tokens, refilled 20 every 10 seconds, partitioned by user id (IP when
anonymous). Auth login and register use 5 requests per minute per IP. Payment
routes use a shared concurrency limit (see the Payment doc).

---

# Payment Service

Owns payment records, one per booking, using Razorpay Orders in test mode. The
Payment service creates the order when a booking is created (event driven). The
driver then pays in Razorpay Checkout and the frontend confirms with
`POST /api/payments/verify`.

Bookings are **prepaid**: money is captured when the driver pays, the booking
becomes `Confirmed` after that, and a cancel refunds it.

## Enums

| Enum | Wire values | Meaning |
|---|---|---|
| `PaymentStatus` | `"Created"` | A Razorpay order exists and is waiting for the driver to pay |
| | `"Captured"` | The driver paid and the money was captured |
| | `"Refunded"` | A captured payment was refunded |
| | `"RefundFailed"` | A refund is due but the Razorpay refund failed; needs a manual refund |
| | `"Voided"` | The booking was cancelled before any payment |
| | `"Failed"` | The order could not be created, so there is nothing to pay |
| | `"Held"` | Legacy status from before prepay. Treat like `"Captured"` for display. Old rows only |

## Response object (`PaymentResponse`)

```json
{
  "paymentId": "6c9e6679-7425-40de-944b-e07fc1f90ae9",
  "bookingId": "4c9e6679-7425-40de-944b-e07fc1f90ae8",
  "driverId": "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
  "amount": 50.00,
  "status": "Created",
  "gatewayOrderId": "order_NJ8x92hK7QwErT",
  "failureReason": null,
  "createdAt": "2026-09-16T15:30:05Z",
  "updatedAt": "2026-09-16T15:30:05Z",
  "razorpayKeyId": "rzp_test_xxxxxxxxxxxx",
  "amountInPaise": 5000,
  "currency": "INR",
  "razorpayPaymentId": null,
  "paidAt": null
}
```

- `razorpayKeyId` is the public key to pass to Razorpay Checkout. The key secret never leaves the backend.
- `amountInPaise` and `currency` are the values to pass to Checkout (50.00 INR is 5000 paise).
- `razorpayPaymentId` and `paidAt` are `null` until the payment is captured.
- When `status` is `"Failed"`, `gatewayOrderId` is `""` and `failureReason` explains why. The booking is cancelled in that case.

## Rate limiting

All `/api/payments/*` routes except the webhook share one **concurrency limit**:
at most **10 requests in flight at the same time across all users**, with a queue of 5.
A 429 here means the payment path is busy, not that one user sent too many
requests. Retry after a short wait.

## Endpoints

### `GET /api/payments/booking/{bookingId}` (Requires JWT, any role)

A driver may only read their own payment. A manager or admin may read any.

Success (200): `PaymentResponse`.

Errors:
- 403: the payment belongs to another driver
- 404: no payment yet. This is normal for a few seconds after a booking is created, because the order is created asynchronously. Treat it as "still preparing" and retry briefly.

### `POST /api/payments/verify` (Requires role: `Driver`)

Called after Razorpay Checkout succeeds. Send the three values Checkout returns,
plus the booking id.

```json
{
  "bookingId": "4c9e6679-7425-40de-944b-e07fc1f90ae8",
  "razorpayPaymentId": "pay_NJ8yAbCdEfGhIj",
  "razorpayOrderId": "order_NJ8x92hK7QwErT",
  "razorpaySignature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
}
```

The server checks that the payment belongs to the caller, that the order matches
the booking, that the signature is valid, and that Razorpay reports the payment
as captured for the right order, amount and currency. It is **idempotent**:
sending the same values again is safe.

Success (200), message `"Payment confirmed."`, `data` is a `PaymentResponse` with
`status: "Captured"`. **The booking is not `Confirmed` yet.** It becomes
`Confirmed` in a moment, so poll `GET /api/bookings/{id}`.

Errors:
- 400: invalid signature (`"Invalid payment signature."`) or the order does not belong to the booking (`"The order does not belong to this booking."`)
- 403: the payment belongs to another driver
- 404: no payment for that booking
- 409: the payment cannot be accepted. Examples: `"The payment has not been captured yet."`, `"This booking can no longer accept a payment."`, or the booking was cancelled before the payment arrived (`"This booking was cancelled before your payment arrived. Your payment has been refunded."`; if the automatic refund failed the message says support will refund manually)
- 422: a required field is missing or too long
- 502: Razorpay could not be reached or could not confirm the payment. Nothing was changed, so **retrying the same request is safe**

### `GET /api/payments/{id}` (Requires role: `Manager` or `Admin`)

Success (200): `PaymentResponse`. Errors: 404.

### `POST /api/payments/webhook` (Anonymous, not for the frontend)

Called by Razorpay. It is verified by the `X-Razorpay-Signature` header and acts
on `payment.captured` and `order.paid` events. It exists as a safety net so a
payment is still recorded if the browser closes before `verify` is called. It
has no rate limiter. Do not call it from the app.

---
