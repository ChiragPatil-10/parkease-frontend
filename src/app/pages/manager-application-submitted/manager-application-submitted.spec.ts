import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ManagerApplicationSubmitted, ManagerApplicationSubmittedState } from './manager-application-submitted';
import { ApplicationStatus } from '../../models/auth/application-status.enum';

describe('ManagerApplicationSubmitted', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerApplicationSubmitted],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function createFixtureWithState(state: ManagerApplicationSubmittedState | undefined) {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'getCurrentNavigation').mockReturnValue({
      extras: { state },
    } as ReturnType<Router['getCurrentNavigation']>);

    const fixture = TestBed.createComponent(ManagerApplicationSubmitted);
    fixture.detectChanges();
    return fixture;
  }

  it('should create the component', () => {
    const fixture = createFixtureWithState(undefined);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('displays the application details from router navigation state, mapping Pending to Pending review', () => {
    const fixture = createFixtureWithState({
      fullName: 'Priya Shah',
      businessName: "Shah Parking Services",
      status: ApplicationStatus.Pending,
      applicationId: 'app-1',
    });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Priya Shah');
    expect(text).toContain('Shah Parking Services');
    expect(text).toContain('Status: Pending review');
  });

  it('shows generic fallback copy when no router state is present', () => {
    const fixture = createFixtureWithState(undefined);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain(
      'Your application has been submitted — check your email for updates.',
    );
    expect(text).not.toContain('Status:');
  });

  it('links back to /login', () => {
    const fixture = createFixtureWithState(undefined);
    const link: HTMLAnchorElement = (fixture.nativeElement as HTMLElement).querySelector('a')!;
    expect(link.getAttribute('href')).toBe('/login');
  });
});
