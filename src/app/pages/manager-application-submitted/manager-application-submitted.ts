import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApplicationStatus } from '../../models/auth/application-status.enum';

export interface ManagerApplicationSubmittedState {
  fullName: string;
  businessName: string;
  status: ApplicationStatus;
  applicationId: string;
}

const STATUS_DISPLAY: Record<ApplicationStatus, string> = {
  [ApplicationStatus.Pending]: 'Pending review',
  [ApplicationStatus.Approved]: 'Approved',
  [ApplicationStatus.Rejected]: 'Rejected',
};

@Component({
  selector: 'app-manager-application-submitted',
  imports: [RouterLink],
  templateUrl: './manager-application-submitted.html',
  styleUrl: './manager-application-submitted.css',
})
export class ManagerApplicationSubmitted {
  private readonly router = inject(Router);

  protected readonly application = signal<ManagerApplicationSubmittedState | null>(
    (this.router.getCurrentNavigation()?.extras.state as
      | ManagerApplicationSubmittedState
      | undefined) ?? null,
  );

  protected statusDisplay(status: ApplicationStatus): string {
    return STATUS_DISPLAY[status] ?? status;
  }
}
