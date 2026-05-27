import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/dio_client.dart';
import 'api_service.dart';

final storeServiceProvider = Provider<StoreService>((ref) {
  return StoreService(ref.watch(dioProvider));
});

class StoreService extends BaseApiService {
  StoreService(super.dio);

  // ==================== INVENTORY ====================

  // GET /api/inventory
  Future<Map<String, dynamic>> getInventory({
    String? category,
    String? status,
    int? branchId,
    bool? lowStock,
  }) async {
    final query = {
      if (category != null) 'category': category,
      if (status != null) 'status': status,
      if (branchId != null) 'branchId': branchId,
      if (lowStock != null) 'lowStock': lowStock,
    };
    final response =
        await get<Map<String, dynamic>>('/inventory', queryParameters: query);
    return response;
  }

  // GET /api/inventory/:id
  Future<Map<String, dynamic>> getInventoryItem(String id) async {
    final response = await get<Map<String, dynamic>>('/inventory/$id');
    return response;
  }

  // POST /api/inventory
  Future<Map<String, dynamic>> createInventoryItem(
      Map<String, dynamic> item) async {
    final response = await post<Map<String, dynamic>>('/inventory', data: item);
    return response;
  }

  // PUT /api/inventory/:id
  Future<Map<String, dynamic>> updateInventoryItem(
      String id, Map<String, dynamic> item) async {
    final response =
        await put<Map<String, dynamic>>('/inventory/$id', data: item);
    return response;
  }

  // PATCH /api/inventory/:id/stock
  Future<Map<String, dynamic>> updateStock(String id, double quantity,
      {String? reason}) async {
    final response = await patch<Map<String, dynamic>>(
      '/inventory/$id/stock',
      data: {'quantity': quantity, if (reason != null) 'reason': reason},
    );
    return response;
  }

  // ==================== STOREKEEPING ====================

  // GET /api/store/items
  Future<Map<String, dynamic>> getStoreItems({
    String? category,
    String? sku,
    int? branchId,
    bool? isCentral,
  }) async {
    final query = {
      if (category != null) 'category': category,
      if (sku != null) 'sku': sku,
      if (branchId != null) 'branchId': branchId,
      if (isCentral != null) 'isCentral': isCentral,
    };
    final response =
        await get<Map<String, dynamic>>('/store/items', queryParameters: query);
    return response;
  }

  // GET /api/store/items/:id
  Future<Map<String, dynamic>> getStoreItem(String id) async {
    final response = await get<Map<String, dynamic>>('/store/items/$id');
    return response;
  }

  // POST /api/store/items
  Future<Map<String, dynamic>> createStoreItem(
      Map<String, dynamic> item) async {
    final response =
        await post<Map<String, dynamic>>('/store/items', data: item);
    return response;
  }

  // PUT /api/store/items/:id
  Future<Map<String, dynamic>> updateStoreItem(
      String id, Map<String, dynamic> item) async {
    final response =
        await put<Map<String, dynamic>>('/store/items/$id', data: item);
    return response;
  }

  // ==================== STOCK TAKES ====================

