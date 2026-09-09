import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { submit } from '@angular/forms/signals';
import { vi } from 'vitest';
import { RegisterManager } from './register-manager';
import { AUTH_API } from '../../constants/auth.constants';
import { ApplicationStatus } from '../../models/auth/application-status.enum';
import { environment } from '../../../environments/environment';

const REGISTER_MANAGER_URL = `${environment.apiBaseUrl}${AUTH_API.registerManager}`;

describe('RegisterManager', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterManager],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    httpMock.verify();
  });

  function createFixture(
    fullName: string,
    email: string,
    password: string,
    phone: string,
    businessName: string,
    parkingAddress: string,
  ) {
    const fixture = TestBed.createComponent(RegisterManager);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as {
      registerForm: RegisterManager['registerForm'];
      serverError: RegisterManager['serverError'];
    };
    component.registerForm.fullName().value.set(fullName);
    component.registerForm.email().value.set(email);
    component.registerForm.password().value.set(password);
    component.registerForm.phone().value.set(phone);
    component.registerForm.businessName().value.set(businessName);
    component.registerForm.parkingAddress().value.set(parkingAddress);
    return component;
  }

  it('should create the component', () => {
    const fixture = TestBed.createComponent(RegisterManager);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('treats phone as required, unlike Register — Driver', () => {
    const component = createFixture(
      'Priya Shah',
      'priya@example.com',
      'Secret1!',
      '',
      "Shah Parking Services",
      'MG Road, Bangalore',
    );

    expect(component.registerForm.phone().invalid()).toBe(true);
  });

  it('submits the application and navigates to the submitted page with the response as router state', async () => {
    const component = createFixture(
      'Priya Shah',
      'priya@example.com',
      'Secret1!',
      '9876543210',
      "Shah Parking Services",
      'MG Road, Bangalore',
    );
    const submission = submit(component.registerForm);

    const req = httpMock.expectOne(REGISTER_MANAGER_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      fullName: 'Priya Shah',
      email: 'priya@example.com',
      password: 'Secret1!',
      phone: '9876543210',
      businessName: "Shah Parking Services",
      parkingAddress: 'MG Road, Bangalore',
    });
    req.flush({
      success: true,
      message: 'Application submitted. Awaiting admin approval.',
      data: {
        applicationId: 'app-1',
        userId: 'user-1',
        fullName: 'Priya Shah',
        email: 'priya@example.com',
        phone: '9876543210',
        businessName: "Shah Parking Services",
        parkingAddress: 'MG Road, Bangalore',
        status: ApplicationStatus.Pending,
        createdAt: '2026-09-06T14:00:00Z',
      },
      errors: null,
    });

    await submission;

    expect(router.navigate).toHaveBeenCalledWith(['/register-manager/submitted'], {
      state: {
        fullName: 'Priya Shah',
        businessName: "Shah Parking Services",
        status: ApplicationStatus.Pending,
        applicationId: 'app-1',
      },
    });
  });

  it('surfaces the API message on a duplicate-email 409 response', async () => {
    const component = createFixture(
      'Priya Shah',
      'priya@example.com',
      'Secret1!',
      '9876543210',
      "Shah Parking Services",
      'MG Road, Bangalore',
    );
    const submission = submit(component.registerForm);

    const req = httpMock.expectOne(REGISTER_MANAGER_URL);
    req.flush(
      {
        success: false,
        message: "Email 'priya@example.com' is already registered.",
        data: null,
        errors: null,
      },
      { status: 409, statusText: 'Conflict' },
    );

    await submission;

    expect(component.serverError()).toBe("Email 'priya@example.com' is already registered.");
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('surfaces the API message on a 422 validation response', async () => {
    const component = createFixture(
      'Priya Shah',
      'priya@example.com',
      'Secret1!',
      '9876543210',
      "Shah Parking Services",
      'MG Road, Bangalore',
    );
    const submission = submit(component.registerForm);

    const req = httpMock.expectOne(REGISTER_MANAGER_URL);
    req.flush(
      {
        success: false,
        message: 'Validation failed.',
        data: null,
        errors: { Phone: ['Phone is required.'] },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    await submission;

    expect(component.serverError()).toBe('Validation failed.');
  });

  it('shows a rate-limit message on 429 responses', async () => {
    const component = createFixture(
      'Priya Shah',
      'priya@example.com',
      'Secret1!',
      '9876543210',
      "Shah Parking Services",
      'MG Road, Bangalore',
    );
    const submission = submit(component.registerForm);

    const req = httpMock.expectOne(REGISTER_MANAGER_URL);
    req.flush(null, { status: 429, statusText: 'Too Many Requests' });

    await submission;

    expect(component.serverError()).toBe(
      'Too many registration attempts. Please wait a minute and try again.',
    );
  });
});
