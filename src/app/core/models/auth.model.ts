import { UserRole } from '../enums/user-role.enum';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterDriverRequest {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
}

export interface AuthUser {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  profilePicUrl: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUser;
}
