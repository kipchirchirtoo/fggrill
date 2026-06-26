import 'package:flutter/material.dart';
import '../models/shift_reconciliation_model.dart';
import 'shift_transactions_screen.dart';

class CashTransactionsScreen extends StatelessWidget {
  final ShiftReconciliationModel shift;

  const CashTransactionsScreen({super.key, required this.shift});

  @override
  Widget build(BuildContext context) {
    final cashTxs = shift.lines.where((l) => (l['payment_method'] ?? '').toString().toLowerCase() == 'cash').toList();
    return ShiftTransactionsScreen(
      shift: shift,
      initialTransactions: cashTxs,
      title: 'Cash Transactions Only',
    );
  }
}
