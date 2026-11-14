import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { AUTH_API } from '../constants/auth.constants';
import { UserRole } from '../models/auth/user-role.enum';
import { environment } from '../../environments/environment';
import { SESSION_STORAGE_KEY, storeSession } from '../testing/session';

const LOGOUT_URL = `${environment.apiBaseUrl}${AUTH_API.logout}`;

describe('AuthService.logout', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('clears the session and revokes the refresh token', () => {
    storeSession(UserRole.Driver);
    service.logout();

    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    const req = httpMock.expectOne(LOGOUT_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refreshToken: 'refresh-1' });
    req.flush({ success: true, message: 'Logged out successfully.', data: {}, errors: null });
  });

  it('still logs out locally when the endpoint call fails', () => {
    storeSession(UserRole.Driver);
    service.logout();

    httpMock.expectOne(LOGOUT_URL).flush(null, { status: 500, statusText: 'Server Error' });
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it('does not call the endpoint when there is no session', () => {
    service.logout();
    httpMock.expectNone(LOGOUT_URL);
  });
});

describe('AuthService admin user calls', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  const url = (path: string) => `${environment.apiBaseUrl}${path}`;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getUsers GETs /auth/users with page and pageSize', () => {
    service.getUsers(2, 10).subscribe();
    const req = httpMock.expectOne((r) => r.url === url('/api/v1/auth/users'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush({ success: true, message: null, data: null, errors: null });
  });

  it('suspendUser PUTs to /auth/users/{id}/suspend with an empty body', () => {
    service.suspendUser('u-1').subscribe();
    const req = httpMock.expectOne(url('/api/v1/auth/users/u-1/suspend'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({});
    req.flush({ success: true, message: 'User suspended.', data: {}, errors: null });
  });

  it('reactivateUser PUTs to /auth/users/{id}/reactivate with an empty body', () => {
    service.reactivateUser('u-1').subscribe();
    const req = httpMock.expectOne(url('/api/v1/auth/users/u-1/reactivate'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({});
    req.flush({ success: true, message: 'User reactivated.', data: {}, errors: null });
  });

  it('has no delete-user endpoint', () => {
    expect(Object.keys(AUTH_API)).not.toContain('deleteUser');
  });
});

describe('AuthService password and profile calls', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;
  const url = (path: string) => `${environment.apiBaseUrl}${path}`;
  const ok = { success: true, message: null, data: {}, errors: null };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('forgotPassword posts the email', () => {
    service.forgotPassword({ email: 'a@b.com' }).subscribe();
    const req = httpMock.expectOne(url(AUTH_API.forgotPassword));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.com' });
    req.flush(ok);
  });

  it('resetPassword posts the token and the new password', () => {
    service.resetPassword({ token: 't', newPassword: 'NewPass123' }).subscribe();
    const req = httpMock.expectOne(url(AUTH_API.resetPassword));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 't', newPassword: 'NewPass123' });
    req.flush(ok);
  });

  it('getProfile gets the profile', () => {
    service.getProfile().subscribe();
    const req = httpMock.expectOne(url(AUTH_API.profile));
    expect(req.request.method).toBe('GET');
    req.flush(ok);
  });

  it('updateProfile puts the body as given', () => {
    service.updateProfile({ fullName: 'A', phone: '' }).subscribe();
    const req = httpMock.expectOne(url(AUTH_API.profile));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ fullName: 'A', phone: '' });
    req.flush(ok);
  });

  it('changePassword puts the old and new password', () => {
    service.changePassword({ oldPassword: 'Old1aaaa', newPassword: 'New1aaaa' }).subscribe();
    const req = httpMock.expectOne(url(AUTH_API.password));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ oldPassword: 'Old1aaaa', newPassword: 'New1aaaa' });
    req.flush(ok);
  });

  it('updateSessionUser merges the user fields and keeps the tokens', () => {
    storeSession(UserRole.Driver);
    service.updateSessionUser({ fullName: 'Renamed', phone: '12345' });
    const session = service.getSession()!;
    expect(session.user.fullName).toBe('Renamed');
    expect(session.user.phone).toBe('12345');
    expect(session.user.email).toBe('test@example.com');
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBe('refresh-1');
  });

  it('updateSessionUser does nothing without a session', () => {
    service.updateSessionUser({ fullName: 'Renamed' });
    expect(localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
