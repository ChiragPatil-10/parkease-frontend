import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LoadRetry } from './load-retry';

@Component({
  imports: [LoadRetry],
  template: `<app-load-retry class="mt-6" [message]="message()" (retry)="retries.update((n) => n + 1)" />`,
})
class Host {
  readonly message = signal<string | null>(null);
  readonly retries = signal(0);
}

describe('LoadRetry', () => {
  function create() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    return { fixture, host: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the neutral block with the data-rate-limited hook when there is no message', () => {
    const { el } = create();
    const block = el.querySelector('[data-rate-limited]');
    expect(block?.textContent).toContain("Couldn't load this right now.");
    expect(block?.querySelector('button')?.textContent?.trim()).toBe('Retry');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows a red alert with the message and no rate-limit hook when a message is given', () => {
    const { fixture, host, el } = create();
    host.message.set("Couldn't load your lots.");
    fixture.detectChanges();

    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain("Couldn't load your lots.");
    expect(alert?.querySelector('button')?.textContent?.trim()).toBe('Retry');
    expect(el.querySelector('[data-rate-limited]')).toBeNull();
  });

  it('emits retry when Retry is pressed, in both variants', () => {
    const { fixture, host, el } = create();
    el.querySelector<HTMLButtonElement>('button')!.click();
    expect(host.retries()).toBe(1);

    host.message.set('Failed.');
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('button')!.click();
    expect(host.retries()).toBe(2);
  });

  it('keeps the class the parent puts on the host element', () => {
    const { el } = create();
    const host = el.querySelector('app-load-retry')!;
    expect(host.classList).toContain('mt-6');
    expect(host.classList).toContain('block');
  });

  it('makes the retry button keyboard focusable and labelled', () => {
    const { el } = create();
    const button = el.querySelector<HTMLButtonElement>('button')!;
    expect(button.type).toBe('button');
    expect(button.disabled).toBe(false);
  });
});
