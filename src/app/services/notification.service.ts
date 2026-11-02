import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { NOTIFICATION_API } from '../constants/notification.constants';
import { ApiResponse } from '../models/api-response.model';
import { NotificationResponse } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly api = inject(ApiService);

  /** One page of the caller's email history, newest first. `page` is 1-based; the data is a flat array with no total. */
  getMyNotifications(
    page: number,
    pageSize: number,
  ): Observable<ApiResponse<NotificationResponse[]>> {
    return this.api.get<NotificationResponse[]>(NOTIFICATION_API.myHistory, { page, pageSize });
  }
}
