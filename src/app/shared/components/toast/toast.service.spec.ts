import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TOAST_DURATION_MS, ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('starts hidden', () => {
    expect(service.visible()).toBe(false);
  });

  it('shows a message', () => {
    service.show('Hello');
    expect(service.visible()).toBe(true);
    expect(service.message()).toBe('Hello');
  });

  it('auto-dismisses after 6 seconds', () => {
    service.show('Hello');
    vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    expect(service.visible()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(service.visible()).toBe(false);
    expect(TOAST_DURATION_MS).toBe(6000);
  });

  it('replaces the message and restarts the timer', () => {
    service.show('First');
    vi.advanceTimersByTime(4000);
    service.show('Second');
    vi.advanceTimersByTime(4000);
    expect(service.visible()).toBe(true);
    expect(service.message()).toBe('Second');
    vi.advanceTimersByTime(2000);
    expect(service.visible()).toBe(false);
  });

  it('dismisses at once and clears the timer', () => {
    service.show('Hello');
    service.dismiss();
    expect(service.visible()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not let an old timer close a newer toast after a manual dismiss', () => {
    service.show('First');
    service.dismiss();
    service.show('Second');
    vi.advanceTimersByTime(5999);
    expect(service.visible()).toBe(true);
  });
});
