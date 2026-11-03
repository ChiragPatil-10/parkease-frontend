export const PARKINGLOT_API = {
  pending: '/api/v1/lots/pending',
  all: '/api/v1/lots/all',
  approve: (lotId: string) => `/api/v1/lots/${lotId}/approve`,
  reject: (lotId: string) => `/api/v1/lots/${lotId}/reject`,
  byManager: (managerId: string) => `/api/v1/lots/manager/${managerId}`,
  create: '/api/v1/lots',
  nearby: '/api/v1/lots/nearby',
  search: '/api/v1/lots/search',
  byId: (lotId: string) => `/api/v1/lots/${lotId}`,
} as const;
