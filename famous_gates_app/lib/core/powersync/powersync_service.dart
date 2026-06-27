import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:powersync/powersync.dart';

import '../config/app_config.dart';
import '../storage/secure_storage_provider.dart';
import '../../features/auth/data/auth_repository.dart';
import 'powersync_connector.dart';
import 'powersync_schema.dart';

final powerSyncServiceProvider = Provider<PowerSyncService>(
  (ref) => PowerSyncService(ref),
);

final powerSyncHotReadsEnabledProvider = Provider<bool>(
  (ref) => ref.read(powerSyncServiceProvider).hotReadsEnabled,
);

class PowerSyncService {
  PowerSyncService(this._ref);

  final Ref _ref;
  final Completer<void> _readyCompleter = Completer<void>();
  PowerSyncDatabase? _database;
  bool _initializing = false;

  bool get enabled =>
      AppConfig.powerSyncEnabled && AppConfig.powerSyncUrl.trim().isNotEmpty;

  bool get hotReadsEnabled => enabled && AppConfig.powerSyncHotReadsEnabled;

  Future<void> ensureReady() async {
    if (!enabled) return;
    if (_readyCompleter.isCompleted) {
      return _readyCompleter.future;
    }
    if (_initializing) {
      return _readyCompleter.future;
    }

    _initializing = true;
    try {
      final directory = await getApplicationSupportDirectory();
      final path = p.join(directory.path, 'famous-gates-powersync.db');
      final database = PowerSyncDatabase(
        schema: powerSyncSchema,
        path: path,
      );
      await database.initialize();
      database.connect(connector: FamousGatesPowerSyncConnector(_ref));
      _database = database;
      if (!_readyCompleter.isCompleted) {
        _readyCompleter.complete();
      }
    } catch (error, stackTrace) {
      debugPrint('PowerSync initialization failed: $error');
      if (!_readyCompleter.isCompleted) {
        _readyCompleter.completeError(error, stackTrace);
      }
      rethrow;
    } finally {
      _initializing = false;
    }
  }

  Future<List<Map<String, dynamic>>> getPosOutlets({
    String? outletType,
    int? branchId,
  }) async {
    return _getAll(
      '''
      SELECT *
      FROM pos_outlets
      WHERE is_active = 1
        ${outletType == null ? '' : 'AND outlet_type = ?'}
        ${branchId == null ? '' : 'AND branch_id = ?'}
      ORDER BY name ASC
      ''',
      [
        if (outletType != null) outletType,
        if (branchId != null) branchId,
      ],
    );
  }

  Future<List<Map<String, dynamic>>> getPosOutletItems(
    String outletId,
  ) async {
    return _getAll(
      '''
      SELECT *
      FROM pos_outlet_items
      WHERE outlet_id = ?
        AND COALESCE(is_active, 1) = 1
      ORDER BY item_group_label ASC, category ASC, name ASC
      ''',
      [outletId],
    );
  }

  Future<Map<String, dynamic>?> getActivePosShift(String outletId) async {
    return _getOptional(
      '''
      SELECT *
      FROM pos_outlet_shifts
      WHERE outlet_id = ?
        AND status = 'open'
      ORDER BY opened_at DESC
      LIMIT 1
      ''',
      [outletId],
    );
  }

  Future<List<Map<String, dynamic>>> getPosShiftOrders(String shiftId) async {
    return _decodeJsonColumns(
      await _getAll(
        '''
        SELECT *
        FROM pos_shift_orders
        WHERE shift_id = ?
        ORDER BY created_at ASC
        ''',
        [shiftId],
      ),
      const ['items'],
    );
  }

  Future<List<Map<String, dynamic>>> getPosShiftStockCounts(
    String shiftId,
  ) async {
    return _getAll(
      '''
      SELECT *
      FROM pos_shift_stock_counts
      WHERE shift_id = ?
      ORDER BY item_name ASC
      ''',
      [shiftId],
    );
  }

