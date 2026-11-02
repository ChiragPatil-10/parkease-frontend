import { LotResponse } from '../../models/lot.model';

/**
 * Text added after a lot's name in the dropdown. Uses approvalStatus when the API sends a known
 * value (case-insensitive); otherwise falls back to isApproved.
 */
export function lotApprovalSuffix(lot: Pick<LotResponse, 'isApproved' | 'approvalStatus'>): string {
  switch (lot.approvalStatus?.toLowerCase()) {
    case 'approved':
      return '';
    case 'pending':
      return ' (pending approval)';
    case 'rejected':
      return ' (not approved)';
    default:
      return lot.isApproved ? '' : ' (pending approval)';
  }
}
