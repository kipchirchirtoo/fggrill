import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final barServiceProvider = Provider<BarService>((ref) {
  return BarService(ref.watch(dioProvider));
});

class BarService extends BaseApiService {
  BarService(super.dio);

  // ==================== BAR ORDERS ====================

  // GET /api/bar/orders
  Future<Map<String, dynamic>> getOrders({
    String? status,
    String? date,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/bar/orders', queryParameters: query);
    return response;
  }

  // GET /api/bar/orders/:id
  Future<Map<String, dynamic>> getOrder(String id) async {
    final response = await get<Map<String, dynamic>>('/bar/orders/$id');
    return response;
  }

  // POST /api/bar/orders
  Future<Map<String, dynamic>> createOrder(Map<String, dynamic> order) async {
    final response =
        await post<Map<String, dynamic>>('/bar/orders', data: order);
    return response;
  }

  // PATCH /api/bar/orders/:id/status
  Future<Map<String, dynamic>> updateOrderStatus(
      String id, String status) async {
    final response = await patch<Map<String, dynamic>>(
      '/bar/orders/$id/status',
      data: {'status': status},
    );
    return response;
  }

  // POST /api/bar/orders/:id/void
  Future<Map<String, dynamic>> voidOrder(String id,
      {String? reason, String? authorizedBy}) async {
    final response = await post<Map<String, dynamic>>(
      '/bar/orders/$id/void',
      data: {
        if (reason != null) 'reason': reason,
        if (authorizedBy != null) 'authorizedBy': authorizedBy,
      },
    );
    return response;
  }

  // POST /api/bar/orders/:id/payment
  Future<Map<String, dynamic>> recordPayment(
      String id, Map<String, dynamic> payment) async {
    final response = await post<Map<String, dynamic>>('/bar/orders/$id/payment',
        data: payment);
    return response;
  }

  // ==================== BAR MENU ====================

  // Frontend parity: /dashboard/admin/bar/menu
  // GET /api/bar/categories
  Future<Map<String, dynamic>> getAdminCategories({int? branchId}) async {
    final response = await get<Map<String, dynamic>>(
      '/bar/categories',
      queryParameters: {if (branchId != null) 'branch_id': branchId},
    );
    return response;
  }

  // GET /api/bar/drinks
  Future<Map<String, dynamic>> getDrinks({
    String? categoryId,
    int? branchId,
  }) async {
    final response = await get<Map<String, dynamic>>(
      '/bar/drinks',
      queryParameters: {
        if (categoryId != null && categoryId.isNotEmpty)
          'category_id': categoryId,
        if (branchId != null) 'branch_id': branchId,
      },
    );
    return response;
  }

  // POST /api/bar/drinks
  Future<Map<String, dynamic>> createDrink(Map<String, dynamic> drink) async {
    final response =
        await post<Map<String, dynamic>>('/bar/drinks', data: drink);
    return response;
  }

  // PUT /api/bar/drinks/:id
  Future<Map<String, dynamic>> updateDrink(
      String id, Map<String, dynamic> drink) async {
    final response =
        await put<Map<String, dynamic>>('/bar/drinks/$id', data: drink);
    return response;
  }

  // DELETE /api/bar/drinks/:id
  Future<Map<String, dynamic>> deleteDrink(String id) async {
    final response = await delete<Map<String, dynamic>>('/bar/drinks/$id');
    return response;
  }

  // PUT /api/bar/drinks/:id/toggle
  Future<Map<String, dynamic>> toggleDrinkAvailability(String id) async {
    final response = await put<Map<String, dynamic>>('/bar/drinks/$id/toggle');
    return response;
  }

  // GET /api/bar/menu
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
    final response =
        await get<Map<String, dynamic>>('/bar/menu', queryParameters: query);
    return response;
  }

  // GET /api/bar/menu/:id
  Future<Map<String, dynamic>> getMenuItem(String id) async {
    final response = await get<Map<String, dynamic>>('/bar/menu/$id');
    return response;
  }

  // POST /api/bar/menu
  Future<Map<String, dynamic>> createMenuItem(Map<String, dynamic> item) async {
    final response = await post<Map<String, dynamic>>('/bar/menu', data: item);
    return response;
  }

  // PUT /api/bar/menu/:id
  Future<Map<String, dynamic>> updateMenuItem(
      String id, Map<String, dynamic> item) async {
    final response =
        await put<Map<String, dynamic>>('/bar/menu/$id', data: item);
    return response;
  }

  // PATCH /api/bar/menu/:id/availability
  Future<Map<String, dynamic>> updateAvailability(
      String id, bool isAvailable) async {
    final response = await patch<Map<String, dynamic>>(
      '/bar/menu/$id/availability',
      data: {'isAvailable': isAvailable},
    );
    return response;
  }

