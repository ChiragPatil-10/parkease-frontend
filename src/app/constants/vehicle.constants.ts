import { VehicleType } from '../models/spot.model';

export const VEHICLE_API = {
  create: '/api/vehicles',
  my: '/api/vehicles/my',
  byId: (vehicleId: string, confirm: boolean) => `/api/vehicles/${vehicleId}?confirm=${confirm}`,
} as const;

/** Requests carry vehicleType as the enum ordinal (04-Vehicle-Service.md); responses use the string. */
export const VEHICLE_TYPE_REQUEST_VALUE: Record<VehicleType, number> = {
  TwoWheeler: 0,
  FourWheeler: 1,
  Heavy: 2,
};
