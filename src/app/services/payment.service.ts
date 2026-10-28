import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PAYMENT_API } from '../constants/payment.constants';
import { ApiResponse } from '../models/api-response.model';
import { PaymentResponse, VerifyPaymentRequest } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly api = inject(ApiService);

  /** 404 means the payment record isn't created yet (Payment consumes BookingCreated asynchronously). */
  getPaymentByBooking(bookingId: string): Observable<ApiResponse<PaymentResponse>> {
    return this.api.get<PaymentResponse>(PAYMENT_API.byBooking(bookingId));
  }

  /** 200 returns the payment as Captured; the booking becomes Confirmed a moment later. */
  verifyPayment(request: VerifyPaymentRequest): Observable<ApiResponse<PaymentResponse>> {
    return this.api.post<PaymentResponse>(PAYMENT_API.verify, request);
  }
}
