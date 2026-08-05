import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../core/theme/app_theme.dart';
import '../data/repository.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

final _fmt = NumberFormat('#,##0.00', 'en_KE');

String _money(dynamic v) =>
    'KES ${_fmt.format(double.tryParse(v?.toString() ?? '0') ?? 0)}';

double _d(dynamic v) => double.tryParse(v?.toString() ?? '0') ?? 0;

const _months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const _statusColors = <String, Color>{
  'draft': Color(0xFF6B7280),
  'submitted': Color(0xFFF59E0B),
  'auditor_review': Color(0xFF3B82F6),
  'director_visible': Color(0xFF8B5CF6),
  'approved': Color(0xFF14B8A6),
  'locked': Color(0xFF16A34A),
  'returned': Color(0xFFDC2626),
};

const _adjTypeOptions = ['addition', 'deduction'];

const _adjCategoryByType = <String, List<String>>{
  'addition': ['bonus', 'overtime', 'allowance', 'extra_day', 'contribution', 'other'],
  'deduction': [
    'advance', 'loan_installment', 'nssf', 'shif', 'paye', 'housing_levy',
    'uniform', 'absent_day', 'credit_bill', 'penalty', 'other',
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Main widget
// ─────────────────────────────────────────────────────────────────────────────

class BranchPayrollScreen extends ConsumerStatefulWidget {
  const BranchPayrollScreen({super.key});

  @override
  ConsumerState<BranchPayrollScreen> createState() =>
      _BranchPayrollScreenState();
}

class _BranchPayrollScreenState extends ConsumerState<BranchPayrollScreen> {
  int _month = DateTime.now().month;
  int _year = DateTime.now().year;

  bool _busy = false;
  bool _pdfBusy = false;
  bool _zipBusy = false;
  String? _error;

  List<Map<String, dynamic>> _batches = [];
  Map<String, dynamic>? _activeBatch;
  List<Map<String, dynamic>> _lines = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  // ── Data loading ────────────────────────────────────────────────────────────

  Future<void> _load() async {
    setState(() { _busy = true; _error = null; });
    try {
      final data = await ref.read(branchAccountantRepositoryProvider).getPayrollBatches();
      if (!mounted) return;
      setState(() { _batches = data; _busy = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _busy = false; });
    }
  }

  Future<void> _openBatch(String id) async {
    setState(() { _busy = true; });
    try {
      final result = await ref.read(branchAccountantRepositoryProvider).getPayrollBatch(id);
      final data = (result['data'] as Map<String, dynamic>?) ?? result;
      if (!mounted) return;
      setState(() {
        _activeBatch = data;
        _lines = (data['lines'] as List?)
            ?.whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList() ?? [];
        _busy = false;
      });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _busy = false; });
    }
  }

  Future<void> _generate() async {
    setState(() { _busy = true; _error = null; });
    try {
      final result = await ref.read(branchAccountantRepositoryProvider)
          .generatePayrollBatch(month: _month, year: _year);
      final data = (result['data'] as Map<String, dynamic>?) ?? result;
      if (!mounted) return;
      _showSnack(result['message']?.toString() ?? 'Payroll generated', success: true);
      setState(() {
        _activeBatch = data;
        _lines = (data['lines'] as List?)
            ?.whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList() ?? [];
        _busy = false;
      });
      await _load();
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _busy = false; });
    }
  }

  Future<void> _submit(String id) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Submit Payroll for Audit Review?'),
        content: const Text(
            'The batch will be locked and sent to the Auditor. You cannot edit it after submission.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Submit')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() { _busy = true; });
    try {
      await ref.read(branchAccountantRepositoryProvider).submitPayrollBatch(id);
      if (!mounted) return;
      _showSnack('Payroll submitted for audit review', success: true);
      await _load();
      if (_activeBatch != null) await _openBatch(_activeBatch!['id'] as String);
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _busy = false; });
    }
  }

  Future<void> _downloadPdf() async {
    final batch = _activeBatch;
    if (batch == null) return;
    setState(() { _pdfBusy = true; });
    try {
      final file = await ref.read(branchAccountantRepositoryProvider)
          .downloadPayrollBatchPdf(batch['id'] as String, batch['period_label'] as String? ?? 'Payroll');
      if (!mounted) return;
      _showSnack('PDF saved to: ${file.path}', success: true);
    } catch (e) {
      if (mounted) _showSnack('PDF error: $e');
    } finally {
      if (mounted) setState(() { _pdfBusy = false; });
    }
  }

  Future<void> _downloadPayslipsZip() async {
    final batch = _activeBatch;
    if (batch == null) {
      _showSnack('Open or generate a payroll batch first');
      return;
    }
    setState(() { _zipBusy = true; });
    try {
      final file = await ref.read(branchAccountantRepositoryProvider)
          .downloadBatchPayslipsZip(
              batch['id'] as String, batch['period_label'] as String? ?? 'Payroll');
      if (!mounted) return;
      _showSnack('Payslips ZIP saved to: ${file.path}', success: true);
    } catch (e) {
      if (mounted) _showSnack('Payslips ZIP error: $e');
    } finally {
      if (mounted) setState(() { _zipBusy = false; });
    }
  }

  void _showSnack(String msg, {bool success = false}) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: success ? AppColors.kSuccess : AppColors.kError,
    ));
  }

  void _showPolicyDialog() {
    showDialog(context: context, builder: (_) => const _PolicyDialog());
  }

  void _showBreakdownDialog(Map<String, dynamic> line) {
    showDialog(context: context, builder: (_) => _DeductionBreakdownDialog(line: line));
  }

  void _showAdjustmentDialog(Map<String, dynamic> line) {
    final batch = _activeBatch;
    if (batch == null) return;
    showDialog<bool>(
      context: context,
      builder: (_) => _AddAdjustmentDialog(
        line: line,
        batchMonth: batch['period_month'] as int? ?? DateTime.now().month,
        batchYear: batch['period_year'] as int? ?? DateTime.now().year,
        repo: ref.read(branchAccountantRepositoryProvider),
      ),
    ).then((saved) {
      if (saved == true && _activeBatch != null) {
        _showSnack('Adjustment submitted for approval', success: true);
        _openBatch(_activeBatch!['id'] as String);
      }
    });
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      _header(),
      Expanded(
        child: _busy
            ? const Center(child: CircularProgressIndicator())
            : _activeBatch != null
                ? _detailView()
                : _listView(),
      ),
    ]);
  }

  // ── Header ──────────────────────────────────────────────────────────────────

  Widget _header() {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.kPrimary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(PhosphorIcons.money(), color: AppColors.kPrimary),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Branch Payroll Workspace',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.kTextPrimary)),
            const Text('Generate · Review · Submit to Auditor',
                style: TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
          ]),
        ),
        if (_activeBatch != null) ...[
          TextButton.icon(
            onPressed: () => setState(() { _activeBatch = null; _lines = []; }),
            icon: const Icon(Icons.arrow_back, size: 16),
            label: const Text('All Batches'),
          ),
          const SizedBox(width: 4),
        ],
        IconButton(
          tooltip: 'Payroll Policy',
          onPressed: _showPolicyDialog,
          icon: Icon(PhosphorIcons.bookOpen(), color: AppColors.kPrimary),
        ),
        IconButton(
            tooltip: 'Refresh',
            onPressed: _busy ? null : _load,
            icon: const Icon(Icons.refresh)),
      ]),
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────

  Widget _listView() {
    final totalGross = _batches.fold(0.0, (s, b) => s + _d(b['total_gross']));
    final totalNet = _batches.fold(0.0, (s, b) => s + _d(b['total_net']));
    final totalHead = _batches.fold(0, (s, b) => s + (b['headcount'] as int? ?? 0));
    final flagged = _batches.where((b) => b['has_ghost_flag'] == true || b['has_spike_flag'] == true).length;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_error != null) _errorBanner(),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SizedBox(
              width: 180,
              child: DropdownButtonFormField<int>(
                initialValue: _month,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Month'),
                items: [
                  for (var i = 0; i < _months.length; i++)
                    DropdownMenuItem(value: i + 1, child: Text(_months[i])),
                ],
                onChanged: _busy ? null : (v) => setState(() => _month = v!),
              ),
            ),
            SizedBox(
              width: 120,
              child: DropdownButtonFormField<int>(
                initialValue: _year,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Year'),
                items: [
                  for (var y = DateTime.now().year - 2; y <= DateTime.now().year + 1; y++)
                    DropdownMenuItem(value: y, child: Text('$y')),
                ],
                onChanged: _busy ? null : (v) => setState(() => _year = v!),
              ),
            ),
            ElevatedButton.icon(
              onPressed: _busy ? null : _generate,
              icon: const Icon(Icons.calculate, size: 16),
              label: const Text('Generate Payroll'),
            ),
          ],
        ),
        const SizedBox(height: 20),
        if (_batches.isNotEmpty) ...[
          LayoutBuilder(builder: (context, constraints) {
            final cols = constraints.maxWidth < 560 ? 1 : (constraints.maxWidth < 980 ? 2 : 4);
            final cardW = (constraints.maxWidth - ((cols - 1) * 12)) / cols;
            final cards = [
              _summaryCard('Total Gross', _money(totalGross), Icons.payments, AppColors.kPrimary),
              _summaryCard('Total Net Pay', _money(totalNet), Icons.check_circle, AppColors.kSuccess),
              _summaryCard('Total Headcount', '$totalHead staff', Icons.people, const Color(0xFF6366F1)),
              _summaryCard('Flagged Batches', '$flagged batch${flagged == 1 ? '' : 'es'}', Icons.flag, flagged > 0 ? AppColors.kError : AppColors.kSuccess),
            ];
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: cards.map((c) => SizedBox(width: cardW, height: 104, child: c)).toList(),
            );
          }),
          const SizedBox(height: 20),
        ],
        _batchTable(),
      ]),
    );
  }

  Widget _summaryCard(String title, String value, IconData icon, Color color) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(children: [
          Container(
            width: 44, height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
                const SizedBox(height: 4),
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
              ],
            ),
          ),
        ]),
      ),
    );
  }

  Widget _batchTable() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: Row(children: [
            const Expanded(
              child: Text('Payroll Batches',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
            ),
            Text('${_batches.length} batch${_batches.length == 1 ? '' : 'es'}',
                style: const TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
          ]),
        ),
        const Divider(height: 1),
        if (_batches.isEmpty)
          const Padding(
            padding: EdgeInsets.all(32),
            child: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Icon(Icons.inbox_outlined, size: 40, color: AppColors.kTextSecondary),
                SizedBox(height: 8),
                Text('No payroll batches yet',
                    style: TextStyle(color: AppColors.kTextSecondary)),
                SizedBox(height: 4),
                Text('Select a month and click Generate Payroll',
                    style: TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
              ]),
            ),
          )
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
              columns: const [
                DataColumn(label: Text('Period')),
                DataColumn(label: Text('Headcount')),
                DataColumn(label: Text('Gross Pay')),
                DataColumn(label: Text('Net Pay')),
                DataColumn(label: Text('PAYE')),
                DataColumn(label: Text('vs Prev')),
                DataColumn(label: Text('Flags')),
                DataColumn(label: Text('Status')),
                DataColumn(label: Text('')),
              ],
              rows: _batches.map((b) {
                final status = b['status'] as String? ?? 'draft';
                final hasFlags = b['has_ghost_flag'] == true || b['has_spike_flag'] == true;
                final variance = _d(b['variance_vs_prev']);
                return DataRow(cells: [
                  DataCell(Text(b['period_label'] ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w600))),
                  DataCell(Text('${b['headcount'] ?? 0}')),
                  DataCell(Text(_money(b['total_gross']))),
                  DataCell(Text(_money(b['total_net']),
                      style: const TextStyle(fontWeight: FontWeight.w700))),
                  DataCell(Text(_money(b['total_paye']))),
                  DataCell(b['variance_vs_prev'] == null
                      ? const Text('—', style: TextStyle(color: AppColors.kTextSecondary))
                      : Text(
                          '${variance >= 0 ? '+' : ''}${_money(variance)}',
                          style: TextStyle(
                            fontSize: 12,
                            color: variance > 0 ? AppColors.kWarning : AppColors.kSuccess,
                          ),
                        )),
                  DataCell(hasFlags
                      ? Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(Icons.flag, size: 14, color: AppColors.kError),
                          const SizedBox(width: 4),
                          Text(
                            '${b['has_ghost_flag'] == true ? 'Ghost ' : ''}${b['has_spike_flag'] == true ? 'Spike' : ''}'.trim(),
                            style: TextStyle(fontSize: 11, color: AppColors.kError),
                          ),
                        ])
                      : const Text('—', style: TextStyle(color: AppColors.kTextSecondary))),
                  DataCell(_statusChip(status)),
                  DataCell(OutlinedButton(
                    onPressed: () => _openBatch(b['id'] as String),
                    child: const Text('Open'),
                  )),
                ]);
              }).toList(),
            ),
          ),
      ]),
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────────────

  Widget _detailView() {
    final batch = _activeBatch!;
    final status = batch['status'] as String? ?? 'draft';
    final canSubmit = status == 'draft';
    final isDraft = status == 'draft';
    final flags = (batch['flags_json'] as List?)
        ?.whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList() ?? [];

    final totalGross = _d(batch['total_gross']);
    final totalNet = _d(batch['total_net']);
    final totalPaye = _d(batch['total_paye']);
    final totalSha = _d(batch['total_sha']);
    final totalNssf = _d(batch['total_nssf']);
    final totalHousingFund = _d(batch['total_housing_fund']);
    final totalLoans = _d(batch['total_loans']);
    final totalAdvances = _d(batch['total_advances']);
    final totalCreditBills = _d(batch['total_credit_bills']);
    final headcount = batch['headcount'] as int? ?? 0;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_error != null) _errorBanner(),

        // ── Period header card ────────────────────────────────────────────
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: Text(batch['period_label'] ?? '',
                      style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: AppColors.kTextPrimary)),
                ),
                _statusChip(status),
                const SizedBox(width: 10),
                // ── Download PDF button
                _pdfBusy
                    ? const SizedBox(
                        width: 24, height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : OutlinedButton.icon(
                        onPressed: _downloadPdf,
                        icon: Icon(PhosphorIcons.filePdf(), size: 16, color: AppColors.kError),
                        label: const Text('PDF'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.kError,
                          side: BorderSide(color: AppColors.kError.withValues(alpha: 0.4)),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        ),
                      ),
                const SizedBox(width: 8),
                // ── Download all payslips as a ZIP
                _zipBusy
                    ? const SizedBox(
                        width: 24, height: 24,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : OutlinedButton.icon(
                        onPressed: _downloadPayslipsZip,
                        icon: const Icon(Icons.folder_zip_outlined, size: 16,
                            color: AppColors.kPrimary),
                        label: const Text('Payslips ZIP'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppColors.kPrimary,
                          side: BorderSide(
                              color: AppColors.kPrimary.withValues(alpha: 0.4)),
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 8),
                        ),
                      ),
              ]),
              const SizedBox(height: 16),
              LayoutBuilder(builder: (context, constraints) {
                const minCols = 2;
                final cols = constraints.maxWidth < 600 ? minCols : (constraints.maxWidth < 900 ? 3 : 5);
                final cardW = (constraints.maxWidth - ((cols - 1) * 12)) / cols;
                final cards = [
                  _summaryCard('Gross Pay', _money(totalGross), Icons.payments, AppColors.kPrimary),
                  _summaryCard('Net Pay', _money(totalNet), Icons.check_circle, AppColors.kSuccess),
                  _summaryCard('PAYE', _money(totalPaye), Icons.account_balance, AppColors.kWarning),
                  _summaryCard('SHA + NSSF', _money(totalSha + totalNssf), Icons.health_and_safety, const Color(0xFF6366F1)),
                  _summaryCard('Headcount', '$headcount staff', Icons.people, const Color(0xFF0EA5E9)),
                ];
                return Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: cards.map((c) => SizedBox(width: cardW, height: 96, child: c)).toList(),
                );
              }),
              const SizedBox(height: 12),
              // Deductions summary strip
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(children: [
                  if (totalHousingFund > 0) _dedChip('Housing Levy', _money(totalHousingFund), const Color(0xFF8B5CF6)),
                  if (totalAdvances > 0) _dedChip('Advances', _money(totalAdvances), AppColors.kError),
                  if (totalLoans > 0) _dedChip('Loan Repayments', _money(totalLoans), const Color(0xFFDC2626)),
                  if (totalCreditBills > 0) _dedChip('Credit Bills', _money(totalCreditBills), AppColors.kWarning),
                ]),
              ),
            ]),
          ),
        ),

        // ── Flags card ────────────────────────────────────────────────────
        if (flags.isNotEmpty) ...[
          const SizedBox(height: 16),
          Card(
            elevation: 0,
            color: AppColors.kError.withValues(alpha: 0.04),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: AppColors.kError.withValues(alpha: 0.25)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                child: Row(children: [
                  Icon(Icons.warning_amber_rounded, color: AppColors.kError, size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text('Payroll Flags Detected (${flags.length})',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14, color: AppColors.kError)),
                  ),
                ]),
              ),
              const Divider(height: 1),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  headingRowColor: WidgetStateProperty.all(AppColors.kError.withValues(alpha: 0.06)),
                  columns: const [
                    DataColumn(label: Text('Type')),
                    DataColumn(label: Text('Detail')),
                  ],
                  rows: flags.map((f) => DataRow(cells: [
                    DataCell(Row(mainAxisSize: MainAxisSize.min, children: [
                      Icon(_flagIcon(f['type'] as String? ?? ''), size: 14, color: AppColors.kError),
                      const SizedBox(width: 6),
                      Text(
                        (f['type'] as String? ?? '').toUpperCase(),
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 11, color: AppColors.kError),
                      ),
                    ])),
                    DataCell(SizedBox(
                      width: 540,
                      child: Text(f['detail'] as String? ?? '', style: const TextStyle(fontSize: 12)),
                    )),
                  ])).toList(),
                ),
              ),
            ]),
          ),
        ],

        // ── Staff lines table ─────────────────────────────────────────────
        const SizedBox(height: 16),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
              child: Row(children: [
                Expanded(
                  child: Row(children: [
                    const Text('Staff Payroll Lines',
                        style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                    const SizedBox(width: 8),
                    if (isDraft)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppColors.kWarning.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.kWarning.withValues(alpha: 0.3)),
                        ),
                        child: Text('Click Adjust to add bonus/deduction',
                            style: TextStyle(fontSize: 10, color: AppColors.kWarning, fontWeight: FontWeight.w600)),
                      ),
                  ]),
                ),
                Text('${_lines.length} staff',
                    style: const TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
              ]),
            ),
            const Divider(height: 1),
            if (_lines.isEmpty)
              const Padding(
                padding: EdgeInsets.all(28),
                child: Center(child: Text('No staff lines')),
              )
            else
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  columnSpacing: 18,
                  headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
                  columns: [
                    const DataColumn(label: Text('Staff')),
                    const DataColumn(label: Text('Emp #')),
                    const DataColumn(label: Text('Dept')),
                    const DataColumn(label: Text('Days')),
                    const DataColumn(label: Text('Basic')),
                    const DataColumn(label: Text('Gross')),
                    // Statutory deductions
                    const DataColumn(label: Text('PAYE')),
                    const DataColumn(label: Text('SHA')),
                    const DataColumn(label: Text('NSSF')),
                    const DataColumn(label: Text('Hsg Levy')),
                    // Voluntary / other deductions
                    const DataColumn(label: Text('Advance')),
                    const DataColumn(label: Text('Loan')),
                    const DataColumn(label: Text('Credit Bill')),
                    const DataColumn(label: Text('Absent')),
                    const DataColumn(label: Text('Uniform/Other')),
                    // Totals
                    const DataColumn(label: Text('Total Ded')),
                    const DataColumn(label: Text('Net Pay')),
                    const DataColumn(label: Text('vs Prev')),
                    const DataColumn(label: Text('Flag')),
                    const DataColumn(label: Text('Detail')),
                    if (isDraft) const DataColumn(label: Text('Adjust')),
                  ],
                  rows: _lines.map((line) {
                    final isFlagged = line['is_flagged'] == true;
                    final netVariance = line['net_variance'] != null ? _d(line['net_variance']) : null;
                    final advance = _d(line['advance_deduction']);
                    final loan = _d(line['loan_deduction']);
                    final creditBill = _d(line['credit_bill_deduction']);
                    final housingFund = _d(line['housing_fund_deduction']);
                    final absent = _d(line['absent_deduction']);
                    final uniformOther = _d(line['uniform_deduction']) + _d(line['other_deductions']);

                    Widget _dedCell(double val, {String? tooltip}) {
                      if (val == 0) return const Text('—', style: TextStyle(color: AppColors.kTextSecondary, fontSize: 12));
                      final w = Text(_money(val), style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626)));
                      return tooltip != null ? Tooltip(message: tooltip, child: w) : w;
                    }

                    return DataRow(
                      color: isFlagged
                          ? WidgetStateProperty.all(AppColors.kError.withValues(alpha: 0.04))
                          : null,
                      cells: [
                        // Staff name + designation
                        DataCell(SizedBox(
                          width: 150,
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(line['staff_name'] as String? ?? '',
                                  style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis),
                              if ((line['designation'] as String? ?? '').isNotEmpty)
                                Text(line['designation'] as String? ?? '',
                                    style: const TextStyle(fontSize: 10, color: AppColors.kTextSecondary),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis),
                            ],
                          ),
                        )),
                        // Employee number
                        DataCell(Text(line['staff_number'] as String? ?? '—',
                            style: const TextStyle(fontSize: 11, color: AppColors.kTextSecondary))),
                        // Department
                        DataCell(Text(line['department'] as String? ?? '—',
                            style: const TextStyle(fontSize: 12))),
                        // Days
                        DataCell(Text(
                            '${line['days_present']}/${line['working_days']}',
                            style: const TextStyle(fontSize: 12))),
                        // Basic salary
                        DataCell(Text(_money(line['basic_salary']),
                            style: const TextStyle(fontSize: 12))),
                        // Gross pay
                        DataCell(Text(_money(line['gross_salary']),
                            style: const TextStyle(fontWeight: FontWeight.w600))),
                        // PAYE with band tooltip
                        DataCell(Tooltip(
                          message: _payeBandLabel(_d(line['gross_salary'])),
                          child: Text(_money(line['paye']),
                              style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
                        )),
                        // SHA
                        DataCell(_dedCell(_d(line['sha']))),
                        // NSSF
                        DataCell(_dedCell(_d(line['nssf']))),
                        // Housing Fund / Levy
                        DataCell(_dedCell(housingFund, tooltip: 'Housing Fund: 1.5% of gross, capped KES 2,500')),
                        // Advance deduction
                        DataCell(_dedCell(advance, tooltip: 'Approved advance recovery')),
                        // Loan installment
                        DataCell(_dedCell(loan, tooltip: 'Monthly loan installment')),
                        // Credit bills
                        DataCell(_dedCell(creditBill, tooltip: 'Outstanding credit bills')),
                        // Absent day deduction
                        DataCell(_dedCell(absent, tooltip: 'Absent day deduction')),
                        // Uniform + other
                        DataCell(uniformOther > 0
                            ? Tooltip(
                                message: 'Uniform: ${_money(line['uniform_deduction'])}\nOther: ${_money(line['other_deductions'])}',
                                child: Text(_money(uniformOther),
                                    style: const TextStyle(fontSize: 12, color: Color(0xFFDC2626))),
                              )
                            : const Text('—', style: TextStyle(color: AppColors.kTextSecondary))),
                        // Total deductions
                        DataCell(Text(_money(line['total_deductions']),
                            style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFFDC2626)))),
                        // Net pay
                        DataCell(Text(
                          _money(line['net_pay']),
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: isFlagged ? AppColors.kError : AppColors.kSuccess,
                          ),
                        )),
                        // vs Previous
                        DataCell(netVariance == null
                            ? const Text('—', style: TextStyle(color: AppColors.kTextSecondary))
                            : Text(
                                '${netVariance >= 0 ? '+' : ''}${_money(netVariance)}',
                                style: TextStyle(
                                    fontSize: 11,
                                    color: netVariance.abs() > 1000
                                        ? AppColors.kWarning
                                        : AppColors.kTextSecondary),
                              )),
                        // Flag
                        DataCell(isFlagged
                            ? Tooltip(
                                message: line['flag_detail'] as String? ?? '',
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Icon(_flagIcon(line['flag_type'] as String? ?? ''),
                                      size: 14, color: AppColors.kError),
                                  const SizedBox(width: 4),
                                  Text(
                                    (line['flag_type'] as String? ?? '').toUpperCase(),
                                    style: const TextStyle(
                                        fontSize: 10,
                                        color: AppColors.kError,
                                        fontWeight: FontWeight.w700),
                                  ),
                                ]),
                              )
                            : const Text('—', style: TextStyle(color: AppColors.kTextSecondary))),
                        // Breakdown detail button
                        DataCell(IconButton(
                          tooltip: 'Full payslip breakdown',
                          icon: Icon(PhosphorIcons.magnifyingGlass(),
                              size: 18, color: AppColors.kPrimary),
                          onPressed: () => _showBreakdownDialog(line),
                        )),
                        // Adjust (draft only)
                        if (isDraft)
                          DataCell(OutlinedButton.icon(
                            onPressed: () => _showAdjustmentDialog(line),
                            icon: Icon(PhosphorIcons.plus(), size: 14),
                            label: const Text('Adjust', style: TextStyle(fontSize: 11)),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              minimumSize: const Size(0, 28),
                            ),
                          )),
                      ],
                    );
                  }).toList(),
                ),
              ),
          ]),
        ),

        // ── Submit button ─────────────────────────────────────────────────
        if (canSubmit) ...[
          const SizedBox(height: 20),
          FilledButton.icon(
            onPressed: _busy ? null : () => _submit(batch['id'] as String),
            icon: const Icon(Icons.send_rounded, size: 18),
            label: const Text('Submit Payroll for Audit Review'),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
        ],
        const SizedBox(height: 24),
      ]),
    );
  }

  // ── Shared widgets ──────────────────────────────────────────────────────────

  Widget _dedChip(String label, String value, Color color) {
    return Container(
      margin: const EdgeInsets.only(right: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(label, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w600)),
        const SizedBox(width: 6),
        Text(value, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w800)),
      ]),
    );
  }

  Widget _errorBanner() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Card(
        elevation: 0,
        color: AppColors.kError.withValues(alpha: 0.06),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: AppColors.kError.withValues(alpha: 0.25)),
        ),
        child: ListTile(
          leading: Icon(Icons.error_outline, color: AppColors.kError),
          title: Text(_error ?? '', style: TextStyle(color: AppColors.kError, fontSize: 12)),
          trailing: TextButton(onPressed: _load, child: const Text('Retry')),
        ),
      ),
    );
  }

  Widget _statusChip(String status) {
    final color = _statusColors[status] ?? const Color(0xFF6B7280);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Text(
        status.replaceAll('_', ' ').toUpperCase(),
        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: color),
      ),
    );
  }

  IconData _flagIcon(String type) {
    switch (type) {
      case 'ghost': return Icons.person_off;
      case 'spike': return Icons.trending_up;
      case 'duplicate': return Icons.copy_all;
      case 'large_overtime': return Icons.timer;
      default: return Icons.flag;
    }
  }

  String _payeBandLabel(double gross) {
    if (gross <= 24000) return 'PAYE Band: 0% (≤ KES 24,000)';
    if (gross <= 32333) return 'PAYE Band: 25% (KES 24,001–32,333)';
    if (gross <= 500000) return 'PAYE Band: 30% (KES 32,334–500,000)';
    if (gross <= 800000) return 'PAYE Band: 32.5% (KES 500,001–800,000)';
    return 'PAYE Band: 35% (> KES 800,000)';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy Dialog
// ─────────────────────────────────────────────────────────────────────────────

class _PolicyDialog extends StatelessWidget {
  const _PolicyDialog();

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SizedBox(
        width: 520,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.kPrimary,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(children: [
              Icon(PhosphorIcons.bookOpen(), color: Colors.white),
              const SizedBox(width: 12),
              const Expanded(
                child: Text('Payroll Policy — Kenya 2026',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close, color: Colors.white),
              ),
            ]),
          ),
          // Content
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                _policySection('Statutory Deductions', [
                  _PolicyRow('SHA (Social Health Auth.)', '2.75% of gross salary', 'Monthly contribution'),
                  _PolicyRow('NSSF', '6% of gross salary', 'Capped at KES 1,080 per month'),
                  _PolicyRow('PAYE', 'Progressive tax bands', 'See bands below'),
                ]),
                const SizedBox(height: 16),
                _policySection('PAYE Tax Bands (2026)', [
                  _PolicyRow('KES 0 – 24,000', '0%', 'Tax-free band'),
                  _PolicyRow('KES 24,001 – 32,333', '25%', 'Low income band'),
                  _PolicyRow('KES 32,334 – 500,000', '30%', 'Middle income band'),
                  _PolicyRow('KES 500,001 – 800,000', '32.5%', 'Upper middle band'),
                  _PolicyRow('Above KES 800,000', '35%', 'Top band'),
                ]),
                const SizedBox(height: 16),
                _policySection('Payroll Adjustments', [
                  _PolicyRow('Bonus / Addition', 'Created by branch accountant', 'Requires auditor approval'),
                  _PolicyRow('Deduction', 'Created by branch accountant', 'Requires auditor approval'),
                  _PolicyRow('Processing', 'Auto-synced to payroll draft', 'Applied on next generation'),
                ]),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.kWarning.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.kWarning.withValues(alpha: 0.3)),
                  ),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(Icons.info_outline, size: 16, color: AppColors.kWarning),
                    const SizedBox(width: 8),
                    const Expanded(
                      child: Text(
                        'All staff receive full month pay based on basic salary. Attendance is not deducted unless an explicit absent_day adjustment is added.',
                        style: TextStyle(fontSize: 12, color: AppColors.kTextSecondary),
                      ),
                    ),
                  ]),
                ),
              ]),
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Close'),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _policySection(String title, List<Widget> rows) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(title,
          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: AppColors.kTextPrimary)),
      const SizedBox(height: 8),
      Container(
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.kDivider),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const Divider(height: 1),
            rows[i],
          ],
        ]),
      ),
    ]);
  }
}

