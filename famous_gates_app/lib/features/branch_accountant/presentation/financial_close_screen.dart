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

class FinancialCloseScreen extends ConsumerStatefulWidget {
  const FinancialCloseScreen({super.key});

  @override
  ConsumerState<FinancialCloseScreen> createState() =>
      _FinancialCloseScreenState();
}

class _FinancialCloseScreenState extends ConsumerState<FinancialCloseScreen> {
  bool _loading = false;
  bool _submitting = false;
  String? _error;
  String _selectedDate = DateFormat('yyyy-MM-dd')
      .format(DateTime.now().subtract(const Duration(days: 1)));

  Map<String, dynamic>? _linaData;
  Map<String, dynamic>? _closeResult;

  bool _showExplanation = false;
  String _explanationReason = 'cash_shortage';
  final _explanationCtrl = TextEditingController();
  String? _submissionId;

  // ── Revenue fields ─────────────────────────────────────────────────────────
  final _revenueKeys = [
    'restaurant_revenue',
    'bar_revenue',
    'events_revenue',
    'laundry_revenue',
    'room_revenue',
    'other_revenue',
  ];
  static const _revenueLabels = {
    'restaurant_revenue': 'Restaurant',
    'bar_revenue': 'Bar',
    'events_revenue': 'Events',
    'laundry_revenue': 'Laundry',
    'room_revenue': 'Rooms',
    'other_revenue': 'Other',
  };

  // ── All input controllers ──────────────────────────────────────────────────
  late final Map<String, TextEditingController> _ctrl;

  static const _allFields = [
    'restaurant_revenue',
    'bar_revenue',
    'events_revenue',
    'laundry_revenue',
    'room_revenue',
    'other_revenue',
    'cash',
    'mpesa',
    'swipe',
    'credit_bills',
    'banked',
    'total_cogs',
    'total_expenses',
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
    _loadData();
  }

  @override
  void dispose() {
    for (final c in _ctrl.values) {
      c.dispose();
    }
    _explanationCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
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
      0.0, (s, k) => s + (_dbl(_ctrl[k]?.text)));

  double _totalCollections() =>
      _dbl(_ctrl['cash']?.text) +
      _dbl(_ctrl['mpesa']?.text) +
      _dbl(_ctrl['swipe']?.text) +
      _dbl(_ctrl['credit_bills']?.text);

  double _linaRef(String key) {
    if (_linaData == null) return 0;
    // Revenue data is nested under revenue_data in autofill response
    final revData = _linaData!['revenue_data'] as Map<String, dynamic>? ?? {};
    if (_revenueKeys.contains(key) && revData.containsKey(key)) {
      return _dbl(revData[key]);
    }
    // Payment data
    final payData =
        _linaData!['payment_data'] as Map<String, dynamic>? ?? {};
    if (payData.containsKey(key)) return _dbl(payData[key]);
    // Banking data
    final bankData =
        _linaData!['banking_data'] as Map<String, dynamic>? ?? {};
    if (key == 'banked') return _dbl(bankData['banked'] ?? _linaData![key]);
    // Top-level
    return _dbl(_linaData![key]);
  }

  double _linaTotalRevenue() =>
      _revenueKeys.fold(0.0, (s, k) => s + _linaRef(k));

  double _linaTotalCollections() =>
      _linaRef('cash') +
      _linaRef('mpesa') +
      _linaRef('swipe') +
      _linaRef('credit_bills');

