import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormField, FormRoot, email, form, minLength, pattern, required } from '@angular/forms/signals';
import { AuthService } from '../../core/services/auth.service';
import { ApiResponse } from '../../core/models/api-response.model';
import { AuthResponse, RegisterDriverRequest } from '../../core/models/auth.model';

const PASSWORD_COMPLEXITY_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/;
const PHONE_PATTERN = /^[0-9+\-\s]{5,20}$/;

@Component({
  selector: 'app-register-driver',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './register-driver.html',
  styleUrl: './register-driver.css',
})
export class RegisterDriver {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly serverError = signal<string | null>(null);

  private readonly registration = signal({ fullName: '', email: '', password: '', phone: '' });

  protected readonly registerForm = form(
    this.registration,
    (path) => {
      required(path.fullName, { message: 'Full name is required.' });

      required(path.email, { message: 'Email is required.' });
      email(path.email, { message: 'Enter a valid email address.' });

      required(path.password, { message: 'Password is required.' });
      minLength(path.password, 8, { message: 'Password must be at least 8 characters.' });
      pattern(path.password, PASSWORD_COMPLEXITY_PATTERN, {
        message: 'Password must include an uppercase letter, a lowercase letter, and a number.',
      });

      pattern(path.phone, PHONE_PATTERN, {
        message: 'Enter a valid phone number.',
        when: (ctx) => ctx.value().trim().length > 0,
      });
    },
    {
      submission: {
        action: async () => {
          this.serverError.set(null);

          try {
            const response = await firstValueFrom(
              this.authService.registerDriver(this.buildRequest()),
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

  private buildRequest(): RegisterDriverRequest {
    const { fullName, email, password, phone } = this.registration();
    const trimmedPhone = phone.trim();

    return {
      fullName,
      email,
      password,
      ...(trimmedPhone ? { phone: trimmedPhone } : {}),
    };
  }

  private handleSuccess(auth: AuthResponse): void {
    this.authService.saveSession(auth);
    this.router.navigateByUrl(this.authService.resolvePostAuthRoute(auth.user.role) ?? '/lots');
  }

  private resolveErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 429) {
        return 'Too many registration attempts. Please wait a minute and try again.';
      }
      const body = err.error as ApiResponse<unknown> | null;
      if (body?.message) {
        return body.message;
      }
    }
    return 'Something went wrong. Please try again.';
  }
}
