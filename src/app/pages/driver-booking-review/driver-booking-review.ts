import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { BookingService } from '../../services/booking.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { PaymentService } from '../../services/payment.service';
import { RazorpayLoader } from '../../services/razorpay-loader.service';
import { SpotService } from '../../services/spot.service';
import { VehicleService } from '../../services/vehicle.service';
import { BookingResponse } from '../../models/booking.model';
import { LotResponse } from '../../models/lot.model';
import { SpotResponse } from '../../models/spot.model';
import { VehicleResponse } from '../../models/vehicle/vehicle.model';
import { formatStartTime } from '../driver-lot-detail/driver-lot-detail';
import { formatPlate } from '../driver-my-vehicles/vehicle-format';
import {
  computeAmount,
  formatDuration,
  parseHours,
  toBookingStartTime,
} from './booking-review-format';

type View = 'loading' | 'bad-link' | 'spot-taken' | 'load-error' | 'ready';
type Notice = 'payment-failed' | 'dismissed' | 'error' | 'timeout';

interface BookingDetail {
  label: string;
  value: string;
  mono?: boolean;
}

const PAYMENT_POLL_INTERVAL_MS = 1000;
const PAYMENT_POLL_WINDOW_SECONDS = 15;
const BOOKING_POLL_INTERVAL_MS = 2000;
const CREATE_RETRY_DELAY_MS = 1000;
const CREATE_MAX_RETRIES = 3;

const PROCESSING_MESSAGE = /already being processed/i;

function isHttpStatus(err: unknown, ...statuses: number[]): boolean {
  return err instanceof HttpErrorResponse && statuses.includes(err.status);
}

function isStillProcessing(err: unknown): boolean {
  return (
    err instanceof HttpErrorResponse &&
    err.status === 409 &&
    PROCESSING_MESSAGE.test(err.error?.message ?? '')
  );
}

