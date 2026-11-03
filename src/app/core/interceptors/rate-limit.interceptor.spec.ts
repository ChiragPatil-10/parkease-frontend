import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LOGIN_RATE_LIMIT_MESSAGE } from '../../shared/components/toast/toast.constants';
import { ToastService } from '../../shared/components/toast/toast.service';
import { rateLimitInterceptor } from './rate-limit.interceptor';

describe('rateLimitInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let toast: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([rateLimitInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => {
    toast.dismiss();
    httpMock.verify();
  });

  function fail(url: string, status: number, headers: Record<string, string> = {}) {
    let caught: { status: number } | null = null;
    http.get(url).subscribe({ error: (e) => (caught = e) });
    httpMock.expectOne(url).flush(
      { success: false, message: 'x', data: null, errors: null },
      { status, statusText: 'x', headers },
    );
    return caught as { status: number } | null;
  }

  it('shows the login message for the login URL and rethrows the error', () => {
    const error = fail('https://gw.example/api/v1/auth/login', 429, { 'Retry-After': '30' });
    expect(toast.message()).toBe('Too many login attempts \u2014 try again in 30 seconds.');
    expect(toast.visible()).toBe(true);
    expect(error?.status).toBe(429);
  });

  it('uses the default login message when Retry-After is missing', () => {
    fail('https://gw.example/api/v1/auth/login', 429);
    expect(toast.message()).toBe(LOGIN_RATE_LIMIT_MESSAGE);
  });

  it('shows the login message for both register URLs', () => {
    fail('https://gw.example/api/v1/auth/register/driver', 429, { 'Retry-After': '120' });
    expect(toast.message()).toBe('Too many login attempts \u2014 try again in 2 minutes.');
    fail('https://gw.example/api/v1/auth/register/manager', 429, { 'Retry-After': '1' });
    expect(toast.message()).toBe('Too many login attempts \u2014 try again in 1 second.');
  });

  it('shows the general message for any other URL', () => {
    fail('https://gw.example/api/v1/lots/pending', 429, { 'Retry-After': '90' });
    expect(toast.message()).toBe('Too many requests. Please wait 2 minutes and try again.');
  });

  it('treats a non-numeric Retry-After as missing', () => {
    fail('https://gw.example/api/v1/lots/pending', 429, {
      'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT',
    });
    expect(toast.message()).toBe('Too many requests. Please wait a moment and try again.');
  });

  it('does nothing for other statuses and still rethrows', () => {
    for (const status of [400, 401, 403, 404, 409, 500, 0]) {
      const error = fail('https://gw.example/api/v1/lots/pending', status);
      expect(error?.status).toBe(status);
    }
    expect(toast.visible()).toBe(false);
  });

  it('never retries: exactly one request per call', () => {
    fail('https://gw.example/api/v1/payments/x', 429, { 'Retry-After': '1' });
    httpMock.expectNone('https://gw.example/api/v1/payments/x');
  });

  it('passes successful responses through', () => {
    let body: unknown;
    http.get('https://gw.example/ok').subscribe((b) => (body = b));
    httpMock.expectOne('https://gw.example/ok').flush({ ok: true });
    expect(body).toEqual({ ok: true });
    expect(toast.visible()).toBe(false);
  });
});
