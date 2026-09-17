export const SPOT_API = {
  byLot: (lotId: string) => `/api/v1/spots/lot/${lotId}`,
  bulkCreate: '/api/v1/spots/bulk',
} as const;
