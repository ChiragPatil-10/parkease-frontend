import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { BOOKING_API } from '../constants/booking.constants';
import { ApiResponse } from '../models/api-response.model';
import {
  BookingResponse,
  CancelBookingRequest,
  CreateBookingRequest,
  ManagerLotBooking,
} from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly api = inject(ApiService);

  createBooking(request: CreateBookingRequest): Observable<ApiResponse<BookingResponse>> {
    return this.api.post<BookingResponse>(BOOKING_API.create, request);
  }

  /** All of the caller's bookings, newest first, no pagination. */
  getMyBookings(): Observable<ApiResponse<BookingResponse[]>> {
    return this.api.get<BookingResponse[]>(BOOKING_API.my);
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

  /**
   * A manager's own lot, newest first. `status` is omitted for "All". The array has no total:
   * exactly `pageSize` rows means another page may exist.
   */
  getLotBookings(
    lotId: string,
    status: string | null,
    page: number,
    pageSize: number,
  ): Observable<ApiResponse<ManagerLotBooking[]>> {
    const params: Record<string, string | number> = { page, pageSize };
    if (status) {
      params['status'] = status;
    }
    return this.api.get<ManagerLotBooking[]>(BOOKING_API.byLot(lotId), params);
  }
}
