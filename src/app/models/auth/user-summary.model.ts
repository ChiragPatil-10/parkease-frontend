import { UserRole } from './user-role.enum';

export interface UserSummaryDto {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}
