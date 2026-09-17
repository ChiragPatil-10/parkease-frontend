import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';
import { AuthService } from '../../services/auth.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { SpotService } from '../../services/spot.service';
import { LotResponse } from '../../models/lot.model';
import { SpotResponse, SpotStatus } from '../../models/spot.model';

interface SpotStatusMeta {
  label: string;
  dotClass: string;
  cardClass: string;
}

const SPOT_STATUS_META: Record<SpotStatus, SpotStatusMeta> = {
  Available: { label: 'Available', dotClass: 'bg-green-500', cardClass: 'bg-green-500' },
  Reserved: { label: 'Reserved', dotClass: 'bg-accent', cardClass: 'bg-accent' },
  Occupied: { label: 'Occupied', dotClass: 'bg-red-500', cardClass: 'bg-red-500' },
};

@Component({
  selector: 'app-manager-spots',
  imports: [ManagerNav, NgTemplateOutlet],
  templateUrl: './manager-spots.html',
  styleUrl: './manager-spots.css',
})
export class ManagerSpots implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly lotService = inject(ParkingLotService);
  private readonly spotService = inject(SpotService);
  private readonly router = inject(Router);

  protected readonly statusMeta = SPOT_STATUS_META;

  protected readonly lots = signal<LotResponse[]>([]);
  protected readonly selectedLotId = signal<string | null>(null);
  protected readonly selectedLot = computed(
    () => this.lots().find((lot) => lot.lotId === this.selectedLotId()) ?? null,
  );

  protected readonly spots = signal<SpotResponse[]>([]);
  protected readonly floors = computed(() =>
    Array.from(new Set(this.spots().map((spot) => spot.floor))).sort((a, b) => a - b),
  );
  protected readonly selectedFloor = signal<number | null>(null);
  protected readonly filteredSpots = computed(() =>
    this.spots().filter((spot) => spot.floor === this.selectedFloor()),
  );

  protected readonly lotsLoading = signal(false);
  protected readonly spotsLoading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly lotMenuOpen = signal(false);
  protected readonly addSpotsMenuOpen = signal(false);

  ngOnInit(): void {
    void this.loadLots();
  }

  protected async loadLots(): Promise<void> {
    const managerId = this.authService.getCurrentUser()?.userId;
    if (!managerId) {
      this.error.set("Couldn't load your lots. Please try again.");
      return;
    }

    this.lotsLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.lotService.getLotsByManager(managerId));
      const lots = response.data ?? [];
      this.lots.set(lots);
      if (lots.length > 0) {
        await this.selectLot(lots[0].lotId);
      }
    } catch (err) {
      this.error.set(this.resolveErrorMessage(err, "Couldn't load your lots. Please try again."));
    } finally {
      this.lotsLoading.set(false);
    }
  }

  protected async selectLot(lotId: string): Promise<void> {
    this.selectedLotId.set(lotId);
    this.selectedFloor.set(null);
    this.lotMenuOpen.set(false);
    await this.loadSpots(lotId, true);
  }

  protected async selectFloor(floor: number): Promise<void> {
    this.selectedFloor.set(floor);
    const lotId = this.selectedLotId();
    if (!lotId) {
      return;
    }
    await this.loadSpots(lotId, false);
  }

  private async loadSpots(lotId: string, selectDefaultFloor: boolean): Promise<void> {
    this.spotsLoading.set(true);
    this.error.set(null);

    try {
      const response = await firstValueFrom(this.spotService.getSpotsByLot(lotId));
      this.spots.set(response.data ?? []);
      if (selectDefaultFloor) {
        this.selectedFloor.set(this.floors()[0] ?? null);
      }
    } catch (err) {
      this.error.set(this.resolveErrorMessage(err, "Couldn't load spots for this lot. Please try again."));
    } finally {
      this.spotsLoading.set(false);
    }
  }

  protected goToBulkCreate(lotId: string): void {
    void this.router.navigateByUrl(`/manager/spots/${lotId}/bulk-create`);
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

  private resolveErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) {
        this.authService.clearSession();
        void this.router.navigateByUrl('/login');
        return 'Your session has expired. Please log in again.';
      }

      const body: unknown = err.error;
      if (
        body &&
        typeof body === 'object' &&
        'message' in body &&
        typeof (body as { message: unknown }).message === 'string'
      ) {
        return (body as { message: string }).message;
      }
    }
    return fallback;
  }
}
