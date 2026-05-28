import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final branchManagerRepositoryProvider =
    Provider<BranchManagerRepository>((ref) {
  return BranchManagerRepository(ref.read(dioProvider), ref);
});

class BranchManagerRepository {
  BranchManagerRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> getBranchId() async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  Future<Map<String, dynamic>> _branchQuery(
      [Map<String, dynamic>? query]) async {
    final branchId = await getBranchId();
    return {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...?query,
    };
  }

  Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }

  Map<String, dynamic> unwrapMap(dynamic data) {
    final map = _asMap(data);
    final payload = map['data'] ?? map['result'] ?? map['payload'];
    if (payload is Map) return Map<String, dynamic>.from(payload);
    return map;
  }

  List<Map<String, dynamic>> unwrapList(dynamic data) {
    final map = data is Map ? data : null;
    final payload = map == null
        ? data
        : map['data'] ??
            map['items'] ??
            map['rows'] ??
            map['records'] ??
            map['results'] ??
            map['bookings'] ??
            map['guests'] ??
            map['staff'] ??
            map['rooms'] ??
            map['tasks'] ??
            map['requests'] ??
            map['orders'] ??
            map['clearances'];
    if (payload is List) {
      return payload
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    if (payload is Map) {
      for (final key in const [
        'data',
        'items',
        'rows',
        'records',
        'results',
        'bookings',
        'guests',
        'staff',
        'rooms',
        'tasks',
        'requests',
        'orders',
        'clearances',
      ]) {
        final nested = payload[key];
        if (nested is List) {
          return nested
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList();
        }
      }
      return [Map<String, dynamic>.from(payload)];
    }
    return <Map<String, dynamic>>[];
  }

  Future<Map<String, dynamic>> getMap(String endpoint,
      {Map<String, dynamic>? query, bool branchScoped = true}) async {
    final response = await _dio.get(
      endpoint,
      queryParameters: branchScoped ? await _branchQuery(query) : query,
    );
    return unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> getList(String endpoint,
      {Map<String, dynamic>? query, bool branchScoped = true}) async {
    final response = await _dio.get(
      endpoint,
      queryParameters: branchScoped ? await _branchQuery(query) : query,
    );
    return unwrapList(response.data);
  }

  Future<Map<String, dynamic>> postMap(String endpoint,
      {Map<String, dynamic>? data, bool branchScoped = true}) async {
    final body = {
      if (branchScoped) ...await _branchQuery(),
      ...?data,
    };
    final response = await _dio.post(endpoint, data: body);
    return unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> putMap(String endpoint,
      {Map<String, dynamic>? data, bool branchScoped = false}) async {
    final body = {
      if (branchScoped) ...await _branchQuery(),
      ...?data,
    };
    final response = await _dio.put(endpoint, data: body);
    return unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> patchMap(String endpoint,
      {Map<String, dynamic>? data, bool branchScoped = false}) async {
    final body = {
      if (branchScoped) ...await _branchQuery(),
      ...?data,
    };
    final response = await _dio.patch(endpoint, data: body);
    return unwrapMap(response.data);
  }

  Future<void> delete(String endpoint) async {
    await _dio.delete(endpoint);
  }

  Future<BranchManagerStats> getDashboardStats() async {
    final results = await Future.wait<Map<String, dynamic>>([
      _safeMap(() => getMap('/finance/dashboard')),
      _safeMap(() => getMap('/cashier/stats')),
      _safeMap(() => getMap('/store/dashboard/branch')),
    ]);
    final merged = <String, dynamic>{};
    for (final result in results) {
      merged.addAll(result);
    }
    return BranchManagerStats.fromJson(merged);
  }

  Future<List<RecentActivity>> getRecentActivity({int limit = 10}) async {
    final rows = await _safeList(
      () => getList('/cashier/recent-transactions', query: {'limit': limit}),
    );
    return rows.map(RecentActivity.fromJson).toList();
  }

  Future<List<Map<String, dynamic>>> getDashboardFeed() async {
    final results = await Future.wait<List<Map<String, dynamic>>>([
      _safeList(() => getList('/bookings', query: {'limit': 5})),
      _safeList(() => getList('/notifications', query: {'limit': 10})),
      _safeList(() => getList('/store/branch-stock/low')),
      _safeList(() => getList('/staff/performance', query: {'limit': 5})),
    ]);
    return [
      ...results[0].map((row) => {'type': 'Booking', ...row}),
      ...results[1].map((row) => {'type': 'Alert', ...row}),
      ...results[2].map((row) => {'type': 'Low stock', ...row}),
      ...results[3].map((row) => {'type': 'Staff KPI', ...row}),
    ];
  }

  Future<Map<String, dynamic>> branchSalesAnalytics({
    required String startDate,
    required String endDate,
    Map<String, dynamic> filters = const {},
  }) async {
    final branchId = await getBranchId();
    final response = await _dio.post('/analytics/branch-sales', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      'start_date': startDate,
      'end_date': endDate,
      'filters': filters,
    });
    return unwrapMap(response.data);
  }

  Future<File> exportBranchSales({
    required String startDate,
    required String endDate,
    required String format,
    Map<String, dynamic> filters = const {},
  }) async {
    final branchId = await getBranchId();
    final response = await _dio.post<List<int>>(
      '/analytics/branch-sales/export/$format',
      data: {
        if (branchId.isNotEmpty)
          'branch_id': int.tryParse(branchId) ?? branchId,
        'start_date': startDate,
        'end_date': endDate,
        'filters': filters,
      },
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(
      response.data ?? const <int>[],
      'branch_sales_$startDate-$endDate.$format',
    );
  }

  Future<List<Map<String, dynamic>>> getCashierClearances({
    String? date,
    String? status,
  }) {
    return getList('/cashier/clearances', query: {
      if (date != null && date.isNotEmpty) 'date': date,
      if (status != null && status != 'all') 'status': status,
    });
  }

  Future<void> approveClearance(String id, {String? notes}) async {
    await _dio.post('/cashier/clearances/$id/approve', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> flagClearance(String id,
      {required String reason, String? notes}) async {
    await _dio.post('/cashier/clearances/$id/flag', data: {
      'reason': reason,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<Map<String, dynamic>> getSoldItemsAnalytics({
    required String startDate,
    required String endDate,
    String? search,
  }) {
    return getMap('/auditor/verify/sold-items', query: {
      'start_date': startDate,
      'end_date': endDate,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> waiterSales({
    String period = 'today',
    String? date,
  }) {
    return getList('/restaurant/waiter-sales', query: {
      'period': period,
      if (date != null) 'date': date,
    });
  }

  Future<List<Map<String, dynamic>>> bookings({
    String? status,
    String? dateField,
    String? date,
    String? search,
  }) {
    return getList('/bookings', query: {
      if (status != null && status != 'all') 'status': status,
      if (dateField != null && date != null) dateField: date,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    });
  }

  Future<Map<String, dynamic>> booking(String id) => getMap('/bookings/$id');

  Future<Map<String, dynamic>> createBooking(Map<String, dynamic> data) {
    return postMap('/bookings', data: data);
  }

  Future<void> updateBooking(String id, Map<String, dynamic> data) async {
    await putMap('/bookings/$id', data: data);
  }

  Future<void> checkIn(String id) async => putMap('/bookings/$id/check-in');

  Future<void> checkOut(String id) async => putMap('/bookings/$id/check-out');

  Future<void> cancelBooking(String id, {String? reason}) async {
    await putMap('/bookings/$id/cancel', data: {
      if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> availableRooms({
    required String checkIn,
    required String checkOut,
    int guests = 1,
  }) {
    return getList('/bookings/available', query: {
      'checkIn': checkIn,
      'checkOut': checkOut,
      'adults': guests,
    });
  }

  Future<List<Map<String, dynamic>>> rooms({String? status, String? search}) {
    return getList('/rooms', query: {
      if (status != null && status != 'all') 'status': status,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    });
  }

  Future<void> createRoom(Map<String, dynamic> data) async {
    await postMap('/rooms', data: data);
  }

  Future<void> updateRoom(String id, Map<String, dynamic> data) async {
    await putMap('/rooms/$id', data: data);
  }

  Future<void> deleteRoom(String id) => delete('/rooms/$id');

  Future<List<Map<String, dynamic>>> guests({String? search}) {
    return getList('/guests', query: {
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    });
  }

  Future<Map<String, dynamic>> guest(String id) => getMap('/guests/$id');

  Future<List<Map<String, dynamic>>> guestHistory(String id) {
    return getList('/guests/$id/history');
  }

  Future<Map<String, dynamic>> createGuest(Map<String, dynamic> data) {
    return postMap('/guests', data: data);
  }

  Future<void> updateGuest(String id, Map<String, dynamic> data) async {
    await putMap('/guests/$id', data: data);
  }

  Future<void> deleteGuest(String id) => delete('/guests/$id');

  Future<List<Map<String, dynamic>>> staff({
    String? department,
    String? search,
  }) {
    return getList('/staff', query: {
      if (department != null && department != 'all') 'department': department,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    });
  }

  Future<Map<String, dynamic>> staffMember(String id) => getMap('/staff/$id');

  Future<void> createStaff(Map<String, dynamic> data) async {
    await postMap('/staff', data: data);
  }

  Future<void> updateStaff(String id, Map<String, dynamic> data) async {
    await putMap('/staff/$id', data: data);
  }

  Future<void> deleteStaff(String id) => delete('/staff/$id');

  Future<List<Map<String, dynamic>>> staffPerformance({
    String period = 'month',
    String? department,
    String? staffId,
  }) {
    return getList('/staff/performance', query: {
      'period': period,
      if (department != null && department != 'all') 'department': department,
      if (staffId != null) 'staff_id': staffId,
    });
  }

  Future<List<Map<String, dynamic>>> staffAttendance({
    String? date,
    String? staffId,
  }) {
    return getList('/staff/attendance', query: {
      if (date != null) 'date': date,
      if (staffId != null) 'staff_id': staffId,
    });
  }

  Future<void> clockIn(String staffId) async {
    await postMap('/staff/attendance/clock-in', data: {'staff_id': staffId});
  }

  Future<void> clockOut(String staffId) async {
    await postMap('/staff/attendance/clock-out', data: {'staff_id': staffId});
  }

  Future<List<Map<String, dynamic>>> leaveRequests({
    String? status,
    String? staffId,
  }) {
    return getList('/staff/leave', query: {
      if (status != null && status != 'all') 'status': status,
      if (staffId != null) 'staff_id': staffId,
    });
  }

  Future<void> createLeaveRequest(Map<String, dynamic> data) async {
    await postMap('/staff/leave', data: data);
  }

  Future<void> approveLeave(String id, {String? notes}) async {
    await putMap('/staff/leave/$id/approve', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> rejectLeave(String id, {String? reason}) async {
    await putMap('/staff/leave/$id/reject', data: {
      if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
    });
  }

  Future<void> reportToDuty(String id) async {
    await putMap('/staff/leave/$id/report-to-duty');
  }

  Future<List<Map<String, dynamic>>> staffDocuments(String staffId) {
    return getList('/staff/$staffId/documents');
  }

  Future<List<Map<String, dynamic>>> branchStock({
    String? search,
    String? status,
  }) {
    return getList('/store/branch-stock', query: {
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (status == 'low') 'low_stock': true,
      if (status == 'out') 'out_of_stock': true,
    });
  }

  Future<Map<String, dynamic>> stockAnalytics({String period = 'month'}) {
    return getMap('/store/consumption-trends', query: {'period': period});
  }

  Future<List<Map<String, dynamic>>> stockOut() {
    return getList('/store/stock-movements',
        query: {'movement_type': 'STOCK_OUT'});
  }

  Future<void> createStockRequest(Map<String, dynamic> data) async {
    await postMap('/store/stock-requests', data: data);
  }

  Future<List<Map<String, dynamic>>> restaurantOrders() {
    return getList('/restaurant/orders', query: {'limit': 25});
  }

  Future<List<Map<String, dynamic>>> restaurantMenuItems({
    String? category,
    bool? available,
  }) {
    return getList('/restaurant/menu/items', query: {
      if (category != null && category != 'all') 'category': category,
      if (available != null) 'available': available,
    });
  }

  Future<List<Map<String, dynamic>>> restaurantCategories() {
    return getList('/restaurant/menu/categories');
  }

  Future<void> createRestaurantMenuItem(Map<String, dynamic> data) async {
    await postMap('/restaurant/menu/items', data: data);
  }

  Future<void> updateRestaurantMenuItem(
      String id, Map<String, dynamic> data) async {
    await putMap('/restaurant/menu/items/$id', data: data);
  }

  Future<void> deleteRestaurantMenuItem(String id) {
    return delete('/restaurant/menu/items/$id');
  }

  Future<void> toggleRestaurantMenuItem(String id) async {
    await putMap('/restaurant/menu/items/$id/toggle');
  }

  Future<void> createRestaurantCategory(Map<String, dynamic> data) async {
    await postMap('/restaurant/menu/categories', data: data);
  }

  Future<List<Map<String, dynamic>>> barDrinks({String? category}) {
    return getList('/bar/drinks', query: {
      if (category != null && category != 'all') 'category': category,
    });
  }

  Future<List<Map<String, dynamic>>> barCategories() {
    return getList('/bar/categories');
  }

  Future<void> createBarDrink(Map<String, dynamic> data) async {
    await postMap('/bar/drinks', data: data);
  }

  Future<void> updateBarDrink(String id, Map<String, dynamic> data) async {
    await putMap('/bar/drinks/$id', data: data);
  }

  Future<void> deleteBarDrink(String id) => delete('/bar/drinks/$id');

  Future<void> toggleBarDrink(String id) async {
    await putMap('/bar/drinks/$id/toggle');
  }

  Future<void> createBarCategory(Map<String, dynamic> data) async {
    await postMap('/bar/categories', data: data);
  }

  Future<List<Map<String, dynamic>>> housekeepingTasks({String? status}) {
    return getList('/housekeeping/tasks', query: {
      if (status != null && status != 'all') 'status': status,
    });
  }

  Future<void> updateHousekeepingTask(String id, Map<String, dynamic> data) {
    return putMap('/housekeeping/tasks/$id', data: data);
  }

  Future<List<Map<String, dynamic>>> maintenanceRequests({String? status}) {
    return getList('/housekeeping/tasks', query: {
      'category': 'maintenance',
      if (status != null && status != 'all') 'status': status,
    });
  }

  Future<List<Map<String, dynamic>>> wastage({
    String? startDate,
    String? endDate,
    String? reason,
  }) {
    return getList('/wastage', query: {
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
      if (reason != null && reason != 'all') 'reason': reason,
    });
  }

  Future<void> recordWastage(Map<String, dynamic> body) async {
    await postMap('/wastage', data: body);
  }

  Future<File> exportReport(String type,
      {Map<String, dynamic> data = const {}}) async {
    final response = await _dio.post<List<int>>(
      '/reports/export',
      data: {'type': type, ...data},
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(response.data ?? const <int>[], '$type.pdf');
  }

  Future<File> exportCurrentRows({
    required String name,
    required List<Map<String, dynamic>> rows,
  }) async {
    final columns = <String>{
      for (final row in rows) ...row.keys.take(12),
    }.toList();
    final csv = [
      columns.map(_csv).join(','),
      ...rows.map(
          (row) => columns.map((key) => _csv('${row[key] ?? ''}')).join(',')),
    ].join('\n');
    return _saveBytes(csv.codeUnits, '$name.csv');
  }

  Future<Map<String, dynamic>> _safeMap(
      Future<Map<String, dynamic>> Function() action) async {
    try {
      return await action();
    } catch (_) {
      return <String, dynamic>{};
    }
  }

  Future<List<Map<String, dynamic>>> _safeList(
      Future<List<Map<String, dynamic>>> Function() action) async {
    try {
      return await action();
    } catch (_) {
      return <Map<String, dynamic>>[];
    }
  }

  String _csv(String value) => '"${value.replaceAll('"', '""')}"';

  Future<File> _saveBytes(List<int> bytes, String filename) async {
    final dir = await getApplicationDocumentsDirectory();
    final clean = filename.replaceAll(RegExp(r'[^A-Za-z0-9._-]+'), '_');
    final file = File('${dir.path}/$clean');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }
}
