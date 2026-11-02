import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { ApiResponse } from '../../models/api-response.model';
import { NotificationResponse } from '../../models/notification.model';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';
import { DriverNotifications } from './driver-notifications';

const NOW = Date.now();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const DAY = 86_400_000;

function row(n: number, extra: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id: `n-${n}`,
    recipientEmail: 'driver@example.com',
    eventType: 'BookingConfirmed',
    title: `Title ${n}`,
    message: `Message ${n}.`,
    subject: 'Booking Confirmed - ParkEase',
    status: 'Sent',
    sentAt: ago(n * MIN),
    bookingId: `bk-${n}`,
    relatedEntityId: `bk-${n}`,
    ...extra,
  };
}

const rows = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => row(from + i));

const envelope = (data: NotificationResponse[]): ApiResponse<NotificationResponse[]> => ({
  success: true,
  message: null,
  data,
  errors: null,
});

interface Call {
  page: number;
  pageSize: number;
  subject: Subject<ApiResponse<NotificationResponse[]>>;
}

describe('DriverNotifications', () => {
  let calls: Call[];

  function render() {
    calls = [];
    TestBed.configureTestingModule({
      imports: [DriverNotifications],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: NotificationService,
          useValue: {
            getMyNotifications: (page: number, pageSize: number) => {
              const subject = new Subject<ApiResponse<NotificationResponse[]>>();
              calls.push({ page, pageSize, subject });
              return subject;
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(DriverNotifications);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const settle = () => fixture.detectChanges();
    const items = () => Array.from(el.querySelectorAll<HTMLElement>('li[data-notification]'));
    const button = () => el.querySelector<HTMLButtonElement>('main button');
    const last = () => calls[calls.length - 1];
    const respond = (call: Call, data: NotificationResponse[]) => {
      call.subject.next(envelope(data));
      call.subject.complete();
      settle();
    };
    const fail = (call: Call, status = 500, body: unknown = null) => {
      call.subject.error(new HttpErrorResponse({ status, error: body }));
      settle();
    };
    return { fixture, el, settle, items, button, last, respond, fail };
  }

  const titleOf = (li: HTMLElement) => li.querySelector('p')?.textContent?.trim();

  it('renders the h1 in the display font and the nav with Notifications active', () => {
    const { el } = render();
    const h1 = el.querySelector('h1') as HTMLElement;
    expect(h1.textContent?.trim()).toBe('Notifications');
    expect(h1.classList).toContain('font-display');
    const nav = Array.from(el.querySelectorAll<HTMLElement>('nav > *'));
    expect(nav.find((n) => n.textContent?.trim() === 'Notifications')?.classList).toContain(
      'text-ink',
    );
  });

  describe('loading and paging', () => {
    it('requests page 1 with pageSize 20 and shows the skeleton until it returns', () => {
      const { el, items, respond, last } = render();
      expect(calls.length).toBe(1);
      expect([last().page, last().pageSize]).toEqual([1, 20]);
      expect(el.querySelectorAll('ul[aria-hidden="true"] > li').length).toBe(4);
      expect(items().length).toBe(0);

      respond(last(), rows(1, 3));
      expect(el.querySelector('ul[aria-hidden="true"]')).toBeNull();
      expect(items().length).toBe(3);
    });

    it('shows the empty state for an empty first page', () => {
      const { el, respond, last, button } = render();
      respond(last(), []);
      const text = el.querySelector('main')?.textContent ?? '';
      expect(text).toContain('No notifications yet.');
      expect(text).toContain("We'll list booking and payment updates here.");
      expect(button()).toBeNull();
    });

    it('offers Show more for exactly 20 rows', () => {
      const { respond, last, button } = render();
      respond(last(), rows(1, 20));
      expect(button()?.textContent?.trim()).toBe('Show more');
    });

    it('hides Show more for fewer than 20 rows', () => {
      const { respond, last, button } = render();
      respond(last(), rows(1, 19));
      expect(button()).toBeNull();
    });

    it('appends the next page, requesting page 2 with pageSize 20', () => {
      const { items, respond, last, button, settle } = render();
      respond(last(), rows(1, 20));
      button()!.click();
      settle();
      expect([last().page, last().pageSize]).toEqual([2, 20]);
      respond(last(), rows(21, 5));
      expect(items().length).toBe(25);
      expect(titleOf(items()[0])).toBe('Title 1');
      expect(titleOf(items()[24])).toBe('Title 25');
      expect(button()).toBeNull();
    });

    it('disables the button and reads "Loading..." while loading more, ignoring extra clicks', () => {
      const { respond, last, button, settle } = render();
      respond(last(), rows(1, 20));
      const b = button()!;
      b.click();
      settle();
      expect(b.disabled).toBe(true);
      expect(b.textContent?.trim()).toBe('Loading...');
      b.click();
      b.click();
      settle();
      expect(calls.length).toBe(2);
    });

    it('de-duplicates by id when appending and keeps order', () => {
      const { items, respond, last, button, settle } = render();
      respond(last(), rows(1, 20));
      button()!.click();
      settle();
      respond(last(), [row(20), ...rows(21, 19)]);
      expect(items().length).toBe(39);
      expect(items().filter((li) => titleOf(li) === 'Title 20').length).toBe(1);
      expect(button()?.textContent?.trim()).toBe('Show more');
    });

    it('hides the button on an empty next page without an error or empty state', () => {
      const { el, items, respond, last, button, settle } = render();
      respond(last(), rows(1, 20));
      button()!.click();
      settle();
      respond(last(), []);
      expect(items().length).toBe(20);
      expect(button()).toBeNull();
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(el.textContent).not.toContain('No notifications yet.');
    });

    it('fetches again on every new visit', () => {
      const first = render();
      first.respond(first.last(), rows(1, 2));
      TestBed.resetTestingModule();
      const second = render();
      expect(calls.length).toBe(1);
      second.respond(second.last(), rows(1, 2));
      expect(second.items().length).toBe(2);
    });
  });

  describe('errors', () => {
    it('shows the banner on initial failure and Retry refetches page 1 and recovers', () => {
      const { el, items, fail, respond, last, settle } = render();
      fail(last());
      const alert = el.querySelector('[role="alert"]') as HTMLElement;
      expect(alert.textContent).toContain('Could not load notifications.');
      expect(items().length).toBe(0);

      alert.querySelector('button')!.click();
      settle();
      expect(calls.length).toBe(2);
      expect(last().page).toBe(1);
      expect(el.querySelector('[role="alert"]')).toBeNull();
      respond(last(), rows(1, 2));
      expect(items().length).toBe(2);
    });

    it('ignores Retry while a request is in flight', () => {
      const { el, fail, last, settle } = render();
      fail(last());
      const retry = el.querySelector<HTMLButtonElement>('[role="alert"] button')!;
      retry.click();
      settle();
      expect(calls.length).toBe(2);
      // the banner is gone while loading, so a second click cannot even happen
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });

    it.each([403, 429, 500, 0])('shows the same banner for status %s', (status) => {
      const { el, fail, last } = render();
      fail(last(), status);
      expect(el.querySelector('[role="alert"]')?.textContent).toContain(
        'Could not load notifications.',
      );
    });

    it('never renders raw server text', () => {
      const { el, fail, last } = render();
      fail(last(), 500, { message: 'System.NullReferenceException at Foo.Bar', errors: ['stack'] });
      const text = el.textContent ?? '';
      expect(text).not.toContain('NullReference');
      expect(text).not.toContain('stack');
      expect(text).not.toContain('500');
    });

    it('keeps the rows on a Show more failure, shows an inline error and retries the same page', () => {
      const { el, items, respond, fail, last, button, settle } = render();
      respond(last(), rows(1, 20));
      button()!.click();
      settle();
      fail(last());
      expect(items().length).toBe(20);
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('Could not load more.');
      expect(el.textContent).not.toContain('Could not load notifications.');
      expect(button()?.disabled).toBe(false);

      button()!.click();
      settle();
      expect(last().page).toBe(2);
      expect(calls.length).toBe(3);
      expect(el.querySelector('[role="alert"]')).toBeNull();
      respond(last(), rows(21, 3));
      expect(items().length).toBe(23);
    });

    it('clears the session and goes to /login on a 401, with no banner', () => {
      const { el, fail, last } = render();
      const clear = vi.spyOn(TestBed.inject(AuthService), 'clearSession');
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      fail(last(), 401);
      expect(clear).toHaveBeenCalled();
      expect(navigate).toHaveBeenCalledWith('/login');
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });

    it('ignores a response that arrives after the page is destroyed', () => {
      const { fixture, last } = render();
      const pending = last();
      expect(pending.subject.observed).toBe(true);
      fixture.destroy();
      expect(pending.subject.observed).toBe(false);
      expect(() => pending.subject.next(envelope(rows(1, 3)))).not.toThrow();
    });
  });

  describe('rows', () => {
    it('shows a link only for rows with a bookingId, built with the router', () => {
      const { items, respond, last } = render();
      respond(last(), [
        row(1),
        row(2, { bookingId: null }),
        row(3, { bookingId: '' }),
      ]);
      const links = items().map((li) => li.querySelector<HTMLAnchorElement>('a[data-link]'));
      expect(links[0]?.textContent?.trim()).toBe('View booking →');
      expect(links[0]?.getAttribute('href')).toBe('/bookings/bk-1');
      expect(links[1]).toBeNull();
      expect(links[2]).toBeNull();
    });

    it('omits the message line when the message is null', () => {
      const { items, respond, last } = render();
      respond(last(), [row(1), row(2, { message: null })]);
      expect(items()[0].querySelector('[data-message]')?.textContent).toContain('Message 1.');
      expect(items()[1].querySelector('[data-message]')).toBeNull();
    });

    it('renders an unknown eventType with its own title, and never shows the subject', () => {
      const { el, items, respond, last } = render();
      respond(last(), [row(1, { eventType: 'SomethingNew', title: 'Brand new thing' })]);
      expect(titleOf(items()[0])).toBe('Brand new thing');
      expect(el.textContent).not.toContain('Booking Confirmed - ParkEase');
    });

    it('falls back to "Notification" for an empty title', () => {
      const { items, respond, last } = render();
      respond(last(), [row(1, { title: '' })]);
      expect(titleOf(items()[0])).toBe('Notification');
    });

    it('shows Sent with a green dot, Failed with a red dot', () => {
      const { items, respond, last } = render();
      respond(last(), [row(1), row(2, { status: 'Failed' })]);
      const [sent, failed] = items();
      expect(sent.querySelector('[data-status]')?.textContent?.trim()).toBe('Sent');
      expect(sent.querySelector('[data-dot]')?.classList).toContain('bg-green-700');
      expect(sent.querySelector('[data-dot]')?.getAttribute('aria-hidden')).toBe('true');
      expect(failed.querySelector('[data-status]')?.textContent?.trim()).toBe('Failed to deliver');
      expect(failed.querySelector('[data-dot]')?.classList).toContain('bg-red-700');
    });

    it('shows an unknown status as Pending with a grey dot', () => {
      const { items, respond, last } = render();
      respond(last(), [row(1, { status: 'Pending' as never }), row(2, { status: 'Weird' as never })]);
      items().forEach((li) => {
        expect(li.querySelector('[data-status]')?.textContent?.trim()).toBe('Pending');
        expect(li.querySelector('[data-dot]')?.classList).toContain('bg-muted');
      });
    });

    it('shows relative time within a day and the date after, with the full time in the title', () => {
      const { items, respond, last } = render();
      respond(last(), [row(5), row(1, { sentAt: ago(7 * DAY) })]);
      const recent = items()[0].querySelector('time') as HTMLElement;
      expect(recent.textContent?.trim()).toBe('5 minutes ago');
      expect(recent.getAttribute('title')).toMatch(/^\w{3}, \d{1,2} \w{3} \d{4}, \d{1,2}:\d{2} (AM|PM)$/);
      expect(items()[1].querySelector('time')?.textContent?.trim()).toMatch(
        /^\w{3}, \d{1,2} \w{3}( \d{4})?, \d{1,2}:\d{2} (AM|PM)$/,
      );
    });

    it('does not crash on an invalid sentAt and shows the row without a time', () => {
      const { items, respond, last } = render();
      respond(last(), [row(1, { sentAt: 'garbage' }), row(2, { sentAt: null as never })]);
      expect(items().length).toBe(2);
      items().forEach((li) => {
        expect(li.querySelector('time')).toBeNull();
        expect(li.querySelector('[data-status]')).not.toBeNull();
      });
    });

    it('renders title and message as plain text, never HTML', () => {
      const { items, respond, last } = render();
      respond(last(), [row(1, { title: '<b>Hi</b>', message: '<img src=x> ₹120' })]);
      const li = items()[0];
      expect(li.querySelector('b')).toBeNull();
      expect(li.querySelector('img')).toBeNull();
      expect(li.textContent).toContain('<b>Hi</b>');
      expect(li.textContent).toContain('<img src=x> ₹120');
    });
  });
});
