import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ManagerApplications } from './manager-applications';

describe('ManagerApplications', () => {
  it('keeps the coming-soon content and shows the manager nav with Applications active', async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerApplications],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(ManagerApplications);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Applications — coming soon.');
    expect(el.querySelector('app-manager-nav')).toBeTruthy();
    const active = el.querySelector('nav a.font-semibold');
    expect(active?.textContent?.trim()).toBe('Applications');
  });
});
