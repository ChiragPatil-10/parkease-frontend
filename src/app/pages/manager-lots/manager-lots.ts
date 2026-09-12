import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';
import { AuthService } from '../../services/auth.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { LotResponse } from '../../models/lot.model';

type LotStatus = 'open' | 'closed' | 'awaiting-approval';

interface StatusMeta {
  label: string;
  dotClass: string;
  pillClass: string;
}

const STATUS_META: Record<LotStatus, StatusMeta> = {
  open: { label: 'Open', dotClass: 'bg-green-500', pillClass: 'bg-green-50 text-green-700' },
  closed: { label: 'Closed', dotClass: 'bg-muted', pillClass: 'bg-surface text-muted' },
  'awaiting-approval': {
    label: 'Awaiting approval',
    dotClass: 'bg-muted',
    pillClass: 'bg-surface text-muted',
  },
};

@Component({
  selector: 'app-manager-lots',
  imports: [ManagerNav, RouterLink],
  templateUrl: './manager-lots.html',
  styleUrl: './manager-lots.css',
})
export class ManagerLots implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly lotService = inject(ParkingLotService);
  private readonly router = inject(Router);

  protected readonly statusMeta = STATUS_META;
  protected readonly lots = signal<LotResponse[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
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

    try {
      const response = await firstValueFrom(this.lotService.getLotsByManager(managerId));
      this.lots.set(response.data ?? []);
    } catch (err) {
      this.error.set(this.resolveErrorMessage(err));
    } finally {
      this.loading.set(false);
    }
  }

  protected statusFor(lot: LotResponse): LotStatus {
    if (!lot.isApproved) {
      return 'awaiting-approval';
    }
    return lot.isOpen ? 'open' : 'closed';
  }

  protected submittedTextFor(lot: LotResponse): string {
    return `Submitted ${this.formatRelativeTime(lot.createdAt)}`;
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

  /**
   * GET /lots/manager/{managerId} uses ASP.NET's Forbid() directly for a mismatched id (per
   * parkinglot-service.md), so an error body here may not be the usual ApiResponse envelope —
   * don't assume err.error.message exists before falling back to a generic message.
   */
  private resolveErrorMessage(err: unknown): string {
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
    return "Couldn't load your lots. Please try again.";
  }
}