  Future<List<Map<String, dynamic>>> getPendingItemVoidsCashier() async {
    final branchId = await _currentBranchId();
    if (branchId == null) return const [];
    return _getAll(
      '''
      SELECT *
      FROM pos_item_void_requests
      WHERE status = 'kitchen_acknowledged'
        AND branch_id = ?
      ORDER BY created_at ASC
      ''',
      [branchId],
    );
  }

  Stream<List<Map<String, dynamic>>> watchPendingItemVoidsCashier() async* {
    final branchId = await _currentBranchId();
    if (branchId == null || !hotReadsEnabled) {
      yield const [];
      return;
    }
    yield* _watchAll(
      '''
      SELECT *
      FROM pos_item_void_requests
      WHERE status = 'kitchen_acknowledged'
        AND branch_id = ?
      ORDER BY created_at ASC
      ''',
      [branchId],
    );
  }

  /// Live stream of unpaid POS orders for the cashier station. Updates
  /// instantly via PowerSync whenever a waiter creates or updates an order.
  Stream<List<Map<String, dynamic>>> watchUnpaidOrders({
    String? search,
    String? date,
    String? outletId,
  }) async* {
    final branchId = await _currentBranchId();
    if (branchId == null || !hotReadsEnabled) {
      yield const [];
      return;
    }

    final conditions = <String>["o.payment_status NOT IN ('paid','voided')", 'o.branch_id = ?'];
    final params = <Object?>[branchId];

    if (outletId != null && outletId.isNotEmpty) {
      conditions.add('o.outlet_id = ?');
      params.add(outletId);
    }

    if (date != null && date.isNotEmpty) {
      conditions.add("date(o.created_at) = date(?)");
      params.add(date);
    }

    if (search != null && search.trim().isNotEmpty) {
      conditions.add(
        "(LOWER(o.order_number) LIKE ? OR LOWER(o.customer_name) LIKE ? OR LOWER(o.table_number) LIKE ?)",
      );
      final pat = '%${search.trim().toLowerCase()}%';
      params.addAll([pat, pat, pat]);
    }

    final where = conditions.join(' AND ');

    yield* _watchAll(
      '''
      SELECT
        o.*,
        p.name   AS outlet_name,
        p.outlet_type AS outlet_type
      FROM pos_shift_orders o
      LEFT JOIN pos_outlets p ON p.id = o.outlet_id
      WHERE $where
      ORDER BY o.created_at DESC
      ''',
      params,
      jsonColumns: const ['items'],
    );
  }

  /// Live running tally for the cashier's shift-clearance screen. Aggregates
  /// totals per payment method and voids directly from local SQLite so the
  /// screen loads instantly without an API round-trip.
  Stream<Map<String, dynamic>> watchCashierShiftTally(String shiftId) async* {
    if (!hotReadsEnabled) {
      yield const {};
      return;
    }
    yield* _watchAll(
      '''
      SELECT
        COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0)   AS total_collected,
        COALESCE(SUM(CASE WHEN payment_status NOT IN ('paid','voided') THEN total_amount ELSE 0 END), 0) AS total_unpaid,
        COUNT(CASE WHEN payment_status = 'paid'   THEN 1 END)                              AS paid_count,
        COUNT(CASE WHEN payment_status NOT IN ('paid','voided') THEN 1 END)                AS unpaid_count,
        COUNT(CASE WHEN payment_status = 'voided' THEN 1 END)                              AS void_count
      FROM pos_shift_orders
      WHERE shift_id = ?
      ''',
      [shiftId],
    ).map((rows) => rows.isNotEmpty ? rows.first : <String, dynamic>{});
  }

  Future<List<Map<String, dynamic>>> getPendingExchangesCashier() async {
    final userId = await _currentUserId();
    if (userId == null || userId.isEmpty) return const [];
    return _decodeJsonColumns(
      await _getAll(
        '''
        SELECT *
        FROM pos_item_exchange_requests
        WHERE status = 'pending'
          AND shift_id IN (
            SELECT id
            FROM pos_outlet_shifts
            WHERE cashier_id = ?
              AND status = 'open'
          )
        ORDER BY created_at ASC
        ''',
        [userId],
      ),
      const ['old_items', 'new_items'],
    );
  }

