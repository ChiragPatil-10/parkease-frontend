import { lotApprovalSuffix } from './lot-approval-suffix';

describe('lotApprovalSuffix', () => {
  it.each([
    ['Approved', true, ''],
    ['Pending', false, ' (pending approval)'],
    ['Rejected', false, ' (not approved)'],
    ['approved', false, ''],
    ['PENDING', true, ' (pending approval)'],
    ['rEjEcTeD', false, ' (not approved)'],
  ])('approvalStatus %s (isApproved %s) gives "%s"', (approvalStatus, isApproved, expected) => {
    expect(lotApprovalSuffix({ approvalStatus, isApproved })).toBe(expected);
  });

  it('falls back to isApproved when approvalStatus is missing', () => {
    expect(lotApprovalSuffix({ isApproved: true })).toBe('');
    expect(lotApprovalSuffix({ isApproved: false })).toBe(' (pending approval)');
  });

  it.each([true, false])('falls back to isApproved=%s for an unknown value', (isApproved) => {
    expect(lotApprovalSuffix({ approvalStatus: 'Suspended', isApproved })).toBe(
      isApproved ? '' : ' (pending approval)',
    );
    expect(lotApprovalSuffix({ approvalStatus: '', isApproved })).toBe(
      isApproved ? '' : ' (pending approval)',
    );
  });
});
