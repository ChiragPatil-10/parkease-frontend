import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { BOOKING_API } from '../constants/booking.constants';
import { ApiResponse } from '../models/api-response.model';
import { BookingResponse, CancelBookingRequest, CreateBookingRequest } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly api = inject(ApiService);

  createBooking(request: CreateBookingRequest): Observable<ApiResponse<BookingResponse>> {
    return this.api.post<BookingResponse>(BOOKING_API.create, request);
  }

  getBookingById(bookingId: string): Observable<ApiResponse<BookingResponse>> {
    return this.api.get<BookingResponse>(BOOKING_API.byId(bookingId));
  }

  /** Synchronous: 200 returns the booking as CheckedIn. */
  checkIn(bookingId: string): Observable<ApiResponse<BookingResponse>> {
    return this.api.post<BookingResponse>(BOOKING_API.checkIn(bookingId), {});
  }

  /** The response still says CheckedIn; the booking completes afterwards, so poll for Completed. */
  checkOut(bookingId: string): Observable<ApiResponse<BookingResponse>> {
    return this.api.post<BookingResponse>(BOOKING_API.checkOut(bookingId), {});
  }

  /** The response still shows the old status; the booking becomes Cancelled afterwards, so poll. */
  cancelBooking(bookingId: string, reason: string): Observable<ApiResponse<BookingResponse>> {
    const body: CancelBookingRequest = { reason };
    return this.api.post<BookingResponse>(BOOKING_API.cancel(bookingId), body);
  }
}
