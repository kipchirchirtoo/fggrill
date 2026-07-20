import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';
import '../domain/session_models.dart';

final kitchenRepositoryProvider = Provider<KitchenRepository>((ref) {
  return KitchenRepository(ref.read(dioProvider), ref);
});

class KitchenRepository {
  KitchenRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<int?> get _branchId async {
    final storage = _ref.read(secureStorageProvider);
    final raw = await storage.read(key: AuthRepository.branchIdKey);
    final parsed = int.tryParse((raw ?? '').trim());
    return parsed != null && parsed > 0 ? parsed : null;
  }

  List<KitchenOrder> _parseOrders(dynamic data) {
    final list = data is List
        ? data
        : (data is Map ? (data['data'] ?? data['orders'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((json) => KitchenOrder.fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  String _errorMessage(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map) {
        final message = data['message'] ?? data['error'];
        if (message != null && '$message'.trim().isNotEmpty) {
          return '$message';
        }
      }
      if (error.response?.statusCode != null) {
        return 'Kitchen API returned ${error.response!.statusCode}.';
      }
    }
    return '$error';
  }

  Future<List<KitchenOrder>> getOrders() async {
    try {
      final branchId = await _branchId;
      final response =
          await _dio.get('/restaurant/kitchen/orders', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
      });
      return _parseOrders(response.data);
    } catch (e, stackTrace) {
      debugPrint('KitchenRepository.getOrders error: $e');
      debugPrint('StackTrace: $stackTrace');
      throw Exception('Unable to load kitchen orders: ${_errorMessage(e)}');
    }
  }

  Future<List<KitchenOrder>> getHistory({int limit = 100}) async {
    try {
      final branchId = await _branchId;
      final response = await _dio
          .get('/restaurant/kitchen/orders/history', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
        'limit': limit,
      });
      return _parseOrders(response.data);
    } catch (e, stackTrace) {
      debugPrint('KitchenRepository.getHistory error: $e');
      debugPrint('StackTrace: $stackTrace');
      throw Exception('Unable to load kitchen history: ${_errorMessage(e)}');
    }
  }

  Future<void> markItemReady(String orderId, String itemId) async {
    await _dio.put('/restaurant/kitchen/orders/$orderId/items/$itemId/ready');
  }

  /// Reports that this KDS screen successfully printed [orderId]'s current
  /// state (creation or latest recall), so the server-side dedup flag is
  /// set even if the backend's own auto-print attempt failed. Without this,
  /// "already printed" state only ever lived in this screen's memory and
  /// was lost every time the screen remounted (e.g. after logging out).
  Future<void> markCaptainOrderPrinted(String orderId) async {
    try {
      await _dio.put('/restaurant/kitchen/orders/$orderId/printed');
    } catch (e) {
      debugPrint('KitchenRepository.markCaptainOrderPrinted error: $e');
    }
  }

  Future<void> updateOrderStatus(String orderId, String status) async {
    if (orderId.startsWith('pos:')) {
      // Captain orders stay unpaid/partial until cashier clearance, but the
      // kitchen still needs a prep lifecycle for display and waiter callbacks.
      await _dio.put('/restaurant/kitchen/orders/$orderId/status', data: {
        'status': status,
      });
      return;
    }
    await _dio.put('/restaurant/orders/$orderId/status', data: {
      'status': status,
    });
  }

  Future<List<Map<String, dynamic>>> getNotifications({
    String? status,
    String? priority,
    String? category,
  }) async {
    final storage = _ref.read(secureStorageProvider);
    final role = await storage.read(key: AuthRepository.roleKey);
    final branchId = await _branchId;
    final response = await _dio.get('/notifications', queryParameters: {
      if (status == 'read') 'is_read': 'true',
      if (status == 'unread') 'is_read': 'false',
      if (priority != null && priority != 'ALL') 'priority': priority,
      if (category != null && category != 'ALL') 'category': category,
      if (role != null && role.isNotEmpty) 'role': role,
      if (branchId != null) 'branch_id': branchId,
    });
    final payload = response.data;
    final list = payload is List
        ? payload
        : (payload is Map ? (payload['data'] ?? payload['items'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<void> markNotificationRead(String id) async {
    await _dio.patch('/notifications/$id/read');
  }

  Future<void> markAllNotificationsRead() async {
    await _dio.patch('/notifications/mark-all-read');
  }

  // ── Void requests: Kitchen is Stage 1 of the waiter void chain ───────────
  // (Kitchen acknowledge/decline -> Cashier acknowledge/decline -> Branch
  // Accountant final approval). Covers both per-item and whole-bill voids.

  List<Map<String, dynamic>> _parseMapList(dynamic data) {
    final list =
        data is List ? data : (data is Map ? (data['data'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<List<Map<String, dynamic>>> getPendingItemVoidsKitchen() async {
    try {
      final response = await _dio.get('/pos/voids/pending/kitchen');
      return _parseMapList(response.data);
    } catch (e) {
      debugPrint('KitchenRepository.getPendingItemVoidsKitchen error: $e');
      throw Exception(
          'Unable to load pending item void requests: ${_errorMessage(e)}');
    }
  }

  Future<Map<String, dynamic>> kitchenAcknowledgeItemVoid(String id) async {
    try {
      final response = await _dio.patch('/pos/voids/$id/kitchen-acknowledge');
      final data = response.data;
      return data is Map
          ? Map<String, dynamic>.from(data['data'] ?? data)
          : <String, dynamic>{};
    } on DioException catch (e) {
      throw StateError(_errorMessage(e));
    }
  }

  Future<void> kitchenDeclineItemVoid(String id) async {
    try {
      await _dio.patch('/pos/voids/$id/kitchen-decline');
    } on DioException catch (e) {
      throw StateError(_errorMessage(e));
    }
  }

  Future<List<Map<String, dynamic>>> getPendingWholeBillVoidsKitchen() async {
    try {
      final response = await _dio.get('/pos/void-requests/pending/kitchen');
      return _parseMapList(response.data);
    } catch (e) {
      debugPrint('KitchenRepository.getPendingWholeBillVoidsKitchen error: $e');
      throw Exception(
          'Unable to load pending bill void requests: ${_errorMessage(e)}');
    }
  }

  Future<Map<String, dynamic>> kitchenAcknowledgeVoidRequest(String id) async {
    try {
      final response =
          await _dio.patch('/pos/void-requests/$id/kitchen-acknowledge');
      final data = response.data;
      return data is Map
          ? Map<String, dynamic>.from(data['data'] ?? data)
          : <String, dynamic>{};
    } on DioException catch (e) {
      throw StateError(_errorMessage(e));
    }
  }

  Future<void> kitchenDeclineVoidRequest(String id, {String? reason}) async {
    try {
      await _dio.patch('/pos/void-requests/$id/kitchen-decline', data: {
        if (reason != null && reason.trim().isNotEmpty)
          'rejection_reason': reason.trim(),
      });
    } on DioException catch (e) {
      throw StateError(_errorMessage(e));
    }
  }

  // ── Kitchen Sessions Endpoints ───────────────────────────────────────────

  Future<KitchenShift?> getActiveShift() async {
    try {
      final branchId = await _branchId;
      final response = await _dio.get('/kitchen/shifts', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
        'status': 'open',
      });
      final list = _parseMapList(response.data);
      if (list.isEmpty) return null;
      return KitchenShift.fromJson(list.first);
    } catch (e) {
      debugPrint('KitchenRepository.getActiveShift error: $e');
      return null;
    }
  }

  Future<List<KitchenShift>> getOpenShifts() async {
    try {
      final branchId = await _branchId;
      final response = await _dio.get('/kitchen/shifts', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
        'status': 'open',
      });
      final list = _parseMapList(response.data);
      return list.map((json) => KitchenShift.fromJson(json)).toList();
    } catch (e) {
      debugPrint('KitchenRepository.getOpenShifts error: $e');
      return [];
    }
  }

  Future<KitchenShiftConfig> getActiveShiftConfig() async {
    try {
      final branchId = await _branchId;
      final response =
          await _dio.get('/kitchen/shifts/shift-mode', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
      });
      final data = response.data;
      if (data is Map && data['data'] != null) {
        return KitchenShiftConfig.fromJson(
            Map<String, dynamic>.from(data['data']));
      }
      return KitchenShiftConfig(enabled: false, reason: 'INVALID_RESPONSE');
    } catch (e) {
      debugPrint('KitchenRepository.getActiveShiftConfig error: $e');
      return KitchenShiftConfig(enabled: false, reason: e.toString());
    }
  }

  Future<void> configureShiftMode(String shiftMode) async {
    try {
      final branchId = await _branchId;
      if (branchId == null)
        throw Exception('No branch ID associated with user.');
      await _dio.post('/kitchen/shifts/shift-mode', data: {
        'branch_id': branchId,
        'shift_mode': shiftMode,
      });
    } on DioException catch (e) {
      throw Exception(_errorMessage(e));
    }
  }

  Future<KitchenShift> openShift({
    required String shiftType,
    required List<String> assignedChefIds,
    required List<String> assignedDispenseIds,
    String? subShiftType,
    String? department,
  }) async {
    try {
      final branchId = await _branchId;
      if (branchId == null)
        throw Exception('No branch ID associated with user.');

      final response = await _dio.post('/kitchen/shifts', data: {
        'branch_id': branchId,
        'shift_type': shiftType,
        'assigned_chef_ids': assignedChefIds,
        'assigned_dispense_ids': assignedDispenseIds,
        if (subShiftType != null) 'sub_shift_type': subShiftType,
        'department': department ?? 'KITCHEN',
        'opening_items':
            [], // Backend will resolve morning stocktake / handover
      });
      final data = response.data;
      if (data is Map && data['data'] != null) {
        return KitchenShift.fromJson(Map<String, dynamic>.from(data['data']));
      }
      throw Exception('Invalid response format');
    } on DioException catch (e) {
      throw Exception(_errorMessage(e));
    }
  }

  Future<Map<String, dynamic>> getShiftDetails(String shiftId) async {
    try {
      final response = await _dio.get('/kitchen/shifts/$shiftId');
      final data = response.data;
      if (data is Map && data['data'] != null) {
        return Map<String, dynamic>.from(data['data']);
      }
      throw Exception('Invalid response format');
    } on DioException catch (e) {
      throw Exception(_errorMessage(e));
    }
  }

  Future<List<KitchenShift>> listKitchenShifts({
    String? status,
    String? fromDate,
    String? toDate,
  }) async {
    try {
      final branchId = await _branchId;
      final response = await _dio.get(
        '/kitchen/shifts',
        queryParameters: {
          if (branchId != null) 'branch_id': branchId,
          if (status != null && status.isNotEmpty) 'status': status,
          if (fromDate != null && fromDate.isNotEmpty) 'from_date': fromDate,
          if (toDate != null && toDate.isNotEmpty) 'to_date': toDate,
        },
      );
      final list = response.data is List
          ? response.data
          : (response.data is Map ? (response.data['data'] ?? []) : []);
      return (list as List)
          .whereType<Map>()
          .map((json) => KitchenShift.fromJson(Map<String, dynamic>.from(json)))
          .toList();
    } on DioException catch (e) {
      throw Exception(_errorMessage(e));
    }
  }

  Future<List<KitchenProductionRecipe>> getRecipesList() async {
    try {
      final response = await _dio.get('/kitchen/shifts/recipes/list');
      final list = response.data is List
          ? response.data
          : (response.data is Map ? (response.data['data'] ?? []) : []);
      return (list as List)
          .whereType<Map>()
          .map((json) =>
              KitchenProductionRecipe.fromJson(Map<String, dynamic>.from(json)))
          .toList();
    } catch (e) {
      debugPrint('KitchenRepository.getRecipesList error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getRecipeCatalog() async {
    try {
      final response = await _dio.get('/kitchen/shifts/recipes/list');
      return _parseMapList(response.data is Map ? response.data['data'] : response.data);
    } catch (e) {
      debugPrint('KitchenRepository.getRecipeCatalog error: $e');
      return [];
    }
  }

  Future<void> logProductionEvent(Map<String, dynamic> payload) async {
    try {
      await _dio.post('/kitchen/shifts/production/log', data: payload);
    } on DioException catch (e) {
      throw Exception(_errorMessage(e));
    }
  }

  Future<List<KitchenShiftAddition>> getShiftAdditions(String shiftId) async {
    try {
      final response = await _dio.get('/kitchen/shifts/$shiftId/additions');
      final list = response.data is List
          ? response.data
          : (response.data is Map ? (response.data['data'] ?? []) : []);
      return (list as List)
          .whereType<Map>()
          .map((json) =>
              KitchenShiftAddition.fromJson(Map<String, dynamic>.from(json)))
          .toList();
    } catch (e) {
      debugPrint('KitchenRepository.getShiftAdditions error: $e');
      return [];
    }
  }

  Future<List<KitchenPrepBatch>> getPrepBatches(String shiftId) async {
    try {
      final response = await _dio.get('/kitchen/shifts/$shiftId/prep-batches');
      final list = response.data is List
          ? response.data
          : (response.data is Map ? (response.data['data'] ?? []) : []);
      return (list as List)
          .whereType<Map>()
          .map((json) => KitchenPrepBatch.fromJson(Map<String, dynamic>.from(json)))
          .toList();
    } catch (e) {
      debugPrint('KitchenRepository.getPrepBatches error: $e');
      return [];
    }
  }

  Future<void> sendPrepBatch(String shiftId, Map<String, dynamic> payload) async {
    try {
      await _dio.post('/kitchen/shifts/$shiftId/prep-batches', data: payload);
    } on DioException catch (e) {
      throw Exception(_errorMessage(e));
    }
  }

  Future<void> receivePrepBatch(
    String shiftId,
    String batchId,
    Map<String, dynamic> payload,
  ) async {
    try {
      await _dio.post(
        '/kitchen/shifts/$shiftId/prep-batches/$batchId/receive',
        data: payload,
      );
    } on DioException catch (e) {
      throw Exception(_errorMessage(e));
    }
  }

  Future<void> retrySync(String shiftId) async {
    try {
      await _dio.post('/kitchen/shifts/$shiftId/sync/retry');
    } on DioException catch (e) {
      throw Exception(_errorMessage(e));
    }
  }

  Future<List<Map<String, dynamic>>> getStaffProfiles() async {
    try {
      final branchId = await _branchId;
      final response = await _dio.get('/staff', queryParameters: {
        if (branchId != null) 'branch_id': branchId,
      });
      return _parseMapList(response.data);
    } catch (e) {
      debugPrint('KitchenRepository.getStaffProfiles error: $e');
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getStoreInventoryItems({
    String? search,
    int limit = 500,
  }) async {
    try {
      final response = await _dio.get('/store/items', queryParameters: {
        if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
        'store_type': 'foodstuffs',
        'limit': limit,
      });
      return _parseMapList(response.data);
    } catch (e) {
      debugPrint('KitchenRepository.getStoreInventoryItems error: $e');
      return [];
    }
  }

  Future<void> addStock(
      String shiftId, List<Map<String, dynamic>> items) async {
    try {
      await _dio.post('/kitchen/shifts/$shiftId/stock', data: {'items': items});
    } on DioException catch (e) {
      throw Exception(_errorMessage(e));
    }
  }

  Future<void> closeShift({
    required String shiftId,
    required List<Map<String, dynamic>> physicalCounts,
    required List<String> outgoingWitnessIds,
    required List<String> incomingWitnessIds,
    String? closingNotes,
    int? breakfastPax,
    int? staffMealPax,
  }) async {
    try {
      await _dio.post('/kitchen/shifts/$shiftId/close', data: {
        'physical_counts': physicalCounts,
        'outgoing_witness_ids': outgoingWitnessIds,
        'incoming_witness_ids': incomingWitnessIds,
        'closing_notes': closingNotes,
        if (breakfastPax != null) 'breakfast_pax': breakfastPax,
        if (staffMealPax != null) 'staff_meal_pax': staffMealPax,
      });
    } on DioException catch (e) {
      throw Exception(_errorMessage(e));
    }
  }

  Future<int> getBreakfastPax() async {
    try {
      final response = await _dio.get('/kitchen/shifts/breakfast-pax');
      if (response.data is Map && response.data['breakfast_pax'] != null) {
        return (response.data['breakfast_pax'] as num).toInt();
      }
      return 0;
    } catch (e) {
      return 0;
    }
  }

  Future<Map<String, dynamic>> getBreakfastPaxSnapshot({String? date}) async {
    try {
      final response =
          await _dio.get('/kitchen/shifts/breakfast-pax', queryParameters: {
        if (date != null && date.isNotEmpty) 'date': date,
      });
      if (response.data is Map) {
        final data = response.data['data'];
        if (data is Map) {
          return Map<String, dynamic>.from(data);
        }
        return Map<String, dynamic>.from(response.data);
      }
      return {};
    } catch (e) {
      return {};
    }
  }

  Future<List<Map<String, dynamic>>> getActiveBuffets() async {
    try {
      final bId = await _branchId;
      final response = await _dio.get('/buffet', queryParameters: {
        if (bId != null) 'branch_id': bId,
      });
      return _parseMapList(response.data);
    } catch (e) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getActiveCateringEvents() async {
    try {
      final bId = await _branchId;
      final response = await _dio.get('/catering-bookings', queryParameters: {
        if (bId != null) 'branch_id': bId,
      });
      return _parseMapList(response.data);
    } catch (e) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getActiveConferences() async {
    try {
      final bId = await _branchId;
      final response = await _dio.get('/conference/bookings', queryParameters: {
        if (bId != null) 'branch_id': bId,
        'status': 'confirmed',
      });
      return _parseMapList(response.data);
    } catch (e) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getActiveEventOrders({
    String? eventType,
  }) async {
    try {
      final bId = await _branchId;
      final response =
          await _dio.get('/accounting/event-orders', queryParameters: {
        if (bId != null) 'branch_id': bId,
        'active_only': 'true',
        if (eventType != null && eventType.isNotEmpty) 'event_type': eventType,
      });
      return _parseMapList(response.data['data']);
    } catch (e) {
      return [];
    }
  }

  Future<Map<String, dynamic>> getReconciliationReport(String shiftId) async {
    try {
      final response =
          await _dio.get('/kitchen/shifts/$shiftId/reconciliation-report');
      return Map<String, dynamic>.from(response.data is Map
          ? response.data['data'] ?? response.data
          : response.data);
    } on DioException catch (e) {
      throw Exception(_errorMessage(e));
    }
  }

  Future<Map<String, dynamic>> getDailyControlsReport(String shiftId) async {
    try {
      final response = await _dio.get('/kitchen/shifts/$shiftId/daily-controls');
      return Map<String, dynamic>.from(response.data is Map
          ? response.data['data'] ?? response.data
          : response.data);
    } on DioException catch (e) {
      throw Exception(_errorMessage(e));
    }
  }
}