  // DELETE /api/bar/menu/:id
  Future<Map<String, dynamic>> deleteMenuItem(String id) async {
    final response = await delete<Map<String, dynamic>>('/bar/menu/$id');
    return response;
  }

  // ==================== BAR CATEGORIES ====================

  // GET /api/bar/categories
  Future<List<dynamic>> getCategories({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response =
        await get<List<dynamic>>('/bar/categories', queryParameters: query);
    return response;
  }

  // POST /api/bar/categories
  Future<Map<String, dynamic>> createCategory(
      Map<String, dynamic> category) async {
    final response =
        await post<Map<String, dynamic>>('/bar/categories', data: category);
    return response;
  }

  // ==================== BAR STOCK ====================

  // GET /api/bar/stock
  Future<Map<String, dynamic>> getStock({
    String? itemId,
    String? status,
    int? branchId,
  }) async {
    final query = {
      if (itemId != null) 'itemId': itemId,
      if (status != null) 'status': status,
      if (branchId != null) 'branchId': branchId,
    };
    final response =
        await get<Map<String, dynamic>>('/bar/stock', queryParameters: query);
    return response;
  }

  // POST /api/bar/stock/adjust
  Future<Map<String, dynamic>> adjustStock(
      Map<String, dynamic> adjustment) async {
    final response =
        await post<Map<String, dynamic>>('/bar/stock/adjust', data: adjustment);
    return response;
  }

  // ==================== BAR STOCK REQUESTS ====================

  // GET /api/bar-stock-requests
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
    final response = await get<Map<String, dynamic>>('/bar-stock-requests',
        queryParameters: query);
    return response;
  }

  // GET /api/bar-stock-requests/:id
  Future<Map<String, dynamic>> getStockRequest(String id) async {
    final response = await get<Map<String, dynamic>>('/bar-stock-requests/$id');
    return response;
  }

  // POST /api/bar-stock-requests
  Future<Map<String, dynamic>> createStockRequest(
      Map<String, dynamic> request) async {
    final response =
        await post<Map<String, dynamic>>('/bar-stock-requests', data: request);
    return response;
  }

  // POST /api/bar-stock-requests/:id/approve
  Future<Map<String, dynamic>> approveStockRequest(String id) async {
    final response =
        await post<Map<String, dynamic>>('/bar-stock-requests/$id/approve');
    return response;
  }

  // POST /api/bar-stock-requests/:id/fulfill
  Future<Map<String, dynamic>> fulfillStockRequest(String id) async {
    final response =
        await post<Map<String, dynamic>>('/bar-stock-requests/$id/fulfill');
    return response;
  }

  // ==================== POOL TOKENS ====================

  // GET /api/bar/pool-tokens
  Future<Map<String, dynamic>> getPoolTokens({
    String? status,
    String? date,
    int? branchId,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (date != null) 'date': date,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/bar/pool-tokens',
        queryParameters: query);
    return response;
  }

  // POST /api/bar/pool-tokens
  Future<Map<String, dynamic>> createPoolToken(
      Map<String, dynamic> token) async {
    final response =
        await post<Map<String, dynamic>>('/bar/pool-tokens', data: token);
    return response;
  }

  // POST /api/bar/pool-tokens/:id/redeem
  Future<Map<String, dynamic>> redeemPoolToken(String id) async {
    final response =
        await post<Map<String, dynamic>>('/bar/pool-tokens/$id/redeem');
    return response;
  }

  // ==================== BAR REPORTS ====================

  // GET /api/bar/reports/sales
  Future<Map<String, dynamic>> getSalesReport({
    String? startDate,
    String? endDate,
    int? branchId,
  }) async {
    final query = {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/bar/reports/sales',
        queryParameters: query);
    return response;
  }

  // GET /api/bar/reports/inventory
  Future<Map<String, dynamic>> getInventoryReport({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response = await get<Map<String, dynamic>>('/bar/reports/inventory',
        queryParameters: query);
    return response;
  }

  // ==================== BAR SHIFT ====================

  // GET /api/bar/shift
  Future<Map<String, dynamic>> getCurrentShift({int? branchId}) async {
    final query = {if (branchId != null) 'branchId': branchId};
    final response =
        await get<Map<String, dynamic>>('/bar/shift', queryParameters: query);
    return response;
  }

  // POST /api/bar/shift/open
  Future<Map<String, dynamic>> openShift(Map<String, dynamic> shift) async {
    final response =
        await post<Map<String, dynamic>>('/bar/shift/open', data: shift);
    return response;
  }

  // POST /api/bar/shift/close
  Future<Map<String, dynamic>> closeShift(Map<String, dynamic> shift) async {
    final response =
        await post<Map<String, dynamic>>('/bar/shift/close', data: shift);
    return response;
  }

  // GET /api/bar/shift/report
  Future<Map<String, dynamic>> getShiftReport(String shiftId) async {
    final response =
        await get<Map<String, dynamic>>('/bar/shift/$shiftId/report');
    return response;
  }
}
