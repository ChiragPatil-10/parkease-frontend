import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';
import { AuthService } from '../../services/auth.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { SpotService } from '../../services/spot.service';
import { ApiResponse } from '../../models/api-response.model';
import { SpotCreateItem, SpotType, VehicleType } from '../../models/spot.model';

interface BulkSpotRow {
  spotNumber: string;
  floor: string;
  spotType: string;
  vehicleType: string;
  price: string;
}

interface RowErrors {
  spotNumber?: string;
  price?: string;
  compatibility?: string;
}

const FLOOR_OPTIONS = ['Floor 1', 'Floor 2', 'Floor 3', 'Floor 4'];
const SPOT_TYPE_OPTIONS = ['Compact', 'Standard', 'Large', 'Motorbike', 'EV'];
const VEHICLE_TYPE_OPTIONS = ['Two Wheeler', 'Four Wheeler', 'Heavy'];

/** Server's compatibility matrix (03-Spot-Service.md), keyed by the display values used in the dropdowns. */
const COMPATIBLE_VEHICLE_TYPES: Record<string, string[]> = {
  Compact: ['Four Wheeler'],
  Standard: ['Four Wheeler'],
  Large: ['Four Wheeler', 'Heavy'],
  Motorbike: ['Two Wheeler'],
  EV: ['Four Wheeler', 'Two Wheeler'],
};

const VEHICLE_TYPE_WIRE: Record<string, VehicleType> = {
  'Two Wheeler': 'TwoWheeler',
  'Four Wheeler': 'FourWheeler',
  Heavy: 'Heavy',
};

function blankRow(): BulkSpotRow {
  return {
    spotNumber: '',
    floor: FLOOR_OPTIONS[0],
    spotType: SPOT_TYPE_OPTIONS[0],
    vehicleType: VEHICLE_TYPE_OPTIONS[0],
    price: '',
  };
}

