import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PARKINGLOT_API } from '../constants/parkinglot.constants';
import { ApiResponse } from '../models/api-response.model';
import { ApproveLotRequest, LotResponse } from '../models/lot.model';

@Injectable({ providedIn: 'root' })
export class ParkingLotService {
  private readonly api = inject(ApiService);

  getPendingLots(): Observable<ApiResponse<LotResponse[]>> {
    return this.api.get<LotResponse[]>(PARKINGLOT_API.pending);
  }

  approveLot(lotId: string, feedback?: string): Observable<ApiResponse<LotResponse>> {
    const body: ApproveLotRequest = feedback?.trim() ? { feedback: feedback.trim() } : {};
    return this.api.put<LotResponse>(PARKINGLOT_API.approve(lotId), body);
  }
}
