export const PAYMENT_API = {
  byBooking: (bookingId: string) => `/api/payments/booking/${bookingId}`,
} as const;
