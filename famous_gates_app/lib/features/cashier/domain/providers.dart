import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/powersync/powersync_service.dart';
import '../../pos/data/outlet_pos_repository.dart';
import '../data/cashier_repository.dart';

bool _sameCashierRows(
  List<Map<String, dynamic>> a,
  List<Map<String, dynamic>> b,
) {
  if (identical(a, b)) return true;
  if (a.length != b.length) return false;
  for (var i = 0; i < a.length; i++) {
    final left = a[i];
    final right = b[i];
    if ('${left['id']}' != '${right['id']}') return false;
    if ('${left['source']}' != '${right['source']}') return false;
    if ('${left['status'] ?? left['payment_status']}' !=
        '${right['status'] ?? right['payment_status']}') {
      return false;
    }
    if ('${left['balance_amount'] ?? left['balance']}' !=
        '${right['balance_amount'] ?? right['balance']}') {
      return false;
    }
  }
  return true;
}

class CashierBillFilters {
  const CashierBillFilters({
    this.status = 'all',
    this.billType = 'all',
    this.search = '',
    this.date,
  });

  final String status;
  final String billType;
  final String search;
  final String? date;

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CashierBillFilters &&
            other.status == status &&
            other.billType == billType &&
            other.search == search &&
            other.date == date;
  }

  @override
  int get hashCode => Object.hash(status, billType, search, date);
}

class CashierShiftFilters {
  const CashierShiftFilters({
    this.status = 'all',
    this.from,
    this.to,
  });

  final String status;
  final String? from;
  final String? to;

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        other is CashierShiftFilters &&
            other.status == status &&
            other.from == from &&
            other.to == to;
  }

  @override
  int get hashCode => Object.hash(status, from, to);
}

final cashierStatsProvider = FutureProvider.autoDispose<Map<String, dynamic>>(
  (ref) => ref.watch(cashierRepositoryProvider).getStats(),
);

/// Streams unpaid POS orders for the cashier station. When PowerSync hot-reads
/// are enabled this updates in real-time without any manual refresh. Falls back
/// to a polling REST fetch every 30 s so captain orders appear automatically.
final cashierUnpaidBillsProvider = StreamProvider.autoDispose
    .family<List<Map<String, dynamic>>, CashierBillFilters>((ref, filters) async* {
  final powerSync = ref.watch(powerSyncServiceProvider);
  if (powerSync.hotReadsEnabled) {
    yield* powerSync.watchUnpaidOrders(
      search: filters.search.isEmpty ? null : filters.search,
      date: filters.date,
    );
    return;
  }
  // Fallback: poll every 30 s so new captain orders surface without a manual
  // pull-to-refresh. autoDispose cancels the loop when the screen closes.
  final repo = ref.watch(cashierRepositoryProvider);
  var cancelled = false;
  ref.onDispose(() => cancelled = true);
  while (!cancelled) {
    try {
      final results = await Future.wait([
        repo.getUnpaidOrdersOnly(
          status: filters.status,
          search: filters.search,
          date: filters.date,
        ),
        repo.getUnpaidBills(
          status: filters.status,
          billType: filters.billType,
          search: filters.search,
          date: filters.date,
        ),
      ]);
      final quickRows = results[0];
      final rows = results[1];
      if (_sameCashierRows(quickRows, rows)) {
        yield rows;
      } else {
        yield rows.isNotEmpty ? rows : quickRows;
      }
    } catch (_) {}
    if (!cancelled) await Future.delayed(const Duration(seconds: 30));
  }
});

final cashierVoidedOrdersProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, CashierBillFilters>((ref, filters) {
  return ref.watch(cashierRepositoryProvider).getVoidedOrders(
        search: filters.search,
      );
});

final cashierCreditBillsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, CashierBillFilters>((ref, filters) {
  return ref.watch(cashierRepositoryProvider).getCreditBills(
        status: filters.status,
        billType: filters.billType,
        search: filters.search,
        date: filters.date,
      );
});

final cashierPaidBillsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(cashierRepositoryProvider).getPaidBills();
});

final cashierShiftsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, CashierShiftFilters>((ref, filters) {
  return ref.watch(cashierRepositoryProvider).getShifts(
        status: filters.status,
        from: filters.from,
        to: filters.to,
      );
});

final cashierReconciliationProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.watch(cashierRepositoryProvider).getPOSReconciliation();
});

final cashierPOSItemsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) {
  return ref.watch(cashierRepositoryProvider).getPOSItems();
});

/// The cashier's own currently open shift (with live payment breakdown).
final cashierCurrentShiftProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final stats = await ref.watch(cashierRepositoryProvider).getStats();
  final data = stats['data'];
  if (data is Map) {
    final activeShift = data['activeShift'];
    if (activeShift is Map) {
      return Map<String, dynamic>.from(activeShift);
    }
  }
  return <String, dynamic>{};
});

