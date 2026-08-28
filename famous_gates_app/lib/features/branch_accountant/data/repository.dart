import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'dart:io';

import '../../../core/network/dio_client.dart';
import '../../../core/storage/secure_storage_provider.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/domain/auth_notifier.dart';

final branchAccountantRepositoryProvider =
    Provider<BranchAccountantRepository>((ref) {
  return BranchAccountantRepository(
    ref.watch(dioProvider),
    ref,
  );
});

class BranchAccountantRepository {
  BranchAccountantRepository(this._dio, this._ref);

  final Dio _dio;
  final Ref _ref;

  Future<String> getBranchId() async {
    final authBranchId =
        _ref.read(authNotifierProvider).valueOrNull?.branchId.trim() ?? '';
    if (_validBranchId(authBranchId)) return authBranchId;
    final storage = _ref.read(secureStorageProvider);
    final storedBranchId =
        (await storage.read(key: AuthRepository.branchIdKey))?.trim() ?? '';
    return _validBranchId(storedBranchId) ? storedBranchId : '';
  }

  bool _validBranchId(String value) {
    final normalized = value.trim().toLowerCase();
    return normalized.isNotEmpty &&
        normalized != '0' &&
        normalized != 'null' &&
        normalized != 'nan';
  }

  Future<Map<String, dynamic>> getCashierClearances({
    String? date,
    String? status,
  }) async {
    final branchId = await getBranchId();
    if (branchId.isEmpty) return {};
    return _getMap('/cashier/clearances', query: {
      'branch_id': branchId,
      if (date != null && date.isNotEmpty) 'date': date,
      if (status != null && status != 'all') 'status': status,
    });
  }

