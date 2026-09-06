import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { submit } from '@angular/forms/signals';
import { vi } from 'vitest';
import { RegisterDriver } from './register-driver';
import { AUTH_API } from '../../core/constants/api.constants';
import { UserRole } from '../../core/enums/user-role.enum';

describe('RegisterDriver', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterDriver],
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

  function createFixture(fullName: string, email: string, password: string, phone = '') {
    const fixture = TestBed.createComponent(RegisterDriver);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      registerForm: RegisterDriver['registerForm'];
      serverError: RegisterDriver['serverError'];
    };
    component.registerForm.fullName().value.set(fullName);
    component.registerForm.email().value.set(email);
    component.registerForm.password().value.set(password);
    component.registerForm.phone().value.set(phone);
    return component;
  }

  it('should create the component', () => {
    const fixture = TestBed.createComponent(RegisterDriver);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('registers a driver, saves the session, and redirects to /lots', async () => {
    const component = createFixture('Alice Sharma', 'alice@example.com', 'Secret1!', '9876543210');
    const submission = submit(component.registerForm);

    const req = httpMock.expectOne(AUTH_API.registerDriver);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      fullName: 'Alice Sharma',
      email: 'alice@example.com',
      password: 'Secret1!',
      phone: '9876543210',
    });
    req.flush({
      success: true,
      message: 'Registration successful.',
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

  it('omits phone from the request body when left blank', async () => {
    const component = createFixture('Alice Sharma', 'alice@example.com', 'Secret1!');
    const submission = submit(component.registerForm);

    const req = httpMock.expectOne(AUTH_API.registerDriver);
    expect(req.request.body).toEqual({
      fullName: 'Alice Sharma',
      email: 'alice@example.com',
      password: 'Secret1!',
    });
    req.flush({
      success: true,
      message: 'Registration successful.',
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
  });

  it('surfaces the API message on a duplicate-email 409 response', async () => {
    const component = createFixture('Alice Sharma', 'alice@example.com', 'Secret1!');
    const submission = submit(component.registerForm);

    const req = httpMock.expectOne(AUTH_API.registerDriver);
    req.flush(
      {
        success: false,
        message: "Email 'alice@example.com' is already registered.",
        data: null,
        errors: null,
      },
      { status: 409, statusText: 'Conflict' },
    );

    await submission;

    expect(component.serverError()).toBe("Email 'alice@example.com' is already registered.");
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('surfaces the API message on a 422 validation response', async () => {
    const component = createFixture('Alice Sharma', 'alice@example.com', 'Secret1!');
    const submission = submit(component.registerForm);

    const req = httpMock.expectOne(AUTH_API.registerDriver);
    req.flush(
      {
        success: false,
        message: 'Validation failed.',
        data: null,
        errors: { Password: ['Password must be at least 8 characters.'] },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    await submission;

    expect(component.serverError()).toBe('Validation failed.');
  });

  it('shows a rate-limit message on 429 responses', async () => {
    const component = createFixture('Alice Sharma', 'alice@example.com', 'Secret1!');
    const submission = submit(component.registerForm);

    const req = httpMock.expectOne(AUTH_API.registerDriver);
    req.flush(null, { status: 429, statusText: 'Too Many Requests' });

    await submission;

    expect(component.serverError()).toBe(
      'Too many registration attempts. Please wait a minute and try again.',
    );
  });
});
