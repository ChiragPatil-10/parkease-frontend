import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { AdminNav } from '../../shared/components/admin-nav/admin-nav';
import { PaginationControls } from '../../shared/components/pagination-controls/pagination-controls';
import { AdminLotRow, capitalizeCity, lotStatusPill, managerLabel } from './admin-all-lots-format';
import { MOCK_ALL_LOTS, MOCK_ALL_LOTS_TOTAL } from './admin-all-lots.mock';

/** Phase 2 replaces this signal with real loading / error handling. */
export type AllLotsState = 'loaded' | 'loading' | 'empty' | 'error';

export const ALL_LOTS_PAGE_SIZE = 10;

@Component({
  selector: 'app-admin-all-lots',
  imports: [AdminNav, PaginationControls, NgTemplateOutlet],
  templateUrl: './admin-all-lots.html',
  styleUrl: './admin-all-lots.css',
})
export class AdminAllLots {
  /** Phase 2 replaces this with the loaded / loading / error result of the API call. */
  readonly state = signal<AllLotsState>('loaded');

  readonly lots = signal<AdminLotRow[]>(MOCK_ALL_LOTS);
  /** Mock total; Phase 2 reads totalCount from the paged response. */
  readonly total = signal(MOCK_ALL_LOTS_TOTAL);
  readonly page = signal(1);
  readonly pageSize = ALL_LOTS_PAGE_SIZE;

  protected readonly skeletonRows = [0, 1, 2, 3];

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.lots().length / this.pageSize)));

  readonly view = computed<AllLotsState>(() =>
    this.state() === 'loaded' && this.lots().length === 0 ? 'empty' : this.state(),
  );

  readonly rows = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.lots()
      .slice(start, start + this.pageSize)
      .map((lot) => ({
        id: lot.lotId,
        name: lot.name,
        city: capitalizeCity(lot.city),
        manager: managerLabel(lot.managerName),
        spots: lot.totalSpots,
        pill: lotStatusPill(lot.approvalStatus, lot.isOpen),
      }));
  });

  protected changePage(page: number): void {
    this.page.set(page);
  }

  protected retry(): void {
    // Phase 2 reloads from the API here.
    this.state.set('loaded');
  }
}
