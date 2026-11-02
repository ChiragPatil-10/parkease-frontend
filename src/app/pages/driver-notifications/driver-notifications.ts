import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';
import { NotificationRow, NotificationStatus, mockNotifications } from './notification-mock';
import { formatNotificationFullTime, formatNotificationTime } from './notification-time';

export type NotificationsState = 'loaded' | 'loading' | 'empty' | 'error';

const DOT_CLASS: Record<NotificationStatus, string> = {
  Sent: 'bg-green-700',
  Failed: 'bg-red-700',
  Pending: 'bg-muted',
};

const STATUS_CLASS: Record<NotificationStatus, string> = {
  Sent: 'text-green-700',
  Failed: 'text-red-700',
  Pending: 'text-muted',
};

const STATUS_TEXT: Record<NotificationStatus, string> = {
  Sent: 'Sent',
  Failed: 'Failed to deliver',
  Pending: 'Pending',
};

@Component({
  selector: 'app-driver-notifications',
  imports: [DriverNav, RouterLink],
  templateUrl: './driver-notifications.html',
  styleUrl: './driver-notifications.css',
})
export class DriverNotifications {
  /** Phase 1: fixed 'loaded'. Phase 2 replaces this with real fetching. */
  readonly state = signal<NotificationsState>('loaded');
  /** True when a full page came back, so more may exist. */
  readonly hasMore = signal(true);
  readonly loadingMore = signal(false);

  readonly skeletonRows = [1, 2, 3, 4];

  private readonly now = new Date();
  readonly rows = signal<NotificationRow[]>(mockNotifications(this.now));

  protected readonly dotClass = DOT_CLASS;
  protected readonly statusClass = STATUS_CLASS;
  protected readonly statusText = STATUS_TEXT;

  protected timeText(row: NotificationRow): string {
    return formatNotificationTime(row.sentAt, this.now);
  }

  protected fullTime(row: NotificationRow): string {
    return formatNotificationFullTime(row.sentAt);
  }
}
