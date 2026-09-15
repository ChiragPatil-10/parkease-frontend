import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PARKINGLOT_API } from '../constants/parkinglot.constants';
import { ApiResponse } from '../models/api-response.model';
import { ApproveLotRequest, LotRequest, LotResponse } from '../models/lot.model';

@Injectable({ providedIn: 'root' })
export class ParkingLotService {
  private readonly api = inject(ApiService);

  getPendingLots(): Observable<ApiResponse<LotResponse[]>> {
    return this.api.get<LotResponse[]>(PARKINGLOT_API.pending);
  }

  getLotsByManager(managerId: string): Observable<ApiResponse<LotResponse[]>> {
    return this.api.get<LotResponse[]>(PARKINGLOT_API.byManager(managerId));
  }

  getLotById(lotId: string): Observable<ApiResponse<LotResponse>> {
    return this.api.get<LotResponse>(PARKINGLOT_API.byId(lotId));
  }

  createLot(request: LotRequest): Observable<ApiResponse<LotResponse>> {
    return this.api.post<LotResponse>(PARKINGLOT_API.create, request);
  }

  updateLot(lotId: string, request: LotRequest): Observable<ApiResponse<LotResponse>> {
    return this.api.put<LotResponse>(PARKINGLOT_API.byId(lotId), request);
  }

  approveLot(lotId: string, feedback?: string): Observable<ApiResponse<LotResponse>> {
    const body: ApproveLotRequest = feedback?.trim() ? { feedback: feedback.trim() } : {};
    return this.api.put<LotResponse>(PARKINGLOT_API.approve(lotId), body);
  }
}
