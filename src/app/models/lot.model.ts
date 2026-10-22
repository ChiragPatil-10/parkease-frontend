export interface LotResponse {
  lotId: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  totalSpots: number;
  availableSpots: number;
  minPricePerHour: number;
  maxPricePerHour: number;
  openTime: string;
  closeTime: string;
  isApproved: boolean;
  isOpen: boolean;
  description: string | null;
  approvalFeedback: string | null;
  approvedAt: string | null;
  managerId: string;
  createdAt: string;
  updatedAt: string;
}

/** Item returned by GET /lots/nearby: a trimmed lot summary plus distance from the driver. */
export interface NearbyLot {
  lotId: string;
  name: string;
  address: string;
  city: string;
  latitude: number;
  longitude: number;
  availableSpots: number;
  minPricePerHour: number;
  maxPricePerHour: number;
  isOpen: boolean;
  distanceKm: number;
}

export interface ApproveLotRequest {
  feedback?: string;
}

export interface LotRequest {
  name: string;
  address: string;
  city: string;
  totalSpots: number;
  minPricePerHour: number;
  maxPricePerHour: number;
  openTime: string;
  closeTime: string;
  description?: string;
}