  Future<void> _submitClose() async {
    final repo = ref.read(branchAccountantRepositoryProvider);
    setState(() { _submitting = true; _error = null; });
    try {
      final revenueData = {
        for (final k in _revenueKeys) k: _dbl(_ctrl[k]?.text),
      };
      final result = await repo.submitWorkspaceClose({
        'record_date': _selectedDate,
        'revenue_data': revenueData,
        'submitted_revenue': _totalRevenue(),
        'submitted_collections': _totalCollections(),
        'submitted_cash': _dbl(_ctrl['cash']?.text),
        'submitted_mpesa': _dbl(_ctrl['mpesa']?.text),
        'submitted_swipe': _dbl(_ctrl['swipe']?.text),
        'submitted_credit_bills': _dbl(_ctrl['credit_bills']?.text),
        'submitted_banked': _dbl(_ctrl['banked']?.text),
        'submitted_cogs': _dbl(_ctrl['total_cogs']?.text),
        'submitted_expenses': _dbl(_ctrl['total_expenses']?.text),
        'submitted_net_profit': _totalRevenue() -
            _dbl(_ctrl['total_cogs']?.text) -
            _dbl(_ctrl['total_expenses']?.text),
        'notes': _ctrl['notes']?.text.trim(),
        'source': 'human_close',
      });

      final data = (result['data'] ?? result) as Map<String, dynamic>? ?? {};
      final requiresExplanation = data['requires_explanation'] == true;
      final submission =
          data['submission'] as Map<String, dynamic>? ?? {};

      if (mounted) {
        setState(() {
          _submitting = false;
          _closeResult = data;
          _submissionId = submission['id'] as String?;
          _showExplanation = requiresExplanation;
        });
        if (!requiresExplanation) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text('Daily close submitted. Auditor notified.'),
            backgroundColor: Colors.green,
          ));
        }
      }
    } catch (e) {
      if (mounted) setState(() { _submitting = false; _error = e.toString(); });
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
    setState(() { _submitting = true; });
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      await repo.submitVarianceExplanation(_submissionId!, {
        'reason': _explanationReason,
        'notes': _explanationCtrl.text.trim(),
        'documents': [],
      });
      if (mounted) {
        setState(() { _submitting = false; _showExplanation = false; });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Explanation submitted. Auditor notified.'),
          backgroundColor: Colors.green,
        ));
      }
    } catch (e) {
      if (mounted) setState(() { _submitting = false; _error = e.toString(); });
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
              icon: const Icon(Icons.refresh), onPressed: _loadData),
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
                  _buildLinaBanner(),
                  const SizedBox(height: 12),
                  if (_closeResult == null && !_showExplanation) ...[
                    _buildSectionHeader(
                        Icons.storefront, 'Revenue by Outlet'),
                    _buildRevenueSection(),
                    const SizedBox(height: 12),
                    _buildSectionHeader(
                        Icons.payments_outlined, 'Cash Collections'),
                    _buildCollectionsSection(),
                    const SizedBox(height: 12),
                    _buildSectionHeader(
                        Icons.account_balance_outlined, 'Banking'),
                    _buildBankingSection(),
                    const SizedBox(height: 12),
                    _buildSectionHeader(
                        Icons.shopping_cart_outlined, 'Cost of Goods Sold'),
                    _buildCogsSection(),
                    const SizedBox(height: 12),
                    _buildSectionHeader(
                        Icons.receipt_long_outlined, 'Expenses'),
                    _buildExpensesSection(),
                    const SizedBox(height: 12),
                    _buildTotalsSummary(),
                    const SizedBox(height: 12),
                    _buildNotesSection(),
                    const SizedBox(height: 16),
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
        leading:
            const Icon(Icons.calendar_today, color: AppColors.kPrimary),
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
                _selectedDate =
                    DateFormat('yyyy-MM-dd').format(picked);
                _closeResult = null;
                _showExplanation = false;
                for (final c in _ctrl.values) {
                  c.clear();
                }
              });
              _loadData();
            }
          },
          child: const Text('Change'),
        ),
      ),
    );
  }

  Widget _buildLinaBanner() {
    if (_linaData == null) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.blue.shade50,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.blue.shade200),
      ),
      child: Row(
        children: [
          const Icon(Icons.auto_awesome, color: Colors.blue, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'LINA AI reference figures are shown in blue beside each field. '
              'Enter the actual physical amounts you counted.',
              style:
                  TextStyle(color: Colors.blue.shade800, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(IconData icon, String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(children: [
        Icon(icon, size: 18, color: AppColors.kPrimary),
        const SizedBox(width: 8),
        Text(label,
            style: const TextStyle(
                fontWeight: FontWeight.bold, fontSize: 15)),
        const Spacer(),
        Text('LINA ref →',
            style: TextStyle(
                fontSize: 11,
                color: Colors.blue.shade600,
                fontStyle: FontStyle.italic)),
      ]),
    );
  }

  Widget _buildRevenueSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            for (final key in _revenueKeys) ...[
              _inputRow(
                label: _revenueLabels[key] ?? key,
                controller: _ctrl[key]!,
                linaValue: _linaRef(key),
              ),
              if (key != _revenueKeys.last)
                const Divider(height: 16, thickness: 0.3),
            ],
            const Divider(height: 20),
            _totalRow('Total Revenue', _totalRevenue(), _linaTotalRevenue()),
          ],
        ),
      ),
    );
  }

  Widget _buildCollectionsSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            _inputRow(
                label: 'Cash',
                controller: _ctrl['cash']!,
                linaValue: _linaRef('cash')),
            const Divider(height: 16, thickness: 0.3),
            _inputRow(
                label: 'Mpesa',
                controller: _ctrl['mpesa']!,
                linaValue: _linaRef('mpesa')),
            const Divider(height: 16, thickness: 0.3),
            _inputRow(
                label: 'Swipe (Card)',
                controller: _ctrl['swipe']!,
                linaValue: _linaRef('swipe')),
            const Divider(height: 16, thickness: 0.3),
            _inputRow(
                label: 'Credit Bills',
                controller: _ctrl['credit_bills']!,
                linaValue: _linaRef('credit_bills')),
            const Divider(height: 20),
            _totalRow('Total Collections', _totalCollections(),
                _linaTotalCollections()),
            const SizedBox(height: 4),
            _varianceChip(
                'vs Revenue',
                _totalCollections() - _totalRevenue(),
                _linaTotalCollections() - _linaTotalRevenue()),
          ],
        ),
      ),
    );
  }

  Widget _buildBankingSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            _inputRow(
                label: 'Amount Banked',
                controller: _ctrl['banked']!,
                linaValue: _linaRef('banked')),
            const SizedBox(height: 8),
            // Derived: unbanked cash
            _ValueWidget(
              label: 'Unbanked Cash (Cash − Banked)',
              value: _dbl(_ctrl['cash']?.text) -
                  _dbl(_ctrl['banked']?.text),
              linaValue: _linaRef('cash') - _linaRef('banked'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCogsSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: _inputRow(
          label: 'Total COGS',
          controller: _ctrl['total_cogs']!,
          linaValue: _linaRef('total_cogs'),
        ),
      ),
    );
  }

  Widget _buildExpensesSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: _inputRow(
          label: 'Total Expenses',
          controller: _ctrl['total_expenses']!,
          linaValue: _linaRef('total_expenses'),
        ),
      ),
    );
  }

  Widget _buildTotalsSummary() {
    final rev = _totalRevenue();
    final cogs = _dbl(_ctrl['total_cogs']?.text);
    final exp = _dbl(_ctrl['total_expenses']?.text);
    final net = rev - cogs - exp;

    final linaRev = _linaTotalRevenue();
    final linaCogs = _linaRef('total_cogs');
    final linaExp = _linaRef('total_expenses');
    final linaNet = linaRev - linaCogs - linaExp;

    return Card(
      color: AppColors.kPrimary.withValues(alpha: 0.04),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Summary',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 10),
            _totalRow('Total Revenue', rev, linaRev),
            const SizedBox(height: 4),
            _totalRow('Total COGS', cogs, linaCogs),
            const SizedBox(height: 4),
            _totalRow('Total Expenses', exp, linaExp),
            const Divider(height: 16),
            _totalRow('Net Profit', net, linaNet,
                isHighlight: true, isNeg: net < 0),
          ],
        ),
      ),
    );
  }

  Widget _buildNotesSection() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: TextFormField(
          controller: _ctrl['notes'],
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Notes / Remarks',
            hintText:
                'Any unusual activity, shortages, or comments for the auditor.',
            border: OutlineInputBorder(),
            isDense: true,
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
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.lock_outline),
        label: Text(_submitting
            ? 'Submitting…'
            : 'Submit Daily Close to Auditor'),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.kPrimary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          textStyle: const TextStyle(
              fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildVarianceResult() {
    final variance =
        _closeResult!['variance'] as Map<String, dynamic>? ?? {};
    final overall = _dbl(variance['overall']);
    final isNeg = overall < 0;
    final smartAnalysis =
        (variance['smart_analysis'] as List?)
            ?.cast<Map<String, dynamic>>() ??
            [];

    return Card(
      color: isNeg
          ? const Color(0xFFFEF2F2)
          : const Color(0xFFF0FDF4),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(
                  isNeg
                      ? Icons.warning_amber_rounded
                      : Icons.check_circle,
                  color: isNeg ? Colors.red : Colors.green),
              const SizedBox(width: 8),
              Text('Variance Analysis',
                  style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: isNeg
                          ? Colors.red.shade700
                          : Colors.green.shade700)),
            ]),
            const SizedBox(height: 8),
            _infoRow('Overall Variance', 'KES ${_fmtN(overall)}',
                valueColor:
                    isNeg ? Colors.red : Colors.green),
            _infoRow('Revenue Variance',
                'KES ${_fmtN(variance['revenue'])}'),
            _infoRow('Cash Variance',
                'KES ${_fmtN(variance['cash'])}'),
            _infoRow('Banking Variance',
                'KES ${_fmtN(variance['banking'])}'),
            if (smartAnalysis.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text('Possible Causes:',
                  style: TextStyle(
                      fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              for (final item in smartAnalysis) ...[
                Text(
                    '• ${item['component']}  '
                    '(KES ${_fmtN(item['variance'])})',
                    style: const TextStyle(
                        fontWeight: FontWeight.w500)),
                for (final cause in (item['possible_causes'] as List?)
                        ?.cast<Map>() ??
                    [])
                  Padding(
                    padding: const EdgeInsets.only(left: 12, top: 2),
                    child: Row(
                      children: [
                        Text('${cause['cause']}',
                            style:
                                const TextStyle(fontSize: 12)),
                        const Spacer(),
                        Text(
                            '${cause['confidence']}% confidence',
                            style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey.shade600)),
                      ],
                    ),
                  ),
                const SizedBox(height: 4),
              ],
            ],
            if (_closeResult!['message'] != null) ...[
              const SizedBox(height: 8),
              Text(_closeResult!['message'].toString(),
                  style: TextStyle(
                      fontSize: 12,
                      color: isNeg
                          ? Colors.red.shade700
                          : Colors.green.shade700)),
            ],
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
            const Row(children: [
              Icon(Icons.error_outline, color: Colors.amber),
              SizedBox(width: 8),
              Text('Variance Explanation Required',
                  style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Colors.amber)),
            ]),
            const SizedBox(height: 4),
            const Text(
              'A negative variance was detected. Provide an explanation before this can proceed to audit review.',
              style: TextStyle(fontSize: 12, color: Colors.black87),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              initialValue: _explanationReason,
              decoration: const InputDecoration(
                  labelText: 'Reason Category',
                  border: OutlineInputBorder()),
              items: _reasons
                  .map((r) => DropdownMenuItem(
                      value: r.$1, child: Text(r.$2)))
                  .toList(),
              onChanged: (v) =>
                  setState(() => _explanationReason = v!),
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
                            strokeWidth: 2,
                            color: Colors.white))
                    : const Icon(Icons.send),
                label: Text(_submitting
                    ? 'Submitting...'
                    : 'Submit Explanation to Auditor'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.kPrimary,
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(vertical: 14),
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
            style:
                const TextStyle(color: Colors.red, fontSize: 13)),
        trailing: TextButton(
            onPressed: _loadData, child: const Text('Retry')),
      ),
    );
  }

  // ── Shared widgets ─────────────────────────────────────────────────────────

  Widget _inputRow({
    required String label,
    required TextEditingController controller,
    required double linaValue,
  }) {
    return StatefulBuilder(
      builder: (ctx, rebuildRow) => Row(
        children: [
          Expanded(
            flex: 3,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontSize: 12, color: Colors.black54)),
                const SizedBox(height: 4),
                TextFormField(
                  controller: controller,
                  keyboardType: const TextInputType.numberWithOptions(
                      decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(
                        RegExp(r'^\d*\.?\d*')),
                  ],
                  decoration: const InputDecoration(
                    prefixText: 'KES ',
                    isDense: true,
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(
                        horizontal: 10, vertical: 8),
                  ),
                  onChanged: (_) => setState(() {}),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('LINA ref',
                    style: TextStyle(
                        fontSize: 11,
                        color: Colors.blue.shade600)),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 9),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(6),
                    border:
                        Border.all(color: Colors.blue.shade100),
                  ),
                  child: Text(
                    linaValue == 0
                        ? '—'
                        : 'KES ${_fmtN(linaValue)}',
                    style: TextStyle(
                        fontSize: 12,
                        color: Colors.blue.shade700,
                        fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _totalRow(
    String label,
    double value,
    double linaValue, {
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
                fontWeight: isHighlight
                    ? FontWeight.bold
                    : FontWeight.w500,
                fontSize: isHighlight ? 14 : 13,
                color: textColor)),
        Row(children: [
          Text('KES ${_fmtN(value)}',
              style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: isHighlight ? 15 : 13,
                  color: textColor)),
          const SizedBox(width: 12),
          Text(
            linaValue == 0
                ? '—'
                : 'KES ${_fmtN(linaValue)}',
            style: TextStyle(
                fontSize: 11,
                color: Colors.blue.shade600,
                fontStyle: FontStyle.italic),
          ),
        ]),
      ],
    );
  }

  Widget _varianceChip(
      String label, double variance, double linaVariance) {
    final isNeg = variance < 0;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label,
            style: const TextStyle(
                fontSize: 11, color: Colors.black54)),
        Row(children: [
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: isNeg
                  ? Colors.red.shade50
                  : Colors.green.shade50,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              '${isNeg ? '-' : '+'}KES ${_fmtN(variance.abs())}',
              style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: isNeg
                      ? Colors.red.shade700
                      : Colors.green.shade700),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            linaVariance == 0
                ? '—'
                : '${linaVariance < 0 ? '-' : '+'}${_fmtN(linaVariance.abs())}',
            style: TextStyle(
                fontSize: 11,
                color: Colors.blue.shade400,
                fontStyle: FontStyle.italic),
          ),
        ]),
      ],
    );
  }

  Widget _infoRow(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 13, color: Colors.black87)),
          Text(value,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: valueColor ?? Colors.black87)),
        ],
      ),
    );
  }
}

// Shows a derived read-only row with LINA comparison.
class _ValueWidget extends StatelessWidget {
  const _ValueWidget({
    required this.label,
    required this.value,
    required this.linaValue,
  });

  final String label;
  final double value;
  final double linaValue;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(label,
              style: const TextStyle(
                  fontSize: 12, color: Colors.black54)),
        ),
        Text('KES ${_fmtN(value)}',
            style: const TextStyle(
                fontWeight: FontWeight.w600, fontSize: 13)),
        const SizedBox(width: 12),
        Text(
          linaValue == 0 ? '—' : 'KES ${_fmtN(linaValue)}',
          style: TextStyle(
              fontSize: 11,
              color: Colors.blue.shade600,
              fontStyle: FontStyle.italic),
        ),
      ],
    );
  }
}
