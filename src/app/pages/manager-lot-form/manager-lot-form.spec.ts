import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ManagerLotForm } from './manager-lot-form';

function createFixture(paramMap: Record<string, string> = {}) {
  TestBed.configureTestingModule({
    imports: [ManagerLotForm],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap(paramMap) } },
      },
    ],
  });

  const fixture = TestBed.createComponent(ManagerLotForm);
  fixture.detectChanges();
  return fixture;
}

describe('ManagerLotForm', () => {
  it('shows the create heading and empty fields when there is no id param', () => {
    const fixture = createFixture();
    const component = fixture.componentInstance as unknown as { heading: string; lot: { lotName: string } };

    expect(component.heading).toBe('Add a new lot');
    expect(component.lot.lotName).toBe('');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Add a new lot');
  });

  it('shows the edit heading and pre-filled mock data when an id param is present', () => {
    const fixture = createFixture({ id: 'lot-1' });
    const component = fixture.componentInstance as unknown as { heading: string; lot: { lotName: string } };

    expect(component.heading).toBe('Edit lot');
    expect(component.lot.lotName).toBe('Whitefield Central Lot');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Edit lot');
  });

  it('renders the static min/max price validation message', () => {
    const fixture = createFixture();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Max price must be greater than or equal to min price',
    );
  });

  it('navigates back to My Lots on save', () => {
    const fixture = createFixture();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    (fixture.nativeElement as HTMLElement).querySelector('form')?.dispatchEvent(new Event('submit'));

    expect(router.navigateByUrl).toHaveBeenCalledWith('/manager/lots');
  });
});
