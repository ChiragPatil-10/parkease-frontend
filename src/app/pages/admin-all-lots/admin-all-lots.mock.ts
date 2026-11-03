import { AdminLotRow } from './admin-all-lots-format';

/** The first rows come straight from the design. */
const HAND_WRITTEN: AdminLotRow[] = [
  {
    lotId: 'l-1',
    name: 'Whitefield Central Lot',
    address: 'ITPL Main Road, Whitefield',
    city: 'bengaluru',
    totalSpots: 40,
    minPricePerHour: 30,
    maxPricePerHour: 60,
    isOpen: true,
    approvalStatus: 'Approved',
    managerName: 'Priya Shah',
    createdAt: '2026-10-30T09:30:00Z',
  },
  {
    lotId: 'l-2',
    name: 'Kumar Auto Parking',
    address: 'HSR Layout Sector 2',
    city: 'bengaluru',
    totalSpots: 30,
    minPricePerHour: 20,
    maxPricePerHour: 40,
    isOpen: true,
    approvalStatus: 'Approved',
    managerName: 'Ravi Kumar',
    createdAt: '2026-10-28T09:30:00Z',
  },
  {
    lotId: 'l-3',
    name: 'Shah Rooftop Deck',
    address: 'Koramangala 6th Block',
    city: 'bengaluru',
    totalSpots: 18,
    minPricePerHour: 35,
    maxPricePerHour: 55,
    isOpen: false,
    approvalStatus: 'Pending',
    managerName: 'Priya Shah',
    createdAt: '2026-10-26T09:30:00Z',
  },
  {
    lotId: 'l-4',
    name: 'Old Airport Road Basement With A Very Long Descriptive Name For Wrapping',
    address: 'Old Airport Road, Murugeshpalya',
    city: 'bengaluru',
    totalSpots: 120,
    minPricePerHour: 25,
    maxPricePerHour: 45,
    isOpen: false,
    approvalStatus: 'Approved',
    managerName: null,
    createdAt: '2026-10-24T09:30:00Z',
  },
  {
    lotId: 'l-5',
    name: 'Station Road Yard',
    address: 'Station Road',
    city: 'navi mumbai',
    totalSpots: 12,
    minPricePerHour: 15,
    maxPricePerHour: 25,
    isOpen: false,
    approvalStatus: 'Rejected',
    managerName: 'Ravi Kumar',
    createdAt: '2026-10-22T09:30:00Z',
  },
];

const CITIES = ['bengaluru', 'mumbai', 'pune', 'chennai', 'hyderabad'];
const AREAS = ['Indiranagar', 'Koramangala', 'Andheri', 'Hinjewadi', 'Adyar', 'Gachibowli', 'Jayanagar'];
const MANAGERS = ['Priya Shah', 'Ravi Kumar', 'Neha Kapoor', null, 'Sanjay Rao'];
const STATUSES: [string, boolean][] = [
  ['Approved', true],
  ['Approved', true],
  ['Approved', false],
  ['Pending', false],
  ['Rejected', false],
];

const GENERATED: AdminLotRow[] = Array.from({ length: 47 - HAND_WRITTEN.length }, (_, i) => {
  const n = i + HAND_WRITTEN.length + 1;
  const [approvalStatus, isOpen] = STATUSES[i % STATUSES.length];
  const month = String(10 - Math.floor(i / 10)).padStart(2, '0');
  const day = String(20 - (i % 10)).padStart(2, '0');
  return {
    lotId: `l-${n}`,
    name: `${AREAS[i % AREAS.length]} Lot ${n}`,
    address: `${n} ${AREAS[(i + 2) % AREAS.length]} Main Road`,
    city: CITIES[i % CITIES.length],
    totalSpots: 10 + ((i * 7) % 60),
    minPricePerHour: 20,
    maxPricePerHour: 50,
    isOpen,
    approvalStatus,
    managerName: MANAGERS[i % MANAGERS.length],
    createdAt: `2026-${month}-${day}T09:30:00Z`,
  };
});

/** 47 lots = 5 pages of 10, newest first. Phase 2 takes the total from the API's totalCount. */
export const MOCK_ALL_LOTS: AdminLotRow[] = [...HAND_WRITTEN, ...GENERATED];
export const MOCK_ALL_LOTS_TOTAL = MOCK_ALL_LOTS.length;
