// Phase 1 only: static mock data shaped like the API. Phase 2 replaces this with real fetching.

export interface MockLotBooking {
  bookingId: string;
  spotNumber: string | null;
  plateNumber: string | null;
  /** UTC ISO string. */
  startTime: string;
  amount: number;
  /** Wire value (Confirmed, CheckedIn, Completed, Cancelled, NoShow). Kept a plain string so unknown values can be shown. */
  status: string;
  cancelReason?: string | null;
}

export interface MockManagerLot {
  lotId: string;
  name: string;
  approved: boolean;
  bookings: MockLotBooking[];
}

const HOUR_MS = 3_600_000;

function fromNow(hours: number): string {
  return new Date(Date.now() + hours * HOUR_MS).toISOString();
}

/** Newest first. The first lot has bookings; the other two are empty. */
export function buildMockLots(): MockManagerLot[] {
  return [
    {
      lotId: 'lot-whitefield',
      name: 'Whitefield Central Lot',
      approved: true,
      bookings: [
        { bookingId: 'b-1', spotNumber: 'A-02', plateNumber: 'KA05MJ4471', startTime: fromNow(3), amount: 120, status: 'Confirmed' },
        { bookingId: 'b-2', spotNumber: 'B-14', plateNumber: 'KA05MJ4471', startTime: fromNow(-1), amount: 90, status: 'CheckedIn' },
        { bookingId: 'b-3', spotNumber: 'A-05', plateNumber: 'KA03CD5521', startTime: fromNow(-5), amount: 75, status: 'CheckedIn' },
        { bookingId: 'b-4', spotNumber: 'A-07', plateNumber: 'KA09XY1102', startTime: fromNow(-26), amount: 60, status: 'Completed' },
        { bookingId: 'b-5', spotNumber: 'A-11', plateNumber: 'KA01AB9922', startTime: fromNow(-50), amount: 75, status: 'Cancelled' },
        { bookingId: 'b-6', spotNumber: 'C-03', plateNumber: 'KA02EF3030', startTime: fromNow(-75), amount: 45, status: 'Cancelled', cancelReason: 'PaymentTimeout' },
        { bookingId: 'b-7', spotNumber: 'B-02', plateNumber: 'KA51GH7788', startTime: fromNow(-100), amount: 90, status: 'NoShow' },
        { bookingId: 'b-8', spotNumber: null, plateNumber: null, startTime: fromNow(-240), amount: 60, status: 'Completed' },
      ],
    },
    { lotId: 'lot-koramangala', name: 'Koramangala Plaza Lot', approved: true, bookings: [] },
    { lotId: 'lot-indiranagar', name: 'Indiranagar Metro Lot', approved: false, bookings: [] },
  ];
}
