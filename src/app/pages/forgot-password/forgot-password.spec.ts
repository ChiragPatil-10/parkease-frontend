import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { submit } from '@angular/forms/signals';
import { vi } from 'vitest';
import { FORGOT_SUCCESS_MESSAGE, ForgotPassword, RESEND_COOLDOWN_SECONDS } from './forgot-password';
import { AUTH_API } from '../../constants/auth.constants';
import { environment } from '../../../environments/environment';

const URL = `${environment.apiBaseUrl}${AUTH_API.forgotPassword}`;

describe('ForgotPassword', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ForgotPassword],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  function create(emailValue = '') {
    const fixture = TestBed.createComponent(ForgotPassword);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      forgotForm: ForgotPassword['forgotForm'];
    };
    component.forgotForm.email().value.set(emailValue);
    return { fixture, component, el: fixture.nativeElement as HTMLElement };
  }

  const ok = { success: true, message: FORGOT_SUCCESS_MESSAGE, data: {}, errors: null };

  it('shows the backend validation messages and sends nothing when invalid', async () => {
    const { fixture, component, el } = create('');
    await submit(component.forgotForm);
    fixture.detectChanges();
    expect(el.querySelector('[data-email-error]')?.textContent?.trim()).toBe('Email is required.');

    component.forgotForm.email().value.set('nope');
    fixture.detectChanges();
    expect(el.querySelector('[data-email-error]')?.textContent?.trim()).toBe(
      'A valid email address is required.',
    );

    component.forgotForm.email().value.set(`${'a'.repeat(195)}@x.com`);
    fixture.detectChanges();
    expect(el.querySelector('[data-email-error]')?.textContent?.trim()).toBe(
      'Email must not exceed 200 characters.',
    );
    httpMock.expectNone(URL);
  });

  it('posts the trimmed email and shows the generic message after a 200', async () => {
    const { fixture, component, el } = create(' alice@example.com ');
    const done = submit(component.forgotForm);
    const req = httpMock.expectOne(URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'alice@example.com' });
    req.flush(ok);
    await done;
    fixture.detectChanges();

    expect(el.querySelector('[data-sent]')?.textContent?.trim()).toBe(FORGOT_SUCCESS_MESSAGE);
    expect(el.textContent).not.toContain('No account');
  });

  it('falls back to the fixed message when the server sends none', async () => {
    const { fixture, component, el } = create('a@b.com');
    const done = submit(component.forgotForm);
    httpMock.expectOne(URL).flush({ success: true, message: null, data: {}, errors: null });
    await done;
    fixture.detectChanges();
    expect(el.querySelector('[data-sent]')?.textContent?.trim()).toBe(FORGOT_SUCCESS_MESSAGE);
  });

  it('disables the submit button while sending', async () => {
    const { fixture, component, el } = create('a@b.com');
    const done = submit(component.forgotForm);
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('[data-submit]')?.disabled).toBe(true);
    httpMock.expectOne(URL).flush(ok);
    await done;
  });

  it('shows a 422 inline on the email field', async () => {
    const { fixture, component, el } = create('a@b.com');
    const done = submit(component.forgotForm);
    httpMock.expectOne(URL).flush(
      { success: false, message: 'Validation failed.', data: null, errors: { Email: ['A valid email address is required.'] } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await done;
    fixture.detectChanges();
    expect(el.querySelector('[data-email-error]')?.textContent?.trim()).toBe(
      'A valid email address is required.',
    );
    expect(el.querySelector('[data-sent]')).toBeNull();
  });

  it('shows a calm notice with the retry time on a 429', async () => {
    const { fixture, component, el } = create('a@b.com');
    const done = submit(component.forgotForm);
    httpMock.expectOne(URL).flush(null, {
      status: 429,
      statusText: 'Too Many Requests',
      headers: { 'Retry-After': '42' },
    });
    await done;
    fixture.detectChanges();
    expect(el.querySelector('[data-rate-limited]')?.textContent).toContain('42 seconds');
    expect(el.querySelector('[data-error]')).toBeNull();
  });

  it('shows a retryable error for other failures and keeps the email', async () => {
    const { fixture, component, el } = create('a@b.com');
    const done = submit(component.forgotForm);
    httpMock.expectOne(URL).flush(null, { status: 500, statusText: 'Server Error' });
    await done;
    fixture.detectChanges();
    expect(el.querySelector('[data-error]')?.textContent).toContain('Please try again');
    expect(component.forgotForm.email().value()).toBe('a@b.com');
    expect(el.querySelector<HTMLButtonElement>('[data-submit]')?.disabled).toBe(false);
  });

  it('keeps Send again disabled for 30 seconds with a visible countdown', async () => {
    vi.useFakeTimers();
    const { fixture, component, el } = create('a@b.com');
    const done = submit(component.forgotForm);
    httpMock.expectOne(URL).flush(ok);
    await done;
    fixture.detectChanges();

    const button = el.querySelector<HTMLButtonElement>('[data-submit]')!;
    expect(button.disabled).toBe(true);
    expect(button.textContent?.trim()).toBe(`Send again in ${RESEND_COOLDOWN_SECONDS}s`);

    vi.advanceTimersByTime(10_000);
    fixture.detectChanges();
    expect(button.textContent?.trim()).toBe('Send again in 20s');

    vi.advanceTimersByTime(20_000);
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    expect(button.textContent?.trim()).toBe('Send again');

    const again = submit(component.forgotForm);
    httpMock.expectOne(URL).flush(ok);
    await again;
  });

  it('links back to the sign in page', () => {
    const { el } = create();
    expect(el.querySelector('[data-back]')?.getAttribute('href')).toBe('/login');
  });

  it('uses the email autocomplete value', () => {
    const { el } = create();
    expect(el.querySelector('#email')?.getAttribute('autocomplete')).toBe('email');
  });
});
