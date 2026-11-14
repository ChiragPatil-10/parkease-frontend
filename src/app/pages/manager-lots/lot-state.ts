import { LotResponse } from '../../models/lot.model';

export type LotState = 'pending' | 'rejected' | 'open' | 'closed';

/**
 * One state per lot for the manager pages. approvalStatus decides (case-insensitive); when the API
 * sends a missing or unknown value, isApproved is the fallback.
 */
export function lotState(lot: Pick<LotResponse, 'isApproved' | 'approvalStatus' | 'isOpen'>): LotState {
  switch (lot.approvalStatus?.toLowerCase()) {
    case 'rejected':
      return 'rejected';
    case 'pending':
      return 'pending';
    case 'approved':
      return lot.isOpen ? 'open' : 'closed';
    default:
      if (!lot.isApproved) {
        return 'pending';
      }
      return lot.isOpen ? 'open' : 'closed';
  }
}

export const LOT_STATE_LABEL: Record<LotState, string> = {
  pending: 'Pending approval',
  rejected: 'Rejected',
  open: 'Open',
  closed: 'Closed',
};

/** Text for the read-only status line on the lot edit form. */
export const LOT_STATE_LINE: Record<LotState, string> = {
  pending: 'Pending approval',
  rejected: 'Rejected',
  open: 'Approved, Open',
  closed: 'Approved, Closed',
};
