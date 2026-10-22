import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DriverLotDetail } from './driver-lot-detail';

describe('DriverLotDetail', () => {
  let el: HTMLElement;
  let fixture: ReturnType<typeof TestBed.createComponent<DriverLotDetail>>;

  const button = (label: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find(
      (b) => b.textContent?.trim() === label,
    )!;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DriverLotDetail],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(DriverLotDetail);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('renders 12 spot tiles with A-02 selected by default', () => {
    expect(el.querySelectorAll('button.font-mono').length).toBe(12);
    expect(button('A-02').getAttribute('aria-pressed')).toBe('true');
    expect(el.textContent).toContain('A-02 · Standard');
  });

  it('moves the selection when an available spot is clicked', () => {
    button('A-04').click();
    fixture.detectChanges();

    expect(button('A-04').getAttribute('aria-pressed')).toBe('true');
    expect(button('A-02').getAttribute('aria-pressed')).toBe('false');
    expect(el.textContent).toContain('A-04 · Standard');
  });

  it('ignores clicks on reserved and occupied spots', () => {
    expect(button('A-03').disabled).toBe(true);
    expect(button('A-05').disabled).toBe(true);
    button('A-03').click();
    button('A-05').click();
    fixture.detectChanges();

    expect(button('A-02').getAttribute('aria-pressed')).toBe('true');
  });

  it('toggles the active vehicle chip locally', () => {
    button('Two Wheeler').click();
    fixture.detectChanges();

    expect(button('Two Wheeler').getAttribute('aria-pressed')).toBe('true');
    expect(button('Four Wheeler').getAttribute('aria-pressed')).toBe('false');
  });
});
