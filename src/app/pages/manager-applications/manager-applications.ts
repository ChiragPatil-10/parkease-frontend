import { Component } from '@angular/core';
import { ManagerNav } from '../../shared/components/manager-nav/manager-nav';

@Component({
  selector: 'app-manager-applications',
  imports: [ManagerNav],
  template: `<app-manager-nav activeTab="applications" />
    <p class="p-8 text-center text-muted">Applications — coming soon.</p>`,
})
export class ManagerApplications {}
