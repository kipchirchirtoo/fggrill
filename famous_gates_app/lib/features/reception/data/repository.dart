import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final receptionRepositoryProvider = Provider<ReceptionRepository>((ref) {
  return ReceptionRepository(
    ref.read(dioProvider),
    ref.read(pythonDioProvider),
    ref,
  );
});

class ReceptionRepository {
  ReceptionRepository(this._dio, this._pythonDio, this._ref);

  final Dio _dio;
  final Dio _pythonDio;
  final Ref _ref;

  Future<String> get _branchId async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  Future<Map<String, dynamic>> _branchParams(
      [Map<String, dynamic>? params]) async {
    final branchId = await _branchId;
    return {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      ...?params,
    };
  }

  Map<String, dynamic> _payload(dynamic data) {
    if (data is Map<String, dynamic>) {
      final nested = data['data'];
      if (nested is Map<String, dynamic>) return nested;
      return data;
    }
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }

  List<Map<String, dynamic>> _mapList(dynamic data) {
    dynamic value = data;
    if (value is Map) {
      value = value['data'] ??
          value['items'] ??
          value['rows'] ??
          value['bookings'] ??
          value['rooms'] ??
          value['guests'] ??
          value['tasks'] ??
          value['payments'] ??
          value['bills'] ??
          value['credit_bills'] ??
          value['creditBills'] ??
          value['transactions'] ??
          const [];
    }
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  List<T> _parseList<T>(
      dynamic data, T Function(Map<String, dynamic>) fromJson) {
    return _mapList(data).map(fromJson).toList();
  }

  Future<List<Booking>> getBookings(
      {String? status, Map<String, dynamic>? params}) async {
    final response = await _dio.get('/bookings',
        queryParameters: await _branchParams({
          if (status != null) 'status': status,
          ...?params,
        }));
    return _parseList(response.data, Booking.fromJson);
  }

  Future<List<Map<String, dynamic>>> getBookingRows(
      {Map<String, dynamic>? params}) async {
    final response = await _dio.get('/bookings',
        queryParameters: await _branchParams(params));
    return _mapList(response.data);
  }

  Future<Map<String, dynamic>> getBooking(String id) async {
    final response = await _dio.get('/bookings/$id');
    return _payload(response.data);
  }

  Future<Booking> createBooking(Map<String, dynamic> data) async {
    final response =
        await _dio.post('/bookings', data: await _withBranch(data));
    return Booking.fromJson(_payload(response.data));
  }

  Future<Map<String, dynamic>> createBookingRow(
      Map<String, dynamic> data) async {
    final response =
        await _dio.post('/bookings', data: await _withBranch(data));
    return _payload(response.data);
  }

  Future<void> updateBooking(
      String bookingId, Map<String, dynamic> data) async {
    await _dio.put('/bookings/$bookingId', data: data);
  }

  Future<void> cancelBooking(String bookingId, {String? reason}) async {
    await _dio.put('/bookings/$bookingId/cancel',
        data: {if (reason != null && reason.isNotEmpty) 'reason': reason});
  }

  Future<void> checkIn(String bookingId) async {
    await _dio.put('/bookings/$bookingId/check-in');
  }

  Future<void> checkOut(String bookingId) async {
    await _dio.put('/bookings/$bookingId/check-out');
  }

  Future<List<Map<String, dynamic>>> getAvailableRooms(
      Map<String, dynamic> params) async {
    final response = await _dio.get('/bookings/available',
        queryParameters: await _branchParams(params));
    return _mapList(response.data);
  }

  Future<Map<String, dynamic>> getQuote(Map<String, dynamic> data) async {
    final response =
        await _dio.post('/bookings/quote', data: await _withBranch(data));
    return _payload(response.data);
  }

  Future<List<Room>> getRooms({Map<String, dynamic>? params}) async {
    final response =
        await _dio.get('/rooms', queryParameters: await _branchParams(params));
    return _parseList(response.data, Room.fromJson);
  }

  Future<List<Map<String, dynamic>>> getRoomRows(
      {Map<String, dynamic>? params}) async {
    final response =
        await _dio.get('/rooms', queryParameters: await _branchParams(params));
    return _mapList(response.data);
  }

  Future<Map<String, dynamic>> getRoom(String id) async {
    final response = await _dio.get('/rooms/$id');
    return _payload(response.data);
  }

  Future<List<Map<String, dynamic>>> getRoomTypes() async {
    final response = await _dio.get('/rooms/types');
    return _mapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getRoomBookings(String roomId) async {
    final response = await _dio.get('/rooms/$roomId/bookings');
    return _mapList(response.data);
  }

  Future<void> updateRoomStatus(String roomId, String status) async {
    await _dio.patch('/rooms/$roomId/status', data: {'status': status});
  }

  Future<List<Guest>> getGuests({String? search}) async {
    final response = await _dio.get('/guests',
        queryParameters: await _branchParams({
          if (search != null && search.isNotEmpty) 'search': search,
        }));
    return _parseList(response.data, Guest.fromJson);
  }

  Future<List<Map<String, dynamic>>> getGuestRows({String? search}) async {
    final response = await _dio.get('/guests',
        queryParameters: await _branchParams({
          if (search != null && search.isNotEmpty) 'search': search,
        }));
    return _mapList(response.data);
  }

  Future<Map<String, dynamic>> getGuest(String id) async {
    final response = await _dio.get('/guests/$id');
    return _payload(response.data);
  }

  Future<Map<String, dynamic>> createGuest(Map<String, dynamic> data) async {
    final response = await _dio.post('/guests', data: await _withBranch(data));
    return _payload(response.data);
  }

  Future<void> updateGuest(String id, Map<String, dynamic> data) async {
    await _dio.put('/guests/$id', data: data);
  }

  Future<void> deleteGuest(String id) async {
    await _dio.delete('/guests/$id');
  }

  Future<List<Map<String, dynamic>>> getGuestHistory(String id) async {
    final response = await _dio.get('/guests/$id/history');
    return _mapList(response.data);
  }

  Future<Map<String, dynamic>> getGuestLoyalty(String id) async {
    final response = await _dio.get('/guests/$id/loyalty');
    return _payload(response.data);
  }

  Future<List<Map<String, dynamic>>> getConferenceHalls() async {
    final response = await _dio.get('/conference/halls',
        queryParameters: await _branchParams());
    return _mapList(response.data);
  }

  Future<void> updateConferenceHall(
      String id, Map<String, dynamic> data) async {
    await _dio.patch('/conference/halls/$id', data: data);
  }

  Future<List<Map<String, dynamic>>> getConferenceBookings(
      {Map<String, dynamic>? params}) async {
    final response = await _dio.get('/conference/bookings',
        queryParameters: await _branchParams(params));
    return _mapList(response.data);
  }

  Future<Map<String, dynamic>> createConferenceBooking(
      Map<String, dynamic> data) async {
    final response =
        await _dio.post('/conference/bookings', data: await _withBranch(data));
    return _payload(response.data);
  }

  Future<void> updateConferenceBookingStatus(String id, String status) async {
    await _dio
        .patch('/conference/bookings/$id/status', data: {'status': status});
  }

  Future<void> addConferencePayment(
      String id, Map<String, dynamic> data) async {
    await _dio.post('/conference/bookings/$id/payments', data: data);
  }

  Future<List<Map<String, dynamic>>> getCateringBookings(
      {Map<String, dynamic>? params}) async {
    final response = await _dio.get('/catering-bookings',
        queryParameters: await _branchParams(params));
    return _mapList(response.data);
  }

  Future<Map<String, dynamic>> createCateringBooking(
      Map<String, dynamic> data) async {
    final response =
        await _dio.post('/catering-bookings', data: await _withBranch(data));
    return _payload(response.data);
  }

  Future<void> updateCateringBooking(
      String id, Map<String, dynamic> data) async {
    await _dio.put('/catering-bookings/$id', data: data);
  }

  Future<void> cancelCateringBooking(String id) async {
    await _dio.post('/catering-bookings/$id/cancel');
  }

  Future<void> recordCateringPayment(String id, num amount) async {
    await _dio.post('/catering-bookings/$id/payment', data: {'amount': amount});
  }

  Future<List<Map<String, dynamic>>> getHousekeepingTasks(
      {Map<String, dynamic>? params}) async {
    final response = await _dio.get('/housekeeping/tasks',
        queryParameters: await _branchParams(params));
    return _mapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getHousekeepingRoomGrid() async {
    final response = await _dio.get('/housekeeping/dashboard/room-grid',
        queryParameters: await _branchParams());
    return _mapList(response.data);
  }

  Future<void> createHousekeepingGuestRequest(Map<String, dynamic> data) async {
    await _dio.post('/housekeeping/guest-requests',
        data: await _withBranch(data));
  }

  Future<void> updateHousekeepingTaskStatus(String id, String status) async {
    await _dio.put('/housekeeping/tasks/$id/status', data: {'status': status});
  }

  Future<void> updateHousekeepingRoomStatus(String id, String status) async {
    await _dio.put('/housekeeping/rooms/$id/status', data: {'status': status});
  }

  Future<Map<String, dynamic>> getCashierStats() async {
    final response = await _dio.get('/cashier/stats',
        queryParameters: await _branchParams());
    return _payload(response.data);
  }

  Future<List<Map<String, dynamic>>> getCashierPayments(
      {int limit = 50}) async {
    final response = await _dio.get('/payments-verification',
        queryParameters: await _branchParams({'limit': limit}));
    return _mapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getUnpaidBills() async {
    final response = await _dio.get('/cashier/unpaid-bills',
        queryParameters: await _branchParams());
    return _mapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getCreditBills() async {
    final response = await _dio.get('/cashier/credit-bills',
        queryParameters: await _branchParams());
    return _mapList(response.data);
  }

  Future<Map<String, dynamic>> createDynamicBill(
      Map<String, dynamic> data) async {
    final response =
        await _dio.post('/cashier/unpaid-bills', data: await _withBranch(data));
    return _payload(response.data);
  }

  Future<void> recordBillPayment(String id, Map<String, dynamic> data) async {
    await _dio.post('/cashier/unpaid-bills/$id/payment', data: data);
  }

  Future<Map<String, dynamic>> getLogbookToday() async {
    final response = await _dio.get('/cashier/logbook/today');
    return _payload(response.data);
  }

  Future<void> saveLogbook(Map<String, dynamic> data) async {
    await _dio.post('/cashier/logbook', data: await _withBranch(data));
  }

  Future<void> clockAttendance(String action) async {
    final endpoint = action == 'out'
        ? '/staff/attendance/clock-out'
        : '/staff/attendance/clock-in';
    await _dio.post(endpoint);
  }

  Future<void> requestPettyCash(Map<String, dynamic> data) async {
    await _dio.post('/petty-cash', data: await _withBranch(data));
  }

  Future<Map<String, dynamic>> verifyCheckoutAnomaly(
      Map<String, dynamic> data) async {
    final response =
        await _pythonDio.post('/api/finance/verify-anomaly', data: data);
    return _payload(response.data);
  }

  Future<File> downloadCheckoutBill(Map<String, dynamic> data) async {
    final response = await _pythonDio.post(
      '/api/reports/generate/checkout-bill',
      data: data,
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(response.data ?? const <int>[],
        'checkout_bill_${DateTime.now().millisecondsSinceEpoch}.pdf');
  }

  Future<File> downloadConferenceInvoice(String bookingId) async {
    final response = await _dio.get(
      '/conference/bookings/$bookingId/invoice',
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(
        response.data ?? const <int>[], 'conference_invoice_$bookingId.pdf');
  }

  Future<Map<String, dynamic>> _withBranch(Map<String, dynamic> data) async {
    final branchId = await _branchId;
    return {
      ...data,
      if (branchId.isNotEmpty &&
          !data.containsKey('branch_id') &&
          !data.containsKey('branchId'))
        'branch_id': branchId,
    };
  }

  Future<File> _saveBytes(List<int> bytes, String filename) async {
    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final file = File('${directory.path}/$filename');
    return file.writeAsBytes(bytes, flush: true);
  }
}
