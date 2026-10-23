import { Component, ElementRef, computed, input, output, signal, viewChildren } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { DialogBehavior } from '../dialog-behavior.directive';

type VehicleTypeValue = 'TwoWheeler' | 'FourWheeler' | 'Heavy';

interface VehicleTypeOption {
  label: string;
  value: VehicleTypeValue;
}

const VEHICLE_TYPE_OPTIONS: VehicleTypeOption[] = [
  { label: 'Two Wheeler', value: 'TwoWheeler' },
  { label: 'Four Wheeler', value: 'FourWheeler' },
  { label: 'Heavy', value: 'Heavy' },
];

@Component({
  selector: 'app-add-vehicle-modal',
  imports: [DialogBehavior, FormField],
  templateUrl: './add-vehicle-modal.html',
})
export class AddVehicleModal {
  /** Message shown under the plate field (red state). Wired in Phase 2. */
  readonly plateError = input<string | null>(null);

  readonly closed = output<void>();

  protected readonly vehicleTypeOptions = VEHICLE_TYPE_OPTIONS;
  private readonly typeButtons = viewChildren<ElementRef<HTMLButtonElement>>('typeOption');

  private readonly vehicle = signal<{
    plate: string;
    vehicleType: VehicleTypeValue | null;
    make: string;
    model: string;
    isElectric: boolean;
  }>({ plate: '', vehicleType: null, make: '', model: '', isElectric: false });

  protected readonly vehicleForm = form(this.vehicle);

  protected readonly selectedType = computed(() => this.vehicle().vehicleType);
  protected readonly isElectric = computed(() => this.vehicle().isElectric);
  protected readonly isHeavy = computed(() => this.vehicle().vehicleType === 'Heavy');

  protected selectType(type: VehicleTypeValue): void {
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
}
