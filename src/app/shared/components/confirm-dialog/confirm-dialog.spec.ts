import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ConfirmDialog } from './confirm-dialog';

describe('ConfirmDialog', () => {
  function create(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(ConfirmDialog);
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    return fixture;
  }

  it('shows the title, message and labels, and is a modal dialog', () => {
    const el = create({
      title: 'Reject Lot A?',
      message: 'The manager will see your feedback.',
      confirmLabel: 'Reject',
    }).nativeElement as HTMLElement;
    const dialog = el.querySelector('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Reject Lot A?');
    expect(dialog.textContent).toContain('The manager will see your feedback.');
    expect(Array.from(dialog.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual([
      'Cancel',
      'Reject',
    ]);
  });

  it('emits closed on Cancel and confirmed on the confirm button', () => {
    const fixture = create({ title: 'T', confirmLabel: 'Go' });
    const closed = vi.fn();
    const confirmed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.componentInstance.confirmed.subscribe(confirmed);
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    buttons[0].click();
    buttons[1].click();
    expect(closed).toHaveBeenCalledTimes(1);
    expect(confirmed).toHaveBeenCalledTimes(1);
  });

  it('uses red for destructive and accent otherwise', () => {
    const red = create({ title: 'T', confirmLabel: 'Go', destructive: true }).nativeElement as HTMLElement;
    expect(red.querySelectorAll('button')[1].className).toContain('bg-red-700');
    const accent = create({ title: 'T', confirmLabel: 'Go' }).nativeElement as HTMLElement;
    expect(accent.querySelectorAll('button')[1].className).toContain('bg-accent');
  });
});
