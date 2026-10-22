import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';
import { AuthService } from '../../services/auth.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { SpotService } from '../../services/spot.service';
import { VehicleService } from '../../services/vehicle.service';
import { LotResponse } from '../../models/lot.model';
import { SpotResponse, SpotStatus, VehicleType } from '../../models/spot.model';
import { VehicleResponse } from '../../models/vehicle/vehicle.model';

interface VehicleTypeOption {
  label: string;
  value: VehicleType;
}

const VEHICLE_TYPE_OPTIONS: VehicleTypeOption[] = [
  { label: 'Two Wheeler', value: 'TwoWheeler' },
  { label: 'Four Wheeler', value: 'FourWheeler' },
  { label: 'Heavy', value: 'Heavy' },
];

const DEFAULT_VEHICLE_TYPE: VehicleType = 'FourWheeler';

const SPOT_STATUS_CLASS: Record<SpotStatus, string> = {
  Available: 'bg-green-500',
  Reserved: 'bg-accent',
  Occupied: 'bg-red-500',
};

const MIN_HOURS = 1;
const MAX_HOURS = 4;
const DEFAULT_HOURS = 3;
const START_TIME_STEP_MINUTES = 15;

const EV_ONLY_REASON = 'EV charging spot: requires an electric vehicle';
const LOT_CLOSED_REASON = 'This lot is closed right now';

type LotFailure = 'not-found' | 'error';

