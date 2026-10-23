import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { VEHICLE_API, VEHICLE_TYPE_REQUEST_VALUE } from '../constants/vehicle.constants';
import { ApiResponse } from '../models/api-response.model';
import { CreateVehicleRequest, VehicleResponse } from '../models/vehicle/vehicle.model';

@Injectable({ providedIn: 'root' })
export class VehicleService {
  private readonly api = inject(ApiService);

  getMyVehicles(): Observable<ApiResponse<VehicleResponse[]>> {
    return this.api.get<VehicleResponse[]>(VEHICLE_API.my);
  }

  createVehicle(request: CreateVehicleRequest): Observable<ApiResponse<VehicleResponse>> {
    return this.api.post<VehicleResponse>(VEHICLE_API.create, {
      ...request,
      vehicleType: VEHICLE_TYPE_REQUEST_VALUE[request.vehicleType],
    });
  }

  /** `confirm: false` returns 409 when the vehicle has an upcoming booking; `true` forces the delete. */
  deleteVehicle(vehicleId: string, confirm: boolean): Observable<ApiResponse<null>> {
    return this.api.delete<null>(VEHICLE_API.byId(vehicleId, confirm));
  }
}
