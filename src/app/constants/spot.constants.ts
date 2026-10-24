export const SPOT_API = {
  byId: (spotId: string) => `/api/v1/spots/${spotId}`,
  byLot: (lotId: string) => `/api/v1/spots/lot/${lotId}`,
  bulkCreate: '/api/v1/spots/bulk',
} as const;
