import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PARKINGLOT_API } from '../constants/parkinglot.constants';
import { ApiResponse } from '../models/api-response.model';
import { ApproveLotRequest, LotRequest, LotResponse, NearbyLot } from '../models/lot.model';
import { PagedResponse } from '../models/paged-response.model';

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

  getNearbyLots(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Observable<ApiResponse<NearbyLot[]>> {
    return this.api.get<NearbyLot[]>(PARKINGLOT_API.nearby, { latitude, longitude, radiusKm });
  }

  searchLots(
    city: string,
    page: number,
    pageSize: number,
  ): Observable<ApiResponse<PagedResponse<LotResponse>>> {
    return this.api.get<PagedResponse<LotResponse>>(PARKINGLOT_API.search, {
      city,
      page,
      pageSize,
    });
  }
}
