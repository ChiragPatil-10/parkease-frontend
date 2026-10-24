import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { BOOKING_API } from '../constants/booking.constants';
import { ApiResponse } from '../models/api-response.model';
import { BookingResponse, CreateBookingRequest } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly api = inject(ApiService);

  createBooking(request: CreateBookingRequest): Observable<ApiResponse<BookingResponse>> {
    return this.api.post<BookingResponse>(BOOKING_API.create, request);
  }

  getBookingById(bookingId: string): Observable<ApiResponse<BookingResponse>> {
    return this.api.get<BookingResponse>(BOOKING_API.byId(bookingId));
  }
}
