import { AuthUser } from './user.model';
import { ApplicationStatus } from './application-status.enum';

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

export interface RegisterManagerRequest {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  businessName: string;
  parkingAddress: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: AuthUser;
}

export interface ManagerApplicationDto {
  applicationId: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  businessName: string;
  parkingAddress: string;
  status: ApplicationStatus;
  createdAt: string;
}
