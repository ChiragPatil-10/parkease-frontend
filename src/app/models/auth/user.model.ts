import { UserRole } from './user-role.enum';

export interface AuthUser {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  profilePicUrl: string | null;
}
