import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormField, FormRoot, email, form, required } from '@angular/forms/signals';
import { AuthService } from '../../services/auth.service';
import { ApiResponse } from '../../models/api-response.model';
import { AuthResponse } from '../../models/auth/auth.model';
import { LOGIN_NOTICES, LOGIN_NOTICE_STATE, isLoginNoticeKey } from '../../shared/login-notice';

@Component({
  selector: 'app-login',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly serverError = signal<string | null>(null);
  /** One-time message after arriving from reset or change password. Null on a normal visit or a refresh. */
  protected readonly notice = signal<string | null>(null);

  private readonly credentials = signal({ email: '', password: '' });

  constructor() {
    this.readNotice();
  }

  protected readonly loginForm = form(
    this.credentials,
    (path) => {
      required(path.email, { message: 'Email is required.' });
      email(path.email, { message: 'Enter a valid email address.' });
      required(path.password, { message: 'Password is required.' });
    },
    {
      submission: {
        action: async () => {
          this.serverError.set(null);

          try {
            const response = await firstValueFrom(
              this.authService.login(this.credentials()),
            );
            if (response.data) {
              this.handleSuccess(response.data);
            }
          } catch (err) {
            this.serverError.set(this.resolveErrorMessage(err));
          }

          return undefined;
        },
      },
    },
  );

  /** Reads the notice key from the navigation state once, then wipes it from history so a refresh shows nothing. */
  private readNotice(): void {
    const state = this.router.currentNavigation()?.extras.state as Record<string, unknown> | undefined;
    const key = state?.[LOGIN_NOTICE_STATE];
    if (isLoginNoticeKey(key)) {
      this.notice.set(LOGIN_NOTICES[key]);
    }
    try {
      const current = history.state as Record<string, unknown> | null;
      if (current && LOGIN_NOTICE_STATE in current) {
        const { [LOGIN_NOTICE_STATE]: _removed, ...rest } = current;
        history.replaceState(rest, '');
      }
    } catch {
      // History may be unavailable; the notice was already read.
    }
  }

  private handleSuccess(auth: AuthResponse): void {
    this.authService.saveSession(auth);

    this.router.navigateByUrl(this.authService.resolvePostAuthRoute(auth.user.role));
  }

  private resolveErrorMessage(err: unknown): string | null {
    if (err instanceof HttpErrorResponse) {
      // The global 429 toast covers this; no inline error.
      if (err.status === 429) {
        return null;
      }
      const body = err.error as ApiResponse<unknown> | null;
      if (body?.message) {
        return body.message;
      }
    }
    return 'Something went wrong. Please try again.';
  }
}
