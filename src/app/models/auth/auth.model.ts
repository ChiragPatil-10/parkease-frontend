import { AuthUser } from './user.model';

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

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUser;
}
