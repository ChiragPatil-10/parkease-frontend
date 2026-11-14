import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FormField, FormRoot, form, maxLength, validate } from '@angular/forms/signals';
import { AuthService } from '../../services/auth.service';
import {
  GENERIC_ERROR,
  rateLimitNotice,
  serverFieldErrors,
  serverMessage,
} from '../../shared/auth-form';

export const FORGOT_SUCCESS_MESSAGE =
  'If an account exists for this email, a reset link has been sent.';
export const RESEND_COOLDOWN_SECONDS = 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-forgot-password',
  imports: [FormField, FormRoot, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css',
})
export class ForgotPassword implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);
  private readonly statusRegion = viewChild<ElementRef<HTMLElement>>('statusRegion');

  /** The generic message shown after a 200. Never says whether the account exists. */
  protected readonly sentMessage = signal<string | null>(null);
  protected readonly serverError = signal<string | null>(null);
  protected readonly emailServerError = signal<string | null>(null);
  protected readonly rateLimited = signal<string | null>(null);
  /** Seconds left before Send again works. Zero when it is allowed. */
  protected readonly cooldown = signal(0);

  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly model = signal({ email: '' });

  protected readonly forgotForm = form(
    this.model,
    (path) => {
      // Checked on the trimmed value, because the request sends the trimmed email.
      validate(path.email, (ctx) => {
        const value = ctx.value().trim();
        if (!value) {
          return { kind: 'required', message: 'Email is required.' };
        }
        return EMAIL_PATTERN.test(value)
          ? undefined
          : { kind: 'email', message: 'A valid email address is required.' };
      });
      maxLength(path.email, 200, { message: 'Email must not exceed 200 characters.' });
    },
    {
      submission: {
        action: async () => {
          if (this.cooldown() > 0) {
            return undefined;
          }
          this.serverError.set(null);
          this.emailServerError.set(null);
          this.rateLimited.set(null);

          try {
            const response = await firstValueFrom(
              this.authService.forgotPassword({ email: this.model().email.trim() }),
            );
            this.sentMessage.set(response.message || FORGOT_SUCCESS_MESSAGE);
            this.startCooldown();
          } catch (err) {
            this.handleError(err);
          }
          this.focusStatus();
          return undefined;
        },
        onInvalid: (root) => {
          root().errorSummary()[0]?.fieldTree().focusBoundControl();
        },
      },
    },
  );

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private handleError(err: unknown): void {
    this.sentMessage.set(null);
    if (err instanceof HttpErrorResponse) {
      if (err.status === 429) {
        // The global toast also shows; this calm notice stays on the page.
        this.rateLimited.set(rateLimitNotice(err));
        return;
      }
      if (err.status === 422) {
        const fieldErrors = serverFieldErrors(err);
        const message = fieldErrors['email'];
        if (message) {
          this.emailServerError.set(message);
          return;
        }
        this.serverError.set(serverMessage(err) ?? GENERIC_ERROR);
        return;
      }
    }
    this.serverError.set("We couldn't send the request. Please try again.");
  }

  private startCooldown(): void {
    this.stopTimer();
    this.cooldown.set(RESEND_COOLDOWN_SECONDS);
    this.timer = setInterval(() => {
      this.cooldown.update((seconds) => Math.max(0, seconds - 1));
      if (this.cooldown() === 0) {
        this.stopTimer();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private focusStatus(): void {
    afterNextRender(() => this.statusRegion()?.nativeElement.focus(), { injector: this.injector });
  }
}
