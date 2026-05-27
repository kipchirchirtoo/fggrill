import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final bookingServiceProvider = Provider<BookingService>((ref) {
  return BookingService(ref.watch(dioProvider));
});

class BookingService extends BaseApiService {
  BookingService(super.dio);

  // GET /api/bookings
  Future<Map<String, dynamic>> getBookings({
    String? status,
    String? search,
    String? checkInFrom,
    String? checkInTo,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (search != null) 'search': search,
      if (checkInFrom != null) 'checkInFrom': checkInFrom,
      if (checkInTo != null) 'checkInTo': checkInTo,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/bookings', queryParameters: query);
    return response;
  }

  // GET /api/bookings/:id
  Future<Map<String, dynamic>> getBooking(String id) async {
    final response = await get<Map<String, dynamic>>('/bookings/$id');
    return response;
  }

  // POST /api/bookings
  Future<Map<String, dynamic>> createBooking(
      Map<String, dynamic> bookingData) async {
    final response =
        await post<Map<String, dynamic>>('/bookings', data: bookingData);
    return response;
  }

  // PUT /api/bookings/:id
  Future<Map<String, dynamic>> updateBooking(
      String id, Map<String, dynamic> bookingData) async {
    final response =
        await put<Map<String, dynamic>>('/bookings/$id', data: bookingData);
    return response;
  }

  // PATCH /api/bookings/:id/status
  Future<Map<String, dynamic>> updateBookingStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/bookings/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // DELETE /api/bookings/:id
  Future<Map<String, dynamic>> cancelBooking(String id,
      {String? reason}) async {
    final queryParams = <String, dynamic>{};
    if (reason != null) queryParams['reason'] = reason;
    final response = await delete<Map<String, dynamic>>(
      '/bookings/$id',
      queryParameters: queryParams.isNotEmpty ? queryParams : null,
    );
    return response;
  }

  // POST /api/bookings/:id/check-in
  Future<Map<String, dynamic>> checkIn(String id,
      {String? roomNumber, String? keyCardNumber}) async {
    final data = <String, dynamic>{};
    if (roomNumber != null) data['roomNumber'] = roomNumber;
    if (keyCardNumber != null) data['keyCardNumber'] = keyCardNumber;
    final response = await post<Map<String, dynamic>>(
      '/bookings/$id/check-in',
      data: data.isNotEmpty ? data : null,
    );
    return response;
  }

  // POST /api/bookings/:id/check-out
  Future<Map<String, dynamic>> checkOut(String id) async {
    final response =
        await post<Map<String, dynamic>>('/bookings/$id/check-out');
    return response;
  }

  // GET /api/bookings/stats
  Future<Map<String, dynamic>> getBookingStats(
      {int? branchId, String? period}) async {
    final query = {
      if (branchId != null) 'branchId': branchId,
      if (period != null) 'period': period,
    };
    final response = await get<Map<String, dynamic>>('/bookings/stats',
        queryParameters: query);
    return response;
  }

  // GET /api/bookings/availability
  Future<Map<String, dynamic>> checkAvailability({
    required String checkIn,
    required String checkOut,
    String? roomType,
    int? branchId,
  }) async {
    final query = {
      'checkIn': checkIn,
      'checkOut': checkOut,
      if (roomType != null) 'roomType': roomType,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/bookings/availability',
        queryParameters: query);
    return response;
  }

  // POST /api/bookings/:id/add-service
  Future<Map<String, dynamic>> addService(
      String id, Map<String, dynamic> service) async {
    final response = await post<Map<String, dynamic>>(
        '/bookings/$id/add-service',
        data: service);
    return response;
  }

  // GET /api/bookings/:id/folio
  Future<Map<String, dynamic>> getBookingFolio(String id) async {
    final response = await get<Map<String, dynamic>>('/bookings/$id/folio');
    return response;
  }
}
