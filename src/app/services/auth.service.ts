import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { AUTH_API } from '../constants/auth.constants';
import { ApiResponse } from '../models/api-response.model';
import { AuthResponse, LoginRequest, RegisterDriverRequest } from '../models/auth/auth.model';
import { AuthUser } from '../models/auth/user.model';
import { UserRole } from '../models/auth/user-role.enum';

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

  /** Route to land on after a successful login/registration; null means "no redirect" (e.g. Admin, handled by the caller). */
  resolvePostAuthRoute(role: UserRole): string | null {
    switch (role) {
      case UserRole.Driver:
        return '/lots';
      case UserRole.Manager:
        return '/manager/lots';
      default:
        return null;
    }
  }

  saveSession(auth: AuthResponse): void {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(auth));
  }

  getSession(): AuthResponse | null {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthResponse) : null;
  }

  getCurrentUser(): AuthUser | null {
    return this.getSession()?.user ?? null;
  }

  clearSession(): void {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}
