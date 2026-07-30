import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/powersync/powersync_service.dart';
import '../../../core/network/dio_client.dart';

final outletPosRepositoryProvider = Provider<OutletPosRepository>((ref) {
  return OutletPosRepository(ref);
});

class _RepoCacheEntry<T> {
  const _RepoCacheEntry(this.value, this.expiresAt);

  final T value;
  final DateTime expiresAt;

  bool get isFresh => DateTime.now().isBefore(expiresAt);
}

class OutletPosRepository {
  OutletPosRepository(this._ref) : _dio = _ref.read(dioProvider);

  final Ref _ref;
  final Dio _dio;
  final Map<String, _RepoCacheEntry<PosBootstrapSnapshot>> _bootstrapCache = {};
  final Map<String, _RepoCacheEntry<List<OutletPosItem>>> _itemsCache = {};

  PowerSyncService get _powerSync => _ref.read(powerSyncServiceProvider);

  PosBootstrapSnapshot? _readBootstrapCache(String key) {
    final entry = _bootstrapCache[key];
    if (entry == null || !entry.isFresh) {
      _bootstrapCache.remove(key);
      return null;
    }
    return entry.value;
  }

  List<OutletPosItem>? _readItemsCache(String key) {
    final entry = _itemsCache[key];
    if (entry == null || !entry.isFresh) {
      _itemsCache.remove(key);
      return null;
    }
    return List<OutletPosItem>.from(entry.value);
  }

  Future<PosBootstrapSnapshot> getBootstrap({
    String? outletType,
    String? outletId,
    bool allOutlets = false,
  }) async {
    final cacheKey = [
      outletType?.trim().toLowerCase() ?? 'all',
      outletId?.trim().toLowerCase() ?? 'auto',
      allOutlets ? 'all-outlets' : 'selected',
    ].join('|');
    final cached = _readBootstrapCache(cacheKey);
    if (cached != null) return cached;
    final response = await _dio.get('/pos/bootstrap', queryParameters: {
      if (outletId != null && outletId.trim().isNotEmpty)
        'outlet_id': outletId.trim(),
      if (outletType != null && outletType.trim().isNotEmpty)
        'selected_outlet_type': outletType.trim(),
      if (!allOutlets && outletType != null && outletType.trim().isNotEmpty)
        'outlet_type': outletType.trim(),
      if (allOutlets) 'all_outlets': 'true',
    });
    final data = _data(response.data);
    final map = data is Map ? Map<String, dynamic>.from(data) : const {};
    final outlets = (map['outlets'] is List ? map['outlets'] as List : const [])
        .whereType<Map>()
        .map((item) => PosOutlet.fromJson(Map<String, dynamic>.from(item)))
        .toList();
    final outletMap = map['outlet'];
    final outlet = outletMap is Map
        ? PosOutlet.fromJson(Map<String, dynamic>.from(outletMap))
        : null;
    final shiftMap = map['shift'];
    final shift = shiftMap is Map
        ? OutletShift.fromJson(Map<String, dynamic>.from(shiftMap))
        : null;
    final fallbackOutlet = outlet;
    final items = (map['items'] is List ? map['items'] as List : const [])
        .whereType<Map>()
        .map((item) => OutletPosItem.fromJson(
              Map<String, dynamic>.from(item),
              fallbackOutlet: fallbackOutlet,
            ))
        .toList();
    final orders = (map['orders'] is List ? map['orders'] as List : const [])
        .whereType<Map>()
        .map((item) => OutletShiftOrder.fromJson(
              Map<String, dynamic>.from(item),
            ))
        .toList();
    final snapshot = PosBootstrapSnapshot(
      outlets: outlets,
      outlet: outlet,
      shift: shift,
      items: items,
      orders: orders,
    );
    _bootstrapCache[cacheKey] = _RepoCacheEntry(
      snapshot,
      DateTime.now().add(const Duration(seconds: 10)),
    );
    return snapshot;
  }

