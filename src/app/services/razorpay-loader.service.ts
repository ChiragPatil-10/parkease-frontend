import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';

const CHECKOUT_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayCheckoutOptions {
  key: string;
  order_id: string;
  name: string;
  notes: Record<string, string>;
  prefill: Record<string, string>;
  handler: (response: RazorpaySuccessResponse) => void;
  modal: { ondismiss: () => void };
}

export interface RazorpayCheckout {
  open(): void;
  on(event: 'payment.failed', callback: () => void): void;
}

export type RazorpayConstructor = new (options: RazorpayCheckoutOptions) => RazorpayCheckout;

@Injectable({ providedIn: 'root' })
export class RazorpayLoader {
  private readonly document = inject(DOCUMENT);
  private pending: Promise<RazorpayConstructor> | null = null;

  /** Public test/live key id only; the secret never belongs in the frontend. */
  readonly keyId: string = environment.razorpayKeyId;

  /** Loads checkout.js once; later calls reuse the same script. A failed load can be retried. */
  load(): Promise<RazorpayConstructor> {
    const existing = (this.document.defaultView as { Razorpay?: RazorpayConstructor } | null)
      ?.Razorpay;
    if (existing) {
      return Promise.resolve(existing);
    }
    this.pending ??= new Promise<RazorpayConstructor>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = CHECKOUT_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        const ctor = (this.document.defaultView as { Razorpay?: RazorpayConstructor } | null)
          ?.Razorpay;
        if (ctor) {
          resolve(ctor);
        } else {
          this.pending = null;
          script.remove();
          reject(new Error('Razorpay checkout did not initialise.'));
        }
      };
      script.onerror = () => {
        this.pending = null;
        script.remove();
        reject(new Error('Could not load Razorpay checkout.'));
      };
      this.document.head.appendChild(script);
    });
    return this.pending;
  }
}
