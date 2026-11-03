import { TestBed } from '@angular/core/testing';
import { GENERAL_RATE_LIMIT_MESSAGE, LOGIN_RATE_LIMIT_MESSAGE } from './toast.constants';
import { Toast } from './toast';

describe('Toast', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Toast] }).compileComponents();
  });

  function create(message: string, visible: boolean) {
    const fixture = TestBed.createComponent(Toast);
    fixture.componentRef.setInput('message', message);
    fixture.componentRef.setInput('visible', visible);
    fixture.detectChanges();
    return fixture;
  }

  it('is a polite status live region even while hidden', () => {
    const fixture = create('Hello', false);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.getAttribute('role')).toBe('status');
    expect(host.getAttribute('aria-live')).toBe('polite');
    expect(host.querySelector('[data-toast]')).toBeNull();
  });

  it('shows the message when visible', () => {
    const fixture = create(LOGIN_RATE_LIMIT_MESSAGE, true);
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('[data-toast]')?.textContent).toContain(
      'Too many login attempts \u2014 try again in a minute.',
    );
  });

  it('uses ink background, card text and an accent dot', () => {
    const el = create('Hi', true).nativeElement as HTMLElement;
    const box = el.querySelector('[data-toast]') as HTMLElement;

    expect(box.classList.contains('bg-ink')).toBe(true);
    expect(box.classList.contains('text-card')).toBe(true);
    expect(box.querySelector('span.bg-accent')).not.toBeNull();
  });

  it('emits dismissed when the close button is clicked', () => {
    const fixture = create('Hi', true);
    let count = 0;
    fixture.componentInstance.dismissed.subscribe(() => count++);

    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button[aria-label="Dismiss"]',
    ) as HTMLButtonElement;
    button.click();

    expect(count).toBe(1);
  });

  it('exports the two rate-limit messages', () => {
    expect(LOGIN_RATE_LIMIT_MESSAGE).toBe('Too many login attempts \u2014 try again in a minute.');
    expect(GENERAL_RATE_LIMIT_MESSAGE).toBe(
      'Too many requests. Please wait a moment and try again.',
    );
  });
});
