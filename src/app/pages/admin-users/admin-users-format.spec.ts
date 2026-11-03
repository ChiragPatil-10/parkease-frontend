import { UserRow, formatJoinedDate, userActionFor, userStatusPill } from './admin-users-format';

function user(over: Partial<UserRow>): UserRow {
  return {
    userId: 'u-1',
    fullName: 'Test',
    email: 't@example.com',
    role: 'Driver',
    isActive: true,
    createdAt: '2026-06-12T09:30:00Z',
    status: 'Active',
    ...over,
  };
}

describe('formatJoinedDate', () => {
  it('formats a date like "12 Jun 2026"', () => {
    expect(formatJoinedDate('2026-06-12T09:30:00Z')).toBe('12 Jun 2026');
  });

  it('zero-pads the day', () => {
    expect(formatJoinedDate('2026-03-03T09:30:00Z')).toBe('03 Mar 2026');
  });

  it('returns an unparseable value as is', () => {
    expect(formatJoinedDate('not a date')).toBe('not a date');
  });
});

describe('userStatusPill', () => {
  it('maps every known status', () => {
    expect(userStatusPill('Active')).toEqual({ label: 'Active', dotClass: 'bg-green-700' });
    expect(userStatusPill('Suspended')).toEqual({ label: 'Suspended', dotClass: 'bg-red-700' });
    expect(userStatusPill('PendingApproval')).toEqual({
      label: 'Pending approval',
      dotClass: 'bg-muted',
    });
    expect(userStatusPill('Rejected')).toEqual({ label: 'Rejected', dotClass: 'bg-red-700' });
  });

  it('shows an unknown status as raw text with the muted dot', () => {
    expect(userStatusPill('Banned')).toEqual({ label: 'Banned', dotClass: 'bg-muted' });
  });
});

describe('userActionFor', () => {
  it('offers Suspend for active users and Reactivate for suspended users', () => {
    expect(userActionFor(user({ status: 'Active' }), 'me')).toBe('suspend');
    expect(userActionFor(user({ status: 'Suspended' }), 'me')).toBe('reactivate');
  });

  it('offers nothing for admins, the signed-in admin, pending and rejected rows or unknown status', () => {
    expect(userActionFor(user({ role: 'Admin' }), 'me')).toBeNull();
    expect(userActionFor(user({ role: 'Admin', status: 'Suspended' }), 'me')).toBeNull();
    expect(userActionFor(user({ userId: 'me' }), 'me')).toBeNull();
    expect(userActionFor(user({ status: 'PendingApproval' }), 'me')).toBeNull();
    expect(userActionFor(user({ status: 'Rejected' }), 'me')).toBeNull();
    expect(userActionFor(user({ status: 'Banned' }), 'me')).toBeNull();
  });
});
