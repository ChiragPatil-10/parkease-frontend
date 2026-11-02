export const BOOKING_API = {
  create: '/api/bookings',
  my: '/api/bookings/my',
  byId: (bookingId: string) => `/api/bookings/${bookingId}`,
  checkIn: (bookingId: string) => `/api/bookings/${bookingId}/checkin`,
  checkOut: (bookingId: string) => `/api/bookings/${bookingId}/checkout`,
  cancel: (bookingId: string) => `/api/bookings/${bookingId}/cancel`,
  byLot: (lotId: string) => `/api/bookings/lot/${lotId}`,
} as const;

/** The API clamps pageSize to 1..50; always send 20. */
export const LOT_BOOKINGS_PAGE_SIZE = 20;
