import { environment as generated } from './environment.generated';

export const environment = {
  production: true,
  apiBaseUrl: 'http://localhost:5000',
  /** Public Razorpay key id only (never the secret). Comes from RAZORPAY_KEY_ID via scripts/generate-env.mjs. */
  razorpayKeyId: generated.razorpayKeyId,
};
