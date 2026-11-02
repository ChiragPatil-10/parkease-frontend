import { formatNotificationFullTime, formatNotificationTime } from './notification-time';

const NOW = new Date(2026, 9, 24, 12, 0, 0);
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe('formatNotificationTime', () => {
  it('says "just now" under a minute, and for a future time', () => {
    expect(formatNotificationTime(ago(20_000), NOW)).toBe('just now');
    expect(formatNotificationTime(ago(-5_000), NOW)).toBe('just now');
  });

  it('uses minutes under an hour', () => {
    expect(formatNotificationTime(ago(60_000), NOW)).toBe('1 minute ago');
    expect(formatNotificationTime(ago(5 * 60_000), NOW)).toBe('5 minutes ago');
  });

  it('uses hours under 24 hours', () => {
    expect(formatNotificationTime(ago(3_600_000), NOW)).toBe('1 hour ago');
    expect(formatNotificationTime(ago(3 * 3_600_000), NOW)).toBe('3 hours ago');
    expect(formatNotificationTime(ago(23 * 3_600_000 + 59 * 60_000), NOW)).toBe('23 hours ago');
  });

  it('uses the booking date format from 24 hours on', () => {
    expect(formatNotificationTime(ago(7 * 86_400_000), NOW)).toMatch(
      /^Sat, 17 Oct, \d{1,2}:\d{2} (AM|PM)$/,
    );
  });

  it('returns an unparseable value unchanged', () => {
    expect(formatNotificationTime('nope', NOW)).toBe('nope');
  });
});

describe('formatNotificationFullTime', () => {
  it('always includes the weekday, date, year and time', () => {
    const iso = new Date(2026, 9, 24, 16, 30).toISOString();
    expect(formatNotificationFullTime(iso)).toBe('Sat, 24 Oct 2026, 4:30 PM');
  });
});
