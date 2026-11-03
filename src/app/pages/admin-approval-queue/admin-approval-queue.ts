import { DOCUMENT } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { AdminNav } from '../../shared/components/admin-nav/admin-nav';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { PaginationControls } from '../../shared/components/pagination-controls/pagination-controls';
import { AuthService } from '../../services/auth.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { ApiResponse } from '../../models/api-response.model';
import { ManagerApplicationDto } from '../../models/auth/auth.model';
import { ApplicationStatus } from '../../models/auth/application-status.enum';
import { LotResponse } from '../../models/lot.model';
import { NETWORK_ERROR_MESSAGE, isNetworkError } from '../../shared/network-error';

type ApprovalSubTab = 'manager-applications' | 'lot-approvals';
type LotActionKind = 'approve' | 'reject';

const APPLICATIONS_PAGE_SIZE = 10;

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
/** Shown (and the list reloaded) when approve or reject finds the lot already handled (409). */
export const ALREADY_HANDLED_NOTICE = 'This lot was already handled. The list has been refreshed.';
/** Shown when approve or reject finds the lot gone (404). */
export const LOT_GONE_NOTICE = 'This lot no longer exists.';

export const APPROVAL_TABS: { id: ApprovalSubTab; label: string }[] = [
  { id: 'manager-applications', label: 'Manager applications' },
  { id: 'lot-approvals', label: 'Lot approvals' },
];

interface PendingReject {
  lot: LotResponse;
  opener: HTMLElement | null;
}

