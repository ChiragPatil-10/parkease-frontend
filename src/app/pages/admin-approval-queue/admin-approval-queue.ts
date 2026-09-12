import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { AdminNav } from '../../shared/components/admin-nav/admin-nav';
import { PaginationControls } from '../../shared/components/pagination-controls/pagination-controls';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { AuthService } from '../../services/auth.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { ApiResponse } from '../../models/api-response.model';
import { ManagerApplicationDto } from '../../models/auth/auth.model';
import { ApplicationStatus } from '../../models/auth/application-status.enum';
import { LotResponse } from '../../models/lot.model';

type ApprovalSubTab = 'manager-applications' | 'lot-approvals';

const APPLICATIONS_PAGE_SIZE = 10;
const LOTS_PAGE_SIZE = 10;

@Component({
  selector: 'app-admin-approval-queue',
  imports: [AdminNav, PaginationControls, PaginatePipe],
  templateUrl: './admin-approval-queue.html',
  styleUrl: './admin-approval-queue.css',
})
export class AdminApprovalQueue implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly lotService = inject(ParkingLotService);
  private readonly router = inject(Router);

  protected readonly subTab = signal<ApprovalSubTab>('manager-applications');
  protected readonly successMessage = signal<string | null>(null);

  protected readonly applicationsPageSize = APPLICATIONS_PAGE_SIZE;
  protected readonly applications = signal<ManagerApplicationDto[]>([]);
  protected readonly applicationsPage = signal(1);
  protected readonly applicationsTotalPages = signal(1);
  protected readonly applicationsLoading = signal(false);
  protected readonly applicationsError = signal<string | null>(null);
  protected readonly actingApplicationId = signal<string | null>(null);

  protected readonly lotsPageSize = LOTS_PAGE_SIZE;
  protected readonly lots = signal<LotResponse[]>([]);
  protected readonly managerNames = signal<Record<string, string>>({});
  protected readonly lotsLoading = signal(false);
  protected readonly lotsError = signal<string | null>(null);
  protected readonly lotsLoaded = signal(false);
  protected readonly lotPage = signal(1);
  protected readonly lotFeedbackDrafts = signal<Record<string, string>>({});
  protected readonly actingLotId = signal<string | null>(null);

  protected readonly lotTotalPages = computed(() =>
    Math.max(1, Math.ceil(this.lots().length / LOTS_PAGE_SIZE)),
  );

  ngOnInit(): void {
    void this.loadApplications(1);
  }

  protected selectSubTab(tab: ApprovalSubTab): void {
    this.subTab.set(tab);
    this.successMessage.set(null);

    if (tab === 'lot-approvals' && !this.lotsLoaded()) {
      void this.loadPendingLots();
    }
  }

  // ---- Manager applications ----

  protected async loadApplications(page: number): Promise<void> {
    this.applicationsLoading.set(true);
    this.applicationsError.set(null);

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
    this.actingApplicationId.set(applicationId);
    this.applicationsError.set(null);
    this.successMessage.set(null);

    try {
      await firstValueFrom(request);
      this.successMessage.set(successText);
      void this.loadApplications(this.applicationsPage());
    } catch (err) {
      this.applicationsError.set(this.resolveErrorMessage(err));
    } finally {
      this.actingApplicationId.set(null);
    }
  }

  // ---- Lot approvals ----

  protected async loadPendingLots(): Promise<void> {
    this.lotsLoading.set(true);
    this.lotsError.set(null);

    try {
      const response = await firstValueFrom(this.lotService.getPendingLots());
      const lots = response.data ?? [];
      this.lots.set(lots);
      this.lotPage.set(1);
      this.lotsLoaded.set(true);
      await this.resolveManagerNames(lots);
    } catch (err) {
      this.lotsError.set(this.resolveErrorMessage(err));
    } finally {
      this.lotsLoading.set(false);
    }
  }

  protected changeLotPage(page: number): void {
    this.lotPage.set(page);
  }

  protected updateLotFeedback(lotId: string, value: string): void {
    this.lotFeedbackDrafts.update((current) => ({ ...current, [lotId]: value }));
  }

  protected async approveLot(lotId: string): Promise<void> {
    this.actingLotId.set(lotId);
    this.lotsError.set(null);
    this.successMessage.set(null);

    try {
      await firstValueFrom(this.lotService.approveLot(lotId, this.lotFeedbackDrafts()[lotId]));
      this.successMessage.set('Lot approved.');
      this.lotFeedbackDrafts.update((current) => {
        const rest = { ...current };
        delete rest[lotId];
        return rest;
      });
      await this.loadPendingLots();
    } catch (err) {
      this.lotsError.set(this.resolveErrorMessage(err));
    } finally {
      this.actingLotId.set(null);
    }
  }

  protected managerNameFor(lot: LotResponse): string {
    return this.managerNames()[lot.managerId] ?? 'Loading manager…';
  }

  protected submittedTextFor(lot: LotResponse): string {
    return `Submitted ${this.formatRelativeTime(lot.createdAt)}`;
  }

  protected appliedTextFor(application: ManagerApplicationDto): string {
    return `Applied ${this.formatRelativeTime(application.createdAt)}`;
  }

  private async resolveManagerNames(lots: LotResponse[]): Promise<void> {
    const known = this.managerNames();
    const missingIds = [...new Set(lots.map((lot) => lot.managerId))].filter((id) => !(id in known));

    if (missingIds.length === 0) {
      return;
    }

    const results = await Promise.all(
      missingIds.map(async (id) => {
        try {
          const response = await firstValueFrom(this.authService.getUserById(id));
          return [id, response.data?.fullName ?? 'Unknown manager'] as const;
        } catch {
          return [id, 'Unknown manager'] as const;
        }
      }),
    );

    this.managerNames.update((current) => ({
      ...current,
      ...Object.fromEntries(results),
    }));
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
   * [Authorize(Roles = "Admin")] failures aren't documented in the ApiResponse envelope shape
   * (auth.md/parkinglot-service.md only confirm this for a couple of ownership-check routes), so
   * treat 401 as an expired session and 403 as a role mismatch defensively rather than assume a
   * JSON body is present.
   */
  private resolveErrorMessage(err: unknown): string {
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
    return 'Something went wrong. Please try again.';
  }
}
