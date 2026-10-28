import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormField, FormRoot, email, form, required } from '@angular/forms/signals';
import { AuthService } from '../../services/auth.service';
import { ApiResponse } from '../../models/api-response.model';
import { AuthResponse } from '../../models/auth/auth.model';

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

  private readonly credentials = signal({ email: '', password: '' });

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

  private handleSuccess(auth: AuthResponse): void {
    this.authService.saveSession(auth);

    this.router.navigateByUrl(this.authService.resolvePostAuthRoute(auth.user.role));
  }

  private resolveErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 429) {
        return 'Too many login attempts. Please wait a minute and try again.';
      }
      const body = err.error as ApiResponse<unknown> | null;
      if (body?.message) {
        return body.message;
      }
    }
    return 'Something went wrong. Please try again.';
  }
}
