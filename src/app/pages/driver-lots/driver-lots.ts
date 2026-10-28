import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';
import { AuthService } from '../../services/auth.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { LotResponse, NearbyLot } from '../../models/lot.model';

type RadiusKm = 1 | 2 | 5 | 10;

const RADIUS_OPTIONS: RadiusKm[] = [1, 2, 5, 10];
const DEFAULT_RADIUS: RadiusKm = 2;
// Search endpoint caps pageSize at 50; the design has no pagination controls, so one page covers it.
const SEARCH_PAGE_SIZE = 50;

const LOCATION_BLOCKED_HINT =
  "Couldn't get your location. Enable location access for this site in your browser settings, then try again.";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface MapMarkerPosition {
  top: string;
  left: string;
}

// Decorative placeholder only: not positioned from real coordinates (open design decision).
const MAP_MARKERS: MapMarkerPosition[] = [
  { top: '45%', left: '57%' },
  { top: '63%', left: '41%' },
  { top: '61%', left: '67%' },
];

@Component({
  selector: 'app-driver-lots',
  imports: [DriverNav, RouterLink],
  templateUrl: './driver-lots.html',
  styleUrl: './driver-lots.css',
})
export class DriverLots implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly lotService = inject(ParkingLotService);
  private readonly router = inject(Router);

  protected readonly resolvingPermission = signal(true);
  protected readonly locationGranted = signal(false);
  protected readonly locating = signal(false);
  protected readonly locationHint = signal<string | null>(null);
  protected readonly bannerDismissed = signal(false);

  protected readonly radiusOptions = RADIUS_OPTIONS;
  protected readonly selectedRadius = signal<RadiusKm>(DEFAULT_RADIUS);
  protected readonly nearbyLots = signal<NearbyLot[]>([]);
  protected readonly nearbyLoading = signal(false);
  protected readonly nearbyError = signal<string | null>(null);

  protected readonly cityInput = signal('');
  protected readonly searchedCity = signal<string | null>(null);
  protected readonly cityLots = signal<LotResponse[]>([]);
  protected readonly cityLotsCount = signal(0);
  protected readonly searchLoading = signal(false);
  protected readonly searchError = signal<string | null>(null);
  protected readonly emptySearch = signal(false);

  protected readonly mapMarkers = MAP_MARKERS;

  private coords: Coordinates | null = null;
  private nearbyRequestId = 0;
  private searchRequestId = 0;

  ngOnInit(): void {
    void this.resolveInitialState();
  }

  private async resolveInitialState(): Promise<void> {
    try {
      const status = await navigator.permissions?.query({ name: 'geolocation' });
      if (status?.state === 'granted') {
        const position = await this.getPosition();
        this.coords = position;
        this.locationGranted.set(true);
        this.resolvingPermission.set(false);
        await this.loadNearby();
        return;
      }
    } catch {
      // Permissions API unavailable or position lookup failed: fall through to State B.
    }
    this.resolvingPermission.set(false);
  }

  protected async enableLocation(): Promise<void> {
    this.locating.set(true);
    this.locationHint.set(null);
    try {
      this.coords = await this.getPosition();
    } catch {
      this.locationHint.set(LOCATION_BLOCKED_HINT);
      return;
    } finally {
      this.locating.set(false);
    }
    this.locationGranted.set(true);
    await this.loadNearby();
  }

  protected dismissBanner(): void {
    this.bannerDismissed.set(true);
  }

  protected selectRadius(radius: RadiusKm): void {
    this.selectedRadius.set(radius);
    void this.loadNearby();
  }

  protected onCityInput(event: Event): void {
    this.cityInput.set((event.target as HTMLInputElement).value);
    this.emptySearch.set(false);
  }

  protected async search(): Promise<void> {
    const city = this.cityInput().trim();
    if (!city) {
      this.emptySearch.set(true);
      return;
    }
    this.emptySearch.set(false);

    const requestId = ++this.searchRequestId;
    this.searchLoading.set(true);
    this.searchError.set(null);

    try {
      const response = await firstValueFrom(this.lotService.searchLots(city, 1, SEARCH_PAGE_SIZE));
      if (requestId !== this.searchRequestId) {
        return;
      }
      this.cityLots.set(response.data?.items ?? []);
      this.cityLotsCount.set(response.data?.totalCount ?? 0);
      this.searchedCity.set(city);
    } catch (err) {
      if (requestId !== this.searchRequestId) {
        return;
      }
      this.searchError.set(this.resolveErrorMessage(err));
    } finally {
      if (requestId === this.searchRequestId) {
        this.searchLoading.set(false);
      }
    }
  }

  private async loadNearby(): Promise<void> {
    if (!this.coords) {
      return;
    }

    const requestId = ++this.nearbyRequestId;
    this.nearbyLoading.set(true);
    this.nearbyError.set(null);

    try {
      const response = await firstValueFrom(
        this.lotService.getNearbyLots(
          this.coords.latitude,
          this.coords.longitude,
          this.selectedRadius(),
        ),
      );
      if (requestId !== this.nearbyRequestId) {
        return;
      }
      this.nearbyLots.set(response.data ?? []);
    } catch (err) {
      if (requestId !== this.nearbyRequestId) {
        return;
      }
      this.nearbyError.set(this.resolveErrorMessage(err));
    } finally {
      if (requestId === this.nearbyRequestId) {
        this.nearbyLoading.set(false);
      }
    }
  }

  private getPosition(): Promise<Coordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation unavailable'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
        (error) => reject(error),
      );
    });
  }

  private resolveErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      switch (true) {
        case err.status === 0:
          return "Couldn't reach the server. Check your connection and try again.";
        case err.status === 401:
          this.authService.clearSession();
          void this.router.navigateByUrl('/login');
          return 'Your session has expired. Please log in again.';
        case err.status === 400 || err.status === 422:
          return "That request wasn't valid. Please check your input and try again.";
        case err.status === 429:
          return 'Too many requests. Please retry in a few moments.';
        case err.status >= 500:
          return 'Something went wrong on our side. Please try again shortly.';
      }
    }
    return "Couldn't load lots. Please try again.";
  }
}
