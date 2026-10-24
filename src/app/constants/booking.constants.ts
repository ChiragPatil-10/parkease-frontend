export const BOOKING_API = {
  create: '/api/bookings',
  byId: (bookingId: string) => `/api/bookings/${bookingId}`,
} as const;
