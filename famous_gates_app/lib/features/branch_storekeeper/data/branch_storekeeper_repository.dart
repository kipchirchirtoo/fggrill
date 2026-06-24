import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';

final branchStorekeeperRepositoryProvider =
    Provider<BranchStorekeeperRepository>((ref) {
  return BranchStorekeeperRepository(ref.read(dioProvider), ref);
});

class BranchStorekeeperRepository {
  BranchStorekeeperRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> get _branchId async {
    final storage = _ref.read(secureStorageProvider);
    return await storage.read(key: AuthRepository.branchIdKey) ?? '';
  }

  /// The logged-in storekeeper's branch id, or null if unavailable.
  /// Only Kyogong (branch 1) has a separate Executive Bar outlet — every
  /// other branch has just one bar.
  Future<int?> currentBranchId() async {
    return int.tryParse(await _branchId);
  }

  Future<Options> get _authOptions async {
    final storage = _ref.read(secureStorageProvider);
    final token =
        (await storage.read(key: AuthRepository.jwtKey))?.trim() ?? '';
    if (token.isEmpty || token.toLowerCase() == 'null') {
      return Options();
    }
    return Options(headers: {'Authorization': 'Bearer $token'});
  }

  Future<Options> _requestOptions({ResponseType? responseType}) async {
    return (await _authOptions).copyWith(responseType: responseType);
  }

  Map<String, dynamic> _map(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    return <String, dynamic>{};
  }

  Map<String, dynamic> _unwrapMap(dynamic data) {
    final raw = _map(data);
    final payload = raw['data'];
    if (payload is Map) return Map<String, dynamic>.from(payload);
    return raw;
  }