/** Accepts the distance passed as router state from /lots only if it is a finite number >= 0. */
export function parseDistanceKm(state: unknown): number | null {
  const value = (state as { distanceKm?: unknown } | null)?.distanceKm;
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** "06:00:00" -> "6:00 AM". Returns the input unchanged if it isn't HH:mm[:ss]. */
export function formatTime12h(time: string): string {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) {
    return time;
  }
  const hours = Number(match[1]);
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 === 0 ? 12 : hours % 12}:${match[2]} ${period}`;
}

/**
 * Start time rule: now rounded up to the next 15 minutes (an exact quarter-hour is kept).
 * Shown as "Today, 4:30 PM", or "Tomorrow, ..." if rounding crosses midnight.
 */
export function formatStartTime(now: Date): string {
  const stepMs = START_TIME_STEP_MINUTES * 60_000;
  const start = new Date(Math.ceil(now.getTime() / stepMs) * stepMs);
  const day = start.getDate() === now.getDate() ? 'Today' : 'Tomorrow';
  const hh = String(start.getHours()).padStart(2, '0');
  const mm = String(start.getMinutes()).padStart(2, '0');
  return `${day}, ${formatTime12h(`${hh}:${mm}`)}`;
}

function capitalizeWords(text: string): string {
  return text.replace(/\b\p{L}/gu, (c) => c.toUpperCase());
}

@Component({
  selector: 'app-driver-lot-detail',
  imports: [DriverNav, RouterLink],
  templateUrl: './driver-lot-detail.html',
  styleUrl: './driver-lot-detail.css',
})
export class DriverLotDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly lotService = inject(ParkingLotService);
  private readonly spotService = inject(SpotService);
  private readonly vehicleService = inject(VehicleService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly vehicleTypeOptions = VEHICLE_TYPE_OPTIONS;
  protected readonly statusClass = SPOT_STATUS_CLASS;
  protected readonly minHours = MIN_HOURS;
  protected readonly maxHours = MAX_HOURS;

  protected readonly lot = signal<LotResponse | null>(null);
  protected readonly lotLoading = signal(false);
  protected readonly lotFailure = signal<LotFailure | null>(null);
  protected readonly lotError = signal<string | null>(null);

  protected readonly spots = signal<SpotResponse[]>([]);
  protected readonly spotsLoading = signal(false);
  protected readonly spotsError = signal<string | null>(null);

  protected readonly vehicles = signal<VehicleResponse[]>([]);
  protected readonly vehiclesLoading = signal(false);
  protected readonly vehiclesError = signal<string | null>(null);

  protected readonly distanceKm = signal<number | null>(null);
  protected readonly startTimeLabel = signal(formatStartTime(new Date()));
  protected readonly hours = signal(DEFAULT_HOURS);

  protected readonly selectedType = signal<VehicleType>(DEFAULT_VEHICLE_TYPE);
  private typeChosenByUser = false;
  private readonly selectedFloorChoice = signal<number | null>(null);
  private readonly selectedSpotId = signal<string | null>(null);

  protected readonly cityLabel = computed(() => capitalizeWords(this.lot()?.city ?? ''));
  protected readonly hoursLabel = computed(() => {
    const lot = this.lot();
    return lot ? `Open ${formatTime12h(lot.openTime)} – ${formatTime12h(lot.closeTime)}` : '';
  });
  protected readonly lotClosed = computed(() => this.lot()?.isOpen === false);

  protected readonly selectedVehicle = computed(
    () =>
      this.vehicles().find((v) => v.isActive && v.vehicleType === this.selectedType()) ?? null,
  );

  protected readonly floors = computed(() =>
    Array.from(new Set(this.spots().map((spot) => spot.floor))).sort((a, b) => a - b),
  );
  protected readonly selectedFloor = computed(() => {
    const floors = this.floors();
    const choice = this.selectedFloorChoice();
    return choice !== null && floors.includes(choice) ? choice : (floors[0] ?? null);
  });

  protected readonly visibleSpots = computed(() =>
    this.spots().filter(
      (spot) => spot.vehicleType === this.selectedType() && spot.floor === this.selectedFloor(),
    ),
  );

  protected readonly selectedSpot = computed(() => {
    const spot = this.visibleSpots().find((s) => s.spotId === this.selectedSpotId());
    return spot && this.blockedReason(spot) === null ? spot : null;
  });

  protected readonly estimatedTotal = computed(() => {
    const spot = this.selectedSpot();
    return spot ? spot.pricePerHour * this.hours() : null;
  });

  protected readonly canContinue = computed(
    () => !!this.selectedSpot() && !!this.selectedVehicle() && !!this.lot() && !this.lotClosed(),
  );

  private lotRequestId = 0;
  private spotsRequestId = 0;
  private vehiclesRequestId = 0;

  ngOnInit(): void {
    this.distanceKm.set(parseDistanceKm(history.state));
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const lotId = params.get('lotId');
      if (lotId) {
        this.selectedSpotId.set(null);
        void this.loadLot(lotId);
        void this.loadSpots(lotId);
      }
    });
    void this.loadVehicles();
  }

  protected selectVehicleType(type: VehicleType): void {
    this.typeChosenByUser = true;
    this.selectedType.set(type);
    this.selectedSpotId.set(null);
  }

  protected selectFloor(floor: number): void {
    this.selectedFloorChoice.set(floor);
  }

  protected selectSpot(spot: SpotResponse): void {
    if (this.blockedReason(spot) === null) {
      this.selectedSpotId.set(spot.spotId);
    }
  }

  protected changeHours(delta: number): void {
    this.hours.update((h) => Math.min(MAX_HOURS, Math.max(MIN_HOURS, h + delta)));
  }

  /** Why a spot can't be picked right now, or null if it can. Used for title/aria-label. */
  protected blockedReason(spot: SpotResponse): string | null {
    if (this.lotClosed()) {
      return LOT_CLOSED_REASON;
    }
    if (spot.status !== 'Available') {
      return `Spot is ${spot.status.toLowerCase()}`;
    }
    if (spot.isEvCharging && !this.selectedVehicle()?.isElectric) {
      return EV_ONLY_REASON;
    }
    return null;
  }

  protected spotAriaLabel(spot: SpotResponse): string {
    const reason = this.blockedReason(spot);
    return reason ? `${spot.spotNumber}, unavailable: ${reason}` : `${spot.spotNumber}, available`;
  }

  private async loadLot(lotId: string): Promise<void> {
    const requestId = ++this.lotRequestId;
    this.lotLoading.set(true);
    this.lotFailure.set(null);
    this.lotError.set(null);
    this.lot.set(null);

    try {
      const response = await firstValueFrom(this.lotService.getLotById(lotId));
      if (requestId === this.lotRequestId) {
        this.lot.set(response.data);
      }
    } catch (err) {
      if (requestId === this.lotRequestId) {
        if (err instanceof HttpErrorResponse && (err.status === 404 || err.status === 400)) {
          this.lotFailure.set('not-found');
        } else {
          this.lotFailure.set('error');
          this.lotError.set(this.resolveErrorMessage(err, "Couldn't load this lot."));
        }
      }
    } finally {
      if (requestId === this.lotRequestId) {
        this.lotLoading.set(false);
      }
    }
  }

  private async loadSpots(lotId: string): Promise<void> {
    const requestId = ++this.spotsRequestId;
    this.spotsLoading.set(true);
    this.spotsError.set(null);
    this.spots.set([]);

    try {
      const response = await firstValueFrom(this.spotService.getSpotsByLot(lotId));
      if (requestId === this.spotsRequestId) {
        this.spots.set(response.data ?? []);
      }
    } catch (err) {
      if (requestId === this.spotsRequestId) {
        this.spotsError.set(this.resolveErrorMessage(err, "Couldn't load spots for this lot."));
      }
    } finally {
      if (requestId === this.spotsRequestId) {
        this.spotsLoading.set(false);
      }
    }
  }

  private async loadVehicles(): Promise<void> {
    const requestId = ++this.vehiclesRequestId;
    this.vehiclesLoading.set(true);
    this.vehiclesError.set(null);

    try {
      const response = await firstValueFrom(this.vehicleService.getMyVehicles());
      if (requestId !== this.vehiclesRequestId) {
        return;
      }
      const vehicles = response.data ?? [];
      this.vehicles.set(vehicles);
      if (!this.typeChosenByUser) {
        const firstActive = vehicles.find((v) => v.isActive);
        this.selectedType.set(firstActive?.vehicleType ?? DEFAULT_VEHICLE_TYPE);
      }
    } catch (err) {
      if (requestId === this.vehiclesRequestId) {
        this.vehiclesError.set(this.resolveErrorMessage(err, "Couldn't load your vehicles."));
      }
    } finally {
      if (requestId === this.vehiclesRequestId) {
        this.vehiclesLoading.set(false);
      }
    }
  }

  private resolveErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) {
        this.authService.clearSession();
        void this.router.navigateByUrl('/login');
        return 'Your session has expired. Please log in again.';
      }
      if (err.status === 0) {
        return "Couldn't reach the server. Check your connection and try again.";
      }
      if (err.status === 429) {
        return 'Too many requests. Please retry in a few moments.';
      }
      if (err.status >= 500) {
        return 'Something went wrong on our side. Please try again shortly.';
      }
    }
    return `${fallback} Please try again.`;
  }
}
