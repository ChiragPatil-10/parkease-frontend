export type SpotType = 'Compact' | 'Standard' | 'Large' | 'Motorbike' | 'EV';

export type VehicleType = 'TwoWheeler' | 'FourWheeler' | 'Heavy';

export type SpotStatus = 'Available' | 'Reserved' | 'Occupied';

export interface SpotResponse {
  spotId: string;
  lotId: string;
  managerId: string;
  spotNumber: string;
  floor: number;
  spotType: SpotType;
  vehicleType: VehicleType;
  status: SpotStatus;
  isHandicapped: boolean;
  isEvCharging: boolean;
  pricePerHour: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpotCreateItem {
  spotNumber: string;
  floor: number;
  spotType: SpotType;
  vehicleType: VehicleType;
  isEvCharging: boolean;
  isHandicapped: boolean;
  pricePerHour: number;
}

export interface BulkCreateSpotsRequest {
  lotId: string;
  spots: SpotCreateItem[];
}
