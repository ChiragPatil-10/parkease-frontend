import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DriverNav } from '../../shared/components/driver-nav/driver-nav';

type MyBookingsView = 'list' | 'empty';
type PillTone = 'blue' | 'green' | 'grey' | 'red';
type ActionKind = 'primary' | 'danger' | 'neutral';

interface SampleAction {
  label: string;
  kind: ActionKind;
}

interface SampleBooking {
  spot: string;
  lotName: string;
  startTime: string;
  plate: string;
  status: string;
  tone: PillTone;
  actions: SampleAction[];
}

const VIEWS: readonly MyBookingsView[] = ['list', 'empty'];

const PILL_CLASSES: Record<PillTone, { pill: string; dot: string }> = {
  blue: { pill: 'bg-link/10 text-link', dot: 'bg-link' },
  green: { pill: 'bg-green-50 text-green-700', dot: 'bg-green-700' },
  grey: { pill: 'bg-surface text-muted', dot: 'bg-muted' },
  red: { pill: 'bg-red-50 text-red-700', dot: 'bg-red-700' },
};

const ACTION_CLASSES: Record<ActionKind, string> = {
  primary:
    'bg-accent font-semibold text-ink hover:bg-accent-hover focus-visible:outline-ink',
  danger:
    'border border-red-700 bg-card text-red-700 hover:bg-red-50 focus-visible:outline-red-700',
  neutral:
    'border border-border bg-card text-ink hover:bg-surface focus-visible:outline-ink',
};

const SAMPLE_BOOKINGS: SampleBooking[] = [
  {
    spot: 'A-02',
    lotName: 'Whitefield Central Lot',
    startTime: 'Today, 4:30 PM',
    plate: 'KA-05 MJ 4471',
    status: 'Confirmed',
    tone: 'blue',
    actions: [
      { label: 'Check in', kind: 'primary' },
      { label: 'Cancel', kind: 'danger' },
    ],
  },
  {
    spot: 'B-14',
    lotName: 'Marathahalli Tower Park',
    startTime: 'Yesterday, 2:00 PM',
    plate: 'KA-05 MJ 4471',
    status: 'Checked in',
    tone: 'green',
    actions: [{ label: 'Check out', kind: 'primary' }],
  },
  {
    spot: 'C-07',
    lotName: 'Brookefield Mall Deck',
    startTime: 'Mon, 26 Oct, 10:15 AM',
    plate: 'KA-01 AB 9922',
    status: 'Pending',
    tone: 'grey',
    actions: [{ label: 'Cancel', kind: 'danger' }],
  },
  {
    spot: 'A-11',
    lotName: 'Whitefield Central Lot',
    startTime: 'Mon, 19 Oct, 4:30 PM',
    plate: 'KA-05 MJ 4471',
    status: 'Cancelled — payment timed out',
    tone: 'red',
    actions: [{ label: 'Book again', kind: 'neutral' }],
  },
  {
    spot: 'D-03',
    lotName: 'Koramangala Signature Lot',
    startTime: 'Mon, 12 Oct, 11:00 AM',
    plate: 'KA-05 MJ 4471',
    status: 'Completed',
    tone: 'grey',
    actions: [{ label: 'View receipt', kind: 'neutral' }],
  },
];

@Component({
  selector: 'app-driver-my-bookings',
  imports: [DriverNav, RouterLink],
  templateUrl: './driver-my-bookings.html',
  styleUrl: './driver-my-bookings.css',
})
export class DriverMyBookings {
  private readonly route = inject(ActivatedRoute);

  // TODO(phase 2): replace with real bookings
  protected readonly view = toSignal(
    this.route.queryParamMap.pipe(
      map((params): MyBookingsView => {
        const state = params.get('state') as MyBookingsView;
        return VIEWS.includes(state) ? state : 'list';
      }),
    ),
    { initialValue: 'list' as MyBookingsView },
  );

  protected readonly bookings = SAMPLE_BOOKINGS;
  protected readonly pill = PILL_CLASSES;
  protected readonly actionClasses = ACTION_CLASSES;
}
