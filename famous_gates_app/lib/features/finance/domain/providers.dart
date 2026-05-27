import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/repository.dart';
import 'models.dart';

final financeDashboardProvider = FutureProvider<FinanceOverview>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getDashboard();
});

final invoicesProvider =
    FutureProvider.family<List<Invoice>, String?>((ref, status) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getInvoices(status: status);
});

final billsProvider =
    FutureProvider.family<List<Bill>, String?>((ref, status) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getBills(status: status);
});

final paymentsProvider =
    FutureProvider.family<List<PaymentVerification>, String?>(
        (ref, status) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getPayments(status: status);
});

final pettyCashProvider =
    FutureProvider<List<PettyCashTransaction>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getPettyCashTransactions();
});

final bankAccountsProvider = FutureProvider<List<BankAccount>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getBankAccounts();
});

final bankingRecordsProvider = FutureProvider<List<BankingRecord>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getBankingRecords();
});

final financeDailyLogsProvider =
    FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getDailyLogs();
});

final shiftPnLProvider = FutureProvider<List<ShiftPnL>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getShiftPnL();
});

final creditBillsProvider = FutureProvider<List<CreditBill>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getCreditBills();
});

final buffetsProvider = FutureProvider<List<Buffet>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getBuffets();
});

final cateringBookingsProvider =
    FutureProvider<List<CateringBooking>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getCateringBookings();
});

final pettyCashEntriesProvider =
    FutureProvider<List<PettyCashEntry>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getPettyCashEntries();
});

final cashierClearancesProvider =
    FutureProvider<List<CashierClearance>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getCashierClearances();
});

final purchasesProvider = FutureProvider<List<Purchase>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getPurchases();
});

final bookingsInvoicesProvider =
    FutureProvider<List<BookingInvoice>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getBookingsInvoices();
});

final foodControlConfigProvider =
    FutureProvider<Map<String, dynamic>>((ref) async {
  final repo = ref.read(financeRepositoryProvider);
  return repo.getFoodControlConfig();
});

enum FinanceTab {
  dashboard,
  invoices,
  payments,
  pettyCash,
  banking,
  bookingsInvoices,
  bankingRecords,
  shiftPnL,
  creditBills,
  buffet,
  catering,
  pettyCashEntries,
  cashierClearance,
  foodControl,
  purchases,
}

final financeTabProvider =
    StateProvider<FinanceTab>((ref) => FinanceTab.dashboard);
