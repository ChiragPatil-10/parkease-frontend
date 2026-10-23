import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  FormField,
  FormRoot,
  ValidationError,
  form,
  maxLength,
  validate,
} from '@angular/forms/signals';
import { AuthService } from '../../../services/auth.service';
import { VehicleService } from '../../../services/vehicle.service';
import { ApiResponse } from '../../../models/api-response.model';
import { VehicleType } from '../../../models/spot.model';
import { CreateVehicleRequest, VehicleResponse } from '../../../models/vehicle/vehicle.model';
import { DialogBehavior } from '../dialog-behavior.directive';
import { backendMessage, genericErrorMessage } from '../vehicle-errors';
import { normalizePlate } from '../vehicle-format';

const PLATE_MAX = 20;
const NAME_MAX = 50;

interface VehicleTypeOption {
  label: string;
  value: VehicleType;
}

interface VehicleFormModel {
  plate: string;
  vehicleType: VehicleType | null;
  make: string;
  model: string;
  isElectric: boolean;
}

const VEHICLE_TYPE_OPTIONS: VehicleTypeOption[] = [
  { label: 'Two Wheeler', value: 'TwoWheeler' },
  { label: 'Four Wheeler', value: 'FourWheeler' },
  { label: 'Heavy', value: 'Heavy' },
];

/** Case-insensitive, like the lot form: the 422 `errors` dict key casing is not confirmed live. */
const SERVER_FIELD_KEYS: Record<string, keyof VehicleFormModel> = {
  platenumber: 'plate',
  vehicletype: 'vehicleType',
  make: 'make',
  model: 'model',
  iselectric: 'isElectric',
};

