import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import '../../../core/network/dio_client.dart';
import 'models/admin_dashboard.dart';
import 'models/branch.dart';
import 'models/system_user.dart';
import 'models/room.dart';
import 'models/guest.dart';
import 'models/menu_item.dart';
import 'models/inventory_item.dart';
import 'models/supplier.dart';
import 'models/vehicle.dart';
import 'models/audit_log.dart';
import 'models/notification.dart';
import 'models/system_config.dart';
import 'models/ai_analytics.dart';

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  return AdminRepository(ref.read(dioProvider));
});

class AdminRepository {
  final Dio _dio;
  AdminRepository(this._dio);

  Map<String, dynamic> _unwrap(dynamic data) {
    if (data is Map && data['success'] == true) {
      return data['data'] is Map
          ? Map<String, dynamic>.from(data['data'])
          : Map<String, dynamic>.from(data);
    }
    return Map<String, dynamic>.from(data ?? {});
  }

  Future<File> _downloadGet(
    String endpoint, {
    required String filename,
    Map<String, dynamic> queryParameters = const {},
    Options? options,
  }) async {
    final response = await _dio.get<List<int>>(
      endpoint,
      queryParameters: queryParameters,
      options:
          (options ?? Options()).copyWith(responseType: ResponseType.bytes),
    );
    return _saveBytes(response.data ?? const <int>[], filename);
  }

