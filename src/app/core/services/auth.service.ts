import { Service, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AUTH_API } from '../constants/api.constants';
import { ApiResponse } from '../models/api-response.model';
import { AuthResponse, AuthUser, LoginRequest } from '../models/auth.model';

const SESSION_STORAGE_KEY = 'parkease.session';

@Service()
export class AuthService {
  private readonly http = inject(HttpClient);

  login(request: LoginRequest): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(AUTH_API.login, request);
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