@Component({
  selector: 'app-add-vehicle-modal',
  imports: [DialogBehavior, FormField, FormRoot],
  templateUrl: './add-vehicle-modal.html',
})
export class AddVehicleModal {
  private readonly vehicleService = inject(VehicleService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  /** The button that opened the modal; focus returns to it on close. */
  readonly opener = input<HTMLElement | null>(null);

  readonly closed = output<void>();
  readonly added = output<VehicleResponse>();

  protected readonly vehicleTypeOptions = VEHICLE_TYPE_OPTIONS;
  protected readonly serverError = signal<string | null>(null);
  protected readonly submitAttempted = signal(false);
  private readonly typeButtons = viewChildren<ElementRef<HTMLButtonElement>>('typeOption');

  private readonly vehicle = signal<VehicleFormModel>({
    plate: '',
    vehicleType: null,
    make: '',
    model: '',
    isElectric: false,
  });

  protected readonly vehicleForm = form(
    this.vehicle,
    (path) => {
      validate(path.plate, (ctx) => {
        const plate = normalizePlate(ctx.value());
        if (plate.length === 0) {
          return { kind: 'required', message: 'Plate number is required.' };
        }
        return plate.length > PLATE_MAX
          ? { kind: 'maxLength', message: `Plate number must be ${PLATE_MAX} characters or fewer.` }
          : undefined;
      });

      validate(path.make, (ctx) =>
        ctx.value().trim().length === 0
          ? { kind: 'required', message: 'Make is required.' }
          : undefined,
      );
      maxLength(path.make, NAME_MAX, { message: `Make must be ${NAME_MAX} characters or fewer.` });

      validate(path.model, (ctx) =>
        ctx.value().trim().length === 0
          ? { kind: 'required', message: 'Model is required.' }
          : undefined,
      );
      maxLength(path.model, NAME_MAX, {
        message: `Model must be ${NAME_MAX} characters or fewer.`,
      });

      validate(path.vehicleType, (ctx) =>
        ctx.value() === null ? { kind: 'required', message: 'Choose a vehicle type.' } : undefined,
      );

      validate(path.isElectric, (ctx) =>
        ctx.value() && ctx.valueOf(path.vehicleType) === 'Heavy'
          ? { kind: 'heavy-electric', message: "Heavy vehicles can't be electric." }
          : undefined,
      );
    },
    {
      submission: {
        action: async () => {
          this.serverError.set(null);

          try {
            const response = await firstValueFrom(
              this.vehicleService.createVehicle(this.buildRequest()),
            );
            if (response.data) {
              this.added.emit(response.data);
            }
            return undefined;
          } catch (err) {
            return this.handleSubmitError(err);
          }
        },
      },
    },
  );

  protected readonly selectedType = computed(() => this.vehicle().vehicleType);
  protected readonly isElectric = computed(() => this.vehicle().isElectric);
  protected readonly isHeavy = computed(() => this.vehicle().vehicleType === 'Heavy');

  protected readonly plateError = computed(() => this.fieldError(this.vehicleForm.plate()));
  protected readonly makeError = computed(() => this.fieldError(this.vehicleForm.make()));
  protected readonly modelError = computed(() => this.fieldError(this.vehicleForm.model()));
  protected readonly typeError = computed(() =>
    this.submitAttempted() ? (this.vehicleForm.vehicleType().errors()[0]?.message ?? null) : null,
  );

  protected selectType(type: VehicleType): void {
    this.vehicle.update((v) => ({
      ...v,
      vehicleType: type,
      isElectric: type === 'Heavy' ? false : v.isElectric,
    }));
  }

  protected toggleElectric(): void {
    if (!this.isHeavy()) {
      this.vehicle.update((v) => ({ ...v, isElectric: !v.isElectric }));
    }
  }

  /** Roving tabindex: the checked pill is the tab stop, or the first pill when none is checked. */
  protected isTabStop(index: number): boolean {
    const selected = this.selectedType();
    return selected === null ? index === 0 : VEHICLE_TYPE_OPTIONS[index].value === selected;
  }

  protected onTypeKeydown(event: KeyboardEvent, index: number): void {
    let step = 0;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      step = 1;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      step = -1;
    }
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const count = VEHICLE_TYPE_OPTIONS.length;
    const next = (index + step + count) % count;
    this.selectType(VEHICLE_TYPE_OPTIONS[next].value);
    this.typeButtons()[next]?.nativeElement.focus();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  private fieldError(field: {
    touched(): boolean;
    invalid(): boolean;
    errors(): readonly { message?: string }[];
  }): string | null {
    return field.touched() && field.invalid() ? (field.errors()[0]?.message ?? null) : null;
  }

  private buildRequest(): CreateVehicleRequest {
    const value = this.vehicle();
    return {
      plateNumber: normalizePlate(value.plate),
      vehicleType: value.vehicleType!,
      make: value.make.trim(),
      model: value.model.trim(),
      isElectric: value.vehicleType === 'Heavy' ? false : value.isElectric,
    };
  }

  private handleSubmitError(err: unknown): ValidationError.WithOptionalFieldTree[] | undefined {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ApiResponse<unknown> | null;

      if (err.status === 401) {
        this.authService.clearSession();
        void this.router.navigateByUrl('/login');
        this.serverError.set('Your session has expired. Please log in again.');
        return undefined;
      }

      if (err.status === 409) {
        return [
          {
            fieldTree: this.vehicleForm.plate,
            kind: 'server',
            message: body?.message ?? 'A vehicle with this plate number is already registered.',
          },
        ];
      }

      if (err.status === 422) {
        const fieldErrors = body?.errors ? this.mapFieldErrors(body.errors) : [];
        if (fieldErrors.length > 0) {
          return fieldErrors;
        }
        this.serverError.set(body?.message ?? 'Validation failed. Please check the form and try again.');
        return undefined;
      }

      const message = backendMessage(err);
      this.serverError.set(
        err.status === 400 && message
          ? message
          : genericErrorMessage(err, message ?? "Couldn't add the vehicle. Please try again."),
      );
      return undefined;
    }

    this.serverError.set("Couldn't add the vehicle. Please try again.");
    return undefined;
  }

  private mapFieldErrors(errors: Record<string, string[]>): ValidationError.WithOptionalFieldTree[] {
    const mapped: ValidationError.WithOptionalFieldTree[] = [];

    for (const [key, messages] of Object.entries(errors)) {
      const fieldKey = SERVER_FIELD_KEYS[key.toLowerCase()];
      const message = messages?.[0];
      if (fieldKey && message) {
        mapped.push({ fieldTree: this.vehicleForm[fieldKey], kind: 'server', message });
      }
    }

    return mapped;
  }
}
