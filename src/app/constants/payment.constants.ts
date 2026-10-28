export const PAYMENT_API = {
  byBooking: (bookingId: string) => `/api/payments/booking/${bookingId}`,
  verify: '/api/payments/verify',
} as const;
