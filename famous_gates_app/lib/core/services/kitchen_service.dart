import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final kitchenServiceProvider = Provider<KitchenService>((ref) {
  return KitchenService(ref.watch(dioProvider));
});

class KitchenService extends BaseApiService {
  KitchenService(super.dio);

  // ==================== KITCHEN ORDERS (KDS) ====================

  // GET /api/kitchen/orders
  Future<Map<String, dynamic>> getOrders({
    String? status,
    String? type,
    String? priority,
    int? branchId,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (type != null) 'type': type,
      if (priority != null) 'priority': priority,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/kitchen/orders',
        queryParameters: query);
    return response;
  }

  // GET /api/kitchen/orders/:id
  Future<Map<String, dynamic>> getOrder(String id) async {
    final response = await get<Map<String, dynamic>>('/kitchen/orders/$id');
    return response;
  }

  // PATCH /api/kitchen/orders/:id/status
  Future<Map<String, dynamic>> updateOrderStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/kitchen/orders/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // POST /api/kitchen/orders/:id/start
  Future<Map<String, dynamic>> startOrder(String id) async {
    final response =
        await post<Map<String, dynamic>>('/kitchen/orders/$id/start');
    return response;
  }

  // POST /api/kitchen/orders/:id/complete
  Future<Map<String, dynamic>> completeOrder(String id) async {
    final response =
        await post<Map<String, dynamic>>('/kitchen/orders/$id/complete');
    return response;
  }

  // POST /api/kitchen/orders/:id/bump
  Future<Map<String, dynamic>> bumpOrder(String id) async {
    final response =
        await post<Map<String, dynamic>>('/kitchen/orders/$id/bump');
    return response;
  }

  // ==================== KITCHEN MENU ====================

  // GET /api/kitchen/menu
  Future<Map<String, dynamic>> getMenu({
    String? category,
    bool? isAvailable,
    int? branchId,
  }) async {
    final query = {
      if (category != null) 'category': category,
      if (isAvailable != null) 'isAvailable': isAvailable,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/kitchen/menu',
        queryParameters: query);
    return response;
  }

  // GET /api/kitchen/menu/:id
  Future<Map<String, dynamic>> getMenuItem(String id) async {
    final response = await get<Map<String, dynamic>>('/kitchen/menu/$id');
    return response;
  }

  // POST /api/kitchen/menu
  Future<Map<String, dynamic>> createMenuItem(Map<String, dynamic> item) async {
    final response =
        await post<Map<String, dynamic>>('/kitchen/menu', data: item);
    return response;
  }

  // PUT /api/kitchen/menu/:id
  Future<Map<String, dynamic>> updateMenuItem(
      String id, Map<String, dynamic> item) async {
    final response =
        await put<Map<String, dynamic>>('/kitchen/menu/$id', data: item);
    return response;
  }

  // PATCH /api/kitchen/menu/:id/recipe
  Future<Map<String, dynamic>> updateRecipe(
      String id, Map<String, dynamic> recipe) async {
    final response = await patch<Map<String, dynamic>>(
        '/kitchen/menu/$id/recipe',
        data: recipe);
    return response;
  }

  // ==================== FOOD CONTROLS ====================

  // GET /api/food-control
  Future<Map<String, dynamic>> getFoodControls({
    String? date,
    String? mealPeriod,
    int? branchId,
  }) async {
    final query = {
      if (date != null) 'date': date,
      if (mealPeriod != null) 'mealPeriod': mealPeriod,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/food-control',
        queryParameters: query);
    return response;
  }

  // GET /api/food-control/config
  Future<Map<String, dynamic>> getFoodControlConfig({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/food-control/config',
        queryParameters: query);
    return response;
  }

  // POST /api/food-control
  Future<Map<String, dynamic>> recordFoodControl(
      Map<String, dynamic> control) async {
    final response =
        await post<Map<String, dynamic>>('/food-control', data: control);
    return response;
  }

