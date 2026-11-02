export const NOTIFICATION_API = {
  myHistory: '/api/v1/notifications/me',
} as const;

/** The API clamps pageSize to 1..50; always send 20. */
export const NOTIFICATIONS_PAGE_SIZE = 20;
