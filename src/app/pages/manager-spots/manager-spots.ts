import { Component, computed, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';

type SpotStatus = 'available' | 'reserved' | 'occupied';

interface MockSpot {
  id: string;
  number: string;
  status: SpotStatus;
}

interface MockFloor {
  id: string;
  label: string;
  spots: MockSpot[];
}

interface MockLot {
  id: string;
  name: string;
  pendingApproval: boolean;
  floors: MockFloor[];
}

interface SpotStatusMeta {
  label: string;
  dotClass: string;
  cardClass: string;
}

const SPOT_STATUS_META: Record<SpotStatus, SpotStatusMeta> = {
  available: { label: 'Available', dotClass: 'bg-green-500', cardClass: 'bg-green-500' },
  reserved: { label: 'Reserved', dotClass: 'bg-accent', cardClass: 'bg-accent' },
  occupied: { label: 'Occupied', dotClass: 'bg-red-500', cardClass: 'bg-red-500' },
};

function spots(pattern: SpotStatus[]): MockSpot[] {
  return pattern.map((status, index) => ({
    id: `spot-${index + 1}`,
    number: `A-${String(index + 1).padStart(2, '0')}`,
    status,
  }));
}

const FLOOR_1_PATTERN: SpotStatus[] = [
  'available', 'available', 'available', 'reserved', 'available', 'available', 'occupied', 'available',
  'available', 'occupied', 'available', 'available', 'available', 'reserved', 'available', 'available',
  'available', 'available', 'reserved', 'available', 'available', 'occupied', 'available', 'available',
  'available', 'available', 'available', 'reserved', 'available', 'occupied', 'available', 'available',
];

const MOCK_LOTS: MockLot[] = [
  {
    id: 'lot-whitefield',
    name: 'Whitefield Central Lot',
    pendingApproval: false,
    floors: [
      { id: 'floor-1', label: 'Floor 1', spots: spots(FLOOR_1_PATTERN) },
      { id: 'floor-2', label: 'Floor 2', spots: [] },
    ],
  },
  {
    id: 'lot-shah-annex',
    name: 'Shah Annex Lot',
    pendingApproval: false,
    floors: [
      { id: 'floor-1', label: 'Floor 1', spots: spots(['available', 'available', 'reserved', 'available', 'occupied', 'available']) },
    ],
  },
  {
    id: 'lot-shah-rooftop',
    name: 'Shah Rooftop Deck',
    pendingApproval: true,
    floors: [{ id: 'floor-1', label: 'Floor 1', spots: [] }],
  },
];

@Component({
  selector: 'app-manager-spots',
  imports: [ManagerNav, NgTemplateOutlet],
  templateUrl: './manager-spots.html',
  styleUrl: './manager-spots.css',
})
export class ManagerSpots {
  protected readonly statusMeta = SPOT_STATUS_META;
  protected readonly lots = MOCK_LOTS;

  protected readonly selectedLotId = signal(MOCK_LOTS[0].id);
  protected readonly selectedFloorId = signal(MOCK_LOTS[0].floors[0].id);

  protected readonly lotMenuOpen = signal(false);
  protected readonly addSpotsMenuOpen = signal(false);

  protected readonly selectedLot = computed(
    () => this.lots.find((lot) => lot.id === this.selectedLotId())!,
  );

  protected readonly selectedFloor = computed(
    () => this.selectedLot().floors.find((floor) => floor.id === this.selectedFloorId())!,
  );

  protected selectLot(lotId: string): void {
    this.selectedLotId.set(lotId);
    this.selectedFloorId.set(this.lots.find((lot) => lot.id === lotId)!.floors[0].id);
    this.lotMenuOpen.set(false);
  }

  protected selectFloor(floorId: string): void {
    this.selectedFloorId.set(floorId);
  }

  protected toggleLotMenu(): void {
    this.addSpotsMenuOpen.set(false);
    this.lotMenuOpen.update((open) => !open);
  }

  protected toggleAddSpotsMenu(): void {
    this.lotMenuOpen.set(false);
    this.addSpotsMenuOpen.update((open) => !open);
  }

  protected closeMenus(): void {
    this.lotMenuOpen.set(false);
    this.addSpotsMenuOpen.set(false);
  }
}
