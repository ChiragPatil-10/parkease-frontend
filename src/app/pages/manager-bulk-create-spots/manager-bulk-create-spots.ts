import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';

interface BulkSpotRow {
  spotNumber: string;
  floor: string;
  spotType: string;
  vehicleType: string;
  price: string;
}

const FLOOR_OPTIONS = ['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4'];
const SPOT_TYPE_OPTIONS = ['Compact', 'Standard', 'Large', 'Motorbike', 'EV'];
const VEHICLE_TYPE_OPTIONS = ['Two Wheeler', 'Four Wheeler', 'Heavy'];

const INITIAL_ROWS: BulkSpotRow[] = [
  { spotNumber: 'A-13', floor: 'Floor 1', spotType: 'Standard', vehicleType: 'Four Wheeler', price: '40' },
  { spotNumber: 'A-14', floor: 'Floor 1', spotType: 'EV', vehicleType: 'Four Wheeler', price: '55' },
  { spotNumber: 'A-15', floor: 'Floor 1', spotType: 'Compact', vehicleType: 'Two Wheeler', price: '20' },
];

@Component({
  selector: 'app-manager-bulk-create-spots',
  imports: [ManagerNav],
  templateUrl: './manager-bulk-create-spots.html',
  styleUrl: './manager-bulk-create-spots.css',
})
export class ManagerBulkCreateSpots {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly lotId = this.route.snapshot.paramMap.get('lotId');
  protected readonly lotName = 'Whitefield Central Lot';

  protected readonly floorOptions = FLOOR_OPTIONS;
  protected readonly spotTypeOptions = SPOT_TYPE_OPTIONS;
  protected readonly vehicleTypeOptions = VEHICLE_TYPE_OPTIONS;

  protected readonly rows = signal<BulkSpotRow[]>(INITIAL_ROWS.map((row) => ({ ...row })));

  protected updateRow(index: number, field: keyof BulkSpotRow, value: string): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  protected addRow(): void {
    this.rows.update((rows) => [
      ...rows,
      {
        spotNumber: '',
        floor: FLOOR_OPTIONS[0],
        spotType: SPOT_TYPE_OPTIONS[0],
        vehicleType: VEHICLE_TYPE_OPTIONS[0],
        price: '',
      },
    ]);
  }

  protected pad(index: number): string {
    return (index + 1).toString().padStart(2, '0');
  }

  protected onCancel(): void {
    void this.router.navigateByUrl('/manager/spots');
  }
}
