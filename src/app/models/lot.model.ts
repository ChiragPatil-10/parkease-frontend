/** Wire values of LotResponse.approvalStatus. */
export type LotApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

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
  /** A LotApprovalStatus value (use this for labels, not isApproved). Typed as string so unknown values still render. */
  approvalStatus?: LotApprovalStatus | string;
  isOpen: boolean;
  description: string | null;
  approvalFeedback: string | null;
  approvedAt: string | null;
  managerId: string;
  createdAt: string;
  updatedAt: string;
  /** Filled only by GET /lots/pending and GET /lots/all; null elsewhere or when the name lookup failed. */
  managerName?: string | null;
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

/** Body of PUT /lots/{id}/reject; {} when there is no feedback. Approve sends {}. */
export interface RejectLotRequest {
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
