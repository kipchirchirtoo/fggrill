import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../domain/providers.dart';
import '../data/repository.dart';

class FinanceDashboard extends ConsumerWidget {
  const FinanceDashboard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentTab = ref.watch(financeTabProvider);
    return DashboardShell(
      title: 'Finance & Accounting',
      tabs: [
        DashboardTab(
            label: 'Dashboard',
            icon: PhosphorIcons.chartPie(),
            content: _DashboardView()),
        DashboardTab(
            label: 'Invoices',
            icon: PhosphorIcons.fileText(),
            content: _InvoicesView()),
        DashboardTab(
            label: 'Payments',
            icon: PhosphorIcons.creditCard(),
            content: _PaymentsView()),
        DashboardTab(
            label: 'Petty Cash',
            icon: PhosphorIcons.coins(),
            content: _PettyCashView()),
        DashboardTab(
            label: 'Banking',
            icon: PhosphorIcons.bank(),
            content: _BankingView()),
        DashboardTab(
            label: 'Daily Logs',
            icon: PhosphorIcons.calendar(),
            content: _DailyLogsView()),
        DashboardTab(
            label: 'Bookings & Invoices',
            icon: PhosphorIcons.bookOpen(),
            content: _BookingsInvoicesView()),
        DashboardTab(
            label: 'Banking Records',
            icon: PhosphorIcons.arrowsLeftRight(),
            content: _BankingRecordsView()),
        DashboardTab(
            label: 'Shift P&L',
            icon: PhosphorIcons.chartBar(),
            content: _ShiftPnLView()),
        DashboardTab(
            label: 'Credit Bills',
            icon: PhosphorIcons.receipt(),
            content: _CreditBillsView()),
        DashboardTab(
            label: 'Buffet',
            icon: PhosphorIcons.forkKnife(),
            content: _BuffetView()),
        DashboardTab(
            label: 'Catering',
            icon: PhosphorIcons.cookingPot(),
            content: _CateringView()),
        DashboardTab(
            label: 'Petty Cash Entries',
            icon: PhosphorIcons.wallet(),
            content: _PettyCashEntriesView()),
        DashboardTab(
            label: 'Cashier Clearance',
            icon: PhosphorIcons.receipt(),
            content: _CashierClearanceView()),
        DashboardTab(
            label: 'Food Control',
            icon: PhosphorIcons.slidersHorizontal(),
            content: _FoodControlView()),
        DashboardTab(
            label: 'Purchases',
            icon: PhosphorIcons.shoppingCart(),
            content: _PurchasesView()),
      ],
      currentTab: currentTab.index,
      onTabChanged: (i) =>
          ref.read(financeTabProvider.notifier).state = FinanceTab.values[i],
    );
  }
}

// ─────────────────────────────────────────
// TAB: DAILY LOGS
// ─────────────────────────────────────────

