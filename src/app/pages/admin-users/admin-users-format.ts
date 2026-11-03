import { UserRole } from '../../models/auth/user-role.enum';
import { UserSummaryDto } from '../../models/auth/user-summary.model';

export type UserActionKind = 'suspend' | 'reactivate';

export interface StatusPill {
  label: string;
  dotClass: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Date only, like "12 Jun 2026". An unparseable value is returned as is. */
export function formatJoinedDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return createdAt;
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Pills are always grey; only the dot carries the status colour. Unknown statuses show the raw text with the muted dot. */
export function userStatusPill(status: string): StatusPill {
  switch (status) {
    case 'Active':
      return { label: 'Active', dotClass: 'bg-green-700' };
    case 'Suspended':
      return { label: 'Suspended', dotClass: 'bg-red-700' };
    case 'PendingApproval':
      return { label: 'Pending approval', dotClass: 'bg-muted' };
    case 'Rejected':
      return { label: 'Rejected', dotClass: 'bg-red-700' };
    default:
      return { label: status, dotClass: 'bg-muted' };
  }
}

/**
 * Which action a row offers, or null. Only Active users can be suspended and only Suspended users
 * reactivated. Admin rows, the signed-in admin's own row, Pending approval rows (approved on the
 * Manager Applications page) and Rejected rows get none.
 */
export function userActionFor(user: UserSummaryDto, currentAdminId: string): UserActionKind | null {
  if (user.role === UserRole.Admin || user.userId === currentAdminId) return null;
  if (user.status === 'Active') return 'suspend';
  if (user.status === 'Suspended') return 'reactivate';
  return null;
}
