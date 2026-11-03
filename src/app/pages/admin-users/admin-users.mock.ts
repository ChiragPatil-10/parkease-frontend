import { UserRow } from './admin-users-format';

/** Mock id of the signed-in admin (that row never gets an action). Phase 2 reads it from AuthService. */
export const MOCK_CURRENT_ADMIN_ID = 'u-admin-1';

const FIRST_NAMES = ['Meera', 'Rohan', 'Kavya', 'Imran', 'Sneha', 'Arjun', 'Divya', 'Nikhil', 'Farah', 'Vikram'];
const LAST_NAMES = ['Nair', 'Gupta', 'Iyer', 'Khan', 'Reddy', 'Menon', 'Joshi', 'Bose', 'Patel', 'Rao'];

/** The first rows come straight from the design; the rest are generated, newest first. */
const HAND_WRITTEN: UserRow[] = [
  {
    userId: 'u-1',
    fullName: 'Jordan Lee',
    email: 'jordan.lee@example.com',
    role: 'Driver',
    isActive: true,
    createdAt: '2026-06-12T09:30:00Z',
    status: 'Active',
  },
  {
    userId: 'u-2',
    fullName: 'Priya Shah',
    email: 'priya.shah@business.com',
    role: 'Manager',
    isActive: true,
    createdAt: '2026-03-03T09:30:00Z',
    status: 'Active',
  },
  {
    userId: 'u-3',
    fullName: 'Ankit Verma',
    email: 'ankit.v@example.com',
    role: 'Driver',
    isActive: false,
    createdAt: '2026-01-28T09:30:00Z',
    status: 'Suspended',
  },
  {
    userId: MOCK_CURRENT_ADMIN_ID,
    fullName: 'Asha Admin',
    email: 'asha.admin@parkease.example',
    role: 'Admin',
    isActive: true,
    createdAt: '2025-12-20T09:30:00Z',
    status: 'Active',
  },
  {
    userId: 'u-5',
    fullName: 'Chandrasekhara Venkataramanan Subramaniam',
    email: 'chandrasekhara.venkataramanan.subramaniam@a-very-long-company-domain-name.example.com',
    role: 'Manager',
    isActive: true,
    createdAt: '2025-12-02T09:30:00Z',
    status: 'Active',
  },
  {
    userId: 'u-6',
    fullName: 'Tara Mehta',
    email: 'tara.mehta@business.com',
    role: 'Manager',
    isActive: false,
    createdAt: '2025-11-18T09:30:00Z',
    status: 'PendingApproval',
  },
  {
    userId: 'u-7',
    fullName: 'Sameer Dutta',
    email: 'sameer.dutta@business.com',
    role: 'Manager',
    isActive: false,
    createdAt: '2025-11-05T09:30:00Z',
    status: 'Rejected',
  },
  {
    userId: 'u-8',
    fullName: 'Second Admin',
    email: 'second.admin@parkease.example',
    role: 'Admin',
    isActive: true,
    createdAt: '2025-10-22T09:30:00Z',
    status: 'Active',
  },
];

const GENERATED: UserRow[] = Array.from({ length: 22 }, (_, i) => {
  const n = i + HAND_WRITTEN.length + 1;
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  const last = LAST_NAMES[(i * 3) % LAST_NAMES.length];
  const suspended = i % 7 === 3;
  const manager = i % 6 === 2;
  const month = String(10 - Math.floor(i / 3)).padStart(2, '0');
  const day = String(27 - (i % 3) * 7).padStart(2, '0');
  return {
    userId: `u-${n}`,
    fullName: `${first} ${last}`,
    email: `${first}.${last}@example.com`.toLowerCase(),
    role: manager ? 'Manager' : 'Driver',
    isActive: !suspended,
    createdAt: `2025-${month}-${day}T09:30:00Z`,
    status: suspended ? 'Suspended' : 'Active',
  };
});

/** 30 users = 3 pages of 10. */
export const MOCK_USERS: UserRow[] = [...HAND_WRITTEN, ...GENERATED];
