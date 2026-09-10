import { Component, signal } from '@angular/core';
import { AdminNav } from '../../shared/components/admin-nav/admin-nav';

type ApprovalSubTab = 'manager-applications' | 'lot-approvals';

interface ManagerApplicationCard {
  id: string;
  fullName: string;
  businessName: string;
  address: string;
  appliedText: string;
  email: string;
}

const MOCK_APPLICATIONS: ManagerApplicationCard[] = [
  {
    id: 'app-1',
    fullName: 'Priya Shah',
    businessName: 'Shah Parking Services',
    address: '4th Block, Koramangala',
    appliedText: 'Applied 2 days ago',
    email: 'priya.shah@business.com',
  },
  {
    id: 'app-2',
    fullName: 'Ravi Kumar',
    businessName: 'Kumar Auto Parking',
    address: 'HSR Layout Sector 3',
    appliedText: 'Applied 5 hours ago',
    email: 'ravi.kumar@business.com',
  },
  {
    id: 'app-3',
    fullName: 'Anita Desai',
    businessName: 'Desai Mall Parking Pvt Ltd',
    address: 'Indiranagar 100ft Rd',
    appliedText: 'Applied 1 week ago',
    email: 'anita.desai@business.com',
  },
];

@Component({
  selector: 'app-admin-approval-queue',
  imports: [AdminNav],
  templateUrl: './admin-approval-queue.html',
  styleUrl: './admin-approval-queue.css',
})
export class AdminApprovalQueue {
  protected readonly subTab = signal<ApprovalSubTab>('manager-applications');
  protected readonly applications = MOCK_APPLICATIONS;

  protected selectSubTab(tab: ApprovalSubTab): void {
    this.subTab.set(tab);
  }
}
