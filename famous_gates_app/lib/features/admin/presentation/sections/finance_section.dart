import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/services/finance_service.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../widgets/admin_table.dart';

enum _FinanceTab {
  pnl,
  revenue,
  expenses,
  budgets,
  banking,
  dailyLogs,
  creditBills
}

final _financeDataProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  final finance = ref.read(financeServiceProvider);
  final now = DateTime.now();
  final startOfYear =
      DateTime(now.year, 1, 1).toIso8601String().split('T').first;
  final today = now.toIso8601String().split('T').first;

  final responses = await Future.wait<Map<String, dynamic>>([
    _safeFinanceCall(
        finance.getFinanceOverview(startDate: startOfYear, endDate: today)),
    _safeFinanceCall(
        finance.getProfitLoss(startDate: startOfYear, endDate: today)),
    _safeFinanceCall(
        finance.getExpenses(startDate: startOfYear, endDate: today)),
    _safeFinanceCall(finance.getBudgets(year: now.year.toString())),
    _safeFinanceCall(finance.getDailyLogs()),
    _safeFinanceCall(finance.getCreditBills(limit: 100)),
  ]);

  final overview = _asMap(responses[0]['data']);
  final pnl = _asMap(responses[1]['data']);
  final expenses = _asList(responses[2]['data']);
  final budgets = _asList(responses[3]['data']);
  final logs = _asList(responses[4]['data']);
  final creditBills = _asList(responses[5]['data']);

  final breakdown = _asMap(overview['breakdown']);
  final revenueBySource = _asMap(pnl['revenueBySource']);
  final expensesByCategory = _asMap(pnl['expensesByCategory']);

  return {
    'overview': overview,
    'pnl': pnl,
    'monthly_profit': _monthlyProfitFromLogs(logs, overview),
    'revenue_by_outlet': _revenueRows(breakdown, revenueBySource),
    'expenses': _expenseRows(expenses, expensesByCategory),
    'budgets': _budgetRows(budgets),
    'banking': _bankingRows(logs),
    'daily_logs': logs.map(_dailyLogRow).toList(),
    'credit_bills': creditBills.map(_creditBillRow).toList(),
  };
});

Future<Map<String, dynamic>> _safeFinanceCall(
    Future<Map<String, dynamic>> request) async {
  try {
    return await request;
  } catch (_) {
    return const {'success': false, 'data': null};
  }
}

Map<String, dynamic> _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return <String, dynamic>{};
}

List<dynamic> _asList(dynamic value) {
  if (value is List) return value;
  if (value is Map && value['data'] is List) return value['data'] as List;
  return const [];
}

double _num(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}

String _date(dynamic value) {
  if (value == null) return '';
  final text = value.toString();
  return text.length >= 10 ? text.substring(0, 10) : text;
}

List<Map<String, dynamic>> _monthlyProfitFromLogs(
    List<dynamic> logs, Map<String, dynamic> overview) {
  final totals = <String, double>{};
  for (final item in logs) {
    final log = _asMap(item);
    final date = DateTime.tryParse(_date(log['log_date'] ?? log['date']));
    if (date == null) continue;
    final label = _monthLabel(date.month);
    final profit = _num(log['net_profit']) != 0
        ? _num(log['net_profit'])
        : _num(log['total_payments']) - _num(log['total_expenses']);
    totals[label] = (totals[label] ?? 0) + profit;
  }
  if (totals.isEmpty) {
    return [
      {
        'month': _monthLabel(DateTime.now().month),
        'profit': _num(overview['netProfit'] ?? overview['net_profit']),
      }
    ];
  }
  return totals.entries
      .map((e) => {'month': e.key, 'profit': e.value})
      .toList();
}

String _monthLabel(int month) => const [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ][month - 1];

List<Map<String, dynamic>> _revenueRows(
    Map<String, dynamic> breakdown, Map<String, dynamic> revenueBySource) {
  final source = revenueBySource.isNotEmpty ? revenueBySource : breakdown;
  return source.entries
      .where((entry) => _num(entry.value) != 0)
      .map((entry) => {
            'outlet': entry.key.toString().replaceAll('_', ' '),
            'revenue': _num(entry.value),
          })
      .toList();
}

