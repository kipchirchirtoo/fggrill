import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz; // KENYA TIME

import '../../../auth/domain/auth_notifier.dart';
import '../providers/shift_reconciliation_provider.dart';
import '../widgets/kpi_summary_bar.dart';
import '../widgets/cash_reconciliation_card.dart';
import '../widgets/payment_breakdown_card.dart';
import '../widgets/credit_bills_table.dart';
import '../widgets/transaction_summary_card.dart';
import '../widgets/variance_analysis_card.dart';
import '../widgets/variance_explanation_form.dart';
import '../widgets/shift_summary_card.dart';
import '../widgets/compliance_checklist_card.dart';
import '../widgets/accountant_workspace_card.dart';
import '../widgets/ai_insights_card.dart';
import '../widgets/audit_timeline_card.dart';
import '../widgets/reconciliation_action_bar.dart';
import 'shift_transactions_screen.dart';
import 'cash_transactions_screen.dart';
import 'mpesa_transactions_screen.dart';
import 'credit_bills_detail_screen.dart';
import 'credit_bill_detail_screen.dart';
import 'other_payments_screen.dart';
import '../models/reconciliation_payment_summary.dart';

class BranchAccountantShiftReconciliationScreen extends ConsumerStatefulWidget {
  final String shiftId;
  final String cashierId;

  const BranchAccountantShiftReconciliationScreen({
    super.key,
    required this.shiftId,
    required this.cashierId,
  });

  @override
  ConsumerState<BranchAccountantShiftReconciliationScreen> createState() =>
      _BranchAccountantShiftReconciliationScreenState();
}

