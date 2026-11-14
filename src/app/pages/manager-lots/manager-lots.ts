import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { ToastService } from '../../shared/components/toast/toast.service';
import { AuthService } from '../../services/auth.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { LotResponse } from '../../models/lot.model';
import { NETWORK_ERROR_MESSAGE, isNetworkError } from '../../shared/network-error';
import { LOT_STATE_LABEL, LotState, lotState } from './lot-state';

interface StatusMeta {
  label: string;
  dotClass: string;
  pillClass: string;
}

const STATUS_META: Record<LotState, StatusMeta> = {
  open: {
    label: LOT_STATE_LABEL.open,
    dotClass: 'bg-green-500',
    pillClass: 'bg-green-50 text-green-700',
  },
  closed: { label: LOT_STATE_LABEL.closed, dotClass: 'bg-muted', pillClass: 'bg-surface text-muted' },
  pending: {
    label: LOT_STATE_LABEL.pending,
    dotClass: 'bg-muted',
    pillClass: 'bg-surface text-muted',
  },
  rejected: {
    label: LOT_STATE_LABEL.rejected,
    dotClass: 'bg-red-700',
    pillClass: 'bg-red-50 text-red-700',
  },
};

const TOGGLE_ERROR = "Couldn't update the lot. Please try again.";

interface PendingClose {
  lot: LotResponse;
  opener: HTMLElement;
}

@Component({
  selector: 'app-manager-lots',
  imports: [ManagerNav, RouterLink, ConfirmDialog],
  templateUrl: './manager-lots.html',
  styleUrl: './manager-lots.css',
})
export class ManagerLots implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly lotService = inject(ParkingLotService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  protected readonly statusMeta = STATUS_META;
  protected readonly lots = signal<LotResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  /** A 429 with no lots on screen yet; the toast explains, the page offers Retry. */
  protected readonly rateLimited = signal(false);
  protected readonly redirectError = signal<string | null>(null);
  /** Id of the lot whose open/close call is running; its button is disabled meanwhile. */
  protected readonly togglingId = signal<string | null>(null);
  protected readonly pendingClose = signal<PendingClose | null>(null);
  protected readonly announcement = signal('');

  ngOnInit(): void {
    const incomingError = (history.state as { errorMessage?: unknown } | null)?.errorMessage;
    if (typeof incomingError === 'string' && incomingError) {
      this.redirectError.set(incomingError);
    }
    void this.loadLots();
  }

  protected async loadLots(): Promise<void> {
    const managerId = this.authService.getCurrentUser()?.userId;
    if (!managerId) {
      this.error.set("Couldn't load your lots. Please try again.");
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.rateLimited.set(false);

    try {
      const response = await firstValueFrom(this.lotService.getLotsByManager(managerId));
      this.lots.set(response.data ?? []);
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 429) {
        // Lots already on screen stay; with none yet the page offers a neutral Retry.
        this.rateLimited.set(this.lots().length === 0);
      } else {
        this.error.set(this.resolveErrorMessage(err));
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected statusFor(lot: LotResponse): LotState {
    return lotState(lot);
  }

  protected submittedTextFor(lot: LotResponse): string {
    return `Submitted ${this.formatRelativeTime(lot.createdAt)}`;
  }

  /** Feedback is shown only while the lot is Rejected; a resubmitted lot keeps the old text. */
  protected feedbackFor(lot: LotResponse): string | null {
    const text = lot.approvalFeedback?.trim();
    return lotState(lot) === 'rejected' && text ? text : null;
  }

  /** Closing asks first; opening goes straight through. */
  protected requestToggle(lot: LotResponse, event: Event): void {
    if (this.togglingId() !== null) {
      return;
    }
    if (lotState(lot) === 'open') {
      this.pendingClose.set({ lot, opener: event.currentTarget as HTMLElement });
      return;
    }
    void this.toggle(lot);
  }

  protected cancelClose(): void {
    this.pendingClose.set(null);
  }

  protected confirmClose(): void {
    const pending = this.pendingClose();
    if (!pending) {
      return;
    }
    this.pendingClose.set(null);
    void this.toggle(pending.lot);
  }

  private async toggle(lot: LotResponse): Promise<void> {
    if (this.togglingId() !== null) {
      return;
    }
    this.togglingId.set(lot.lotId);
    try {
      const response = await firstValueFrom(this.lotService.toggleOpen(lot.lotId));
      const updated = response.data;
      if (updated) {
        this.lots.update((list) =>
          list.map((item) => (item.lotId === updated.lotId ? updated : item)),
        );
        const text = `${updated.name} is now ${updated.isOpen ? 'open' : 'closed'}.`;
        this.toast.show(text);
        this.announcement.set(text);
      }
    } catch (err) {
      this.handleToggleError(err);
    } finally {
      this.togglingId.set(null);
    }
  }

  private handleToggleError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 429) {
        // The global toast explains.
        return;
      }
      if (err.status === 401) {
        this.authService.clearSession();
        void this.router.navigateByUrl('/login');
        return;
      }
      if (err.status === 409) {
        this.toast.show(this.envelopeMessage(err) ?? 'This lot cannot be opened yet.');
        void this.loadLots();
        return;
      }
    }
    this.toast.show(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : TOGGLE_ERROR);
  }

  private formatRelativeTime(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.round(diffMs / 60_000);

    if (minutes < 60) {
      return minutes <= 1 ? 'just now' : `${minutes} minutes ago`;
    }

    const hours = Math.round(minutes / 60);
    if (hours < 24) {
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    }

    const days = Math.round(hours / 24);
    return days === 1 ? '1 day ago' : `${days} days ago`;
  }

  private envelopeMessage(err: HttpErrorResponse): string | null {
    const body: unknown = err.error;
    if (
      body &&
      typeof body === 'object' &&
      'message' in body &&
      typeof (body as { message: unknown }).message === 'string'
    ) {
      return (body as { message: string }).message;
    }
    return null;
  }

  /**
   * GET /lots/manager/{managerId} uses ASP.NET's Forbid() directly for a mismatched id (per
   * parkinglot-service.md), so an error body here may not be the usual ApiResponse envelope -
   * don't assume err.error.message exists before falling back to a generic message.
   */
  private resolveErrorMessage(err: unknown): string {
    if (isNetworkError(err)) {
      return NETWORK_ERROR_MESSAGE;
    }
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) {
        this.authService.clearSession();
        void this.router.navigateByUrl('/login');
        return 'Your session has expired. Please log in again.';
      }

      const message = this.envelopeMessage(err);
      if (message) {
        return message;
      }
    }
    return "Couldn't load your lots. Please try again.";
  }
}