  // GET /api/branch-food-control-config
  Future<Map<String, dynamic>> getBranchFoodControlConfig(int branchId) async {
    final response = await get<Map<String, dynamic>>(
        '/branch-food-control-config/$branchId');
    return response;
  }

  // PUT /api/branch-food-control-config/:id
  Future<Map<String, dynamic>> updateBranchFoodControlConfig(
      String id, Map<String, dynamic> config) async {
    final response = await put<Map<String, dynamic>>(
        '/branch-food-control-config/$id',
        data: config);
    return response;
  }

  // ==================== KITCHEN STOCK REQUESTS ====================

  // GET /api/kitchen/stock-requests
  Future<Map<String, dynamic>> getStockRequests({
    String? status,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/kitchen/stock-requests',
        queryParameters: query);
    return response;
  }

  // POST /api/kitchen/stock-requests
  Future<Map<String, dynamic>> createStockRequest(
      Map<String, dynamic> request) async {
    final response = await post<Map<String, dynamic>>('/kitchen/stock-requests',
        data: request);
    return response;
  }

  // POST /api/kitchen/stock-requests/:id/approve
  Future<Map<String, dynamic>> approveStockRequest(String id) async {
    final response =
        await post<Map<String, dynamic>>('/kitchen/stock-requests/$id/approve');
    return response;
  }

  // ==================== KITCHEN LEDGER ====================

  // GET /api/kitchen-ledger
  Future<Map<String, dynamic>> getKitchenLedger({
    String? startDate,
    String? endDate,
    String? type,
    int? branchId,
  }) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (type != null) 'type': type,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/kitchen-ledger',
        queryParameters: query);
    return response;
  }

  // POST /api/kitchen-ledger
  Future<Map<String, dynamic>> addLedgerEntry(
      Map<String, dynamic> entry) async {
    final response =
        await post<Map<String, dynamic>>('/kitchen-ledger', data: entry);
    return response;
  }

  // ==================== KITCHEN OPERATIONS ====================

  // GET /api/kitchen/operations/production
  Future<Map<String, dynamic>> getProduction(
      {String? date, int? branchId}) async {
    final query = {
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>(
        '/kitchen/operations/production',
        queryParameters: query);
    return response;
  }

  // POST /api/kitchen/operations/production
  Future<Map<String, dynamic>> recordProduction(
      Map<String, dynamic> production) async {
    final response = await post<Map<String, dynamic>>(
        '/kitchen/operations/production',
        data: production);
    return response;
  }

  // GET /api/kitchen/operations/usage
  Future<Map<String, dynamic>> getUsage({String? date, int? branchId}) async {
    final query = {
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>(
        '/kitchen/operations/usage',
        queryParameters: query);
    return response;
  }

  // ==================== KITCHEN WASTAGE ====================

  // GET /api/kitchen/wastage
  Future<Map<String, dynamic>> getWastage({
    String? startDate,
    String? endDate,
    String? type,
    int? branchId,
  }) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (type != null) 'type': type,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/kitchen/wastage',
        queryParameters: query);
    return response;
  }

  // POST /api/kitchen/wastage
  Future<Map<String, dynamic>> recordWastage(
      Map<String, dynamic> wastage) async {
    final response =
        await post<Map<String, dynamic>>('/kitchen/wastage', data: wastage);
    return response;
  }

  // ==================== POS KITCHEN ====================

  // GET /api/pos-kitchen/orders
  Future<Map<String, dynamic>> getPOSKitchenOrders({
    String? status,
    int? branchId,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/pos-kitchen/orders',
        queryParameters: query);
    return response;
  }

  // POST /api/pos-kitchen/orders/:id/acknowledge
  Future<Map<String, dynamic>> acknowledgeOrder(String id) async {
    final response =
        await post<Map<String, dynamic>>('/pos-kitchen/orders/$id/acknowledge');
    return response;
  }
}