class _DailyLogsView extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logs = ref.watch(financeDailyLogsProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Daily Logs',
                  style: Theme.of(context).textTheme.displaySmall),
              ElevatedButton.icon(
                onPressed: () => _showCreateLogDialog(context, ref),
                icon: const Icon(Icons.add),
                label: const Text('New Log'),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Expanded(
            child: logs.when(
              data: (rows) => Card(
                child: rows.isEmpty
                    ? const EmptyState(
                        message: 'No daily logs', icon: Icons.event_note)
                    : ListView.separated(
                        itemCount: rows.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (_, i) {
                          final r = rows[i];
                          final status = (r['status'] ?? '').toString();
                          return ListTile(
                            leading: CircleAvatar(
                                child: Text(((r['date'] ?? '').toString())
                                    .split('-')
                                    .last
                                    .padLeft(2, '0'))),
                            title: Text(
                                'Cash: KES ${(r['cash_sales'] ?? r['cash'] ?? 0).toString()} • Card: KES ${(r['card_sales'] ?? r['card'] ?? 0).toString()}'),
                            subtitle: Text(
                                'Expenses: KES ${(r['expenses'] ?? 0).toString()} • Deposits: KES ${(r['deposits'] ?? 0).toString()}'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _StatusChip(status),
                                const SizedBox(width: 8),
                                if (status != 'approved')
                                  IconButton(
                                    tooltip: 'Approve',
                                    icon: const Icon(Icons.verified,
                                        color: AppColors.kSuccess),
                                    onPressed: () async {
                                      await ref
                                          .read(financeRepositoryProvider)
                                          .updateDailyLogStatus(
                                              '${r['id']}', 'approved');
                                      ref.invalidate(financeDailyLogsProvider);
                                    },
                                  ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(message: '$e'),
            ),
          ),
        ],
      ),
    );
  }

  void _showCreateLogDialog(BuildContext context, WidgetRef ref) {
    final cashCtrl = TextEditingController();
    final cardCtrl = TextEditingController();
    final expensesCtrl = TextEditingController();
    final depositsCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Daily Log'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: cashCtrl,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Cash Sales (KES)')),
              const SizedBox(height: 8),
              TextField(
                  controller: cardCtrl,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Card Sales (KES)')),
              const SizedBox(height: 8),
              TextField(
                  controller: expensesCtrl,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Expenses (KES)')),
              const SizedBox(height: 8),
              TextField(
                  controller: depositsCtrl,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Deposits (KES)')),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(financeRepositoryProvider).createDailyLog({
                'cash_sales': double.tryParse(cashCtrl.text) ?? 0,
                'card_sales': double.tryParse(cardCtrl.text) ?? 0,
                'expenses': double.tryParse(expensesCtrl.text) ?? 0,
                'deposits': double.tryParse(depositsCtrl.text) ?? 0,
              });
              ref.invalidate(financeDailyLogsProvider);
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 1: DASHBOARD
// ─────────────────────────────────────────

class _DashboardView extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final overviewAsync = ref.watch(financeDashboardProvider);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Financial Overview',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 24),
          overviewAsync.when(
            data: (overview) => Column(
              children: [
                Row(
                  children: [
                    _FinanceStatCard(
                      label: 'Revenue',
                      value: 'KES ${_fmt(overview.totalRevenue)}',
                      icon: PhosphorIcons.trendUp(),
                      color: AppColors.kSuccess,
                    ),
                    const SizedBox(width: 16),
                    _FinanceStatCard(
                      label: 'Expenses',
                      value: 'KES ${_fmt(overview.totalExpenses)}',
                      icon: PhosphorIcons.trendDown(),
                      color: AppColors.kError,
                    ),
                    const SizedBox(width: 16),
                    _FinanceStatCard(
                      label: 'Net Profit',
                      value: 'KES ${_fmt(overview.netProfit)}',
                      icon: PhosphorIcons.chartLine(),
                      color: overview.netProfit >= 0
                          ? AppColors.kSuccess
                          : AppColors.kError,
                    ),
                    const SizedBox(width: 16),
                    _FinanceStatCard(
                      label: 'Cash Balance',
                      value: 'KES ${_fmt(overview.cashBalance)}',
                      icon: PhosphorIcons.wallet(),
                      color: AppColors.kPrimary,
                    ),
                  ],
                ),
                const SizedBox(height: 32),
                Row(
                  children: [
                    Expanded(
                      child: _QuickActionCard(
                        title: 'Pending Invoices',
                        value: '${overview.pendingInvoices}',
                        icon: PhosphorIcons.fileText(),
                        onTap: () => ref
                            .read(financeTabProvider.notifier)
                            .state = FinanceTab.invoices,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _QuickActionCard(
                        title: 'Unpaid Bills',
                        value: '${overview.unpaidBills}',
                        icon: PhosphorIcons.fileArrowDown(),
                        onTap: () {},
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _QuickActionCard(
                        title: 'Payments to Verify',
                        value: '--',
                        icon: PhosphorIcons.shieldCheck(),
                        onTap: () => ref
                            .read(financeTabProvider.notifier)
                            .state = FinanceTab.payments,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            loading: () => const Column(
              children: [
                Row(
                  children: [
                    Expanded(child: LoadingSkeleton(type: SkeletonType.card)),
                    SizedBox(width: 16),
                    Expanded(child: LoadingSkeleton(type: SkeletonType.card)),
                    SizedBox(width: 16),
                    Expanded(child: LoadingSkeleton(type: SkeletonType.card)),
                    SizedBox(width: 16),
                    Expanded(child: LoadingSkeleton(type: SkeletonType.card)),
                  ],
                ),
              ],
            ),
            error: (e, _) => ErrorState(message: '$e'),
          ),
        ],
      ),
    );
  }

  String _fmt(double val) {
    if (val >= 1000000) return '${(val / 1000000).toStringAsFixed(1)}M';
    if (val >= 1000) return '${(val / 1000).toStringAsFixed(1)}K';
    return val.toStringAsFixed(0);
  }
}

// ─────────────────────────────────────────
// TAB 2: INVOICES
// ─────────────────────────────────────────

class _InvoicesView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_InvoicesView> createState() => _InvoicesViewState();
}

class _InvoicesViewState extends ConsumerState<_InvoicesView> {
  void _showCreateInvoiceDialog() {
    final customerCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Invoice'),
        content: SizedBox(
          width: 400,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: customerCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Customer Name')),
              const SizedBox(height: 12),
              TextField(
                  controller: amountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Amount (KES)', prefixText: 'KES ')),
              const SizedBox(height: 12),
              TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(labelText: 'Description'),
                  maxLines: 2),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ref.read(financeRepositoryProvider).createInvoice({
                  'customer_name': customerCtrl.text,
                  'amount': double.tryParse(amountCtrl.text) ?? 0,
                  'description': descCtrl.text,
                  'status': 'pending',
                });
                ref.invalidate(invoicesProvider(null));
                if (mounted) {
                  AppNotifier.showSnackBar(context,
                      const SnackBar(content: Text('Invoice created')));
                }
              } catch (e) {
                if (mounted) {
                  AppNotifier.showSnackBar(
                      context,
                      SnackBar(
                          content: Text('Error: $e'),
                          backgroundColor: AppColors.kError));
                }
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final invoicesAsync = ref.watch(invoicesProvider(null));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Invoices', style: Theme.of(context).textTheme.displaySmall),
              ElevatedButton.icon(
                onPressed: _showCreateInvoiceDialog,
                icon: const Icon(Icons.add),
                label: const Text('New Invoice'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: invoicesAsync.when(
              data: (invoices) => Card(
                child: invoices.isEmpty
                    ? const Center(
                        child: Text('No invoices',
                            style: TextStyle(color: AppColors.kTextSecondary)))
                    : ListView.separated(
                        itemCount: invoices.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final inv = invoices[index];
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: inv.status == 'paid'
                                  ? AppColors.kSuccess.withValues(alpha: 0.1)
                                  : AppColors.kWarning.withValues(alpha: 0.1),
                              child: Icon(
                                inv.status == 'paid'
                                    ? Icons.check_circle
                                    : Icons.pending,
                                color: inv.status == 'paid'
                                    ? AppColors.kSuccess
                                    : AppColors.kWarning,
                              ),
                            ),
                            title:
                                Text(inv.invoiceNumber ?? 'Invoice #${inv.id}'),
                            subtitle: Text(inv.customerName ?? ''),
                            trailing: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text('KES ${inv.amount.toStringAsFixed(0)}',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold)),
                                _StatusChip(inv.status),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(message: '$e'),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 3: PAYMENTS VERIFICATION (fully wired)
// ─────────────────────────────────────────

class _PaymentsView extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paymentsAsync = ref.watch(paymentsProvider(null));
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Payments Verification',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 24),
          Expanded(
            child: paymentsAsync.when(
              data: (payments) => Card(
                child: payments.isEmpty
                    ? const EmptyState(
                        message: 'No payments pending verification',
                        icon: Icons.verified_outlined)
                    : ListView.separated(
                        itemCount: payments.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final p = payments[index];
                          final isPending = p.status == 'pending';
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: p.status == 'verified'
                                  ? AppColors.kSuccess.withValues(alpha: 0.1)
                                  : AppColors.kWarning.withValues(alpha: 0.1),
                              child: Icon(
                                p.status == 'verified'
                                    ? Icons.verified
                                    : Icons.pending_actions,
                                color: p.status == 'verified'
                                    ? AppColors.kSuccess
                                    : AppColors.kWarning,
                              ),
                            ),
                            title: Text(p.transactionRef ?? 'Payment #${p.id}'),
                            subtitle: Text(
                              '${p.paymentMethod ?? 'N/A'} • ${p.createdAt != null ? '${p.createdAt!.day}/${p.createdAt!.month}/${p.createdAt!.year}' : '—'}',
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'KES ${p.amount.toStringAsFixed(0)}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(width: 8),
                                _StatusChip(p.status),
                                if (isPending) ...[
                                  const SizedBox(width: 8),
                                  Tooltip(
                                    message: 'Verify',
                                    child: IconButton(
                                      icon: Icon(PhosphorIcons.checkCircle(),
                                          color: AppColors.kSuccess),
                                      onPressed: () async {
                                        try {
                                          await ref
                                              .read(financeRepositoryProvider)
                                              .approvePayment(p.id);
                                          ref.invalidate(
                                              paymentsProvider(null));
                                          if (context.mounted) {
                                            AppNotifier.showSnackBar(
                                              context,
                                              const SnackBar(
                                                  content:
                                                      Text('Payment verified')),
                                            );
                                          }
                                        } catch (e) {
                                          if (context.mounted) {
                                            AppNotifier.showSnackBar(
                                              context,
                                              SnackBar(
                                                  content: Text('Error: $e'),
                                                  backgroundColor:
                                                      AppColors.kError),
                                            );
                                          }
                                        }
                                      },
                                    ),
                                  ),
                                  Tooltip(
                                    message: 'Reject',
                                    child: IconButton(
                                      icon: Icon(PhosphorIcons.xCircle(),
                                          color: AppColors.kError),
                                      onPressed: () async {
                                        try {
                                          await ref
                                              .read(financeRepositoryProvider)
                                              .rejectPayment(p.id);
                                          ref.invalidate(
                                              paymentsProvider(null));
                                          if (context.mounted) {
                                            AppNotifier.showSnackBar(
                                              context,
                                              const SnackBar(
                                                  content:
                                                      Text('Payment rejected')),
                                            );
                                          }
                                        } catch (e) {
                                          if (context.mounted) {
                                            AppNotifier.showSnackBar(
                                              context,
                                              SnackBar(
                                                  content: Text('Error: $e'),
                                                  backgroundColor:
                                                      AppColors.kError),
                                            );
                                          }
                                        }
                                      },
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(paymentsProvider(null))),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 4: PETTY CASH (existing)
// ─────────────────────────────────────────

class _PettyCashView extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pcAsync = ref.watch(pettyCashProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Petty Cash',
                  style: Theme.of(context).textTheme.displaySmall),
              ElevatedButton.icon(
                onPressed: () => _showRequestDialog(context, ref),
                icon: const Icon(Icons.add),
                label: const Text('New Request'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: pcAsync.when(
              data: (transactions) => Card(
                child: transactions.isEmpty
                    ? const Center(
                        child: Text('No transactions',
                            style: TextStyle(color: AppColors.kTextSecondary)))
                    : ListView.separated(
                        itemCount: transactions.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final t = transactions[index];
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: t.status == 'approved'
                                  ? AppColors.kSuccess.withValues(alpha: 0.1)
                                  : t.status == 'rejected'
                                      ? AppColors.kError.withValues(alpha: 0.1)
                                      : AppColors.kWarning
                                          .withValues(alpha: 0.1),
                              child: Icon(
                                t.status == 'approved'
                                    ? Icons.check_circle
                                    : t.status == 'rejected'
                                        ? Icons.cancel
                                        : Icons.pending,
                                color: t.status == 'approved'
                                    ? AppColors.kSuccess
                                    : t.status == 'rejected'
                                        ? AppColors.kError
                                        : AppColors.kWarning,
                              ),
                            ),
                            title: Text(t.description ?? 'Request #${t.id}'),
                            subtitle: Text(
                                '${t.requestedBy ?? ''} • KES ${t.amount.toStringAsFixed(0)}'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _StatusChip(t.status),
                                if (t.status == 'pending') ...[
                                  const SizedBox(width: 4),
                                  IconButton(
                                    icon: const Icon(Icons.check_circle,
                                        color: AppColors.kSuccess, size: 20),
                                    onPressed: () {
                                      ref
                                          .read(financeRepositoryProvider)
                                          .updatePettyCashStatus(
                                              t.id, 'approved');
                                      ref.invalidate(pettyCashProvider);
                                    },
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.cancel,
                                        color: AppColors.kError, size: 20),
                                    onPressed: () {
                                      ref
                                          .read(financeRepositoryProvider)
                                          .updatePettyCashStatus(
                                              t.id, 'rejected');
                                      ref.invalidate(pettyCashProvider);
                                    },
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(message: '$e'),
            ),
          ),
        ],
      ),
    );
  }

  void _showRequestDialog(BuildContext context, WidgetRef ref) {
    final descCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    final purposeCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Petty Cash Request'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: descCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Description *')),
              const SizedBox(height: 12),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Amount (KES) *', prefixText: 'KES '),
              ),
              const SizedBox(height: 12),
              TextField(
                  controller: purposeCtrl,
                  decoration: const InputDecoration(
                      labelText: 'Purpose / Justification'),
                  maxLines: 2),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (descCtrl.text.isEmpty || amountCtrl.text.isEmpty) return;
              final amount = double.tryParse(amountCtrl.text);
              if (amount == null || amount <= 0) return;
              Navigator.pop(ctx);
              try {
                await ref
                    .read(financeRepositoryProvider)
                    .createPettyCashRequest({
                  'description': descCtrl.text,
                  'amount': amount,
                  'purpose': purposeCtrl.text,
                });
                ref.invalidate(pettyCashProvider);
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content: Text('Petty cash request submitted')));
                }
              } catch (e) {
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                      context, SnackBar(content: Text('Error: $e')));
                }
              }
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 5: BANKING (existing — bank accounts)
// ─────────────────────────────────────────

class _BankingView extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accountsAsync = ref.watch(bankAccountsProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Bank Accounts',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 24),
          Expanded(
            child: accountsAsync.when(
              data: (accounts) => Card(
                child: accounts.isEmpty
                    ? const Center(
                        child: Text('No bank accounts',
                            style: TextStyle(color: AppColors.kTextSecondary)))
                    : ListView.separated(
                        itemCount: accounts.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final a = accounts[index];
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor:
                                  AppColors.kPrimary.withValues(alpha: 0.1),
                              child: Icon(PhosphorIcons.bank(),
                                  color: AppColors.kPrimary),
                            ),
                            title: Text(a.accountName ??
                                a.bankName ??
                                'Account #${a.id}'),
                            subtitle: Text(
                                '${a.bankName ?? ''} • ${a.accountNumber ?? ''}'),
                            trailing: Text(
                              'KES ${a.balance.toStringAsFixed(0)}',
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(message: '$e'),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 6: BOOKINGS & INVOICES
// ─────────────────────────────────────────

class _BookingsInvoicesView extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(bookingsInvoicesProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Bookings & Invoices',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 24),
          Expanded(
            child: asyncData.when(
              data: (items) => Card(
                child: items.isEmpty
                    ? const EmptyState(
                        message: 'No booking invoices found',
                        icon: Icons.book_outlined)
                    : ListView.separated(
                        itemCount: items.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final item = items[index];
                          final checkIn = item.checkIn != null
                              ? '${item.checkIn!.day}/${item.checkIn!.month}/${item.checkIn!.year}'
                              : '—';
                          final checkOut = item.checkOut != null
                              ? '${item.checkOut!.day}/${item.checkOut!.month}/${item.checkOut!.year}'
                              : '—';
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor:
                                  AppColors.kPrimary.withValues(alpha: 0.1),
                              child: Icon(PhosphorIcons.bookOpen(),
                                  color: AppColors.kPrimary),
                            ),
                            title: Text(item.guestName ?? 'Guest #${item.id}'),
                            subtitle: Text(
                              'Invoice: ${item.invoiceNumber ?? '—'} • Check-in: $checkIn → $checkOut',
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'KES ${item.amount.toStringAsFixed(0)}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(width: 8),
                                _StatusChip(item.status),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(bookingsInvoicesProvider)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 7: BANKING RECORDS
// ─────────────────────────────────────────

class _BankingRecordsView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_BankingRecordsView> createState() =>
      _BankingRecordsViewState();
}

class _BankingRecordsViewState extends ConsumerState<_BankingRecordsView> {
  void _showRecordDialog() {
    String selectedType = 'Deposit';
    final amountCtrl = TextEditingController();
    final descCtrl = TextEditingController();
    final refCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocalState) => AlertDialog(
          title: const Text('Record Banking Transaction'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  initialValue: selectedType,
                  decoration:
                      const InputDecoration(labelText: 'Transaction Type'),
                  items: const [
                    DropdownMenuItem(value: 'Deposit', child: Text('Deposit')),
                    DropdownMenuItem(
                        value: 'Withdrawal', child: Text('Withdrawal')),
                    DropdownMenuItem(
                        value: 'Transfer', child: Text('Transfer')),
                  ],
                  onChanged: (v) =>
                      setLocalState(() => selectedType = v ?? 'Deposit'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Amount (KES)', prefixText: 'KES '),
                ),
                const SizedBox(height: 12),
                TextField(
                    controller: descCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Description')),
                const SizedBox(height: 12),
                TextField(
                    controller: refCtrl,
                    decoration: const InputDecoration(labelText: 'Reference')),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                final amount = double.tryParse(amountCtrl.text);
                if (amount == null || amount <= 0) return;
                Navigator.pop(ctx);
                try {
                  await ref
                      .read(financeRepositoryProvider)
                      .createBankingRecord({
                    'type': selectedType,
                    'amount': amount,
                    'description': descCtrl.text,
                    'reference': refCtrl.text,
                  });
                  ref.invalidate(bankingRecordsProvider);
                  if (mounted) {
                    AppNotifier.showSnackBar(context,
                        const SnackBar(content: Text('Banking record saved')));
                  }
                } catch (e) {
                  if (mounted) {
                    AppNotifier.showSnackBar(
                      context,
                      SnackBar(
                          content: Text('Error: $e'),
                          backgroundColor: AppColors.kError),
                    );
                  }
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final asyncData = ref.watch(bankingRecordsProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Banking Records',
                  style: Theme.of(context).textTheme.displaySmall),
              ElevatedButton.icon(
                onPressed: _showRecordDialog,
                icon: Icon(PhosphorIcons.plus()),
                label: const Text('Record Banking'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: asyncData.when(
              data: (records) => Card(
                child: records.isEmpty
                    ? const EmptyState(message: 'No banking records found')
                    : ListView.separated(
                        itemCount: records.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final r = records[index];
                          final isDeposit = r.type.toLowerCase() == 'deposit';
                          final typeColor = isDeposit
                              ? AppColors.kSuccess
                              : r.type.toLowerCase() == 'withdrawal'
                                  ? AppColors.kError
                                  : AppColors.kPrimary;
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: typeColor.withValues(alpha: 0.1),
                              child: Icon(
                                isDeposit
                                    ? PhosphorIcons.download()
                                    : PhosphorIcons.upload(),
                                color: typeColor,
                              ),
                            ),
                            title: Text(r.description ??
                                r.reference ??
                                'Record #${r.id}'),
                            subtitle: Text(
                              '${r.date != null ? '${r.date!.day}/${r.date!.month}/${r.date!.year}' : '—'} • Ref: ${r.reference ?? '—'}',
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'KES ${r.amount.toStringAsFixed(0)}',
                                  style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: typeColor),
                                ),
                                const SizedBox(width: 8),
                                _TypeBadge(r.type, typeColor),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(bankingRecordsProvider)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 8: SHIFT P&L
// ─────────────────────────────────────────

class _ShiftPnLView extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(shiftPnLProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Shift P&L', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 24),
          Expanded(
            child: asyncData.when(
              data: (shifts) => Card(
                child: shifts.isEmpty
                    ? const EmptyState(
                        message: 'No shift P&L records found',
                        icon: Icons.bar_chart_outlined)
                    : ListView.separated(
                        itemCount: shifts.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final s = shifts[index];
                          final netColor = s.net >= 0
                              ? AppColors.kSuccess
                              : AppColors.kError;
                          final dateStr = s.shiftDate != null
                              ? '${s.shiftDate!.day}/${s.shiftDate!.month}/${s.shiftDate!.year}'
                              : '—';
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: netColor.withValues(alpha: 0.1),
                              child: Icon(PhosphorIcons.chartBar(),
                                  color: netColor),
                            ),
                            title: Text(s.staffName ?? 'Shift #${s.id}'),
                            subtitle: Text(
                                'Date: $dateStr • Revenue: KES ${s.revenue.toStringAsFixed(0)} | Expenses: KES ${s.expenses.toStringAsFixed(0)}'),
                            trailing: Text(
                              'KES ${s.net.toStringAsFixed(0)}',
                              style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 16,
                                  color: netColor),
                            ),
                            onTap: () => showDialog(
                              context: context,
                              builder: (_) => AlertDialog(
                                title:
                                    Text('Shift P&L — ${s.staffName ?? s.id}'),
                                content: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    _PnLRow('Date', dateStr),
                                    _PnLRow('Staff', s.staffName ?? '—'),
                                    _PnLRow('Revenue',
                                        'KES ${s.revenue.toStringAsFixed(0)}',
                                        color: AppColors.kSuccess),
                                    _PnLRow('Expenses',
                                        'KES ${s.expenses.toStringAsFixed(0)}',
                                        color: AppColors.kError),
                                    const Divider(),
                                    _PnLRow('Net',
                                        'KES ${s.net.toStringAsFixed(0)}',
                                        color: netColor, bold: true),
                                  ],
                                ),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(context),
                                      child: const Text('Close')),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(shiftPnLProvider)),
            ),
          ),
        ],
      ),
    );
  }
}

class _PnLRow extends StatelessWidget {
  final String label;
  final String value;
  final Color? color;
  final bool bold;

  const _PnLRow(this.label, this.value, {this.color, this.bold = false});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: AppColors.kTextSecondary)),
          Text(
            value,
            style: TextStyle(
              fontWeight: bold ? FontWeight.bold : FontWeight.normal,
              color: color ?? AppColors.kTextPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 9: CREDIT BILLS
// ─────────────────────────────────────────

class _CreditBillsView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_CreditBillsView> createState() => _CreditBillsViewState();
}

class _CreditBillsViewState extends ConsumerState<_CreditBillsView> {
  void _showNewCreditBillDialog() {
    final customerCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    final dueDateCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Credit Bill'),
        content: SizedBox(
          width: 400,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: customerCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Customer Name')),
              const SizedBox(height: 12),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Amount (KES)', prefixText: 'KES '),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: dueDateCtrl,
                decoration:
                    const InputDecoration(labelText: 'Due Date (YYYY-MM-DD)'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (customerCtrl.text.isEmpty) return;
              final amount = double.tryParse(amountCtrl.text) ?? 0;
              Navigator.pop(ctx);
              try {
                await ref.read(financeRepositoryProvider).createCreditBill({
                  'customer_name': customerCtrl.text,
                  'amount': amount,
                  'due_date': dueDateCtrl.text,
                  'status': 'pending',
                });
                ref.invalidate(creditBillsProvider);
                if (mounted) {
                  AppNotifier.showSnackBar(context,
                      const SnackBar(content: Text('Credit bill created')));
                }
              } catch (e) {
                if (mounted) {
                  AppNotifier.showSnackBar(
                      context,
                      SnackBar(
                          content: Text('Error: $e'),
                          backgroundColor: AppColors.kError));
                }
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final asyncData = ref.watch(creditBillsProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Credit Bills',
                  style: Theme.of(context).textTheme.displaySmall),
              ElevatedButton.icon(
                onPressed: _showNewCreditBillDialog,
                icon: Icon(PhosphorIcons.plus()),
                label: const Text('New Credit Bill'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: asyncData.when(
              data: (bills) => Card(
                child: bills.isEmpty
                    ? const EmptyState(message: 'No credit bills found')
                    : ListView.separated(
                        itemCount: bills.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final bill = bills[index];
                          final dueDateStr = bill.dueDate != null
                              ? '${bill.dueDate!.day}/${bill.dueDate!.month}/${bill.dueDate!.year}'
                              : '—';
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor:
                                  AppColors.kWarning.withValues(alpha: 0.1),
                              child: Icon(PhosphorIcons.receipt(),
                                  color: AppColors.kWarning),
                            ),
                            title:
                                Text(bill.customerName ?? 'Bill #${bill.id}'),
                            subtitle: Text('Due: $dueDateStr'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                        'KES ${bill.amount.toStringAsFixed(0)}',
                                        style: const TextStyle(
                                            fontWeight: FontWeight.bold)),
                                    _StatusChip(bill.status),
                                  ],
                                ),
                                if (bill.status != 'paid') ...[
                                  const SizedBox(width: 8),
                                  TextButton(
                                    onPressed: () {
                                      AppNotifier.showSnackBar(
                                        context,
                                        SnackBar(
                                            content: Text(
                                                'Marked ${bill.customerName ?? bill.id} as paid')),
                                      );
                                    },
                                    child: const Text('Mark Paid'),
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(creditBillsProvider)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 10: BUFFET
// ─────────────────────────────────────────

class _BuffetView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_BuffetView> createState() => _BuffetViewState();
}

class _BuffetViewState extends ConsumerState<_BuffetView> {
  void _showNewBuffetDialog() {
    final nameCtrl = TextEditingController();
    final dateCtrl = TextEditingController();
    final priceCtrl = TextEditingController();
    final guestsCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Buffet'),
        content: SizedBox(
          width: 400,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Buffet Name')),
              const SizedBox(height: 12),
              TextField(
                  controller: dateCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Date (YYYY-MM-DD)')),
              const SizedBox(height: 12),
              TextField(
                controller: priceCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Price per Head (KES)', prefixText: 'KES '),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: guestsCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Expected Guests'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.isEmpty) return;
              final price = double.tryParse(priceCtrl.text) ?? 0;
              final guests = int.tryParse(guestsCtrl.text) ?? 0;
              Navigator.pop(ctx);
              try {
                await ref.read(financeRepositoryProvider).createBuffet({
                  'name': nameCtrl.text,
                  'date': dateCtrl.text,
                  'price': price,
                  'guest_count': guests,
                  'total': price * guests,
                });
                ref.invalidate(buffetsProvider);
                if (mounted) {
                  AppNotifier.showSnackBar(
                      context, const SnackBar(content: Text('Buffet created')));
                }
              } catch (e) {
                if (mounted) {
                  AppNotifier.showSnackBar(
                      context,
                      SnackBar(
                          content: Text('Error: $e'),
                          backgroundColor: AppColors.kError));
                }
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final asyncData = ref.watch(buffetsProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Buffet', style: Theme.of(context).textTheme.displaySmall),
              ElevatedButton.icon(
                onPressed: _showNewBuffetDialog,
                icon: Icon(PhosphorIcons.plus()),
                label: const Text('New Buffet'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: asyncData.when(
              data: (buffets) => Card(
                child: buffets.isEmpty
                    ? const EmptyState(message: 'No buffets found')
                    : ListView.separated(
                        itemCount: buffets.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final b = buffets[index];
                          final dateStr = b.date != null
                              ? '${b.date!.day}/${b.date!.month}/${b.date!.year}'
                              : '—';
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor:
                                  AppColors.kAccent.withValues(alpha: 0.15),
                              child: Icon(PhosphorIcons.forkKnife(),
                                  color: AppColors.kAccent),
                            ),
                            title: Text(b.name ?? 'Buffet #${b.id}'),
                            subtitle: Text(
                                'Date: $dateStr • Guests: ${b.guestCount} • Price/head: KES ${b.price.toStringAsFixed(0)}'),
                            trailing: Text(
                              'KES ${b.total.toStringAsFixed(0)}',
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 15),
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(buffetsProvider)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 11: CATERING
// ─────────────────────────────────────────

class _CateringView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_CateringView> createState() => _CateringViewState();
}

class _CateringViewState extends ConsumerState<_CateringView> {
  void _showNewCateringDialog() {
    final clientCtrl = TextEditingController();
    final eventDateCtrl = TextEditingController();
    String selectedType = 'Corporate';
    final guestsCtrl = TextEditingController();
    final priceCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocalState) => AlertDialog(
          title: const Text('New Catering Booking'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                    controller: clientCtrl,
                    decoration:
                        const InputDecoration(labelText: 'Client Name')),
                const SizedBox(height: 12),
                TextField(
                    controller: eventDateCtrl,
                    decoration: const InputDecoration(
                        labelText: 'Event Date (YYYY-MM-DD)')),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: selectedType,
                  decoration: const InputDecoration(labelText: 'Event Type'),
                  items: const [
                    DropdownMenuItem(
                        value: 'Corporate', child: Text('Corporate')),
                    DropdownMenuItem(value: 'Wedding', child: Text('Wedding')),
                    DropdownMenuItem(
                        value: 'Birthday', child: Text('Birthday')),
                    DropdownMenuItem(value: 'Other', child: Text('Other')),
                  ],
                  onChanged: (v) =>
                      setLocalState(() => selectedType = v ?? 'Corporate'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: guestsCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Guest Count'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: priceCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                      labelText: 'Per-Head Price (KES)', prefixText: 'KES '),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (clientCtrl.text.isEmpty) return;
                final guests = int.tryParse(guestsCtrl.text) ?? 0;
                final price = double.tryParse(priceCtrl.text) ?? 0;
                Navigator.pop(ctx);
                try {
                  await ref
                      .read(financeRepositoryProvider)
                      .createCateringBooking({
                    'client_name': clientCtrl.text,
                    'event_date': eventDateCtrl.text,
                    'event_type': selectedType,
                    'guest_count': guests,
                    'total': price * guests,
                    'status': 'pending',
                  });
                  ref.invalidate(cateringBookingsProvider);
                  if (mounted) {
                    AppNotifier.showSnackBar(
                        context,
                        const SnackBar(
                            content: Text('Catering booking created')));
                  }
                } catch (e) {
                  if (mounted) {
                    AppNotifier.showSnackBar(
                        context,
                        SnackBar(
                            content: Text('Error: $e'),
                            backgroundColor: AppColors.kError));
                  }
                }
              },
              child: const Text('Book'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final asyncData = ref.watch(cateringBookingsProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Catering', style: Theme.of(context).textTheme.displaySmall),
              ElevatedButton.icon(
                onPressed: _showNewCateringDialog,
                icon: Icon(PhosphorIcons.plus()),
                label: const Text('New Catering'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: asyncData.when(
              data: (bookings) => Card(
                child: bookings.isEmpty
                    ? const EmptyState(message: 'No catering bookings found')
                    : ListView.separated(
                        itemCount: bookings.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final b = bookings[index];
                          final dateStr = b.eventDate != null
                              ? '${b.eventDate!.day}/${b.eventDate!.month}/${b.eventDate!.year}'
                              : '—';
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor:
                                  AppColors.kPrimary.withValues(alpha: 0.1),
                              child: Icon(PhosphorIcons.cookingPot(),
                                  color: AppColors.kPrimary),
                            ),
                            title: Text(b.clientName ?? 'Booking #${b.id}'),
                            subtitle: Text(
                                '${b.eventType ?? '—'} • $dateStr • ${b.guestCount} guests'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text('KES ${b.total.toStringAsFixed(0)}',
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold)),
                                const SizedBox(width: 8),
                                _StatusChip(b.status),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(cateringBookingsProvider)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 12: PETTY CASH ENTRIES
// ─────────────────────────────────────────

class _PettyCashEntriesView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_PettyCashEntriesView> createState() =>
      _PettyCashEntriesViewState();
}

class _PettyCashEntriesViewState extends ConsumerState<_PettyCashEntriesView> {
  void _showNewEntryDialog() {
    final purposeCtrl = TextEditingController();
    final amountCtrl = TextEditingController();
    final approvedByCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Petty Cash Entry'),
        content: SizedBox(
          width: 400,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: purposeCtrl,
                  decoration: const InputDecoration(labelText: 'Purpose')),
              const SizedBox(height: 12),
              TextField(
                controller: amountCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Amount (KES)', prefixText: 'KES '),
              ),
              const SizedBox(height: 12),
              TextField(
                  controller: approvedByCtrl,
                  decoration: const InputDecoration(labelText: 'Approved By')),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (purposeCtrl.text.isEmpty) return;
              final amount = double.tryParse(amountCtrl.text) ?? 0;
              Navigator.pop(ctx);
              try {
                await ref.read(financeRepositoryProvider).createPettyCashEntry({
                  'purpose': purposeCtrl.text,
                  'amount': amount,
                  'approved_by': approvedByCtrl.text,
                });
                ref.invalidate(pettyCashEntriesProvider);
                if (mounted) {
                  AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content: Text('Petty cash entry created')));
                }
              } catch (e) {
                if (mounted) {
                  AppNotifier.showSnackBar(
                      context,
                      SnackBar(
                          content: Text('Error: $e'),
                          backgroundColor: AppColors.kError));
                }
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final asyncData = ref.watch(pettyCashEntriesProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Petty Cash Entries',
                  style: Theme.of(context).textTheme.displaySmall),
              ElevatedButton.icon(
                onPressed: _showNewEntryDialog,
                icon: Icon(PhosphorIcons.plus()),
                label: const Text('New Entry'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: asyncData.when(
              data: (entries) => Card(
                child: entries.isEmpty
                    ? const EmptyState(message: 'No petty cash entries found')
                    : ListView.separated(
                        itemCount: entries.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final e = entries[index];
                          final dateStr = e.date != null
                              ? '${e.date!.day}/${e.date!.month}/${e.date!.year}'
                              : '—';
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor:
                                  AppColors.kPrimary.withValues(alpha: 0.1),
                              child: Icon(PhosphorIcons.wallet(),
                                  color: AppColors.kPrimary),
                            ),
                            title: Text(e.purpose ?? 'Entry #${e.id}'),
                            subtitle: Text(
                                'Approved by: ${e.approvedBy ?? '—'} • $dateStr'),
                            trailing: Text(
                              'KES ${e.amount.toStringAsFixed(0)}',
                              style:
                                  const TextStyle(fontWeight: FontWeight.bold),
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(pettyCashEntriesProvider)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 13: CASHIER CLEARANCE
// ─────────────────────────────────────────

class _CashierClearanceView extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncData = ref.watch(cashierClearancesProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Cashier Clearance',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 24),
          Expanded(
            child: asyncData.when(
              data: (clearances) => Card(
                child: clearances.isEmpty
                    ? const EmptyState(message: 'No cashier clearances found')
                    : ListView.separated(
                        itemCount: clearances.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final c = clearances[index];
                          final varianceColor = c.variance != 0
                              ? AppColors.kError
                              : AppColors.kSuccess;
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor:
                                  AppColors.kPrimary.withValues(alpha: 0.1),
                              child: Icon(PhosphorIcons.receipt(),
                                  color: AppColors.kPrimary),
                            ),
                            title: Text(c.cashierName ?? 'Cashier #${c.id}'),
                            subtitle: Text(
                              'Shift: ${c.shift ?? '—'} • Opening: KES ${c.openingBalance.toStringAsFixed(0)} | Closing: KES ${c.closingBalance.toStringAsFixed(0)}',
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      'Variance: KES ${c.variance.toStringAsFixed(0)}',
                                      style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          color: varianceColor),
                                    ),
                                    _StatusChip(c.status),
                                  ],
                                ),
                                if (c.status == 'pending') ...[
                                  const SizedBox(width: 8),
                                  TextButton(
                                    onPressed: () async {
                                      try {
                                        await ref
                                            .read(financeRepositoryProvider)
                                            .approveCashierClearance(c.id);
                                        ref.invalidate(
                                            cashierClearancesProvider);
                                        if (context.mounted) {
                                          AppNotifier.showSnackBar(
                                            context,
                                            SnackBar(
                                                content: Text(
                                                    'Clearance for ${c.cashierName ?? c.id} approved')),
                                          );
                                        }
                                      } catch (e) {
                                        if (context.mounted) {
                                          AppNotifier.showSnackBar(
                                            context,
                                            SnackBar(
                                                content: Text('Error: $e'),
                                                backgroundColor:
                                                    AppColors.kError),
                                          );
                                        }
                                      }
                                    },
                                    child: const Text('Approve'),
                                  ),
                                ],
                              ],
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(cashierClearancesProvider)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// TAB 14: FOOD CONTROL
// ─────────────────────────────────────────

class _FoodControlView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_FoodControlView> createState() => _FoodControlViewState();
}

class _FoodControlViewState extends ConsumerState<_FoodControlView> {
  final Map<String, TextEditingController> _controllers = {};
  bool _isDirty = false;

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final asyncData = ref.watch(foodControlConfigProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Food Control Config',
                  style: Theme.of(context).textTheme.displaySmall),
              if (_isDirty)
                ElevatedButton.icon(
                  onPressed: () async {
                    final data =
                        _controllers.map((k, c) => MapEntry(k, c.text));
                    try {
                      await ref
                          .read(financeRepositoryProvider)
                          .updateFoodControlConfig(data);
                      ref.invalidate(foodControlConfigProvider);
                      if (!context.mounted) return;
                      setState(() => _isDirty = false);
                      AppNotifier.showSnackBar(
                          context,
                          const SnackBar(
                              content: Text('Food control config updated')));
                    } catch (e) {
                      if (!context.mounted) return;
                      AppNotifier.showSnackBar(
                          context,
                          SnackBar(
                              content: Text('Error: $e'),
                              backgroundColor: AppColors.kError));
                    }
                  },
                  icon: Icon(PhosphorIcons.cloudArrowUp()),
                  label: const Text('Update Config'),
                ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: asyncData.when(
              data: (config) {
                // Sync controllers with the config on first load
                for (final entry in config.entries) {
                  if (!_controllers.containsKey(entry.key)) {
                    _controllers[entry.key] =
                        TextEditingController(text: '${entry.value}');
                  }
                }
                if (config.isEmpty) {
                  return const EmptyState(
                      message: 'No food control configuration found');
                }
                return Card(
                  child: ListView(
                    padding: const EdgeInsets.all(16),
                    children: config.entries.map((entry) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: TextField(
                          controller: _controllers[entry.key],
                          decoration: InputDecoration(
                            labelText: _formatKey(entry.key),
                            border: const OutlineInputBorder(),
                          ),
                          onChanged: (_) => setState(() => _isDirty = true),
                        ),
                      );
                    }).toList(),
                  ),
                );
              },
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(foodControlConfigProvider)),
            ),
          ),
        ],
      ),
    );
  }

  String _formatKey(String key) {
    return key
        .replaceAll('_', ' ')
        .split(' ')
        .map(
            (w) => w.isNotEmpty ? '${w[0].toUpperCase()}${w.substring(1)}' : '')
        .join(' ');
  }
}

// ─────────────────────────────────────────
// TAB 15: PURCHASES
// ─────────────────────────────────────────

class _PurchasesView extends ConsumerStatefulWidget {
  @override
  ConsumerState<_PurchasesView> createState() => _PurchasesViewState();
}

class _PurchasesViewState extends ConsumerState<_PurchasesView> {
  void _showNewPurchaseDialog() {
    final descCtrl = TextEditingController();
    final qtyCtrl = TextEditingController();
    final unitCtrl = TextEditingController();
    final costCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('New Purchase Request'),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: descCtrl,
                  decoration: const InputDecoration(labelText: 'Description')),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: qtyCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Quantity'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: unitCtrl,
                      decoration:
                          const InputDecoration(labelText: 'Unit (kg, pcs...)'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: costCtrl,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Estimated Cost (KES)', prefixText: 'KES '),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (descCtrl.text.isEmpty) return;
              final qty = int.tryParse(qtyCtrl.text) ?? 1;
              final cost = double.tryParse(costCtrl.text) ?? 0;
              Navigator.pop(ctx);
              try {
                await ref.read(financeRepositoryProvider).createPurchase({
                  'description': descCtrl.text,
                  'quantity': qty,
                  'unit': unitCtrl.text,
                  'estimated_cost': cost,
                  'status': 'pending',
                });
                ref.invalidate(purchasesProvider);
                if (mounted) {
                  AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content: Text('Purchase request submitted')));
                }
              } catch (e) {
                if (mounted) {
                  AppNotifier.showSnackBar(
                      context,
                      SnackBar(
                          content: Text('Error: $e'),
                          backgroundColor: AppColors.kError));
                }
              }
            },
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final asyncData = ref.watch(purchasesProvider);
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Purchases',
                  style: Theme.of(context).textTheme.displaySmall),
              ElevatedButton.icon(
                onPressed: _showNewPurchaseDialog,
                icon: Icon(PhosphorIcons.plus()),
                label: const Text('New Purchase Request'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Expanded(
            child: asyncData.when(
              data: (purchases) => Card(
                child: purchases.isEmpty
                    ? const EmptyState(message: 'No purchase requests found')
                    : ListView.separated(
                        itemCount: purchases.length,
                        separatorBuilder: (_, __) => const Divider(),
                        itemBuilder: (context, index) {
                          final p = purchases[index];
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor:
                                  AppColors.kPrimary.withValues(alpha: 0.1),
                              child: Icon(PhosphorIcons.shoppingCart(),
                                  color: AppColors.kPrimary),
                            ),
                            title: Text(p.description ?? 'Purchase #${p.id}'),
                            subtitle: Text(
                              'Supplier: ${p.supplier ?? '—'} • Qty: ${p.quantity} ${p.unit ?? ''}',
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      'KES ${p.estimatedCost.toStringAsFixed(0)}',
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold),
                                    ),
                                    _StatusChip(p.status),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              loading: () =>
                  const Card(child: LoadingSkeleton(type: SkeletonType.list)),
              error: (e, _) => ErrorState(
                  message: '$e',
                  onRetry: () => ref.invalidate(purchasesProvider)),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────
// SHARED WIDGETS
// ─────────────────────────────────────────

class _FinanceStatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _FinanceStatCard(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 16),
              Text(value,
                  style: TextStyle(
                      fontSize: 20, fontWeight: FontWeight.bold, color: color)),
              Text(label,
                  style: const TextStyle(
                      color: AppColors.kTextSecondary, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}

class _QuickActionCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final VoidCallback onTap;

  const _QuickActionCard(
      {required this.title,
      required this.value,
      required this.icon,
      required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, color: AppColors.kPrimary, size: 24),
                  const Spacer(),
                  const Icon(Icons.chevron_right,
                      color: AppColors.kTextSecondary, size: 20),
                ],
              ),
              const SizedBox(height: 20),
              Text(value,
                  style: const TextStyle(
                      fontSize: 28, fontWeight: FontWeight.bold)),
              Text(title,
                  style: const TextStyle(
                      color: AppColors.kTextSecondary, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  const _StatusChip(this.status);

  @override
  Widget build(BuildContext context) {
    final color = status == 'paid' ||
            status == 'approved' ||
            status == 'verified' ||
            status == 'completed'
        ? AppColors.kSuccess
        : status == 'rejected' || status == 'cancelled'
            ? AppColors.kError
            : AppColors.kWarning;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(status.toUpperCase(),
          style: TextStyle(
              fontSize: 10, fontWeight: FontWeight.bold, color: color)),
    );
  }
}

class _TypeBadge extends StatelessWidget {
  final String type;
  final Color color;
  const _TypeBadge(this.type, this.color);

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(type.toUpperCase(),
          style: TextStyle(
              fontSize: 10, fontWeight: FontWeight.bold, color: color)),
    );
  }
}
