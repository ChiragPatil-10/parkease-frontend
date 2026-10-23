import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { VehicleService } from './vehicle.service';
import { VEHICLE_API } from '../constants/vehicle.constants';
import { VehicleType } from '../models/spot.model';
import { environment } from '../../environments/environment';

const url = (path: string) => `${environment.apiBaseUrl}${path}`;

describe('VehicleService', () => {
  let service: VehicleService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(VehicleService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('gets my vehicles', () => {
    service.getMyVehicles().subscribe();
    const req = httpMock.expectOne(url('/api/vehicles/my'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: null, data: [], errors: null });
  });

  it.each<[VehicleType, number]>([
    ['TwoWheeler', 0],
    ['FourWheeler', 1],
    ['Heavy', 2],
  ])('sends vehicleType %s as the integer %i when creating', (vehicleType, expected) => {
    service
      .createVehicle({ plateNumber: 'KA05MJ4471', vehicleType, make: 'Honda', model: 'City', isElectric: false })
      .subscribe();
    const req = httpMock.expectOne(url(VEHICLE_API.create));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      plateNumber: 'KA05MJ4471',
      vehicleType: expected,
      make: 'Honda',
      model: 'City',
      isElectric: false,
    });
    req.flush({ success: true, message: null, data: null, errors: null });
  });

  it('deletes with the confirm flag as a query parameter', () => {
    service.deleteVehicle('v-1', false).subscribe();
    httpMock.expectOne(url('/api/vehicles/v-1?confirm=false')).flush({ success: true, message: null, data: null, errors: null });

    service.deleteVehicle('v-1', true).subscribe();
    const req = httpMock.expectOne(url('/api/vehicles/v-1?confirm=true'));
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, message: null, data: null, errors: null });
  });
});
