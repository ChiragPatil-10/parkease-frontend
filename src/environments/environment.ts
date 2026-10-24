export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:5000',
  /** Public Razorpay key id only (never the secret). Keep it empty here: builds get it from RAZORPAY_KEY_ID via scripts/generate-env.mjs. */
  razorpayKeyId: '',
};