/// Live aggregated tally for the active shift. Reads directly from the local
/// PowerSync SQLite database so the clearance screen loads instantly.
/// Falls back to an empty map when the shift ID is unknown or hot-reads off.
final cashierShiftTallyProvider =
    StreamProvider.autoDispose<Map<String, dynamic>>((ref) async* {
  final powerSync = ref.watch(powerSyncServiceProvider);
  if (!powerSync.hotReadsEnabled) {
    yield const {};
    return;
  }
  final shift = await ref.watch(cashierCurrentShiftProvider.future);
  final shiftId = '${shift['id'] ?? ''}';
  if (shiftId.isEmpty) {
    yield const {};
    return;
  }
  yield* powerSync.watchCashierShiftTally(shiftId);
});

/// Item-level void requests awaiting this cashier's acknowledgement
/// (stage 2 of the kitchen -> cashier -> branch accountant chain — kitchen
/// must acknowledge first).
final cashierPendingItemVoidsProvider =
    StreamProvider.autoDispose<List<ItemVoidRequest>>((ref) async* {
  final powerSync = ref.watch(powerSyncServiceProvider);
  if (powerSync.hotReadsEnabled) {
    yield* powerSync.watchPendingItemVoidsCashier().map(
          (rows) => rows
              .map((item) =>
                  ItemVoidRequest.fromJson(Map<String, dynamic>.from(item)))
              .toList(),
        );
    return;
  }
  yield await ref.watch(outletPosRepositoryProvider).getPendingVoidsCashier();
});

/// Whole-bill void requests awaiting this cashier's acknowledgement (stage 2
/// of the kitchen -> cashier -> branch accountant chain). Acknowledging here
/// applies the real financial effect (stock, kitchen consumption, inventory,
/// shift totals) so the cashier's own shift close already reflects the void.
final cashierPendingWholeBillVoidsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref
      .watch(outletPosRepositoryProvider)
      .getPendingVoidsCashierWholeBill();
});

/// Read-only: item void requests still awaiting kitchen (stage 1) for this
/// cashier's own station — so "nothing in my queue" reads as "kitchen
/// hasn't acted yet" rather than "voiding is broken."
final cashierAwaitingKitchenItemVoidsProvider =
    FutureProvider.autoDispose<List<ItemVoidRequest>>((ref) async {
  return ref.watch(outletPosRepositoryProvider).getAwaitingKitchenItemVoids();
});

/// Read-only: whole-bill void requests still awaiting kitchen (stage 1).
final cashierAwaitingKitchenWholeBillVoidsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref
      .watch(outletPosRepositoryProvider)
      .getAwaitingKitchenWholeBillVoids();
});

/// Post-payment exchange requests awaiting this cashier's approve/reject
/// decision -- single-stage, cashier-only (see outlet_pos_repository.dart's
/// ItemExchangeRequest for why this doesn't go through REVIEW_ROLES like the
/// void flows do).
final cashierPendingExchangesProvider =
    StreamProvider.autoDispose<List<ItemExchangeRequest>>((ref) async* {
  final powerSync = ref.watch(powerSyncServiceProvider);
  if (powerSync.hotReadsEnabled) {
    yield* powerSync.watchPendingExchangesCashier().map(
          (rows) => rows
              .map((item) =>
                  ItemExchangeRequest.fromJson(Map<String, dynamic>.from(item)))
              .toList(),
        );
    return;
  }
  yield await ref
      .watch(outletPosRepositoryProvider)
      .getPendingExchangesCashier();
});

/// Approved refund-direction exchanges that haven't had the cash refund
/// issued yet. There's no dedicated "pending refund" endpoint -- this reuses
/// exchange history (which the cashier role is already allowed to read) and
/// filters client-side, since the set is always small (one branch's open
/// shifts) and history is the only place an approved exchange still lives
/// once it drops out of the pending queue.
final cashierAwaitingRefundExchangesProvider =
    StreamProvider.autoDispose<List<ItemExchangeRequest>>((ref) async* {
  final powerSync = ref.watch(powerSyncServiceProvider);
  if (powerSync.hotReadsEnabled) {
    yield* powerSync.watchAwaitingRefundExchangesCashier().map(
          (rows) => rows
              .map((item) =>
                  ItemExchangeRequest.fromJson(Map<String, dynamic>.from(item)))
              .toList(),
        );
    return;
  }
  final rows = await ref
      .watch(outletPosRepositoryProvider)
      .getExchangeHistory(status: 'approved', direction: 'refund');
  yield rows.where((r) => !r.refundIssued).toList();
});

final cashierInsightsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  // Scope Python insights to the current shift's branch so the analysis
  // reflects this cashier's branch rather than the whole estate.
  final shift = await ref.watch(cashierCurrentShiftProvider.future);
  final branchId = (shift['branch_id'] as num?)?.toInt();
  return ref
      .watch(cashierRepositoryProvider)
      .getPosInsights(branchId: branchId);
});
final corporateCustomersCashierProvider = FutureProvider<List<Map<String, dynamic>>>((ref) {
  return ref.watch(cashierRepositoryProvider).getCorporateCustomers();
});