class _PolicyRow extends StatelessWidget {
  final String label;
  final String value;
  final String note;
  const _PolicyRow(this.label, this.value, this.note);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(children: [
        Expanded(
          flex: 3,
          child: Text(label,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.kTextPrimary)),
        ),
        Expanded(
          flex: 2,
          child: Text(value,
              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: AppColors.kPrimary)),
        ),
        Expanded(
          flex: 3,
          child: Text(note,
              style: const TextStyle(fontSize: 11, color: AppColors.kTextSecondary)),
        ),
      ]),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Deduction Breakdown Dialog
// ─────────────────────────────────────────────────────────────────────────────

class _DeductionBreakdownDialog extends StatelessWidget {
  final Map<String, dynamic> line;
  const _DeductionBreakdownDialog({required this.line});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,##0.00', 'en_KE');
    String m(dynamic v) => 'KES ${fmt.format(double.tryParse(v?.toString() ?? '0') ?? 0)}';

    final basic = _d(line['basic_salary']);
    final houseAllow = _d(line['house_allowance']);
    final transportAllow = _d(line['transport_allowance']);
    final otherAllow = _d(line['other_allowances']);
    final overtimePay = _d(line['overtime_pay']);
    final gross = _d(line['gross_salary']);
    final paye = _d(line['paye']);
    final sha = _d(line['sha']);
    final nssf = _d(line['nssf']);
    final housingFund = _d(line['housing_fund_deduction']);
    final loan = _d(line['loan_deduction']);
    final advance = _d(line['advance_deduction']);
    final creditBill = _d(line['credit_bill_deduction']);
    final absent = _d(line['absent_deduction']);
    final uniform = _d(line['uniform_deduction']);
    final other = _d(line['other_deductions']);
    final totalDed = _d(line['total_deductions']);
    final net = _d(line['net_pay']);

