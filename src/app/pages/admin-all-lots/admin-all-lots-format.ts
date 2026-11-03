/** Local view type for a lot of GET /api/v1/lots/all (same field names and values as the docs). */
export interface AdminLotRow {
  lotId: string;
  name: string;
  address: string;
  /** Lowercase in the API; shown capitalised. */
  city: string;
  totalSpots: number;
  minPricePerHour: number;
  maxPricePerHour: number;
  isOpen: boolean;
  /** "Pending" | "Approved" | "Rejected" (string so unknown values still render) */
  approvalStatus: string;
  managerName: string | null;
  createdAt: string;
}

export interface LotStatusPill {
  label: string;
  dotClass: string;
}

/**
 * Pills are always grey; only the dot carries the status colour.
 * Approved + open -> green, Approved + closed -> muted, Pending -> muted, Rejected -> red.
 * Unknown values show the raw text with the muted dot.
 */
export function lotStatusPill(approvalStatus: string, isOpen: boolean): LotStatusPill {
  switch (approvalStatus) {
    case 'Approved':
      return isOpen
        ? { label: 'Open · Approved', dotClass: 'bg-green-700' }
        : { label: 'Closed · Approved', dotClass: 'bg-muted' };
    case 'Pending':
      return { label: 'Pending approval', dotClass: 'bg-muted' };
    case 'Rejected':
      return { label: 'Rejected', dotClass: 'bg-red-700' };
    default:
      return { label: approvalStatus, dotClass: 'bg-muted' };
  }
}

/** "bengaluru" -> "Bengaluru", "navi mumbai" -> "Navi Mumbai". */
export function capitalizeCity(city: string): string {
  return city
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

export function managerLabel(managerName: string | null): string {
  return managerName?.trim() ? managerName : 'Unknown manager';
}
