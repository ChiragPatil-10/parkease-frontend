import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormField, FormRoot, email, form, required } from '@angular/forms/signals';
import { AuthService } from '../../core/services/auth.service';
import { ApiResponse } from '../../core/models/api-response.model';
import { AuthResponse } from '../../core/models/auth.model';
import { UserRole } from '../../core/enums/user-role.enum';

@Component({
  selector: 'app-login',
  imports: [FormField, FormRoot],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly serverError = signal<string | null>(null);
  protected readonly adminNotice = signal(false);

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
          this.adminNotice.set(false);

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

    switch (auth.user.role) {
      case UserRole.Driver:
        this.router.navigateByUrl('/lots');
        break;
      case UserRole.Manager:
        this.router.navigateByUrl('/manager/lots');
        break;
      case UserRole.Admin:
        this.adminNotice.set(true);
        break;
    }
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
