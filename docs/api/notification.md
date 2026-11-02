# Notification Service API

Base path through the Gateway: `http://localhost:5000/api/v1/notifications`
The service is event driven. Its only HTTP endpoint is the history feed for the logged-in user.

## Conventions
- Auth: `Authorization: Bearer <jwt>`. The recipient is taken from the token's email claim, so a user can only ever see their own rows.
- Every response uses the envelope `{ "success": bool, "message": string|null, "data": ..., "errors": [...]|null }`.
- Times are UTC ISO 8601 strings (`2026-11-02T10:00:00Z`).
- Rate limit: the Gateway default (token bucket, 100 capacity, 20 refilled per 10 seconds per user). The page makes one request per load or per "Show more" click.

## GET /api/v1/notifications/me

Returns the user's email history, newest first (`sentAt` descending).

Query:
| Name | Default | Rules |
|---|---|---|
| page | 1 | Values below 1 become 1 |
| pageSize | 20 | Clamped to 1..50 |

Response `data` is a flat array (no total count). If the array has exactly `pageSize` items, another page may exist. If it has fewer, this is the last page.

```json
{
  "success": true,
  "data": [
    {
      "id": "guid",
      "recipientEmail": "driver@example.com",
      "eventType": "PaymentCaptured",
      "title": "Payment received",
      "message": "₹120.50 paid for your booking at Whitefield Central Lot, spot A-02.",
      "subject": "Payment Receipt - ParkEase",
      "status": "Sent",
      "sentAt": "2026-11-02T10:00:00Z",
      "bookingId": "guid or null",
      "relatedEntityId": "guid"
    }
  ]
}
```

Fields:
- `title`: always present, plain text. Show it as the row heading.
- `message`: plain text or null (null for rows created before this feature). Always render as text, never as HTML.
- `status`: `"Sent"` or `"Failed"` (email delivery result). `"Pending"` exists in the enum but is never returned.
- `bookingId`: the booking to open (`/bookings/:bookingId`) or null. Null for account events (suspended, password changed, and so on) and for payment rows created before this feature.
- `relatedEntityId`: internal id. It is the BookingId for booking events, the PaymentId for payment events, and a user, vehicle or lot id for the others. Do not use it for links, use `bookingId`.
- `subject`: the email subject. May contain emoji. Do not display it.
- There is no `errorMessage` field. Failed rows carry the same title and message as sent rows.

### eventType values and their titles
| eventType | title |
|---|---|
| BookingCreated | Booking created |
| BookingConfirmed | Booking confirmed |
| BookingCancelled | Booking cancelled |
| BookingCompleted | Checked out |
| BookingNoShow | Reservation missed |
| PaymentCaptured | Payment received |
| PaymentRefunded | Refund processed |
| VehicleDeactivated | Vehicle removed |
| LotApproved | Parking lot approved |
| ManagerApplicationApproved | Application approved |
| ManagerApplicationRejected | Application update |
| UserSuspended | Account suspended |
| UserReactivated | Account reactivated |
| PasswordChanged | Password changed |
| UserRegistered | Welcome to ParkEase |

Unknown future types arrive with the title "Notification". The UI must not break on an unrecognised `eventType`.

### Cancellation messages
`BookingCancelled` messages end with one of these fixed sentences: "The payment window expired.", "You cancelled this booking.", "Payment could not be completed.", "The spot was no longer available.", or "The booking was cancelled." Rows created before the reason code was added show only the payment window text or the generic text.

### Rows created before this feature
- `message` is null and `title` is a generic title for the eventType.
- Booking events keep their `bookingId`. Old payment events have `bookingId` null.
- Bookings created before the change show messages without the lot or spot (for example "Your parking spot is reserved.").

### Errors
| Status | Meaning |
|---|---|
| 401 | Missing or invalid token |
| 403 | Token has no email claim (should not happen with a normal login token) |
| 429 | Rate limit exceeded |

Not available: unread or read state, total count, delete, mark as read, and Pending or Reminder rows.