class _BranchAccountantShiftReconciliationScreenState
    extends ConsumerState<BranchAccountantShiftReconciliationScreen> {

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(shiftReconciliationProvider(widget.shiftId));
    final notifier = ref.read(shiftReconciliationProvider(widget.shiftId).notifier);
    final userValue = ref.watch(authNotifierProvider).valueOrNull;

    // Check user roles
    final userRole = (userValue?.role ?? '').toString().toLowerCase();
    final isAccountant = userRole.contains('accountant') ||
        userRole.contains('manager') ||
        userRole.contains('admin') ||
        userRole.contains('auditor');

    final accountantName = userValue != null
        ? userValue.name
        : 'Branch Accountant';

    return state.shiftData.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (err, stack) => Scaffold(
        appBar: AppBar(title: const Text('Shift Reconciliation Error')),
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 48),
              const SizedBox(height: 12),
              Text('Error: $err', style: const TextStyle(color: Colors.red)),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => notifier.load(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (shift) {
        final double cashSales = shift.paymentBreakdown
            .firstWhere((p) => p.method.toLowerCase() == 'cash', orElse: () => ReconciliationPaymentSummary(method: 'cash', amount: 0, count: 0))
            .amount;
        final double expectedCash = shift.openingFloat + cashSales;
        final double variance = state.actualCash - expectedCash;
        final bool explanationComplete = variance == 0 || state.varianceExplanation.trim().length >= 30;

        // Convert open time to Kenya Date for App Bar
        final nairobi = tz.getLocation('Africa/Nairobi'); // KENYA TIME
        final startKenya = tz.TZDateTime.from(shift.shiftStart.toLocal(), nairobi); // KENYA TIME
        final dateStr = DateFormat('yyyy-MM-dd').format(startKenya);

        return Scaffold(
          backgroundColor: const Color(0xFFF1F5F9),
          appBar: AppBar(
            title: Text('Shift Reconciliation: ${shift.shiftNumber} ($dateStr)'),
            actions: [
              IconButton(
                icon: const Icon(Icons.print_rounded),
                tooltip: 'Print Report',
                onPressed: () {
                  _showToast('Printing report...');
                },
              ),
              IconButton(
                icon: const Icon(Icons.picture_as_pdf_rounded),
                tooltip: 'Export PDF',
                onPressed: () {
                  _showToast('Exporting PDF...');
                },
              ),
              IconButton(
                icon: const Icon(Icons.grid_on_rounded),
                tooltip: 'Export Excel',
                onPressed: () {
                  _showToast('Exporting Excel...');
                },
              ),
              IconButton(
                icon: const Icon(Icons.history_rounded),
                tooltip: 'Audit History',
                onPressed: () {
                  _showToast('Opening audit history...');
                },
              ),
            ],
          ),
          body: Column(
            children: [
              // KPI Summary Bar (sticky)
              KpiSummaryBar(
                shift: shift,
                actualCash: state.actualCash,
              ),
              // Main content
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(24),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Left Column (65% width)
                      Expanded(
                        flex: 65,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            CashReconciliationCard(
                              shift: shift,
                              actualCash: state.actualCash,
                              onActualCashChanged: notifier.updateActualCash,
                            ),
                            const SizedBox(height: 20),
                            PaymentBreakdownCard(
                              shift: shift,
                              onCashTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => CashTransactionsScreen(shift: shift)),
                                );
                              },
                              onMpesaTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => MpesaTransactionsScreen(shift: shift)),
                                );
                              },
                              onCreditTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => CreditBillsDetailScreen(shift: shift)),
                                );
                              },
                              onOtherTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => OtherPaymentsScreen(shift: shift)),
                                );
                              },
                            ),
                            const SizedBox(height: 20),
                            CreditBillsTable(
                              shift: shift,
                              onViewDetails: (bill) {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => CreditBillDetailScreen(
                                      bill: bill,
                                      shift: shift,
                                    ),
                                  ),
                                );
                              },
                            ),
                            const SizedBox(height: 20),
                            TransactionSummaryCard(
                              shift: shift,
                              onViewAll: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => ShiftTransactionsScreen(
                                      shift: shift,
                                      initialTransactions: shift.lines,
                                    ),
                                  ),
                                );
                              },
                              onExport: () {
                                _showToast('Exporting all transactions...');
                              },
                            ),
                            const SizedBox(height: 20),
                            VarianceAnalysisCard(variance: variance),
                            const SizedBox(height: 20),
                            VarianceExplanationForm(
                              variance: variance,
                              selectedReason: state.varianceReason,
                              onReasonChanged: notifier.updateVarianceReason,
                              explanation: state.varianceExplanation,
                              onExplanationChanged: notifier.updateVarianceExplanation,
                              notes: state.reconciliationNotes,
                              onNotesChanged: notifier.updateReconciliationNotes,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 24),
                      // Right Column (35% width)
                      Expanded(
                        flex: 35,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            ShiftSummaryCard(
                              shift: shift,
                              actualCash: state.actualCash,
                            ),
                            const SizedBox(height: 20),
                            ComplianceChecklistCard(
                              shift: shift,
                              actualCash: state.actualCash,
                              explanation: state.varianceExplanation,
                              notes: state.reconciliationNotes,
                            ),
                            const SizedBox(height: 20),
                            if (isAccountant)
                              AccountantWorkspaceCard(
                                accountantName: accountantName,
                                notes: state.reconciliationNotes,
                                onNotesChanged: notifier.updateReconciliationNotes,
                                onApprove: () async {
                                  final ok = await notifier.approveReconciliation();
                                  if (!context.mounted) return;
                                  if (ok) {
                                    _showToast('Reconciliation approved and closed.');
                                    Navigator.pop(context);
                                  } else {
                                    _showError(state.errorMessage ?? 'Approval failed.');
                                  }
                                },
                                onReject: (reason) async {
                                  final ok = await notifier.rejectReconciliation(reason);
                                  if (!context.mounted) return;
                                  if (ok) {
                                    _showToast('Reconciliation flagged and returned to cashier.');
                                    Navigator.pop(context);
                                  } else {
                                    _showError(state.errorMessage ?? 'Rejection failed.');
                                  }
                                },
                                onRequestRecount: () async {
                                  final ok = await notifier.rejectReconciliation('Recount Requested');
                                  if (!context.mounted) return;
                                  if (ok) {
                                    _showToast('Recount requested successfully.');
                                    Navigator.pop(context);
                                  } else {
                                    _showError(state.errorMessage ?? 'Request failed.');
                                  }
                                },
                              ),
                            const SizedBox(height: 20),
                            AiInsightsCard(
                              shift: shift,
                              actualCash: state.actualCash,
                            ),
                            const SizedBox(height: 20),
                            AuditTimelineCard(shift: shift),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // Sticky Bottom Action Bar
              ReconciliationActionBar(
                isAccountant: isAccountant,
                variance: variance,
                explanationComplete: explanationComplete,
                isSaving: state.isSaving,
                isSubmitting: state.isSubmitting,
                onSaveDraft: () async {
                  await notifier.saveDraft();
                  if (!context.mounted) return;
                  _showToast('Draft saved successfully.');
                },
                onSubmit: () async {
                  final ok = await notifier.submitReconciliation();
                  if (!context.mounted) return;
                  if (ok) {
                    _showToast('Shift reconciled successfully.');
                    Navigator.pop(context);
                  } else {
                    _showError(state.errorMessage ?? 'Reconciliation failed.');
                  }
                },
                onSendToAuditing: () async {
                  final ok = await notifier.submitReconciliation();
                  if (!context.mounted) return;
                  if (ok) {
                    _showToast('Sent for auditing successfully.');
                    Navigator.pop(context);
                  } else {
                    _showError(state.errorMessage ?? 'Failed to send for auditing.');
                  }
                },
                onApprove: () async {
                  final ok = await notifier.approveReconciliation();
                  if (!context.mounted) return;
                  if (ok) {
                    _showToast('Reconciliation approved and closed.');
                    Navigator.pop(context);
                  } else {
                    _showError(state.errorMessage ?? 'Approval failed.');
                  }
                },
                onReject: () async {
                  // Prompt for rejection reason is handled in the workspace card, this triggers same flow
                  final reason = state.varianceReason;
                  final ok = await notifier.rejectReconciliation(reason);
                  if (!context.mounted) return;
                  if (ok) {
                    _showToast('Reconciliation flagged.');
                    Navigator.pop(context);
                  } else {
                    _showError(state.errorMessage ?? 'Rejection failed.');
                  }
                },
                onRequestRecount: () async {
                  final ok = await notifier.rejectReconciliation('Recount Requested');
                  if (!context.mounted) return;
                  if (ok) {
                    _showToast('Recount requested.');
                    Navigator.pop(context);
                  } else {
                    _showError(state.errorMessage ?? 'Recount request failed.');
                  }
                },
                onLockArchive: () async {
                  final ok = await notifier.approveReconciliation();
                  if (!context.mounted) return;
                  if (ok) {
                    _showToast('Shift locked and archived.');
                    Navigator.pop(context);
                  } else {
                    _showError(state.errorMessage ?? 'Lock and archive failed.');
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }

  void _showToast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  void _showError(String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Error'),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}
