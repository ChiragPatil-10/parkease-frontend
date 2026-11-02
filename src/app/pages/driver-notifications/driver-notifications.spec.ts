import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { DriverNotifications, NotificationsState } from './driver-notifications';
import { NotificationRow, mockNotifications } from './notification-mock';

describe('DriverNotifications', () => {
  function render(state: NotificationsState = 'loaded') {
    TestBed.configureTestingModule({
      imports: [DriverNotifications],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    const fixture = TestBed.createComponent(DriverNotifications);
    fixture.componentInstance.state.set(state);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    return { fixture, el, rows: () => Array.from(el.querySelectorAll<HTMLElement>('li[data-notification]')) };
  }

  const mock = mockNotifications();
  const row = (el: HTMLElement, title: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('li[data-notification]')).find(
      (li) => li.querySelector('p')?.textContent?.trim() === title,
    ) as HTMLElement;

  it('renders the h1 in the display font', () => {
    const h1 = render().el.querySelector('h1') as HTMLElement;
    expect(h1.textContent?.trim()).toBe('Notifications');
    expect(h1.classList).toContain('font-display');
  });

  it('marks Notifications active in the nav, with My Bookings as a link', () => {
    const { el } = render();
    const nav = Array.from(el.querySelectorAll<HTMLElement>('nav > *'));
    const find = (t: string) => nav.find((n) => n.textContent?.trim() === t) as HTMLElement;
    expect(find('Notifications').classList).toContain('text-ink');
    expect(find('My Bookings').getAttribute('href')).toBe('/bookings');
  });

  describe('loaded', () => {
    it('renders one li per mock row', () => {
      expect(render().rows().length).toBe(mock.length);
    });

    it('links only rows with a bookingId, to /bookings/<id>', () => {
      const { rows } = render();
      mock.forEach((m: NotificationRow, i) => {
        const link = rows()[i].querySelector<HTMLAnchorElement>('a[data-link]');
        if (m.bookingId) {
          expect(link?.textContent?.trim()).toBe('View booking →');
          expect(link?.getAttribute('href')).toBe(`/bookings/${m.bookingId}`);
        } else {
          expect(link).toBeNull();
        }
      });
      expect(mock.some((m) => !m.bookingId)).toBe(true);
    });

    it('omits the message line when the message is null', () => {
      const { el } = render();
      expect(row(el, 'Booking created').querySelector('[data-message]')).toBeNull();
      expect(row(el, 'Booking confirmed').querySelector('[data-message]')?.textContent).toContain(
        'Whitefield Central Lot, spot A-02.',
      );
    });

    it('shows the title in the body font, not the display font', () => {
      const title = render().rows()[0].querySelector('p') as HTMLElement;
      expect(title.classList).not.toContain('font-display');
      expect(title.classList).toContain('font-medium');
    });

    it('shows Sent with a green dot', () => {
      const li = row(render().el, 'Booking confirmed');
      expect(li.querySelector('[data-status]')?.textContent?.trim()).toBe('Sent');
      expect(li.querySelector('[data-dot]')?.classList).toContain('bg-green-700');
      expect(li.querySelector('[data-dot]')?.getAttribute('aria-hidden')).toBe('true');
    });

    it('shows Failed to deliver with a red dot', () => {
      const li = row(render().el, 'Refund processed');
      expect(li.querySelector('[data-status]')?.textContent?.trim()).toBe('Failed to deliver');
      expect(li.querySelector('[data-dot]')?.classList).toContain('bg-red-700');
    });

    it('shows Pending with a grey dot', () => {
      const li = row(render().el, 'Reminder');
      expect(li.querySelector('[data-status]')?.textContent?.trim()).toBe('Pending');
      expect(li.querySelector('[data-dot]')?.classList).toContain('bg-muted');
    });

    it('shows relative time, then the date, with the full time in the title', () => {
      const { el } = render();
      const recent = row(el, 'Booking confirmed').querySelector('time') as HTMLElement;
      expect(recent.textContent?.trim()).toBe('5 minutes ago');
      expect(recent.getAttribute('title')).toMatch(/^\w{3}, \d{1,2} \w{3} \d{4}, \d{1,2}:\d{2} (AM|PM)$/);
      const older = row(el, 'Refund processed').querySelector('time') as HTMLElement;
      expect(older.textContent?.trim()).toMatch(/^\w{3}, \d{1,2} \w{3}( \d{4})?, \d{1,2}:\d{2} (AM|PM)$/);
    });

    it('renders text as plain text, never HTML', () => {
      TestBed.configureTestingModule({
        imports: [DriverNotifications],
        providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      });
      const fixture = TestBed.createComponent(DriverNotifications);
      fixture.componentInstance.rows.set([
        { ...mock[0], title: '<b>Hi</b>', message: '<img src=x>' },
      ]);
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('li b')).toBeNull();
      expect(el.querySelector('li img')).toBeNull();
      expect(el.querySelector('li')?.textContent).toContain('<b>Hi</b>');
    });

    it('never shows a subject field', () => {
      expect(mock.every((m) => !('subject' in m))).toBe(true);
    });

    it('shows an enabled Show more button', () => {
      const { el } = render();
      const button = el.querySelector('main button') as HTMLButtonElement;
      expect(button.textContent?.trim()).toBe('Show more');
      expect(button.disabled).toBe(false);
    });

    it('disables Show more and reads "Loading..." while loading more', () => {
      const { fixture, el } = render();
      fixture.componentInstance.loadingMore.set(true);
      fixture.detectChanges();
      const button = el.querySelector('main button') as HTMLButtonElement;
      expect(button.textContent?.trim()).toBe('Loading...');
      expect(button.disabled).toBe(true);
    });

    it('hides Show more when no full page came back', () => {
      const { fixture, el } = render();
      fixture.componentInstance.hasMore.set(false);
      fixture.detectChanges();
      expect(el.querySelector('main button')).toBeNull();
    });
  });

  it('loading: shows 4 skeleton rows and no list content', () => {
    const { el } = render('loading');
    expect(el.querySelector('h1')?.textContent?.trim()).toBe('Notifications');
    expect(el.querySelectorAll('ul[aria-hidden="true"] > li').length).toBe(4);
    expect(el.querySelector('[data-notification]')).toBeNull();
    expect(el.querySelector('main button')).toBeNull();
  });

  it('empty: shows the message and help text, and no button', () => {
    const { el } = render('empty');
    const text = el.querySelector('main')?.textContent ?? '';
    expect(text).toContain('No notifications yet.');
    expect(text).toContain("We'll list booking and payment updates here.");
    expect(el.querySelector('main button')).toBeNull();
    expect(el.querySelector('[data-notification]')).toBeNull();
  });

  it('error: shows the alert banner with a Retry button', () => {
    const { el } = render('error');
    const alert = el.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Could not load notifications.');
    expect(alert.querySelector('button')?.textContent?.trim()).toBe('Retry');
    expect(el.querySelector('[data-notification]')).toBeNull();
  });
});
