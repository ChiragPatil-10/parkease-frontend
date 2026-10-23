import {
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';
import { AuthService } from '../../services/auth.service';
import { VehicleService } from '../../services/vehicle.service';
import { VehicleResponse } from '../../models/vehicle/vehicle.model';
import { AddVehicleModal } from './add-vehicle-modal/add-vehicle-modal';
import { DeleteVehicleDialog } from './delete-vehicle-dialog/delete-vehicle-dialog';
import { backendMessage, genericErrorMessage } from './vehicle-errors';
import { formatPlate, parseReturnTo, vehicleDetail, vehicleName } from './vehicle-format';

const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';
const DEFAULT_BOOKING_WARNING =
  'This vehicle has an upcoming booking. Deleting it will cancel that booking.';

@Component({
  selector: 'app-driver-my-vehicles',
  imports: [DriverNav, RouterLink, AddVehicleModal, DeleteVehicleDialog],
  templateUrl: './driver-my-vehicles.html',
  styleUrl: './driver-my-vehicles.css',
})
export class DriverMyVehicles implements OnInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly vehicleService = inject(VehicleService);
  private readonly injector = inject(Injector);

  private readonly addButton = viewChild<ElementRef<HTMLButtonElement>>('addButton');

  protected readonly formatPlate = formatPlate;
  protected readonly vehicleName = vehicleName;
  protected readonly vehicleDetail = vehicleDetail;

  /** Set only when the Lot Detail page sent the driver here with a valid `returnTo`. */
  protected readonly returnTo = parseReturnTo(history.state);

  protected readonly vehicles = signal<VehicleResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);

  protected readonly addOpen = signal(false);
  protected readonly addOpener = signal<HTMLElement | null>(null);
  protected readonly vehicleAdded = signal(false);

  protected readonly deleteTarget = signal<VehicleResponse | null>(null);
  protected readonly deleteOpener = signal<HTMLElement | null>(null);
  protected readonly deleteWarning = signal<string | null>(null);
  protected readonly deleteBusy = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  private loadRequestId = 0;

  ngOnInit(): void {
    void this.loadVehicles(true);
  }

  protected openAdd(event: Event): void {
    this.addOpener.set(event.currentTarget as HTMLElement);
    this.addOpen.set(true);
  }

  protected onVehicleAdded(): void {
    this.addOpen.set(false);
    this.vehicleAdded.set(true);
    void this.loadVehicles(false);
  }

  protected openDelete(event: Event, vehicle: VehicleResponse): void {
    this.deleteOpener.set(event.currentTarget as HTMLElement);
    this.resetDeleteState();
    this.deleteTarget.set(vehicle);
  }

  protected closeDelete(): void {
    this.deleteTarget.set(null);
    this.resetDeleteState();
  }

  /** First click deletes plainly; after a 409 the dialog is in warning mode and this forces it. */
  protected async confirmDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target || this.deleteBusy()) {
      return;
    }
    const confirm = this.deleteWarning() !== null;

    this.deleteBusy.set(true);
    this.deleteError.set(null);

    try {
      await firstValueFrom(this.vehicleService.deleteVehicle(target.vehicleId, confirm));
      this.removeDeleted(target);
    } catch (err) {
      if (this.deleteTarget()?.vehicleId !== target.vehicleId) {
        return;
      }
      if (err instanceof HttpErrorResponse && err.status === 404) {
        this.removeDeleted(target);
      } else if (err instanceof HttpErrorResponse && err.status === 409 && !confirm) {
        this.deleteWarning.set(backendMessage(err) ?? DEFAULT_BOOKING_WARNING);
      } else if (this.handleUnauthorized(err)) {
        this.deleteError.set(SESSION_EXPIRED_MESSAGE);
      } else {
        this.deleteError.set(
          genericErrorMessage(
            err,
            backendMessage(err) ?? "Couldn't delete this vehicle. Please try again.",
          ),
        );
      }
    } finally {
      this.deleteBusy.set(false);
    }
  }

  private removeDeleted(target: VehicleResponse): void {
    this.vehicles.update((list) => list.filter((v) => v.vehicleId !== target.vehicleId));
    this.closeDelete();
    // The Delete button that opened the dialog is gone, so hand focus to the page's primary action.
    afterNextRender(() => this.addButton()?.nativeElement.focus(), { injector: this.injector });
  }

  private resetDeleteState(): void {
    this.deleteWarning.set(null);
    this.deleteError.set(null);
    this.deleteBusy.set(false);
  }

  private async loadVehicles(showLoading: boolean): Promise<void> {
    const requestId = ++this.loadRequestId;
    this.loading.set(showLoading);
    this.loadError.set(null);

    try {
      const response = await firstValueFrom(this.vehicleService.getMyVehicles());
      if (requestId === this.loadRequestId) {
        this.vehicles.set(response.data ?? []);
      }
    } catch (err) {
      if (requestId === this.loadRequestId) {
        this.loadError.set(
          this.handleUnauthorized(err)
            ? SESSION_EXPIRED_MESSAGE
            : genericErrorMessage(err, "Couldn't load your vehicles. Please try again."),
        );
      }
    } finally {
      if (requestId === this.loadRequestId) {
        this.loading.set(false);
      }
    }
  }

  /** 401: clear the session and send the driver to /login. Returns whether it was a 401. */
  private handleUnauthorized(err: unknown): boolean {
    if (err instanceof HttpErrorResponse && err.status === 401) {
      this.authService.clearSession();
      void this.router.navigateByUrl('/login');
      return true;
    }
    return false;
  }
}
