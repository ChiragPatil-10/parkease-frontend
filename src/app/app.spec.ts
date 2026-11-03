import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { ToastService } from './shared/components/toast/toast.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders the toast exactly once, bound to the ToastService', () => {
    const fixture = TestBed.createComponent(App);
    const toast = TestBed.inject(ToastService);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelectorAll('app-toast').length).toBe(1);
    expect(el.querySelector('[data-toast]')).toBeNull();

    toast.show('Hello there');
    fixture.detectChanges();
    expect(el.querySelector('[data-toast]')?.textContent).toContain('Hello there');

    (el.querySelector('button[aria-label="Dismiss"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('[data-toast]')).toBeNull();
    toast.dismiss();
  });
});
