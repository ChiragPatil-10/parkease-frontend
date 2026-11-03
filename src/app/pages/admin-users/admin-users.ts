import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { AdminNav } from '../../shared/components/admin-nav/admin-nav';
import { PaginationControls } from '../../shared/components/pagination-controls/pagination-controls';
import {
  UserActionKind,
  UserRow,
  formatJoinedDate,
  userActionFor,
  userStatusPill,
} from './admin-users-format';
import { MOCK_CURRENT_ADMIN_ID, MOCK_USERS } from './admin-users.mock';
import { UserConfirmDialog } from './user-confirm-dialog';

/** Phase 2 replaces this signal with real loading / error handling. */
export type UsersState = 'loaded' | 'loading' | 'empty' | 'error';

/** Phase 2 swaps this for the suspend / reactivate API call. A rejection's message is shown in the error banner. */
export type UserActionHandler = (kind: UserActionKind, user: UserRow) => Promise<void>;

export const USERS_PAGE_SIZE = 10;

interface PendingAction {
  kind: UserActionKind;
  user: UserRow;
  opener: HTMLElement | null;
}

@Component({
  selector: 'app-admin-users',
  imports: [AdminNav, PaginationControls, NgTemplateOutlet, UserConfirmDialog],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.css',
})
export class AdminUsers {
  /** Phase 2 replaces this with the loaded / loading / error result of the API call. */
  readonly state = signal<UsersState>('loaded');

  readonly users = signal<UserRow[]>(MOCK_USERS);
  readonly page = signal(1);
  readonly pageSize = USERS_PAGE_SIZE;
  readonly currentAdminId = MOCK_CURRENT_ADMIN_ID;

  readonly pending = signal<PendingAction | null>(null);
  readonly busyUserId = signal<string | null>(null);
  readonly busyKind = signal<UserActionKind | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);

  /** Mock action, always succeeds. Replaceable so the failure path can be exercised. */
  actionHandler: UserActionHandler = () => Promise.resolve();

  protected readonly skeletonRows = [0, 1, 2, 3];

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.users().length / this.pageSize)));

  readonly view = computed<UsersState>(() =>
    this.state() === 'loaded' && this.users().length === 0 ? 'empty' : this.state(),
  );

  readonly rows = computed(() => {
    const start = (this.page() - 1) * this.pageSize;
    return this.users()
      .slice(start, start + this.pageSize)
      .map((user) => ({
        user,
        pill: userStatusPill(user.status),
        joined: formatJoinedDate(user.createdAt),
        action: userActionFor(user, this.currentAdminId),
      }));
  });

  protected changePage(page: number): void {
    this.page.set(page);
    this.actionError.set(null);
    this.successMessage.set(null);
  }

  protected retry(): void {
    // Phase 2 reloads from the API here.
    this.state.set('loaded');
  }

  protected actionLabel(kind: UserActionKind, userId: string): string {
    const busy = this.busyUserId() === userId;
    if (kind === 'suspend') return busy ? 'Suspending...' : 'Suspend';
    return busy ? 'Reactivating...' : 'Reactivate';
  }

  protected requestAction(kind: UserActionKind, user: UserRow, event: Event): void {
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

  /** On success the row's status flips; on failure the message goes to the banner and the row stays as it was. */
  async runAction(kind: UserActionKind, user: UserRow): Promise<void> {
    this.busyUserId.set(user.userId);
    this.busyKind.set(kind);
    this.actionError.set(null);
    this.successMessage.set(null);

    try {
      await this.actionHandler(kind, user);
      const next =
        kind === 'suspend'
          ? { status: 'Suspended', isActive: false }
          : { status: 'Active', isActive: true };
      this.users.update((list) =>
        list.map((u) => (u.userId === user.userId ? { ...u, ...next } : u)),
      );
      this.successMessage.set(
        kind === 'suspend' ? `${user.fullName} suspended.` : `${user.fullName} reactivated.`,
      );
    } catch (error) {
      this.actionError.set(
        error instanceof Error && error.message
          ? error.message
          : 'Something went wrong. Please try again.',
      );
    } finally {
      this.busyUserId.set(null);
      this.busyKind.set(null);
    }
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
