import { UserRole } from './user-role.enum';

/** Wire values of UserSummaryDto.status. Any other value is treated as unknown. */
export type UserStatus = 'Active' | 'Suspended' | 'PendingApproval' | 'Rejected';

/** A row of GET /api/v1/auth/users (admin user list). */
export interface UserSummaryDto {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  /** A UserStatus value; typed as string so unknown values still render. */
  status: UserStatus | string;
}