List<Map<String, dynamic>> _expenseRows(
    List<dynamic> expenses, Map<String, dynamic> expensesByCategory) {
  if (expensesByCategory.isNotEmpty) {
    return expensesByCategory.entries
        .map((entry) => {
              'category': entry.key,
              'budget': 0.0,
              'actual': _num(entry.value),
              'variance': 0.0,
            })
        .toList();
  }
  return expenses.map((item) {
    final expense = _asMap(item);
    return {
      'category': expense['category'] ?? expense['description'] ?? 'Expense',
      'budget': _num(expense['budget'] ?? expense['allocated_amount']),
      'actual': _num(expense['amount'] ?? expense['actual']),
      'variance': 0.0,
    };
  }).toList();
}

List<Map<String, dynamic>> _budgetRows(List<dynamic> budgets) =>
    budgets.map((item) {
      final budget = _asMap(item);
      final allocated = _num(budget['allocated_amount'] ?? budget['allocated']);
      final spent = _num(budget['spent_amount'] ?? budget['spent']);
      return {
        'department': _asMap(budget['department'])['name'] ??
            budget['department_name'] ??
            budget['category'] ??
            'Budget',
        'allocated': allocated,
        'spent': spent,
        'remaining': allocated - spent,
      };
    }).toList();

List<Map<String, dynamic>> _bankingRows(List<dynamic> logs) => logs.map((item) {
      final log = _asMap(item);
      return {
        'bank_name': _asMap(log['banking_data'])['account'] ?? 'Daily banking',
        'account_number': _asMap(log['banking_data'])['reference'] ?? '—',
        'account_type': 'Deposit',
        'balance': _num(log['closing_balance'] ?? log['total_payments']),
        'status': log['status'] ?? 'pending',
      };
    }).toList();

Map<String, dynamic> _dailyLogRow(dynamic item) {
  final log = _asMap(item);
  return {
    'date': _date(log['log_date'] ?? log['date']),
    'cash_sales': _num(log['cash_sales'] ?? log['cash_total']),
    'card_sales': _num(log['card_sales'] ?? log['card_total']),
    'expenses': _num(log['total_expenses']),
    'deposits': _num(log['closing_balance'] ?? log['total_payments']),
    'reconciled': ['verified', 'approved', 'reconciled']
        .contains('${log['status']}'.toLowerCase()),
  };
}

Map<String, dynamic> _creditBillRow(dynamic item) {
  final bill = _asMap(item);
  final staff = _asMap(bill['staff']);
  final staffName = [staff['first_name'], staff['last_name']]
      .where((v) => (v ?? '').toString().trim().isNotEmpty)
      .join(' ');
  return {
    'id': bill['id'],
    'bill_number': bill['bill_number'] ?? bill['id'] ?? '',
    'guest': staffName.isNotEmpty
        ? staffName
        : (bill['description'] ?? 'Credit bill'),
    'amount': _num(bill['balance'] ?? bill['amount']),
    'date': _date(bill['bill_date'] ?? bill['created_at']),
    'due_date': _date(bill['due_date']),
    'status': bill['status'] ?? 'pending',
  };
}

class FinanceSection extends ConsumerStatefulWidget {
  const FinanceSection({super.key});

  @override
  ConsumerState<FinanceSection> createState() => _FinanceSectionState();
}

class _FinanceSectionState extends ConsumerState<FinanceSection> {
  _FinanceTab _currentTab = _FinanceTab.pnl;
  DateTime? _logDate;

  @override
  Widget build(BuildContext context) {
    final dataAsync = ref.watch(_financeDataProvider);

    return Column(
      children: [
        _SubTabBar(
          tabs: _FinanceTab.values,
          selected: _currentTab,
          onChanged: (tab) => setState(() => _currentTab = tab),
        ),
        Expanded(
          child: dataAsync.when(
            loading: () => const TabbedSkeleton(tabCount: 7),
            error: (e, _) => ErrorState(
              message: '$e',
              onRetry: () => ref.invalidate(_financeDataProvider),
            ),
            data: (data) => _buildContent(data),
          ),
        ),
      ],
    );
  }

