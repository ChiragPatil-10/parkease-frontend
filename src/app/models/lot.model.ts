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

export interface ApproveLotRequest {
  feedback?: string;
}
