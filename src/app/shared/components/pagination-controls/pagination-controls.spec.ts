import { TestBed } from '@angular/core/testing';
import { PaginationControls } from './pagination-controls';

describe('PaginationControls', () => {
  function create(page: number, totalPages: number) {
    const fixture = TestBed.createComponent(PaginationControls);
    fixture.componentRef.setInput('page', page);
    fixture.componentRef.setInput('totalPages', totalPages);
    fixture.detectChanges();
    return fixture;
  }

  it('renders nothing when there is only one page', () => {
    const fixture = create(1, 1);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('disables Previous on the first page and Next on the last page', () => {
    const fixture = create(1, 3);
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(true);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(false);
  });

  it('emits pageChange when Next is clicked', () => {
    const fixture = create(2, 3);
    const emitted: number[] = [];
    fixture.componentInstance.pageChange.subscribe((page: number) => emitted.push(page));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    (buttons[1] as HTMLButtonElement).click();

    expect(emitted).toEqual([3]);
  });

  it('emits pageChange when Previous is clicked', () => {
    const fixture = create(2, 3);
    const emitted: number[] = [];
    fixture.componentInstance.pageChange.subscribe((page: number) => emitted.push(page));

    const buttons = fixture.nativeElement.querySelectorAll('button');
    (buttons[0] as HTMLButtonElement).click();

    expect(emitted).toEqual([1]);
  });
});