  Future<File> _saveBytes(List<int> bytes, String filename) async {
    if (bytes.isEmpty) throw StateError('Downloaded file was empty');
    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final safeName = filename.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final file = File('${directory.path}/$safeName');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  String _today() => DateTime.now().toIso8601String().split('T').first;

  List<T> _parseList<T>(
      dynamic data, T Function(Map<String, dynamic>) fromJson) {
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((json) => fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  List<Map<String, dynamic>> _parseMapList(dynamic data) {
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((json) => Map<String, dynamic>.from(json))
        .toList();
  }

  String _asString(dynamic value) {
    if (value == null) return '';
    final text = '$value';
    return text == 'null' ? '' : text;
  }

  String _resolvePhotoUrl(String url) {
    if (url.isEmpty) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return '';
  }

  Map<String, dynamic> _normalizeNotification(Map<String, dynamic> json) {
    return {
      'id': _asString(json['id']),
      'title': _asString(json['title']).isNotEmpty
          ? _asString(json['title'])
          : _asString(json['type']).isNotEmpty
              ? _asString(json['type'])
              : 'Notification',
      'message': _asString(json['message'] ?? json['body'] ?? json['content']),
      'type':
          _asString(json['type']).isNotEmpty ? _asString(json['type']) : 'info',
      'isRead': json['isRead'] == true ||
          json['is_read'] == true ||
          json['read'] == true,
      'link': _asString(json['link'] ?? json['url']),
      'createdAt': _asString(json['createdAt'] ?? json['created_at']),
    };
  }

  Map<String, dynamic> _parseMap(dynamic data) {
    final payload = data is Map && data['data'] is Map ? data['data'] : data;
    return Map<String, dynamic>.from(payload ?? {});
  }

  int _asInt(dynamic value) {
    if (value == null) return 0;
    if (value is int) return value;
    if (value is num) return value.round();
    return int.tryParse('$value') ?? double.tryParse('$value')?.round() ?? 0;
  }

  double _asDouble(dynamic value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? 0;
  }

  int _countFromEnvelope(dynamic data) {
    if (data is Map) {
      final explicitCount = data['count'] ??
          data['total'] ??
          data['total_count'] ??
          data['pagination']?['total'] ??
          data['meta']?['total'];
      if (explicitCount != null) return _asInt(explicitCount);
      final rows = data['data'];
      if (rows is List) return rows.length;
    }
    if (data is List) return data.length;
    return 0;
  }

  List<Map<String, dynamic>> _mapList(dynamic value) {
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Map<String, dynamic> _buildAdminDashboardPayload({
    required Map<String, dynamic> report,
    required Map<String, dynamic> context,
    required Map<String, dynamic> systemStats,
    required int staffCount,
  }) {
    final branches = Map<String, dynamic>.from(context['branches'] ?? {});
    final users = Map<String, dynamic>.from(context['users'] ?? {});
    final revenue = Map<String, dynamic>.from(context['revenue'] ?? {});
    final bookings = Map<String, dynamic>.from(context['bookings'] ?? {});
    final anomalies = Map<String, dynamic>.from(context['anomalies'] ?? {});
    final security = Map<String, dynamic>.from(context['security'] ?? {});
    final hr = Map<String, dynamic>.from(context['hr'] ?? {});
    final audit = Map<String, dynamic>.from(context['audit'] ?? {});
    final reportBookings = Map<String, dynamic>.from(report['bookings'] ?? {});
    final reportOccupancy =
        Map<String, dynamic>.from(report['occupancy'] ?? {});

    final totalBranches = _asInt(
      branches['total'] ??
          systemStats['total_branches'] ??
          systemStats['branches_count'],
    );
    final totalUsers = _asInt(
      users['total'] ??
          systemStats['total_users'] ??
          systemStats['users_count'],
    );
    final totalStaff = staffCount > 0 ? staffCount : totalUsers;
    final activeBookings =
        _asInt(bookings['active'] ?? reportBookings['upcoming']);
    final todayRevenue =
        _asDouble(revenue['total_24h'] ?? reportBookings['today_revenue']);
    final monthlyRevenue = _asDouble(
      revenue['total_30d'] ??
          revenue['month_to_date'] ??
          reportBookings['revenue'] ??
          revenue['total_7d'],
    );
    final pendingActions = _asInt(anomalies['critical_count']) +
        _asInt(anomalies['high_count']) +
        _asInt(hr['pending_leaves']) +
        _asInt(security['failed_logins_24h']) +
        _asInt(revenue['open_shifts_now']);
    final occupancyPercent = _asDouble(reportOccupancy['current']);
    final totalRooms = occupancyPercent > 0 ? 100 : 0;
    final occupiedRooms = activeBookings > 0
        ? activeBookings
        : occupancyPercent > 0
            ? occupancyPercent.round()
            : 0;

    return {
      'logins_today': _asInt(bookings['active'] ?? reportBookings['total']),
      'failed_logins': pendingActions,
      'active_sessions': totalUsers,
      'total_branches': totalBranches,
      'total_users': totalUsers,
      'total_staff': totalStaff,
      'total_rooms': totalRooms,
      'occupied_rooms': occupiedRooms,
      'today_revenue': todayRevenue,
      'monthly_revenue': monthlyRevenue,
      'revenueTrend': _buildRevenueTrend(revenue),
      'occupancyTrend': _buildOccupancyTrend(reportOccupancy),
      'recentActivity': _mapList(audit['recent_actions'])
          .map((action) => {
                'id': _asString(action['id'] ?? action['created_at']),
                'action': _asString(action['action']).isNotEmpty
                    ? _asString(action['action'])
                    : 'System activity',
                'description': _asString(action['description'] ??
                    action['entity_type'] ??
                    action['metadata']),
                'userName':
                    _asString(action['user_name'] ?? action['user_email']),
                'type': 'info',
                'createdAt': _asString(action['created_at']),
              })
          .toList(),
    };
  }

  List<Map<String, dynamic>> _buildRevenueTrend(Map<String, dynamic> revenue) {
    final byBranch = revenue['by_branch_7d'];
    if (byBranch is Map && byBranch.isNotEmpty) {
      return byBranch.entries
          .map((entry) => {
                'label': _asString(entry.key),
                'revenue': _asDouble(entry.value),
              })
          .toList();
    }
    final sevenDayTotal = _asDouble(revenue['total_7d']);
    final todayTotal = _asDouble(revenue['total_24h']);
    if (sevenDayTotal <= 0 && todayTotal <= 0) return const [];
    final previousTotal =
        (sevenDayTotal - todayTotal).clamp(0, double.infinity);
    return [
      {'label': '7d', 'revenue': previousTotal},
      {'label': 'Today', 'revenue': todayTotal},
    ];
  }

  List<Map<String, dynamic>> _buildOccupancyTrend(
      Map<String, dynamic> occupancy) {
    final current = _asDouble(occupancy['current']);
    if (current <= 0) return const [];
    return [
      {'label': 'Current', 'occupancy': current},
    ];
  }

  Map<String, dynamic> _normalizeBranch(Map<String, dynamic> json) {
    return {
      'id': _asString(json['id']),
      'name': _asString(json['name']),
      'code': _asString(json['code']),
      'address': _asString(json['address'] ?? json['location']),
      'city': _asString(json['city'] ?? json['location']),
      'status': _asString(json['status']).isNotEmpty
          ? _asString(json['status'])
          : 'active',
      'phone': _asString(json['phone']),
      'email': _asString(json['email']),
      'roomCount':
          json['roomCount'] ?? json['room_count'] ?? json['number_of_rooms'],
      'staffCount': json['staffCount'] ?? json['staff_count'],
      'monthlyRevenue': json['monthlyRevenue'] ?? json['monthly_revenue'] ?? 0,
      'createdAt': _asString(json['createdAt'] ?? json['created_at']),
    };
  }

  Future<AdminDashboard> getDashboard() async {
    Map<String, dynamic> report = {};
    Map<String, dynamic> context = {};
    Map<String, dynamic> systemStats = {};
    var staffCount = 0;

    try {
      final response = await _dio.get('/reports/dashboard');
      report = _unwrap(response.data);
    } catch (_) {
      report = {};
    }

    try {
      final response = await _dio.get('/lina/context');
      context = _unwrap(response.data);
    } catch (_) {
      context = {};
    }

    try {
      final response = await _dio.get('/system/stats');
      systemStats = _unwrap(response.data);
    } catch (_) {
      systemStats = {};
    }

    try {
      final response = await _dio.get(
        '/staff',
        queryParameters: const {'source': 'staff_profiles', 'limit': 5000},
      );
      staffCount = _countFromEnvelope(response.data);
    } catch (_) {
      staffCount = 0;
    }

    return AdminDashboard.fromJson(
      _buildAdminDashboardPayload(
        report: report,
        context: context,
        systemStats: systemStats,
        staffCount: staffCount,
      ),
    );
  }

  Future<List<AdminBranch>> getBranches() async {
    final response = await _dio.get('/system/branches');
    return _parseMapList(response.data)
        .map((json) => AdminBranch.fromJson(_normalizeBranch(json)))
        .toList();
  }

  Future<AdminBranch> getBranch(String id) async {
    final response = await _dio.get('/system/branches/$id');
    return AdminBranch.fromJson(_normalizeBranch(_unwrap(response.data)));
  }

  Future<AdminBranch> createBranch(Map<String, dynamic> data) async {
    final response = await _dio.post('/system/branches', data: data);
    return AdminBranch.fromJson(_normalizeBranch(_unwrap(response.data)));
  }

  Future<AdminBranch> updateBranch(String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/system/branches/$id', data: data);
    return AdminBranch.fromJson(_normalizeBranch(_unwrap(response.data)));
  }

  Future<void> deleteBranch(String id) async {
    await _dio.delete('/system/branches/$id');
  }

  Future<List<AdminUser>> getUsers({String? branchId, String? role}) async {
    final params = <String, dynamic>{};
    if (branchId != null) params['branch_id'] = branchId;
    if (role != null) params['role'] = role;
    final response = await _dio.get('/users', queryParameters: params);
    return _parseList(response.data, AdminUser.fromJson);
  }

  Future<AdminUser> createUser(Map<String, dynamic> data) async {
    final response = await _dio.post('/users', data: data);
    return AdminUser.fromJson(_unwrap(response.data));
  }

  Future<AdminUser> updateUser(String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/users/$id', data: data);
    return AdminUser.fromJson(_unwrap(response.data));
  }

  Future<void> deleteUser(String id) async {
    await _dio.delete('/users/$id');
  }

  Future<void> resetUserPassword(String id, String newPassword) async {
    await _dio.put('/users/$id', data: {'password': newPassword});
  }

  /// Normalises the backend snake_case staff profile response to the fields that
  /// [AdminUser.fromJson] expects. The backend returns `first_name`+`last_name`
  /// instead of `name`, `basic_salary` instead of `salary`, `status` instead of
  /// `isActive`, `branch_id` instead of `branchId`, etc.
  Map<String, dynamic> _normalizeStaff(Map<String, dynamic> json) {
    final firstName = _asString(json['first_name']);
    final lastName = _asString(json['last_name']);
    final fullName = '$firstName $lastName'.trim();
    final rawBranch = json['branch'] ?? json['branches'];
    final branch = rawBranch is Map ? rawBranch : null;
    return {
      'id': _asString(json['id']),
      'name': fullName.isNotEmpty ? fullName : _asString(json['name']),
      'email': _asString(json['email'] ?? json['user']?['email']),
      'role': _asString(json['role'] ?? json['position']),
      'branchId': _asString(json['branch_id'] ?? json['branchId']),
      'branchName': _asString(
          json['branch_name'] ?? json['branchName'] ?? branch?['name']),
      'phone': _asString(json['phone'] ?? json['phone_number']),
      'department': _asString(json['department']),
      'position': _asString(json['position'] ?? json['role']),
      'salary': (json['basic_salary'] ?? json['salary'] ?? 0.0),
      'isActive':
          json['status']?.toString() == 'active' || json['isActive'] == true,
      'profilePhoto': _resolvePhotoUrl(_asString(json['profile_photo_url'] ??
          json['photo_url'] ??
          json['avatar'] ??
          json['profilePhoto'])),
      'rfidTag': _asString(json['rfid_tag'] ?? json['rfidTag']),
      'posPin': _asString(json['pos_pin'] ?? json['posPin']),
      'createdAt': _asString(json['created_at'] ?? json['createdAt']),
      'permissions': json['permissions'] ?? <String>[],
    };
  }

  Future<List<AdminUser>> getStaff(
      {String? branchId, String? department}) async {
    final params = <String, dynamic>{'source': 'staff_profiles'};
    if (branchId != null) params['branch_id'] = branchId;
    if (department != null) params['department'] = department;
    final response = await _dio.get('/staff', queryParameters: params);
    return _parseList(
      response.data,
      (json) => AdminUser.fromJson(_normalizeStaff(json)),
    );
  }

  Future<AdminUser> createStaff(Map<String, dynamic> data) async {
    final response = await _dio.post('/staff', data: data);
    return AdminUser.fromJson(_unwrap(response.data));
  }

  Future<AdminUser> updateStaff(String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/staff/$id', data: data);
    return AdminUser.fromJson(_unwrap(response.data));
  }

  Map<String, dynamic> _normalizeRoom(Map<String, dynamic> json) {
    String typeName = '';
    final typeData = json['type'];
    if (typeData is Map) {
      typeName = _asString(typeData['name'] ?? typeData['type_name']);
    } else if (typeData is String) {
      typeName = typeData;
    }
    if (typeName.isEmpty) {
      typeName = _asString(json['type_name'] ?? json['room_type']);
    }
    final priceRaw = json['price_override'] ?? json['price'] ?? 0;
    return {
      'id': _asString(json['id']),
      'roomNumber': _asString(json['room_number'] ?? json['roomNumber']),
      'type': typeName,
      'branchId': _asString(json['branch_id'] ?? json['branchId']),
      'branchName': _asString(json['branch_name'] ?? json['branchName']),
      'floor': (json['floor'] as num?)?.toInt() ?? 0,
      'price': (priceRaw as num).toDouble(),
      'status': _asString(json['status'] ?? 'available'),
      'description': _asString(json['description']),
      'amenities':
          (json['amenities'] as List?)?.map((e) => '$e').toList() ?? <String>[],
      'capacity': (json['capacity'] as num?)?.toInt() ?? 2,
      'isSmoking': json['is_smoking'] == true || json['isSmoking'] == true,
    };
  }

  Future<List<AdminRoom>> getRooms(
      {String? branchId, String? type, String? status}) async {
    final params = <String, dynamic>{};
    if (branchId != null) params['branch_id'] = branchId;
    if (type != null) params['type'] = type;
    if (status != null) params['status'] = status;
    final response = await _dio.get('/rooms', queryParameters: params);
    return _parseList(
      response.data,
      (json) => AdminRoom.fromJson(_normalizeRoom(json)),
    );
  }

  Future<AdminRoom> createRoom(Map<String, dynamic> data) async {
    final response = await _dio.post('/rooms', data: data);
    return AdminRoom.fromJson(_unwrap(response.data));
  }

  Future<AdminRoom> updateRoom(String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/rooms/$id', data: data);
    return AdminRoom.fromJson(_unwrap(response.data));
  }

  Future<void> deleteRoom(String id) async {
    await _dio.delete('/rooms/$id');
  }

  Future<List<AdminGuest>> getGuests({String? search}) async {
    final params = <String, dynamic>{};
    if (search != null) params['search'] = search;
    final response = await _dio.get('/guests', queryParameters: params);
    return _parseList(response.data, AdminGuest.fromJson);
  }

  Future<AdminGuest> createGuest(Map<String, dynamic> data) async {
    final response = await _dio.post('/guests', data: data);
    return AdminGuest.fromJson(_unwrap(response.data));
  }

  Future<AdminGuest> updateGuest(String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/guests/$id', data: data);
    return AdminGuest.fromJson(_unwrap(response.data));
  }

  Future<List<AdminMenuItem>> getMenuItems(
      {String? branchId, String? category, String? menuType = 'menu'}) async {
    final params = <String, dynamic>{'menu_type': menuType};
    if (branchId != null) params['branch_id'] = branchId;
    if (category != null) params['category'] = category;
    final response =
        await _dio.get('/restaurant/menu/items', queryParameters: params);
    return _parseList(response.data, AdminMenuItem.fromJson);
  }

  Future<AdminMenuItem> createMenuItem(Map<String, dynamic> data) async {
    final response = await _dio.post('/restaurant/menu/items', data: data);
    return AdminMenuItem.fromJson(_unwrap(response.data));
  }

  Future<AdminMenuItem> updateMenuItem(
      String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/restaurant/menu/items/$id', data: data);
    return AdminMenuItem.fromJson(_unwrap(response.data));
  }

  Future<void> deleteMenuItem(String id) async {
    await _dio.delete('/restaurant/menu/items/$id');
  }

  Future<List<Map<String, dynamic>>> getPosOutlets({
    String? branchId,
    String? outletType,
  }) async {
    final response = await _dio.get('/pos/outlets', queryParameters: {
      if (branchId != null && branchId.isNotEmpty) 'branch_id': branchId,
      if (outletType != null && outletType.isNotEmpty)
        'outlet_type': outletType,
    });
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> createPosOutlet(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/pos/outlets', data: data);
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> updatePosOutlet(
      String id, Map<String, dynamic> data) async {
    final response = await _dio.patch('/pos/outlets/$id', data: data);
    return _parseMap(response.data);
  }

  Future<List<Map<String, dynamic>>> getPosOutletItems(String outletId) async {
    final response = await _dio.get('/pos/outlets/$outletId/items');
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> createPosOutletItem(
      String outletId, Map<String, dynamic> data) async {
    final response =
        await _dio.post('/pos/outlets/$outletId/items', data: data);
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> updatePosOutletItem(
      String outletId, String itemId, Map<String, dynamic> data) async {
    final response =
        await _dio.patch('/pos/outlets/$outletId/items/$itemId', data: data);
    return _parseMap(response.data);
  }

  Future<List<Map<String, dynamic>>> syncPosOutletItems(String outletId) async {
    final response = await _dio.post('/pos/outlets/$outletId/sync-items');
    return _parseMapList(response.data);
  }

  Future<List<Map<String, dynamic>>> globalSearch(String query) async {
    final response = await _dio.get('/search', queryParameters: {'q': query});
    return _parseMapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getSystemRoles() async {
    final response = await _dio.get('/system/roles');
    return _parseMapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getRolePermissions(String roleId) async {
    final response = await _dio.get('/system/roles/$roleId/permissions');
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> getPaymentStats() async {
    final response = await _dio.get('/payments-verification/stats');
    return _parseMap(response.data);
  }

  Future<List<Map<String, dynamic>>> getReportTemplates() async {
    final response = await _dio.get('/reports/templates');
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> createReportTemplate(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/reports/templates', data: data);
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> updateReportTemplate(
      String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/reports/templates/$id', data: data);
    return _parseMap(response.data);
  }

  Future<void> deleteReportTemplate(String id) async {
    await _dio.delete('/reports/templates/$id');
  }

  Future<List<Map<String, dynamic>>> getPayrollPolicies() async {
    final response = await _dio.get('/payroll-policies');
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> createPayrollPolicy(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/payroll-policies', data: data);
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> updatePayrollPolicy(
      String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/payroll-policies/$id', data: data);
    return _parseMap(response.data);
  }

  Future<void> deletePayrollPolicy(String id) async {
    await _dio.delete('/payroll-policies/$id');
  }

  Future<List<InventoryItem>> getInventory(
      {String? branchId, String? category}) async {
    final params = <String, dynamic>{};
    if (branchId != null) params['branch_id'] = branchId;
    if (category != null) params['category'] = category;
    final response =
        await _dio.get('/inventory/items', queryParameters: params);
    return _parseList(response.data, InventoryItem.fromJson);
  }

  Future<Map<String, dynamic>> getCentralStoreDashboard() async {
    final response = await _dio.get('/store/dashboard/central');
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> getCentralStoreValuation() async {
    final response = await _dio.get('/store/valuation');
    return _parseMap(response.data);
  }

  Future<List<Map<String, dynamic>>> getStoreItems({
    String? search,
    String? category,
    String? storeType,
    int? limit,
    int? page,
  }) async {
    final response = await _dio.get('/store/items', queryParameters: {
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (category != null && category.trim().isNotEmpty) 'category': category,
      if (storeType != null && storeType.trim().isNotEmpty)
        'store_type': storeType,
      if (limit != null) 'limit': limit,
      if (page != null) 'page': page,
    });
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> getStoreItem(String id) async {
    final response = await _dio.get('/store/items/$id');
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> createStoreItem(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/store/items', data: data);
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> updateStoreItem(
      String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/store/items/$id', data: data);
    return _parseMap(response.data);
  }

  Future<void> deleteStoreItem(String id) async {
    await _dio.delete('/store/items/$id');
  }

  Future<Map<String, dynamic>> generateStoreBarcode(
      [Map<String, dynamic>? data]) async {
    final response =
        await _dio.post('/store/generate-barcode', data: data ?? {});
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> suggestStoreItemAttributes(
      String itemName) async {
    final response = await _dio.post('/storekeeping/items/suggest', data: {
      'item_name': itemName,
    });
    return _parseMap(response.data);
  }

  Future<List<Map<String, dynamic>>> getStoreStockRequests({
    String? status,
    String? branchId,
  }) async {
    final response = await _dio.get('/store/stock-requests', queryParameters: {
      if (status != null && status != 'all') 'status': status,
      if (branchId != null) 'branch_id': branchId,
    });
    return _parseMapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getApprovedStoreStockRequests() async {
    final response = await _dio.get('/store/stock-requests/approved');
    return _parseMapList(response.data);
  }

  Future<void> reviewStoreStockRequest(
      String id, Map<String, dynamic> data) async {
    await _dio.put('/store/stock-requests/$id/review', data: data);
  }

  Future<List<Map<String, dynamic>>> getStoreDispatchNotes({
    String? status,
    String? storeType,
  }) async {
    final response = await _dio.get('/store/dispatch-notes', queryParameters: {
      if (status != null && status != 'all') 'status': status,
      if (storeType != null && storeType != 'all') 'store_type': storeType,
    });
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> createStoreDispatchNote(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/store/dispatch-notes', data: data);
    return _parseMap(response.data);
  }

  Future<void> dispatchStoreItems(String id, Map<String, dynamic>? data) async {
    await _dio.put('/store/dispatch-notes/$id/dispatch', data: data ?? {});
  }

  Future<List<Map<String, dynamic>>> getStoreBranches() async {
    final response = await _dio.get('/store/branches');
    return _parseMapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getStoreVehicles() async {
    final response = await _dio.get('/store/vehicles');
    return _parseMapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getStoreDrivers() async {
    final response = await _dio.get('/store/drivers');
    return _parseMapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getStoreSuppliers({
    String? scope,
    String? status,
    String? category,
    String? search,
  }) async {
    final response = await _dio.get('/store/suppliers', queryParameters: {
      if (scope != null) 'scope': scope,
      if (status != null) 'status': status,
      if (category != null) 'category': category,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    });
    return _parseMapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getCentralStockTakes({
    String? storeType,
    String? status,
  }) async {
    final response =
        await _dio.get('/store/central-stock-takes', queryParameters: {
      if (storeType != null) 'store_type': storeType,
      if (status != null) 'status': status,
    });
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> createCentralStockTake(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/store/central-stock-takes', data: data);
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> getCentralStockTake(String id) async {
    final response = await _dio.get('/store/central-stock-takes/$id');
    return _parseMap(response.data);
  }

  Future<File> downloadCentralStockTakeWorksheet(String id) {
    return _downloadGet(
      '/store/central-stock-takes/$id/worksheet-pdf',
      filename: 'CentralStockTakeWorksheet_${id}_${_today()}.pdf',
    );
  }

  Future<void> updateCentralStockTake(
      String id, Map<String, dynamic> data) async {
    await _dio.put('/store/central-stock-takes/$id', data: data);
  }

  Future<void> submitCentralStockTake(String id) async {
    await _dio.post('/store/central-stock-takes/$id/submit');
  }

  Future<void> approveCentralStockTake(String id) async {
    await _dio.post('/store/central-stock-takes/$id/approve');
  }

  Future<void> rejectCentralStockTake(String id, String reason) async {
    await _dio.post('/store/central-stock-takes/$id/reject', data: {
      'reason': reason,
    });
  }

  Future<List<Map<String, dynamic>>> getBranchStockTakes({
    String? storeType,
    String? status,
  }) async {
    final response = await _dio.get('/stock-takes', queryParameters: {
      if (storeType != null && storeType != 'all') 'store_type': storeType,
      if (status != null && status != 'all') 'status': status,
    });
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> createBranchStockTake({
    String countType = 'daily',
    String storeType = 'foodstuffs',
    String? outletCode,
  }) async {
    final response = await _dio.post('/stock-takes', data: {
      'count_type': countType,
      'store_type': storeType,
      if (outletCode != null && outletCode.isNotEmpty)
        'outlet_code': outletCode,
    });
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> getBranchStockTake(String id) async {
    final response = await _dio.get('/stock-takes/$id');
    return _parseMap(response.data);
  }

  Future<void> updateBranchStockTake(
      String id, List<Map<String, dynamic>> items) async {
    await _dio.put('/stock-takes/$id', data: {'items': items});
  }

  Future<void> submitBranchStockTake(String id, {String? notes}) async {
    await _dio.post('/stock-takes/$id/submit', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<File> downloadBranchStockTakeWorksheet(String id) {
    return _downloadGet(
      '/stock-takes/$id/worksheet',
      filename: 'BranchStockTakeWorksheet_${id}_${_today()}.pdf',
    );
  }

  Future<List<Map<String, dynamic>>> getCentralSpoilageRecords({
    String? storeType,
    String? status,
  }) async {
    final response =
        await _dio.get('/store/central-spoilage', queryParameters: {
      if (storeType != null) 'store_type': storeType,
      if (status != null) 'status': status,
    });
    return _parseMapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getCentralSpoilageItems({
    String? search,
    String? storeType,
  }) async {
    final response =
        await _dio.get('/store/central-spoilage/items', queryParameters: {
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (storeType != null && storeType.trim().isNotEmpty)
        'store_type': storeType.trim(),
    });
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> createCentralSpoilageRecord(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/store/central-spoilage', data: data);
    return _parseMap(response.data);
  }

  Future<void> updateCentralSpoilageStatus(
      String id, String status, String? notes) async {
    final normalized = status.trim().toLowerCase();
    final action = normalized == 'approved' || normalized == 'approve'
        ? 'approve'
        : normalized == 'rejected' || normalized == 'reject'
            ? 'reject'
            : normalized;
    await _dio.patch('/store/central-spoilage/$id/status', data: {
      'action': action,
      if (action == 'reject' && notes != null && notes.trim().isNotEmpty)
        'rejection_reason': notes.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> getPurchaseOrders({
    String? status,
    String? supplierId,
  }) async {
    final response =
        await _dio.get('/procurement/purchase-orders', queryParameters: {
      'source_module': 'central_store',
      if (status != null && status != 'all') 'status': status,
      if (supplierId != null) 'supplier_id': supplierId,
    });
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> getPurchaseOrder(String id) async {
    final response = await _dio.get('/procurement/purchase-orders/$id',
        queryParameters: {'source_module': 'central_store'});
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> createPurchaseOrder(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/procurement/purchase-orders', data: {
      ...data,
      'source_module': 'central_store',
    });
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> updatePurchaseOrder(
      String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/procurement/purchase-orders/$id', data: {
      ...data,
      'source_module': 'central_store',
    });
    return _parseMap(response.data);
  }

  Future<void> approvePurchaseOrder(String id) async {
    await _dio.put('/procurement/purchase-orders/$id/approve',
        queryParameters: {'source_module': 'central_store'});
  }

  Future<void> cancelPurchaseOrder(String id) async {
    await _dio.put('/procurement/purchase-orders/$id/cancel',
        queryParameters: {'source_module': 'central_store'});
  }

  Future<void> sendPurchaseOrder(String id) async {
    await _dio.post('/procurement/purchase-orders/$id/send',
        queryParameters: {'source_module': 'central_store'});
  }

  Future<List<Map<String, dynamic>>> getGRNs({
    String? status,
    String? supplierId,
  }) async {
    final response = await _dio.get('/procurement/grn', queryParameters: {
      if (status != null && status != 'all') 'status': status,
      if (supplierId != null) 'supplier_id': supplierId,
    });
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> getGRN(String id) async {
    final response = await _dio.get('/procurement/grn/$id');
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> createGRN(Map<String, dynamic> data) async {
    final response = await _dio.post(
      '/procurement/grn',
      data: data,
      options: Options(
        sendTimeout: const Duration(minutes: 2),
        receiveTimeout: const Duration(minutes: 3),
        extra: const {'disable_retry': true},
      ),
    );
    return _parseMap(response.data);
  }

  Future<File> downloadGRNPdf(String id, {String? grnNumber}) {
    final date = _today();
    final baseName =
        (grnNumber == null || grnNumber.isEmpty) ? 'GRN_$date' : grnNumber;
    return _downloadGet(
      '/procurement/grn/$id/pdf',
      filename: '$baseName.pdf',
      options: Options(
        receiveTimeout: const Duration(minutes: 2),
        extra: const {'disable_retry': true},
      ),
    );
  }

  Future<void> approveGRN(String id) async {
    await _dio.put('/procurement/grn/$id/approve');
  }

  Future<Map<String, dynamic>> backfillGRNStock() async {
    final response = await _dio.post('/procurement/grn/backfill-stock');
    return _parseMap(response.data);
  }

  Future<List<Map<String, dynamic>>> getSupplierInvoices({
    String? status,
    String? supplierId,
  }) async {
    final response = await _dio.get('/procurement/invoices', queryParameters: {
      if (status != null && status != 'all') 'status': status,
      if (supplierId != null) 'supplier_id': supplierId,
    });
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> getSupplierInvoice(String id) async {
    final response = await _dio.get('/procurement/invoices/$id');
    return _parseMap(response.data);
  }

  Future<Map<String, dynamic>> createSupplierInvoice(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/procurement/invoices', data: data);
    return _parseMap(response.data);
  }

  Future<void> submitSupplierInvoice(String id) async {
    await _dio.put('/procurement/invoices/$id/submit');
  }

  Future<void> approveSupplierInvoice(String id) async {
    await _dio.put('/procurement/invoices/$id/approve');
  }

  Future<void> rejectSupplierInvoice(String id, String reason) async {
    await _dio.put('/procurement/invoices/$id/reject', data: {
      'reason': reason,
    });
  }

  Future<List<Map<String, dynamic>>> getSupplierPayments({
    String? status,
    String? supplierId,
  }) async {
    final response = await _dio.get('/procurement/payments', queryParameters: {
      if (status != null && status != 'all') 'status': status,
      if (supplierId != null) 'supplier_id': supplierId,
    });
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> createSupplierPayment(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/procurement/payments', data: data);
    return _parseMap(response.data);
  }

  Future<void> processSupplierPayment(String id) async {
    await _dio.put('/procurement/payments/$id/process');
  }

  Future<List<Map<String, dynamic>>> getSupplierLedger(
      String supplierId) async {
    final response = await _dio.get('/procurement/ledger/$supplierId');
    return _parseMapList(response.data);
  }

  Future<Map<String, dynamic>> getProcurementReport(
      String report, Map<String, dynamic> filters) async {
    final response = await _dio.get('/procurement/reports/$report',
        queryParameters: filters);
    return _parseMap(response.data);
  }

  Future<void> createStoreSupplier(Map<String, dynamic> data) async {
    await _dio.post('/store/suppliers', data: data);
  }

  Future<void> updateStoreSupplier(String id, Map<String, dynamic> data) async {
    await _dio.put('/store/suppliers/$id', data: data);
  }

  Future<void> deleteStoreSupplier(String id) async {
    await _dio.delete('/store/suppliers/$id');
  }

  Future<void> createStoreVehicle(Map<String, dynamic> data) async {
    await _dio.post('/store/vehicles', data: data);
  }

  Future<void> updateStoreVehicle(String id, Map<String, dynamic> data) async {
    await _dio.put('/store/vehicles/$id', data: data);
  }

  Future<void> deleteStoreVehicle(String id) async {
    await _dio.delete('/store/vehicles/$id');
  }

  Future<void> createStoreDriver(Map<String, dynamic> data) async {
    await _dio.post('/store/drivers', data: data);
  }

  Future<void> updateStoreDriver(String id, Map<String, dynamic> data) async {
    await _dio.put('/store/drivers/$id', data: data);
  }

  Future<void> deleteStoreDriver(String id) async {
    await _dio.delete('/store/drivers/$id');
  }

  Future<InventoryItem> createInventoryItem(Map<String, dynamic> data) async {
    final response = await _dio.post('/inventory/items', data: data);
    return InventoryItem.fromJson(_unwrap(response.data));
  }

  Future<InventoryItem> updateInventoryItem(
      String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/inventory/items/$id', data: data);
    return InventoryItem.fromJson(_unwrap(response.data));
  }

  Future<void> deleteInventoryItem(String id) async {
    await _dio.delete('/inventory/items/$id');
  }

  Future<List<AdminSupplier>> getSuppliers() async {
    final response = await _dio.get('/suppliers');
    return _parseList(response.data, AdminSupplier.fromJson);
  }

  Future<AdminSupplier> createSupplier(Map<String, dynamic> data) async {
    final response = await _dio.post('/suppliers', data: data);
    return AdminSupplier.fromJson(_unwrap(response.data));
  }

  Future<AdminSupplier> updateSupplier(
      String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/suppliers/$id', data: data);
    return AdminSupplier.fromJson(_unwrap(response.data));
  }

  Future<void> deleteSupplier(String id) async {
    await _dio.delete('/suppliers/$id');
  }

  Future<List<AdminVehicle>> getVehicles() async {
    final response = await _dio.get('/fleet/vehicles');
    return _parseList(response.data, AdminVehicle.fromJson);
  }

  Future<AdminVehicle> createVehicle(Map<String, dynamic> data) async {
    final response = await _dio.post('/fleet/vehicles', data: data);
    return AdminVehicle.fromJson(_unwrap(response.data));
  }

  Future<AdminVehicle> updateVehicle(
      String id, Map<String, dynamic> data) async {
    final response = await _dio.put('/fleet/vehicles/$id', data: data);
    return AdminVehicle.fromJson(_unwrap(response.data));
  }

  Future<void> deleteVehicle(String id) async {
    await _dio.delete('/fleet/vehicles/$id');
  }

  Future<List<AdminAuditLog>> getAuditLogs(
      {String? severity, String? action, int limit = 50}) async {
    final params = <String, dynamic>{'limit': limit};
    if (severity != null) params['severity'] = severity;
    if (action != null) params['action'] = action;
    final response = await _dio.get('/audit/logs', queryParameters: params);
    return _parseList(response.data, AdminAuditLog.fromJson);
  }

  Future<List<AdminAuditLog>> getSecurityLogs() async {
    // Using admin-logs with security category
    final response = await _dio.get('/admin-logs?category=security');
    return _parseList(response.data, AdminAuditLog.fromJson);
  }

  Future<List<AdminNotification>> getNotifications({
    String? status,
    String? priority,
    String? category,
  }) async {
    final response = await _dio.get('/notifications', queryParameters: {
      if (status == 'read') 'is_read': 'true',
      if (status == 'unread') 'is_read': 'false',
      if (priority != null && priority != 'ALL') 'priority': priority,
      if (category != null && category != 'ALL') 'category': category,
    });
    return _parseMapList(response.data)
        .map(_normalizeNotification)
        .map(AdminNotification.fromJson)
        .toList();
  }

  Future<int> getUnreadNotificationCount() async {
    final response = await _dio.get('/notifications/unread-count');
    final data = _unwrap(response.data);
    return (data['count'] ?? 0).toInt();
  }

  Future<void> markNotificationRead(String id) async {
    await _dio.patch('/notifications/$id/read');
  }

  Future<void> markAllNotificationsRead() async {
    await _dio.patch('/notifications/mark-all-read');
  }

  Future<SystemConfig> getSystemConfig() async {
    try {
      final response = await _dio.get('/system/config');
      return SystemConfig.fromJson(_unwrap(response.data));
    } on DioException catch (error) {
      if (error.response?.statusCode == 404) {
        return const SystemConfig();
      }
      rethrow;
    }
  }

  Future<SystemConfig> updateSystemConfig(Map<String, dynamic> data) async {
    final response = await _dio.put('/system/config', data: data);
    return SystemConfig.fromJson(_unwrap(response.data));
  }

  Future<AiAnalytics> getAiAnalytics() async {
    // Using admin-ai insights endpoint
    final response = await _dio.get('/admin-ai/insights');
    return AiAnalytics.fromJson(_unwrap(response.data));
  }

  Future<List<ForecastPoint>> getDemandForecast() async {
    final response = await _dio.get('/forecasting/inventory');
    return _parseList(response.data, ForecastPoint.fromJson);
  }

  Future<List<ForecastPoint>> getRevenueForecast() async {
    final response = await _dio.get('/forecasting/sales');
    return _parseList(response.data, ForecastPoint.fromJson);
  }

  Future<void> logoutSession(String userId, {String? sessionId}) async {
    await _dio.post('/security/terminate-session', data: {
      'user_id': userId,
      if (sessionId != null && sessionId.isNotEmpty) 'session_id': sessionId,
    });
  }

  Future<List<Map<String, dynamic>>> getActiveSessions() async {
    final response = await _dio.get('/security/active-sessions');
    return _parseList(response.data, (json) => json);
  }

  Future<List<Map<String, dynamic>>> getSuspiciousActivity() async {
    // Using admin-ai anomalies as suspicious activity
    final response = await _dio.get('/admin-ai/anomalies');
    return _parseList(response.data, (json) => json);
  }

  Future<List<Map<String, dynamic>>> getWastageRecords(
      {String? startDate, String? endDate, String? branchId}) async {
    try {
      final response = await _dio.get('/wastage', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      });
      final data = response.data;
      final list =
          data is List ? data : (data is Map ? (data['data'] ?? []) : []);
      return (list as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getCashierClearances(
      {String? branchId,
      String? startDate,
      String? endDate,
      String? status}) async {
    final response = await _dio.get('/cashier/clearances', queryParameters: {
      if (branchId != null) 'branch_id': branchId,
      if (startDate != null) 'start_date': startDate,
      if (endDate != null) 'end_date': endDate,
      if (status != null) 'status': status,
    });
    final data = response.data;
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<void> approveClearance(String id) async {
    await _dio.post('/cashier/clearances/$id/approve');
  }

  Future<List<Map<String, dynamic>>> getShiftSummaries(
      {String? branchId, String? date}) async {
    try {
      final response = await _dio.get('/finance/shift-pnl', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
        if (date != null) 'date': date,
      });
      final data = response.data;
      final list =
          data is List ? data : (data is Map ? (data['data'] ?? []) : []);
      return (list as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getSoldItemsAnalysis(
      {String? branchId, String? startDate, String? endDate}) async {
    try {
      final response =
          await _dio.get('/auditor/verify/sold-items', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      });
      final data = response.data;
      final list =
          data is List ? data : (data is Map ? (data['data'] ?? []) : []);
      return (list as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getStockRequestApprovals(
      {String? status, String? branchId}) async {
    try {
      final response =
          await _dio.get('/auditor/approvals/pending', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
        if (status != null) 'status': status,
      });
      return _parseMapList(response.data);
    } on DioException catch (error) {
      if (error.response?.statusCode == 400 ||
          error.response?.statusCode == 403) {
        return [];
      }
      rethrow;
    }
  }

  Future<void> approveStockRequest(String id) async {
    await _dio.post('/auditor/approvals/handle',
        data: {'requestId': id, 'status': 'approved'});
  }

  Future<void> rejectStockRequest(String id, {String? reason}) async {
    await _dio.post('/auditor/approvals/handle', data: {
      'requestId': id,
      'status': 'rejected',
      if (reason != null) 'notes': reason,
    });
  }

  Future<List<Map<String, dynamic>>> getPurchaseAuditOrders(
      {String? status, String? branchId}) async {
    try {
      final response =
          await _dio.get('/procurement/purchase-orders', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
        if (status != null) 'status': status,
      });
      final data = response.data;
      final list =
          data is List ? data : (data is Map ? (data['data'] ?? []) : []);
      return (list as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getBarStockAudits(
      {String? branchId}) async {
    try {
      final response =
          await _dio.get('/auditor/bar/stock-audits', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
      });
      final data = response.data;
      final list =
          data is List ? data : (data is Map ? (data['data'] ?? []) : []);
      return (list as List)
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
    } catch (_) {
      return [];
    }
  }
}
