import { UserRole } from './user-role.enum';

export interface AuthUser {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  profilePicUrl: string | null;
  /** Absent in sessions stored before the profile page existed. */
  phone?: string | null;
}
