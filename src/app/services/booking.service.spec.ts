import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BookingService } from './booking.service';
import { ManagerLotBooking } from '../models/booking.model';

describe('BookingService.getLotBookings', () => {
  let http: HttpTestingController;
  let service: BookingService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(BookingService);
  });

  afterEach(() => http.verify());

  it('GETs /api/bookings/lot/{lotId} with page and pageSize, no status for All, and returns the envelope', () => {
    const rows = [{ bookingId: 'b-1' }] as ManagerLotBooking[];
    let result: unknown;
    service.getLotBookings('lot-1', null, 1, 20).subscribe((res) => (result = res));

    const req = http.expectOne((r) => r.url.endsWith('/api/bookings/lot/lot-1'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pageSize')).toBe('20');
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ success: true, message: null, data: rows, errors: null });

    expect(result).toEqual({ success: true, message: null, data: rows, errors: null });
  });

  it('sends status when given', () => {
    service.getLotBookings('lot-1', 'CheckedIn', 2, 20).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/bookings/lot/lot-1'));
    expect(req.request.params.get('status')).toBe('CheckedIn');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ success: true, message: null, data: [], errors: null });
  });
});
