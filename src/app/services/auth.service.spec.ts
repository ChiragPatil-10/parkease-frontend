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
