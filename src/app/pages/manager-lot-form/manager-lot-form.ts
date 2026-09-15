import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';

interface LotFormValues {
  lotName: string;
  address: string;
  city: string;
  totalSpots: string;
  minPricePerHour: string;
  maxPricePerHour: string;
  openTime: string;
  closeTime: string;
  description: string;
}

const EMPTY_LOT: LotFormValues = {
  lotName: '',
  address: '',
  city: '',
  totalSpots: '',
  minPricePerHour: '',
  maxPricePerHour: '',
  openTime: '',
  closeTime: '',
  description: '',
};

const MOCK_EXISTING_LOT: LotFormValues = {
  lotName: 'Whitefield Central Lot',
  address: '2nd Cross, ITPL Main Rd',
  city: 'Bengaluru',
  totalSpots: '40',
  minPricePerHour: '30',
  maxPricePerHour: '25',
  openTime: '06:00 AM',
  closeTime: '11:00 PM',
  description: 'Covered multi-level lot near ITPL tech park, CCTV monitored.',
};

@Component({
  selector: 'app-manager-lot-form',
  imports: [ManagerNav, RouterLink, FormsModule],
  templateUrl: './manager-lot-form.html',
  styleUrl: './manager-lot-form.css',
})
export class ManagerLotForm {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly isEditMode = this.route.snapshot.paramMap.has('id');
  protected readonly heading = this.isEditMode ? 'Edit lot' : 'Add a new lot';

  protected readonly lot: LotFormValues = this.isEditMode
    ? { ...MOCK_EXISTING_LOT }
    : { ...EMPTY_LOT };

  protected onSave(): void {
    void this.router.navigateByUrl('/manager/lots');
  }
}
