import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ParkingLotService } from './parkinglot.service';
import { PARKINGLOT_API } from '../constants/parkinglot.constants';
import { environment } from '../../environments/environment';

const url = (path: string) => `${environment.apiBaseUrl}${path}`;

describe('ParkingLotService (admin calls)', () => {
  let service: ParkingLotService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ParkingLotService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getPendingLots GETs /lots/pending with no params', () => {
    service.getPendingLots().subscribe();
    const req = httpMock.expectOne(url('/api/v1/lots/pending'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ success: true, message: null, data: [], errors: null });
  });

  it('getAllLots GETs /lots/all with page and pageSize', () => {
    service.getAllLots(3, 10).subscribe();
    const req = httpMock.expectOne((r) => r.url === url(PARKINGLOT_API.all));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('3');
    expect(req.request.params.get('pageSize')).toBe('10');
    req.flush({ success: true, message: null, data: null, errors: null });
  });

  it('approveLot PUTs exactly {} to /lots/{id}/approve', () => {
    service.approveLot('lot-1').subscribe();
    const req = httpMock.expectOne(url('/api/v1/lots/lot-1/approve'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({});
    req.flush({ success: true, message: 'Lot approved.', data: null, errors: null });
  });

  it('rejectLot PUTs { feedback } with the trimmed text', () => {
    service.rejectLot('lot-1', '  Needs signage  ').subscribe();
    const req = httpMock.expectOne(url('/api/v1/lots/lot-1/reject'));
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ feedback: 'Needs signage' });
    req.flush({ success: true, message: 'Lot rejected.', data: null, errors: null });
  });

  it('rejectLot PUTs {} when the feedback is missing, empty or only spaces', () => {
    for (const feedback of [undefined, '', '   ']) {
      service.rejectLot('lot-1', feedback).subscribe();
      const req = httpMock.expectOne(url('/api/v1/lots/lot-1/reject'));
      expect(req.request.body).toEqual({});
      req.flush({ success: true, message: null, data: null, errors: null });
    }
  });
});