  // GET /api/stock-takes
  Future<Map<String, dynamic>> getStockTakes({
    String? status,
    String? type,
    int? branchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (type != null) 'type': type,
      if (branchId != null) 'branchId': branchId,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/stock-takes', queryParameters: query);
    return response;
  }

  // GET /api/stock-takes/:id
  Future<Map<String, dynamic>> getStockTake(String id) async {
    final response = await get<Map<String, dynamic>>('/stock-takes/$id');
    return response;
  }

  // POST /api/stock-takes
  Future<Map<String, dynamic>> createStockTake(
      Map<String, dynamic> stockTake) async {
    final response =
        await post<Map<String, dynamic>>('/stock-takes', data: stockTake);
    return response;
  }

  // POST /api/stock-takes/:id/count
  Future<Map<String, dynamic>> recordStockCount(
      String id, Map<String, dynamic> count) async {
    final response =
        await post<Map<String, dynamic>>('/stock-takes/$id/count', data: count);
    return response;
  }

  // POST /api/stock-takes/:id/complete
  Future<Map<String, dynamic>> completeStockTake(String id) async {
    final response =
        await post<Map<String, dynamic>>('/stock-takes/$id/complete');
    return response;
  }

  // POST /api/stock-takes/:id/adjust
  Future<Map<String, dynamic>> adjustStock(
      String id, Map<String, dynamic> adjustment) async {
    final response = await post<Map<String, dynamic>>('/stock-takes/$id/adjust',
        data: adjustment);
    return response;
  }

  // ==================== TRANSFERS ====================

  // GET /api/store/transfers
  Future<Map<String, dynamic>> getTransfers({
    String? status,
    int? fromBranchId,
    int? toBranchId,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (fromBranchId != null) 'fromBranchId': fromBranchId,
      if (toBranchId != null) 'toBranchId': toBranchId,
      'page': page,
      'limit': limit,
    };
    final response = await get<Map<String, dynamic>>('/store/transfers',
        queryParameters: query);
    return response;
  }

  // GET /api/store/transfers/:id
  Future<Map<String, dynamic>> getTransfer(String id) async {
    final response = await get<Map<String, dynamic>>('/store/transfers/$id');
    return response;
  }

  // POST /api/store/transfers
  Future<Map<String, dynamic>> createTransfer(
      Map<String, dynamic> transfer) async {
    final response =
        await post<Map<String, dynamic>>('/store/transfers', data: transfer);
    return response;
  }

  // POST /api/store/transfers/:id/approve
  Future<Map<String, dynamic>> approveTransfer(String id) async {
    final response =
        await post<Map<String, dynamic>>('/store/transfers/$id/approve');
    return response;
  }

  // POST /api/store/transfers/:id/receive
  Future<Map<String, dynamic>> receiveTransfer(
      String id, Map<String, dynamic> receipt) async {
    final response = await post<Map<String, dynamic>>(
        '/store/transfers/$id/receive',
        data: receipt);
    return response;
  }

  // POST /api/store/transfers/:id/dispatch
  Future<Map<String, dynamic>> dispatchTransfer(String id) async {
    final response =
        await post<Map<String, dynamic>>('/store/transfers/$id/dispatch');
    return response;
  }

  // ==================== DISPATCH ====================

  // GET /api/dispatch
  Future<Map<String, dynamic>> getDispatches({
    String? status,
    int? branchId,
    String? type,
    int page = 1,
    int limit = 50,
  }) async {
    final query = {
      if (status != null) 'status': status,
      if (branchId != null) 'branchId': branchId,
      if (type != null) 'type': type,
      'page': page,
      'limit': limit,
    };
    final response =
        await get<Map<String, dynamic>>('/dispatch', queryParameters: query);
    return response;
  }

  // GET /api/dispatch/:id
  Future<Map<String, dynamic>> getDispatch(String id) async {
    final response = await get<Map<String, dynamic>>('/dispatch/$id');
    return response;
  }

  // POST /api/dispatch
  Future<Map<String, dynamic>> createDispatch(
      Map<String, dynamic> dispatch) async {
    final response =
        await post<Map<String, dynamic>>('/dispatch', data: dispatch);
    return response;
  }

  // POST /api/dispatch/:id/complete
  Future<Map<String, dynamic>> completeDispatch(String id) async {
    final response = await post<Map<String, dynamic>>('/dispatch/$id/complete');
    return response;
  }

  // ==================== STOCK ANALYTICS ====================

  // GET /api/store/analytics
  Future<Map<String, dynamic>> getStockAnalytics({
    String? period,
    int? branchId,
    String? metric,
  }) async {
    final query = {
      if (period != null) 'period': period,
      if (branchId != null) 'branchId': branchId,
      if (metric != null) 'metric': metric,
    };
    final response = await get<Map<String, dynamic>>('/store/analytics',
        queryParameters: query);
    return response;
  }

  // GET /api/store/low-stock
  Future<Map<String, dynamic>> getLowStock(
      {int? branchId, int? threshold}) async {
    final query = {
      if (branchId != null) 'branchId': branchId,
      if (threshold != null) 'threshold': threshold,
    };
    final response = await get<Map<String, dynamic>>('/store/low-stock',
        queryParameters: query);
    return response;
  }

  // GET /api/store/movements
  Future<Map<String, dynamic>> getStockMovements({
    String? itemId,
    String? startDate,
    String? endDate,
    int? branchId,
  }) async {
    final query = {
      if (itemId != null) 'itemId': itemId,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
    };
    final response = await get<Map<String, dynamic>>('/store/movements',
        queryParameters: query);
    return response;
  }

  // ==================== WASTAGE ====================

  // GET /api/wastage
  Future<Map<String, dynamic>> getWastage({
    String? type,
    String? startDate,
    String? endDate,
    int? branchId,
  }) async {
    final query = {
      if (type != null) 'type': type,
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
      if (branchId != null) 'branchId': branchId,
    };
    final response =
        await get<Map<String, dynamic>>('/wastage', queryParameters: query);
    return response;
  }

  // POST /api/wastage
  Future<Map<String, dynamic>> recordWastage(
      Map<String, dynamic> wastage) async {
    final response =
        await post<Map<String, dynamic>>('/wastage', data: wastage);
    return response;
  }
}
