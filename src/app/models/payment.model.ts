export type PaymentStatus = 'Held' | 'Captured' | 'Voided' | 'Refunded' | 'Failed';

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
}
