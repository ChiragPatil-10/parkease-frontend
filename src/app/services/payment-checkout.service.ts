import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { VerifyPaymentRequest } from '../models/payment.model';
import { PaymentService } from './payment.service';
import { RazorpayLoader } from './razorpay-loader.service';

const VERIFY_RETRY_DELAY_MS = 1000;
const VERIFY_MAX_RETRIES = 3;

export interface CheckoutParams {
  bookingId: string;
  orderId: string;
  /** Public key id only (from the payment response or the environment). */
  keyId: string;
  /** Return false once the calling page is gone; nothing more is done after that. */
  isActive: () => boolean;
  /** Razorpay reported success. The signature is still unchecked, so call verify() next. */
  onPaid: (request: VerifyPaymentRequest) => void;
  onDismissed: () => void;
  onFailed: () => void;
}

/** 502 means Razorpay was unreachable and nothing changed; status 0 is a network error. Both are safe to repeat. */
function isRetryableVerifyError(err: unknown): boolean {
  return err instanceof HttpErrorResponse && (err.status === 0 || err.status === 502);
}

/** Opens Razorpay checkout for an existing order and confirms the result with the backend. */
@Injectable({ providedIn: 'root' })
export class PaymentCheckoutService {
  private readonly razorpay = inject(RazorpayLoader);
  private readonly paymentService = inject(PaymentService);

  /** The key from the API wins; the environment value is the fallback. May be empty. */
  resolveKey(apiKeyId: string | null | undefined): string {
    return apiKeyId || this.razorpay.keyId;
  }

  async openCheckout(params: CheckoutParams): Promise<void> {
    const Razorpay = await this.razorpay.load();
    if (!params.isActive()) {
      return;
    }
    let completed = false;
    const checkout = new Razorpay({
      key: params.keyId,
      order_id: params.orderId,
      name: 'ParkEase',
      notes: { bookingId: params.bookingId },
      prefill: {},
      // The signature is checked by the backend; navigation waits for that to succeed.
      handler: (response) => {
        completed = true;
        params.onPaid({
          bookingId: params.bookingId,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpayOrderId: response.razorpay_order_id,
          razorpaySignature: response.razorpay_signature,
        });
      },
      modal: {
        ondismiss: () => {
          if (!completed) {
            params.onDismissed();
          }
        },
      },
    });
    checkout.on('payment.failed', () => {
      if (!completed) {
        params.onFailed();
      }
    });
    checkout.open();
  }

  /**
   * Confirms the payment with the backend, repeating only this call on a 502 or network error.
   * Resolves true when verified, false if the page went away meanwhile; any other error is thrown.
   */
  async verify(request: VerifyPaymentRequest, isActive: () => boolean): Promise<boolean> {
    for (let attempt = 0; ; attempt++) {
      try {
        await firstValueFrom(this.paymentService.verifyPayment(request));
        return isActive();
      } catch (err) {
        if (!isRetryableVerifyError(err) || attempt >= VERIFY_MAX_RETRIES) {
          throw err;
        }
        await new Promise<void>((resolve) => setTimeout(resolve, VERIFY_RETRY_DELAY_MS));
        if (!isActive()) {
          return false;
        }
      }
    }
  }
}