  Widget _buildContent(Map<String, dynamic> data) {
    switch (_currentTab) {
      case _FinanceTab.pnl:
        return _PnLTab(data: data);
      case _FinanceTab.revenue:
        return _RevenueTab(data: data);
      case _FinanceTab.expenses:
        return _ExpensesTab(data: data);
      case _FinanceTab.budgets:
        return _BudgetsTab(data: data);
      case _FinanceTab.banking:
        return _BankingTab(data: data);
      case _FinanceTab.dailyLogs:
        return _DailyLogsTab(
            data: data,
            selectedDate: _logDate,
            onDateChanged: (d) => setState(() => _logDate = d));
      case _FinanceTab.creditBills:
        return _CreditBillsTab(data: data);
    }
  }
}

class _SubTabBar extends StatelessWidget {
  final List<_FinanceTab> tabs;
  final _FinanceTab selected;
  final ValueChanged<_FinanceTab> onChanged;

  const _SubTabBar(
      {required this.tabs, required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      color: Colors.white,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 24),
        itemCount: tabs.length,
        separatorBuilder: (_, __) => const SizedBox(width: 4),
        itemBuilder: (context, index) {
          final tab = tabs[index];
          final label = tab == _FinanceTab.pnl
              ? 'P&L'
              : tab == _FinanceTab.dailyLogs
                  ? 'Daily Logs'
                  : tab == _FinanceTab.creditBills
                      ? 'Credit Bills'
                      : tab.name.split('.').last;
          final isSelected = tab == selected;
          return GestureDetector(
            onTap: () => onChanged(tab),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              margin: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.kPrimary : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color:
                        isSelected ? AppColors.kPrimary : AppColors.kDivider),
              ),
              child: Center(
                child: Text(
                  label[0].toUpperCase() + label.substring(1),
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight:
                        isSelected ? FontWeight.w600 : FontWeight.normal,
                    color: isSelected ? Colors.white : AppColors.kTextSecondary,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _PnLTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _PnLTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final months = _asList(data['monthly_profit']);
    final maxAbs = months
        .map((m) => _num(_asMap(m)['profit']).abs())
        .fold<double>(0, (max, value) => value > max ? value : max);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Profit & Loss',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 8),
          const Text('Monthly profit/loss overview',
              style: TextStyle(color: AppColors.kTextSecondary)),
          const SizedBox(height: 24),
          SizedBox(
            height: 360,
            child: Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                    color: AppColors.kDivider.withValues(alpha: 0.5)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (months.isEmpty)
                      Expanded(
                        child: Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(PhosphorIcons.chartBar(),
                                  size: 42, color: Colors.grey.shade300),
                              const SizedBox(height: 10),
                              Text('No P&L records found',
                                  style:
                                      TextStyle(color: Colors.grey.shade500)),
                            ],
                          ),
                        ),
                      )
                    else
                      Expanded(
                        child: LayoutBuilder(
                          builder: (context, constraints) {
                            final barMaxHeight =
                                (constraints.maxHeight - 48).clamp(80.0, 220.0);
                            return Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: List.generate(months.length, (i) {
                                final m = _asMap(months[i]);
                                final profit = _num(m['profit']);
                                final isPositive = profit >= 0;
                                final height = maxAbs > 0
                                    ? ((profit.abs() / maxAbs) * barMaxHeight)
                                        .clamp(4.0, barMaxHeight)
                                    : 4.0;
                                return Expanded(
                                  child: Padding(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 4),
                                    child: Column(
                                      mainAxisAlignment: MainAxisAlignment.end,
                                      children: [
                                        FittedBox(
                                          child: Text(
                                            'KES ${(profit / 1000).toStringAsFixed(0)}k',
                                            style: TextStyle(
                                                fontSize: 10,
                                                color: isPositive
                                                    ? AppColors.kSuccess
                                                    : AppColors.kError),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Container(
                                          width: 28,
                                          height: height,
                                          decoration: BoxDecoration(
                                            color: isPositive
                                                ? AppColors.kSuccess
                                                : AppColors.kError,
                                            borderRadius:
                                                BorderRadius.circular(4),
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text('${m['month'] ?? ''}',
                                            style: const TextStyle(
                                                fontSize: 10,
                                                color:
                                                    AppColors.kTextSecondary)),
                                      ],
                                    ),
                                  ),
                                );
                              }),
                            );
                          },
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _RevenueTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _RevenueTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final outlets = _asList(data['revenue_by_outlet']);
    final total =
        outlets.fold(0.0, (sum, o) => sum + _num(_asMap(o)['revenue']));

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Revenue by Outlet',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 8),
          Text('Total: KES ${total.toStringAsFixed(0)}',
              style: const TextStyle(
                  color: AppColors.kAccent, fontWeight: FontWeight.bold)),
          const SizedBox(height: 24),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: outlets.map((o) {
              final outlet = _asMap(o);
              final rev = _num(outlet['revenue']);
              final pct = total > 0 ? rev / total : 0.0;
              return SizedBox(
                width: 260,
                child: Card(
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(
                        color: AppColors.kDivider.withValues(alpha: 0.5)),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      children: [
                        Icon(PhosphorIcons.chartPie(),
                            color: AppColors.kPrimary, size: 32),
                        const SizedBox(height: 12),
                        Text('${outlet['outlet']}',
                            style:
                                const TextStyle(fontWeight: FontWeight.w600)),
                        const SizedBox(height: 4),
                        Text('KES ${rev.toStringAsFixed(0)}',
                            style: const TextStyle(
                                color: AppColors.kAccent,
                                fontWeight: FontWeight.bold)),
                        Text('${(pct * 100).toStringAsFixed(1)}%',
                            style: const TextStyle(
                                color: AppColors.kTextSecondary, fontSize: 12)),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _ExpensesTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _ExpensesTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final expenses = _asList(data['expenses']);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Expenses', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          AdminTable(
            columns: const ['Category', 'Budget', 'Actual', 'Variance %'],
            rows: expenses.map((e) {
              final exp = _asMap(e);
              final variance = _num(exp['variance']);
              final isOver = variance > 0;
              return [
                Text('${exp['category']}',
                    style: const TextStyle(fontWeight: FontWeight.w500)),
                Text('KES ${_num(exp['budget']).toStringAsFixed(0)}'),
                Text('KES ${_num(exp['actual']).toStringAsFixed(0)}'),
                Row(
                  children: [
                    Icon(
                        isOver
                            ? PhosphorIcons.trendUp()
                            : PhosphorIcons.trendDown(),
                        size: 14,
                        color: isOver ? AppColors.kError : AppColors.kSuccess),
                    const SizedBox(width: 4),
                    Text('${(variance * 100).toStringAsFixed(1)}%',
                        style: TextStyle(
                            color:
                                isOver ? AppColors.kError : AppColors.kSuccess,
                            fontWeight: FontWeight.w500)),
                  ],
                ),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _BudgetsTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _BudgetsTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final budgets = _asList(data['budgets']);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Budgets', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'Department',
              'Allocated',
              'Spent',
              'Remaining',
              'Progress'
            ],
            rows: budgets.map((b) {
              final budget = _asMap(b);
              final allocated = _num(budget['allocated']);
              final spent = _num(budget['spent']);
              final remaining = _num(budget['remaining']);
              final pct = allocated > 0 ? spent / allocated : 0.0;
              return [
                Text('${budget['department']}',
                    style: const TextStyle(fontWeight: FontWeight.w500)),
                Text('KES ${allocated.toStringAsFixed(0)}'),
                Text('KES ${spent.toStringAsFixed(0)}'),
                Text('KES ${remaining.toStringAsFixed(0)}',
                    style: TextStyle(
                        color: remaining < 0
                            ? AppColors.kError
                            : AppColors.kSuccess)),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: pct,
                    backgroundColor: AppColors.kDivider,
                    valueColor: AlwaysStoppedAnimation(
                        pct > 0.9 ? AppColors.kError : AppColors.kSuccess),
                    minHeight: 8,
                  ),
                ),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _BankingTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _BankingTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final accounts = _asList(data['banking']);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Bank Accounts',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'Bank Name',
              'Account#',
              'Type',
              'Balance',
              'Status'
            ],
            rows: accounts.map((a) {
              final account = _asMap(a);
              return [
                Text('${account['bank_name']}',
                    style: const TextStyle(fontWeight: FontWeight.w500)),
                Text('${account['account_number']}'),
                Text('${account['account_type']}'),
                Text('KES ${_num(account['balance']).toStringAsFixed(0)}',
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                StatusBadge(status: '${account['status']}'),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _DailyLogsTab extends StatelessWidget {
  final Map<String, dynamic> data;
  final DateTime? selectedDate;
  final ValueChanged<DateTime?> onDateChanged;

  const _DailyLogsTab({
    required this.data,
    required this.selectedDate,
    required this.onDateChanged,
  });

  @override
  Widget build(BuildContext context) {
    final logs = _asList(data['daily_logs']);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Daily Logs',
                  style: Theme.of(context).textTheme.displaySmall),
              const Spacer(),
              GestureDetector(
                onTap: () async {
                  final picked = await showDatePicker(
                      context: context,
                      initialDate: selectedDate ?? DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now());
                  if (picked != null) onDateChanged(picked);
                },
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    border: Border.all(color: AppColors.kDivider),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(PhosphorIcons.calendarBlank(),
                          size: 16, color: AppColors.kTextSecondary),
                      const SizedBox(width: 8),
                      Text(
                          selectedDate != null
                              ? '${selectedDate!.day}/${selectedDate!.month}/${selectedDate!.year}'
                              : 'Select Date',
                          style: const TextStyle(fontSize: 13)),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'Date',
              'Cash Sales',
              'Card Sales',
              'Expenses',
              'Deposits',
              'Reconciled'
            ],
            rows: logs.map((l) {
              final log = _asMap(l);
              final reconciled = log['reconciled'] == true;
              return [
                Text('${log['date'] ?? ''}'),
                Text('KES ${_num(log['cash_sales']).toStringAsFixed(0)}'),
                Text('KES ${_num(log['card_sales']).toStringAsFixed(0)}'),
                Text('KES ${_num(log['expenses']).toStringAsFixed(0)}'),
                Text('KES ${_num(log['deposits']).toStringAsFixed(0)}'),
                StatusBadge(status: reconciled ? 'reconciled' : 'pending'),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _CreditBillsTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _CreditBillsTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final bills = _asList(data['credit_bills']);
    final totalOutstanding = bills.fold(0.0, (sum, b) {
      final bill = _asMap(b);
      return '${bill['status']}' != 'paid' ? sum + _num(bill['amount']) : sum;
    });

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Credit Bills',
                  style: Theme.of(context).textTheme.displaySmall),
              const Spacer(),
              Text('Outstanding: KES ${totalOutstanding.toStringAsFixed(0)}',
                  style: const TextStyle(
                      color: AppColors.kError,
                      fontWeight: FontWeight.bold,
                      fontSize: 16)),
            ],
          ),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'Guest',
              'Amount',
              'Date',
              'Due Date',
              'Status',
              'Actions'
            ],
            rows: bills.map((b) {
              final bill = _asMap(b);
              final status = '${bill['status']}';
              return [
                Text('${bill['guest']}',
                    style: const TextStyle(fontWeight: FontWeight.w500)),
                Text('KES ${_num(bill['amount']).toStringAsFixed(0)}'),
                Text('${bill['date'] ?? ''}'),
                Text('${bill['due_date'] ?? ''}'),
                StatusBadge(status: status),
                if (status != 'paid')
                  SizedBox(
                    height: 28,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          minimumSize: Size.zero),
                      onPressed: () async {
                        final confirm = await showDialog<bool>(
                          context: context,
                          builder: (ctx) => AlertDialog(
                            title: const Text('Mark as Paid'),
                            content: Text(
                                'Mark bill ${bill['bill_number']} as paid?'),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.pop(ctx, false),
                                  child: const Text('Cancel')),
                              ElevatedButton(
                                  onPressed: () => Navigator.pop(ctx, true),
                                  child: const Text('Mark Paid')),
                            ],
                          ),
                        );
                        if (confirm == true && context.mounted) {
                          AppNotifier.showSnackBar(
                              context,
                              SnackBar(
                                  content: Text(
                                      'Bill ${bill['bill_number']} marked as paid')));
                        }
                      },
                      child: const Text('Mark Paid',
                          style: TextStyle(fontSize: 11)),
                    ),
                  )
                else
                  const SizedBox.shrink(),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}
