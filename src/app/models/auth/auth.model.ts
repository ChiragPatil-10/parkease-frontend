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
  /** Admin feedback on a rejected application; null otherwise. Not shown on the admin tab yet. */
  feedback?: string | null;
}

/** Body of PUT /admin/reject-manager/{id}; {} when there is no feedback. Maximum 500 characters. */
export interface RejectManagerRequest {
  feedback?: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

/** Omitted or null keeps the stored value; an empty string clears it. */
export interface UpdateProfileRequest {
  fullName: string;
  phone?: string;
  profilePicUrl?: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}
