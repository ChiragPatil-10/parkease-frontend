import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { VEHICLE_API } from '../constants/vehicle.constants';
import { ApiResponse } from '../models/api-response.model';
import { VehicleResponse } from '../models/vehicle/vehicle.model';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly api = inject(ApiService);

  getMyVehicles(): Observable<ApiResponse<VehicleResponse[]>> {
    return this.api.get<VehicleResponse[]>(VEHICLE_API.my);
  }
}
