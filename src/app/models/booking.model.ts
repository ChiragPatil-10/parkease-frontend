export type BookingStatus =
  | 'Pending'
  | 'Confirmed'
  | 'CheckedIn'
  | 'Completed'
  | 'Cancelled'
  | 'NoShow';

export interface CreateBookingRequest {
  lotId: string;
  spotId: string;
  vehicleId: string;
  startTime: string;
  totalAmount: number;
  idempotencyKey: string;
}

/** Code set only on Cancelled bookings; null on bookings cancelled before the field existed. */
export type CancelReason =
  | 'DriverCancelled'
  | 'PaymentTimeout'
  | 'PaymentFailed'
  | 'SpotUnavailable'
  | 'Other';

export interface CancelBookingRequest {
  reason: string;
}

export interface BookingResponse {
  bookingId: string;
  driverId: string;
  lotId: string;
  spotId: string;
  vehicleId: string;
  vehicleType: string;
  startTime: string;
  endTime: string | null;
  totalAmount: number;
  status: BookingStatus;
  /** UTC with Z; present only while Pending. */
  paymentDueAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Snapshot taken when the booking was created; null on older bookings (fall back to a lookup). */
  lotName?: string | null;
  spotNumber?: string | null;
  spotType?: string | null;
  plateNumber?: string | null;
  cancelReason?: CancelReason | null;
}

/** One row of GET /api/bookings/lot/{lotId} (manager view): no driver, vehicle or payment data. */
export interface ManagerLotBooking {
  bookingId: string;
  /** Snapshot taken at booking creation; null on older bookings. */
  spotNumber: string | null;
  /** Unformatted, e.g. "KA05MJ4471"; null on older bookings. */
  plateNumber: string | null;
  /** UTC ISO with Z. */
  startTime: string;
  totalAmount: number;
  /** Kept a plain string so an unknown value never breaks the page. */
  status: string;
  /** Only for Cancelled bookings; not displayed on the manager page. */
  cancelReason?: CancelReason | null;
}
