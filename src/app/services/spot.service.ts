import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { SPOT_API } from '../constants/spot.constants';
import { ApiResponse } from '../models/api-response.model';
import { BulkCreateSpotsRequest, SpotCreateItem, SpotResponse } from '../models/spot.model';

@Injectable({ providedIn: 'root' })
export class SpotService {
  private readonly api = inject(ApiService);

  getSpotsByLot(lotId: string): Observable<ApiResponse<SpotResponse[]>> {
    return this.api.get<SpotResponse[]>(SPOT_API.byLot(lotId));
  }

  bulkCreateSpots(lotId: string, spots: SpotCreateItem[]): Observable<ApiResponse<SpotResponse[]>> {
    const request: BulkCreateSpotsRequest = { lotId, spots };
    return this.api.post<SpotResponse[]>(SPOT_API.bulkCreate, request);
  }
}
