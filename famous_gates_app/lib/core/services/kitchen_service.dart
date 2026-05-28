import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final kitchenServiceProvider = Provider<KitchenService>((ref) {
  return KitchenService(ref.watch(dioProvider));
});

class KitchenService extends BaseApiService {
  KitchenService(super.dio);

  // ==================== KITCHEN ORDERS (KDS) ====================

  // GET /api/restaurant/kitchen/orders
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
      if (branchId != null) 'branch_id': branchId,
    };
    final response = await get<Map<String, dynamic>>(
        '/restaurant/kitchen/orders',
        queryParameters: query);
    return response;
  }

  // GET /api/restaurant/orders/:id
  Future<Map<String, dynamic>> getOrder(String id) async {
    final response = await get<Map<String, dynamic>>('/restaurant/orders/$id');
    return response;
  }

  // PUT /api/restaurant/kitchen/orders/:id/status
  Future<Map<String, dynamic>> updateOrderStatus(
      String id, String status) async {
    final endpoint = id.startsWith('pos:')
        ? '/restaurant/kitchen/orders/$id/status'
        : '/restaurant/orders/$id/status';
    final response = await put<Map<String, dynamic>>(
      endpoint,
      data: {'status': status},
    );
    return response;
  }

  // Mark a KDS order as preparing.
  Future<Map<String, dynamic>> startOrder(String id) async {
    return updateOrderStatus(id, 'preparing');
  }

  // Mark a KDS order as ready.
  Future<Map<String, dynamic>> completeOrder(String id) async {
    return updateOrderStatus(id, 'ready');
  }

  // Mark a KDS order as served.
  Future<Map<String, dynamic>> bumpOrder(String id) async {
    return updateOrderStatus(id, 'served');
  }

  // ==================== KITCHEN MENU ====================

  // GET /api/restaurant/menu/items
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
    final response = await get<Map<String, dynamic>>('/restaurant/menu/items',
        queryParameters: query);
    return response;
  }

  // GET /api/restaurant/menu/items/:id
  Future<Map<String, dynamic>> getMenuItem(String id) async {
    final response =
        await get<Map<String, dynamic>>('/restaurant/menu/items/$id');
    return response;
  }

  // POST /api/restaurant/menu/items
  Future<Map<String, dynamic>> createMenuItem(Map<String, dynamic> item) async {
    final response =
        await post<Map<String, dynamic>>('/restaurant/menu/items', data: item);
    return response;
  }

  // PUT /api/restaurant/menu/items/:id
  Future<Map<String, dynamic>> updateMenuItem(
      String id, Map<String, dynamic> item) async {
    final response = await put<Map<String, dynamic>>(
        '/restaurant/menu/items/$id',
        data: item);
    return response;
  }

  // PUT /api/kitchen/recipes/:id
  Future<Map<String, dynamic>> updateRecipe(
      String id, Map<String, dynamic> recipe) async {
    final response =
        await put<Map<String, dynamic>>('/kitchen/recipes/$id', data: recipe);
    return response;
  }

  // ==================== FOOD CONTROLS ====================

  // GET /api/kitchen/food-controls
  Future<Map<String, dynamic>> getFoodControls({
    String? date,
    String? mealPeriod,
    int? branchId,
  }) async {
    final query = {
      if (date != null) 'date': date,
      if (mealPeriod != null) 'mealPeriod': mealPeriod,
      if (branchId != null) 'branch_id': branchId,
    };
    final response = await get<Map<String, dynamic>>('/kitchen/food-controls',
        queryParameters: query);
    return response;
  }

  // GET /api/kitchen/food-controls
  Future<Map<String, dynamic>> getFoodControlConfig({int? branchId}) async {
    final query = {if (branchId != null) 'branch_id': branchId};
    final response = await get<Map<String, dynamic>>('/kitchen/food-controls',
        queryParameters: query);
    return response;
  }

  // POST /api/kitchen/food-controls
  Future<Map<String, dynamic>> recordFoodControl(
      Map<String, dynamic> control) async {
    final response = await post<Map<String, dynamic>>('/kitchen/food-controls',
        data: control);
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

  // GET /api/kitchen/requisitions
  Future<Map<String, dynamic>> getStockRequests({
    String? status,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (branchId != null) 'branch_id': branchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/kitchen/requisitions',
        queryParameters: query);
    return response;
  }

  // POST /api/kitchen/requisitions
  Future<Map<String, dynamic>> createStockRequest(
      Map<String, dynamic> request) async {
    final response = await post<Map<String, dynamic>>('/kitchen/requisitions',
        data: request);
    return response;
  }

  // PUT /api/kitchen/requisitions/:id/approve
  Future<Map<String, dynamic>> approveStockRequest(String id) async {
    final response =
        await put<Map<String, dynamic>>('/kitchen/requisitions/$id/approve');
    return response;
  }

  // ==================== KITCHEN LEDGER ====================

  // GET /api/kitchen-ledger/ledger
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
      if (branchId != null) 'branch_id': branchId,
    };
    final response = await get<Map<String, dynamic>>('/kitchen-ledger/ledger',
        queryParameters: query);
    return response;
  }

  // POST /api/kitchen-ledger/ledger
  Future<Map<String, dynamic>> addLedgerEntry(
      Map<String, dynamic> entry) async {
    final response =
        await post<Map<String, dynamic>>('/kitchen-ledger/ledger', data: entry);
    return response;
  }

  // ==================== KITCHEN OPERATIONS ====================

  // GET /api/kitchen/expected-portions
  Future<Map<String, dynamic>> getProduction(
      {String? date, int? branchId}) async {
    final query = {
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>(
        '/kitchen/expected-portions',
        queryParameters: query);
    return response;
  }

  // PUT /api/kitchen/expected-portions/:id/verify
  Future<Map<String, dynamic>> recordProduction(
      Map<String, dynamic> production) async {
    final id = production['id'] ?? production['portion_id'];
    final response = await put<Map<String, dynamic>>(
        '/kitchen/expected-portions/$id/verify',
        data: production);
    return response;
  }

  // GET /api/kitchen/usage
  Future<Map<String, dynamic>> getUsage({String? date, int? branchId}) async {
    final query = {
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/kitchen/usage',
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

  // GET /api/restaurant/kitchen/orders
  Future<Map<String, dynamic>> getPOSKitchenOrders({
    String? status,
    int? branchId,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (branchId != null) 'branch_id': branchId,
    };
    final response = await get<Map<String, dynamic>>(
        '/restaurant/kitchen/orders',
        queryParameters: query);
    return response;
  }

  // PUT /api/restaurant/kitchen/orders/:id/status
  Future<Map<String, dynamic>> acknowledgeOrder(String id) async {
    return updateOrderStatus(id, 'preparing');
  }
}
