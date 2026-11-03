import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiResponse } from '../../models/api-response.model';
import { UserSummaryDto } from '../../models/auth/user-summary.model';
import { AuthService } from '../../services/auth.service';
import { AdminNav } from '../../shared/components/admin-nav/admin-nav';
import { ConfirmDialog } from '../../shared/components/confirm-dialog/confirm-dialog';
import { PaginationControls } from '../../shared/components/pagination-controls/pagination-controls';
import { NETWORK_ERROR_MESSAGE, isNetworkError } from '../../shared/network-error';
import { UserActionKind, formatJoinedDate, userActionFor, userStatusPill } from './admin-users-format';

export type UsersState = 'loading' | 'loaded' | 'empty' | 'error';

export const USERS_PAGE_SIZE = 10;
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';
export const USER_GONE_MESSAGE = 'This user no longer exists.';

interface PendingAction {
  kind: UserActionKind;
  user: UserSummaryDto;
  opener: HTMLElement | null;
}

/** A positive whole number from the ?page= query, else 1. */
export function parsePageParam(value: string | null): number {
  if (value === null || !/^\d+$/.test(value.trim())) return 1;
  const page = Number.parseInt(value, 10);
  return page >= 1 ? page : 1;
}

@Component({
  selector: 'app-admin-users',
  imports: [AdminNav, PaginationControls, NgTemplateOutlet, ConfirmDialog],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
})
export class AdminUsers implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly state = signal<UsersState>('loading');
  /** Message for the page-level load banner; null with state 'error' means a 429 (the toast explains). */
  readonly loadError = signal<string | null>(null);

  readonly users = signal<UserSummaryDto[]>([]);
  readonly page = signal(1);
  readonly totalPages = signal(1);
  readonly pageSize = USERS_PAGE_SIZE;
  readonly currentAdminId = this.authService.getCurrentUser()?.userId ?? '';

  readonly pending = signal<PendingAction | null>(null);
  readonly busyUserId = signal<string | null>(null);
  readonly busyKind = signal<UserActionKind | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  protected readonly skeletonRows = [0, 1, 2, 3];
  private pageParamSeen = false;

  readonly rows = computed(() =>
    this.users().map((user) => ({
      user,
      pill: userStatusPill(user.status),
      joined: formatJoinedDate(user.createdAt),
      action: userActionFor(user, this.currentAdminId),
    })),
  );

  ngOnInit(): void {
    // ?page= is the source of truth on first load and on back / forward; invalid or missing means 1.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const page = parsePageParam(params.get('page'));
      if (!this.pageParamSeen || page !== this.page()) {
        this.pageParamSeen = true;
        this.page.set(page);
        void this.load(page);
      }
    });
  }

  /** `silent` reloads in place without swapping the table for the skeleton. */
  async load(page: number, silent = false): Promise<void> {
    if (!silent) {
      this.state.set('loading');
    }
    this.loadError.set(null);

    try {
      const response = await firstValueFrom(this.authService.getUsers(page, USERS_PAGE_SIZE));
      const data = response.data;
      if (!data || data.totalCount === 0) {
        this.users.set([]);
        this.totalPages.set(1);
        this.state.set('empty');
        return;
      }
      if (data.totalPages < page) {
        // Users were removed since this page was bookmarked: show the last one instead.
        this.setPage(data.totalPages);
        await this.load(data.totalPages, silent);
        return;
      }
      this.users.set(data.items);
      this.page.set(data.page);
      this.totalPages.set(Math.max(1, data.totalPages));
      this.state.set('loaded');
    } catch (err) {
      this.handleLoadError(err, silent);
    }
  }

  protected changePage(page: number): void {
    this.actionError.set(null);
    this.successMessage.set(null);
    this.setPage(page);
    this.page.set(page);
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

  protected actionLabel(kind: UserActionKind, userId: string): string {
    const busy = this.busyUserId() === userId;
    if (kind === 'suspend') return busy ? 'Suspending...' : 'Suspend';
    return busy ? 'Reactivating...' : 'Reactivate';
  }

  protected requestAction(kind: UserActionKind, user: UserSummaryDto, event: Event): void {
    if (this.busyUserId() !== null) return;
    this.pending.set({ kind, user, opener: event.currentTarget as HTMLElement });
  }

  protected cancelPending(): void {
    this.pending.set(null);
  }

  protected async confirmPending(): Promise<void> {
    const pending = this.pending();
    if (!pending) return;
    this.pending.set(null);
    await this.runAction(pending.kind, pending.user);
  }

  /** On success the row flips in place; on failure the row is left as it was. */
  async runAction(kind: UserActionKind, user: UserSummaryDto): Promise<void> {
    if (this.busyUserId() !== null) return;
    this.busyUserId.set(user.userId);
    this.busyKind.set(kind);
    this.actionError.set(null);
    this.successMessage.set(null);

    try {
      await firstValueFrom(
        kind === 'suspend'
          ? this.authService.suspendUser(user.userId)
          : this.authService.reactivateUser(user.userId),
      );
      const next =
        kind === 'suspend'
          ? { status: 'Suspended', isActive: false }
          : { status: 'Active', isActive: true };
      this.users.update((list) => list.map((u) => (u.userId === user.userId ? { ...u, ...next } : u)));
      this.successMessage.set(
        kind === 'suspend' ? `${user.fullName} suspended.` : `${user.fullName} reactivated.`,
      );
    } catch (err) {
      this.handleActionError(err);
    } finally {
      this.busyUserId.set(null);
      this.busyKind.set(null);
    }
  }

  private handleActionError(err: unknown): void {
    if (err instanceof HttpErrorResponse) {
      switch (err.status) {
        case 429:
          return; // the toast covers it
        case 401:
          this.authService.clearSession();
          void this.router.navigateByUrl('/login');
          return;
        case 403:
          void this.router.navigateByUrl('/403');
          return;
        case 404:
          this.actionError.set(USER_GONE_MESSAGE);
          void this.load(this.page(), true);
          return;
        case 409: {
          const body = err.error as ApiResponse<unknown> | null;
          this.actionError.set(body?.message || GENERIC_ERROR_MESSAGE);
          void this.load(this.page(), true);
          return;
        }
      }
    }
    this.actionError.set(GENERIC_ERROR_MESSAGE);
  }

  private handleLoadError(err: unknown, silent: boolean): void {
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
        this.state.set(this.users().length > 0 ? 'loaded' : 'error');
        return;
      }
    }
    if (silent && this.users().length > 0) {
      this.state.set('loaded');
      return;
    }
    this.fail(isNetworkError(err) ? NETWORK_ERROR_MESSAGE : GENERIC_ERROR_MESSAGE);
  }

  private fail(message: string): void {
    this.loadError.set(message);
    this.state.set('error');
  }

  protected dialogTitle(pending: PendingAction): string {
    return pending.kind === 'suspend'
      ? `Suspend ${pending.user.fullName}?`
      : `Reactivate ${pending.user.fullName}?`;
  }

  protected dialogMessage(pending: PendingAction): string {
    return pending.kind === 'suspend'
      ? "They won't be able to sign in again until you reactivate them."
      : 'They will be able to sign in again.';
  }
}