  Stream<List<Map<String, dynamic>>> watchPendingExchangesCashier() async* {
    final userId = await _currentUserId();
    if (userId == null || userId.isEmpty || !hotReadsEnabled) {
      yield const [];
      return;
    }
    yield* _watchAll(
      '''
      SELECT *
      FROM pos_item_exchange_requests
      WHERE status = 'pending'
        AND shift_id IN (
          SELECT id
          FROM pos_outlet_shifts
          WHERE cashier_id = ?
            AND status = 'open'
        )
      ORDER BY created_at ASC
      ''',
      [userId],
      jsonColumns: const ['old_items', 'new_items'],
    );
  }

  Future<List<Map<String, dynamic>>> getAwaitingRefundExchangesCashier() async {
    final userId = await _currentUserId();
    if (userId == null || userId.isEmpty) return const [];
    return _decodeJsonColumns(
      await _getAll(
        '''
        SELECT *
        FROM pos_item_exchange_requests
        WHERE status = 'approved'
          AND direction = 'refund'
          AND refund_issued_at IS NULL
          AND shift_id IN (
            SELECT id
            FROM pos_outlet_shifts
            WHERE cashier_id = ?
              AND status = 'open'
          )
        ORDER BY created_at ASC
        ''',
        [userId],
      ),
      const ['old_items', 'new_items'],
    );
  }

  Stream<List<Map<String, dynamic>>>
      watchAwaitingRefundExchangesCashier() async* {
    final userId = await _currentUserId();
    if (userId == null || userId.isEmpty || !hotReadsEnabled) {
      yield const [];
      return;
    }
    yield* _watchAll(
      '''
      SELECT *
      FROM pos_item_exchange_requests
      WHERE status = 'approved'
        AND direction = 'refund'
        AND refund_issued_at IS NULL
        AND shift_id IN (
          SELECT id
          FROM pos_outlet_shifts
          WHERE cashier_id = ?
            AND status = 'open'
        )
      ORDER BY created_at ASC
      ''',
      [userId],
      jsonColumns: const ['old_items', 'new_items'],
    );
  }

  Future<List<Map<String, dynamic>>> getBarCaptainOrders() async {
    final branchId = await _currentBranchId();
    if (branchId == null) return const [];
    final lookbackSince = DateTime.now()
        .subtract(const Duration(hours: _captainOrderFeedLookbackHours))
        .toUtc()
        .toIso8601String();
    final rows = _decodeJsonColumns(
      await _getAll(
        '''
        SELECT
          o.*,
          s.branch_id AS shift_branch_id,
          s.status AS shift_status,
          s.opened_at AS shift_opened_at,
          p.name AS outlet_name,
          p.outlet_type AS shift_outlet_type
        FROM pos_shift_orders o
        INNER JOIN pos_outlet_shifts s ON s.id = o.shift_id
        INNER JOIN pos_outlets p ON p.id = s.outlet_id
        WHERE s.branch_id = ?
          AND p.outlet_type IN ('main_bar', 'executive_bar')
          AND (s.status = 'open' OR s.opened_at >= ?)
        ORDER BY o.created_at ASC
        ''',
        [branchId, lookbackSince],
      ),
      const ['items'],
    );
    return rows
        .map(_toCaptainOrderRow)
        .where(
            (row) => _captainOrderActiveStatuses.contains('${row['status']}'))
        .toList();
  }

