import 'reconciliation_payment_summary.dart';
import 'reconciliation_credit_bill.dart';

class ShiftReconciliationModel {
  final String shiftId;
  final String shiftNumber;
  final String cashierId;
  final String cashierName;
  final DateTime shiftStart;
  final DateTime? shiftEnd;
  final String status;
  final double openingFloat;
  final double expectedClosingFloat;
  final double closingFloat;
  final double variance;
  final List<ReconciliationPaymentSummary> paymentBreakdown;
  final List<ReconciliationCreditBill> creditBills;
  final List<Map<String, dynamic>> lines; // Transaction lines
  final String? notes;
  final String? reconciliationNotes;
  final String? reconciledBy;
  final DateTime? reconciledAt;
  final String? branchName;
  final String? registerNumber;

  ShiftReconciliationModel({
    required this.shiftId,
    required this.shiftNumber,
    required this.cashierId,
    required this.cashierName,
    required this.shiftStart,
    this.shiftEnd,
    required this.status,
    required this.openingFloat,
    required this.expectedClosingFloat,
    required this.closingFloat,
    required this.variance,
    required this.paymentBreakdown,
    required this.creditBills,
    required this.lines,
    this.notes,
    this.reconciliationNotes,
    this.reconciledBy,
    this.reconciledAt,
    this.branchName,
    this.registerNumber,
  });

  ShiftReconciliationModel copyWith({
    String? shiftId,
    String? shiftNumber,
    String? cashierId,
    String? cashierName,
    DateTime? shiftStart,
    DateTime? shiftEnd,
    String? status,
    double? openingFloat,
    double? expectedClosingFloat,
    double? closingFloat,
    double? variance,
    List<ReconciliationPaymentSummary>? paymentBreakdown,
    List<ReconciliationCreditBill>? creditBills,
    List<Map<String, dynamic>>? lines,
    String? notes,
    String? reconciliationNotes,
    String? reconciledBy,
    DateTime? reconciledAt,
    String? branchName,
    String? registerNumber,
  }) {
    return ShiftReconciliationModel(
      shiftId: shiftId ?? this.shiftId,
      shiftNumber: shiftNumber ?? this.shiftNumber,
      cashierId: cashierId ?? this.cashierId,
      cashierName: cashierName ?? this.cashierName,
      shiftStart: shiftStart ?? this.shiftStart,
      shiftEnd: shiftEnd ?? this.shiftEnd,
      status: status ?? this.status,
      openingFloat: openingFloat ?? this.openingFloat,
      expectedClosingFloat: expectedClosingFloat ?? this.expectedClosingFloat,
      closingFloat: closingFloat ?? this.closingFloat,
      variance: variance ?? this.variance,
      paymentBreakdown: paymentBreakdown ?? this.paymentBreakdown,
      creditBills: creditBills ?? this.creditBills,
      lines: lines ?? this.lines,
      notes: notes ?? this.notes,
      reconciliationNotes: reconciliationNotes ?? this.reconciliationNotes,
      reconciledBy: reconciledBy ?? this.reconciledBy,
      reconciledAt: reconciledAt ?? this.reconciledAt,
      branchName: branchName ?? this.branchName,
      registerNumber: registerNumber ?? this.registerNumber,
    );
  }

  factory ShiftReconciliationModel.fromJson(Map<String, dynamic> json) {
    final shift = json['shift'] ?? json;
    
    // Parse payment breakdown
    final List<ReconciliationPaymentSummary> payments = [];
    if (json['payment_breakdown'] != null) {
      for (final item in json['payment_breakdown']) {
        payments.add(ReconciliationPaymentSummary.fromJson(item));
      }
    }

    // Parse credit bills
    final List<ReconciliationCreditBill> bills = [];
    if (json['credit_bills'] != null) {
      for (final item in json['credit_bills']) {
        bills.add(ReconciliationCreditBill.fromJson(item));
      }
    }

    // Parse lines
    final List<Map<String, dynamic>> txLines = [];
    if (json['lines'] != null) {
      for (final item in json['lines']) {
        txLines.add(Map<String, dynamic>.from(item));
      }
    } else if (json['transaction_history'] != null) {
      for (final item in json['transaction_history']) {
        txLines.add(Map<String, dynamic>.from(item));
      }
    }

    return ShiftReconciliationModel(
      shiftId: shift['id'] ?? '',
      shiftNumber: shift['shift_number'] ?? '',
      cashierId: shift['cashier_id'] ?? '',
      cashierName: shift['cashier_name'] ?? 'Unknown',
      shiftStart: DateTime.parse(shift['shift_start']),
      shiftEnd: shift['shift_end'] != null ? DateTime.parse(shift['shift_end']) : null,
      status: shift['status'] ?? 'closed',
      openingFloat: (shift['opening_float'] ?? 0).toDouble(),
      expectedClosingFloat: (shift['expected_closing_float'] ?? 0).toDouble(),
      closingFloat: (shift['closing_float'] ?? 0).toDouble(),
      variance: (shift['variance'] ?? 0).toDouble(),
      paymentBreakdown: payments,
      creditBills: bills,
      lines: txLines,
      notes: shift['notes'],
      reconciliationNotes: shift['reconciliation_notes'],
      reconciledBy: shift['reconciled_by'],
      reconciledAt: shift['reconciled_at'] != null ? DateTime.parse(shift['reconciled_at']) : null,
      branchName: shift['branch_name'] ?? 'Main Branch',
      registerNumber: shift['register_number']?.toString() ?? '1',
    );
  }
}
