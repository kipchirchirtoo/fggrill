import 'package:flutter_riverpod/flutter_riverpod.dart';

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

final cashierCreditBillsProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, CashierBillFilters>((ref, filters) {
  return ref.watch(cashierRepositoryProvider).getCreditBills(
        status: filters.status,
        billType: filters.billType,
        search: filters.search,
        date: filters.date,
      );
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

final cashierInsightsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  // Scope Python insights to the current shift's branch so the analysis
  // reflects this cashier's branch rather than the whole estate.
  final shift = await ref.watch(cashierCurrentShiftProvider.future);
  final branchId = (shift['branch_id'] as num?)?.toInt();
  return ref.watch(cashierRepositoryProvider).getPosInsights(branchId: branchId);
});
