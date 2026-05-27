import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/models.dart';

final restaurantRepositoryProvider = Provider<RestaurantRepository>((ref) {
  return RestaurantRepository(
      ref.read(dioProvider), ref.read(pythonDioProvider), ref);
});

class RestaurantRepository {
  RestaurantRepository(this._dio, this._pythonDio, this._ref);

  final Dio _dio;
  final Dio _pythonDio;
  final Ref _ref;

  Future<String> get _branchId async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  Future<Map<String, dynamic>> createOrder(
      CreateRestaurantOrderRequest request) async {
    final branchId = await _branchId;
    final storage = _ref.read(secureStorageProvider);
    final userId = await storage.read(key: AuthRepository.userIdKey);
    final userName = await storage.read(key: AuthRepository.userNameKey);
    final response = await _dio.post('/restaurant/orders', data: {
      ...request.toJson(),
      'branch_id': branchId,
      if (request.waiterId == null && userId != null && userId.isNotEmpty)
        'waiter_id': userId,
      if (request.waiterName == null && userName != null && userName.isNotEmpty)
        'waiter_name': userName,
    });
    return response.data is Map ? response.data as Map<String, dynamic> : {};
  }

  Future<List<RestaurantOrder>> getRecentOrders() async {
    final branchId = await _branchId;
    final response = await _dio.get('/restaurant/orders', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'limit': 50,
    });
    final data = response.data;
    final list = data is List
        ? data
        : (data is Map ? (data['data'] ?? data['orders'] ?? []) : []);
    return (list as List)
        .whereType<Map>()
        .map(
            (json) => RestaurantOrder.fromJson(Map<String, dynamic>.from(json)))
        .toList();
  }

  Future<Map<String, dynamic>> generateBill(
      Map<String, dynamic> receiptData) async {
    try {
      final response = await _pythonDio.post(
        '/api/receipts/generate/base64',
        data: receiptData,
      );
      return response.data is Map ? response.data as Map<String, dynamic> : {};
    } on DioException {
      rethrow;
    }
  }
}
