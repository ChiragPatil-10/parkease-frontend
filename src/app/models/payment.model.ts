export type PaymentStatus =
  | 'Created'
  | 'Captured'
  | 'Refunded'
  | 'RefundFailed'
  | 'Voided'
  | 'Failed'
  | 'Held';

export interface PaymentResponse {
  paymentId: string;
  bookingId: string;
  driverId: string;
  amount: number;
  status: PaymentStatus;
  gatewayOrderId: string;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
  razorpayKeyId?: string | null;
  amountInPaise?: number;
  currency?: string;
  razorpayPaymentId?: string | null;
  paidAt?: string | null;
}

export interface VerifyPaymentRequest {
  bookingId: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  razorpaySignature: string;
}