  /// Bar stocktake records pending accountant review (approve/reject is
  /// accountant-only; submission is storekeeper-only).
  Future<List<Map<String, dynamic>>> getBarStocktakeRecords({
    String? status,
    String? barLocation,
    bool history = false,
  }) async {
    final branchId = await getBranchId();
    return _getList('/storekeeping/bar-stocktake', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null && status.isNotEmpty) 'status': status,
      if (history) 'history': 'true',
      if (barLocation != null && barLocation.isNotEmpty)
        'bar_location': barLocation,
    });
  }

  Future<void> approveBarStocktake(String id, {String? notes}) async {
    await _dio.patch('/storekeeping/bar-stocktake/$id/approve', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> rejectBarStocktake(String id, {required String notes}) async {
    await _dio.patch('/storekeeping/bar-stocktake/$id/reject',
        data: {'notes': notes});
  }

  Future<void> reviewBarStocktake(String id, {String? notes}) async {
    await _dio.patch('/storekeeping/bar-stocktake/$id/review', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  // ── Store stocktake ──────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getStoreStocktakeRecords({
    String? status,
    bool history = false,
  }) async {
    final branchId = await getBranchId();
    return _getList('/storekeeping/store-stocktake', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null && status.isNotEmpty) 'status': status,
      if (history) 'history': 'true',
    });
  }

  Future<void> reviewStoreStocktake(String id, {String? notes}) async {
    await _dio.patch('/storekeeping/store-stocktake/$id/review', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> approveStoreStocktake(String id, {String? notes}) async {
    await _dio.patch('/storekeeping/store-stocktake/$id/approve', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> rejectStoreStocktake(String id, {required String notes}) async {
    await _dio.patch('/storekeeping/store-stocktake/$id/reject',
        data: {'notes': notes});
  }

  Future<void> batchReviewStoreStocktake({
    required String branchId,
    required String stocktakeDate,
    String? notes,
  }) async {
    await _dio.patch('/storekeeping/store-stocktake/batch/review', data: {
      'branch_id': int.tryParse(branchId) ?? branchId,
      'stocktake_date': stocktakeDate,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> batchApproveStoreStocktake({
    required String branchId,
    required String stocktakeDate,
    String? notes,
  }) async {
    await _dio.patch('/storekeeping/store-stocktake/batch/approve', data: {
      'branch_id': int.tryParse(branchId) ?? branchId,
      'stocktake_date': stocktakeDate,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> batchRejectStoreStocktake({
    required String branchId,
    required String stocktakeDate,
    required String notes,
  }) async {
    await _dio.patch('/storekeeping/store-stocktake/batch/reject', data: {
      'branch_id': int.tryParse(branchId) ?? branchId,
      'stocktake_date': stocktakeDate,
      'notes': notes,
    });
  }

  // ── Kitchen stocktake ────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getKitchenStocktakeShifts(
      {String? status}) async {
    final branchId = await getBranchId();
    return _getList('/storekeeping/kitchen-stocktake/list', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null && status.isNotEmpty) 'status': status,
    });
  }

  Future<void> reviewKitchenStocktake(String id, {String? notes}) async {
    await _dio.patch('/storekeeping/kitchen-stocktake/$id/review', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> approveKitchenStocktake(String id, {String? notes}) async {
    await _dio.patch('/storekeeping/kitchen-stocktake/$id/approve', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> rejectKitchenStocktake(String id,
      {required String notes}) async {
    await _dio.patch('/storekeeping/kitchen-stocktake/$id/reject',
        data: {'notes': notes});
  }

  Future<void> updateKitchenStocktakeItems(
      String shiftId, List<Map<String, dynamic>> items) async {
    await _dio.put('/storekeeping/kitchen-stocktake/$shiftId/items', data: {
      'items': items,
    });
  }

  // ── Food Control Standards (Recipes) ──────────────────────────────────────
  Future<List<Map<String, dynamic>>> getKitchenRecipes() async {
    final branchId = await getBranchId();
    return _getList('/kitchen/shifts/recipes/list', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<List<Map<String, dynamic>>> getLinkableMenuItems() async {
    final branchId = await getBranchId();
    final rows = await _getList('/kitchen/shifts/recipes/menu-items', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return rows.map((row) {
      final normalized = Map<String, dynamic>.from(row);
      final sku = '${normalized['sku'] ?? ''}'.trim();
      final fallbackName = [
        normalized['name'],
        normalized['item_name'],
        normalized['product_name'],
        normalized['category'],
      ].map((value) => '$value'.trim()).firstWhere(
            (value) =>
                value.isNotEmpty &&
                value.toLowerCase() != 'unnamed' &&
                value.toLowerCase() != 'null',
            orElse: () => sku.isNotEmpty ? sku : 'POS Item',
          );
      normalized['name'] = fallbackName;
      normalized['item_name'] = fallbackName;
      normalized['sku'] = sku;
      normalized['unit'] = '${normalized['unit'] ?? 'pcs'}'.trim();
      return normalized;
    }).toList();
  }

  Future<void> saveKitchenRecipe(Map<String, dynamic> payload) async {
    final branchId = await getBranchId();
    payload['branch_id'] = branchId;
    await _dio.post('/kitchen/shifts/recipes', data: payload);
  }

  Future<void> updateKitchenRecipe(
    String id,
    Map<String, dynamic> payload,
  ) async {
    final branchId = await getBranchId();
    await _dio.put('/kitchen/shifts/recipes/$id', data: {
      ...payload,
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<void> deactivateKitchenRecipe(String id) async {
    await _dio.delete('/kitchen/shifts/recipes/$id');
  }

  Future<List<Map<String, dynamic>>> getDirectFoodControlItems() async {
    final branchId = await getBranchId();
    return _getList('/kitchen/shifts/direct-items', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> createDirectFoodControlItem(
      Map<String, dynamic> payload) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/kitchen/shifts/direct-items', data: {
      ...payload,
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
    });
    return _asMap(res.data);
  }

  Future<void> deactivateDirectFoodControlItem(String id) async {
    await _dio.delete('/kitchen/shifts/direct-items/$id');
  }

  Future<List<Map<String, dynamic>>> getChannelFoodStandards({
    String? channel,
    String? packageName,
  }) async {
    final branchId = await getBranchId();
    return _getList('/accounting/food-control/channel-standards', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (channel != null && channel.isNotEmpty) 'channel': channel,
      if (packageName != null && packageName.isNotEmpty)
        'package_name': packageName,
    });
  }

  Future<Map<String, dynamic>> createChannelFoodStandard(
      Map<String, dynamic> payload) async {
    final branchId = await getBranchId();
    final res =
        await _dio.post('/accounting/food-control/channel-standards', data: {
      ...payload,
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _asMap(res.data);
  }

  Future<List<Map<String, dynamic>>> getChannelPackageMenuItems({
    String? channel,
    String? packageName,
  }) async {
    final branchId = await getBranchId();
    return _getList('/accounting/food-control/channel-package-menu-items',
        query: {
          if (branchId.isNotEmpty) 'branch_id': branchId,
          if (channel != null && channel.isNotEmpty) 'channel': channel,
          if (packageName != null && packageName.isNotEmpty)
            'package_name': packageName,
        });
  }

  Future<List<Map<String, dynamic>>> getChannelPackages({
    String? channel,
    bool completeOnly = false,
  }) async {
    final branchId = await getBranchId();
    return _getList('/accounting/food-control/channel-packages', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (channel != null && channel.isNotEmpty) 'channel': channel,
      if (completeOnly) 'complete_only': 'true',
    });
  }

  Future<Map<String, dynamic>> createChannelPackageMenuItem(
      Map<String, dynamic> payload) async {
    final branchId = await getBranchId();
    final res = await _dio.post(
      '/accounting/food-control/channel-package-menu-items',
      data: {
        ...payload,
        if (branchId.isNotEmpty) 'branch_id': branchId,
      },
    );
    return _asMap(res.data);
  }

  Future<void> deleteChannelPackageMenuItem(String id) async {
    final branchId = await getBranchId();
    await _dio.delete('/accounting/food-control/channel-package-menu-items/$id',
        queryParameters: {
          if (branchId.isNotEmpty) 'branch_id': branchId,
        });
  }

  Future<Map<String, dynamic>> updateChannelFoodStandard(
    String id,
    Map<String, dynamic> payload,
  ) async {
    final branchId = await getBranchId();
    final res =
        await _dio.put('/accounting/food-control/channel-standards/$id', data: {
      ...payload,
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return _asMap(res.data);
  }

  Future<void> deleteChannelFoodStandard(String id) async {
    final branchId = await getBranchId();
    await _dio.delete('/accounting/food-control/channel-standards/$id',
        queryParameters: {
          if (branchId.isNotEmpty) 'branch_id': branchId,
        });
  }

  Future<List<Map<String, dynamic>>> getRawStockCandidates() async {
    final branchId = await getBranchId();
    final rows = await _getList('/storekeeping/spoilage/candidates', query: {
      'area': 'store',
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
    return rows.map((row) {
      final normalized = Map<String, dynamic>.from(row);
      final sku = '${normalized['sku'] ?? normalized['item_sku'] ?? ''}'.trim();
      final fallbackName = [
        normalized['item_name'],
        normalized['name'],
        normalized['description'],
        normalized['product_name'],
      ].map((value) => '$value'.trim()).firstWhere(
            (value) =>
                value.isNotEmpty &&
                value.toLowerCase() != 'unnamed' &&
                value.toLowerCase() != 'null',
            orElse: () => sku.isNotEmpty ? sku : 'Unknown Item',
          );

      normalized['item_name'] = fallbackName;
      normalized['name'] = fallbackName;
      normalized['sku'] = sku;
      normalized['unit'] =
          '${normalized['unit'] ?? normalized['unit_of_measure'] ?? 'unit'}'
              .trim();
      return normalized;
    }).toList();
  }

  // ----------------------------------------------------------------------
  // Branch spoilage log (bar/kitchen/store) — approve/reject is
  // accountant-only; submission is storekeeper-only.
  // ----------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> getSpoilageRecords({
    String? status,
    String? area,
  }) async {
    final branchId = await getBranchId();
    return _getList('/storekeeping/spoilage', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null && status.isNotEmpty) 'status': status,
      if (area != null && area.isNotEmpty) 'area': area,
    });
  }

  Future<void> approveSpoilage(String id) async {
    await _dio.patch('/storekeeping/spoilage/$id/approve');
  }

  Future<void> rejectSpoilage(String id, {required String notes}) async {
    await _dio
        .patch('/storekeeping/spoilage/$id/reject', data: {'notes': notes});
  }

  // ----------------------------------------------------------------------
  // Branch stock request review (Branch Accountant → Central Store)
  // ----------------------------------------------------------------------

  Future<List<Map<String, dynamic>>> getStockRequests({String? status}) async {
    return _getList('/storekeeping/stock-requests', query: {
      if (status != null && status.isNotEmpty) 'status': status,
    });
  }

  Future<Map<String, dynamic>> getStockRequest(String id) async {
    return _getMap('/storekeeping/stock-requests/$id');
  }

  Future<void> approveStockRequest(
    String id, {
    List<Map<String, dynamic>>? itemApprovals,
    String? notes,
  }) async {
    await _dio.put('/storekeeping/stock-requests/$id/approve', data: {
      if (itemApprovals != null && itemApprovals.isNotEmpty)
        'item_approvals': itemApprovals,
      if (notes != null && notes.trim().isNotEmpty)
        'approved_quantity_notes': notes.trim(),
    });
  }

  Future<void> rejectStockRequest(String id, {required String notes}) async {
    await _dio.put('/storekeeping/stock-requests/$id/reject',
        data: {'review_notes': notes});
  }

  Future<void> approveClearance(String id, {String? notes}) async {
    await _dio.post('/cashier/clearances/$id/approve', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  /// shiftId is the cashier_shifts id. Returns actual_collections,
  /// reconciliation_expenses, and a system/actual/variance summary.
  Future<Map<String, dynamic>> getShiftReconciliation(String shiftId) async {
    return _getMap('/cashier/clearances/$shiftId/reconciliation');
  }

  Future<void> addShiftActualCollection(
    String shiftId, {
    required String paymentMethod,
    required num systemAmount,
    required num actualAmount,
  }) async {
    await _dio.post('/cashier/clearances/$shiftId/actual-collections', data: {
      'payment_method': paymentMethod,
      'system_amount': systemAmount,
      'actual_amount': actualAmount,
    });
  }

  Future<void> addShiftReconciliationExpense(
    String shiftId, {
    required String category,
    required num amount,
    String? description,
  }) async {
    await _dio
        .post('/cashier/clearances/$shiftId/reconciliation-expenses', data: {
      'category': category,
      'amount': amount,
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
    });
  }

  Future<void> flagClearance(
    String id, {
    required String reason,
    String? notes,
  }) async {
    await _dio.post('/cashier/clearances/$id/flag', data: {
      'reason': reason,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<Map<String, dynamic>> getBranchSalesAnalytics({
    required String startDate,
    required String endDate,
    Map<String, dynamic> filters = const {},
  }) async {
    final branchId = await getBranchId();
    if (branchId.isEmpty) return {};
    final res = await _dio.post('/analytics/branch-sales', data: {
      'branch_id': int.tryParse(branchId) ?? branchId,
      'start_date': startDate,
      'end_date': endDate,
      'filters': filters,
    });
    return _asMap(res.data);
  }

  Future<File> exportBranchSales({
    required String startDate,
    required String endDate,
    required String format,
    Map<String, dynamic> filters = const {},
  }) async {
    final branchId = await getBranchId();
    final res = await _dio.post<List<int>>(
      '/analytics/branch-sales/export/$format',
      data: {
        if (branchId.isNotEmpty)
          'branch_id': int.tryParse(branchId) ?? branchId,
        'start_date': startDate,
        'end_date': endDate,
        'filters': filters,
      },
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(
      res.data ?? const [],
      format.toLowerCase() == 'pdf'
          ? 'FG_Branch_Sales_${startDate}_to_$endDate.pdf'
          : 'branch-sales-$startDate-$endDate.$format',
    );
  }

  Future<Map<String, dynamic>> getBranchFinancials({
    required String startDate,
    required String endDate,
  }) async {
    final branchId = await getBranchId();
    if (branchId.isEmpty) return {};
    return _getMap('/finance/branch-financials/$branchId', query: {
      'startDate': startDate,
      'endDate': endDate,
    });
  }

  Future<List<Map<String, dynamic>>> getDailyRecords({
    required String startDate,
    required String endDate,
  }) async {
    final branchId = await getBranchId();
    if (branchId.isEmpty) return [];
    try {
      return await _getList('/finance/workspace/daily', query: {
        'branch_id': branchId,
        'start_date': startDate,
        'end_date': endDate,
      });
    } on DioException catch (e) {
      if (_isRecoverableBranchEndpointError(e)) return [];
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getDailyRecordByDate(String date) async {
    final branchId = await getBranchId();
    return _getMap('/finance/workspace/daily/$date', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  /// Lina AI: collect every available system figure for [date] and shape it
  /// into the daily financial entry form (revenue/payments/banking/cogs/expenses).
  Future<Map<String, dynamic>> getDailyAutofill(String date) async {
    final branchId = await getBranchId();
    return _getMap('/finance/workspace/daily/autofill', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'date': date,
    });
  }

  Future<void> saveDailyRecord(Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    await _dio.post('/finance/workspace/daily', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
  }

  Future<List<Map<String, dynamic>>> getMonthlyAdjustments({
    required int year,
    required int month,
  }) async {
    final branchId = await getBranchId();
    return _getList('/finance/workspace/monthly', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'fiscal_year': year,
      'fiscal_month': month,
    });
  }

  Future<void> saveMonthlyAdjustment(Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    await _dio.post('/finance/workspace/monthly', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
  }

  Future<File> exportMonthlyStatement({
    required int year,
    required int month,
  }) async {
    final branchId = await getBranchId();
    final res = await _dio.get<List<int>>(
      '/finance/workspace/export',
      queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        'fiscal_year': year,
        'fiscal_month': month,
      },
      options: Options(responseType: ResponseType.bytes),
    );
    final monthText = month.toString().padLeft(2, '0');
    return _saveBytes(
      res.data ?? const [],
      'Financial_Statement_${year}_$monthText.pdf',
    );
  }

  // ── Financial Close ──────────────────────────────────────────────────────

  Future<Map<String, dynamic>> submitWorkspaceClose(
      Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/finance/workspace/close', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
    return (res.data as Map<String, dynamic>? ?? {});
  }

  Future<Map<String, dynamic>> submitVarianceExplanation(
      String submissionId, Map<String, dynamic> data) async {
    final res = await _dio.post(
        '/finance/workspace/submissions/$submissionId/explain',
        data: data);
    return (res.data as Map<String, dynamic>? ?? {});
  }

  Future<List<Map<String, dynamic>>> getWorkspaceSubmissions(
      {String? status, String? from, String? to}) async {
    final branchId = await getBranchId();
    return _getList('/finance/workspace/submissions', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null) 'status': status,
      if (from != null) 'from': from,
      if (to != null) 'to': to,
    });
  }

  Future<Map<String, dynamic>> getDailySystemSnapshot(String date) async {
    final branchId = await getBranchId();
    return _getMap('/finance/snapshot/$branchId/$date');
  }

  Future<Map<String, dynamic>> getBranchProfitability(
      {String? from, String? to}) async {
    final branchId = await getBranchId();
    return _getMap('/finance/branch-profitability', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (from != null) 'from': from,
      if (to != null) 'to': to,
    });
  }

  // ── Branch Payroll ────────────────────────────────────────────────────────

  Future<List<Map<String, dynamic>>> getPayrollBatches({String? status}) async {
    final branchId = await getBranchId();
    return _getList('/finance/payroll/batches', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null) 'status': status,
    });
  }

  Future<Map<String, dynamic>> getPayrollBatch(String id) async {
    return _getMap('/finance/payroll/batches/$id');
  }

  Future<Map<String, dynamic>> generatePayrollBatch(
      {required int month, required int year}) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/finance/payroll/batches/generate', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      'period_month': month,
      'period_year': year,
    });
    return (res.data as Map<String, dynamic>? ?? {});
  }

  Future<void> submitPayrollBatch(String id) async {
    await _dio.post('/finance/payroll/batches/$id/submit');
  }

  /// Downloads a ZIP of individual payslip PDFs for every staff line in the
  /// batch (generated natively in Node so figures match the batch exactly).
  Future<File> downloadBatchPayslipsZip(String id, String periodLabel) async {
    final res = await _dio.get(
      '/finance/payroll/batches/$id/payslips-zip',
      options: Options(responseType: ResponseType.bytes),
    );
    final safe = periodLabel.replaceAll(RegExp(r'[^A-Za-z0-9]'), '_');
    return _saveBytes(res.data ?? const <int>[], 'FG_Payslips_$safe.zip');
  }

  Future<File> downloadPayrollBatchPdf(String id, String periodLabel) async {
    final res = await _dio.get(
      '/finance/payroll/batches/$id/pdf',
      options: Options(responseType: ResponseType.bytes),
    );
    final safe = periodLabel.replaceAll(RegExp(r'[^A-Za-z0-9]'), '_');
    return _saveBytes(res.data ?? const <int>[], 'FG_Payroll_$safe.pdf');
  }

  /// Generic branded PDF for the Staff Accounts exports (credit bills, advances,
  /// loans, overview). Renders via the python payroll template
  /// Generic branded PDF for the Staff Accounts exports (credit bills, advances,
  /// loans, overview). Renders via python, backend proxy, or local fallback.
  Future<File> generateStatementPdf(Map<String, dynamic> payload) async {
    try {
      final dio = _ref.read(pythonDioProvider);
      final res = await dio.post(
        '/api/payroll/generate-statement-pdf',
        data: payload,
        options: Options(responseType: ResponseType.bytes),
      );
      List<int>? bytes;
      if (res.data is List<int>) {
        bytes = res.data as List<int>;
      } else if (res.data is List) {
        bytes = (res.data as List).cast<int>();
      }
      if (bytes != null && bytes.length > 100) {
        final title = '${payload['title'] ?? 'statement'}'
            .replaceAll(RegExp(r'[^A-Za-z0-9]'), '_');
        return _saveBytes(bytes, 'FG_$title.pdf');
      }
    } catch (_) {
      try {
        final res = await _dio.post(
          '/payroll/generate-statement-pdf',
          data: payload,
          options: Options(responseType: ResponseType.bytes),
        );
        List<int>? bytes;
        if (res.data is List<int>) {
          bytes = res.data as List<int>;
        } else if (res.data is List) {
          bytes = (res.data as List).cast<int>();
        }
        if (bytes != null && bytes.length > 100) {
          final title = '${payload['title'] ?? 'statement'}'
              .replaceAll(RegExp(r'[^A-Za-z0-9]'), '_');
          return _saveBytes(bytes, 'FG_$title.pdf');
        }
      } catch (_) {}
    }

    return _buildLocalStatementPdf(payload);
  }

  String _cleanTxt(String? input) {
    if (input == null || input.isEmpty) return '';
    return input
        .replaceAll('—', '-')
        .replaceAll('–', '-')
        .replaceAll('’', "'")
        .replaceAll('‘', "'")
        .replaceAll('“', '"')
        .replaceAll('”', '"')
        .replaceAll('•', '*')
        .replaceAll(RegExp(r'[^\x00-\x7F]'), '');
  }

  Future<File> _buildLocalStatementPdf(Map<String, dynamic> payload) async {
    final pdf = pw.Document();
    pw.Font fontRegular;
    pw.Font fontBold;
    try {
      final regData = await rootBundle
          .load('assets/fonts/sf_pro_display/SFPRODISPLAYREGULAR.OTF');
      final boldData = await rootBundle
          .load('assets/fonts/sf_pro_display/SFPRODISPLAYBOLD.OTF');
      fontRegular = pw.Font.ttf(regData);
      fontBold = pw.Font.ttf(boldData);
    } catch (_) {
      fontRegular = await PdfGoogleFonts.robotoRegular();
      fontBold = await PdfGoogleFonts.robotoBold();
    }

    final title = _cleanTxt(payload['title']?.toString() ?? 'STATEMENT');
    final branch = _cleanTxt(payload['branch']?.toString() ?? 'All Branches');
    final period = _cleanTxt(payload['period']?.toString() ?? '');
    final cols = (payload['columns'] as List?)
            ?.map((e) => _cleanTxt(e.toString()))
            .toList() ??
        [];
    final rawRows = (payload['rows'] as List?) ?? [];

    pdf.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        maxPages: 1000,
        margin: const pw.EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        theme: pw.ThemeData.withFont(base: fontRegular, bold: fontBold),
        build: (pw.Context ctx) {
          final tableData = <List<String>>[];
          if (cols.isNotEmpty) tableData.add(cols);
          for (final row in rawRows) {
            if (row is List) {
              tableData.add(row
                  .map((cell) => _cleanTxt(cell?.toString() ?? ''))
                  .toList());
            }
          }

          final headers = tableData.isNotEmpty ? tableData.first : <String>[];
          final dataRows =
              tableData.length > 1 ? tableData.sublist(1) : <List<String>>[];

          return [
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text('FamousGate Hotels',
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold, fontSize: 16)),
                    pw.Text('Branch: $branch',
                        style: const pw.TextStyle(
                            fontSize: 9, color: PdfColors.grey700)),
                  ],
                ),
                pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.end,
                  children: [
                    pw.Text(title,
                        style: pw.TextStyle(
                            fontWeight: pw.FontWeight.bold,
                            fontSize: 13,
                            color: PdfColors.blue800)),
                    if (period.isNotEmpty)
                      pw.Text('Period: $period',
                          style: const pw.TextStyle(
                              fontSize: 9, color: PdfColors.grey700)),
                  ],
                ),
              ],
            ),
            pw.SizedBox(height: 6),
            pw.Divider(thickness: 1, color: PdfColors.grey400),
            pw.SizedBox(height: 10),
            if (headers.isNotEmpty)
              pw.Table(
                border:
                    pw.TableBorder.all(color: PdfColors.grey300, width: 0.5),
                children: [
                  pw.TableRow(
                    decoration:
                        const pw.BoxDecoration(color: PdfColors.blue900),
                    children: headers
                        .map((h) => pw.Padding(
                              padding: const pw.EdgeInsets.symmetric(
                                  horizontal: 4, vertical: 4),
                              child: pw.Text(
                                h,
                                style: pw.TextStyle(
                                    fontWeight: pw.FontWeight.bold,
                                    fontSize: 7.5,
                                    color: PdfColors.white),
                                textAlign: pw.TextAlign.center,
                              ),
                            ))
                        .toList(),
                  ),
                  ...dataRows.asMap().entries.map((entry) {
                    final rowIndex = entry.key;
                    final row = entry.value;

                    bool isRedRow = false;
                    if (row.isNotEmpty) {
                      final lastCell = row.last.trim();
                      if (lastCell == '-' ||
                          lastCell == '0' ||
                          lastCell == '0.00' ||
                          lastCell.startsWith('-')) {
                        isRedRow = true;
                      } else if (row.length >= 4 &&
                          (row[3].trim() == '-' ||
                              row[3].trim() == 'Not set')) {
                        isRedRow = true;
                      }
                    }

                    final bgColor = isRedRow
                        ? PdfColors.red50
                        : (rowIndex % 2 == 1
                            ? PdfColors.grey100
                            : PdfColors.white);
                    final textColor =
                        isRedRow ? PdfColors.red900 : PdfColors.black;
                    final fontW =
                        isRedRow ? pw.FontWeight.bold : pw.FontWeight.normal;

                    return pw.TableRow(
                      decoration: pw.BoxDecoration(color: bgColor),
                      children: row.asMap().entries.map((cellEntry) {
                        final colIdx = cellEntry.key;
                        final cellTxt = cellEntry.value;
                        final align = colIdx == 0 || colIdx == 2
                            ? pw.TextAlign.left
                            : (colIdx == 1
                                ? pw.TextAlign.center
                                : pw.TextAlign.right);

                        return pw.Padding(
                          padding: const pw.EdgeInsets.symmetric(
                              horizontal: 4, vertical: 3),
                          child: pw.Text(
                            cellTxt,
                            style: pw.TextStyle(
                                fontSize: 7.5,
                                color: textColor,
                                fontWeight: fontW),
                            textAlign: align,
                          ),
                        );
                      }).toList(),
                    );
                  }),
                ],
              ),
            pw.SizedBox(height: 20),
            pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Text('Prepared By: Branch Accountant ________________',
                    style: const pw.TextStyle(fontSize: 8.5)),
                pw.Text('Approved By: Internal Auditor ________________',
                    style: const pw.TextStyle(fontSize: 8.5)),
              ],
            ),
          ];
        },
      ),
    );

    final bytes = await pdf.save();
    final fileTitle = title.replaceAll(RegExp(r'[^A-Za-z0-9]'), '_');
    return _saveBytes(bytes, 'FG_$fileTitle.pdf');
  }

  Future<Map<String, dynamic>> createPayrollAdjustment({
    required String staffId,
    required String type,
    required String category,
    required double amount,
    required String description,
    required int month,
    required int year,
  }) async {
    final res = await _dio.post('/payroll-adjustments', data: {
      'staff_id': staffId,
      'type': type,
      'category': category,
      'amount': amount,
      'description': description,
      'month': month.toString(),
      'year': year,
      'status': 'pending',
    });
    return (res.data as Map<String, dynamic>? ?? {});
  }

  Future<List<Map<String, dynamic>>> getPayrollAdjustmentsForStaff({
    required String staffId,
    String? month,
    String? year,
  }) async {
    final res = await _dio.get('/payroll-adjustments', queryParameters: {
      'staff_id': staffId,
      if (month != null) 'month': month,
      if (year != null) 'year': year,
    });
    final body = res.data;
    List<dynamic>? list;
    if (body is List) {
      list = body;
    } else if (body is Map) {
      final inner = body['data'] ?? body['items'];
      if (inner is List) list = inner;
    }
    return (list ?? [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<List<Map<String, dynamic>>> getPayrollAdjustments({
    String? staffId,
    int? month,
    int? year,
    String? status,
  }) async {
    final res = await _dio.get('/payroll-adjustments', queryParameters: {
      if (staffId != null) 'staff_id': staffId,
      if (month != null) 'month': month.toString(),
      if (year != null) 'year': year.toString(),
      if (status != null) 'status': status,
    });
    final body = res.data;
    List<dynamic>? list;
    if (body is List) {
      list = body;
    } else if (body is Map) {
      final inner = body['data'] ?? body['items'] ?? body['records'];
      if (inner is List) list = inner;
    }
    return (list ?? [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<void> voidPayrollAdjustment(String id) async {
    await _dio.patch('/payroll-adjustments/$id/void');
  }

  /// Step 2 of financial close: Accountant clicks "Post".
  /// Sends workspace to BOTH Auditor AND Director simultaneously.
  Future<Map<String, dynamic>> postWorkspace(
    String submissionId, {
    String? explanationReason,
    String? explanationNotes,
  }) async {
    final res = await _dio.post(
      '/finance/workspace/submissions/$submissionId/post',
      data: {
        if (explanationReason != null && explanationReason.isNotEmpty)
          'explanation_reason': explanationReason,
        if (explanationNotes != null && explanationNotes.isNotEmpty)
          'explanation_notes': explanationNotes,
      },
    );
    final data = res.data;
    return data is Map<String, dynamic>
        ? data
        : (data is Map ? Map<String, dynamic>.from(data) : {});
  }

  Future<List<Map<String, dynamic>>> getDirectorTasks() {
    return _getList('/finance/director/tasks', query: {
      'status': 'PENDING',
      'assigned_to_role': 'branch_accountant',
    });
  }

  Future<void> respondDirectorTask(String id, String notes) async {
    await _dio.patch('/finance/director/tasks/$id/respond', data: {
      'response_notes': notes,
    });
  }

  Future<List<Map<String, dynamic>>> getDiscrepancies() async {
    final branchId = await getBranchId();
    if (branchId.isEmpty) return [];
    try {
      return await _getList('/finance/discrepancies', query: {
        'branch_id': branchId,
      });
    } on DioException catch (e) {
      if (_isRecoverableBranchEndpointError(e)) return [];
      rethrow;
    }
  }

  Future<void> respondDiscrepancy(String id, String response) async {
    await _dio.patch('/finance/discrepancies/$id/respond', data: {
      'accountant_response': response,
    });
  }

  // ── Outbound branch payments (vendors / essentials / payouts) ──────────────
  Future<Map<String, dynamic>> getOutboundPayments(
      {String status = 'all'}) async {
    final branchId = await getBranchId();
    final res = await _dio.get('/branch-payments', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
    });
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> getBranchPayment(String id) async {
    return _getMap('/branch-payments/$id');
  }

  Future<void> createBranchPayment(Map<String, dynamic> body) async {
    final branchId = await getBranchId();
    await _dio.post('/branch-payments', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...body,
    });
  }

  Future<void> approveBranchPayment(String id,
      {bool asDirector = false}) async {
    await _dio.put('/branch-payments/$id/approve',
        data: {'role': asDirector ? 'director' : 'manager'});
  }

  Future<void> rejectBranchPayment(String id, String reason) async {
    await _dio.put('/branch-payments/$id/reject', data: {'reason': reason});
  }

  Future<void> releaseBranchPayment(String id) async {
    await _dio.put('/branch-payments/$id/release');
  }

  Future<File> downloadBranchPaymentReceipt(
    String id, {
    String? paymentNumber,
  }) async {
    final res = await _dio.get<List<int>>(
      '/branch-payments/$id/receipt.pdf',
      options: Options(
        responseType: ResponseType.bytes,
        extra: {'disable_retry': true},
      ),
    );
    final label =
        (paymentNumber ?? '').trim().isNotEmpty ? paymentNumber!.trim() : id;
    return _saveBytes(
      res.data ?? const <int>[],
      'FG_Supplier_Receipt_$label.pdf',
    );
  }

  Future<Map<String, dynamic>> getProfitLoss({
    required String fromDate,
    required String toDate,
  }) async {
    final branchId = await getBranchId();
    return _getMap('/finance/profit-loss', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'from_date': fromDate,
      'to_date': toDate,
    });
  }

  Future<List<Map<String, dynamic>>> getKitchenYieldTypes() async {
    return _getList('/kitchen/yield-types');
  }

  /// Branch-wide P&L (system vs verified revenue, expense categories, COGS,
  /// bar stock variance) sourced from the get_branch_profit_loss() RPC.
  Future<Map<String, dynamic>> getBranchProfitLoss({
    required String startDate,
    required String endDate,
  }) async {
    final branchId = await getBranchId();
    return _getMap('/finance/branch-profit-loss', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'start_date': startDate,
      'end_date': endDate,
    });
  }

  /// Per-POS-outlet P&L sourced from cashier transactions + sold items.
  Future<Map<String, dynamic>> getPosProfitLoss({
    required String fromDate,
    required String toDate,
  }) async {
    final branchId = await getBranchId();
    return _getMap('/finance/pos-profit-loss', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'from_date': fromDate,
      'to_date': toDate,
    });
  }

  /// Download the FamousGate-branded P&L PDF generated server-side.
  Future<File> exportPosProfitLossPdf({
    required String fromDate,
    required String toDate,
  }) async {
    final branchId = await getBranchId();
    final res = await _dio.get<List<int>>(
      '/finance/pos-profit-loss/export/pdf',
      queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        'from_date': fromDate,
        'to_date': toDate,
      },
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(
      res.data ?? const [],
      'FG_Profit_Loss_${fromDate}_$toDate.pdf',
    );
  }

  /// Generate and download the waiter sales audit pack PDF.
  Future<File> exportWaiterSalesAuditPdf({
    required String fromDate,
    required String toDate,
    String? role,
  }) async {
    final branchId = await getBranchId();
    final res = await _dio.post<List<int>>(
      '/reports/export',
      data: {
        'reportType': 'waiter_sales_audit',
        'format': 'pdf',
        'filters': {
          if (branchId.isNotEmpty) 'branch_id': branchId,
          'start_date': fromDate,
          'end_date': toDate,
          if (role != null && role != 'all') 'role': role,
        },
      },
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(
      res.data ?? const [],
      'FG_Waiter_Sales_Audit_${fromDate}_$toDate.pdf',
    );
  }

  Future<Map<String, dynamic>> getSoldItems({
    required String startDate,
    required String endDate,
  }) async {
    final branchId = await getBranchId();
    return _getMap('/auditor/verify/sold-items', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'start_date': startDate,
      'end_date': endDate,
    });
  }

  Future<File> downloadSoldItemsReport({
    required String startDate,
    required String endDate,
  }) async {
    final branchId = await getBranchId();
    final res = await _dio.get<List<int>>(
      '/auditor/verify/sold-items/export/pdf',
      queryParameters: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        'start_date': startDate,
        'end_date': endDate,
      },
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(
      res.data ?? const [],
      'FG_Sold_Items_${startDate}_to_$endDate.pdf',
    );
  }

  Future<Map<String, dynamic>> getStaffAudit({
    required String startDate,
    required String endDate,
    String? staffId,
  }) async {
    final branchId = await getBranchId();
    final audit = await _getMap('/auditor/staff-audit', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'start_date': startDate,
      'end_date': endDate,
      if (staffId != null && staffId != 'all') 'staff_id': staffId,
    });
    try {
      final staff = await getBranchStaff();
      return _enrichStaffAuditWithProfiles(audit, staff);
    } catch (_) {
      return audit;
    }
  }

  Future<List<Map<String, dynamic>>> getShiftLogs(
      {String status = 'closed'}) async {
    final branchId = await getBranchId();
    return _getList('/cashier/shifts', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
      'page': 1,
      'limit': 100,
    });
  }

  Future<Map<String, dynamic>> getShiftLog(String id) {
    return _getMap('/cashier/shifts/$id');
  }

  Future<void> reconcileShift(
    String id,
    String notes, {
    String? varianceReasonCode,
    String? varianceComment,
  }) async {
    await _dio.put('/cashier/shifts/$id/reconcile', data: {
      'reconciliation_notes': notes,
      if (varianceReasonCode != null && varianceReasonCode.trim().isNotEmpty)
        'variance_reason_code': varianceReasonCode.trim(),
      if (varianceComment != null && varianceComment.trim().isNotEmpty)
        'variance_comment': varianceComment.trim(),
    });
  }

  Future<void> approveShiftOpening(String id, {String? notes}) async {
    await _dio.put('/cashier/shifts/$id/approve-open', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<void> rejectShiftOpening(String id, {String? notes}) async {
    await _dio.put('/cashier/shifts/$id/reject-open', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  /// status defaults to the reviewer's pending queue server-side.
  /// Pass status: 'all' for full logbook history, optionally filtered by
  /// [cashierId] (name match) and [dateFrom]/[dateTo].
  Future<List<Map<String, dynamic>>> getPendingCashierLogbooks({
    String? status,
    String? cashierId,
    String? dateFrom,
    String? dateTo,
  }) async {
    final branchId = await getBranchId();
    return _getList('/cashier/logbook/pending', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null && status.isNotEmpty) 'status': status,
      if (cashierId != null && cashierId.isNotEmpty) 'cashier_id': cashierId,
      if (dateFrom != null && dateFrom.isNotEmpty) 'date_from': dateFrom,
      if (dateTo != null && dateTo.isNotEmpty) 'date_to': dateTo,
    });
  }

  Future<Map<String, dynamic>> getCashierLogbookDetail(String id) {
    return _getMap('/cashier/logbook/$id');
  }

  Future<File> downloadCashierLogbookReport(String id) async {
    final res = await _dio.get<List<int>>(
      '/cashier/logbook/$id/pdf',
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(res.data ?? const [], 'Cashier_Logbook_$id.pdf');
  }

  Future<void> auditCashierLogbook(
    String id, {
    required bool approve,
    String notes = '',
  }) async {
    await _dio.post('/cashier/logbook/$id/audit', data: {
      'action': approve ? 'approve' : 'reject',
      if (notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> getPendingPosVoidRequests() async {
    final branchId = await getBranchId();
    return _getList('/pos/void-requests/pending', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<void> reviewPosVoidRequest(
    String id, {
    required bool approve,
    String reason = '',
  }) async {
    await _dio.post('/pos/void-requests/$id/review', data: {
      'approved': approve,
      if (reason.trim().isNotEmpty) 'rejection_reason': reason.trim(),
      'action': approve ? 'approve' : 'reject',
    });
  }

  // ── Cashier Void Management: Branch Accountant audit (read-only) ─────────

  Future<List<Map<String, dynamic>>> listVoidAudits({String? status}) async {
    final branchId = await getBranchId();
    return _getList('/pos/void-audits', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != null && status.isNotEmpty) 'status': status,
    });
  }

  Future<Map<String, dynamic>> getVoidAuditDetail(String id) async {
    return _getMap('/pos/void-audits/$id');
  }

  Future<void> markVoidAuditReviewed(String id) async {
    await _dio.patch('/pos/void-audits/$id/review');
  }

  Future<void> flagVoidAuditForManager(String id) async {
    await _dio.patch('/pos/void-audits/$id/flag');
  }

  Future<void> addVoidAuditNote(String id, String note) async {
    await _dio.patch('/pos/void-audits/$id/note', data: {'note': note});
  }

  Future<Map<String, dynamic>> getBankingSummary() async {
    final branchId = await getBranchId();
    return _getMap('/banking/summary', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<List<Map<String, dynamic>>> getBankingTransactions({
    String status = 'all',
  }) async {
    final branchId = await getBranchId();
    try {
      return await _getList('/banking/transactions', query: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
        if (status != 'all') 'status': status,
      });
    } on DioException catch (e) {
      if (_isRecoverableBranchEndpointError(e)) return [];
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> getBankAccounts() async {
    final branchId = await getBranchId();
    return _getList('/banking/accounts', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<List<Map<String, dynamic>>> getBankReconciliations() async {
    final branchId = await getBranchId();
    return _getList('/banking/reconciliations', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<void> recordBankingTransaction(Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    await _dio.post('/banking/transactions', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
  }

  Future<void> approveBankingTransaction(
    String id, {
    required bool approve,
    String notes = '',
  }) async {
    await _dio.put('/banking/transactions/$id/approve', data: {
      'action': approve ? 'approve' : 'reject',
      if (notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> getCreditBills({
    String status = 'all',
  }) async {
    final branchId = await getBranchId();
    return _getList('/cashier/credit-bills', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
    });
  }

  Future<void> confirmCreditBill(String id, String notes) async {
    await _dio.patch('/cashier/credit-bills/$id/confirm', data: {
      'role': 'accountant',
      if (notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> getStaffPosAccountingSummary({
    String? from,
    String? to,
    String? role,
  }) async {
    final branchId = await getBranchId();
    return _getList('/finance/staff-pos-accounting/summary', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (from != null && from.isNotEmpty) 'from': from,
      if (to != null && to.isNotEmpty) 'to': to,
      if (role != null && role.isNotEmpty && role != 'all') 'role': role,
    });
  }

  Future<List<Map<String, dynamic>>> getStaffPosAccountingOrders(
    String waiterId, {
    String? from,
    String? to,
  }) async {
    final branchId = await getBranchId();
    return _getList('/finance/staff-pos-accounting/$waiterId/orders', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (from != null && from.isNotEmpty) 'from': from,
      if (to != null && to.isNotEmpty) 'to': to,
    });
  }

  Future<Map<String, dynamic>> getPosDeepDrillOrders({
    String? from,
    String? to,
    String? outletId,
    String? waiterId,
    String? status,
    String? paymentStatus,
    String? search,
    int limit = 200,
    int offset = 0,
  }) async {
    final branchId = await getBranchId();
    final response = await _dio
        .get('/finance/staff-pos-accounting/deep-drill', queryParameters: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (from != null && from.isNotEmpty) 'from': from,
      if (to != null && to.isNotEmpty) 'to': to,
      if (outletId != null && outletId.isNotEmpty) 'outlet_id': outletId,
      if (waiterId != null && waiterId.isNotEmpty) 'waiter_id': waiterId,
      if (status != null && status.isNotEmpty) 'status': status,
      if (paymentStatus != null && paymentStatus.isNotEmpty)
        'payment_status': paymentStatus,
      if (search != null && search.isNotEmpty) 'search': search,
      'limit': limit,
      'offset': offset,
    });
    final body = response.data as Map<String, dynamic>;
    return {
      'data': List<Map<String, dynamic>>.from(body['data'] as List? ?? []),
      'total': body['total'] ?? 0,
      'limit': body['limit'] ?? limit,
      'offset': body['offset'] ?? offset,
    };
  }

  Future<void> recordCreditBillPayment(
    String id,
    Map<String, dynamic> data,
  ) async {
    await _dio.post('/cashier/credit-bills/$id/payment', data: data);
  }

  /// Schedule a staff credit bill to be deducted from the employee's payroll.
  Future<void> deductCreditBillFromPayroll(String id, {String? notes}) async {
    await _dio.post('/cashier/credit-bills/$id/payroll-deduct', data: {
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<List<Map<String, dynamic>>> getBranchStaff(
      {String search = ''}) async {
    final branchId = await getBranchId();
    return _getList('/staff', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (search.trim().isNotEmpty) 'search': search.trim(),
      'status': 'active',
      'limit': 500,
    });
  }

  Future<Map<String, dynamic>> updateStaffDeductionSettings(
    String staffId, {
    required bool nssfEnabled,
    required bool shifEnabled,
    required bool housingFundEnabled,
    double? nssfAmount,
    double? shifAmount,
    double? housingFundAmount,
  }) async {
    final data = <String, dynamic>{
      'nssf_enabled': nssfEnabled,
      'shif_enabled': shifEnabled,
      'housing_fund_enabled': housingFundEnabled,
    };
    if (nssfAmount != null) data['nssf_amount'] = nssfAmount;
    if (shifAmount != null) data['shif_amount'] = shifAmount;
    if (housingFundAmount != null) {
      data['housing_fund_amount'] = housingFundAmount;
    }
    final res = await _dio.put('/staff/$staffId', data: data);
    return _asMap(res.data);
  }

  /// Set/adjust a staff member's basic monthly salary (audited server-side as a
  /// `salary_adjustment`). Used by the Staff Accounts → Salaries tab.
  Future<void> updateStaffSalary(String staffId, num basicSalary) async {
    await _dio.put('/staff/$staffId', data: {'basic_salary': basicSalary});
  }

  Future<List<Map<String, dynamic>>> getPayrollCreditBills({
    String status = 'all',
    String? staffId,
    String? fromDate,
    String? toDate,
  }) async {
    final branchId = await getBranchId();
    return _getList('/payroll/credit-bills', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
      if (staffId != null && staffId.isNotEmpty) 'staff_id': staffId,
      if (fromDate != null && fromDate.isNotEmpty) 'from_date': fromDate,
      if (toDate != null && toDate.isNotEmpty) 'to_date': toDate,
    });
  }

  Future<Map<String, dynamic>> createPayrollCreditBill(
      Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/payroll/credit-bills', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
    return _asMap(res.data);
  }

  Future<void> recordPayrollCreditBillPayment(
    String id,
    Map<String, dynamic> data,
  ) async {
    await _dio.post('/payroll/credit-bills/$id/partial-payment', data: data);
  }

  Future<void> recordPaidBillByStaff(
    Map<String, dynamic> data,
  ) async {
    await _dio.post('/payroll/credit-bills/record-paid-bill', data: data);
  }

  Future<void> approvePayrollCreditBill(String id, {String notes = ''}) async {
    await _dio.patch('/payroll/credit-bills/$id/approve', data: {
      if (notes.trim().isNotEmpty) 'notes': notes.trim(),
    });
  }

  Future<Map<String, dynamic>> getPayrollCreditBillContents(String id) async {
    final res = await _dio.get('/payroll/credit-bills/$id/contents');
    return _asMap(res.data);
  }

  Future<void> transferPayrollCreditBill(
    String id,
    Map<String, dynamic> data,
  ) async {
    await _dio.post('/payroll/credit-bills/$id/transfer', data: data);
  }

  Future<void> rejectPayrollCreditBill(
    String id,
    Map<String, dynamic> data,
  ) async {
    await _dio.patch('/payroll/credit-bills/$id/reject', data: data);
  }

  Future<void> editPayrollCreditBill(
    String id,
    Map<String, dynamic> data,
  ) async {
    await _dio.put('/payroll/credit-bills/$id', data: data);
  }

  // ── Cashier-station credit bills ────────────────────────────────────────
  // GET /payroll/credit-bills merges rows from two tables — staff_credit_bills
  // (source_table 'staff_credit_bills') and the cashier station's own
  // credit_bills (source_table 'credit_bills', created when a cashier bills a
  // staff member's tab at the till). The action endpoints above only ever
  // operate on staff_credit_bills, so calling them against a 'credit_bills'
  // row 404s ("Credit bill not found") — these hit the matching endpoints
  // for that table instead.
  Future<void> approveCashierCreditBill(String id) async {
    await _dio.patch('/cashier/credit-bills/$id/confirm');
  }

  Future<void> recordCashierCreditBillPayment(
    String id, {
    required num amount,
    String paymentMethod = 'cash',
  }) async {
    await _dio.post('/cashier/credit-bills/$id/payment', data: {
      'payment_amount': amount,
      'payment_method': paymentMethod,
    });
  }

  Future<void> rejectCashierCreditBill(String id, String reason) async {
    await _dio.patch('/cashier/credit-bills/$id/reject', data: {
      'rejection_reason': reason,
    });
  }

  Future<void> editCashierCreditBill(
    String id,
    Map<String, dynamic> data,
  ) async {
    await _dio.put('/cashier/credit-bills/$id', data: data);
  }

  Future<List<Map<String, dynamic>>> getCashierPaidCreditEntries({
    String status = 'pending',
    String? fromDate,
    String? toDate,
  }) async {
    final branchId = await getBranchId();
    return _getList('/payroll/credit-bills/cashier-paid-credits', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
      if (fromDate != null && fromDate.isNotEmpty) 'from_date': fromDate,
      if (toDate != null && toDate.isNotEmpty) 'to_date': toDate,
    });
  }

  Future<void> applyCashierPaidCreditEntry(
    String entryId,
    Map<String, dynamic> data,
  ) async {
    await _dio.post(
      '/payroll/credit-bills/cashier-paid-credits/$entryId/apply',
      data: data,
    );
  }

  Future<List<Map<String, dynamic>>> getPayrollCreditBillPayments(
    String id,
  ) async {
    return _getList('/payroll/credit-bills/$id/payments');
  }

  Future<void> updatePayrollCreditBillStatus(String id, String status) async {
    await _dio.patch('/payroll/credit-bills/$id', data: {'status': status});
  }

  Future<List<Map<String, dynamic>>> getPayrollAdvances({
    String status = 'all',
    String? staffId,
    String? fromDate,
    String? toDate,
  }) async {
    final branchId = await getBranchId();
    return _getList('/payroll/advances', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
      if (staffId != null && staffId.isNotEmpty) 'staff_id': staffId,
      if (fromDate != null && fromDate.isNotEmpty) 'from_date': fromDate,
      if (toDate != null && toDate.isNotEmpty) 'to_date': toDate,
    });
  }

  Future<Map<String, dynamic>> createPayrollAdvance(
      Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/payroll/advances', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
    return _asMap(res.data);
  }

  Future<void> approvePayrollAdvance(String id) async {
    await _dio.post('/payroll/advances/$id/approve');
  }

  Future<void> rejectPayrollAdvance(String id) async {
    await _dio.post('/payroll/advances/$id/reject');
  }

  Future<List<Map<String, dynamic>>> getPayrollLoans({
    String status = 'all',
    String? staffId,
    String? fromDate,
    String? toDate,
  }) async {
    final branchId = await getBranchId();
    return _getList('/payroll/loans', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
      if (staffId != null && staffId.isNotEmpty) 'staff_id': staffId,
      if (fromDate != null && fromDate.isNotEmpty) 'from_date': fromDate,
      if (toDate != null && toDate.isNotEmpty) 'to_date': toDate,
    });
  }

  Future<Map<String, dynamic>> createPayrollLoan(
      Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/payroll/loans', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
    return _asMap(res.data);
  }

  Future<void> approvePayrollLoan(String id) async {
    await _dio.post('/payroll/loans/$id/approve');
  }

  Future<void> rejectPayrollLoan(String id) async {
    await _dio.post('/payroll/loans/$id/reject');
  }

  Future<void> recordPayrollLoanPayment(
    String id,
    Map<String, dynamic> data,
  ) async {
    await _dio.post('/payroll/loans/$id/payment', data: data);
  }

  // ── Customer credit bills (unpaid bills) ──────────────────────────────────
  Future<List<Map<String, dynamic>>> getCustomerUnpaidBills() async {
    final branchId = await getBranchId();
    return _getList('/cashier/unpaid-bills', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> createCustomerUnpaidBill(
      Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    final res = await _dio.post('/cashier/unpaid-bills', data: {
      if (branchId.isNotEmpty) 'branch_id': int.tryParse(branchId) ?? branchId,
      ...data,
    });
    return _asMap(res.data);
  }

  Future<void> recordUnpaidBillPayment(
      String id, Map<String, dynamic> data) async {
    await _dio.post('/cashier/unpaid-bills/$id/payment', data: data);
  }

  /// Bill more to a customer credit account/tab (grows the running balance).
  Future<Map<String, dynamic>> addChargeToCustomerBill(String id,
      {required num amount, String? description}) async {
    final res = await _dio.post('/cashier/unpaid-bills/$id/charge', data: {
      'amount': amount,
      if (description != null && description.trim().isNotEmpty)
        'description': description.trim(),
    });
    return _asMap(res.data);
  }

  Future<File> downloadUnpaidBillInvoice(String id) async {
    final res = await _dio.get<List<int>>(
      '/cashier/unpaid-bills/$id/pdf',
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(res.data ?? const [], 'Customer_Credit_$id.pdf');
  }

  Future<File> downloadOutstandingCustomerCredits() async {
    final branchId = await getBranchId();
    final res = await _dio.get<List<int>>(
      '/cashier/unpaid-bills/outstanding/pdf',
      queryParameters: {if (branchId.isNotEmpty) 'branch_id': branchId},
      options: Options(responseType: ResponseType.bytes),
    );
    return _saveBytes(res.data ?? const [], 'Outstanding_Customer_Credits.pdf');
  }

  Future<List<Map<String, dynamic>>> getFinanceInvoices() async {
    final branchId = await getBranchId();
    try {
      return await _getList('/accounting/invoices', query: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
      });
    } on DioException catch (e) {
      // Invoice register is optional; degrade to empty instead of an error page
      if (e.response?.statusCode == 500 ||
          e.response?.statusCode == 404 ||
          e.response?.statusCode == 403) {
        return [];
      }
      rethrow;
    }
  }

  Future<Map<String, dynamic>> getBookingInvoiceQueue({
    String sourceType = 'all',
    String status = 'all',
  }) async {
    final branchId = await getBranchId();
    return _getMap('/accounting/booking-invoice-queue', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (sourceType != 'all') 'source_type': sourceType,
      if (status != 'all') 'status': status,
    });
  }

  Future<Map<String, dynamic>> createBookingSourceInvoice(
    String sourceType,
    String sourceId,
  ) async {
    final branchId = await getBranchId();
    final res = await _dio.post(
      '/accounting/booking-invoice-queue/$sourceType/$sourceId/invoice',
      queryParameters: {if (branchId.isNotEmpty) 'branch_id': branchId},
    );
    return _asMap(res.data);
  }

  Future<List<Map<String, dynamic>>> getEventOrders({
    bool activeOnly = false,
    String? eventType,
  }) async {
    final branchId = await getBranchId();
    try {
      final res = await _dio.get(
        '/accounting/event-orders',
        queryParameters: {
          if (branchId.isNotEmpty) 'branch_id': branchId,
          if (activeOnly) 'active_only': 'true',
          if (eventType != null && eventType.trim().isNotEmpty)
            'event_type': eventType.trim(),
        },
      );
      final list = res.data['data'] as List?;
      return list?.map((e) => Map<String, dynamic>.from(e as Map)).toList() ??
          [];
    } catch (e) {
      if (e is DioException &&
          (e.response?.statusCode == 404 || e.response?.statusCode == 403)) {
        return [];
      }
      rethrow;
    }
  }

  Future<void> completeEventOrder(String id) async {
    final branchId = await getBranchId();
    await _dio.post(
      '/accounting/event-orders/$id/complete',
      queryParameters: {if (branchId.isNotEmpty) 'branch_id': branchId},
    );
  }

  Future<Map<String, dynamic>> createEventOrder(
      Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    final res = await _dio.post(
      '/accounting/event-orders',
      data: data,
      queryParameters: {if (branchId.isNotEmpty) 'branch_id': branchId},
    );
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> updateEventOrder(
      String id, Map<String, dynamic> data) async {
    final branchId = await getBranchId();
    final res = await _dio.put(
      '/accounting/event-orders/$id',
      data: data,
      queryParameters: {if (branchId.isNotEmpty) 'branch_id': branchId},
    );
    return _asMap(res.data);
  }

  Future<void> deleteEventOrder(String id) async {
    final branchId = await getBranchId();
    await _dio.delete(
      '/accounting/event-orders/$id',
      queryParameters: {if (branchId.isNotEmpty) 'branch_id': branchId},
    );
  }

  Future<File> downloadArInvoicePdf(String id, {String? invoiceNumber}) async {
    final branchId = await getBranchId();
    final res = await _dio.get<List<int>>(
      '/accounting/invoices/$id/pdf',
      queryParameters: {if (branchId.isNotEmpty) 'branch_id': branchId},
      options: Options(responseType: ResponseType.bytes),
    );
    final safeNumber = (invoiceNumber == null || invoiceNumber.trim().isEmpty)
        ? id
        : invoiceNumber.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    return _saveBytes(res.data ?? const [], 'Invoice_$safeNumber.pdf');
  }

  Future<File> downloadEventOrderPdf(String id, {String? eventNumber}) async {
    final branchId = await getBranchId();
    final res = await _dio.get<List<int>>(
      '/accounting/event-orders/$id/export/pdf',
      queryParameters: {if (branchId.isNotEmpty) 'branch_id': branchId},
      options: Options(responseType: ResponseType.bytes),
    );
    final safeNumber = (eventNumber == null || eventNumber.trim().isEmpty)
        ? id
        : eventNumber.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    return _saveBytes(res.data ?? const [], '$safeNumber.pdf');
  }

  Future<List<Map<String, dynamic>>> getBranchPayments({
    String status = 'all',
    String? startDate,
    String? endDate,
  }) async {
    final branchId = await getBranchId();
    return _getList('/payments-verification', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (status != 'all') 'status': status,
      if (startDate != null && startDate.isNotEmpty) 'start_date': startDate,
      if (endDate != null && endDate.isNotEmpty) 'end_date': endDate,
    });
  }

  Future<Map<String, dynamic>> getBranchPaymentStats({
    String? startDate,
    String? endDate,
  }) async {
    final branchId = await getBranchId();
    return _getMap('/payments-verification/stats', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (startDate != null && startDate.isNotEmpty) 'start_date': startDate,
      if (endDate != null && endDate.isNotEmpty) 'end_date': endDate,
    });
  }

  Future<List<Map<String, dynamic>>> getFinanceTransactions() async {
    final branchId = await getBranchId();
    try {
      return await _getList('/finance/transactions', query: {
        if (branchId.isNotEmpty) 'branch_id': branchId,
      });
    } on DioException catch (e) {
      if (e.response?.statusCode == 500 ||
          e.response?.statusCode == 404 ||
          e.response?.statusCode == 403) {
        return [];
      }
      rethrow;
    }
  }

  Future<List<Map<String, dynamic>>> getPendingKitchenShiftReviews() async {
    final branchId = await getBranchId();
    return _getList('/kitchen/shifts', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      'status': 'pending_accountant_review',
    });
  }

  Future<Map<String, dynamic>> getKitchenShiftReviewDetail(String id) async {
    return _getMap('/kitchen/shifts/$id');
  }

  Future<Map<String, dynamic>> reviewKitchenShiftVariance({
    required String shiftId,
    required bool approved,
    required String liabilityAction,
    List<Map<String, dynamic>> allocations = const [],
    String? notes,
    String? writeOffReason,
  }) async {
    final res =
        await _dio.post('/kitchen/shifts/$shiftId/accountant-review', data: {
      'approved': approved,
      'liability_action': liabilityAction,
      if (allocations.isNotEmpty) 'allocations': allocations,
      if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      if (writeOffReason != null && writeOffReason.trim().isNotEmpty)
        'write_off_reason': writeOffReason.trim(),
    });
    return _asMap(res.data);
  }

  Future<List<Map<String, dynamic>>> getDepartmentIssueJournals({
    String? startDate,
    String? endDate,
    String? departmentCode,
  }) async {
    final branchId = await getBranchId();
    if (branchId.isEmpty) return [];
    return _getList('/store/department-issue-journals', query: {
      'branch_id': branchId,
      if (startDate != null && startDate.isNotEmpty) 'start_date': startDate,
      if (endDate != null && endDate.isNotEmpty) 'end_date': endDate,
      if (departmentCode != null &&
          departmentCode.isNotEmpty &&
          departmentCode != 'all')
        'department_code': departmentCode,
      'limit': 300,
    });
  }

  Future<Map<String, dynamic>> getDepartmentIssueJournalDetail(
    String ledgerId,
  ) async {
    final branchId = await getBranchId();
    return _getMap('/store/department-issue-journals/$ledgerId', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<List<Map<String, dynamic>>> getDepartmentAccounts() async {
    final branchId = await getBranchId();
    if (branchId.isEmpty) return [];
    return _getList('/store/department-accounts', query: {
      'branch_id': branchId,
    });
  }

  Future<List<Map<String, dynamic>>> getPurchaseOrders({String? status}) {
    return _getList('/procurement/purchase-orders', query: {
      'source_module': 'branch_accounting',
      if (status != null && status.isNotEmpty) 'status': status,
    });
  }

  Future<List<Map<String, dynamic>>> getSupplierInvoices({
    String? supplierId,
    String? status,
    String? fromDate,
    String? toDate,
  }) {
    return _getList('/procurement/invoices', query: {
      if (supplierId != null && supplierId.isNotEmpty)
        'supplier_id': supplierId,
      if (status != null && status.isNotEmpty && status != 'all')
        'status': status,
      if (fromDate != null && fromDate.isNotEmpty) 'from_date': fromDate,
      if (toDate != null && toDate.isNotEmpty) 'to_date': toDate,
    });
  }

  Future<List<Map<String, dynamic>>> getReadyToBillGRNs({
    String? supplierId,
  }) async {
    final branchId = await getBranchId();
    return _getList('/procurement/ready-to-bill', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
      if (supplierId != null && supplierId.isNotEmpty)
        'supplier_id': supplierId,
    });
  }

  Future<List<Map<String, dynamic>>> getSupplierGRNs({
    String? supplierId,
  }) {
    return _getList('/procurement/grn', query: {
      if (supplierId != null && supplierId.isNotEmpty)
        'supplier_id': supplierId,
    });
  }

  Future<List<Map<String, dynamic>>> getSupplierPayments({
    String? supplierId,
    String? status,
    String? fromDate,
    String? toDate,
  }) {
    return _getList('/procurement/payments', query: {
      if (supplierId != null && supplierId.isNotEmpty)
        'supplier_id': supplierId,
      if (status != null && status.isNotEmpty && status != 'all')
        'status': status,
      if (fromDate != null && fromDate.isNotEmpty) 'from_date': fromDate,
      if (toDate != null && toDate.isNotEmpty) 'to_date': toDate,
    });
  }

  // Suppliers (branch-scoped) for PO/invoice creation
  Future<List<Map<String, dynamic>>> getSuppliers({
    String scope = 'branch',
    String? search,
  }) {
    return _getList('/store/suppliers', query: {
      'scope': scope,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    });
  }

  // Catalog items for PO line selection
  Future<List<Map<String, dynamic>>> getStoreItems() {
    return _getList('/store/items', query: {'limit': 1000});
  }

  Future<Map<String, dynamic>> getInvoiceDetail(String id) {
    return _getMap('/procurement/invoices/$id');
  }

  Future<Map<String, dynamic>> getGRNDetail(String id) {
    return _getMap('/procurement/grn/$id');
  }

  Future<Map<String, dynamic>> createPurchaseOrder(
      Map<String, dynamic> data) async {
    final res = await _dio.post('/procurement/purchase-orders', data: data);
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> createSupplierInvoice(
      Map<String, dynamic> data) async {
    final res = await _dio.post('/procurement/invoices', data: data);
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> createSupplierPayment(
      Map<String, dynamic> data) async {
    final res = await _dio.post('/procurement/payments', data: data);
    return _asMap(res.data);
  }

  Future<void> processSupplierPayment(String id) async {
    await _dio.put('/procurement/payments/$id/process');
  }

  Future<Map<String, dynamic>> createStoreSupplier(
      Map<String, dynamic> data) async {
    final res = await _dio.post('/store/suppliers', data: data);
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> getSupplierAging({String? supplierId}) {
    return _getMap('/procurement/reports/aging', query: {
      if (supplierId != null && supplierId.isNotEmpty)
        'supplier_id': supplierId,
    });
  }

  Future<List<Map<String, dynamic>>> getSupplierLedger(String supplierId) {
    return _getList('/procurement/ledger/$supplierId');
  }

  Future<Map<String, dynamic>> getSupplierPerformance(String supplierId) {
    return _getMap('/procurement/performance/$supplierId');
  }

  Future<List<Map<String, dynamic>>> getBudgets() async {
    final branchId = await getBranchId();
    return _getList('/branch-operations/finances/budgets', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> getBudgetSummary() async {
    final branchId = await getBranchId();
    if (branchId.isEmpty) return {};
    return _getMap('/branch-operations/finances/budget-summary', query: {
      'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> getBudgetAnalysis() async {
    final branchId = await getBranchId();
    return _getMap('/branch-operations/finances/budget-analysis', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<void> createBudget(Map<String, dynamic> data) async {
    await _dio.post('/branch-operations/finances/budgets', data: data);
  }

  Future<void> updateBudget(String id, Map<String, dynamic> data) async {
    await _dio.put('/branch-operations/finances/budgets/$id', data: data);
  }

  Future<void> deleteBudget(String id) async {
    await _dio.delete('/branch-operations/finances/budgets/$id');
  }

  Future<void> linkBudgetExpense(String id, Map<String, dynamic> data) async {
    await _dio.post('/branch-operations/finances/budgets/$id/expenses',
        data: data);
  }

  // ── Waiter Audit ──────────────────────────────────────────────────────────
  Future<List<Map<String, dynamic>>> getBranchWaiters() async {
    final branchId = await getBranchId();
    return _getList('/staff/audit/waiters', query: {
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<Map<String, dynamic>> getWaiterOrders({
    required String waiterId,
    required String date,
  }) async {
    final branchId = await getBranchId();
    return _getMap('/staff/audit/waiters/$waiterId/orders', query: {
      'date': date,
      if (branchId.isNotEmpty) 'branch_id': branchId,
    });
  }

  Future<void> createCreditBillFromOrder({
    required String orderId,
    required String orderNumber,
    required String customerName,
    required num amount,
  }) async {
    await _dio.post('/cashier/credit-bill', data: {
      'bill_id': orderId,
      'bill_number': orderNumber,
      'customer_name': customerName,
      'amount': amount,
      'source': 'pos',
    });
  }

  Future<Map<String, dynamic>> _getMap(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final res = await _dio.get(path, queryParameters: query);
    return _asMap(res.data);
  }

  Future<List<Map<String, dynamic>>> _getList(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final res = await _dio.get(path, queryParameters: query);
    return _asList(res.data);
  }

  bool _isRecoverableBranchEndpointError(DioException error) {
    final status = error.response?.statusCode;
    if (status == 403 || status == 404) return true;
    if (status != 500) return false;
    final data = error.response?.data;
    final message = data is Map ? '${data['message'] ?? ''}' : '$data';
    return message.contains('Could not find a relationship') ||
        message.contains('schema cache');
  }

  Map<String, dynamic> _asMap(dynamic value) {
    if (value is Response) {
      value = value.data;
    }
    if (value is Map<String, dynamic>) {
      if (value['data'] is Map) {
        final data = Map<String, dynamic>.from(value['data'] as Map);
        if (value['summary'] != null) data['summary'] = value['summary'];
        if (value['meta'] != null) data['meta'] = value['meta'];
        return data;
      }
      return value;
    }
    if (value is Map) return Map<String, dynamic>.from(value);
    return {};
  }

  Map<String, dynamic> _enrichStaffAuditWithProfiles(
    Map<String, dynamic> audit,
    List<Map<String, dynamic>> staff,
  ) {
    if (staff.isEmpty) return audit;
    final enriched = Map<String, dynamic>.from(audit);
    final byId = <String, Map<String, dynamic>>{};
    final byEmployee = <String, Map<String, dynamic>>{};
    final byName = <String, Map<String, dynamic>>{};

    for (final profile in staff) {
      final id = _text(profile, const ['id', 'staff_id']);
      if (id.isNotEmpty) byId[id] = profile;
      // employee_number / employee_id / staff_code are the employee number fields.
      // national_id and id_number are the national ID — never use them as emp-number keys.
      final employeeId = _text(profile, const [
        'employee_number',
        'employee_id',
        'staff_code',
      ]);
      if (employeeId.isNotEmpty) byEmployee[_norm(employeeId)] = profile;
      final name = _staffName(profile);
      if (name.isNotEmpty) byName[_norm(name)] = profile;
    }

    Map<String, dynamic> enrichRow(Map<String, dynamic> row) {
      final profile = byId[_text(row, const ['staff_id', 'id'])] ??
          byEmployee[_norm(_text(row, const [
            'employee_number',
            'employee_id',
            'staff_code',
          ]))] ??
          byName[_norm(_text(row, const ['staff_name', 'name']))];
      if (profile == null) return row;

      final merged = Map<String, dynamic>.from(row);
      final salary = _firstPositiveNum(profile, const [
        'basic_salary',
        'salary',
        'monthly_salary',
        'gross_salary',
        'gross_pay',
        'net_pay',
      ]);
      if (_num(merged['salary']) <= 0 && salary > 0) {
        merged['salary'] = salary;
      }
      merged['basic_salary'] ??= salary > 0 ? salary : null;

      // national_id / id_number = National ID (Kenyan ID card number)
      _fillText(merged, 'national_id', profile, const [
        'national_id',
        'id_number',
        'identity_number',
      ]);
      _fillText(merged, 'id_number', profile, const [
        'id_number',
        'national_id',
      ]);
      // employee_id / employee_number / staff_code = Employee Number (EMP001, etc.)
      _fillText(merged, 'employee_id', profile, const [
        'employee_number',
        'employee_id',
        'staff_code',
      ]);
      _fillText(merged, 'employee_number', profile, const [
        'employee_number',
        'employee_id',
        'staff_code',
      ]);
      _fillText(merged, 'staff_code', profile, const [
        'staff_code',
        'employee_number',
        'employee_id',
      ]);
      _fillText(merged, 'department', profile, const ['department']);
      _fillText(merged, 'role', profile, const ['role', 'position']);
      _fillText(merged, 'branch_name', profile, const ['branch_name']);
      return merged;
    }

    final summary = _asList(enriched['summary']);
    if (summary.isNotEmpty) {
      enriched['summary'] = summary.map(enrichRow).toList();
    }
    final records = _asList(enriched['data'] ?? enriched['records']);
    if (records.isNotEmpty) {
      enriched['data'] = records.map(enrichRow).toList();
    }
    return enriched;
  }

  List<Map<String, dynamic>> _asList(dynamic value) {
    if (value is Response) {
      value = value.data;
    }
    var data = value is Map
        ? value['data'] ??
            value['items'] ??
            value['records'] ??
            value['staff'] ??
            value['staff_profiles'] ??
            value['employees'] ??
            value['analysis'] ??
            []
        : value;
    if (data is Map) {
      data = data['data'] ??
          data['items'] ??
          data['records'] ??
          data['staff'] ??
          data['staff_profiles'] ??
          data['employees'] ??
          data['rows'] ??
          data['results'] ??
          data['clearances'] ??
          data['logbooks'] ??
          data['transactions'] ??
          data['invoices'] ??
          data['payments'] ??
          data['purchase_orders'] ??
          data['purchaseOrders'] ??
          data['stock_takes'] ??
          data['stockTakes'] ??
          [];
    }
    if (data is List) {
      return data
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    return [];
  }

  String _staffName(Map<String, dynamic> row) {
    final explicit = _text(row, const ['staff_name', 'full_name', 'name']);
    if (explicit.isNotEmpty) return explicit;
    return [
      _text(row, const ['first_name', 'firstName']),
      _text(row, const ['last_name', 'lastName']),
    ].where((part) => part.isNotEmpty).join(' ').trim();
  }

  String _text(Map<String, dynamic> row, List<String> keys) {
    for (final key in keys) {
      final value = row[key];
      final text = value == null ? '' : '$value'.trim();
      if (text.isNotEmpty && text.toLowerCase() != 'null') return text;
    }
    return '';
  }

  void _fillText(
    Map<String, dynamic> target,
    String targetKey,
    Map<String, dynamic> source,
    List<String> sourceKeys,
  ) {
    final current = _text(target, [targetKey]);
    if (current.isNotEmpty && current.toLowerCase() != 'pending') return;
    final value = _text(source, sourceKeys);
    if (value.isNotEmpty) target[targetKey] = value;
  }

  String _norm(String value) =>
      value.trim().toLowerCase().replaceAll(RegExp(r'\s+'), ' ');

  num _num(dynamic value) {
    if (value is num) return value;
    return num.tryParse('$value') ?? 0;
  }

  num _firstPositiveNum(Map<String, dynamic> row, List<String> keys) {
    for (final key in keys) {
      final value = _num(row[key]);
      if (value > 0) return value;
    }
    return 0;
  }

  Future<File> _saveBytes(List<int> bytes, String filename) async {
    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final safeName = filename.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final file = File('${directory.path}/$safeName');
    await file.writeAsBytes(bytes, flush: true);
    return file;
  }

  // --- Corporate Accounts ---
  Future<List<Map<String, dynamic>>> getCorporateCustomers() async {
    final res = await _dio.get('/corporate/customers');
    return _asList(res.data);
  }

  Future<Map<String, dynamic>> createCorporateCustomer(
      Map<String, dynamic> data) async {
    final res = await _dio.post('/corporate/customers', data: data);
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> chargeCorporateCredit({
    required String posBillId,
    required String corporateCustomerId,
    required double amount,
    String? shiftId,
  }) async {
    final res = await _dio.post('/corporate/charge', data: {
      'pos_bill_id': posBillId,
      'corporate_customer_id': corporateCustomerId,
      'amount': amount,
      'shift_id': shiftId,
    });
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> updateCorporateCustomer(
      String id, Map<String, dynamic> data) async {
    final res = await _dio.put('/corporate/customers/$id', data: data);
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> deleteCorporateCustomer(String id) async {
    final res = await _dio.delete('/corporate/customers/$id');
    return _asMap(res.data);
  }

  Future<List<Map<String, dynamic>>> getAllCorporateBills(
      {String? customerId}) async {
    final res = await _dio.get('/corporate/bills', queryParameters: {
      if (customerId != null && customerId.isNotEmpty)
        'customer_id': customerId,
    });
    return _asList(res.data);
  }

  Future<Map<String, dynamic>> getCorporateCustomerFolio(
      String customerId) async {
    final res = await _dio.get('/corporate/customers/$customerId/folio');
    return _asMap(res.data);
  }

  Future<List<Map<String, dynamic>>> getPendingCorporateBills() async {
    final res = await _dio.get('/corporate/bills/pending');
    return _asList(res.data);
  }

  Future<List<Map<String, dynamic>>> getCorporateInvoices() async {
    final res = await _dio.get('/corporate/invoices');
    return _asList(res.data);
  }

  Future<Map<String, dynamic>> generateCorporateInvoice(
      Map<String, dynamic> data) async {
    final res = await _dio.post('/corporate/invoices/generate', data: data);
    return _asMap(res.data);
  }

  Future<Map<String, dynamic>> payCorporateInvoice(
      String id, Map<String, dynamic> data) async {
    final res = await _dio.post('/corporate/invoices/$id/pay', data: data);
    return _asMap(res.data);
  }
}
