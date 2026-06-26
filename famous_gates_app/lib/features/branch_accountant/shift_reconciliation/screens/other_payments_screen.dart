import 'package:flutter/material.dart';
import '../models/shift_reconciliation_model.dart';
import 'shift_transactions_screen.dart';

class OtherPaymentsScreen extends StatelessWidget {
  final ShiftReconciliationModel shift;

  const OtherPaymentsScreen({super.key, required this.shift});

  @override
  Widget build(BuildContext context) {
    final otherTxs = shift.lines.where((l) {
      final method = (l['payment_method'] ?? '').toString().toLowerCase();
      return method != 'cash' && !method.contains('mpesa') && !method.contains('m-pesa') && method != 'credit_bill' && method != 'credit';
    }).toList();
    
    return ShiftTransactionsScreen(
      shift: shift,
      initialTransactions: otherTxs,
      title: 'Card / Other Payments',
    );
  }
}
