import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { submit } from '@angular/forms/signals';
import { vi } from 'vitest';
import { Login } from './login';
import { AUTH_API } from '../../constants/auth.constants';
import { UserRole } from '../../models/auth/user-role.enum';
import { environment } from '../../../environments/environment';

const LOGIN_URL = `${environment.apiBaseUrl}${AUTH_API.login}`;

describe('Login', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    localStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createLoggedInFixture(email: string, password: string) {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      loginForm: Login['loginForm'];
      serverError: Login['serverError'];
      adminNotice: Login['adminNotice'];
    };
    component.loginForm.email().value.set(email);
    component.loginForm.password().value.set(password);
    return component;
  }

  it('should create the component', () => {
    const fixture = TestBed.createComponent(Login);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('logs a Driver in and redirects to /lots', async () => {
    const component = createLoggedInFixture('alice@example.com', 'Secret1!');
    const submission = submit(component.loginForm);

    const req = httpMock.expectOne(LOGIN_URL);
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      message: null,
      data: {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: '2026-09-06T15:30:00Z',
        user: {
          userId: '1',
          fullName: 'Alice Sharma',
          email: 'alice@example.com',
          role: UserRole.Driver,
          profilePicUrl: null,
        },
      },
      errors: null,
    });

    await submission;

    expect(router.navigateByUrl).toHaveBeenCalledWith('/lots');
    expect(localStorage.getItem('parkease.session')).toBeTruthy();
  });

  it('logs a Manager in and redirects to /manager/lots', async () => {
    const component = createLoggedInFixture('bob@example.com', 'Secret1!');
    const submission = submit(component.loginForm);

    const req = httpMock.expectOne(LOGIN_URL);
    req.flush({
      success: true,
      message: null,
      data: {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: '2026-09-06T15:30:00Z',
        user: {
          userId: '2',
          fullName: 'Bob Manager',
          email: 'bob@example.com',
          role: UserRole.Manager,
          profilePicUrl: null,
        },
      },
      errors: null,
    });

    await submission;

    expect(router.navigateByUrl).toHaveBeenCalledWith('/manager/lots');
  });

  it('shows an admin notice without redirecting for Admin accounts', async () => {
    const component = createLoggedInFixture('admin@example.com', 'Secret1!');
    const submission = submit(component.loginForm);

    const req = httpMock.expectOne(LOGIN_URL);
    req.flush({
      success: true,
      message: null,
      data: {
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresAt: '2026-09-06T15:30:00Z',
        user: {
          userId: '3',
          fullName: 'Admin User',
          email: 'admin@example.com',
          role: UserRole.Admin,
          profilePicUrl: null,
        },
      },
      errors: null,
    });

    await submission;

    expect(component.adminNotice()).toBe(true);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('surfaces the API message on invalid credentials', async () => {
    const component = createLoggedInFixture('alice@example.com', 'WrongPass1');
    const submission = submit(component.loginForm);

    const req = httpMock.expectOne(LOGIN_URL);
    req.flush(
      { success: false, message: 'Invalid email or password.', data: null, errors: null },
      { status: 401, statusText: 'Unauthorized' },
    );

    await submission;

    expect(component.serverError()).toBe('Invalid email or password.');
  });

  it('shows a rate-limit message on 429 responses', async () => {
    const component = createLoggedInFixture('alice@example.com', 'Secret1!');
    const submission = submit(component.loginForm);

    const req = httpMock.expectOne(LOGIN_URL);
    req.flush(null, { status: 429, statusText: 'Too Many Requests' });

    await submission;

    expect(component.serverError()).toBe(
      'Too many login attempts. Please wait a minute and try again.',
    );
  });
});