    final rows = <_BreakdownItem>[
      _BreakdownItem('Basic Salary', m(basic), isHeader: true, color: AppColors.kPrimary),
      if (houseAllow > 0) _BreakdownItem('+ House Allowance', m(houseAllow), color: AppColors.kSuccess),
      if (transportAllow > 0) _BreakdownItem('+ Transport Allowance', m(transportAllow), color: AppColors.kSuccess),
      if (otherAllow > 0) _BreakdownItem('+ Other Allowances', m(otherAllow), color: AppColors.kSuccess),
      if (overtimePay > 0) _BreakdownItem('+ Overtime Pay', m(overtimePay), color: AppColors.kSuccess),
      _BreakdownItem('Gross Pay', m(gross), isHeader: true, color: AppColors.kPrimary),
      _BreakdownItem('', '', isDivider: true),
      _BreakdownItem('PAYE Tax', '− ${m(paye)}', note: _payeBand(gross), color: AppColors.kError),
      _BreakdownItem('SHA (2.75%)', '− ${m(sha)}', color: AppColors.kError),
      _BreakdownItem('NSSF (6% capped KES 1,080)', '− ${m(nssf)}', color: AppColors.kError),
      if (housingFund > 0) _BreakdownItem('Housing Levy (1.5% capped KES 2,500)', '− ${m(housingFund)}', color: AppColors.kError),
      _BreakdownItem('', '', isDivider: true),
      if (advance > 0) _BreakdownItem('Advance Recovery', '− ${m(advance)}', note: 'Approved salary advance', color: AppColors.kError),
      if (loan > 0) _BreakdownItem('Loan Installment', '− ${m(loan)}', note: 'Monthly loan repayment', color: AppColors.kError),
      if (creditBill > 0) _BreakdownItem('Credit Bills', '− ${m(creditBill)}', note: 'Outstanding credit bills', color: AppColors.kError),
      if (absent > 0) _BreakdownItem('Absent Day Deduction', '− ${m(absent)}', color: AppColors.kError),
      if (uniform > 0) _BreakdownItem('Uniform Deduction', '− ${m(uniform)}', color: AppColors.kError),
      if (other > 0) _BreakdownItem('Other Deductions', '− ${m(other)}', color: AppColors.kError),
      _BreakdownItem('', '', isDivider: true),
      _BreakdownItem('Total Deductions', '− ${m(totalDed)}', isHeader: true, color: AppColors.kError),
      _BreakdownItem('NET PAY', m(net), isHeader: true, color: AppColors.kSuccess),
    ];

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SizedBox(
        width: 440,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.kPrimary,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(children: [
              Icon(PhosphorIcons.magnifyingGlass(), color: Colors.white),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Deduction Breakdown',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                  Text(line['staff_name'] as String? ?? '',
                      style: const TextStyle(color: Colors.white70, fontSize: 12)),
                ]),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close, color: Colors.white),
              ),
            ]),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(children: [
                for (final r in rows)
                  if (r.isDivider)
                    const Divider(height: 16)
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Row(children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(r.label,
                                  style: TextStyle(
                                      fontSize: r.isHeader ? 13 : 12,
                                      fontWeight: r.isHeader ? FontWeight.w800 : FontWeight.w500,
                                      color: AppColors.kTextPrimary)),
                              if (r.note != null)
                                Text(r.note!,
                                    style: const TextStyle(fontSize: 10, color: AppColors.kTextSecondary)),
                            ],
                          ),
                        ),
                        Text(r.value,
                            style: TextStyle(
                                fontSize: r.isHeader ? 14 : 12,
                                fontWeight: r.isHeader ? FontWeight.w900 : FontWeight.w600,
                                color: r.color ?? AppColors.kTextPrimary)),
                      ]),
                    ),
              ]),
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Align(
              alignment: Alignment.centerRight,
              child: FilledButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Close'),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  String _payeBand(double gross) {
    if (gross <= 24000) return '0% band';
    if (gross <= 32333) return '25% band';
    if (gross <= 500000) return '30% band';
    if (gross <= 800000) return '32.5% band';
    return '35% band';
  }
}

