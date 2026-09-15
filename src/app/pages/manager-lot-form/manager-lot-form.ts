import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  FormField,
  FormRoot,
  ValidationError,
  form,
  maxLength,
  min,
  minLength,
  required,
  validate,
} from '@angular/forms/signals';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';
import { ParkingLotService } from '../../services/parkinglot.service';
import { ApiResponse } from '../../models/api-response.model';
import { LotRequest, LotResponse } from '../../models/lot.model';

interface LotFormModel {
  name: string;
  address: string;
  city: string;
  totalSpots: number | null;
  minPricePerHour: number | null;
  maxPricePerHour: number | null;
  openTime: string;
  closeTime: string;
  description: string;
}

const EMPTY_LOT: LotFormModel = {
  name: '',
  address: '',
  city: '',
  totalSpots: null,
  minPricePerHour: null,
  maxPricePerHour: null,
  openTime: '',
  closeTime: '',
  description: '',
};

/**
 * gateway.md flags the 422 `errors` dict's key casing as unconfirmed (PascalCase per the
 * validator source, but never observed live) — matched case-insensitively here so this keeps
 * working whichever casing the API actually sends.
 */
const SERVER_FIELD_KEYS: Record<string, keyof LotFormModel> = {
  name: 'name',
  address: 'address',
  city: 'city',
  totalspots: 'totalSpots',
  minpriceperhour: 'minPricePerHour',
  maxpriceperhour: 'maxPricePerHour',
  opentime: 'openTime',
  closetime: 'closeTime',
  description: 'description',
};

@Component({
  selector: 'app-manager-lot-form',
  imports: [ManagerNav, FormField, FormRoot],
  templateUrl: './manager-lot-form.html',
  styleUrl: './manager-lot-form.css',
})
export class ManagerLotForm implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly lotService = inject(ParkingLotService);

  private readonly lotId = this.route.snapshot.paramMap.get('id');
  protected readonly isEditMode = this.lotId !== null;
  protected readonly heading = this.isEditMode ? 'Edit lot' : 'Add a new lot';

  protected readonly loading = signal(this.isEditMode);
  protected readonly loadError = signal<string | null>(null);
  protected readonly serverError = signal<string | null>(null);

  private readonly lot = signal<LotFormModel>({ ...EMPTY_LOT });

  protected readonly lotForm = form(
    this.lot,
    (path) => {
      required(path.name, { message: 'Lot name is required.' });

      required(path.address, { message: 'Address is required.' });
      minLength(path.address, 10, { message: 'Address must be at least 10 characters.' });

      required(path.city, { message: 'City is required.' });

      required(path.totalSpots, { message: 'Total spots is required.' });
      min(path.totalSpots, 1, { message: 'Total spots must be greater than 0.' });

      required(path.minPricePerHour, { message: 'Min price per hour is required.' });
      min(path.minPricePerHour, 0, { message: 'Min price per hour cannot be negative.' });

      required(path.maxPricePerHour, { message: 'Max price per hour is required.' });
      validate(path.maxPricePerHour, (ctx) => {
        const minPrice = ctx.valueOf(path.minPricePerHour);
        const maxPrice = ctx.value();
        if (minPrice == null || maxPrice == null || maxPrice >= minPrice) {
          return undefined;
        }
        return {
          kind: 'min-max',
          message: 'Max price must be greater than or equal to min price',
        };
      });

      required(path.openTime, { message: 'Open time is required.' });
      required(path.closeTime, { message: 'Close time is required.' });

      maxLength(path.description, 1000, {
        message: 'Description must be 1000 characters or fewer.',
      });
    },
    {
      submission: {
        action: async () => {
          this.serverError.set(null);
          const request = this.buildRequest(this.lot());

          try {
            const response = this.isEditMode
              ? await firstValueFrom(this.lotService.updateLot(this.lotId!, request))
              : await firstValueFrom(this.lotService.createLot(request));

            if (response.data) {
              void this.router.navigateByUrl('/manager/lots');
            }
            return undefined;
          } catch (err) {
            return this.handleSubmitError(err);
          }
        },
      },
    },
  );

  ngOnInit(): void {
    if (this.isEditMode) {
      void this.loadLot();
    }
  }

  protected onCancel(): void {
    void this.router.navigateByUrl('/manager/lots');
  }

  private async loadLot(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);

    try {
      const response = await firstValueFrom(this.lotService.getLotById(this.lotId!));
      if (response.data) {
        this.lot.set(this.toFormModel(response.data));
      }
    } catch (err) {
      if (err instanceof HttpErrorResponse && (err.status === 401 || err.status === 404)) {
        this.redirectWithError(
          err.status === 404
            ? 'That lot could not be found. It may have been removed.'
            : "You don't have permission to edit this lot.",
        );
        return;
      }
      this.loadError.set("Couldn't load this lot. Please try again.");
    } finally {
      this.loading.set(false);
    }
  }

  private toFormModel(lot: LotResponse): LotFormModel {
    return {
      name: lot.name,
      address: lot.address,
      city: lot.city,
      totalSpots: lot.totalSpots,
      minPricePerHour: lot.minPricePerHour,
      maxPricePerHour: lot.maxPricePerHour,
      openTime: lot.openTime.slice(0, 5),
      closeTime: lot.closeTime.slice(0, 5),
      description: lot.description ?? '',
    };
  }

  private buildRequest(value: LotFormModel): LotRequest {
    const description = value.description.trim();

    return {
      name: value.name.trim(),
      address: value.address.trim(),
      city: value.city.trim(),
      totalSpots: value.totalSpots!,
      minPricePerHour: value.minPricePerHour!,
      maxPricePerHour: value.maxPricePerHour!,
      openTime: `${value.openTime}:00`,
      closeTime: `${value.closeTime}:00`,
      ...(description ? { description } : {}),
    };
  }

  private handleSubmitError(err: unknown): ValidationError.WithOptionalFieldTree[] | undefined {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 422) {
        const body = err.error as ApiResponse<unknown> & { errors?: Record<string, string[]> } | null;
        const fieldErrors = body?.errors ? this.mapFieldErrors(body.errors) : [];
        if (fieldErrors.length > 0) {
          return fieldErrors;
        }
        this.serverError.set(body?.message ?? 'Validation failed. Please check the form and try again.');
        return undefined;
      }

      const body = err.error as ApiResponse<unknown> | null;
      if (body?.message) {
        this.serverError.set(body.message);
        return undefined;
      }
    }

    this.serverError.set('Something went wrong. Please try again.');
    return undefined;
  }

  private mapFieldErrors(errors: Record<string, string[]>): ValidationError.WithOptionalFieldTree[] {
    const mapped: ValidationError.WithOptionalFieldTree[] = [];

    for (const [key, messages] of Object.entries(errors)) {
      const fieldKey = SERVER_FIELD_KEYS[key.toLowerCase()];
      const message = messages?.[0];
      if (fieldKey && message) {
        mapped.push({ fieldTree: this.lotForm[fieldKey], kind: 'server', message });
      }
    }

    return mapped;
  }

  private redirectWithError(message: string): void {
    void this.router.navigate(['/manager/lots'], { state: { errorMessage: message } });
  }
}