@Component({
  selector: 'app-driver-booking-review',
  imports: [RouterLink],
  templateUrl: './driver-booking-review.html',
  styleUrl: './driver-booking-review.css',
})
export class DriverBookingReview implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly authService = inject(AuthService);
  private readonly lotService = inject(ParkingLotService);
  private readonly spotService = inject(SpotService);
  private readonly vehicleService = inject(VehicleService);
  private readonly bookingService = inject(BookingService);
  private readonly paymentService = inject(PaymentService);
  private readonly razorpay = inject(RazorpayLoader);

  private readonly payButton = viewChild<ElementRef<HTMLButtonElement>>('payButton');

  /** One key per page visit, reused on every retry so the backend never creates a second booking. */
  private readonly idempotencyKey = crypto.randomUUID();

  protected readonly lotId = signal('');
  protected readonly view = signal<View>('loading');
  protected readonly lot = signal<LotResponse | null>(null);
  protected readonly spot = signal<SpotResponse | null>(null);
  protected readonly vehicle = signal<VehicleResponse | null>(null);
  protected readonly hours = signal(1);
  protected readonly startTimeLabel = signal('');

  protected readonly booking = signal<BookingResponse | null>(null);
  protected readonly orderId = signal<string | null>(null);
  protected readonly running = signal(false);
  protected readonly notice = signal<Notice | null>(null);

  protected readonly paymentsConfigured = this.razorpay.keyId !== '';

  protected readonly amount = computed(() => {
    const spot = this.spot();
    return spot ? computeAmount(spot.pricePerHour, this.hours()) : 0;
  });

  protected readonly details = computed<BookingDetail[]>(() => {
    const lot = this.lot();
    const spot = this.spot();
    const vehicle = this.vehicle();
    if (!lot || !spot || !vehicle) {
      return [];
    }
    return [
      { label: 'Lot', value: lot.name },
      { label: 'Spot', value: `${spot.spotNumber} · ${spot.spotType}`, mono: true },
      { label: 'Vehicle', value: formatPlate(vehicle.plateNumber) },
      { label: 'Start time', value: this.startTimeLabel() },
      { label: 'Duration', value: formatDuration(this.hours()) },
    ];
  });

  /** Payment failed without an order has nothing to retry, so Pay stays off and the banner links back. */
  protected readonly payDisabled = computed(
    () =>
      this.running() ||
      !this.paymentsConfigured ||
      (this.notice() === 'payment-failed' && this.orderId() === null),
  );

  private pollSession = 0;
  private destroyed = false;
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  ngOnInit(): void {
    const lotId = this.route.snapshot.paramMap.get('lotId') ?? '';
    this.lotId.set(lotId);
    const query = this.route.snapshot.queryParamMap;
    const spotId = query.get('spotId');
    const vehicleId = query.get('vehicleId');
    const hours = parseHours(query.get('hours'));

    if (!lotId || !spotId || !vehicleId || hours === null) {
      this.view.set('bad-link');
      return;
    }
    this.hours.set(hours);
    void this.load(lotId, spotId, vehicleId);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.pollSession++;
    this.timers.forEach((id) => clearTimeout(id));
    this.timers.clear();
  }

  protected retryLoad(): void {
    this.ngOnInit();
  }

  /** Continues the pay flow from wherever it stopped: create, wait for the order, then open Razorpay. */
  protected async pay(): Promise<void> {
    if (this.running() || this.view() !== 'ready' || !this.paymentsConfigured) {
      return;
    }
    const spot = this.spot();
    const lot = this.lot();
    const vehicle = this.vehicle();
    if (!spot || !lot || !vehicle) {
      return;
    }

    this.running.set(true);
    this.notice.set(null);

    try {
      let booking = this.booking();
      if (!booking) {
        booking = await this.createBooking(spot, lot, vehicle);
        if (!booking) {
          return;
        }
      }
      if (this.orderId() === null && !(await this.waitForOrder(booking.bookingId))) {
        return;
      }
      await this.openCheckout(booking.bookingId);
    } catch (err) {
      this.handleError(err);
    }
  }

  private async load(lotId: string, spotId: string, vehicleId: string): Promise<void> {
    this.view.set('loading');
    this.startTimeLabel.set(formatStartTime(new Date()));
    try {
      const [lotRes, spotRes, vehiclesRes] = await Promise.all([
        firstValueFrom(this.lotService.getLotById(lotId)),
        firstValueFrom(this.spotService.getSpotById(spotId)),
        firstValueFrom(this.vehicleService.getMyVehicles()),
      ]);
      const lot = lotRes.data;
      const spot = spotRes.data;
      const vehicle = (vehiclesRes.data ?? []).find((v) => v.vehicleId === vehicleId);
      if (!lot || !spot || !vehicle || !vehicle.isActive || spot.lotId !== lot.lotId) {
        this.view.set('bad-link');
        return;
      }
      this.lot.set(lot);
      this.spot.set(spot);
      this.vehicle.set(vehicle);
      this.view.set(spot.status === 'Available' ? 'ready' : 'spot-taken');
    } catch (err) {
      if (isHttpStatus(err, 400, 404)) {
        this.view.set('bad-link');
      } else {
        this.expireSessionIfUnauthorised(err);
        this.view.set('load-error');
      }
    }
  }

  private async createBooking(
    spot: SpotResponse,
    lot: LotResponse,
    vehicle: VehicleResponse,
  ): Promise<BookingResponse | null> {
    const request = {
      lotId: lot.lotId,
      spotId: spot.spotId,
      vehicleId: vehicle.vehicleId,
      startTime: toBookingStartTime(new Date()),
      totalAmount: this.amount(),
      idempotencyKey: this.idempotencyKey,
    };

    for (let attempt = 0; ; attempt++) {
      try {
        const response = await firstValueFrom(this.bookingService.createBooking(request));
        if (!response.data) {
          throw new Error('Booking response had no data.');
        }
        this.booking.set(response.data);
        return response.data;
      } catch (err) {
        if (!isStillProcessing(err) || attempt >= CREATE_MAX_RETRIES) {
          throw err;
        }
        await this.sleep(CREATE_RETRY_DELAY_MS);
        if (this.destroyed) {
          return null;
        }
      }
    }
  }

  /** Polls payment (1s, up to 15s) and booking (2s) together. Resolves true only when an order is ready. */
  private async waitForOrder(bookingId: string): Promise<boolean> {
    const session = ++this.pollSession;
    const alive = () => !this.destroyed && session === this.pollSession;
    void this.watchBooking(bookingId, alive);

    for (let second = 0; second <= PAYMENT_POLL_WINDOW_SECONDS; second++) {
      if (second > 0) {
        await this.sleep(PAYMENT_POLL_INTERVAL_MS);
      }
      if (!alive()) {
        return false;
      }
      try {
        const payment = (await firstValueFrom(this.paymentService.getPaymentByBooking(bookingId)))
          .data;
        if (!alive()) {
          return false;
        }
        if (payment?.status === 'Failed') {
          this.pollSession++;
          this.finish('payment-failed');
          return false;
        }
        // A non-Failed payment without an order id is still being set up: keep polling like a 404.
        if (payment?.gatewayOrderId) {
          this.pollSession++;
          this.orderId.set(payment.gatewayOrderId);
          return true;
        }
      } catch (err) {
        if (!alive()) {
          return false;
        }
        if (!isHttpStatus(err, 404)) {
          this.pollSession++;
          throw err;
        }
      }
    }

    this.pollSession++;
    this.finish('timeout');
    return false;
  }

  /** A Cancelled booking means the saga released the spot; stop everything and show "spot taken". */
  private async watchBooking(bookingId: string, alive: () => boolean): Promise<void> {
    while (alive()) {
      await this.sleep(BOOKING_POLL_INTERVAL_MS);
      if (!alive()) {
        return;
      }
      try {
        const booking = (await firstValueFrom(this.bookingService.getBookingById(bookingId))).data;
        if (alive() && booking?.status === 'Cancelled') {
          this.pollSession++;
          this.running.set(false);
          this.view.set('spot-taken');
          return;
        }
      } catch {
        // A failed status check is not fatal; the next tick tries again.
      }
    }
  }

  private async openCheckout(bookingId: string): Promise<void> {
    const orderId = this.orderId();
    if (orderId === null) {
      return;
    }
    const Razorpay = await this.razorpay.load();
    if (this.destroyed) {
      return;
    }
    let completed = false;
    const checkout = new Razorpay({
      key: this.razorpay.keyId,
      order_id: orderId,
      name: 'ParkEase',
      notes: { bookingId },
      prefill: {},
      // Page 16 reads the booking id from the URL and refetches. The signature is not checked on the client.
      handler: () => {
        completed = true;
        this.running.set(false);
        this.router
          .navigate(['/bookings', bookingId, 'payment'], { replaceUrl: true })
          .catch(() => undefined);
      },
      modal: {
        ondismiss: () => {
          if (!completed && this.notice() !== 'payment-failed') {
            this.finish('dismissed');
          }
        },
      },
    });
    checkout.on('payment.failed', () => {
      if (!completed) {
        this.finish('payment-failed');
      }
    });
    checkout.open();
  }

  private finish(notice: Notice): void {
    this.running.set(false);
    this.notice.set(notice);
    if (notice === 'dismissed' || notice === 'payment-failed') {
      afterNextRender(() => this.payButton()?.nativeElement.focus(), { injector: this.injector });
    }
  }

  private handleError(err: unknown): void {
    this.expireSessionIfUnauthorised(err);
    this.finish('error');
  }

  private expireSessionIfUnauthorised(err: unknown): void {
    if (isHttpStatus(err, 401)) {
      this.authService.clearSession();
      void this.router.navigateByUrl('/login');
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const id = setTimeout(() => {
        this.timers.delete(id);
        resolve();
      }, ms);
      this.timers.add(id);
    });
  }
}
