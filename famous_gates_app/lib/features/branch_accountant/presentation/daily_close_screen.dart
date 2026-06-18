import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../data/repository.dart';

final _fmt = NumberFormat('#,##0.00', 'en_KE');
String _fmtN(dynamic v) =>
    _fmt.format(double.tryParse(v?.toString() ?? '0') ?? 0);

double _dbl(dynamic v) => double.tryParse(v?.toString() ?? '0') ?? 0;

/// DAILY CLOSE SCREEN
/// Branch Accountant enters physical daily figures.
/// Lina AI data is fetched in background for auditor comparison, but NOT shown to BA.
class DailyCloseScreen extends ConsumerStatefulWidget {
  const DailyCloseScreen({super.key});

  @override
  ConsumerState<DailyCloseScreen> createState() => _DailyCloseScreenState();
}

class _DailyCloseScreenState extends ConsumerState<DailyCloseScreen> {
  bool _loading = false;
  bool _submitting = false;
  String? _error;
  String _selectedDate = DateFormat('yyyy-MM-dd')
      .format(DateTime.now().subtract(const Duration(days: 1)));

  // Lina data fetched silently in background (not displayed to BA)
  Map<String, dynamic>? _linaData;
  Map<String, dynamic>? _closeResult;

  bool _showExplanation = false;
  String _explanationReason = 'cash_shortage';
  final _explanationCtrl = TextEditingController();
  String? _submissionId;

  // ── Revenue fields ─────────────────────────────────────────────────────────
  final _revenueKeys = [
    'restaurant',
    'bar',
    'executive_bar',
    'sports_bar',
    'pool_table',
    'spa_sauna',
    'carwash',
    'conferences',
    'outside_catering',
    'rooms',
    'non_consumables',
    'swimming_pool',
    'other',
  ];

  static const _revenueLabels = {
    'restaurant': 'Restaurant',
    'bar': 'General Bar',
    'executive_bar': 'Executive Bar',
    'sports_bar': 'Sports Bar',
    'pool_table': 'Pool Table',
    'spa_sauna': 'Spa & Sauna',
    'carwash': 'Carwash',
    'conferences': 'Conferences',
    'outside_catering': 'Outside Catering',
    'rooms': 'Room Bookings',
    'non_consumables': 'Non-Consumables',
    'swimming_pool': 'Swimming Pool',
    'other': 'Other Revenue',
  };

  // ── Payment collections ────────────────────────────────────────────────────
  final _paymentKeys = ['cash', 'mpesa', 'swipe', 'credit_bills'];
  static const _paymentLabels = {
    'cash': 'Cash',
    'mpesa': 'M-Pesa',
    'swipe': 'Card/Swipe',
    'credit_bills': 'Credit Bills',
  };

  // ── Banking ────────────────────────────────────────────────────────────────
  final _bankingEntries = <Map<String, dynamic>>[];

  // ── COGS & Expenses ────────────────────────────────────────────────────────
  late final Map<String, TextEditingController> _ctrl;

  static const _allFields = [
    'restaurant', 'bar', 'executive_bar', 'sports_bar', 'pool_table',
    'spa_sauna', 'carwash', 'conferences', 'outside_catering', 'rooms',
    'non_consumables', 'swimming_pool', 'other',
    'cash', 'mpesa', 'swipe', 'credit_bills',
    'opening_stock', 'central_store_receipts', 'weekly_supplier_receipts', 'closing_stock',
    'petty_cash', 'transaction_costs', 'direct_suppliers', 'wastage', 'shorts', 'other_expenses',
    'notes',
  ];

  final _reasons = [
    ('cash_shortage', 'Cash Shortage'),
    ('banking_delay', 'Banking Delay'),
    ('inventory_loss', 'Inventory Loss'),
    ('revenue_leakage', 'Revenue Leakage'),
    ('posting_error', 'Posting Error'),
    ('fraud_suspected', 'Fraud Suspected'),
    ('supplier_error', 'Supplier Error'),
    ('payroll_error', 'Payroll Error'),
    ('other', 'Other'),
  ];

