import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ManagerSpots } from './manager-spots';

describe('ManagerSpots', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManagerSpots],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function create() {
    const fixture = TestBed.createComponent(ManagerSpots);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the default lot with its populated floor 1 grid and legend', () => {
    const fixture = create();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Whitefield Central Lot');
    expect(text).toContain('A-01');
    expect(text).toContain('Available');
    expect(text).toContain('Reserved');
    expect(text).toContain('Occupied');
    expect(text).toContain('+ Add spots');
  });

  it('switches to floor 2 and shows the per-floor empty state instead of the grid', () => {
    const fixture = create();
    const nativeElement = fixture.nativeElement as HTMLElement;

    const floor2Tab = Array.from(nativeElement.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Floor 2',
    )!;
    floor2Tab.click();
    fixture.detectChanges();

    const text = nativeElement.textContent ?? '';
    expect(text).toContain('Floor 2 has no spots yet.');
    expect(text).toContain('+ Add spots to this floor');
    expect(text).not.toContain('A-01');
    expect(nativeElement.querySelectorAll('.grid').length).toBe(0);
  });

  it('opens the lot switcher and lists all mock lots, flagging the pending one', () => {
    const fixture = create();
    const nativeElement = fixture.nativeElement as HTMLElement;

    const lotSwitcherButton = nativeElement.querySelector('button') as HTMLButtonElement;
    lotSwitcherButton.click();
    fixture.detectChanges();

    const text = nativeElement.textContent ?? '';
    expect(text).toContain('Shah Annex Lot');
    expect(text).toContain('Shah Rooftop Deck');
    expect(text).toContain('(pending approval)');
  });

  it('selecting a different lot resets to that lot\'s first floor', () => {
    const fixture = create();
    const nativeElement = fixture.nativeElement as HTMLElement;

    (nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const shahAnnexOption = Array.from(nativeElement.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Shah Annex Lot'),
    )!;
    shahAnnexOption.click();
    fixture.detectChanges();

    const text = nativeElement.textContent ?? '';
    expect(text).toContain('Shah Annex Lot');
    expect(nativeElement.querySelectorAll('button').length).toBeGreaterThan(0);
    expect(text).not.toContain('Whitefield Central Lot');
  });

  it('toggles the Add spots dropdown open and closed without navigating anywhere', () => {
    const fixture = create();
    const nativeElement = fixture.nativeElement as HTMLElement;

    const addSpotsButton = Array.from(nativeElement.querySelectorAll('button')).find((button) =>
      button.textContent?.trim().startsWith('+ Add spots'),
    )!;
    addSpotsButton.click();
    fixture.detectChanges();

    let text = nativeElement.textContent ?? '';
    expect(text).toContain('Add single spot');
    expect(text).toContain('Bulk create spots');

    const singleSpotOption = Array.from(nativeElement.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Add single spot'),
    )!;
    singleSpotOption.click();
    fixture.detectChanges();

    text = nativeElement.textContent ?? '';
    expect(text).not.toContain('Quick add — one spot at a time');
  });
});
