export const PARKINGLOT_API = {
  pending: '/api/v1/lots/pending',
  approve: (lotId: string) => `/api/v1/lots/${lotId}/approve`,
  byManager: (managerId: string) => `/api/v1/lots/manager/${managerId}`,
} as const;
