/** Email delivery result. The API also has "Pending" in its enum but never returns it. */
export type NotificationStatus = 'Sent' | 'Failed';

export interface NotificationResponse {
  id: string;
  recipientEmail: string;
  /** Plain string: new event types can appear, so the UI never branches on it. */
  eventType: string;
  title: string;
  /** Plain text, or null on rows created before messages existed. */
  message: string | null;
  /** The email subject. Never displayed. */
  subject: string;
  status: NotificationStatus;
  /** UTC ISO string. */
  sentAt: string;
  bookingId: string | null;
  /** Internal id; links use bookingId instead. */
  relatedEntityId: string;
}
