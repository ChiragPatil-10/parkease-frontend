import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminUsers } from './admin-users';
import { UserRow } from './admin-users-format';
import { MOCK_CURRENT_ADMIN_ID, MOCK_USERS } from './admin-users.mock';

describe('AdminUsers', () => {
  let fixture: ComponentFixture<AdminUsers>;
  let component: AdminUsers;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [AdminUsers],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(AdminUsers);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  const tableRows = () => Array.from(el.querySelectorAll<HTMLElement>('tbody tr[data-row]'));
  const rowFor = (name: string) => tableRows().find((r) => r.textContent?.includes(name))!;
  const buttonIn = (row: HTMLElement) => row.querySelector<HTMLButtonElement>('button[data-action]');
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };

  it('has the mock data shape: 30 users over 3 pages with every status and role', () => {
    expect(MOCK_USERS.length).toBe(30);
    expect(component.totalPages()).toBe(3);
    const statuses = new Set(MOCK_USERS.map((u) => u.status));
    expect(statuses).toEqual(new Set(['Active', 'Suspended', 'PendingApproval', 'Rejected']));
    expect(new Set(MOCK_USERS.map((u) => u.role))).toEqual(new Set(['Driver', 'Manager', 'Admin']));
  });

  it('shows an h1 "Users" in the display font and Users active in the nav', () => {
    const h1 = el.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('Users');
    expect(h1?.classList.contains('font-display')).toBe(true);
    expect(el.querySelector('app-admin-nav a.font-semibold')?.textContent?.trim()).toBe('Users');
  });

  it('renders the column headers with a visually hidden Actions header', () => {
    const headers = Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions']);
    expect(el.querySelector('thead th:last-child .sr-only')).not.toBeNull();
  });

  it('renders 10 rows with the pill under Status and the date under Joined', () => {
    expect(tableRows().length).toBe(10);
    const cells = rowFor('Jordan Lee').querySelectorAll('td');
    expect(cells[3].querySelector('[data-pill]')?.textContent?.trim()).toBe('Active');
    expect(cells[4].textContent?.trim()).toBe('12 Jun 2026');
  });

  it('renders a card for each row for small screens', () => {
    expect(el.querySelectorAll('ul[data-cards] > li').length).toBe(10);
  });

  it('shows status pills with the right dot colour, including pending and rejected', () => {
    const dotOf = (name: string) =>
      rowFor(name).querySelector('[data-pill] span')?.className ?? '';
    expect(dotOf('Jordan Lee')).toContain('bg-green-700');
    expect(dotOf('Ankit Verma')).toContain('bg-red-700');
    expect(rowFor('Tara Mehta').querySelector('[data-pill]')?.textContent?.trim()).toBe(
      'Pending approval',
    );
    expect(dotOf('Tara Mehta')).toContain('bg-muted');
    expect(rowFor('Sameer Dutta').querySelector('[data-pill]')?.textContent?.trim()).toBe(
      'Rejected',
    );
    expect(dotOf('Sameer Dutta')).toContain('bg-red-700');
  });

  it('renders an unknown status as raw text with the muted dot', () => {
    component.users.update((list) => [{ ...list[0], status: 'Banned' }, ...list.slice(1)]);
    fixture.detectChanges();
    const pill = tableRows()[0].querySelector('[data-pill]');
    expect(pill?.textContent?.trim()).toBe('Banned');
    expect(pill?.querySelector('span')?.className).toContain('bg-muted');
  });

  it('wraps long emails and gives them a title', () => {
    const long = MOCK_USERS.find((u) => u.userId === 'u-5')!;
    const cell = rowFor(long.fullName).querySelectorAll('td')[1];
    expect(cell.getAttribute('title')).toBe(long.email);
    expect(cell.classList.contains('break-all')).toBe(true);
  });

  describe('actions', () => {
    it('offers Suspend on active users and Reactivate on suspended users', () => {
      expect(buttonIn(rowFor('Jordan Lee'))?.textContent?.trim()).toBe('Suspend');
      expect(buttonIn(rowFor('Ankit Verma'))?.textContent?.trim()).toBe('Reactivate');
    });

    it('offers no action for admins, the signed-in admin, pending and rejected rows', () => {
      expect(MOCK_USERS.find((u) => u.userId === MOCK_CURRENT_ADMIN_ID)).toBeDefined();
      expect(buttonIn(rowFor('Asha Admin'))).toBeNull();
      expect(buttonIn(rowFor('Second Admin'))).toBeNull();
      expect(buttonIn(rowFor('Tara Mehta'))).toBeNull();
      expect(buttonIn(rowFor('Sameer Dutta'))).toBeNull();
    });

    it('has no delete action', () => {
      expect(el.textContent).not.toMatch(/delete/i);
    });

    it('opens the confirm dialog with the suspend text and does not say users are logged out', () => {
      buttonIn(rowFor('Jordan Lee'))!.click();
      fixture.detectChanges();

      const dialog = el.ownerDocument.querySelector('[role="dialog"]')!;
      expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Suspend Jordan Lee?');
      expect(dialog.textContent).toContain(
        "They won't be able to sign in again until you reactivate them.",
      );
      expect(dialog.textContent).not.toMatch(/logged out|log out|immediately|instantly/i);
    });

    it('opens the reactivate dialog', () => {
      buttonIn(rowFor('Ankit Verma'))!.click();
      fixture.detectChanges();
      const dialog = el.ownerDocument.querySelector('[role="dialog"]')!;
      expect(dialog.querySelector('h2')?.textContent?.trim()).toBe('Reactivate Ankit Verma?');
    });

    it('does nothing when the dialog is cancelled', () => {
      buttonIn(rowFor('Jordan Lee'))!.click();
      fixture.detectChanges();
      const cancel = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(
        (b) => b.textContent?.trim() === 'Cancel',
      )!;
      cancel.click();
      fixture.detectChanges();

      expect(el.querySelector('[role="dialog"]')).toBeNull();
      expect(buttonIn(rowFor('Jordan Lee'))?.textContent?.trim()).toBe('Suspend');
    });

    async function confirmDialog() {
      const confirm = Array.from(el.querySelectorAll<HTMLButtonElement>('[role="dialog"] button')).find(
        (b) => b.textContent?.trim() !== 'Cancel',
      )!;
      confirm.click();
      fixture.detectChanges();
    }

    it('shows the busy label and disables that row while the action runs, then flips the status', async () => {
      let finish!: () => void;
      component.actionHandler = () => new Promise<void>((resolve) => (finish = resolve));

      buttonIn(rowFor('Jordan Lee'))!.click();
      fixture.detectChanges();
      await confirmDialog();

      const busy = buttonIn(rowFor('Jordan Lee'))!;
      expect(busy.textContent?.trim()).toBe('Suspending...');
      expect(busy.disabled).toBe(true);
      expect(buttonIn(rowFor('Ankit Verma'))!.disabled).toBe(false);

      finish();
      await settle();

      expect(rowFor('Jordan Lee').querySelector('[data-pill]')?.textContent?.trim()).toBe('Suspended');
      expect(buttonIn(rowFor('Jordan Lee'))?.textContent?.trim()).toBe('Reactivate');
      expect(el.querySelector('[data-success]')?.textContent?.trim()).toBe('Jordan Lee suspended.');
      expect(el.querySelector('[role="status"][aria-live="polite"]')).not.toBeNull();
    });

    it('reactivates a suspended user', async () => {
      buttonIn(rowFor('Ankit Verma'))!.click();
      fixture.detectChanges();
      await confirmDialog();
      await settle();

      expect(rowFor('Ankit Verma').querySelector('[data-pill]')?.textContent?.trim()).toBe('Active');
      expect(el.querySelector('[data-success]')?.textContent?.trim()).toBe('Ankit Verma reactivated.');
    });

    it('shows the server message in the error banner and leaves the row as it was', async () => {
      component.actionHandler = () => Promise.reject(new Error('Only active users can be suspended.'));

      buttonIn(rowFor('Jordan Lee'))!.click();
      fixture.detectChanges();
      await confirmDialog();
      await settle();

      const banner = el.querySelector('[data-action-error]')!;
      expect(banner.getAttribute('role')).toBe('alert');
      expect(banner.textContent?.trim()).toBe('Only active users can be suspended.');
      expect(rowFor('Jordan Lee').querySelector('[data-pill]')?.textContent?.trim()).toBe('Active');
      expect(buttonIn(rowFor('Jordan Lee'))?.textContent?.trim()).toBe('Suspend');
      expect(el.querySelector('[data-success]')).toBeNull();
    });

    it('falls back to a generic message when the failure has no message', async () => {
      const user = component.users()[0] as UserRow;
      component.actionHandler = () => Promise.reject('boom');
      await component.runAction('suspend', user);
      fixture.detectChanges();
      expect(el.querySelector('[data-action-error]')?.textContent?.trim()).toBe(
        'Something went wrong. Please try again.',
      );
    });
  });

  describe('pagination', () => {
    const pager = () => el.querySelector('app-pagination-controls')!;
    const pagerButton = (label: string) =>
      Array.from(pager().querySelectorAll('button')).find((b) => b.textContent?.trim() === label)!;

    it('starts on page 1 of 3 with Previous disabled', () => {
      expect(pager().textContent).toContain('Page 1 of 3');
      expect(pagerButton('Previous').disabled).toBe(true);
      expect(pagerButton('Next').disabled).toBe(false);
    });

    it('moves to the next page and disables Next on the last page', () => {
      pagerButton('Next').click();
      fixture.detectChanges();
      expect(pager().textContent).toContain('Page 2 of 3');
      expect(tableRows()[0].textContent).toContain(MOCK_USERS[10].fullName);

      pagerButton('Next').click();
      fixture.detectChanges();
      expect(pager().textContent).toContain('Page 3 of 3');
      expect(pagerButton('Next').disabled).toBe(true);
      expect(pagerButton('Previous').disabled).toBe(false);
      expect(tableRows().length).toBe(10);
    });
  });

  describe('states', () => {
    it('shows the empty message', () => {
      component.state.set('empty');
      fixture.detectChanges();
      expect(el.textContent).toContain('No users found.');
      expect(tableRows().length).toBe(0);
    });

    it('shows the empty message when there are no users even if loaded', () => {
      component.users.set([]);
      fixture.detectChanges();
      expect(el.textContent).toContain('No users found.');
    });

    it('shows a skeleton while loading', () => {
      component.state.set('loading');
      fixture.detectChanges();
      expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();
      expect(el.querySelector('[data-skeleton="table"]')).not.toBeNull();
      expect(tableRows().length).toBe(0);
    });

    it('shows an error banner with Retry', () => {
      component.state.set('error');
      fixture.detectChanges();
      const alert = el.querySelector('[role="alert"]')!;
      expect(alert.textContent).toContain('Could not load users.');
      alert.querySelector('button')!.click();
      fixture.detectChanges();
      expect(tableRows().length).toBe(10);
    });
  });
});
