import { Component } from '@angular/core';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';

type LotStatus = 'open' | 'closed' | 'awaiting-approval';

interface ManagerLotCard {
  id: string;
  name: string;
  status: LotStatus;
  address?: string;
  spotCount?: number;
  priceRangeText?: string;
  submittedText?: string;
}

interface StatusMeta {
  label: string;
  dotClass: string;
  pillClass: string;
}

const STATUS_META: Record<LotStatus, StatusMeta> = {
  open: { label: 'Open', dotClass: 'bg-green-500', pillClass: 'bg-green-50 text-green-700' },
  closed: { label: 'Closed', dotClass: 'bg-muted', pillClass: 'bg-surface text-muted' },
  'awaiting-approval': {
    label: 'Awaiting approval',
    dotClass: 'bg-muted',
    pillClass: 'bg-surface text-muted',
  },
};

const MOCK_LOTS: ManagerLotCard[] = [
  {
    id: 'lot-1',
    name: 'Whitefield Central Lot',
    status: 'open',
    address: '2nd Cross, ITPL Main Rd',
    spotCount: 40,
    priceRangeText: '₹30–₹50/hr',
  },
  {
    id: 'lot-2',
    name: 'Shah Annex Lot',
    status: 'closed',
    address: '5th Cross, HSR Layout',
    spotCount: 22,
    priceRangeText: '₹25–₹40/hr',
  },
  {
    id: 'lot-3',
    name: 'Shah Rooftop Deck',
    status: 'awaiting-approval',
    submittedText: 'Submitted 2 days ago',
  },
];

@Component({
  selector: 'app-manager-lots',
  imports: [ManagerNav],
  templateUrl: './manager-lots.html',
  styleUrl: './manager-lots.css',
})
export class ManagerLots {
  protected readonly lots = MOCK_LOTS;
  protected readonly statusMeta = STATUS_META;
}