  @override
  void initState() {
    super.initState();
    _ctrl = {for (final f in _allFields) f: TextEditingController()};
    _loadLinaDataSilently();
  }

  @override
  void dispose() {
    for (final c in _ctrl.values) {
      c.dispose();
    }
    _explanationCtrl.dispose();
    super.dispose();
  }

  /// Fetch Lina AI data silently (for auditor comparison later, not shown to BA)
  Future<void> _loadLinaDataSilently() async {
    setState(() {
      _loading = true;
      _error = null;
      _linaData = null;
    });
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      final result = await repo
          .getDailyAutofill(_selectedDate)
          .catchError((_) => <String, dynamic>{});
      final data = (result['data'] ?? result) as Map<String, dynamic>? ?? {};
      if (mounted) {
        setState(() {
          _linaData = data;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _loading = false;
        });
      }
    }
  }

  double _totalRevenue() => _revenueKeys.fold(
      0.0, (s, k) => s + _dbl(_ctrl[k]?.text));

  double _totalPayments() =>
      _dbl(_ctrl['cash']?.text) +
      _dbl(_ctrl['mpesa']?.text) +
      _dbl(_ctrl['swipe']?.text) +
      _dbl(_ctrl['credit_bills']?.text);

  double _totalBanked() =>
      _bankingEntries.fold(0.0, (sum, entry) => sum + _dbl(entry['amount']));

  double _totalCogs() =>
      _dbl(_ctrl['opening_stock']?.text) +
      _dbl(_ctrl['central_store_receipts']?.text) +
      _dbl(_ctrl['weekly_supplier_receipts']?.text) -
      _dbl(_ctrl['closing_stock']?.text);

  double _totalExpenses() =>
      _dbl(_ctrl['petty_cash']?.text) +
      _dbl(_ctrl['transaction_costs']?.text) +
      _dbl(_ctrl['direct_suppliers']?.text) +
      _dbl(_ctrl['wastage']?.text) +
      _dbl(_ctrl['shorts']?.text) +
      _dbl(_ctrl['other_expenses']?.text);

  Future<void> _submitClose() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final revenueData = {
        for (final k in _revenueKeys) k: _dbl(_ctrl[k]?.text),
      };
      final paymentData = {
        for (final k in _paymentKeys) k: _dbl(_ctrl[k]?.text),
      };
      final cogsData = {
        'opening_balance': _dbl(_ctrl['opening_stock']?.text),
        'central_store_receipts': _dbl(_ctrl['central_store_receipts']?.text),
        'weekly_supplier_receipts': _dbl(_ctrl['weekly_supplier_receipts']?.text),
        'closing_balance': _dbl(_ctrl['closing_stock']?.text),
      };
      final expenseData = {
        'petty_cash_total': _dbl(_ctrl['petty_cash']?.text),
        'transaction_costs_total': _dbl(_ctrl['transaction_costs']?.text),
        'direct_suppliers_total': _dbl(_ctrl['direct_suppliers']?.text),
        'wastage_total': _dbl(_ctrl['wastage']?.text),
        'shorts_total': _dbl(_ctrl['shorts']?.text),
        'other_expenses_total': _dbl(_ctrl['other_expenses']?.text),
      };

      final result = await repo.submitWorkspaceClose({
        'record_date': _selectedDate,
        'revenue_data': revenueData,
        'payment_data': paymentData,
        'banking_data': {
          'entries': _bankingEntries,
          'banked': _totalBanked(),
        },
        'cogs_data': cogsData,
        'expense_data': expenseData,
        'submitted_revenue': _totalRevenue(),
        'submitted_collections': _totalPayments(),
        'submitted_banked': _totalBanked(),
        'submitted_cogs': _totalCogs(),
        'submitted_expenses': _totalExpenses(),
        'submitted_net_profit': _totalRevenue() - _totalCogs() - _totalExpenses(),
        'notes': _ctrl['notes']?.text.trim(),
        'source': 'branch_accountant_daily_close',
      });

      final data = (result['data'] ?? result) as Map<String, dynamic>? ?? {};
      final requiresExplanation = data['requires_explanation'] == true;
      final submission = data['submission'] as Map<String, dynamic>? ?? {};

      if (mounted) {
        setState(() {
          _submitting = false;
          _closeResult = data;
          _submissionId = submission['id'] as String?;
          _showExplanation = requiresExplanation;
        });
        if (!requiresExplanation) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Daily close submitted to Auditor for review.'),
            backgroundColor: Colors.green,
          ));
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = e.toString();
        });
      }
    }
  }

  Future<void> _submitExplanation() async {
    if (_submissionId == null) return;
    if (_explanationCtrl.text.trim().length < 20) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text('Explanation must be at least 20 characters'),
        backgroundColor: Colors.orange,
      ));
      return;
    }
    setState(() {
      _submitting = true;
    });
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      await repo.submitVarianceExplanation(_submissionId!, {
        'reason': _explanationReason,
        'notes': _explanationCtrl.text.trim(),
        'documents': [],
      });
      if (mounted) {
        setState(() {
          _submitting = false;
          _showExplanation = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Explanation submitted. Auditor will review.'),
          backgroundColor: Colors.green,
        ));
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = e.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        title: const Text('Daily Financial Close'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadLinaDataSilently,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildDateSelector(),
                  const SizedBox(height: 12),
                  if (_error != null) _buildError(),
                  if (_closeResult == null && !_showExplanation) ...[
                    _buildInstructionBanner(),
                    const SizedBox(height: 16),
                    _buildSectionHeader(Icons.storefront, 'Revenue by Outlet'),
                    _buildRevenueSection(),
                    const SizedBox(height: 16),
                    _buildSectionHeader(Icons.payments_outlined, 'Payment Collections'),
                    _buildPaymentsSection(),
                    const SizedBox(height: 16),
                    _buildSectionHeader(Icons.account_balance_outlined, 'Cash Banking'),
                    _buildBankingSection(),
                    const SizedBox(height: 16),
                    _buildSectionHeader(Icons.shopping_cart_outlined, 'Cost of Goods Sold (COGS)'),
                    _buildCogsSection(),
                    const SizedBox(height: 16),
                    _buildSectionHeader(Icons.receipt_long_outlined, 'Daily Expenses'),
                    _buildExpensesSection(),
                    const SizedBox(height: 16),
                    _buildTotalsSummary(),
                    const SizedBox(height: 16),
                    _buildNotesSection(),
                    const SizedBox(height: 20),
                    _buildSubmitButton(),
                  ],
                  if (_closeResult != null && !_showExplanation)
                    _buildVarianceResult(),
                  if (_showExplanation) _buildExplanationForm(),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _buildDateSelector() {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.calendar_today, color: AppColors.kPrimary),
        title: Text('Closing Date: $_selectedDate',
            style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: const Text('Physical figures you are declaring for this day'),
        trailing: TextButton(
          onPressed: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: DateTime.tryParse(_selectedDate) ??
                  DateTime.now().subtract(const Duration(days: 1)),
              firstDate: DateTime(2024),
              lastDate: DateTime.now(),
            );
            if (picked != null && mounted) {
              setState(() {
                _selectedDate = DateFormat('yyyy-MM-dd').format(picked);
                _closeResult = null;
                _showExplanation = false;
                for (final c in _ctrl.values) {
                  c.clear();
                }
                _bankingEntries.clear();
              });
              _loadLinaDataSilently();
            }
          },
          child: const Text('Change'),
        ),
      ),
    );
  }

  Widget _buildInstructionBanner() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: Colors.blue, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Enter the actual physical amounts counted at your branch. '
              'Your figures will be reviewed by the Auditor.',
              style: TextStyle(color: Colors.blue.shade800, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(IconData icon, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 20, color: AppColors.kPrimary),
          const SizedBox(width: 8),
          Text(label,
              style:
                  const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        ],
      ),
    );
  }

  Widget _buildRevenueSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            for (final key in _revenueKeys) ...[
              _inputRow(
                label: _revenueLabels[key] ?? key,
                controller: _ctrl[key]!,
              ),
              if (key != _revenueKeys.last)
                const Divider(height: 20, thickness: 0.5),
            ],
            const Divider(height: 24),
            _totalRow('Total Revenue', _totalRevenue()),
          ],
        ),
      ),
    );
  }

  Widget _buildPaymentsSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            for (final key in _paymentKeys) ...[
              _inputRow(
                label: _paymentLabels[key] ?? key,
                controller: _ctrl[key]!,
              ),
              if (key != _paymentKeys.last)
                const Divider(height: 20, thickness: 0.5),
            ],
            const Divider(height: 24),
            _totalRow('Total Payments', _totalPayments()),
            const SizedBox(height: 8),
            _varianceChip(
                'vs Revenue', _totalPayments() - _totalRevenue()),
          ],
        ),
      ),
    );
  }

  Widget _buildBankingSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Banking History',
                    style:
                        TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                IconButton(
                  onPressed: () => setState(() {
                    _bankingEntries.add({
                      'id': DateTime.now().millisecondsSinceEpoch.toString(),
                      'method': 'cash',
                      'amount': 0.0,
                      'account': '',
                      'reference': '',
                      'time': DateFormat('HH:mm').format(DateTime.now()),
                      'notes': '',
                    });
                  }),
                  icon: const Icon(Icons.add_circle, color: AppColors.kPrimary),
                  tooltip: 'Add Banking Record',
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_bankingEntries.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Center(
                  child: Text(
                    'No banking records added yet.\nTap + to add cash deposits.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey, fontSize: 13),
                  ),
                ),
              )
            else
              ...List.generate(_bankingEntries.length, (index) {
                final entry = _bankingEntries[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  color: Colors.grey.shade50,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                initialValue: entry['amount']?.toString() ?? '0',
                                keyboardType: const TextInputType.numberWithOptions(
                                    decimal: true),
                                decoration: const InputDecoration(
                                  labelText: 'Amount',
                                  prefixText: 'KES ',
                                  isDense: true,
                                  border: OutlineInputBorder(),
                                ),
                                onChanged: (v) => setState(() {
                                  entry['amount'] = _dbl(v);
                                }),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: DropdownButtonFormField<String>(
                                value: entry['method'] ?? 'cash',
                                decoration: const InputDecoration(
                                  labelText: 'Method',
                                  isDense: true,
                                  border: OutlineInputBorder(),
                                ),
                                items: const [
                                  DropdownMenuItem(
                                      value: 'cash', child: Text('Cash')),
                                  DropdownMenuItem(
                                      value: 'mpesa', child: Text('M-Pesa')),
                                  DropdownMenuItem(
                                      value: 'swipe', child: Text('Card')),
                                ],
                                onChanged: (v) => setState(() {
                                  entry['method'] = v;
                                }),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                initialValue: entry['account'] ?? '',
                                decoration: const InputDecoration(
                                  labelText: 'Bank Account',
                                  isDense: true,
                                  border: OutlineInputBorder(),
                                ),
                                onChanged: (v) => setState(() {
                                  entry['account'] = v;
                                }),
                              ),
                            ),
                            const SizedBox(width: 10),
                            IconButton(
                              onPressed: () => setState(() {
                                _bankingEntries.removeAt(index);
                              }),
                              icon: const Icon(Icons.delete, color: Colors.red),
                              tooltip: 'Remove',
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }),
            const Divider(height: 24),
            _totalRow('Total Banked', _totalBanked()),
            const SizedBox(height: 8),
            _ValueWidget(
              label: 'Unbanked Cash (Cash − Banked)',
              value: _dbl(_ctrl['cash']?.text) - _totalBanked(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCogsSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            _inputRow(label: 'Opening Stock Balance', controller: _ctrl['opening_stock']!),
            const Divider(height: 20, thickness: 0.5),
            _inputRow(
                label: 'Central Store Receipts', controller: _ctrl['central_store_receipts']!),
            const Divider(height: 20, thickness: 0.5),
            _inputRow(
                label: 'Weekly Supplier Deliveries',
                controller: _ctrl['weekly_supplier_receipts']!),
            const Divider(height: 20, thickness: 0.5),
            _inputRow(label: 'Closing Stock Balance', controller: _ctrl['closing_stock']!),
            const Divider(height: 24),
            const Text(
              'Formula: Opening + Central + Deliveries − Closing',
              style: TextStyle(fontSize: 11, color: Colors.grey),
            ),
            const SizedBox(height: 8),
            _totalRow('Total COGS', _totalCogs()),
          ],
        ),
      ),
    );
  }

  Widget _buildExpensesSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          children: [
            _inputRow(label: 'Petty Cash', controller: _ctrl['petty_cash']!),
            const Divider(height: 20, thickness: 0.5),
            _inputRow(label: 'Transaction Costs', controller: _ctrl['transaction_costs']!),
            const Divider(height: 20, thickness: 0.5),
            _inputRow(label: 'Direct Suppliers', controller: _ctrl['direct_suppliers']!),
            const Divider(height: 20, thickness: 0.5),
            _inputRow(label: 'Wastage', controller: _ctrl['wastage']!),
            const Divider(height: 20, thickness: 0.5),
            _inputRow(label: 'Shorts/Lost Items', controller: _ctrl['shorts']!),
            const Divider(height: 20, thickness: 0.5),
            _inputRow(label: 'Other Expenses', controller: _ctrl['other_expenses']!),
            const Divider(height: 24),
            _totalRow('Total Expenses', _totalExpenses()),
          ],
        ),
      ),
    );
  }

  Widget _buildTotalsSummary() {
    final rev = _totalRevenue();
    final cogs = _totalCogs();
    final exp = _totalExpenses();
    final net = rev - cogs - exp;

    return Card(
      color: AppColors.kPrimary.withValues(alpha: 0.05),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Financial Summary',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
            const SizedBox(height: 12),
            _totalRow('Total Revenue', rev),
            const SizedBox(height: 6),
            _totalRow('Total COGS', cogs),
            const SizedBox(height: 6),
            _totalRow('Total Expenses', exp),
            const Divider(height: 20),
            _totalRow('Net Profit', net, isHighlight: true, isNeg: net < 0),
          ],
        ),
      ),
    );
  }

  Widget _buildNotesSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: TextFormField(
          controller: _ctrl['notes'],
          maxLines: 4,
          decoration: const InputDecoration(
            labelText: 'Notes / Remarks',
            hintText:
                'Any unusual activity, shortages, or important information for the auditor.',
            border: OutlineInputBorder(),
          ),
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: _submitting ? null : _submitClose,
        icon: _submitting
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.send),
        label: Text(_submitting
            ? 'Submitting...'
            : 'Submit Daily Close to Auditor'),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.kPrimary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          textStyle:
              const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildVarianceResult() {
    final variance =
        _closeResult!['variance'] as Map<String, dynamic>? ?? {};
    final overall = _dbl(variance['overall']);
    final isNeg = overall < 0;

    return Card(
      color:
          isNeg ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                    isNeg
                        ? Icons.warning_amber_rounded
                        : Icons.check_circle,
                    color: isNeg ? Colors.red : Colors.green),
                const SizedBox(width: 8),
                Text('Submission Result',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                        color: isNeg
                            ? Colors.red.shade700
                            : Colors.green.shade700)),
              ],
            ),
            const SizedBox(height: 10),
            Text(
              _closeResult!['message']?.toString() ??
                  'Your submission has been recorded.',
              style: const TextStyle(fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExplanationForm() {
    return Card(
      color: const Color(0xFFFFFBEB),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.error_outline, color: Colors.amber),
                SizedBox(width: 8),
                Text('Variance Explanation Required',
                    style: TextStyle(
                        fontWeight: FontWeight.bold, color: Colors.amber)),
              ],
            ),
            const SizedBox(height: 8),
            const Text(
              'A variance was detected. Please provide an explanation before this can proceed to audit review.',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _explanationReason,
              decoration: const InputDecoration(
                  labelText: 'Reason Category', border: OutlineInputBorder()),
              items: _reasons
                  .map((r) =>
                      DropdownMenuItem(value: r.$1, child: Text(r.$2)))
                  .toList(),
              onChanged: (v) => setState(() => _explanationReason = v!),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _explanationCtrl,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Explanation (min 20 characters)',
                border: OutlineInputBorder(),
                hintText:
                    'Explain the variance: what happened, when, and any corrective action taken.',
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _submitting ? null : _submitExplanation,
                icon: _submitting
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white))
                    : const Icon(Icons.send),
                label: Text(_submitting
                    ? 'Submitting...'
                    : 'Submit Explanation to Auditor'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError() {
    return Card(
      color: const Color(0xFFFEF2F2),
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: const Icon(Icons.error, color: Colors.red),
        title: Text(_error!,
            style: const TextStyle(color: Colors.red, fontSize: 13)),
        trailing: TextButton(
            onPressed: _loadLinaDataSilently, child: const Text('Retry')),
      ),
    );
  }

  // ── Shared widgets ─────────────────────────────────────────────────────────

  Widget _inputRow({
    required String label,
    required TextEditingController controller,
  }) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style: const TextStyle(fontSize: 13, color: Colors.black87)),
              const SizedBox(height: 6),
              TextFormField(
                controller: controller,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [
                  FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                ],
                decoration: const InputDecoration(
                  prefixText: 'KES ',
                  isDense: true,
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                onChanged: (_) => setState(() {}),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _totalRow(
    String label,
    double value, {
    bool isHighlight = false,
    bool isNeg = false,
  }) {
    final textColor = isNeg
        ? Colors.red.shade700
        : isHighlight
            ? AppColors.kPrimary
            : Colors.black87;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: TextStyle(
                fontWeight:
                    isHighlight ? FontWeight.bold : FontWeight.w600,
                fontSize: isHighlight ? 15 : 14,
                color: textColor)),
        Text('KES ${_fmtN(value)}',
            style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: isHighlight ? 16 : 14,
                color: textColor)),
      ],
    );
  }

  Widget _varianceChip(String label, double variance) {
    final isNeg = variance < 0;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: const TextStyle(fontSize: 12, color: Colors.black54)),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: isNeg ? Colors.red.shade50 : Colors.green.shade50,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
                color: isNeg ? Colors.red.shade200 : Colors.green.shade200),
          ),
          child: Text(
            '${isNeg ? '-' : '+'}KES ${_fmtN(variance.abs())}',
            style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color:
                    isNeg ? Colors.red.shade700 : Colors.green.shade700),
          ),
        ),
      ],
    );
  }
}

// Shows a derived read-only value
class _ValueWidget extends StatelessWidget {
  const _ValueWidget({
    required this.label,
    required this.value,
  });

  final String label;
  final double value;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(label,
              style: const TextStyle(fontSize: 12, color: Colors.black54)),
        ),
        Text('KES ${_fmtN(value)}',
            style:
                const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      ],
    );
  }
}
