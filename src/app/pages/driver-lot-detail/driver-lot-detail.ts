import { Component, signal } from '@angular/core';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';

type SpotStatus = 'available' | 'reserved' | 'occupied';

interface Spot {
  label: string;
  status: SpotStatus;
}

const VEHICLE_TYPES = ['Two Wheeler', 'Four Wheeler', 'Heavy'];

const SPOT_STATUS_CLASS: Record<SpotStatus, string> = {
  available: 'bg-green-500',
  reserved: 'bg-accent',
  occupied: 'bg-red-500',
};

const STATUSES: SpotStatus[] = [
  'available', 'available', 'occupied', 'available', 'reserved', 'available',
  'available', 'occupied', 'available', 'available', 'reserved', 'available',
];

const SPOTS: Spot[] = STATUSES.map((status, i) => ({
  label: `A-${String(i + 1).padStart(2, '0')}`,
  status,
}));

@Component({
  selector: 'app-driver-lot-detail',
  imports: [DriverNav],
  templateUrl: './driver-lot-detail.html',
  styleUrl: './driver-lot-detail.css',
})
export class DriverLotDetail {
  // Phase 1: all static mock data; the :lotId route param is ignored.
  protected readonly vehicleTypes = VEHICLE_TYPES;
  protected readonly selectedVehicleType = signal('Four Wheeler');

  protected readonly spots = SPOTS;
  protected readonly statusClass = SPOT_STATUS_CLASS;
  protected readonly selectedSpot = signal('A-02');

  protected selectVehicleType(type: string): void {
    this.selectedVehicleType.set(type);
  }

  protected selectSpot(spot: Spot): void {
    if (spot.status === 'available') {
      this.selectedSpot.set(spot.label);
    }
  }
}