@Component({
  selector: 'app-manager-bulk-create-spots',
  imports: [ManagerNav],
  templateUrl: './manager-bulk-create-spots.html',
  styleUrl: './manager-bulk-create-spots.css',
})
export class ManagerBulkCreateSpots implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly lotService = inject(ParkingLotService);
  private readonly spotService = inject(SpotService);

  protected readonly lotId = this.route.snapshot.paramMap.get('lotId');

  protected readonly lotName = signal<string | null>(null);
  protected readonly lotLoading = signal(true);
  protected readonly lotLoadError = signal<string | null>(null);

  protected readonly floorOptions = FLOOR_OPTIONS;
  protected readonly spotTypeOptions = SPOT_TYPE_OPTIONS;
  protected readonly vehicleTypeOptions = VEHICLE_TYPE_OPTIONS;

  protected readonly rows = signal<BulkSpotRow[]>([blankRow()]);
  protected readonly hasAttemptedSubmit = signal(false);
  protected readonly submitting = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly serverRowErrors = signal<Record<number, string>>({});

  protected readonly rowErrors = computed(() => this.rows().map((row) => this.validateRow(row)));
  protected readonly isFormValid = computed(() =>
    this.rowErrors().every((errors) => Object.keys(errors).length === 0),
  );

  ngOnInit(): void {
    if (!this.lotId) {
      this.lotLoadError.set('Missing lot reference. Please go back and try again.');
      this.lotLoading.set(false);
      return;
    }
    void this.loadLot(this.lotId);
  }

  protected updateRow(index: number, field: keyof BulkSpotRow, value: string): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    this.serverRowErrors.update((errors) => {
      const { [index]: _removed, ...rest } = errors;
      return rest;
    });
  }

  protected addRow(): void {
    this.rows.update((rows) => [...rows, blankRow()]);
  }

  protected pad(index: number): string {
    return (index + 1).toString().padStart(2, '0');
  }

  protected rowErrorMessage(index: number): string | null {
    const clientErrors = this.rowErrors()[index];
    const messages = [clientErrors?.spotNumber, clientErrors?.price, clientErrors?.compatibility].filter(
      (message): message is string => !!message,
    );
    if (messages.length > 0) {
      return messages.join(' ');
    }
    return this.serverRowErrors()[index] ?? null;
  }

  protected onCancel(): void {
    void this.router.navigateByUrl('/manager/spots');
  }

  protected async onSubmit(): Promise<void> {
    this.hasAttemptedSubmit.set(true);
    this.serverError.set(null);

    if (!this.isFormValid() || !this.lotId) {
      return;
    }

    this.submitting.set(true);
    this.serverRowErrors.set({});

    try {
      const spots = this.rows().map((row) => this.toSpotCreateItem(row));
      const response = await firstValueFrom(this.spotService.bulkCreateSpots(this.lotId, spots));
      if (response.data) {
        void this.router.navigateByUrl('/manager/spots');
      }
    } catch (err) {
      this.handleSubmitError(err);
    } finally {
      this.submitting.set(false);
    }
  }

  private async loadLot(lotId: string): Promise<void> {
    this.lotLoading.set(true);
    this.lotLoadError.set(null);

    try {
      const response = await firstValueFrom(this.lotService.getLotById(lotId));
      if (response.data) {
        this.lotName.set(response.data.name);
      }
    } catch (err) {
      if (err instanceof HttpErrorResponse) {
        if (err.status === 401) {
          this.authService.clearSession();
          void this.router.navigateByUrl('/login');
          return;
        }
        if (err.status === 404) {
          this.lotLoadError.set('This lot could not be found. It may have been removed.');
          return;
        }
      }
      this.lotLoadError.set("Couldn't load this lot. Please try again.");
    } finally {
      this.lotLoading.set(false);
    }
  }

  private validateRow(row: BulkSpotRow): RowErrors {
    const errors: RowErrors = {};

    if (!row.spotNumber.trim()) {
      errors.spotNumber = 'Spot number is required.';
    }

    const price = Number(row.price);
    if (!row.price.trim() || Number.isNaN(price) || price <= 0) {
      errors.price = 'Price must be greater than 0.';
    }

    const allowedVehicleTypes = COMPATIBLE_VEHICLE_TYPES[row.spotType] ?? [];
    if (!allowedVehicleTypes.includes(row.vehicleType)) {
      errors.compatibility = `${row.spotType} needs ${allowedVehicleTypes.join(' or ')} vehicle type.`;
    }

    return errors;
  }

  private toSpotCreateItem(row: BulkSpotRow): SpotCreateItem {
    return {
      spotNumber: row.spotNumber.trim(),
      floor: Number(row.floor.replace(/[^0-9]/g, '')),
      spotType: row.spotType as SpotType,
      vehicleType: VEHICLE_TYPE_WIRE[row.vehicleType],
      isEvCharging: row.spotType === 'EV',
      isHandicapped: false,
      pricePerHour: Number(row.price),
    };
  }

  private handleSubmitError(err: unknown): void {
    if (!(err instanceof HttpErrorResponse)) {
      this.serverError.set('Something went wrong. Please try again.');
      return;
    }

    if (err.status === 401) {
      this.authService.clearSession();
      void this.router.navigateByUrl('/login');
      this.serverError.set('Your session has expired. Please log in again.');
      return;
    }

    const body = err.error as ApiResponse<unknown> | null;

    if (err.status === 404) {
      this.serverError.set(body?.message ?? 'This lot could not be found.');
      return;
    }

    if (err.status === 409) {
      this.serverError.set(body?.message ?? 'This lot is not approved for spots yet.');
      return;
    }

    if (err.status === 400) {
      this.serverError.set(
        body?.message ?? "One of these spots isn't valid — check the spot type and vehicle type combinations.",
      );
      return;
    }

    if (err.status === 422) {
      if (body?.errors && this.mapFieldErrorsToRows(body.errors)) {
        return;
      }
      this.serverError.set(body?.message ?? 'Validation failed. Please check the form and try again.');
      return;
    }

    this.serverError.set(body?.message ?? 'Something went wrong. Please try again.');
  }

  /**
   * Best-effort mapping only — 03-Spot-Service.md doesn't show a worked example of the 422 `errors`
   * dict shape for the bulk endpoint's per-item validation, so this assumes the common ASP.NET
   * indexed-property key format ("Spots[0].SpotNumber") and falls back to the banner if it doesn't match.
   */
  private mapFieldErrorsToRows(errors: Record<string, string[]>): boolean {
    const rowErrors: Record<number, string> = {};

    for (const [key, messages] of Object.entries(errors)) {
      const match = /spots\[(\d+)\]/i.exec(key);
      const message = messages?.[0];
      if (match && message) {
        rowErrors[Number(match[1])] = message;
      }
    }

    if (Object.keys(rowErrors).length === 0) {
      return false;
    }

    this.serverRowErrors.set(rowErrors);
    return true;
  }
}
