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
}