  Stream<List<Map<String, dynamic>>> watchBarCaptainOrders() async* {
    final branchId = await _currentBranchId();
    if (branchId == null || !hotReadsEnabled) {
      yield const [];
      return;
    }
    final lookbackSince = DateTime.now()
        .subtract(const Duration(hours: _captainOrderFeedLookbackHours))
        .toUtc()
        .toIso8601String();
    yield* _watchAll(
      '''
      SELECT
        o.*,
        s.branch_id AS shift_branch_id,
        s.status AS shift_status,
        s.opened_at AS shift_opened_at,
        p.name AS outlet_name,
        p.outlet_type AS shift_outlet_type
      FROM pos_shift_orders o
      INNER JOIN pos_outlet_shifts s ON s.id = o.shift_id
      INNER JOIN pos_outlets p ON p.id = s.outlet_id
      WHERE s.branch_id = ?
        AND p.outlet_type IN ('main_bar', 'executive_bar')
        AND (s.status = 'open' OR s.opened_at >= ?)
      ORDER BY o.created_at ASC
      ''',
      [branchId, lookbackSince],
      jsonColumns: const ['items'],
      mapper: (rows) => rows
          .map(_toCaptainOrderRow)
          .where(
              (row) => _captainOrderActiveStatuses.contains('${row['status']}'))
          .toList(),
    );
  }

  Future<List<Map<String, dynamic>>> _getAll(
    String sql, [
    List<Object?> parameters = const [],
  ]) async {
    if (!enabled) return const [];
    await ensureReady();
    final database = _database;
    if (database == null) return const [];
    final rows = await database.getAll(sql, parameters);
    return _rowsToMaps(rows);
  }

  /// Public version of [_getAll] for use by external repository classes.
  Future<List<Map<String, dynamic>>> getAll(
    String sql, [
    List<Object?> parameters = const [],
  ]) =>
      _getAll(sql, parameters);

  /// Public version of [_watchAll] for use by external repository classes.
  Stream<List<Map<String, dynamic>>> watchAll(
    String sql, [
    List<Object?> parameters = const [],
  ]) =>
      _watchAll(sql, parameters);

  Future<Map<String, dynamic>?> _getOptional(
    String sql, [
    List<Object?> parameters = const [],
  ]) async {
    final rows = await _getAll(sql, parameters);
    if (rows.isEmpty) return null;
    return rows.first;
  }

  Stream<List<Map<String, dynamic>>> _watchAll(
    String sql,
    List<Object?> parameters, {
    List<String> jsonColumns = const [],
    List<Map<String, dynamic>> Function(List<Map<String, dynamic>> rows)?
        mapper,
  }) async* {
    if (!enabled) {
      yield const [];
      return;
    }
    await ensureReady();
    final database = _database;
    if (database == null) {
      yield const [];
      return;
    }
    yield* database.watch(sql, parameters: parameters).map((rows) {
      final maps = _decodeJsonColumns(_rowsToMaps(rows), jsonColumns);
      return mapper == null ? maps : mapper(maps);
    });
  }

  List<Map<String, dynamic>> _rowsToMaps(dynamic rows) {
    if (rows is! Iterable) return const [];
    return rows
        .whereType<Object>()
        .map((row) => row is Map<String, dynamic>
            ? row
            : row is Map
                ? Map<String, dynamic>.from(row)
                : <String, dynamic>{})
        .where((row) => row.isNotEmpty)
        .toList();
  }

  List<Map<String, dynamic>> _decodeJsonColumns(
    List<Map<String, dynamic>> rows,
    List<String> jsonColumns,
  ) {
    if (jsonColumns.isEmpty) return rows;
    return rows.map((row) {
      final next = Map<String, dynamic>.from(row);
      for (final column in jsonColumns) {
        final raw = next[column];
        if (raw is String && raw.trim().isNotEmpty) {
          try {
            next[column] = jsonDecode(raw);
          } catch (_) {
            // Keep the original text if it isn't valid JSON.
          }
        }
      }
      return next;
    }).toList();
  }

  Future<String?> _currentUserId() {
    return _ref.read(secureStorageProvider).read(key: AuthRepository.userIdKey);
  }

  Future<int?> _currentBranchId() async {
    final raw = await _ref
        .read(secureStorageProvider)
        .read(key: AuthRepository.branchIdKey);
    return int.tryParse(raw ?? '');
  }