  Future<List<PosOutlet>> getOutlets(
      {String? outletType, int? branchId}) async {
    if (_powerSync.hotReadsEnabled) {
      final local = await _powerSync.getPosOutlets(
        outletType: outletType,
        branchId: branchId,
      );
      if (local.isNotEmpty) {
        return local
            .map((item) => PosOutlet.fromJson(Map<String, dynamic>.from(item)))
            .toList();
      }
    }
    final response = await _dio.get('/pos/outlets', queryParameters: {
      if (outletType != null) 'outlet_type': outletType,
      if (branchId != null) 'branch_id': branchId,
    });
    return _list(response.data)
        .map((item) => PosOutlet.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<List<OutletPosItem>> getItems(
    String outletId, {
    bool includeRelated = false,
    PosOutlet? fallbackOutlet,
  }) async {
    final cacheKey = [
      outletId.trim().toLowerCase(),
      includeRelated ? 'related' : 'direct',
    ].join('|');
    final cached = _readItemsCache(cacheKey);
    if (cached != null) return cached;
    if (_powerSync.hotReadsEnabled && !includeRelated) {
      final local = await _powerSync.getPosOutletItems(outletId);
      if (local.isNotEmpty) {
        return local
            .map((item) => OutletPosItem.fromJson(
                  Map<String, dynamic>.from(item),
                  fallbackOutlet: fallbackOutlet,
                ))
            .toList();
      }
    }
    final response =
        await _dio.get('/pos/outlets/$outletId/items', queryParameters: {
      if (includeRelated) 'include_related': true,
    });
    final rows = _list(response.data)
        .map((item) => OutletPosItem.fromJson(
              Map<String, dynamic>.from(item),
              fallbackOutlet: fallbackOutlet,
            ))
        .toList();
    _itemsCache[cacheKey] = _RepoCacheEntry(
      List<OutletPosItem>.from(rows),
      DateTime.now().add(const Duration(minutes: 2)),
    );
    return rows;
  }

  Future<List<OutletPosItem>> getUnifiedFoodAndBarItems(
    PosOutlet primaryOutlet,
  ) async {
    final relatedItems = await getItems(
      primaryOutlet.id,
      includeRelated: true,
      fallbackOutlet: primaryOutlet,
    );
    final relatedGroups = relatedItems.map((item) => item.itemGroup).toSet();
    if (relatedGroups.contains('restaurant') && relatedGroups.contains('bar')) {
      return _sortItems(relatedItems);
    }

    final outletById = <String, PosOutlet>{primaryOutlet.id: primaryOutlet};
    for (final outlet in await getOutlets(branchId: primaryOutlet.branchId)) {
      if (outlet.isFoodOrBar) outletById[outlet.id] = outlet;
    }

    final items = <OutletPosItem>[];
    for (final outlet in outletById.values) {
      if (!outlet.isFoodOrBar) continue;
      final outletItems = await getItems(outlet.id, fallbackOutlet: outlet);
      items.addAll(outletItems);
    }

    return _sortItems(items);
  }

  List<OutletPosItem> _sortItems(List<OutletPosItem> items) {
    return [...items]..sort((a, b) {
        final group = a.itemGroupLabel.compareTo(b.itemGroupLabel);
        if (group != 0) return group;
        final category = a.category.compareTo(b.category);
        if (category != 0) return category;
        return a.name.compareTo(b.name);
      });
  }

  Future<List<OutletStaffMember>> getStaff({String? search}) async {
    final response = await _dio.get('/pos/staff', queryParameters: {
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
    });
    return _list(response.data)
        .map((item) =>
            OutletStaffMember.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<OutletShift?> getActiveShift(String outletId) async {
    if (_powerSync.hotReadsEnabled) {
      final local = await _powerSync.getActivePosShift(outletId);
      if (local != null) {
        return OutletShift.fromJson(local);
      }
    }
    final response = await _dio.get('/pos/outlets/$outletId/shifts/active');
    final data = _data(response.data);
    if (data == null) return null;
    return OutletShift.fromJson(Map<String, dynamic>.from(data as Map));
  }

  Future<OutletShift> openShift(String outletId, double openingFloat) async {
    final response = await _dio.post('/pos/outlets/$outletId/shifts/open',
        data: {'opening_float': openingFloat});
    return OutletShift.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<List<OutletShiftOrder>> getOrders(String shiftId) async {
    if (_powerSync.hotReadsEnabled) {
      final local = await _powerSync.getPosShiftOrders(shiftId);
      if (local.isNotEmpty) {
        return local
            .map((item) =>
                OutletShiftOrder.fromJson(Map<String, dynamic>.from(item)))
            .toList();
      }
    }
    final response = await _dio.get('/pos/shifts/$shiftId/orders');
    return _list(response.data)
        .map((item) =>
            OutletShiftOrder.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<OutletShiftOrder> createOrder({
    required String shiftId,
    required List<OutletCartItem> items,
    String? customerName,
    String? orderType,
    String? tableNumber,
    String? roomNumber,
    // When set, this new outlet order joins an existing master customer bill
    // (waiter adding items from another outlet to the same bill).
    String? masterBillId,
  }) async {
    final total = items.fold<double>(0, (sum, item) => sum + item.lineTotal);
    final response = await _dio.post('/pos/shifts/$shiftId/orders', data: {
      'customer_name':
          customerName?.trim().isEmpty == true ? null : customerName,
      if (orderType != null && orderType.trim().isNotEmpty)
        'order_type': orderType.trim(),
      if (tableNumber != null && tableNumber.trim().isNotEmpty)
        'table_number': tableNumber.trim(),
      if (roomNumber != null && roomNumber.trim().isNotEmpty)
        'room_number': roomNumber.trim(),
      if (masterBillId != null && masterBillId.trim().isNotEmpty)
        'master_bill_id': masterBillId.trim(),
      'items': items.map((item) => item.toJson()).toList(),
      'total_amount': total,
    });
    return OutletShiftOrder.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  // ── Consolidated customer bills (cross-outlet) ────────────────────────────

  /// Every unsettled order the current waiter owns across ALL their outlets,
  /// folded into consolidated bills.
  Future<List<ConsolidatedBill>> getWaiterOpenBills({String? waiterId}) async {
    final response = await _dio.get('/pos/waiter/open-bills', queryParameters: {
      if (waiterId != null && waiterId.isNotEmpty) 'waiter_id': waiterId,
    });
    return _list(response.data)
        .whereType<Map>()
        .map((e) => ConsolidatedBill.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<ConsolidatedBill?> getConsolidatedBill(String masterBillId) async {
    final response = await _dio.get('/pos/bills/$masterBillId');
    final data = _data(response.data);
    if (data is! Map) return null;
    return ConsolidatedBill.fromJson(Map<String, dynamic>.from(data));
  }

  /// Combine the given orders into ONE master customer bill.
  Future<ConsolidatedBill?> linkOrdersIntoBill({
    required List<String> orderIds,
    String? anchorOrderId,
    String? label,
  }) async {
    final response = await _dio.post('/pos/bills/link', data: {
      'order_ids': orderIds,
      if (anchorOrderId != null) 'anchor_order_id': anchorOrderId,
      if (label != null && label.trim().isNotEmpty) 'label': label.trim(),
    });
    final data = _data(response.data);
    if (data is! Map) return null;
    return ConsolidatedBill.fromJson(Map<String, dynamic>.from(data));
  }

  Future<void> unlinkOrderFromBill({
    required String masterBillId,
    required String orderId,
  }) async {
    await _dio.post('/pos/bills/$masterBillId/unlink-order',
        data: {'order_id': orderId});
  }

  /// Settle the whole master bill with one tender; each member order is paid
  /// against its own outlet shift (per-outlet revenue + stock).
  Future<Map<String, dynamic>> payConsolidatedBill({
    required String masterBillId,
    required String paymentMethod,
    String? reference,
  }) async {
    final response = await _dio.post('/pos/bills/$masterBillId/pay', data: {
      'payment_method': paymentMethod,
      if (reference != null && reference.trim().isNotEmpty)
        'reference': reference.trim(),
    });
    final data = _data(response.data);
    return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
  }

  // ── Cross-outlet settlements (outlet cashier confirms their share) ─────────

  /// Sub-bills collected by another outlet's cashier that THIS cashier must
  /// confirm (status='pending') or the full list (status='all').
  Future<List<CrossOutletSettlement>> getCrossOutletSettlements(
      {String status = 'pending'}) async {
    final response = await _dio.get('/pos/settlements/cross-outlet',
        queryParameters: {'status': status});
    return _list(response.data)
        .whereType<Map>()
        .map((e) =>
            CrossOutletSettlement.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  Future<void> confirmCrossOutletSettlement(String settlementId) async {
    await _dio.post('/pos/settlements/$settlementId/confirm');
  }

  Future<void> disputeCrossOutletSettlement(
      {required String settlementId, required String reason}) async {
    await _dio.post('/pos/settlements/$settlementId/dispute',
        data: {'reason': reason});
  }

  /// The collecting (origin) cashier or a manager resolves a disputed sub-bill:
  /// 'confirm' (accept & confirm) or 'reopen' (send back for re-confirmation).
  Future<void> resolveDisputedSettlement(
      {required String settlementId, String resolution = 'confirm'}) async {
    await _dio.post('/pos/settlements/$settlementId/resolve',
        data: {'resolution': resolution});
  }

  // ── Master bill actions (add cross-outlet items, transfer, move table) ─────

  /// Add items from ANOTHER outlet to a master bill; the new order is created in
  /// that outlet's own open shift but joins this master bill.
  Future<ConsolidatedBill?> addItemsToMasterBill({
    required String masterBillId,
    required String outletId,
    required List<OutletCartItem> items,
    String? orderType,
  }) async {
    final response =
        await _dio.post('/pos/bills/$masterBillId/add-items', data: {
      'outlet_id': outletId,
      if (orderType != null && orderType.trim().isNotEmpty)
        'order_type': orderType.trim(),
      'items': items.map((e) => e.toJson()).toList(),
    });
    final data = _data(response.data);
    return data is Map
        ? ConsolidatedBill.fromJson(Map<String, dynamic>.from(data))
        : null;
  }

  Future<ConsolidatedBill?> transferMasterBillWaiter({
    required String masterBillId,
    required String waiterId,
    String? waiterName,
  }) async {
    final response =
        await _dio.post('/pos/bills/$masterBillId/transfer-waiter', data: {
      'waiter_id': waiterId,
      if (waiterName != null && waiterName.trim().isNotEmpty)
        'waiter_name': waiterName.trim(),
    });
    final data = _data(response.data);
    return data is Map
        ? ConsolidatedBill.fromJson(Map<String, dynamic>.from(data))
        : null;
  }

  Future<ConsolidatedBill?> moveMasterBillTable({
    required String masterBillId,
    String? tableNumber,
  }) async {
    final response = await _dio
        .post('/pos/bills/$masterBillId/move-table', data: {
      'table_number': tableNumber?.trim().isEmpty == true ? null : tableNumber
    });
    final data = _data(response.data);
    return data is Map
        ? ConsolidatedBill.fromJson(Map<String, dynamic>.from(data))
        : null;
  }

  Future<OutletShiftOrder> updateOrder({
    required String shiftId,
    required String orderId,
    required List<OutletCartItem> items,
    String? customerName,
    String? orderType,
    String? tableNumber,
    String? roomNumber,
    bool appendItems = false,
  }) async {
    final total = items.fold<double>(0, (sum, item) => sum + item.lineTotal);
    final response =
        await _dio.patch('/pos/shifts/$shiftId/orders/$orderId', data: {
      if (customerName != null && customerName.trim().isNotEmpty)
        'customer_name': customerName.trim(),
      if (orderType != null && orderType.trim().isNotEmpty)
        'order_type': orderType.trim(),
      if (tableNumber != null && tableNumber.trim().isNotEmpty)
        'table_number': tableNumber.trim(),
      if (roomNumber != null && roomNumber.trim().isNotEmpty)
        'room_number': roomNumber.trim(),
      if (appendItems) 'append_items': true,
      'items': items.map((item) => item.toJson()).toList(),
      'total_amount': total,
    });
    return OutletShiftOrder.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<List<OutletShiftOrder>> splitOrder({
    required String shiftId,
    required String orderId,
    required List<Map<String, dynamic>> splits,
  }) async {
    final response =
        await _dio.post('/pos/shifts/$shiftId/orders/$orderId/split', data: {
      'splits': splits,
    });
    return _list(response.data)
        .map((item) =>
            OutletShiftOrder.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<OutletShiftOrder> mergeOrders({
    required String shiftId,
    required List<String> orderIds,
    String? customerName,
  }) async {
    final response =
        await _dio.post('/pos/shifts/$shiftId/orders/merge', data: {
      'order_ids': orderIds,
      if (customerName != null && customerName.trim().isNotEmpty)
        'customer_name': customerName.trim(),
    });
    return OutletShiftOrder.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<void> requestVoidOrder({
    required String shiftId,
    required String orderId,
    required String reason,
  }) async {
    await _dio.post('/pos/shifts/$shiftId/orders/$orderId/void-request', data: {
      'reason': reason,
    });
  }

  // ── Whole-bill void chain: Cashier Stage 2 ──────────────────────────────
  // Kitchen (KDS) acknowledges first; once kitchen_acknowledged, the cashier
  // acknowledges here — this is where the financial effect (stock, kitchen
  // consumption, inventory, shift totals) actually applies, so the cashier's
  // own shift close reflects the void. Branch accountant gives final
  // compliance approval afterwards.

  Future<List<Map<String, dynamic>>> getPendingVoidsCashierWholeBill() async {
    final response = await _dio.get('/pos/void-requests/pending/cashier');
    return _list(response.data)
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<Map<String, dynamic>> cashierAcknowledgeVoidRequest(
      String requestId) async {
    try {
      final response =
          await _dio.patch('/pos/void-requests/$requestId/cashier-acknowledge');
      return Map<String, dynamic>.from(_data(response.data) as Map);
    } on DioException catch (error) {
      throw StateError(
          _errorMessage(error, 'Could not acknowledge bill void request.'));
    }
  }

  Future<void> cashierDeclineVoidRequest(
    String requestId, {
    String? rejectionReason,
  }) async {
    try {
      await _dio.patch('/pos/void-requests/$requestId/cashier-decline', data: {
        if (rejectionReason != null && rejectionReason.trim().isNotEmpty)
          'rejection_reason': rejectionReason.trim(),
      });
    } on DioException catch (error) {
      throw StateError(
          _errorMessage(error, 'Could not decline bill void request.'));
    }
  }

  // ── Cashier Void Management ──────────────────────────────────────────────
  // The cashier searches for any unpaid/partial bill in the branch and voids
  // it immediately (whole bill or specific items) — no bartender/waiter
  // request, no separate manager-approval wait.

  Future<List<Map<String, dynamic>>> searchVoidableBills(String query) async {
    if (query.trim().isEmpty) return [];
    final response = await _dio.get('/pos/voids/cashier/search',
        queryParameters: {'q': query.trim()});
    return _list(response.data)
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<OutletShiftOrder> cashierVoidWholeBill({
    required String orderId,
    required String reasonCategory,
    String? note,
  }) async {
    try {
      final response = await _dio.post('/pos/voids/cashier/whole-bill', data: {
        'order_id': orderId,
        'reason_category': reasonCategory,
        'reason': (note != null && note.trim().isNotEmpty)
            ? note.trim()
            : cashierVoidReasonLabel(reasonCategory),
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      });
      return OutletShiftOrder.fromJson(
          Map<String, dynamic>.from(_data(response.data) as Map));
    } on DioException catch (error) {
      throw StateError(_errorMessage(error, 'Could not void this bill.'));
    }
  }

  Future<OutletShiftOrder> cashierVoidLineItems({
    required String orderId,
    required List<Map<String, dynamic>> items,
    required String reasonCategory,
    String? note,
  }) async {
    try {
      final response = await _dio.post('/pos/voids/cashier/items', data: {
        'order_id': orderId,
        'items': items,
        'reason_category': reasonCategory,
        'reason': (note != null && note.trim().isNotEmpty)
            ? note.trim()
            : cashierVoidReasonLabel(reasonCategory),
        if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
      });
      return OutletShiftOrder.fromJson(
          Map<String, dynamic>.from(_data(response.data) as Map));
    } on DioException catch (error) {
      throw StateError(_errorMessage(error, 'Could not void the selected item(s).'));
    }
  }

  Future<OutletShiftOrder> getOrder({
    required String shiftId,
    required String orderId,
  }) async {
    final response = await _dio.get('/pos/shifts/$shiftId/orders/$orderId');
    return OutletShiftOrder.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  // ── Two-stage item void ────────────────────────────────────────────────────

  /// Item-level void request -- voids a quantity within a single line item
  /// on an open bill, leaving the rest of the bill untouched. Stage 1 requires
  /// cashier acknowledgment; Stage 2 requires manager/accountant approval.
  Future<ItemVoidRequest> requestItemVoid({
    required String shiftId,
    required String orderId,
    required int itemIndex,
    required double qtyToVoid,
    required String reasonCategory,
    String? note,
  }) async {
    final response = await _dio.post('/pos/voids/request', data: {
      'shift_id': shiftId,
      'order_id': orderId,
      'item_index': itemIndex,
      'qty_to_void': qtyToVoid,
      'reason_category': reasonCategory,
      'reason': (note != null && note.trim().isNotEmpty)
          ? note.trim()
          : itemVoidReasonLabel(reasonCategory),
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
    return ItemVoidRequest.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<List<ItemVoidRequest>> getItemVoidRequestsForShift(
      String shiftId) async {
    final response = await _dio.get('/pos/voids/shift/$shiftId');
    return _list(response.data)
        .map(
            (item) => ItemVoidRequest.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  /// Approves the pending request and atomically reduces the bill. Throws a
  /// [StateError] with the server's message (e.g. "Already actioned by
  /// Jane") if another reviewer already actioned it first.
  Future<OutletShiftOrder> approveItemVoid(String requestId) async {
    try {
      final response = await _dio.patch('/pos/voids/$requestId/approve');
      return OutletShiftOrder.fromJson(
          Map<String, dynamic>.from(_data(response.data) as Map));
    } on DioException catch (error) {
      throw StateError(
          _errorMessage(error, 'This void request could not be approved.'));
    }
  }

  Future<ItemVoidRequest> rejectItemVoid(
    String requestId, {
    String? rejectionReason,
  }) async {
    try {
      final response = await _dio.patch('/pos/voids/$requestId/reject', data: {
        if (rejectionReason != null && rejectionReason.trim().isNotEmpty)
          'rejection_reason': rejectionReason.trim(),
      });
      return ItemVoidRequest.fromJson(
          Map<String, dynamic>.from(_data(response.data) as Map));
    } on DioException catch (error) {
      throw StateError(
          _errorMessage(error, 'This void request could not be rejected.'));
    }
  }

  /// Stage 1: cashier acknowledges the void. Returns the updated request and
  /// updated order so the caller can immediately print the void receipt + bill.
  Future<Map<String, dynamic>> cashierAcknowledgeVoid(String requestId) async {
    try {
      final response =
          await _dio.patch('/pos/voids/$requestId/cashier-acknowledge');
      return Map<String, dynamic>.from(_data(response.data) as Map);
    } on DioException catch (error) {
      throw StateError(
          _errorMessage(error, 'Could not acknowledge void request.'));
    }
  }

  /// Stage 1: cashier declines the void. Flow ends here.
  Future<void> cashierDeclineVoid(String requestId) async {
    try {
      await _dio.patch('/pos/voids/$requestId/cashier-decline');
    } on DioException catch (error) {
      throw StateError(_errorMessage(error, 'Could not decline void request.'));
    }
  }

  /// Read-only: item void requests still awaiting kitchen acknowledgment
  /// (status 'pending', scoped to this cashier's own station) — surfaced so
  /// a request that hasn't reached the cashier yet doesn't look stuck or
  /// broken. No action endpoints are gated on this.
  Future<List<ItemVoidRequest>> getAwaitingKitchenItemVoids() async {
    final response = await _dio.get('/pos/voids/pending/kitchen');
    return _list(response.data)
        .map(
            (item) => ItemVoidRequest.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  /// Read-only: whole-bill void requests still awaiting kitchen
  /// acknowledgment. See [getAwaitingKitchenItemVoids].
  Future<List<Map<String, dynamic>>> getAwaitingKitchenWholeBillVoids() async {
    final response = await _dio.get('/pos/void-requests/pending/kitchen');
    return _list(response.data)
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  /// Cashier Stage 1 queue — pending void requests for the caller's open shifts.
  Future<List<ItemVoidRequest>> getPendingVoidsCashier() async {
    if (_powerSync.hotReadsEnabled) {
      final local = await _powerSync.getPendingItemVoidsCashier();
      return local
          .map((item) =>
              ItemVoidRequest.fromJson(Map<String, dynamic>.from(item)))
          .toList();
    }
    final response = await _dio.get('/pos/voids/pending/cashier');
    return _list(response.data)
        .map(
            (item) => ItemVoidRequest.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  /// Manager Stage 2 queue — void_acknowledged requests awaiting approval.
  Future<List<ItemVoidRequest>> getPendingVoidsManager() async {
    final response = await _dio.get('/pos/voids/pending/manager');
    return _list(response.data)
        .map(
            (item) => ItemVoidRequest.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  /// Full void history for accountant audit screen.
  Future<List<ItemVoidRequest>> getVoidHistory({
    String? status,
    String? from,
    String? to,
    String? requestedBy,
    String? cashierId,
  }) async {
    final response = await _dio.get('/pos/voids/history', queryParameters: {
      if (status != null && status.isNotEmpty) 'status': status,
      if (from != null && from.isNotEmpty) 'from': from,
      if (to != null && to.isNotEmpty) 'to': to,
      if (requestedBy != null && requestedBy.isNotEmpty)
        'requested_by': requestedBy,
      if (cashierId != null && cashierId.isNotEmpty) 'cashier_id': cashierId,
    });
    return _list(response.data)
        .map(
            (item) => ItemVoidRequest.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  // ── Post-payment item exchange ──────────────────────────────────────────────

  /// Requests an exchange on a closed/paid bill — old items are returned,
  /// new items take their place. [oldItems] entries are
  /// `{'item_index': int, 'quantity': double}` referencing the original
  /// order's items array; [newItems] reuse [OutletCartItem.toJson] so the
  /// server's normalizeOrderItems can re-validate them against the catalog.
  Future<ItemExchangeRequest> requestItemExchange({
    required String shiftId,
    required String orderId,
    required List<Map<String, dynamic>> oldItems,
    required List<Map<String, dynamic>> newItems,
    String? reason,
  }) async {
    try {
      final response = await _dio.post('/pos/exchanges/request', data: {
        'shift_id': shiftId,
        'order_id': orderId,
        'old_items': oldItems,
        'new_items': newItems,
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      });
      return ItemExchangeRequest.fromJson(
          Map<String, dynamic>.from(_data(response.data) as Map));
    } on DioException catch (error) {
      throw StateError(
          _errorMessage(error, 'This exchange request could not be sent.'));
    }
  }

  /// Cashier queue — pending exchange requests for the caller's open shifts.
  Future<List<ItemExchangeRequest>> getPendingExchangesCashier() async {
    if (_powerSync.hotReadsEnabled) {
      final local = await _powerSync.getPendingExchangesCashier();
      return local
          .map((item) =>
              ItemExchangeRequest.fromJson(Map<String, dynamic>.from(item)))
          .toList();
    }
    final response = await _dio.get('/pos/exchanges/pending/cashier');
    return _list(response.data)
        .map((item) =>
            ItemExchangeRequest.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  /// Approves the exchange — creates the linked replacement order, posts the
  /// stock movement, and notifies the waiter. Returns the new linked order.
  Future<OutletShiftOrder> approveItemExchange(String requestId) async {
    try {
      final response = await _dio.patch('/pos/exchanges/$requestId/approve');
      final data = Map<String, dynamic>.from(_data(response.data) as Map);
      return OutletShiftOrder.fromJson(
          Map<String, dynamic>.from(data['order'] as Map));
    } on DioException catch (error) {
      throw StateError(
          _errorMessage(error, 'This exchange request could not be approved.'));
    }
  }

  Future<ItemExchangeRequest> rejectItemExchange(
    String requestId, {
    String? rejectionReason,
  }) async {
    try {
      final response =
          await _dio.patch('/pos/exchanges/$requestId/reject', data: {
        if (rejectionReason != null && rejectionReason.trim().isNotEmpty)
          'rejection_reason': rejectionReason.trim(),
      });
      return ItemExchangeRequest.fromJson(
          Map<String, dynamic>.from(_data(response.data) as Map));
    } on DioException catch (error) {
      throw StateError(
          _errorMessage(error, 'This exchange request could not be rejected.'));
    }
  }

  /// Marks the cash refund as issued for an approved, refund-direction
  /// exchange. Throws if the exchange isn't approved, doesn't owe a refund,
  /// or has already had one issued.
  Future<ItemExchangeRequest> issueExchangeRefund(String requestId) async {
    try {
      final response =
          await _dio.patch('/pos/exchanges/$requestId/issue-refund');
      return ItemExchangeRequest.fromJson(
          Map<String, dynamic>.from(_data(response.data) as Map));
    } on DioException catch (error) {
      throw StateError(
          _errorMessage(error, 'Could not record the exchange refund.'));
    }
  }

  /// Read-only history for the accountant/manager exchange screen.
  Future<List<ItemExchangeRequest>> getExchangeHistory({
    String? status,
    String? direction,
    String? from,
    String? to,
  }) async {
    final response = await _dio.get('/pos/exchanges/history', queryParameters: {
      if (status != null && status.isNotEmpty) 'status': status,
      if (direction != null && direction.isNotEmpty) 'direction': direction,
      if (from != null && from.isNotEmpty) 'from': from,
      if (to != null && to.isNotEmpty) 'to': to,
    });
    return _list(response.data)
        .map((item) =>
            ItemExchangeRequest.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  String _errorMessage(DioException error, String fallback) {
    final data = error.response?.data;
    return data is Map && data['message'] is String
        ? data['message'] as String
        : fallback;
  }

  /// Checks-and-consumes this order's one allowed duplicate bill print.
  /// Throws a [StateError] with the exact backend message (e.g. "Reprint
  /// limit reached. Only one duplicate bill is allowed.") if the duplicate
  /// has already been used — callers should show that message verbatim
  /// and must NOT print when this throws.
  Future<void> reprintBill({
    required String shiftId,
    required String orderId,
  }) async {
    try {
      await _dio.post('/pos/shifts/$shiftId/orders/$orderId/reprint-bill');
    } on DioException catch (error) {
      final data = error.response?.data;
      final message = data is Map && data['message'] is String
          ? data['message'] as String
          : 'Reprint limit reached. Only one duplicate bill is allowed.';
      throw StateError(message);
    }
  }

  Future<OutletShiftOrder> markOriginalBillPrinted({
    required String shiftId,
    required String orderId,
  }) async {
    try {
      final response = await _dio.post('/pos/shifts/$shiftId/orders/$orderId/original-printed');
      if (response.data != null && response.data['data'] != null) {
        return OutletShiftOrder.fromJson(response.data['data'] as Map<String, dynamic>);
      }
      throw StateError('Empty response from server');
    } on DioException catch (e) {
      final msg = e.response?.data?['message']?.toString() ?? e.message ?? 'Failed to mark original bill as printed';
      throw StateError(msg);
    }
  }

  Future<void> payOrder({
    required String shiftId,
    required String orderId,
    required String paymentMethod,
    double? amount,
    String? reference,
    String? staffCreditBillId,
    Map<String, dynamic>? creditBill,
  }) async {
    await _dio.post('/pos/shifts/$shiftId/orders/$orderId/pay', data: {
      'payment_method': paymentMethod,
      if (amount != null) 'amount': amount,
      if (reference != null && reference.trim().isNotEmpty)
        'reference': reference,
      if (staffCreditBillId != null && staffCreditBillId.trim().isNotEmpty)
        'staff_credit_bill_id': staffCreditBillId,
      if (creditBill != null) 'credit_bill': creditBill,
    });
  }

  Future<List<OutletStockCount>> getStockCount(String shiftId) async {
    if (_powerSync.hotReadsEnabled) {
      final local = await _powerSync.getPosShiftStockCounts(shiftId);
      if (local.isNotEmpty) {
        return local
            .map((item) =>
                OutletStockCount.fromJson(Map<String, dynamic>.from(item)))
            .toList();
      }
    }
    final response = await _dio.get('/pos/shifts/$shiftId/stock-count');
    return _list(response.data)
        .map((item) =>
            OutletStockCount.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<List<OutletStockCount>> updateStockCount(
      String shiftId, List<OutletStockCount> counts) async {
    final response = await _dio.put('/pos/shifts/$shiftId/stock-count', data: {
      'counts': counts.map((count) => count.toJson()).toList(),
    });
    return _list(response.data)
        .map((item) =>
            OutletStockCount.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<OutletShift> closeShift(
    String shiftId, {
    double? closingCashCounted,
    String? varianceReason,
  }) async {
    final response = await _dio.post('/pos/shifts/$shiftId/close', data: {
      if (closingCashCounted != null)
        'closing_cash_counted': closingCashCounted,
      if (varianceReason != null && varianceReason.trim().isNotEmpty)
        'cash_variance_reason': varianceReason.trim(),
    });
    return OutletShift.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<OutletShift> submitShift(String shiftId) async {
    final response = await _dio.post('/pos/shifts/$shiftId/submit');
    return OutletShift.fromJson(
        Map<String, dynamic>.from(_data(response.data) as Map));
  }

  Future<Map<String, dynamic>> getSummary(String shiftId) async {
    final response = await _dio.get('/pos/shifts/$shiftId/summary');
    final data = _data(response.data);
    return data is Map ? Map<String, dynamic>.from(data) : <String, dynamic>{};
  }

  Object? _data(Object? responseData) {
    if (responseData is Map) {
      final data = Map<String, dynamic>.from(responseData);
      return data['data'];
    }
    return null;
  }

  List<dynamic> _list(Object? responseData) {
    final data = _data(responseData);
    return data is List ? data : const [];
  }
}

class PosBootstrapSnapshot {
  const PosBootstrapSnapshot({
    required this.outlets,
    required this.outlet,
    required this.shift,
    required this.items,
    required this.orders,
  });

  final List<PosOutlet> outlets;
  final PosOutlet? outlet;
  final OutletShift? shift;
  final List<OutletPosItem> items;
  final List<OutletShiftOrder> orders;
}

class OutletStaffMember {
  const OutletStaffMember({
    required this.id,
    required this.name,
    this.idNumber,
    this.employeeId,
    this.role,
    this.department,
  });

  final String id;
  final String name;
  final String? idNumber;
  final String? employeeId;
  final String? role;
  final String? department;

  factory OutletStaffMember.fromJson(Map<String, dynamic> json) {
    return OutletStaffMember(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
      idNumber: json['id_number'] as String?,
      employeeId: json['employee_id'] as String?,
      role: json['role'] as String?,
      department: json['department'] as String?,
    );
  }
}

class PosOutlet {
  const PosOutlet({
    required this.id,
    required this.name,
    required this.outletType,
    required this.pinPrefix,
    this.branchId,
  });

  final String id;
  final String name;
  final String outletType;
  final String pinPrefix;
  final int? branchId;

  bool get isFoodOrBar => itemGroup == 'restaurant' || itemGroup == 'bar';

  String get itemGroup {
    final type = outletType.toLowerCase();
    if (type == 'restaurant') return 'restaurant';
    if (type.contains('bar')) return 'bar';
    return 'other';
  }

  String get itemGroupLabel {
    if (itemGroup == 'restaurant') return 'Restaurant';
    if (itemGroup == 'bar') return 'Bar';
    return 'Other';
  }

  factory PosOutlet.fromJson(Map<String, dynamic> json) {
    return PosOutlet(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
      outletType: '${json['outlet_type'] ?? ''}',
      pinPrefix: '${json['pin_prefix'] ?? ''}',
      branchId: _intOrNull(json['branch_id']),
    );
  }
}

class OutletPosItem {
  const OutletPosItem({
    required this.id,
    required this.name,
    required this.category,
    required this.costPrice,
    required this.sellingPrice,
    required this.currentStock,
    required this.unit,
    required this.itemGroup,
    required this.itemGroupLabel,
    required this.outletName,
    required this.outletType,
    this.trackStock = true,
  });

  final String id;
  final String name;
  final String category;
  final double costPrice;
  final double sellingPrice;
  final double currentStock;
  final String unit;
  final String itemGroup;
  final String itemGroupLabel;
  final String outletName;
  final String outletType;
  final bool trackStock;

  factory OutletPosItem.fromJson(
    Map<String, dynamic> json, {
    PosOutlet? fallbackOutlet,
  }) {
    final outlet = json['outlet'];
    final outletMap =
        outlet is Map ? Map<String, dynamic>.from(outlet) : const {};
    final outletType =
        '${json['outlet_type'] ?? outletMap['outlet_type'] ?? fallbackOutlet?.outletType ?? ''}';
    final rawGroup = '${json['item_group'] ?? ''}';
    final itemGroup = rawGroup.trim().isNotEmpty
        ? rawGroup
        : fallbackOutlet?.itemGroup ??
            (outletType == 'restaurant'
                ? 'restaurant'
                : outletType.contains('bar')
                    ? 'bar'
                    : 'other');
    final groupLabel = '${json['item_group_label'] ?? ''}'.trim();
    return OutletPosItem(
      id: '${json['id']}',
      name: '${json['name'] ?? ''}',
      category: _normalisedCategory(_categoryValue(json), itemGroup),
      costPrice: _num(json['cost_price']),
      sellingPrice: _num(json['selling_price']),
      currentStock: _num(json['current_stock']),
      unit: '${json['unit'] ?? 'each'}',
      itemGroup: itemGroup,
      itemGroupLabel: groupLabel.isNotEmpty
          ? groupLabel
          : itemGroup == 'restaurant'
              ? 'Restaurant'
              : itemGroup == 'bar'
                  ? 'Bar'
                  : 'Other',
      outletName:
          '${json['outlet_name'] ?? outletMap['name'] ?? fallbackOutlet?.name ?? ''}',
      outletType: outletType,
      trackStock: json['track_stock'] != false,
    );
  }
}

class OutletShift {
  const OutletShift({
    required this.id,
    required this.outletId,
    required this.status,
    required this.openedAt,
    this.closedAt,
    this.summary = const {},
  });

  final String id;
  final String outletId;
  final String status;
  final DateTime openedAt;
  final DateTime? closedAt;
  final Map<String, dynamic> summary;

  factory OutletShift.fromJson(Map<String, dynamic> json) {
    final summary = json['summary'];
    return OutletShift(
      id: '${json['id']}',
      outletId: '${json['outlet_id'] ?? ''}',
      status: '${json['status'] ?? ''}',
      openedAt: DateTime.tryParse('${json['opened_at']}') ?? DateTime.now(),
      closedAt: DateTime.tryParse('${json['closed_at']}'),
      summary: summary is Map ? Map<String, dynamic>.from(summary) : const {},
    );
  }
}

class OutletCartItem {
  const OutletCartItem({
    required this.item,
    required this.quantity,
    this.notes,
  });

  final OutletPosItem item;
  final int quantity;

  /// Free-form per-line instruction (e.g. "Warm" / "Cold" for drinks) that
  /// rides through to the captain order ticket.
  final String? notes;

  double get lineTotal => item.sellingPrice * quantity;

  OutletCartItem copyWith({int? quantity, String? notes}) {
    return OutletCartItem(
      item: item,
      quantity: quantity ?? this.quantity,
      notes: notes ?? this.notes,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'outlet_item_id': item.id,
      'name': item.name,
      'category': item.category,
      'item_group': item.itemGroup,
      'item_group_label': item.itemGroupLabel,
      'outlet_name': item.outletName,
      'outlet_type': item.outletType,
      'quantity': quantity,
      'unit_price': item.sellingPrice,
      'line_total': lineTotal,
      if (notes != null && notes!.trim().isNotEmpty) 'notes': notes,
    };
  }
}

class OutletShiftOrder {
  const OutletShiftOrder({
    required this.id,
    required this.orderNumber,
    this.shortCode,
    required this.customerName,
    required this.paymentStatus,
    required this.status,
    required this.totalAmount,
    this.orderType,
    this.tableNumber,
    this.roomNumber,
    this.amountPaid = 0,
    this.balanceAmount = 0,
    this.waiterName,
    this.isSplit = false,
    this.isMerged = false,
    this.isExchange = false,
    this.exchangeParentOrderId,
    this.hasActiveExchangeRequest = false,
    this.voidRequestStatus,
    this.createdAt,
    this.items = const [],
    this.billReprintCount = 0,
    this.originalBillPrintedAt,
  });

  final String id;
  final String orderNumber;
  final String? shortCode;
  final String customerName;
  final String paymentStatus;
  final String status;
  final double totalAmount;
  final String? orderType;
  final String? tableNumber;
  final String? roomNumber;
  final double amountPaid;
  final double balanceAmount;
  final String? waiterName;
  final bool isSplit;
  final bool isMerged;
  final bool isExchange;
  final String? exchangeParentOrderId;
  // True once a pending or approved exchange request exists for this bill —
  // an already-exchanged (or in-flight) bill cannot be exchanged again.
  final bool hasActiveExchangeRequest;
  final String? voidRequestStatus;
  final DateTime? createdAt;
  final List<dynamic> items;
  // How many times the explicit "Reprint bill" action has been used for
  // this order's current state. Only one duplicate is allowed, so the
  // reprint action is exhausted once this reaches 1 (server-enforced; this
  // is only used to proactively disable the menu item in the UI).
  final int billReprintCount;
  final DateTime? originalBillPrintedAt;

  bool get canReprintBill => billReprintCount < 1;

  /// The original order time, unless the order has been recalled — then the
  /// time the most recent recall was triggered. The printed bill must show
  /// when the recall actually happened, not the stale original order time.
  DateTime? get effectiveCreatedAt {
    DateTime? latestRecalledAt;
    for (final raw in items) {
      if (raw is! Map) continue;
      if (raw['is_recalled_item'] != true) continue;
      final recalledAt = DateTime.tryParse('${raw['recalled_at'] ?? ''}');
      if (recalledAt == null) continue;
      if (latestRecalledAt == null || recalledAt.isAfter(latestRecalledAt)) {
        latestRecalledAt = recalledAt;
      }
    }
    return latestRecalledAt ?? createdAt;
  }

  /// Items that should be shown on the customer bill — excludes any item that
  /// has void_pending_approval=true (cashier acknowledged, awaiting manager).
  /// Those items are hidden from the customer view until the manager decides.
  List<dynamic> get visibleItems => items
      .whereType<Map>()
      .where((item) => item['void_pending_approval'] != true)
      .toList();

  factory OutletShiftOrder.fromJson(Map<String, dynamic> json) {
    final items = json['items'];
    return OutletShiftOrder(
      id: '${json['id']}',
      orderNumber: '${json['order_number'] ?? ''}',
      shortCode: json['short_code'] as String?,
      customerName: '${json['customer_name'] ?? 'Walk-in'}',
      paymentStatus: '${json['payment_status'] ?? 'unpaid'}',
      status: '${json['status'] ?? 'open'}',
      totalAmount: _num(json['total_amount']),
      orderType: json['order_type'] == null ? null : '${json['order_type']}',
      tableNumber:
          json['table_number'] == null ? null : '${json['table_number']}',
      roomNumber: json['room_number'] == null ? null : '${json['room_number']}',
      amountPaid: _num(json['amount_paid']),
      balanceAmount: _num(json['balance_amount'] ?? json['balance']),
      waiterName: json['waiter_name'] as String?,
      isSplit: json['is_split'] == true,
      isMerged: json['is_merged'] == true,
      isExchange: json['is_exchange'] == true,
      exchangeParentOrderId: json['exchange_parent_order_id'] as String?,
      hasActiveExchangeRequest: json['has_active_exchange_request'] == true,
      voidRequestStatus: json['void_request_status'] as String?,
      createdAt: DateTime.tryParse('${json['created_at'] ?? ''}'),
      items: items is List ? items : const [],
      billReprintCount: json['bill_reprint_count'] is num
          ? (json['bill_reprint_count'] as num).toInt()
          : int.tryParse('${json['bill_reprint_count'] ?? 0}') ?? 0,
      originalBillPrintedAt: json['original_bill_printed_at'] != null
          ? DateTime.tryParse(json['original_bill_printed_at'].toString())
          : null,
    );
  }
}

/// One member order of a consolidated bill, carrying its owning outlet so the
/// combined bill can be shown/printed grouped by outlet.
class BillOrder {
  const BillOrder({
    required this.id,
    required this.orderNumber,
    this.shortCode,
    required this.outletId,
    this.outletName,
    this.outletType,
    required this.shiftId,
    required this.customerName,
    required this.totalAmount,
    required this.balanceAmount,
    required this.paymentStatus,
    this.items = const [],
  });

  final String id;
  final String orderNumber;
  final String? shortCode;
  final String outletId;
  final String? outletName;
  final String? outletType;
  final String shiftId;
  final String customerName;
  final double totalAmount;
  final double balanceAmount;
  final String paymentStatus;
  final List<dynamic> items;

  factory BillOrder.fromJson(Map<String, dynamic> json) {
    final items = json['items'];
    return BillOrder(
      id: '${json['id']}',
      orderNumber: '${json['order_number'] ?? ''}',
      shortCode: json['short_code'] as String?,
      outletId: '${json['outlet_id'] ?? ''}',
      outletName: json['outlet_name'] as String?,
      outletType: json['outlet_type'] as String?,
      shiftId: '${json['shift_id'] ?? ''}',
      customerName: '${json['customer_name'] ?? 'Walk-in'}',
      totalAmount: _num(json['total_amount']),
      balanceAmount: _num(json['balance_amount']),
      paymentStatus: '${json['payment_status'] ?? 'unpaid'}',
      items: items is List ? items : const [],
    );
  }
}

/// A per-outlet sub-bill share of a master bill (outlet name + its amount).
class BillOutletShare {
  const BillOutletShare(
      {this.outletId, this.outletName, required this.amount, this.balance = 0});
  final String? outletId;
  final String? outletName;
  final double amount;
  final double balance;

  factory BillOutletShare.fromJson(Map<String, dynamic> json) =>
      BillOutletShare(
        outletId: json['outlet_id'] as String?,
        outletName: json['outlet_name'] as String?,
        amount: _num(json['amount']),
        balance: _num(json['balance']),
      );
}

/// A master customer bill = one or more [BillOrder]s across outlets grouped
/// under one master_bill_id/number, presented and settled as one bill. A
/// standalone (unlinked) order is represented as a one-outlet bill with a null
/// [masterBillId] (nothing to settle-as-one yet).
class ConsolidatedBill {
  const ConsolidatedBill({
    this.masterBillId,
    this.masterBillNumber,
    this.isMaster = false,
    required this.isConsolidated,
    required this.label,
    required this.customerName,
    this.tableNumber,
    this.originOutletName,
    this.status,
    this.waiterId,
    this.waiterName,
    required this.outlets,
    this.outletBreakdown = const [],
    required this.orderCount,
    required this.totalAmount,
    required this.amountPaid,
    required this.balanceAmount,
    required this.paymentStatus,
    this.createdAt,
    required this.orders,
  });

  /// Null for a standalone (single, unlinked) order.
  final String? masterBillId;
  final String? masterBillNumber;
  final bool isMaster;
  final bool isConsolidated;
  final String label;
  final String customerName;
  final String? tableNumber;
  final String? originOutletName;
  final String? status;
  final String? waiterId;
  final String? waiterName;
  final List<String> outlets;
  final List<BillOutletShare> outletBreakdown;
  final int orderCount;
  final double totalAmount;
  final double amountPaid;
  final double balanceAmount;
  final String paymentStatus;
  final DateTime? createdAt;
  final List<BillOrder> orders;

  bool get isMultiOutlet => outlets.length > 1;
  List<String> get orderIds => orders.map((o) => o.id).toList();

  factory ConsolidatedBill.fromJson(Map<String, dynamic> json) {
    final rawOrders = json['orders'];
    final rawOutlets = json['outlets'];
    final rawBreakdown = json['outlet_breakdown'];
    return ConsolidatedBill(
      masterBillId: json['master_bill_id'] as String?,
      masterBillNumber: json['master_bill_number'] as String?,
      isMaster: json['is_master'] == true,
      isConsolidated: json['is_consolidated'] == true,
      label: '${json['label'] ?? 'Bill'}',
      customerName: '${json['customer_name'] ?? 'Walk-in'}',
      tableNumber:
          json['table_number'] == null ? null : '${json['table_number']}',
      originOutletName: json['origin_outlet_name'] as String?,
      status: json['status'] as String?,
      waiterId: json['waiter_id'] as String?,
      waiterName: json['waiter_name'] as String?,
      outlets: rawOutlets is List
          ? rawOutlets.map((e) => '$e').toList()
          : const [],
      outletBreakdown: rawBreakdown is List
          ? rawBreakdown
              .whereType<Map>()
              .map((e) => BillOutletShare.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
      orderCount: json['order_count'] is num
          ? (json['order_count'] as num).toInt()
          : int.tryParse('${json['order_count'] ?? 0}') ?? 0,
      totalAmount: _num(json['total_amount']),
      amountPaid: _num(json['amount_paid']),
      balanceAmount: _num(json['balance_amount']),
      paymentStatus: '${json['payment_status'] ?? 'unpaid'}',
      createdAt: DateTime.tryParse('${json['created_at'] ?? ''}'),
      orders: rawOrders is List
          ? rawOrders
              .whereType<Map>()
              .map((e) => BillOrder.fromJson(Map<String, dynamic>.from(e)))
              .toList()
          : const [],
    );
  }
}

/// A per-outlet share of a master bill that was collected by ANOTHER outlet's
/// (origin) cashier and awaits THIS outlet cashier's confirmation.
class CrossOutletSettlement {
  const CrossOutletSettlement({
    required this.id,
    this.masterBillId,
    this.masterBillNumber,
    required this.customerName,
    this.tableNumber,
    this.originOutletName,
    this.settlementCashierName,
    this.outletName,
    required this.amount,
    this.paymentMethod,
    required this.status,
    this.disputeReason,
    this.viewerIsCollector = false,
  });

  final String id;
  final String? masterBillId;
  final String? masterBillNumber;
  final String customerName;
  final String? tableNumber;
  final String? originOutletName;
  final String? settlementCashierName;
  final String? outletName;
  final double amount;
  final String? paymentMethod;
  final String status; // settled | cashier_confirmed | disputed
  final String? disputeReason;

  /// True when the viewing cashier is the one who COLLECTED this bill (so they
  /// can resolve a dispute); false for the outlet cashier who confirms/disputes.
  final bool viewerIsCollector;

  bool get isPending => status == 'settled';
  bool get isConfirmed => status == 'cashier_confirmed';
  bool get isDisputed => status == 'disputed';

  factory CrossOutletSettlement.fromJson(Map<String, dynamic> j) =>
      CrossOutletSettlement(
        id: '${j['id']}',
        masterBillId: j['master_bill_id'] as String?,
        masterBillNumber: j['master_bill_number'] as String?,
        customerName: '${j['customer_name'] ?? 'Walk-in'}',
        tableNumber: j['table_number'] == null ? null : '${j['table_number']}',
        originOutletName: j['origin_outlet_name'] as String?,
        settlementCashierName: j['settlement_cashier_name'] as String?,
        outletName: j['outlet_name'] as String?,
        amount: _num(j['amount']),
        paymentMethod: j['payment_method'] as String?,
        status: '${j['status'] ?? 'settled'}',
        disputeReason: j['dispute_reason'] as String?,
        viewerIsCollector: j['viewer_is_collector'] == true,
      );
}

const Map<String, String> itemVoidReasonCategories = {
  'wrong_order': 'Wrong order',
  'duplicate_entry': 'Duplicate entry',
  'customer_changed_mind': 'Customer changed mind',
  'pricing_error': 'Pricing error',
  'other': 'Other',
};

String itemVoidReasonLabel(String category) =>
    itemVoidReasonCategories[category] ?? 'Other';

// Reason dropdown for the Cashier Void Management screen — distinct from the
// legacy itemVoidReasonCategories above (kept for the older request/approve
// pipeline's in-flight records).
const Map<String, String> cashierVoidReasonCategories = {
  'customer_changed_order': 'Customer Changed Order',
  'item_out_of_stock': 'Item Out of Stock',
  'wrong_item_ordered': 'Wrong Item Ordered',
  'duplicate_order': 'Duplicate Order',
  'customer_cancelled': 'Customer Cancelled',
  'quality_issue': 'Quality Issue / Complaint',
  'manager_instruction': 'Manager Instruction',
  'billing_error': 'Billing Error',
  'other': 'Other',
};

String cashierVoidReasonLabel(String category) =>
    cashierVoidReasonCategories[category] ?? 'Other';

class ItemVoidRequest {
  const ItemVoidRequest({
    required this.id,
    required this.shiftId,
    required this.orderId,
    required this.itemIndex,
    required this.itemName,
    required this.unitPrice,
    required this.qtyToVoid,
    required this.qtyBeforeVoid,
    required this.reasonCategory,
    required this.reason,
    required this.status,
    this.orderNumber,
    this.branchId,
    this.note,
    this.requestedBy,
    this.requestedByName,
    this.actionedBy,
    this.actionedByName,
    this.kitchenId,
    this.kitchenName,
    this.kitchenAcknowledgedAt,
    this.kitchenAction,
    this.cashierId,
    this.cashierName,
    this.cashierAcknowledgedAt,
    this.cashierAction,
    this.managerId,
    this.managerName,
    this.managerReviewedAt,
    this.rejectionReason,
    this.createdAt,
  });

  final String id;
  final String shiftId;
  final String orderId;
  final int itemIndex;
  final String itemName;
  final double unitPrice;
  final double qtyToVoid;
  final double qtyBeforeVoid;
  final String reasonCategory;
  final String reason;
  final String status;
  final String? orderNumber;
  final int? branchId;
  final String? note;
  final String? requestedBy;
  final String? requestedByName;
  final String? actionedBy;
  final String? actionedByName;
  // Stage 1: kitchen (KDS)
  final String? kitchenId;
  final String? kitchenName;
  final DateTime? kitchenAcknowledgedAt;
  final String? kitchenAction;
  // Stage 2: cashier
  final String? cashierId;
  final String? cashierName;
  final DateTime? cashierAcknowledgedAt;
  final String? cashierAction;
  // Stage 3: branch accountant / manager
  final String? managerId;
  final String? managerName;
  final DateTime? managerReviewedAt;
  final String? rejectionReason;
  final DateTime? createdAt;

  double get amount => qtyToVoid * unitPrice;
  bool get isPending => status == 'pending';
  bool get isKitchenAcknowledged => status == 'kitchen_acknowledged';
  bool get isKitchenDeclined => status == 'void_kitchen_declined';
  bool get isAcknowledged => status == 'void_acknowledged';
  bool get isCashierDeclined => status == 'void_cashier_declined';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';
  bool get isTerminal =>
      isApproved || isRejected || isCashierDeclined || isKitchenDeclined;

  factory ItemVoidRequest.fromJson(Map<String, dynamic> json) {
    return ItemVoidRequest(
      id: '${json['id']}',
      shiftId: '${json['shift_id'] ?? ''}',
      orderId: '${json['order_id'] ?? ''}',
      itemIndex: json['item_index'] is num
          ? (json['item_index'] as num).toInt()
          : int.tryParse('${json['item_index']}') ?? -1,
      itemName: '${json['item_name'] ?? ''}',
      unitPrice: _num(json['unit_price']),
      qtyToVoid: _num(json['qty_to_void']),
      qtyBeforeVoid: _num(json['qty_before_void']),
      reasonCategory: '${json['reason_category'] ?? 'other'}',
      reason: '${json['reason'] ?? ''}',
      status: '${json['status'] ?? 'pending'}',
      orderNumber: json['order_number'] as String?,
      branchId:
          json['branch_id'] is num ? (json['branch_id'] as num).toInt() : null,
      note: json['note'] as String?,
      requestedBy: json['requested_by'] as String?,
      requestedByName: json['requested_by_name'] as String?,
      actionedBy: json['actioned_by'] as String?,
      actionedByName: json['actioned_by_name'] as String?,
      kitchenId: json['kitchen_id'] as String?,
      kitchenName: json['kitchen_name'] as String?,
      kitchenAcknowledgedAt:
          DateTime.tryParse('${json['kitchen_acknowledged_at'] ?? ''}'),
      kitchenAction: json['kitchen_action'] as String?,
      cashierId: json['cashier_id'] as String?,
      cashierName: json['cashier_name'] as String?,
      cashierAcknowledgedAt:
          DateTime.tryParse('${json['cashier_acknowledged_at'] ?? ''}'),
      cashierAction: json['cashier_action'] as String?,
      managerId: json['manager_id'] as String?,
      managerName: json['manager_name'] as String?,
      managerReviewedAt:
          DateTime.tryParse('${json['manager_reviewed_at'] ?? ''}'),
      rejectionReason: json['rejection_reason'] as String?,
      createdAt: DateTime.tryParse('${json['created_at'] ?? ''}'),
    );
  }
}

class ItemExchangeRequest {
  const ItemExchangeRequest({
    required this.id,
    required this.shiftId,
    required this.orderId,
    required this.oldItems,
    required this.newItems,
    required this.oldTotal,
    required this.newTotal,
    required this.priceDifference,
    required this.direction,
    required this.status,
    this.orderNumber,
    this.branchId,
    this.reason,
    this.requestedBy,
    this.requestedByName,
    this.cashierId,
    this.cashierName,
    this.actionedAt,
    this.rejectionReason,
    this.exchangeOrderId,
    this.refundAmount,
    this.refundIssuedAt,
    this.refundIssuedBy,
    this.refundIssuedByName,
    this.createdAt,
  });

  final String id;
  final String shiftId;
  final String orderId;
  final List<dynamic> oldItems;
  final List<dynamic> newItems;
  final double oldTotal;
  final double newTotal;
  final double priceDifference;
  final String direction;
  final String status;
  final String? orderNumber;
  final int? branchId;
  final String? reason;
  final String? requestedBy;
  final String? requestedByName;
  final String? cashierId;
  final String? cashierName;
  final DateTime? actionedAt;
  final String? rejectionReason;
  final String? exchangeOrderId;
  final double? refundAmount;
  final DateTime? refundIssuedAt;
  final String? refundIssuedBy;
  final String? refundIssuedByName;
  final DateTime? createdAt;

  bool get isPending => status == 'pending';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';
  bool get isTopUp => direction == 'top_up';
  bool get isRefund => direction == 'refund';
  bool get isEven => direction == 'even';
  bool get refundIssued => refundIssuedAt != null;

  factory ItemExchangeRequest.fromJson(Map<String, dynamic> json) {
    final oldItems = json['old_items'];
    final newItems = json['new_items'];
    return ItemExchangeRequest(
      id: '${json['id']}',
      shiftId: '${json['shift_id'] ?? ''}',
      orderId: '${json['order_id'] ?? ''}',
      oldItems: oldItems is List ? oldItems : const [],
      newItems: newItems is List ? newItems : const [],
      oldTotal: _num(json['old_total']),
      newTotal: _num(json['new_total']),
      priceDifference: _num(json['price_difference']),
      direction: '${json['direction'] ?? 'even'}',
      status: '${json['status'] ?? 'pending'}',
      orderNumber: json['order_number'] as String?,
      branchId:
          json['branch_id'] is num ? (json['branch_id'] as num).toInt() : null,
      reason: json['reason'] as String?,
      requestedBy: json['requested_by'] as String?,
      requestedByName: json['requested_by_name'] as String?,
      cashierId: json['cashier_id'] as String?,
      cashierName: json['cashier_name'] as String?,
      actionedAt: DateTime.tryParse('${json['actioned_at'] ?? ''}'),
      rejectionReason: json['rejection_reason'] as String?,
      exchangeOrderId: json['exchange_order_id'] as String?,
      refundAmount:
          json['refund_amount'] == null ? null : _num(json['refund_amount']),
      refundIssuedAt: DateTime.tryParse('${json['refund_issued_at'] ?? ''}'),
      refundIssuedBy: json['refund_issued_by'] as String?,
      refundIssuedByName: json['refund_issued_by_name'] as String?,
      createdAt: DateTime.tryParse('${json['created_at'] ?? ''}'),
    );
  }
}

class OutletStockCount {
  const OutletStockCount({
    required this.id,
    required this.itemName,
    required this.unit,
    required this.openingStock,
    required this.additions,
    required this.soldQuantity,
    required this.systemClosingStock,
    required this.variance,
    this.trackStock = true,
    this.physicalCount,
    this.varianceReason,
  });

  final String id;
  final String itemName;
  final String unit;
  final double openingStock;
  final double additions;
  final double soldQuantity;
  final double systemClosingStock;
  final double? physicalCount;
  final double variance;
  final bool trackStock;
  final String? varianceReason;

  factory OutletStockCount.fromJson(Map<String, dynamic> json) {
    return OutletStockCount(
      id: '${json['id']}',
      itemName: '${json['item_name'] ?? ''}',
      unit: '${json['unit'] ?? 'each'}',
      openingStock: _num(json['opening_stock']),
      additions: _num(json['additions']),
      soldQuantity: _num(json['sold_quantity']),
      systemClosingStock: _num(json['system_closing_stock']),
      physicalCount:
          json['physical_count'] == null ? null : _num(json['physical_count']),
      variance: _num(json['variance']),
      trackStock: json['track_stock'] != false,
      varianceReason: json['variance_reason'] as String?,
    );
  }

  OutletStockCount copyWith({
    double? additions,
    double? soldQuantity,
    double? physicalCount,
    String? varianceReason,
    bool? trackStock,
  }) {
    final newAdditions = additions ?? this.additions;
    final newSold = soldQuantity ?? this.soldQuantity;
    final system = openingStock + newAdditions - newSold;
    final physical = physicalCount ?? this.physicalCount;
    return OutletStockCount(
      id: id,
      itemName: itemName,
      unit: unit,
      openingStock: openingStock,
      additions: newAdditions,
      soldQuantity: newSold,
      systemClosingStock: system,
      physicalCount: physical,
      variance: physical == null ? 0 : physical - system,
      trackStock: trackStock ?? this.trackStock,
      varianceReason: varianceReason ?? this.varianceReason,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'opening_stock': openingStock,
      'additions': additions,
      'sold_quantity': soldQuantity,
      'physical_count': physicalCount,
      'track_stock': trackStock,
      'variance_reason': varianceReason,
    };
  }
}

double _num(Object? value) {
  final parsed = value is num ? value.toDouble() : double.tryParse('$value');
  return parsed ?? 0;
}

int? _intOrNull(Object? value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse('$value');
}

Object? _categoryValue(Map<String, dynamic> json) {
  for (final key in [
    'category_name',
    'categoryName',
    'category_label',
    'categoryLabel',
    'menu_category_name',
    'drink_category_name',
    'category',
  ]) {
    final text = _categoryText(json[key]);
    if (text.isNotEmpty) return text;
  }

  for (final key in [
    'menu_category',
    'drink_category',
    'restaurant_category',
    'bar_category',
  ]) {
    final text = _categoryText(json[key]);
    if (text.isNotEmpty) return text;
  }

  return null;
}

String _categoryText(Object? value) {
  if (value == null) return '';
  if (value is Map) {
    for (final key in ['name', 'category_name', 'label', 'title']) {
      final text = '${value[key] ?? ''}'.trim();
      if (text.isNotEmpty && text != 'null') return text;
    }
    return '';
  }
  final text = '$value'.trim();
  if (text.isEmpty || text == 'null' || text == 'undefined') return '';
  return text;
}

String _normalisedCategory(Object? value, String itemGroup) {
  final category = _categoryText(value);
  if (category.isEmpty) return 'Other';
  final lower = category.toLowerCase();
  final isGenericRestaurant =
      itemGroup == 'restaurant' && lower == 'restaurant';
  final isGenericBar = itemGroup == 'bar' &&
      {
        'bar',
        'main bar',
        'executive bar',
        'kyogong executive bar',
        'kyogong sports bar',
      }.contains(lower);
  if (isGenericRestaurant || isGenericBar) return 'Other';
  return category;
}
