import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ManagerBulkCreateSpots } from './manager-bulk-create-spots';

describe('ManagerBulkCreateSpots', () => {
  function createFixture(paramMap: Record<string, string> = { lotId: 'lot-1' }) {
    TestBed.configureTestingModule({
      imports: [ManagerBulkCreateSpots],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(paramMap) } },
        },
      ],
    });

    const fixture = TestBed.createComponent(ManagerBulkCreateSpots);
    const component = fixture.componentInstance as unknown as {
      lotId: ManagerBulkCreateSpots['lotId'];
      rows: ManagerBulkCreateSpots['rows'];
      addRow: ManagerBulkCreateSpots['addRow'];
      updateRow: ManagerBulkCreateSpots['updateRow'];
      onCancel: ManagerBulkCreateSpots['onCancel'];
    };
    fixture.detectChanges();
    return { fixture, component };
  }

  it('reads the lotId route param and seeds three mock rows', () => {
    const { component } = createFixture();

    expect(component.lotId).toBe('lot-1');
    expect(component.rows().length).toBe(3);
  });

  it('shows the row count in the create button label', () => {
    const { fixture } = createFixture();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Create 3 spots');
  });

  it('appends a blank row and updates the live create count when "+ Add another spot" is clicked', () => {
    const { fixture, component } = createFixture();

    component.addRow();
    fixture.detectChanges();

    expect(component.rows().length).toBe(4);
    expect(component.rows()[3]).toEqual({
      spotNumber: '',
      floor: 'Floor 1',
      spotType: 'Compact',
      vehicleType: 'Two Wheeler',
      price: '',
    });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Create 4 spots');
  });

  it('updates a single field on a row without touching the others', () => {
    const { component } = createFixture();

    component.updateRow(0, 'spotNumber', 'A-99');

    expect(component.rows()[0].spotNumber).toBe('A-99');
    expect(component.rows()[1].spotNumber).toBe('A-14');
  });

  it('navigates back to the spot grid on cancel', () => {
    const { component } = createFixture();
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    component.onCancel();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/manager/spots');
  });
});
