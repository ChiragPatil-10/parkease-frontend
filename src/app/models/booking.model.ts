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