  Map<String, dynamic> _toCaptainOrderRow(Map<String, dynamic> row) {
    final items = (row['items'] is List)
        ? List<Map<String, dynamic>>.from(
            (row['items'] as List)
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item)),
          )
        : const <Map<String, dynamic>>[];
    final createdAt = DateTime.tryParse('${row['created_at'] ?? ''}');
    return {
      'id': 'pos:${row['id']}',
      'source': 'pos_shift_order',
      'source_id': row['id'],
      'order_number': row['order_number'],
      'short_code': row['short_code'],
      'branch_id': row['shift_branch_id'] ?? row['branch_id'],
      'outlet_id': row['outlet_id'],
      'outlet_type': row['shift_outlet_type'],
      'outlet_name': row['outlet_name'],
      'shift_id': row['shift_id'],
      'order_type': row['order_type'] ?? 'bar',
      'table_number': row['table_number'],
      'room_number': row['room_number'],
      'waiter_name': row['waiter_name'],
      'customer_name': row['customer_name'] ?? 'Walk-in',
      'status': _captainOrderStatus(
        '${row['kitchen_status'] ?? row['status'] ?? ''}',
      ),
      'order_status': row['status'],
      'payment_status': row['payment_status'],
      'void_request_status': row['void_request_status'],
      'void_reason': row['void_reason'],
      'voided_at': row['voided_at'],
      'voided_by': row['voided_by'],
      'created_at': row['created_at'],
      'elapsed_minutes': createdAt == null
          ? 0
          : DateTime.now().difference(createdAt.toLocal()).inMinutes,
      'items_count': items.length,
      'total': row['total_amount'],
      'total_amount': row['total_amount'],
      'captain_order_already_printed': _captainOrderAlreadyPrinted(
        row['captain_printed_at'],
        items,
      ),
      'items': items.asMap().entries.map((entry) {
        final item = entry.value;
        final itemStatus = _captainOrderStatus(
          '${item['kitchen_status'] ?? item['status'] ?? row['kitchen_status'] ?? row['status'] ?? ''}',
        );
        return {
          'id': '${item['id'] ?? row['id']}:${entry.key}',
          'name': item['name'] ?? item['item_name'] ?? 'Bar item',
          'quantity': _toNum(item['quantity'] ?? item['qty'] ?? 1),
          'unit_price': _toNum(item['unit_price'] ?? item['price'] ?? 0),
          'notes': item['notes'],
          'is_recalled_item': item['is_recalled_item'] == true,
          'recall_batch_id': item['recall_batch_id'],
          'recalled_at': item['recalled_at'],
          'recall_note': item['recall_note'],
          'status': itemStatus,
          'is_ready': itemStatus == 'ready',
        };
      }).toList(),
    };
  }

  bool _captainOrderAlreadyPrinted(
    Object? captainPrintedAt,
    List<Map<String, dynamic>> items,
  ) {
    final printedAt = DateTime.tryParse('${captainPrintedAt ?? ''}');
    if (printedAt == null) return false;
    final recalledMoments = items
        .where((item) => item['is_recalled_item'] == true)
        .map((item) => DateTime.tryParse('${item['recalled_at'] ?? ''}'))
        .whereType<DateTime>()
        .toList();
    if (recalledMoments.isEmpty) return true;
    final latestRecalledAt = recalledMoments.reduce(
      (left, right) => left.isAfter(right) ? left : right,
    );
    return !printedAt.isBefore(latestRecalledAt);
  }

  String _captainOrderStatus(String raw) {
    final value = raw.trim().toLowerCase();
    if (value.isEmpty) return 'pending';
    if (value == 'open') return 'pending';
    if (value == 'served') return 'ready';
    return value;
  }

  double _toNum(Object? value) {
    if (value is num) return value.toDouble();
    return double.tryParse('$value') ?? 0;
  }
}

// Matches CAPTAIN_ORDER_FEED_LOOKBACK_HOURS in
// backend/src/controllers/outlet-pos.controller.ts — keep these in sync so
// hot-reads mode shows the same order history window as the polling fallback.
const _captainOrderFeedLookbackHours = 36;

const _captainOrderActiveStatuses = {
  'pending',
  'preparing',
  'ready',
  'recalled',
  'void_requested',
  'cancelled',
  'voided',
};