  List<Map<String, dynamic>> _unwrapList(dynamic data) {
    final raw = data is Map ? data : null;
    final payload = raw == null
        ? data
        : raw['data'] ?? raw['items'] ?? raw['rows'] ?? raw['results'];
    if (payload is List) {
      return payload
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    if (payload is Map) return [Map<String, dynamic>.from(payload)];
    return <Map<String, dynamic>>[];
  }

  Future<Map<String, dynamic>> _branchQuery(
      [Map<String, dynamic>? extra]) async {
    final branchId = await _branchId;
    return {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      ...?extra,
    };
  }

  Future<Map<String, dynamic>> dashboard() async {
    final response = await _dio.get(
      '/store/dashboard/branch',
      queryParameters: await _branchQuery(),
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> branchStock({
    String? search,
    String? category,
  }) async {
    final response = await _dio.get(
      '/store/branch-stock',
      queryParameters: await _branchQuery({
        if (search != null && search.isNotEmpty) 'search': search,
        if (category != null && category != 'all') 'category': category,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> lowStock() async {
    final response = await _dio.get(
      '/store/branch-stock/low',
      queryParameters: await _branchQuery(),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> masterCatalog({
    String? search,
    String? category,
    int limit = 500,
  }) async {
    final response = await _dio.get(
      '/store/master-catalog',
      queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
        if (category != null && category != 'all') 'category': category,
        'limit': limit,
      },
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> storeItems({
    String? search,
    String? storeType,
    int limit = 500,
  }) async {
    final response = await _dio.get(
      '/store/items',
      queryParameters: {
        if (search != null && search.isNotEmpty) 'search': search,
        if (storeType != null && storeType.isNotEmpty) 'store_type': storeType,
        'limit': limit,
      },
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<void> createItem(Map<String, dynamic> data) async {
    await _dio.post('/store/items', data: data, options: await _authOptions);
  }

  // ---------------------------------------------------------------------
  // Bar stock ledger — built on bar_stock, the table actually decremented
  // when a bar sale completes (see backend decrement_bar_stock()).
  // ---------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> barStockLedger({String? search}) async {
    final response = await _dio.get(
      '/bar/stock-ledger',
      queryParameters: await _branchQuery({
        if (search != null && search.isNotEmpty) 'search': search,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<void> restockBarDrink(
    String drinkId,
    double quantity, {
    double? costPerUnit,
    String? notes,
  }) async {
    await _dio.post(
      '/bar/stock-ledger/$drinkId/restock',
      data: {
        'quantity': quantity,
        if (costPerUnit != null) 'cost_per_unit': costPerUnit,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        ...await _branchQuery(),
      },
      options: await _authOptions,
    );
  }

  Future<List<Map<String, dynamic>>> barStockMovements({
    String? drinkId,
    int limit = 100,
  }) async {
    final response = await _dio.get(
      '/bar/stock-ledger/movements',
      queryParameters: await _branchQuery({
        if (drinkId != null) 'drink_id': drinkId,
        'limit': limit,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<void> updateBarDrinkPricing(
    String drinkId, {
    double? price,
    double? costPrice,
  }) async {
    await _dio.put(
      '/bar/drinks/$drinkId',
      data: {
        if (price != null) 'price': price,
        if (costPrice != null) 'cost_price': costPrice,
      },
      options: await _authOptions,
    );
  }

  Future<void> createBarDrink(Map<String, dynamic> data) async {
    await _dio.post('/bar/drinks', data: data, options: await _authOptions);
  }

  Future<void> adjustBranchStock(Map<String, dynamic> data) async {
    await _dio.post(
      '/store/branch-stock/adjustment',
      data: {
        ...data,
        ...await _branchQuery(),
      },
      options: await _authOptions,
    );
  }

  Future<void> recordStockOut(Map<String, dynamic> data) async {
    await _dio.post(
      '/store/branch-stock/out',
      data: {
        ...data,
        ...await _branchQuery(),
      },
      options: await _authOptions,
    );
  }

  Future<Map<String, dynamic>> recordDepartmentIssue(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/store/department-issues',
        data: {
          ...data,
          ...await _branchQuery(),
        },
        options: await _authOptions);
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> departmentAccounts() async {
    final response = await _dio.get(
      '/store/department-accounts',
      queryParameters: await _branchQuery(),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> departmentConsumption({
    String? startDate,
    String? endDate,
    String? departmentCode,
  }) async {
    final response = await _dio.get(
      '/store/department-consumption',
      queryParameters: await _branchQuery({
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
        if (departmentCode != null && departmentCode.isNotEmpty)
          'department_code': departmentCode,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> departmentIssueJournals({
    String? departmentCode,
    String? startDate,
    String? endDate,
  }) async {
    final response = await _dio.get(
      '/store/department-issue-journals',
      queryParameters: await _branchQuery({
        if (departmentCode != null && departmentCode.isNotEmpty)
          'department_code': departmentCode,
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> departmentIssueJournalDetail(String id) async {
    final response = await _dio.get(
      '/store/department-issue-journals/$id',
      queryParameters: await _branchQuery(),
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> enterpriseInventoryAnalytics({
    String? startDate,
    String? endDate,
  }) async {
    final response = await _dio.get(
      '/store/enterprise-inventory/analytics',
      queryParameters: await _branchQuery({
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      }),
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> stockMovements({
    String? movementType,
  }) async {
    final response = await _dio.get(
      '/store/stock-movements',
      queryParameters: await _branchQuery({
        if (movementType != null) 'movement_type': movementType,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> inventoryTruthLocations({
    String? type,
  }) async {
    final response = await _dio.get(
      '/inventory-foundation/locations',
      queryParameters: await _branchQuery({
        if (type != null && type.isNotEmpty) 'type': type,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> inventoryTruthBalances({
    String? search,
    int limit = 200,
  }) async {
    final response = await _dio.get(
      '/inventory-foundation/balances',
      queryParameters: await _branchQuery({
        if (search != null && search.isNotEmpty) 'search': search,
        'limit': limit,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> inventoryTruthMovements({
    String? movementType,
    int limit = 80,
  }) async {
    final response = await _dio.get(
      '/inventory-foundation/movements',
      queryParameters: await _branchQuery({
        if (movementType != null && movementType.isNotEmpty)
          'movement_type': movementType,
        'limit': limit,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> outletStock({
    String? search,
    int limit = 250,
  }) async {
    final response = await _dio.get(
      '/inventory-foundation/outlet-stock',
      queryParameters: await _branchQuery({
        if (search != null && search.isNotEmpty) 'search': search,
        'limit': limit,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> posOutlets({
    String? outletType,
  }) async {
    final response = await _dio.get(
      '/pos/outlets',
      queryParameters: await _branchQuery({
        if (outletType != null && outletType.isNotEmpty)
          'outlet_type': outletType,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> posOutletItems(String outletId) async {
    final response = await _dio.get(
      '/pos/outlets/$outletId/items',
      queryParameters: {'include_related': 'false'},
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> posOutletItemsByType(
    String outletType,
  ) async {
    final outlets = await posOutlets(outletType: outletType);
    if (outlets.isEmpty) return const [];
    return posOutletItems('${outlets.first['id']}');
  }

  Future<Map<String, dynamic>> createProductionRun(
      Map<String, dynamic> data) async {
    final response = await _dio.post(
      '/inventory-foundation/production-runs',
      data: {
        ...data,
        ...await _branchQuery(),
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> inventoryTruthReservations({
    String? state,
    int limit = 80,
  }) async {
    final response = await _dio.get(
      '/inventory-foundation/reservations',
      queryParameters: await _branchQuery({
        if (state != null && state.isNotEmpty) 'state': state,
        'limit': limit,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> inventoryTruthAlerts({
    String status = 'open',
    int limit = 80,
  }) async {
    final response = await _dio.get(
      '/inventory-foundation/alerts',
      queryParameters: await _branchQuery({
        if (status.isNotEmpty) 'status': status,
        'limit': limit,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<void> recomputeInventoryTruth() async {
    await _dio.post(
      '/inventory-foundation/balances/recompute',
      data: await _branchQuery(),
      options: await _authOptions,
    );
  }

  Future<List<Map<String, dynamic>>> incomingDispatches() async {
    final response = await _dio.get(
      '/store/incoming-dispatches',
      queryParameters: await _branchQuery(),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<void> confirmDispatch(
      String dispatchId, Map<String, dynamic> data) async {
    await _dio.put(
      '/store/dispatch-notes/$dispatchId/confirm',
      data: data,
      options: await _authOptions,
    );
  }

  Future<Map<String, dynamic>> receiveFromSupplier(
      Map<String, dynamic> data) async {
    final response = await _dio.post('/store/branch-stock/receive-supplier',
        data: {
          ...data,
          ...await _branchQuery(),
        },
        options: await _authOptions);
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> suppliers({
    String scope = 'branch',
    String? status,
    String? search,
  }) async {
    final response = await _dio.get(
      '/store/suppliers',
      queryParameters: {
        'scope': scope,
        if (status != null && status != 'ALL') 'status': status,
        if (search != null && search.isNotEmpty) 'search': search,
      },
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<void> createSupplier(Map<String, dynamic> data) async {
    await _dio.post('/store/suppliers',
        data: data, options: await _authOptions);
  }

  Future<void> updateSupplier(String id, Map<String, dynamic> data) async {
    await _dio.put(
      '/store/suppliers/$id',
      data: data,
      options: await _authOptions,
    );
  }

  Future<void> deleteSupplier(String id) async {
    await _dio.delete('/store/suppliers/$id', options: await _authOptions);
  }

  Future<List<Map<String, dynamic>>> stockTakes({
    String storeType = 'all',
  }) async {
    final response = await _dio.get(
      '/stock-takes',
      queryParameters: await _branchQuery({
        if (storeType != 'all') 'store_type': storeType,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> createStockTake({
    String countType = 'daily',
    String storeType = 'foodstuffs',
    String? outletCode,
    List<String>? itemSkus,
  }) async {
    final response = await _dio.post('/stock-takes',
        data: {
          ...await _branchQuery(),
          'count_type': countType,
          'store_type': storeType,
          if (outletCode != null && outletCode.isNotEmpty)
            'outlet_code': outletCode,
          if (itemSkus != null && itemSkus.isNotEmpty) 'item_skus': itemSkus,
        },
        options: await _authOptions);
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> stockTake(String id) async {
    final response =
        await _dio.get('/stock-takes/$id', options: await _authOptions);
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> stockTakeItems(String id) async {
    final response =
        await _dio.get('/stock-takes/$id/items', options: await _authOptions);
    return _unwrapList(response.data);
  }

  Future<void> updateStockTake(
      String id, List<Map<String, dynamic>> items) async {
    await _dio.put(
      '/stock-takes/$id',
      data: {'items': items},
      options: await _authOptions,
    );
  }

  Future<void> updateStockTakeItem(
    String itemId,
    Map<String, dynamic> data,
  ) async {
    await _dio.put(
      '/store/stock-take-items/$itemId',
      data: data,
      options: await _authOptions,
    );
  }

  Future<void> completeStockTake(String id, {String? notes}) async {
    await _dio.post(
      '/store/stock-takes/$id/submit-accountant',
      data: {
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      },
      options: await _authOptions,
    );
  }

  Future<File> downloadStockTakeWorksheet({
    String? id,
    String? category,
  }) async {
    final endpoint =
        id == null ? '/stock-takes/worksheet' : '/stock-takes/$id/worksheet';
    final query = await _branchQuery({
      if (category != null && category != 'all') 'category': category,
    });
    return _downloadGet(
      endpoint,
      filename: 'StockTakeWorksheet_${id ?? 'All'}_${_today()}.pdf',
      queryParameters: query,
    );
  }

  Future<File> downloadCategorizedStockTakeWorksheet(String id) {
    return _downloadGet(
      '/stock-takes/$id/worksheet-categorized',
      filename: 'StockTakeWorksheet_${id}_${_today()}.pdf',
    );
  }

  /// FG-branded executive stock take report (variance/audit).
  /// [variant] is one of: storekeeper | accountant_review | audit.
  Future<File> downloadStockTakeReportPdf(
    String id, {
    String variant = 'storekeeper',
  }) {
    return _downloadGet(
      '/stock-takes/$id/report.pdf',
      filename: 'FG_StockTakeReport_${id}_${_today()}.pdf',
      queryParameters: {'variant': variant},
    );
  }

  /// FG-branded multi-sheet stock take Excel workbook.
  Future<File> downloadStockTakeReportWorkbook(
    String id, {
    String variant = 'storekeeper',
  }) {
    return _downloadGet(
      '/stock-takes/$id/report.xlsx',
      filename: 'FG_StockTakeWorkbook_${id}_${_today()}.xlsx',
      queryParameters: {'variant': variant},
    );
  }

  Future<List<Map<String, dynamic>>> purchaseOrders({
    String? status,
  }) async {
    final response = await _dio.get(
      '/store/purchase-orders',
      queryParameters: {
        'source_module': 'branch_store',
        if (status != null && status != 'ALL') 'status': status,
      },
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<void> createPurchaseOrder(Map<String, dynamic> data) async {
    await _dio.post(
      '/store/purchase-orders',
      queryParameters: {'source_module': 'branch_store'},
      data: data,
      options: await _authOptions,
    );
  }

  Future<Map<String, dynamic>> purchaseOrder(String id) async {
    final response = await _dio.get(
      '/store/purchase-orders/$id',
      queryParameters: {'source_module': 'branch_store'},
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<void> updatePurchaseOrder(String id, Map<String, dynamic> data) async {
    await _dio.put(
      '/store/purchase-orders/$id',
      queryParameters: {'source_module': 'branch_store'},
      data: data,
      options: await _authOptions,
    );
  }

  Future<void> deletePurchaseOrder(String id) async {
    await _dio.delete(
      '/store/purchase-orders/$id',
      queryParameters: {'source_module': 'branch_store'},
      options: await _authOptions,
    );
  }

  Future<void> approvePurchaseOrder(String id) async {
    await _dio.post(
      '/store/purchase-orders/$id/approve',
      queryParameters: {'source_module': 'branch_store'},
      options: await _authOptions,
    );
  }

  Future<void> receivePurchaseOrder(String id) async {
    await _dio.post(
      '/store/purchase-orders/$id/receive',
      queryParameters: {'source_module': 'branch_store'},
      options: await _authOptions,
    );
  }

  Future<void> cancelPurchaseOrder(String id) async {
    await _dio.post(
      '/store/purchase-orders/$id/cancel',
      queryParameters: {'source_module': 'branch_store'},
      options: await _authOptions,
    );
  }

  Future<List<Map<String, dynamic>>> stockRequests({String? status}) async {
    final response = await _dio.get(
      '/store/stock-requests',
      queryParameters: await _branchQuery({
        if (status != null && status != 'ALL') 'status': status,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<void> createStockRequest(Map<String, dynamic> data) async {
    final branchId = await _branchId;
    await _dio.post('/store/stock-requests',
        data: {
          ...data,
          if (branchId.isNotEmpty)
            'requesting_branch_id': int.tryParse(branchId),
        },
        options: await _authOptions);
  }

  Future<List<Map<String, dynamic>>> kitchenRequisitions({
    String? status,
  }) async {
    final response = await _dio.get(
      '/kitchen/requisitions',
      queryParameters: {
        ...await _branchQuery(),
        if (status != null && status != 'ALL') 'status': status,
      },
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<void> fulfillKitchenRequisition(
    String id,
    List<Map<String, dynamic>> issuedQuantities,
  ) async {
    await _dio.post('/kitchen/requisitions/$id/fulfill',
        data: {
          'issued_quantities': issuedQuantities,
        },
        options: await _authOptions);
  }

  Future<void> rejectKitchenRequisition(String id, String reason) async {
    await _dio.post('/kitchen/requisitions/$id/reject',
        data: {
          'reason': reason,
          'rejection_reason': reason,
        },
        options: await _authOptions);
  }

  Future<Map<String, dynamic>> getKitchenRequisitionRelatedActivity(
      String id) async {
    final response = await _dio.get(
      '/kitchen/requisitions/$id/related-activity',
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> trackableItems() async {
    final response = await _dio.get(
      '/store/kitchen-usage/trackable-items',
      queryParameters: await _branchQuery(),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> kitchenUsageRecords({
    String? status,
  }) async {
    final response = await _dio.get(
      '/store/kitchen-usage',
      queryParameters: await _branchQuery({
        if (status != null && status != 'ALL') 'status': status,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<void> createKitchenUsageRecord(Map<String, dynamic> data) async {
    await _dio.post('/store/kitchen-usage',
        data: {
          ...data,
          ...await _branchQuery(),
        },
        options: await _authOptions);
  }

  Future<List<Map<String, dynamic>>> kitchenUsageEntries(String id) async {
    final response = await _dio.get(
      '/store/kitchen-usage/$id/entries',
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<void> addKitchenUsageEntry(
      String id, Map<String, dynamic> data) async {
    await _dio.post(
      '/store/kitchen-usage/$id/entries',
      data: data,
      options: await _authOptions,
    );
  }

  Future<void> closeKitchenUsageRecord(
      String id, Map<String, dynamic> data) async {
    await _dio.put(
      '/store/kitchen-usage/$id/close',
      data: data,
      options: await _authOptions,
    );
  }

  Future<List<Map<String, dynamic>>> branchStaff() async {
    final response = await _dio.get(
      '/store/kitchen-usage/staff',
      queryParameters: await _branchQuery(),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> kitchenAccountability({
    String? startDate,
    String? endDate,
  }) async {
    final response = await _dio.get(
      '/store/kitchen-usage/accountability',
      queryParameters: await _branchQuery({
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> kitchenUsageSummary({
    String? startDate,
    String? endDate,
  }) async {
    final response = await _dio.get(
      '/store/kitchen-usage/summary',
      queryParameters: await _branchQuery({
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      }),
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<File> exportStockLedger({
    String? startDate,
    String? endDate,
  }) async {
    final branchId = await _branchId;
    return _downloadPost(
      '/store/stock-ledger/export',
      filename: 'stock_ledger_${_today()}.xlsx',
      data: {
        if (branchId.isNotEmpty)
          'branch_id': int.tryParse(branchId) ?? branchId,
        if (startDate != null) 'start_date': startDate,
        if (endDate != null) 'end_date': endDate,
      },
    );
  }

  Future<File> exportBrandedPdf(
    String reportType, {
    Map<String, dynamic> filters = const {},
  }) async {
    final branchId = await _branchId;
    final requestFilters = {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...filters,
    };

    try {
      return await _exportBrandedPdfAsync(reportType, requestFilters);
    } on DioException {
      return _downloadPost(
        '/reports/export',
        filename: '${reportType}_${_today()}.pdf',
        data: {
          'reportType': reportType,
          'format': 'pdf',
          'filters': requestFilters,
        },
      );
    } on StateError {
      return _downloadPost(
        '/reports/export',
        filename: '${reportType}_${_today()}.pdf',
        data: {
          'reportType': reportType,
          'format': 'pdf',
          'filters': requestFilters,
        },
      );
    }
  }

  Future<File> _exportBrandedPdfAsync(
    String reportType,
    Map<String, dynamic> filters,
  ) async {
    final response = await _dio.post('/reports/generate/async',
        data: {
          'reportType': reportType,
          'filters': filters,
          'useRealData': true,
        },
        options: await _authOptions);
    final init = _unwrapMap(response.data);
    final jobId = init['jobId'] ?? init['id'];
    if (jobId == null || '$jobId'.isEmpty) {
      throw StateError('Report generation did not return a job id');
    }

    Map<String, dynamic> job = {};
    for (var attempt = 0; attempt < 60; attempt++) {
      await Future<void>.delayed(const Duration(seconds: 2));
      final statusResponse = await _dio.get(
        '/reports/jobs/$jobId/status',
        options: await _authOptions,
      );
      job = _unwrapMap(statusResponse.data);
      final status = '${job['status'] ?? ''}'.toLowerCase();
      if (status == 'completed') break;
      if (status == 'failed') {
        throw StateError('${job['error'] ?? 'Report generation failed'}');
      }
    }

    final resultUrl = job['result_url'] ?? job['resultUrl'] ?? job['url'];
    if (resultUrl == null || '$resultUrl'.isEmpty) {
      throw StateError('Generated report is missing a download URL');
    }

    final url = '$resultUrl';
    final responseBytes = url.startsWith('http')
        ? await Dio().get<List<int>>(
            url,
            options: Options(responseType: ResponseType.bytes),
          )
        : await _dio.get<List<int>>(
            url,
            options: await _requestOptions(responseType: ResponseType.bytes),
          );
    return _saveBytes(
        responseBytes.data ?? const <int>[], '${reportType}_${_today()}.pdf');
  }

  Future<List<Map<String, dynamic>>> departmentRequestLogs({
    String? status,
  }) async {
    final response = await _dio.get(
      '/store/department-requests',
      queryParameters: await _branchQuery({
        if (status != null && status != 'ALL') 'status': status,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> createDepartmentRequestLog(
      Map<String, dynamic> data) async {
    final response = await _dio.post(
      '/store/department-requests',
      data: data,
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<void> issueDepartmentRequest(String id, {String? notes}) async {
    await _dio.post(
      '/store/department-requests/$id/issue',
      data: {if (notes != null && notes.isNotEmpty) 'notes': notes},
      options: await _authOptions,
    );
  }

  Future<File> _downloadGet(
    String endpoint, {
    required String filename,
    Map<String, dynamic> queryParameters = const {},
  }) async {
    final response = await _dio.get<List<int>>(
      endpoint,
      queryParameters: queryParameters,
      options: await _requestOptions(responseType: ResponseType.bytes),
    );
    return _saveBytes(response.data ?? const <int>[], filename);
  }

  Future<File> _downloadPost(
    String endpoint, {
    required String filename,
    Map<String, dynamic> data = const {},
  }) async {
    final response = await _dio.post<List<int>>(
      endpoint,
      data: data,
      options: await _requestOptions(responseType: ResponseType.bytes),
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

  // ── Outlet Item Control ───────────────────────────────────────────────────

  Future<void> patchOutletItemTrackStock({
    required String outletId,
    required String itemId,
    required bool trackStock,
  }) async {
    await _dio.patch(
      '/pos/outlets/$outletId/items/$itemId',
      data: {'track_stock': trackStock},
      options: await _authOptions,
    );
  }

  Future<List<Map<String, dynamic>>> getMenuItems() async {
    final response = await _dio.get(
      '/restaurant/menu/items',
      options: await _authOptions,
    );
    final data = response.data;
    if (data is Map && data['data'] is List) {
      return List<Map<String, dynamic>>.from(data['data'] as List);
    }
    return [];
  }

  // ── Recipe / Food Control ──────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getRecipes() async {
    final response = await _dio.get(
      '/kitchen/recipes',
      options: await _authOptions,
    );
    final data = response.data;
    if (data is Map && data['data'] is List) {
      return List<Map<String, dynamic>>.from(data['data'] as List);
    }
    return [];
  }

  Future<void> createRecipe({
    required String menuItemName,
    required int portionsPerRecipe,
    required List<Map<String, dynamic>> ingredients,
    String? menuItemId,
  }) async {
    await _dio.post(
      '/kitchen/recipes',
      data: {
        'menu_item_name': menuItemName,
        if (menuItemId != null) 'menu_item_id': menuItemId,
        'portions_per_recipe': portionsPerRecipe,
        'ingredients': ingredients,
      },
      options: await _authOptions,
    );
  }

  Future<void> updateRecipe({
    required String id,
    required String menuItemName,
    required int portionsPerRecipe,
    required List<Map<String, dynamic>> ingredients,
  }) async {
    await _dio.put(
      '/kitchen/recipes/$id',
      data: {
        'menu_item_name': menuItemName,
        'portions_per_recipe': portionsPerRecipe,
        'ingredients': ingredients,
      },
      options: await _authOptions,
    );
  }

  // ── Kitchen Production Sessions ─────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getProductionSessions({
    String? status,
    String? dateFrom,
    String? dateTo,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.get(
      '/kitchen/production-sessions',
      queryParameters: {
        'branch_id': branchId,
        if (status != null) 'status': status,
        if (dateFrom != null) 'date_from': dateFrom,
        if (dateTo != null) 'date_to': dateTo,
      },
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> getProductionRecipes() async {
    final branchId = await _branchId;
    final response = await _dio.get(
      '/kitchen/shifts/recipes/list',
      queryParameters: {'branch_id': branchId},
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> createProductionRecipe({
    required String rawItemSku,
    required String rawItemName,
    required double rawQuantity,
    required String rawUnit,
    required String producedItemName,
    String? producedItemSku,
    required double producedQuantity,
    required String producedUnit,
    String? posOutletItemId,
    double allowedVariancePercent = 2,
    double spoilageThresholdPercent = 1,
    double costPerOutput = 0,
    bool requiresYieldConfirmation = true,
    String? poolItemId,
    double? poolFraction,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.post(
      '/kitchen/shifts/recipes',
      data: {
        'branch_id': branchId,
        'recipe_name': '$rawItemName to $producedItemName',
        'raw_item_sku': rawItemSku,
        'raw_item_name': rawItemName,
        'raw_quantity': rawQuantity,
        'raw_unit': rawUnit,
        'produced_item_name': producedItemName,
        if (producedItemSku != null && producedItemSku.isNotEmpty)
          'produced_item_sku': producedItemSku,
        'produced_quantity': producedQuantity,
        'produced_unit': producedUnit,
        if (posOutletItemId != null && posOutletItemId.isNotEmpty)
          'pos_outlet_item_id': posOutletItemId,
        'allowed_variance_percent': allowedVariancePercent,
        'spoilage_threshold_percent': spoilageThresholdPercent,
        'cost_per_output': costPerOutput,
        'requires_yield_confirmation': requiresYieldConfirmation,
        if (poolItemId != null && poolItemId.isNotEmpty) 'pool_item_id': poolItemId,
        if (poolFraction != null) 'pool_fraction': poolFraction,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> updateProductionRecipe({
    required String id,
    required String rawItemSku,
    required String rawItemName,
    required double rawQuantity,
    required String rawUnit,
    required String producedItemName,
    String? producedItemSku,
    required double producedQuantity,
    required String producedUnit,
    String? posOutletItemId,
    double allowedVariancePercent = 2,
    double spoilageThresholdPercent = 1,
    double costPerOutput = 0,
    bool requiresYieldConfirmation = true,
    String? poolItemId,
    double? poolFraction,
  }) async {
    final response = await _dio.put(
      '/kitchen/shifts/recipes/$id',
      data: {
        'recipe_name': '$rawItemName to $producedItemName',
        'raw_item_sku': rawItemSku,
        'raw_item_name': rawItemName,
        'raw_quantity': rawQuantity,
        'raw_unit': rawUnit,
        'produced_item_name': producedItemName,
        'produced_item_sku': producedItemSku,
        'produced_quantity': producedQuantity,
        'produced_unit': producedUnit,
        'pos_outlet_item_id': posOutletItemId,
        'allowed_variance_percent': allowedVariancePercent,
        'spoilage_threshold_percent': spoilageThresholdPercent,
        'cost_per_output': costPerOutput,
        'requires_yield_confirmation': requiresYieldConfirmation,
        if (poolItemId != null && poolItemId.isNotEmpty) 'pool_item_id': poolItemId,
        if (poolFraction != null) 'pool_fraction': poolFraction,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<void> deactivateProductionRecipe(String id) async {
    await _dio.delete(
      '/kitchen/shifts/recipes/$id',
      options: await _authOptions,
    );
  }

  Future<Map<String, dynamic>> createProductionSession({
    required String staffName,
    String? staffId,
    String? notes,
    String shiftType = 'shift_a',
    List<Map<String, dynamic>> sessionStaff = const [],
    required List<Map<String, dynamic>> issues,
    required List<Map<String, dynamic>> plannedItems,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.post(
      '/kitchen/production-sessions',
      data: {
        'branch_id': branchId,
        'staff_name': staffName,
        'shift_type': shiftType,
        if (staffId != null) 'staff_id': staffId,
        if (notes != null) 'notes': notes,
        if (sessionStaff.isNotEmpty) 'session_staff': sessionStaff,
        'issues': issues,
        'planned_items': plannedItems,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> completeProductionSession({
    required String sessionId,
    required List<Map<String, dynamic>> entries,
    List<Map<String, dynamic>> closingStock = const [],
  }) async {
    final response = await _dio.put(
      '/kitchen/production-sessions/$sessionId/complete',
      data: {
        'entries': entries,
        if (closingStock.isNotEmpty) 'closing_stock': closingStock,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> getProductionSessionDetail(String id) async {
    final response = await _dio.get(
      '/kitchen/production-sessions/$id',
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<List<Map<String, dynamic>>> getStaffList() async {
    final branchId = await _branchId;
    final response = await _dio.get(
      '/staff',
      queryParameters: {'branch_id': branchId, 'limit': '200'},
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  // ── Kitchen Shift Management ────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getKitchenShifts({
    String? status,
    String? dateFrom,
    String? dateTo,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.get(
      '/kitchen/shifts',
      queryParameters: {
        'branch_id': branchId,
        if (status != null) 'status': status,
        if (dateFrom != null) 'from_date': dateFrom,
        if (dateTo != null) 'to_date': dateTo,
      },
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> getKitchenShiftDetail(String id) async {
    final response = await _dio.get(
      '/kitchen/shifts/$id',
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> openKitchenShift({
    required String shiftType,
    required String shiftDate,
    required List<Map<String, dynamic>> openingItems,
    List<String> assignedChefIds = const [],
  }) async {
    final branchId = await _branchId;
    final response = await _dio.post(
      '/kitchen/shifts',
      data: {
        'branch_id': branchId,
        'shift_type': shiftType,
        'shift_date': shiftDate,
        'opening_items': openingItems,
        'assigned_chef_ids': assignedChefIds,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> addShiftStock(
    String shiftId,
    List<Map<String, dynamic>> items,
  ) async {
    final response = await _dio.post(
      '/kitchen/shifts/$shiftId/stock',
      data: {'items': items},
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> recordProduction(
    String shiftId,
    List<Map<String, dynamic>> productions,
  ) async {
    final response = await _dio.post(
      '/kitchen/shifts/$shiftId/production',
      data: {'productions': productions},
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> confirmProductionActual(
    String shiftId,
    String productionId,
    double actualQuantity,
  ) async {
    final response = await _dio.post(
      '/kitchen/shifts/$shiftId/production/$productionId/confirm-actual',
      data: {'actual_quantity': actualQuantity},
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> recordSpoilage(
    String shiftId,
    List<Map<String, dynamic>> items, {
    String? notes,
  }) async {
    final response = await _dio.post(
      '/kitchen/shifts/$shiftId/spoilage',
      data: {'items': items, if (notes != null && notes.isNotEmpty) 'notes': notes},
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> closeKitchenShift(
    String shiftId,
    List<Map<String, dynamic>> physicalCounts, {
    String? closingNotes,
  }) async {
    final response = await _dio.post(
      '/kitchen/shifts/$shiftId/close',
      data: {
        'physical_counts': physicalCounts,
        if (closingNotes != null) 'closing_notes': closingNotes,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> submitShiftForApproval(String shiftId) async {
    final response = await _dio.post(
      '/kitchen/shifts/$shiftId/submit',
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> chefConfirmShift(
    String shiftId, {
    required bool confirmed,
    String? notes,
  }) async {
    final response = await _dio.post(
      '/kitchen/shifts/$shiftId/chef-confirm',
      data: {'confirmed': confirmed, if (notes != null) 'notes': notes},
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> accountantReviewShift(
    String shiftId, {
    required bool approved,
    String? notes,
  }) async {
    final response = await _dio.post(
      '/kitchen/shifts/$shiftId/accountant-review',
      data: {'approved': approved, if (notes != null) 'notes': notes},
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> getKitchenShiftStats({
    String? dateFrom,
    String? dateTo,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.get(
      '/kitchen/shifts/stats',
      queryParameters: {
        'branch_id': branchId,
        if (dateFrom != null) 'from_date': dateFrom,
        if (dateTo != null) 'to_date': dateTo,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  // ---------------------------------------------------------------------
  // Opening stock gate — submission side (Branch Storekeeper).
  // ---------------------------------------------------------------------

  Future<Map<String, dynamic>> getOpeningStockStatus(String shiftId) async {
    final response = await _dio.get(
      '/storekeeping/opening-stock/$shiftId',
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  /// itemId values are inventory_items UUIDs (String); branchId/quantities
  /// are numeric.
  Future<Map<String, dynamic>> submitOpeningStock(
    String shiftId, {
    required String stockLocation,
    required List<Map<String, dynamic>> items,
  }) async {
    final response = await _dio.post(
      '/storekeeping/opening-stock/$shiftId',
      data: {
        'stock_location': stockLocation,
        'items': items,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  /// Today's open cashier shifts for this branch, used to resolve which
  /// shiftId the opening-stock gate applies to.
  Future<List<Map<String, dynamic>>> openCashierShifts() async {
    final response = await _dio.get(
      '/cashier/shifts',
      queryParameters: await _branchQuery({'status': 'pending_open,open'}),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  // ---------------------------------------------------------------------
  // Pastry production (Branch Storekeeper).
  // ---------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> pastryProduction({String? date}) async {
    final response = await _dio.get(
      '/storekeeping/pastry-production',
      queryParameters:
          await _branchQuery({if (date != null) 'date': date}),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  /// itemId is the inventory_items UUID (String); branchId/quantityProduced
  /// are numeric.
  Future<Map<String, dynamic>> recordPastryProduction({
    required String itemId,
    required num quantityProduced,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.post(
      '/storekeeping/pastry-production',
      data: {
        if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId),
        'item_id': itemId,
        'quantity_produced': quantityProduced,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  /// shiftId must be a real, open kitchen_shifts.id — the batch is issued
  /// into that shift's stock ledger.
  Future<Map<String, dynamic>> issuePastryToKitchen(
    String id, {
    required String shiftId,
    num? issuedQuantity,
  }) async {
    final response = await _dio.put(
      '/storekeeping/pastry-production/$id/issue',
      data: {
        'shift_id': shiftId,
        if (issuedQuantity != null) 'issued_quantity': issuedQuantity,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  // ---------------------------------------------------------------------
  // Bar stocktake — submission (Branch Storekeeper) + review (Accountant).
  // ---------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> barStocktakeRecords({
    String? barLocation,
    String? status,
    String? date,
  }) async {
    final response = await _dio.get(
      '/storekeeping/bar-stocktake',
      queryParameters: await _branchQuery({
        if (barLocation != null) 'bar_location': barLocation,
        if (status != null) 'status': status,
        if (date != null) 'stocktake_date': date,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> barStocktakeSummary() async {
    final response = await _dio.get(
      '/storekeeping/bar-stocktake/summary',
      queryParameters: await _branchQuery(),
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  /// itemId values are inventory_items UUIDs (String); branchId is numeric.
  Future<Map<String, dynamic>> submitBarStocktake({
    required String barLocation,
    required List<Map<String, dynamic>> items,
    String? stocktakeDate,
    String? shiftId,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.post(
      '/storekeeping/bar-stocktake',
      data: {
        if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId),
        'bar_location': barLocation,
        'items': items,
        if (stocktakeDate != null) 'stocktake_date': stocktakeDate,
        if (shiftId != null && shiftId.isNotEmpty) 'shift_id': shiftId,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> approveBarStocktake(String id,
      {String? notes}) async {
    final response = await _dio.patch(
      '/storekeeping/bar-stocktake/$id/approve',
      data: {if (notes != null && notes.isNotEmpty) 'notes': notes},
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> rejectBarStocktake(String id,
      {required String notes}) async {
    final response = await _dio.patch(
      '/storekeeping/bar-stocktake/$id/reject',
      data: {'notes': notes},
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  // ---------------------------------------------------------------------
  // Kitchen stocktake — paper-logbook replica (Open/Add/Closing/Var per
  // item, per shift A/B). Fixed item catalog, not tied to branch_stock.
  // ---------------------------------------------------------------------

  Future<Map<String, dynamic>> kitchenStocktake({
    required String date,
    required String shift,
  }) async {
    final response = await _dio.get(
      '/storekeeping/kitchen-stocktake',
      queryParameters: await _branchQuery({
        'date': date,
        'shift': shift,
      }),
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> saveKitchenStocktake({
    required String date,
    required String shift,
    required List<Map<String, dynamic>> items,
    String? dispenserName,
    List<String>? chepsOnDuty,
    String? confirmationName,
    bool submit = false,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.post(
      '/storekeeping/kitchen-stocktake',
      data: {
        if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId),
        'stocktake_date': date,
        'shift': shift,
        'items': items,
        if (dispenserName != null) 'dispenser_name': dispenserName,
        if (chepsOnDuty != null) 'cheps_on_duty': chepsOnDuty,
        if (confirmationName != null) 'confirmation_name': confirmationName,
        'submit': submit,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  // ---------------------------------------------------------------------
  // Store stocktake — submission (Branch Storekeeper) + review (Accountant).
  // Covers all non-bar store items (foodstuffs, stationery, non_consumables).
  // ---------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> storeStocktakeRecords({
    String? status,
    String? date,
  }) async {
    final response = await _dio.get(
      '/storekeeping/store-stocktake',
      queryParameters: await _branchQuery({
        if (status != null) 'status': status,
        if (date != null) 'stocktake_date': date,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<Map<String, dynamic>> storeStocktakeSummary() async {
    final response = await _dio.get(
      '/storekeeping/store-stocktake/summary',
      queryParameters: await _branchQuery(),
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  /// itemId values are inventory_items UUIDs (String); branchId is numeric.
  Future<Map<String, dynamic>> submitStoreStocktake({
    required List<Map<String, dynamic>> items,
    String? stocktakeDate,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.post(
      '/storekeeping/store-stocktake',
      data: {
        if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId),
        'items': items,
        if (stocktakeDate != null) 'stocktake_date': stocktakeDate,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> approveStoreStocktake(String id,
      {String? notes}) async {
    final response = await _dio.patch(
      '/storekeeping/store-stocktake/$id/approve',
      data: {if (notes != null && notes.isNotEmpty) 'notes': notes},
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  Future<Map<String, dynamic>> rejectStoreStocktake(String id,
      {required String notes}) async {
    final response = await _dio.patch(
      '/storekeeping/store-stocktake/$id/reject',
      data: {'notes': notes},
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  // ---------------------------------------------------------------------
  // Branch spoilage log — storekeeper records spoiled stock for bar/kitchen/
  // store; sits pending until a branch accountant approves or rejects it.
  // ---------------------------------------------------------------------

  /// area is 'bar' | 'kitchen' | 'store'.
  Future<List<Map<String, dynamic>>> spoilageCandidates(String area) async {
    final response = await _dio.get(
      '/storekeeping/spoilage/candidates',
      queryParameters: await _branchQuery({'area': area}),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<List<Map<String, dynamic>>> spoilageRecords({
    String? area,
    String? status,
  }) async {
    final response = await _dio.get(
      '/storekeeping/spoilage',
      queryParameters: await _branchQuery({
        if (area != null) 'area': area,
        if (status != null) 'status': status,
      }),
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  /// Branch-wide spoilage entry (bar/kitchen/store) — distinct from the older
  /// per-kitchen-shift recordSpoilage(shiftId, items) above. Sits pending
  /// until a branch accountant approves or rejects it.
  Future<Map<String, dynamic>> recordBranchSpoilage({
    required String area,
    required String itemId,
    required num quantity,
    required String reason,
    String? unit,
    String? notes,
    String? barLocation,
    String? shift,
    String? spoilageDate,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.post(
      '/storekeeping/spoilage',
      data: {
        if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId),
        'area': area,
        'item_id': itemId,
        'quantity': quantity,
        'reason': reason,
        if (unit != null) 'unit': unit,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
        if (barLocation != null) 'bar_location': barLocation,
        if (shift != null) 'shift': shift,
        if (spoilageDate != null) 'spoilage_date': spoilageDate,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  // ---------------------------------------------------------------------
  // Wastage alerts / report (Kitchen — surfaced in Storekeeper module).
  // ---------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> kitchenWastageAlerts({
    bool? acknowledged,
    String? shiftId,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.get(
      '/kitchen/wastage/alerts',
      queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        if (acknowledged != null) 'acknowledged': '$acknowledged',
        if (shiftId != null && shiftId.isNotEmpty) 'shift_id': shiftId,
      },
      options: await _authOptions,
    );
    return _unwrapList(response.data);
  }

  Future<void> acknowledgeWastageAlert(String id) async {
    await _dio.patch(
      '/kitchen/wastage/alerts/$id/acknowledge',
      options: await _authOptions,
    );
  }

  Future<Map<String, dynamic>> kitchenWastageReport({
    required String fromDate,
    required String toDate,
  }) async {
    final branchId = await _branchId;
    final response = await _dio.get(
      '/kitchen/wastage/report',
      queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        'from_date': fromDate,
        'to_date': toDate,
      },
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }

  // ---------------------------------------------------------------------
  // Stock balance ledger summary (Storekeeper dashboard card).
  // ---------------------------------------------------------------------

  Future<Map<String, dynamic>> stockBalanceSummary() async {
    final response = await _dio.get(
      '/storekeeping/stock-ledger',
      queryParameters: await _branchQuery(),
      options: await _authOptions,
    );
    return _unwrapMap(response.data);
  }
}
