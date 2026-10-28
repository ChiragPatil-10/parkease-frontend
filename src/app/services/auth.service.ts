import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AUTH_API } from '../constants/auth.constants';
import { ApiResponse } from '../models/api-response.model';
import { PagedResponse } from '../models/paged-response.model';
import {
  AuthResponse,
  LoginRequest,
  ManagerApplicationDto,
  RegisterDriverRequest,
  RegisterManagerRequest,
} from '../models/auth/auth.model';
import { ApplicationStatus } from '../models/auth/application-status.enum';
import { AuthUser } from '../models/auth/user.model';
import { UserRole } from '../models/auth/user-role.enum';
import { UserSummaryDto } from '../models/auth/user-summary.model';

const SESSION_STORAGE_KEY = 'parkease.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);

  login(request: LoginRequest): Observable<ApiResponse<AuthResponse>> {
    return this.api.post<AuthResponse>(AUTH_API.login, request);
  }

  registerDriver(request: RegisterDriverRequest): Observable<ApiResponse<AuthResponse>> {
    return this.api.post<AuthResponse>(AUTH_API.registerDriver, request);
  }

  registerManager(request: RegisterManagerRequest): Observable<ApiResponse<ManagerApplicationDto>> {
    return this.api.post<ManagerApplicationDto>(AUTH_API.registerManager, request);
  }

  getUserById(userId: string): Observable<ApiResponse<UserSummaryDto>> {
    return this.api.get<UserSummaryDto>(AUTH_API.userById(userId));
  }

  getManagerApplications(
    page: number,
    pageSize: number,
    status?: ApplicationStatus,
  ): Observable<ApiResponse<PagedResponse<ManagerApplicationDto>>> {
    const params: Record<string, string | number> = { page, pageSize };
    if (status) {
      params['status'] = status;
    }
    return this.api.get<PagedResponse<ManagerApplicationDto>>(AUTH_API.managerApplications, params);
  }

  approveManagerApplication(applicationId: string): Observable<ApiResponse<unknown>> {
    return this.api.put(AUTH_API.approveManager(applicationId), {});
  }

  rejectManagerApplication(applicationId: string): Observable<ApiResponse<unknown>> {
    return this.api.put(AUTH_API.rejectManager(applicationId), {});
  }

  /** Home route for a role: where to land after login/registration, and where logged-in users are bounced to from guest pages. */
  resolvePostAuthRoute(role: UserRole): string {
    switch (role) {
      case UserRole.Driver:
        return '/lots';
      case UserRole.Manager:
        return '/manager/lots';
      default:
        return '/admin/approvals';
    }
  }

  /** Clears the local session, then best-effort revokes the refresh token; a failed call never blocks logging out. */
  logout(): void {
    const refreshToken = this.getSession()?.refreshToken;
    this.clearSession();
    if (refreshToken) {
      this.api.post(AUTH_API.logout, { refreshToken }).subscribe({ error: () => undefined });
    }
  }

  /** True when the access token is a well-formed JWT whose exp claim is in the future. */
  hasValidToken(session: AuthResponse): boolean {
    try {
      const payload = session.accessToken.split('.')[1];
      const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      const exp = (JSON.parse(json) as { exp?: unknown }).exp;
      return typeof exp === 'number' && exp * 1000 > Date.now();
    } catch {
      return false;
    }
  }

  saveSession(auth: AuthResponse): void {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(auth));
  }

  getSession(): AuthResponse | null {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthResponse;
    } catch {
      return null;
    }
  }

  getCurrentUser(): AuthUser | null {
    return this.getSession()?.user ?? null;
  }

  clearSession(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}