class _BreakdownItem {
  final String label;
  final String value;
  final String? note;
  final bool isHeader;
  final bool isDivider;
  final Color? color;
  const _BreakdownItem(this.label, this.value,
      {this.note, this.isHeader = false, this.isDivider = false, this.color});
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Adjustment Dialog
// ─────────────────────────────────────────────────────────────────────────────

class _AddAdjustmentDialog extends ConsumerStatefulWidget {
  final Map<String, dynamic> line;
  final int batchMonth;
  final int batchYear;
  final BranchAccountantRepository repo;

  const _AddAdjustmentDialog({
    required this.line,
    required this.batchMonth,
    required this.batchYear,
    required this.repo,
  });

  @override
  ConsumerState<_AddAdjustmentDialog> createState() => _AddAdjustmentDialogState();
}

class _AddAdjustmentDialogState extends ConsumerState<_AddAdjustmentDialog> {
  final _formKey = GlobalKey<FormState>();
  final _amountCtrl = TextEditingController();
  final _descCtrl = TextEditingController();

  String _type = 'addition';
  String? _category;
  bool _saving = false;

  List<String> get _categories => _adjCategoryByType[_type] ?? [];

  @override
  void initState() {
    super.initState();
    _category = _categories.first;
  }

  @override
  void dispose() {
    _amountCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await widget.repo.createPayrollAdjustment(
        staffId: widget.line['staff_id'] as String,
        type: _type,
        category: _category ?? 'other',
        amount: double.parse(_amountCtrl.text),
        description: _descCtrl.text.trim(),
        month: widget.batchMonth,
        year: widget.batchYear,
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error: $e'),
          backgroundColor: AppColors.kError,
        ));
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: SizedBox(
        width: 420,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Header
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.kPrimary,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
            ),
            child: Row(children: [
              Icon(PhosphorIcons.plus(), color: Colors.white),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Add Adjustment',
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15)),
                  Text(widget.line['staff_name'] as String? ?? '',
                      style: const TextStyle(color: Colors.white70, fontSize: 12)),
                ]),
              ),
              IconButton(
                onPressed: _saving ? null : () => Navigator.pop(context, false),
                icon: const Icon(Icons.close, color: Colors.white),
              ),
            ]),
          ),

          // Form
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _formKey,
                child: Column(children: [
                  // Info notice
                  Container(
                    padding: const EdgeInsets.all(10),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: AppColors.kWarning.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.kWarning.withValues(alpha: 0.3)),
                    ),
                    child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Icon(Icons.info_outline, size: 14, color: AppColors.kWarning),
                      const SizedBox(width: 6),
                      const Expanded(
                        child: Text(
                          'Adjustment will be submitted as PENDING and must be approved by the Auditor before it affects net pay.',
                          style: TextStyle(fontSize: 11, color: AppColors.kTextSecondary),
                        ),
                      ),
                    ]),
                  ),

                  // Type
                  DropdownButtonFormField<String>(
                    initialValue: _type,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Type *'),
                    items: _adjTypeOptions.map((t) => DropdownMenuItem(
                      value: t,
                      child: Row(children: [
                        Icon(
                          t == 'addition' ? Icons.add_circle_outline : Icons.remove_circle_outline,
                          size: 16,
                          color: t == 'addition' ? AppColors.kSuccess : AppColors.kError,
                        ),
                        const SizedBox(width: 8),
                        Text(t == 'addition' ? 'Addition (Bonus/Allowance)' : 'Deduction'),
                      ]),
                    )).toList(),
                    onChanged: _saving ? null : (v) => setState(() {
                      _type = v!;
                      _category = _categories.first;
                    }),
                  ),
                  const SizedBox(height: 12),

                  // Category
                  DropdownButtonFormField<String>(
                    initialValue: _category,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Category *'),
                    items: _categories.map((c) => DropdownMenuItem(
                      value: c,
                      child: Text(c.replaceAll('_', ' ').toUpperCase(),
                          style: const TextStyle(fontSize: 13)),
                    )).toList(),
                    onChanged: _saving ? null : (v) => setState(() => _category = v),
                    validator: (v) => v == null ? 'Select a category' : null,
                  ),
                  const SizedBox(height: 12),

                  // Amount
                  TextFormField(
                    controller: _amountCtrl,
                    enabled: !_saving,
                    decoration: const InputDecoration(
                      labelText: 'Amount (KES) *',
                      prefixText: 'KES ',
                    ),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    validator: (v) {
                      final amt = double.tryParse(v ?? '');
                      if (amt == null || amt <= 0) return 'Enter a valid amount > 0';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),

                  // Description
                  TextFormField(
                    controller: _descCtrl,
                    enabled: !_saving,
                    maxLines: 2,
                    decoration: const InputDecoration(
                      labelText: 'Description / Reason *',
                      hintText: 'e.g. Performance bonus Q2 2026',
                    ),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
                  ),
                  const SizedBox(height: 4),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Period: ${_months[widget.batchMonth - 1]} ${widget.batchYear}',
                      style: const TextStyle(fontSize: 11, color: AppColors.kTextSecondary),
                    ),
                  ),
                ]),
              ),
            ),
          ),

          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
              TextButton(
                onPressed: _saving ? null : () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                onPressed: _saving ? null : _save,
                icon: _saving
                    ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Icon(PhosphorIcons.checkCircle(), size: 16),
                label: Text(_saving ? 'Submitting…' : 'Submit for Approval'),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}
