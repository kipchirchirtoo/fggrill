import 'dart:developer' as dev;
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
    if (branchId.isEmpty) {
      dev.log('WARNING: branchId is empty — branch_id will be omitted from request',
          name: 'BranchManagerRepository');
    }
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
    const listKeys = [
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
      'movements',
      'transactions',
      'sales',
      'stock',
      'stocks',
      'inventory',
      'inventory_items',
      'stock_items',
      'menu_items',
      'waiter_sales',
      'drinks',
      'categories',
      'attendances',
      'leave_requests',
    ];
    dynamic payload = data;
    if (map != null) {
      payload = null;
      for (final key in listKeys) {
        if (map[key] != null) {
          payload = map[key];
          break;
        }
      }
      payload ??= map;
    }
    if (payload is List) {
      return payload
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    if (payload is Map) {
      for (final key in listKeys) {
        final nested = payload[key];
        if (nested is List) {
          return nested
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList();
        }
        if (nested is Map) {
          final nestedRows = unwrapList(nested);
          if (nestedRows.isNotEmpty) return nestedRows;
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
    final today = _ymd(DateTime.now());
    final results = await Future.wait<dynamic>([
      branchSalesAnalytics(startDate: today, endDate: today),
      getList('/restaurant/orders', query: {
        'date': today,
        'limit': 100,
      }),
      getList('/rooms'),
      getList('/store/branch-stock/low'),
    ]);

    final sales = results[0] as Map<String, dynamic>;
    final salesSummary = _asMap(sales['summary']);
    final orders = (results[1] as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final activeOrders = orders.where((order) {
      final status = '${order['status'] ?? order['payment_status'] ?? ''}'
          .trim()
          .toLowerCase();
      return !{
        'paid',
        'completed',
        'complete',
        'cancelled',
        'canceled',
        'voided',
        'closed'
      }.contains(status);
    }).length;
    final rooms = (results[2] as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final lowStock = (results[3] as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    final occupiedRooms = rooms.where((room) {
      final status = '${room['status'] ?? room['room_status'] ?? ''}'
          .trim()
          .toLowerCase();
      return status == 'occupied' || status == 'checked_in';
    }).length;

    return BranchManagerStats(
      todayRevenue: _numFrom(salesSummary, const [
        'total_sales',
        'today_revenue',
        'todayRevenue',
        'revenue',
      ]).toDouble(),
      activeOrders: activeOrders,
      occupancyRate: rooms.isEmpty ? 0 : (occupiedRooms / rooms.length) * 100,
      lowStockItems: lowStock.length,
      totalRooms: rooms.length,
      occupiedRooms: occupiedRooms,
    );
  }

  Future<List<RecentActivity>> getRecentActivity({int limit = 10}) async {
    final rows = await _safeList(
      () => getList('/receipts',
          query: {'limit': limit, 'sort': 'created_at:desc'}),
    );
    return rows.map(RecentActivity.fromJson).toList();
  }

  Future<List<Map<String, dynamic>>> getDashboardFeed() async {
    final results = await Future.wait<List<Map<String, dynamic>>>([
      _safeList(() => getList('/bookings', query: {'limit': 5})),
      _safeList(() => getList('/staff/notifications', query: {'limit': 10})),
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
    final outer = _asMap(response.data);
    final data = _asMap(outer['data']);
    return {
      ...data,
      if (outer['metadata'] is Map)
        'metadata': Map<String, dynamic>.from(outer['metadata'] as Map),
    };
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
    return getList('/cashier-clearance', query: {
      if (date != null && date.isNotEmpty) 'date': date,
      if (status != null && status != 'all') 'status': status,
    });
  }

  Future<void> approveClearance(String id, {String? notes}) async {
    await _dio.post('/cashier-clearance/$id/approve', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> flagClearance(String id,
      {required String reason, String? notes}) async {
    await _dio.post('/cashier-clearance/$id/flag', data: {
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
    return getList('/waiter-sales', query: {
      'period': _periodDays(period),
      if (date != null) 'date': date,
    });
  }

  Future<Map<String, dynamic>> waiterSalesReport({
    String period = 'today',
    String? date,
  }) {
    return getMap('/waiter-sales', query: {
      'period': _periodDays(period),
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

  Future<void> checkIn(String id) async => postMap('/bookings/$id/check-in');

  Future<void> checkOut(String id) async => postMap('/bookings/$id/check-out');

  Future<void> cancelBooking(String id, {String? reason}) async {
    await delete('/bookings/$id');
  }

  Future<List<Map<String, dynamic>>> availableRooms({
    required String checkIn,
    required String checkOut,
    int guests = 1,
  }) {
    return getList('/bookings/availability', query: {
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

  Future<Map<String, dynamic>> createStaff(Map<String, dynamic> data) =>
      postMap('/staff', data: data);

  Future<List<Map<String, dynamic>>> users({String? search, String? role}) {
    return getList('/users', query: {
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (role != null && role != 'all') 'role': role,
    });
  }

  Future<Map<String, dynamic>> createUser(Map<String, dynamic> data) =>
      postMap('/users', data: data);

  Future<Map<String, dynamic>> updateUser(String id, Map<String, dynamic> data) =>
      putMap('/users/$id', data: data);

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

  Future<Map<String, dynamic>> staffPerformanceReport({
    int period = 30,
    String? department,
  }) {
    return getMap('/staff/performance', query: {
      'period': period,
      if (department != null && department != 'all') 'department': department,
    });
  }

  Future<List<Map<String, dynamic>>> staffAttendance({
    String? date,
    String? startDate,
    String? endDate,
    String? staffId,
  }) {
    return getList('/staff/attendance', query: {
      if (date != null) 'date': date,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
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
    try {
      await patchMap('/staff/leave/$id/status', data: {
        'status': 'approved',
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      });
    } catch (_) {}
  }

  Future<void> rejectLeave(String id, {String? reason}) async {
    try {
      await patchMap('/staff/leave/$id/status', data: {
        'status': 'rejected',
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      });
    } catch (_) {}
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
    return getMap('/store/consumption-trends',
        query: {'period': _periodDays(period)});
  }

  Future<List<Map<String, dynamic>>> stockOut() {
    return getList('/store/movements',
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

  // ── Discounts & Offers ────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> offers({
    String? targetType,
    String? active,
  }) {
    return getList('/offers', query: {
      if (targetType != null && targetType != 'all') 'target_type': targetType,
      if (active != null && active != 'all') 'active': active,
    });
  }

  Future<Map<String, dynamic>> createOffer(Map<String, dynamic> data) {
    return postMap('/offers', data: data);
  }

  Future<Map<String, dynamic>> updateOffer(String id, Map<String, dynamic> data) {
    return putMap('/offers/$id', data: data);
  }

  Future<void> toggleOffer(String id) async {
    await patchMap('/offers/$id/toggle');
  }

  Future<void> deleteOffer(String id) => delete('/offers/$id');

  Future<List<Map<String, dynamic>>> housekeepingTasks({String? status}) {
    return getList('/housekeeping/tasks', query: {
      if (status != null && status != 'all') 'status': status,
    });
  }

  Future<void> updateHousekeepingTask(String id, Map<String, dynamic> data) {
    return putMap('/housekeeping/tasks/$id', data: data);
  }

  Future<List<Map<String, dynamic>>> maintenanceRequests({String? status}) {
    return getList('/maintenance/requests', query: {
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
    try {
      final response = await _dio.post<List<int>>(
        '/reports/export',
        data: {'type': type, ...data},
        options: Options(responseType: ResponseType.bytes),
      );
      return _saveBytes(response.data ?? const <int>[], '$type.pdf');
    } catch (_) {
      return _saveBytes(const <int>[], '$type.pdf');
    }
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

  Future<List<Map<String, dynamic>>> _safeList(
      Future<List<Map<String, dynamic>>> Function() action) async {
    try {
      return await action();
    } catch (_) {
      return <Map<String, dynamic>>[];
    }
  }

  num _numFrom(Map<String, dynamic> row, List<String> keys) {
    for (final key in keys) {
      final value = row[key];
      if (value is num) return value;
      if (value is String) {
        final parsed = num.tryParse(value);
        if (parsed != null) return parsed;
      }
    }
    return 0;
  }

  String _ymd(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  String _csv(String value) => '"${value.replaceAll('"', '""')}"';

  int _periodDays(String period) {
    final numeric = int.tryParse(period);
    if (numeric != null && numeric > 0) return numeric;
    switch (period.toLowerCase()) {
      case 'today':
      case 'day':
        return 1;
      case 'week':
        return 7;
      case 'month':
        return 30;
      case 'quarter':
        return 90;
      case 'year':
        return 365;
      default:
        return 30;
    }
  }

  Future<File> _saveBytes(List<int> bytes, String filename) async {
    final dir = await getApplicationDocumentsDirectory();
    final clean = filename.replaceAll(RegExp(r'[^A-Za-z0-9._-]+'), '_');
    final file = File('${dir.path}/$clean');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  // ── Guest Reviews ──────────────────────────────────────────────────────
  // Backend scopes this list by the caller's own branch_id (from the JWT)
  // for non-global roles — branch_id is still sent as a query param too
  // (getList's default branchScoped behavior) but is a defensive no-op
  // server-side, not the actual scoping mechanism.
  Future<List<Map<String, dynamic>>> getReviews({
    bool? responded,
    int? rating,
    String? search,
  }) {
    return getList('/reviews/manager/list', query: {
      if (responded != null) 'responded': responded.toString(),
      if (rating != null) 'rating': rating,
      if (search != null && search.isNotEmpty) 'search': search,
    });
  }

  /// Publishes a public reply to a review, or clears an existing one when
  /// [responseText] is empty (matches the backend's toggle-by-emptiness
  /// semantics).
  Future<Map<String, dynamic>> respondToReview(
    String id,
    String responseText,
  ) {
    return patchMap(
      '/reviews/manager/$id/respond',
      data: {'response_text': responseText},
      branchScoped: false,
    );
  }
}
