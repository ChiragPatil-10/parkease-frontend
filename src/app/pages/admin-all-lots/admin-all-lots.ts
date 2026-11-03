import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { LotResponse } from '../../models/lot.model';
import { AuthService } from '../../services/auth.service';
import { ParkingLotService } from '../../services/parkinglot.service';
import { AdminNav } from '../../shared/components/admin-nav/admin-nav';
import { PaginationControls } from '../../shared/components/pagination-controls/pagination-controls';
import { NETWORK_ERROR_MESSAGE, isNetworkError } from '../../shared/network-error';
import { parsePageParam } from '../admin-users/admin-users';
import { capitalizeCity, lotStatusPill, managerLabel } from './admin-all-lots-format';

export type AllLotsState = 'loading' | 'loaded' | 'empty' | 'error';

export const ALL_LOTS_PAGE_SIZE = 10;
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

@Component({
  selector: 'app-admin-all-lots',
  imports: [AdminNav, PaginationControls, NgTemplateOutlet],
  templateUrl: './admin-all-lots.html',
  styleUrl: './admin-all-lots.css',
})
export class AdminAllLots implements OnInit {
  private readonly lotService = inject(ParkingLotService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<AllLotsState>('loading');
  /** Message for the load banner; null with state 'error' means a 429 (the toast explains). */
  readonly loadError = signal<string | null>(null);

  readonly lots = signal<LotResponse[]>([]);
  readonly totalCount = signal(0);
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly pageSize = ALL_LOTS_PAGE_SIZE;

  protected readonly skeletonRows = [0, 1, 2, 3];
  private pageParamSeen = false;

  readonly rows = computed(() =>
    this.lots().map((lot) => ({
      id: lot.lotId,
      name: lot.name,
      city: capitalizeCity(lot.city),
      manager: managerLabel(lot.managerName),
      spots: lot.totalSpots,
      pill: lotStatusPill(lot.approvalStatus, lot.isOpen),
    })),
  );

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const page = parsePageParam(params.get('page'));
      if (!this.pageParamSeen || page !== this.page()) {
        this.pageParamSeen = true;
        this.page.set(page);
        void this.load(page);
      }
    });
  }

  async load(page: number): Promise<void> {
    this.state.set('loading');
    this.loadError.set(null);

    try {
      const response = await firstValueFrom(this.lotService.getAllLots(page, ALL_LOTS_PAGE_SIZE));
      const data = response.data;
      if (!data || data.totalCount === 0) {
        this.lots.set([]);
        this.totalCount.set(0);
        this.totalPages.set(1);
        this.state.set('empty');
        return;
      }
      if (data.totalPages < page) {
        // Lots were removed since this page was bookmarked: show the last one instead.
        this.setPage(data.totalPages);
        await this.load(data.totalPages);
        return;
      }
      this.lots.set(data.items);
      this.totalCount.set(data.totalCount);
      this.page.set(data.page);
      this.totalPages.set(Math.max(1, data.totalPages));
      this.state.set('loaded');
    } catch (err) {
      this.handleLoadError(err);
    }
  }

  protected changePage(page: number): void {
    this.setPage(page);
    void this.load(page);
  }

  protected retry(): void {
    void this.load(this.page());
  }

  private setPage(page: number): void {
    this.page.set(page);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private handleLoadError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      if (err.status === 401) {
        this.authService.clearSession();
        void this.router.navigateByUrl('/login');
        this.fail('Your session has expired. Please log in again.');
        return;
      }
      if (err.status === 403) {
        void this.router.navigateByUrl('/403');
        this.fail('You do not have permission to view this page.');
        return;
      }
      if (err.status === 429) {
        // Keep whatever is on screen; the toast explains.
        this.state.set(this.lots().length > 0 ? 'loaded' : 'error');
        return;
      }
    }
    this.fail(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : GENERIC_ERROR_MESSAGE);
  }

  private fail(message: string): void {
    this.loadError.set(message);
    this.state.set('error');
  }
}
