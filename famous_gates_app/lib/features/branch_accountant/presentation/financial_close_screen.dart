import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../data/repository.dart';

final _fmt = NumberFormat('#,##0.00', 'en_KE');
String _fmtN(dynamic v) => _fmt.format(double.tryParse(v?.toString() ?? '0') ?? 0);

class FinancialCloseScreen extends ConsumerStatefulWidget {
  const FinancialCloseScreen({super.key});

  @override
  ConsumerState<FinancialCloseScreen> createState() => _FinancialCloseScreenState();
}

class _FinancialCloseScreenState extends ConsumerState<FinancialCloseScreen> {
  final _repo = BranchAccountantRepository;
  bool _loading = false;
  bool _submitting = false;
  String? _error;
  String _selectedDate = DateFormat('yyyy-MM-dd').format(DateTime.now().subtract(const Duration(days: 1)));

  Map<String, dynamic>? _dailyRecord;
  Map<String, dynamic>? _systemSnapshot;
  Map<String, dynamic>? _closeResult;

  // Explanation form
  bool _showExplanation = false;
  String _explanationReason = 'cash_shortage';
  final _explanationController = TextEditingController();
  String? _submissionId;

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
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _loading = true; _error = null; });
    try {
      final repoInstance = ref.read(branchAccountantRepositoryProvider);
      final results = await Future.wait([
        repoInstance.getDailyRecordByDate(_selectedDate).catchError((_) => <String, dynamic>{}),
        repoInstance.getDailySystemSnapshot(_selectedDate).catchError((_) => <String, dynamic>{}),
      ]);
      if (mounted) {
        setState(() {
          _dailyRecord = (results[0] as Map<String, dynamic>?)?['data'] as Map<String, dynamic>?;
          _systemSnapshot = (results[1] as Map<String, dynamic>?)?['data'] as Map<String, dynamic>?;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  Future<void> _submitClose() async {
    if (_dailyRecord == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No saved daily record found for this date. Please save your workspace first.'), backgroundColor: Colors.orange),
      );
      return;
    }
    setState(() { _submitting = true; });
    try {
      final repoInstance = ref.read(branchAccountantRepositoryProvider);
      final result = await repoInstance.submitWorkspaceClose({
        'record_date': _selectedDate,
        'submitted_revenue': _dailyRecord!['total_revenue'],
        'submitted_cogs': _dailyRecord!['total_cogs'],
        'submitted_expenses': _dailyRecord!['total_expenses'],
        'submitted_net_profit': _dailyRecord!['net_profit'],
        'submitted_cash': (_dailyRecord!['payment_data'] as Map?)?['cash'],
        'submitted_banked': (_dailyRecord!['banking_data'] as Map?)?['banked'],
        'submitted_unbanked': _dailyRecord!['unbanked_cash'],
      });

      final data = result['data'] as Map<String, dynamic>? ?? {};
      final requiresExplanation = data['requires_explanation'] == true;
      final submission = data['submission'] as Map<String, dynamic>? ?? {};

      setState(() {
        _submitting = false;
        _closeResult = data;
        _submissionId = submission['id'] as String?;
        _showExplanation = requiresExplanation;
      });

      if (!requiresExplanation && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Workspace submitted. Auditor notified.'), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) setState(() { _submitting = false; _error = e.toString(); });
    }
  }

  Future<void> _submitExplanation() async {
    if (_submissionId == null) return;
    if (_explanationController.text.trim().length < 20) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Explanation must be at least 20 characters'), backgroundColor: Colors.orange),
      );
      return;
    }
    setState(() { _submitting = true; });
    try {
      final repoInstance = ref.read(branchAccountantRepositoryProvider);
      await repoInstance.submitVarianceExplanation(_submissionId!, {
        'reason': _explanationReason,
        'notes': _explanationController.text.trim(),
        'documents': [],
      });
      if (mounted) {
        setState(() { _submitting = false; _showExplanation = false; });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Explanation submitted. Auditor notified.'), backgroundColor: Colors.green),
        );
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
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData),
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
                  const SizedBox(height: 16),
                  if (_error != null) _buildError(),
                  if (_systemSnapshot != null) _buildSystemSnapshot(),
                  const SizedBox(height: 12),
                  if (_dailyRecord != null) _buildWorkspaceSummary(),
                  const SizedBox(height: 12),
                  if (_closeResult != null && !_showExplanation) _buildVarianceResult(),
                  if (_showExplanation) _buildExplanationForm(),
                  const SizedBox(height: 16),
                  if (!_showExplanation && _closeResult == null) _buildSubmitButton(),
                ],
              ),
            ),
    );
  }

  Widget _buildDateSelector() {
    return Card(
      child: ListTile(
        leading: const Icon(Icons.calendar_today, color: AppColors.kPrimary),
        title: Text('Closing Date: $_selectedDate', style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: const Text('Select the date you are closing'),
        trailing: TextButton(
          onPressed: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: DateTime.tryParse(_selectedDate) ?? DateTime.now().subtract(const Duration(days: 1)),
              firstDate: DateTime(2024),
              lastDate: DateTime.now(),
            );
            if (picked != null) {
              setState(() => _selectedDate = DateFormat('yyyy-MM-dd').format(picked));
              _loadData();
            }
          },
          child: const Text('Change'),
        ),
      ),
    );
  }

  Widget _buildSystemSnapshot() {
    final snap = _systemSnapshot!;
    return Card(
      color: const Color(0xFFF0F9FF),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.computer, color: Colors.blue, size: 18),
              const SizedBox(width: 8),
              const Text('System Baseline (Auto-Generated)', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.blue)),
            ]),
            const SizedBox(height: 8),
            _infoRow('System Revenue', _fmtN(snap['total_system_revenue'])),
            _infoRow('System Expenses', _fmtN(snap['total_system_expenses'])),
            _infoRow('System Net Profit', _fmtN(snap['system_net_profit'])),
            _infoRow('System Banked', _fmtN(snap['system_banked'])),
          ],
        ),
      ),
    );
  }

  Widget _buildWorkspaceSummary() {
    final rec = _dailyRecord!;
    final revenue = double.tryParse(rec['total_revenue']?.toString() ?? '0') ?? 0;
    final cogs = double.tryParse(rec['total_cogs']?.toString() ?? '0') ?? 0;
    final expenses = double.tryParse(rec['total_expenses']?.toString() ?? '0') ?? 0;
    final netProfit = revenue - cogs - expenses;
    final isPositive = netProfit >= 0;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              const Icon(Icons.receipt_long, color: AppColors.kPrimary, size: 18),
              const SizedBox(width: 8),
              Text('Your Workspace — $_selectedDate', style: const TextStyle(fontWeight: FontWeight.bold)),
              const Spacer(),
              Chip(
                label: Text(rec['status'] ?? 'DRAFT', style: const TextStyle(fontSize: 11, color: Colors.white)),
                backgroundColor: rec['status'] == 'REVIEWED' ? Colors.green : rec['status'] == 'SUBMITTED' ? Colors.orange : Colors.grey,
                padding: EdgeInsets.zero,
              ),
            ]),
            const Divider(),
            _infoRow('Revenue', _fmtN(revenue)),
            _infoRow('COGS', _fmtN(cogs)),
            _infoRow('Expenses', _fmtN(expenses)),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('NET PROFIT', style: TextStyle(fontWeight: FontWeight.bold)),
                Text(
                  'KES ${_fmtN(netProfit)}',
                  style: TextStyle(fontWeight: FontWeight.bold, color: isPositive ? Colors.green.shade700 : Colors.red.shade700, fontSize: 16),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVarianceResult() {
    final variance = _closeResult!['variance'] as Map<String, dynamic>? ?? {};
    final overall = double.tryParse(variance['overall']?.toString() ?? '0') ?? 0;
    final isNeg = overall < 0;
    final smartAnalysis = (variance['smart_analysis'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    return Card(
      color: isNeg ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(isNeg ? Icons.warning_amber_rounded : Icons.check_circle, color: isNeg ? Colors.red : Colors.green),
              const SizedBox(width: 8),
              Text('Variance Analysis', style: TextStyle(fontWeight: FontWeight.bold, color: isNeg ? Colors.red.shade700 : Colors.green.shade700)),
            ]),
            const SizedBox(height: 8),
            _infoRow('Overall Variance', 'KES ${_fmtN(overall)}', valueColor: isNeg ? Colors.red : Colors.green),
            _infoRow('Revenue Variance', 'KES ${_fmtN(variance['revenue'])}'),
            _infoRow('Cash Variance', 'KES ${_fmtN(variance['cash'])}'),
            _infoRow('Banking Variance', 'KES ${_fmtN(variance['banking'])}'),
            if (smartAnalysis.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Text('Smart Analysis — Possible Causes:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 6),
              for (final item in smartAnalysis) ...[
                Text('• ${item['component']}  (KES ${_fmtN(item['variance'])})', style: const TextStyle(fontWeight: FontWeight.w500)),
                for (final cause in (item['possible_causes'] as List?)?.cast<Map>() ?? [])
                  Padding(
                    padding: const EdgeInsets.only(left: 12, top: 2),
                    child: Row(
                      children: [
                        Text('${cause['cause']}', style: const TextStyle(fontSize: 12)),
                        const Spacer(),
                        Text('${cause['confidence']}% confidence', style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
                      ],
                    ),
                  ),
                const SizedBox(height: 4),
              ],
            ],
            if (_closeResult!['message'] != null) ...[
              const SizedBox(height: 8),
              Text(_closeResult!['message'].toString(), style: TextStyle(fontSize: 12, color: isNeg ? Colors.red.shade700 : Colors.green.shade700)),
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
              Text('Mandatory Variance Explanation Required', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.amber)),
            ]),
            const SizedBox(height: 4),
            const Text(
              'A negative variance was detected. You must provide an explanation before this workspace can proceed to audit review.',
              style: TextStyle(fontSize: 12, color: Colors.black87),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: _explanationReason,
              decoration: const InputDecoration(labelText: 'Reason Category', border: OutlineInputBorder()),
              items: _reasons.map((r) => DropdownMenuItem(value: r.$1, child: Text(r.$2))).toList(),
              onChanged: (v) => setState(() => _explanationReason = v!),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _explanationController,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Explanation (min 20 characters)',
                border: OutlineInputBorder(),
                hintText: 'Explain the variance in detail. Include what happened, when, and any corrective action taken.',
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _submitting ? null : _submitExplanation,
                icon: _submitting ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(Icons.send),
                label: Text(_submitting ? 'Submitting...' : 'Submit Explanation to Auditor'),
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.kPrimary, foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 14)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSubmitButton() {
    final status = _dailyRecord?['status'] as String? ?? '';
    if (status == 'SUBMITTED' || status == 'REVIEWED') {
      return Card(
        color: const Color(0xFFF0FDF4),
        child: ListTile(
          leading: const Icon(Icons.check_circle, color: Colors.green),
          title: Text('Workspace already $status'),
          subtitle: const Text('No further action needed from you.'),
        ),
      );
    }
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: (_submitting || _dailyRecord == null) ? null : _submitClose,
        icon: _submitting
            ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
            : const Icon(Icons.lock_outline),
        label: Text(_submitting ? 'Processing...' : 'Submit & Close Daily Workspace'),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.kPrimary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  Widget _buildError() {
    return Card(
      color: const Color(0xFFFEF2F2),
      child: ListTile(
        leading: const Icon(Icons.error, color: Colors.red),
        title: Text(_error!, style: const TextStyle(color: Colors.red, fontSize: 13)),
        trailing: TextButton(onPressed: _loadData, child: const Text('Retry')),
      ),
    );
  }

  Widget _infoRow(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, color: Colors.black87)),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: valueColor ?? Colors.black87)),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _explanationController.dispose();
    super.dispose();
  }
}
