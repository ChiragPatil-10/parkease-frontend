import { Component, signal } from '@angular/core';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';

type RadiusKm = 1 | 2 | 5 | 10;

interface NearbyLot {
  id: string;
  availableSpots: number;
  name: string;
  address: string;
  distanceKm: number;
  pricePerHour: number;
}

interface CityLot {
  id: string;
  name: string;
  pricePerHour: number;
  available: number;
}

const RADIUS_OPTIONS: RadiusKm[] = [1, 2, 5, 10];

const NEARBY_LOTS: NearbyLot[] = [
  {
    id: 'lot-1',
    availableSpots: 12,
    name: 'Whitefield Central Lot',
    address: '2nd Cross, ITPL Main Rd',
    distanceKm: 0.4,
    pricePerHour: 40,
  },
  {
    id: 'lot-2',
    availableSpots: 4,
    name: 'Marathahalli Tower Park',
    address: 'Outer Ring Rd, near Signal',
    distanceKm: 0.9,
    pricePerHour: 35,
  },
  {
    id: 'lot-3',
    availableSpots: 27,
    name: 'Brookefield Mall Deck',
    address: 'AECS Layout Block C',
    distanceKm: 1.6,
    pricePerHour: 50,
  },
];

const CITY_LOTS: CityLot[] = [
  { id: 'lot-1', name: 'Whitefield Central Lot', pricePerHour: 40, available: 12 },
  { id: 'lot-2', name: 'Marathahalli Tower Park', pricePerHour: 35, available: 4 },
  { id: 'lot-3', name: 'Brookefield Mall Deck', pricePerHour: 50, available: 27 },
];

interface MapMarkerPosition {
  top: string;
  left: string;
}

const MAP_MARKERS: MapMarkerPosition[] = [
  { top: '45%', left: '57%' },
  { top: '63%', left: '41%' },
  { top: '61%', left: '67%' },
];

@Component({
  selector: 'app-driver-lots',
  imports: [DriverNav],
  templateUrl: './driver-lots.html',
  styleUrl: './driver-lots.css',
})
export class DriverLots {
  // Phase 1 mock toggle — Phase 2 will set this from the real geolocation result
  // instead of a fixed default.
  protected readonly locationGranted = signal(true);

  protected readonly radiusOptions = RADIUS_OPTIONS;
  protected readonly selectedRadius = signal<RadiusKm>(2);
  protected readonly nearbyLots = signal<NearbyLot[]>(NEARBY_LOTS);

  protected readonly city = signal('Bengaluru');
  protected readonly cityLotsCount = signal(12);
  protected readonly cityLots = signal<CityLot[]>(CITY_LOTS);

  protected readonly mapMarkers = MAP_MARKERS;

  protected selectRadius(radius: RadiusKm): void {
    this.selectedRadius.set(radius);
  }
}
