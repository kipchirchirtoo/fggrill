import 'package:flutter/material.dart';
import '../models/shift_reconciliation_model.dart';
import 'shift_transactions_screen.dart';

class MpesaTransactionsScreen extends StatelessWidget {
  final ShiftReconciliationModel shift;

  const MpesaTransactionsScreen({super.key, required this.shift});

  @override
  Widget build(BuildContext context) {
    final mpesaTxs = shift.lines.where((l) {
      final method = (l['payment_method'] ?? '').toString().toLowerCase();
      return method.contains('mpesa') || method.contains('m-pesa');
    }).toList();
    
    return ShiftTransactionsScreen(
      shift: shift,
      initialTransactions: mpesaTxs,
      title: 'M-Pesa Transactions Only',
    );
  }
}
