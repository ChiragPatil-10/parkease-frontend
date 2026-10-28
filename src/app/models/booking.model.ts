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
}
