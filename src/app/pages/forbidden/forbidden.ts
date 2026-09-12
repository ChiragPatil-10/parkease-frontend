import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  imports: [RouterLink],
  template: `
    <div class="flex min-h-screen flex-col items-center justify-center gap-3 bg-surface px-6 text-center">
      <h1 class="text-2xl font-bold text-ink">403 — Access denied</h1>
      <p class="text-sm text-muted">You don't have permission to view this page.</p>
      <a routerLink="/" class="text-sm font-medium text-link">Back to home</a>
    </div>
  `,
})
export class Forbidden {}
