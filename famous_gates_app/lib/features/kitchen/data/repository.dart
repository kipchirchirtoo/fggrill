import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final kitchenRepositoryProvider = Provider<KitchenRepository>((ref) {
  return KitchenRepository(ref.read(dioProvider), ref);
});

class KitchenRepository {
  KitchenRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> get _branchId async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  List<KitchenOrder> _parseOrders(dynamic data) {
    final list = data is List
        ? data
        : (data is Map ? (data['data'] ?? data['orders'] ?? []) : []);
    return (list as List)
        .whereType<Map<String, dynamic>>()
        .cast<Map<String, dynamic>>()
        .map((json) => KitchenOrder.fromJson(json))
        .toList();
  }

  Future<List<KitchenOrder>> getOrders() async {
    try {
      final branchId = await _branchId;
      final response =
          await _dio.get('/restaurant/kitchen/orders', queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
      });
      return _parseOrders(response.data);
    } catch (e, stackTrace) {
      debugPrint('KitchenRepository.getOrders error: $e');
      debugPrint('StackTrace: $stackTrace');
      return [];
    }
  }

  Future<List<KitchenOrder>> getHistory({int limit = 100}) async {
    try {
      final branchId = await _branchId;
      final response = await _dio
          .get('/restaurant/kitchen/orders/history', queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        'limit': limit,
      });
      return _parseOrders(response.data);
    } catch (e, stackTrace) {
      debugPrint('KitchenRepository.getHistory error: $e');
      debugPrint('StackTrace: $stackTrace');
      return [];
    }
  }

  Future<void> markItemReady(String orderId, String itemId) async {
    await _dio.put('/restaurant/kitchen/orders/$orderId/items/$itemId/ready');
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
      if (branchId.isNotEmpty) 'branch_id': branchId,
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
}
