import { capitalizeCity, lotStatusPill, managerLabel } from './admin-all-lots-format';

describe('lotStatusPill', () => {
  it('Approved + open -> "Open · Approved" with a green dot', () => {
    expect(lotStatusPill('Approved', true)).toEqual({
      label: 'Open · Approved',
      dotClass: 'bg-green-700',
    });
  });

  it('Approved + closed -> "Closed · Approved" with a muted dot', () => {
    expect(lotStatusPill('Approved', false)).toEqual({
      label: 'Closed · Approved',
      dotClass: 'bg-muted',
    });
  });

  it('Pending -> "Pending approval" with a muted dot, whether open or not', () => {
    const expected = { label: 'Pending approval', dotClass: 'bg-muted' };
    expect(lotStatusPill('Pending', false)).toEqual(expected);
    expect(lotStatusPill('Pending', true)).toEqual(expected);
  });

  it('Rejected -> "Rejected" with a red dot, whether open or not', () => {
    const expected = { label: 'Rejected', dotClass: 'bg-red-700' };
    expect(lotStatusPill('Rejected', false)).toEqual(expected);
    expect(lotStatusPill('Rejected', true)).toEqual(expected);
  });

  it('shows an unknown value as raw text with the muted dot', () => {
    expect(lotStatusPill('Archived', true)).toEqual({ label: 'Archived', dotClass: 'bg-muted' });
  });
});

describe('capitalizeCity', () => {
  it('capitalises one and several words', () => {
    expect(capitalizeCity('bengaluru')).toBe('Bengaluru');
    expect(capitalizeCity('navi mumbai')).toBe('Navi Mumbai');
  });
});

describe('managerLabel', () => {
  it('falls back to "Unknown manager" for null or blank', () => {
    expect(managerLabel(null)).toBe('Unknown manager');
    expect(managerLabel('  ')).toBe('Unknown manager');
    expect(managerLabel('Priya Shah')).toBe('Priya Shah');
  });
});
