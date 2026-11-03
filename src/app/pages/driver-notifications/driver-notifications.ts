import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { NOTIFICATIONS_PAGE_SIZE } from '../../constants/notification.constants';
import { NotificationResponse } from '../../models/notification.model';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';
import { formatNotificationFullTime, formatNotificationTime } from './notification-time';

export type NotificationsState = 'loaded' | 'loading' | 'empty' | 'error' | 'rate-limited';

function isHttpStatus(err: unknown, ...statuses: number[]): boolean {
  return err instanceof HttpErrorResponse && statuses.includes(err.status);
}

/** What a row shows. Anything the API sends other than Sent or Failed reads as Pending. */
type DisplayStatus = 'Sent' | 'Failed' | 'Pending';

interface NotificationView {
  id: string;
  title: string;
  message: string | null;
  status: DisplayStatus;
  sentAt: string;
  time: string | null;
  fullTime: string | null;
  bookingId: string | null;
}

const DOT_CLASS: Record<DisplayStatus, string> = {
  Sent: 'bg-green-700',
  Failed: 'bg-red-700',
  Pending: 'bg-muted',
};

const STATUS_CLASS: Record<DisplayStatus, string> = {
  Sent: 'text-green-700',
  Failed: 'text-red-700',
  Pending: 'text-muted',
};

const STATUS_TEXT: Record<DisplayStatus, string> = {
  Sent: 'Sent',
  Failed: 'Failed to deliver',
  Pending: 'Pending',
};

function displayStatus(status: string): DisplayStatus {
  return status === 'Sent' || status === 'Failed' ? status : 'Pending';
}

function isValidDate(iso: string): boolean {
  return typeof iso === 'string' && !Number.isNaN(new Date(iso).getTime());
}

@Component({
  selector: 'app-driver-notifications',
  imports: [DriverNav, RouterLink],
  templateUrl: './driver-notifications.html',
  styleUrl: './driver-notifications.css',
})
export class DriverNotifications implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly state = signal<NotificationsState>('loading');
  /** True when the last page came back full, so another may exist. */
  readonly hasMore = signal(false);
  readonly loadingMore = signal(false);
  readonly moreError = signal(false);

  readonly skeletonRows = [1, 2, 3, 4];

  private readonly items = signal<NotificationResponse[]>([]);
  private page = 1;
  private inflight: Subscription | null = null;
  private readonly now = new Date();

  protected readonly rows = computed<NotificationView[]>(() =>
    this.items().map((n) => {
      const valid = isValidDate(n.sentAt);
      return {
        id: n.id,
        title: n.title?.trim() || 'Notification',
        message: n.message || null,
        status: displayStatus(n.status),
        sentAt: n.sentAt,
        time: valid ? formatNotificationTime(n.sentAt, this.now) : null,
        fullTime: valid ? formatNotificationFullTime(n.sentAt) : null,
        bookingId: typeof n.bookingId === 'string' && n.bookingId.trim() ? n.bookingId : null,
      };
    }),
  );

  protected readonly dotClass = DOT_CLASS;
  protected readonly statusClass = STATUS_CLASS;
  protected readonly statusText = STATUS_TEXT;

  constructor() {
    // A late response must never update a destroyed page.
    inject(DestroyRef).onDestroy(() => this.inflight?.unsubscribe());
  }

  ngOnInit(): void {
    this.load();
  }

  /** Page 1; used on init and by Retry. Ignored while a request is in flight. */
  protected load(): void {
    if (this.inflight) return;
    this.page = 1;
    this.state.set('loading');
    this.hasMore.set(false);
    this.moreError.set(false);
    this.items.set([]);

    const request = this.notificationService.getMyNotifications(1, NOTIFICATIONS_PAGE_SIZE);
    this.inflight = request.subscribe({
      next: (res) => {
        this.inflight = null;
        const list = res.data ?? [];
        this.items.set(list);
        this.hasMore.set(list.length === NOTIFICATIONS_PAGE_SIZE);
        this.state.set(list.length > 0 ? 'loaded' : 'empty');
      },
      error: (err: unknown) => {
        this.inflight = null;
        if (this.expireIfUnauthorized(err)) return;
        // A 429 is explained by the toast; with nothing loaded yet the page offers a neutral retry.
        this.state.set(isHttpStatus(err, 429) ? 'rate-limited' : 'error');
      },
    });
  }

  /** Next page, appended. Ignored while any request is in flight (the gateway rate-limits per user). */
  protected showMore(): void {
    if (this.inflight || !this.hasMore()) return;
    this.moreError.set(false);
    this.loadingMore.set(true);

    const next = this.page + 1;
    const request = this.notificationService.getMyNotifications(next, NOTIFICATIONS_PAGE_SIZE);
    this.inflight = request.subscribe({
      next: (res) => {
        this.inflight = null;
        const list = res.data ?? [];
        this.page = next;
        // A row that arrived between requests shifts the pages, so the same id can come back.
        const known = new Set(this.items().map((n) => n.id));
        this.items.update((current) => [...current, ...list.filter((n) => !known.has(n.id))]);
        this.hasMore.set(list.length === NOTIFICATIONS_PAGE_SIZE);
        this.loadingMore.set(false);
      },
      error: (err: unknown) => {
        this.inflight = null;
        this.loadingMore.set(false);
        if (this.expireIfUnauthorized(err)) return;
        // The rows already on screen stay; the button retries the same page. A 429 adds no message.
        if (isHttpStatus(err, 429)) return;
        this.moreError.set(true);
      },
    });
  }

  private expireIfUnauthorized(err: unknown): boolean {
    if (!(err instanceof HttpErrorResponse && err.status === 401)) return false;
    this.authService.clearSession();
    void this.router.navigateByUrl('/login');
    return true;
  }
}
