import { VehicleType } from '../spot.model';

export interface VehicleResponse {
  vehicleId: string;
  driverId: string;
  plateNumber: string;
  vehicleType: VehicleType;
  make: string;
  model: string;
  isElectric: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
