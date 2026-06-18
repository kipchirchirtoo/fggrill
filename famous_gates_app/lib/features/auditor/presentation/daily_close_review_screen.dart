import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../data/repository.dart';

final _fmt = NumberFormat('#,##0.00', 'en_KE');
String _fmtN(dynamic v) =>
    _fmt.format(double.tryParse(v?.toString() ?? '0') ?? 0);

double _dbl(dynamic v) => double.tryParse(v?.toString() ?? '0') ?? 0;

/// AUDITOR DAILY CLOSE REVIEW SCREEN
/// Shows Branch Accountant submitted values vs Lina AI computed values
/// Highlights discrepancies and allows auditor to approve or flag
class DailyCloseReviewScreen extends ConsumerStatefulWidget {
  const DailyCloseReviewScreen({super.key});

  @override
  ConsumerState<DailyCloseReviewScreen> createState() =>
      _DailyCloseReviewScreenState();
}

class _DailyCloseReviewScreenState
    extends ConsumerState<DailyCloseReviewScreen> {
  bool _loading = false;
  String? _error;
  List<Map<String, dynamic>> _submissions = [];
  String? _selectedSubmissionId;
  Map<String, dynamic>? _submissionDetail;
  bool _reviewing = false;

  @override
  void initState() {
    super.initState();
    _loadSubmissions();
  }

  Future<void> _loadSubmissions() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(auditorRepositoryProvider);
      final data = await repo.getWorkspaceSubmissions(status: 'submitted');
      if (mounted) {
        setState(() {
          _submissions = data;
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

  Future<void> _loadSubmissionDetail(String id) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(auditorRepositoryProvider);
      final detail = await repo.getWorkspaceSubmission(id);
      if (mounted) {
        setState(() {
          _submissionDetail = detail;
          _selectedSubmissionId = id;
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

  Future<void> _reviewSubmission({
    required bool approve,
    String? notes,
  }) async {
    if (_selectedSubmissionId == null) return;
    setState(() {
      _reviewing = true;
    });
    try {
      final repo = ref.read(auditorRepositoryProvider);
      await repo.reviewWorkspaceSubmission(
        _selectedSubmissionId!,
        approve ? 'approve' : 'flag',
        notes: notes,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(approve
              ? 'Submission approved successfully'
              : 'Submission flagged for review'),
          backgroundColor: approve ? Colors.green : Colors.orange,
        ));
        setState(() {
          _reviewing = false;
          _selectedSubmissionId = null;
          _submissionDetail = null;
        });
        _loadSubmissions();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _reviewing = false;
          _error = e.toString();
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_selectedSubmissionId != null && _submissionDetail != null) {
      return _buildDetailView();
    }

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        title: const Text('Daily Close Review'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadSubmissions,
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _buildError()
              : _submissions.isEmpty
                  ? _buildEmptyState()
                  : _buildSubmissionsList(),
    );
  }

  Widget _buildSubmissionsList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _submissions.length,
      itemBuilder: (context, index) {
        final submission = _submissions[index];
        final branchName = submission['branch']?['name'] ?? 'Unknown Branch';
        final recordDate = submission['record_date'] ?? '';
        final submittedBy = submission['submitted_by_name'] ?? 'Unknown';
        final submittedAt = submission['submitted_at'] ?? '';
        final hasVariance =
            (_dbl(submission['overall_variance'])).abs() > 1;

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            contentPadding: const EdgeInsets.all(16),
            leading: CircleAvatar(
              backgroundColor: hasVariance
                  ? Colors.orange.withValues(alpha: 0.2)
                  : Colors.green.withValues(alpha: 0.2),
              child: Icon(
                hasVariance ? Icons.warning_amber : Icons.check_circle,
                color: hasVariance ? Colors.orange : Colors.green,
              ),
            ),
            title: Text(
              '$branchName - $recordDate',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 4),
                Text('Submitted by: $submittedBy'),
                Text('Date: ${_formatDateTime(submittedAt)}'),
                if (hasVariance)
                  Text(
                    'Variance: KES ${_fmtN(submission['overall_variance'])}',
                    style: const TextStyle(
                        color: Colors.orange, fontWeight: FontWeight.w600),
                  ),
              ],
            ),
            trailing: const Icon(Icons.arrow_forward_ios, size: 16),
            onTap: () => _loadSubmissionDetail(submission['id']),
          ),
        );
      },
    );
  }

  Widget _buildDetailView() {
    final submission = _submissionDetail!;
    final branchName = submission['branch']?['name'] ?? 'Unknown Branch';
    final recordDate = submission['record_date'] ?? '';

    // Branch Accountant values
    final baRevenue = submission['submitted_revenue_data'] as Map? ?? {};
    final baPayments = submission['submitted_payment_data'] as Map? ?? {};
    final baBanking = submission['submitted_banking_data'] as Map? ?? {};
    final baCogs = submission['submitted_cogs_data'] as Map? ?? {};
    final baExpenses = submission['submitted_expense_data'] as Map? ?? {};

    // Lina AI values
    final linaRevenue = submission['lina_revenue_data'] as Map? ?? {};
    final linaPayments = submission['lina_payment_data'] as Map? ?? {};
    final linaBanking = submission['lina_banking_data'] as Map? ?? {};
    final linaCogs = submission['lina_cogs_data'] as Map? ?? {};
    final linaExpenses = submission['lina_expense_data'] as Map? ?? {};

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        title: Text('Review: $branchName'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => setState(() {
            _selectedSubmissionId = null;
            _submissionDetail = null;
          }),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildReviewHeader(recordDate, submission),
            const SizedBox(height: 16),
            _buildSectionHeader('Revenue Breakdown'),
            _buildComparisonCard('Restaurant', baRevenue, linaRevenue, 'restaurant'),
            _buildComparisonCard('Bar', baRevenue, linaRevenue, 'bar'),
            _buildComparisonCard('Executive Bar', baRevenue, linaRevenue, 'executive_bar'),
            _buildComparisonCard('Sports Bar', baRevenue, linaRevenue, 'sports_bar'),
            _buildComparisonCard('Pool Table', baRevenue, linaRevenue, 'pool_table'),
            _buildComparisonCard('Spa & Sauna', baRevenue, linaRevenue, 'spa_sauna'),
            _buildComparisonCard('Carwash', baRevenue, linaRevenue, 'carwash'),
            _buildComparisonCard('Conferences', baRevenue, linaRevenue, 'conferences'),
            _buildComparisonCard('Outside Catering', baRevenue, linaRevenue, 'outside_catering'),
            _buildComparisonCard('Rooms', baRevenue, linaRevenue, 'rooms'),
            _buildComparisonCard('Non-Consumables', baRevenue, linaRevenue, 'non_consumables'),
            _buildComparisonCard('Swimming Pool', baRevenue, linaRevenue, 'swimming_pool'),
            _buildComparisonCard('Other', baRevenue, linaRevenue, 'other'),
            const SizedBox(height: 16),
            _buildSectionHeader('Payment Collections'),
            _buildComparisonCard('Cash', baPayments, linaPayments, 'cash'),
            _buildComparisonCard('M-Pesa', baPayments, linaPayments, 'mpesa'),
            _buildComparisonCard('Card/Swipe', baPayments, linaPayments, 'swipe'),
            _buildComparisonCard('Credit Bills', baPayments, linaPayments, 'credit_bills'),
            const SizedBox(height: 16),
            _buildSectionHeader('Banking'),
            _buildComparisonCard('Amount Banked', baBanking, linaBanking, 'banked'),
            const SizedBox(height: 16),
            _buildSectionHeader('COGS'),
            _buildComparisonCard('Opening Balance', baCogs, linaCogs, 'opening_balance'),
            _buildComparisonCard('Central Store', baCogs, linaCogs, 'central_store_receipts'),
            _buildComparisonCard('Supplier Deliveries', baCogs, linaCogs, 'weekly_supplier_receipts'),
            _buildComparisonCard('Closing Balance', baCogs, linaCogs, 'closing_balance'),
            const SizedBox(height: 16),
            _buildSectionHeader('Expenses'),
            _buildComparisonCard('Petty Cash', baExpenses, linaExpenses, 'petty_cash_total'),
            _buildComparisonCard('Transaction Costs', baExpenses, linaExpenses, 'transaction_costs_total'),
            _buildComparisonCard('Direct Suppliers', baExpenses, linaExpenses, 'direct_suppliers_total'),
            _buildComparisonCard('Wastage', baExpenses, linaExpenses, 'wastage_total'),
            _buildComparisonCard('Shorts', baExpenses, linaExpenses, 'shorts_total'),
            _buildComparisonCard('Other Expenses', baExpenses, linaExpenses, 'other_expenses_total'),
            const SizedBox(height: 20),
            _buildReviewActions(),
            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }

  Widget _buildReviewHeader(String recordDate, Map submission) {
    final overallVariance = _dbl(submission['overall_variance']);
    final hasSignificantVariance = overallVariance.abs() > 100;

    return Card(
      color: hasSignificantVariance
          ? Colors.orange.withValues(alpha: 0.1)
          : Colors.green.withValues(alpha: 0.1),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  hasSignificantVariance
                      ? Icons.warning_amber
                      : Icons.check_circle,
                  color: hasSignificantVariance ? Colors.orange : Colors.green,
                  size: 28,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Daily Close: $recordDate',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Submitted by: ${submission['submitted_by_name'] ?? 'Unknown'}',
                        style: const TextStyle(fontSize: 13),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Overall Variance:',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                Text(
                  'KES ${_fmtN(overallVariance)}',
                  style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 16,
                      color: hasSignificantVariance
                          ? Colors.orange.shade700
                          : Colors.green.shade700),
                ),
              ],
            ),
            if (submission['explanation_notes'] != null) ...[
              const SizedBox(height: 12),
              const Text('Explanation:',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              const SizedBox(height: 4),
              Text(
                submission['explanation_notes'].toString(),
                style: const TextStyle(fontSize: 13),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 12),
      child: Text(
        title,
        style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: AppColors.kPrimary),
      ),
    );
  }

  Widget _buildComparisonCard(
    String label,
    Map baData,
    Map linaData,
    String key,
  ) {
    final baValue = _dbl(baData[key]);
    final linaValue = _dbl(linaData[key]);
    final variance = baValue - linaValue;
    final hasDiscrepancy = variance.abs() > 1;

    // Skip if both values are zero
    if (baValue == 0 && linaValue == 0) return const SizedBox.shrink();

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      color: hasDiscrepancy
          ? Colors.orange.withValues(alpha: 0.05)
          : Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    label,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                ),
                if (hasDiscrepancy)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.orange.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Text(
                      'DISCREPANCY',
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: Colors.orange),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Branch Accountant',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.blue),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'KES ${_fmtN(baValue)}',
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Colors.blue),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Lina AI (System)',
                        style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.purple),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'KES ${_fmtN(linaValue)}',
                        style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                            color: Colors.purple),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            if (hasDiscrepancy) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.orange.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Variance:',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                    Text(
                      '${variance > 0 ? '+' : ''}KES ${_fmtN(variance)}',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Colors.orange.shade700),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildReviewActions() {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: _reviewing
                ? null
                : () => _showApprovalDialog(approve: true),
            icon: const Icon(Icons.check_circle),
            label: const Text('Approve Daily Close'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              textStyle:
                  const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed:
                _reviewing ? null : () => _showApprovalDialog(approve: false),
            icon: const Icon(Icons.flag),
            label: const Text('Flag for Investigation'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.orange,
              side: const BorderSide(color: Colors.orange, width: 2),
              padding: const EdgeInsets.symmetric(vertical: 16),
              textStyle:
                  const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
          ),
        ),
      ],
    );
  }

  void _showApprovalDialog({required bool approve}) {
    final notesCtrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(approve ? 'Approve Submission' : 'Flag Submission'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              approve
                  ? 'Are you sure you want to approve this daily close submission?'
                  : 'Please provide notes for flagging this submission:',
              style: const TextStyle(fontSize: 14),
            ),
            if (!approve) ...[
              const SizedBox(height: 16),
              TextField(
                controller: notesCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Auditor Notes',
                  border: OutlineInputBorder(),
                  hintText: 'Explain why this submission is being flagged...',
                ),
              ),
            ],
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _reviewSubmission(
                approve: approve,
                notes: notesCtrl.text.trim().isEmpty
                    ? null
                    : notesCtrl.text.trim(),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: approve ? Colors.green : Colors.orange,
            ),
            child: Text(approve ? 'Approve' : 'Flag'),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.check_circle_outline,
              size: 80, color: Colors.grey.shade400),
          const SizedBox(height: 16),
          Text(
            'No pending daily close submissions',
            style: TextStyle(fontSize: 16, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 8),
          Text(
            'All submissions have been reviewed',
            style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
          ),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Card(
        margin: const EdgeInsets.all(16),
        color: Colors.red.shade50,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error, color: Colors.red, size: 48),
              const SizedBox(height: 16),
              Text(
                'Error loading submissions',
                style: const TextStyle(
                    fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 8),
              Text(_error!, style: const TextStyle(fontSize: 14)),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadSubmissions,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDateTime(String? datetime) {
    if (datetime == null || datetime.isEmpty) return '';
    try {
      final dt = DateTime.parse(datetime);
      return DateFormat('MMM d, yyyy h:mm a').format(dt);
    } catch (_) {
      return datetime;
    }
  }
}
