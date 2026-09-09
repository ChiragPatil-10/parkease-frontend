import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormField, FormRoot, email, form, minLength, pattern, required } from '@angular/forms/signals';
import { AuthService } from '../../services/auth.service';
import { ApiResponse } from '../../models/api-response.model';
import { ManagerApplicationDto, RegisterManagerRequest } from '../../models/auth/auth.model';
import { ManagerApplicationSubmittedState } from '../manager-application-submitted/manager-application-submitted';

const PASSWORD_COMPLEXITY_PATTERN = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).+$/;
const PHONE_PATTERN = /^[0-9+\-\s]{5,20}$/;

@Component({
  selector: 'app-register-manager',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './register-manager.html',
  styleUrl: './register-manager.css',
})
export class RegisterManager {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly serverError = signal<string | null>(null);

  private readonly registration = signal({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    businessName: '',
    parkingAddress: '',
  });

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

      required(path.phone, { message: 'Phone is required.' });
      pattern(path.phone, PHONE_PATTERN, { message: 'Enter a valid phone number.' });

      required(path.businessName, { message: 'Business name is required.' });

      required(path.parkingAddress, { message: 'Parking address is required.' });
    },
    {
      submission: {
        action: async () => {
          this.serverError.set(null);

          try {
            const response = await firstValueFrom(
              this.authService.registerManager(this.buildRequest()),
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

  private buildRequest(): RegisterManagerRequest {
    const { fullName, email, password, phone, businessName, parkingAddress } = this.registration();

    return {
      fullName,
      email,
      password,
      phone: phone.trim(),
      businessName,
      parkingAddress,
    };
  }

  private handleSuccess(application: ManagerApplicationDto): void {
    const state: ManagerApplicationSubmittedState = {
      fullName: application.fullName,
      businessName: application.businessName,
      status: application.status,
      applicationId: application.applicationId,
    };

    this.router.navigate(['/register-manager/submitted'], { state });
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
