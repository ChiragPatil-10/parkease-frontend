export const BOOKING_API = {
  create: '/api/bookings',
  byId: (bookingId: string) => `/api/bookings/${bookingId}`,
  checkIn: (bookingId: string) => `/api/bookings/${bookingId}/checkin`,
  checkOut: (bookingId: string) => `/api/bookings/${bookingId}/checkout`,
  cancel: (bookingId: string) => `/api/bookings/${bookingId}/cancel`,
} as const;
