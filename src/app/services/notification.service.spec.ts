import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationService } from './notification.service';
import { NotificationResponse } from '../models/notification.model';

describe('NotificationService', () => {
  let http: HttpTestingController;
  let service: NotificationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => http.verify());

  it('GETs /api/v1/notifications/me with page and pageSize and returns the envelope', () => {
    const rows = [{ id: 'n-1', title: 'Booking created' }] as NotificationResponse[];
    let result: unknown;
    service.getMyNotifications(2, 20).subscribe((res) => (result = res));

    const req = http.expectOne((r) => r.url.endsWith('/api/v1/notifications/me'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('pageSize')).toBe('20');
    req.flush({ success: true, message: null, data: rows, errors: null });

    expect(result).toEqual({ success: true, message: null, data: rows, errors: null });
  });
});
