import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../pos/data/outlet_pos_repository.dart';
import '../data/cashier_repository.dart';

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

final cashierUnpaidBillsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, CashierBillFilters>((ref, filters) {
  return ref.watch(cashierRepositoryProvider).getUnpaidBills(
        status: filters.status,
        billType: filters.billType,
        search: filters.search,
        date: filters.date,
      );
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
  final shifts =
      await ref.watch(cashierRepositoryProvider).getShifts(status: 'open');
  return shifts.isNotEmpty ? shifts.first : <String, dynamic>{};
});

/// Item-level void requests awaiting this cashier's acknowledgement
/// (stage 1 of the two-stage void flow). Whole-bill voids are not included --
/// those go straight to the branch accountant and never hit this queue.
final cashierPendingItemVoidsProvider =
    FutureProvider.autoDispose<List<ItemVoidRequest>>((ref) {
  return ref.watch(outletPosRepositoryProvider).getPendingVoidsCashier();
});

/// Post-payment exchange requests awaiting this cashier's approve/reject
/// decision -- single-stage, cashier-only (see outlet_pos_repository.dart's
/// ItemExchangeRequest for why this doesn't go through REVIEW_ROLES like the
/// void flows do).
final cashierPendingExchangesProvider =
    FutureProvider.autoDispose<List<ItemExchangeRequest>>((ref) {
  return ref.watch(outletPosRepositoryProvider).getPendingExchangesCashier();
});

/// Approved refund-direction exchanges that haven't had the cash refund
/// issued yet. There's no dedicated "pending refund" endpoint -- this reuses
/// exchange history (which the cashier role is already allowed to read) and
/// filters client-side, since the set is always small (one branch's open
/// shifts) and history is the only place an approved exchange still lives
/// once it drops out of the pending queue.
final cashierAwaitingRefundExchangesProvider =
    FutureProvider.autoDispose<List<ItemExchangeRequest>>((ref) async {
  final rows = await ref
      .watch(outletPosRepositoryProvider)
      .getExchangeHistory(status: 'approved', direction: 'refund');
  return rows.where((r) => !r.refundIssued).toList();
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