@Component({
  selector: 'app-admin-approval-queue',
  imports: [AdminNav, PaginationControls, ConfirmDialog],
  templateUrl: './admin-approval-queue.html',
  styleUrl: './admin-approval-queue.css',
})
export class AdminApprovalQueue implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly lotService = inject(ParkingLotService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);

  protected readonly tabs = APPROVAL_TABS;
  protected readonly subTab = signal<ApprovalSubTab>('manager-applications');
  /** The aria-live line: success messages and short notices (lot gone, already handled). */
  protected readonly successMessage = signal<string | null>(null);

  protected readonly applicationsPageSize = APPLICATIONS_PAGE_SIZE;
  protected readonly applications = signal<ManagerApplicationDto[]>([]);
  protected readonly applicationsPage = signal(1);
  protected readonly applicationsTotalPages = signal(1);
  protected readonly applicationsLoading = signal(false);
  protected readonly applicationsError = signal<string | null>(null);
  protected readonly actingApplicationId = signal<string | null>(null);

  /** The pending list is not paged: the server returns every pending lot, oldest first. */
  protected readonly lots = signal<LotResponse[]>([]);
  protected readonly lotsLoading = signal(false);
  protected readonly lotsError = signal<string | null>(null);
  /** True when lotsError came from loading the list, so the banner offers Retry. */
  protected readonly lotsRetryable = signal(false);
  protected readonly lotsLoaded = signal(false);
  protected readonly lotFeedbackDrafts = signal<Record<string, string>>({});
  /** Server message (400) shown under a card's textarea. */
  protected readonly lotFieldErrors = signal<Record<string, string>>({});
  protected readonly actingLotId = signal<string | null>(null);
  protected readonly actingKind = signal<LotActionKind | null>(null);
  protected readonly pendingReject = signal<PendingReject | null>(null);

  ngOnInit(): void {
    void this.loadApplications(1);

    // The admin nav links here with ?tab=..., so the URL decides which sub-tab shows.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const tab = params.get('tab');
      if ((tab === 'manager-applications' || tab === 'lot-approvals') && tab !== this.subTab()) {
        this.showSubTab(tab);
      }
    });
  }

  protected selectSubTab(tab: ApprovalSubTab): void {
    this.showSubTab(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      replaceUrl: true,
    });
  }

  /** Left and Right (and Home and End) move between the tabs and focus the new one. */
  protected onTabKeydown(event: KeyboardEvent): void {
    const index = this.tabs.findIndex((tab) => tab.id === this.subTab());
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % this.tabs.length;
        break;
      case 'ArrowLeft':
        next = (index - 1 + this.tabs.length) % this.tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = this.tabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const target = this.tabs[next];
    this.selectSubTab(target.id);
    this.document.getElementById(`approval-tab-${target.id}`)?.focus();
  }

  private showSubTab(tab: ApprovalSubTab): void {
    this.subTab.set(tab);
    this.successMessage.set(null);

    if (tab === 'lot-approvals' && !this.lotsLoaded()) {
      void this.loadPendingLots();
    }
  }

  // ---- Manager applications ----

  /** `keepError` reloads after a failed action without wiping the message that action just set. */
  protected async loadApplications(page: number, keepError = false): Promise<void> {
    this.applicationsLoading.set(true);
    if (!keepError) {
      this.applicationsError.set(null);
    }

    try {
      const response = await firstValueFrom(
        this.authService.getManagerApplications(page, APPLICATIONS_PAGE_SIZE, ApplicationStatus.Pending),
      );
      if (response.data) {
        this.applications.set(response.data.items);
        this.applicationsPage.set(response.data.page);
        this.applicationsTotalPages.set(response.data.totalPages);
      }
    } catch (err) {
      this.applicationsError.set(this.resolveErrorMessage(err));
    } finally {
      this.applicationsLoading.set(false);
    }
  }

  protected changeApplicationsPage(page: number): void {
    void this.loadApplications(page);
  }

  protected async approveApplication(applicationId: string): Promise<void> {
    await this.runApplicationAction(
      this.authService.approveManagerApplication(applicationId),
      applicationId,
      'Application approved.',
    );
  }

  protected async rejectApplication(applicationId: string): Promise<void> {
    await this.runApplicationAction(
      this.authService.rejectManagerApplication(applicationId),
      applicationId,
      'Application rejected.',
    );
  }

  private async runApplicationAction(
    request: Observable<ApiResponse<unknown>>,
    applicationId: string,
    successText: string,
  ): Promise<void> {
    if (this.actingApplicationId() !== null) {
      return;
    }
    this.actingApplicationId.set(applicationId);
    this.applicationsError.set(null);
    this.successMessage.set(null);

    try {
      await firstValueFrom(request);
      this.successMessage.set(successText);
      void this.loadApplications(this.applicationsPage());
    } catch (err) {
      this.applicationsError.set(this.resolveErrorMessage(err));
      // 404 and 409 mean the application is not what the list showed: refresh it.
      if (err instanceof HttpErrorResponse && (err.status === 404 || err.status === 409)) {
        void this.loadApplications(this.applicationsPage(), true);
      }
    } finally {
      this.actingApplicationId.set(null);
    }
  }

  // ---- Lot approvals ----

  /** `silent` reloads without swapping the list for the loading text (used after a 409). */
  protected async loadPendingLots(silent = false): Promise<void> {
    if (!silent) {
      this.lotsLoading.set(true);
    }
    this.lotsError.set(null);
    this.lotsRetryable.set(false);

    try {
      const response = await firstValueFrom(this.lotService.getPendingLots());
      this.lots.set(response.data ?? []);
      this.lotsLoaded.set(true);
    } catch (err) {
      const message = this.resolveErrorMessage(err);
      this.lotsError.set(message);
      this.lotsRetryable.set(message !== null);
    } finally {
      this.lotsLoading.set(false);
    }
  }

  protected updateLotFeedback(lotId: string, value: string): void {
    this.lotFeedbackDrafts.update((current) => ({ ...current, [lotId]: value }));
  }

  protected managerNameFor(lot: LotResponse): string {
    return lot.managerName?.trim() ? lot.managerName : 'Unknown manager';
  }

  protected submittedTextFor(lot: LotResponse): string {
    return `Submitted ${this.formatRelativeTime(lot.createdAt)}`;
  }

  protected lotActionLabel(lotId: string, kind: LotActionKind): string {
    const busy = this.actingLotId() === lotId && this.actingKind() === kind;
    if (kind === 'approve') return busy ? 'Approving...' : 'Approve';
    return busy ? 'Rejecting...' : 'Reject';
  }

  protected async approveLot(lotId: string): Promise<void> {
    const lot = this.lots().find((l) => l.lotId === lotId);
    if (lot) {
      await this.runLotAction(lot, 'approve');
    }
  }

  protected requestReject(lot: LotResponse, event: Event): void {
    if (this.actingLotId() !== null) {
      return;
    }
    this.pendingReject.set({ lot, opener: event.currentTarget as HTMLElement });
  }

  protected cancelReject(): void {
    this.pendingReject.set(null);
  }

  protected async confirmReject(): Promise<void> {
    const pending = this.pendingReject();
    if (!pending) {
      return;
    }
    this.pendingReject.set(null);
    await this.runLotAction(pending.lot, 'reject');
  }

  private async runLotAction(lot: LotResponse, kind: LotActionKind): Promise<void> {
    if (this.actingLotId() !== null) {
      return;
    }
    this.actingLotId.set(lot.lotId);
    this.actingKind.set(kind);
    this.lotsError.set(null);
    this.lotsRetryable.set(false);
    this.successMessage.set(null);
    this.clearLotFieldError(lot.lotId);

    try {
      const request =
        kind === 'approve'
          ? this.lotService.approveLot(lot.lotId)
          : this.lotService.rejectLot(lot.lotId, this.lotFeedbackDrafts()[lot.lotId]);
      await firstValueFrom(request);
      this.removeLot(lot.lotId);
      this.successMessage.set(`${lot.name} ${kind === 'approve' ? 'approved' : 'rejected'}.`);
    } catch (err) {
      this.handleLotActionError(err, lot, kind);
    } finally {
      this.actingLotId.set(null);
      this.actingKind.set(null);
    }
  }

  private handleLotActionError(err: unknown, lot: LotResponse, kind: LotActionKind): void {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 404) {
        this.removeLot(lot.lotId);
        this.successMessage.set(LOT_GONE_NOTICE);
        return;
      }
      if (err.status === 409) {
        this.handleLotConflict(lot.lotId);
        return;
      }
      if (err.status === 400 && kind === 'reject') {
        const body = err.error as ApiResponse<unknown> | null;
        this.lotFieldErrors.update((current) => ({
          ...current,
          [lot.lotId]: body?.message || GENERIC_ERROR_MESSAGE,
        }));
        return;
      }
    }
    this.lotsError.set(this.resolveErrorMessage(err, true));
  }

  /** Another admin already handled this lot: drop the card, say so, and reload the pending list. */
  protected handleLotConflict(lotId: string): void {
    this.removeLot(lotId);
    this.successMessage.set(ALREADY_HANDLED_NOTICE);
    void this.loadPendingLots(true);
  }

  private removeLot(lotId: string): void {
    this.lots.update((current) => current.filter((lot) => lot.lotId !== lotId));
    this.lotFeedbackDrafts.update((current) => {
      const rest = { ...current };
      delete rest[lotId];
      return rest;
    });
    this.clearLotFieldError(lotId);
  }

  private clearLotFieldError(lotId: string): void {
    if (!(lotId in this.lotFieldErrors())) {
      return;
    }
    this.lotFieldErrors.update((current) => {
      const rest = { ...current };
      delete rest[lotId];
      return rest;
    });
  }

  protected appliedTextFor(application: ManagerApplicationDto): string {
    return `Applied ${this.formatRelativeTime(application.createdAt)}`;
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
   * 401 and 403 arrive with an empty body, so they are decided by status code only. A 429 returns
   * null: the global toast tells the user, so the page shows no banner. For an `action`, a network
   * failure or 5xx gives the generic message and never a server message.
   */
  private resolveErrorMessage(err: unknown, action = false): string | null {
    if (err instanceof HttpErrorResponse && err.status === 429) {
      return null;
    }
    if (isNetworkError(err)) {
      return action ? GENERIC_ERROR_MESSAGE : NETWORK_ERROR_MESSAGE;
    }
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) {
        this.authService.clearSession();
        void this.router.navigateByUrl('/login');
        return 'Your session has expired. Please log in again.';
      }
      if (err.status === 403) {
        void this.router.navigateByUrl('/403');
        return 'You do not have permission to perform this action.';
      }
      if (err.status >= 500) {
        return GENERIC_ERROR_MESSAGE;
      }

      const body = err.error as ApiResponse<unknown> | null;
      if (body?.message) {
        return body.message;
      }
      if (err.status === 404) {
        return 'That item could not be found. It may have already been removed.';
      }
      if (err.status === 409) {
        return 'This item has already been processed.';
      }
    }
    return GENERIC_ERROR_MESSAGE;
  }
}
