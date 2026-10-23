import { Component, signal } from '@angular/core';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';
import { AddVehicleModal } from './add-vehicle-modal/add-vehicle-modal';
import { DeleteVehicleDialog } from './delete-vehicle-dialog/delete-vehicle-dialog';

interface VehicleCard {
  id: string;
  plate: string;
  name: string;
  detail: string;
}

const MOCK_VEHICLES: VehicleCard[] = [
  { id: 'v1', plate: 'KA 05 MJ 4471', name: 'Honda City', detail: 'Four Wheeler' },
  { id: 'v2', plate: 'KA 01 AB 9922', name: 'Ather 450X', detail: 'Two Wheeler · Electric' },
];

@Component({
  selector: 'app-driver-my-vehicles',
  imports: [DriverNav, AddVehicleModal, DeleteVehicleDialog],
  templateUrl: './driver-my-vehicles.html',
  styleUrl: './driver-my-vehicles.css',
})
export class DriverMyVehicles {
  protected readonly vehicles = MOCK_VEHICLES;

  protected readonly addOpen = signal(false);
  protected readonly deleteTarget = signal<VehicleCard | null>(null);
}
