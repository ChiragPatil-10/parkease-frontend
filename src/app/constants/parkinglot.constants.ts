export const PARKINGLOT_API = {
  pending: '/api/v1/lots/pending',
  approve: (lotId: string) => `/api/v1/lots/${lotId}/approve`,
} as const;
