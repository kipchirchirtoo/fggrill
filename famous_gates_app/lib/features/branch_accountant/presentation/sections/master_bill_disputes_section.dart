import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../pos/data/outlet_pos_repository.dart';

class MasterBillDisputesSection extends ConsumerStatefulWidget {
  const MasterBillDisputesSection({super.key});

  @override
  ConsumerState<MasterBillDisputesSection> createState() =>
      _MasterBillDisputesSectionState();
}

class _MasterBillDisputesSectionState
    extends ConsumerState<MasterBillDisputesSection> {
  bool _loading = true;
  bool _busy = false;
  String? _error;
  List<CrossOutletSettlement> _disputes = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  String _money(num v) => 'KES ${v.toStringAsFixed(0)}';

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(outletPosRepositoryProvider);
      final items = await repo.getCrossOutletSettlements(status: 'disputed');
      if (!mounted) return;
      setState(() {
        _disputes = items;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  void _snack(String msg, {bool error = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: error ? Colors.red : Colors.green,
    ));
  }

  /// Option 1: Collect Additional Payment
  Future<void> _option1CollectPayment(CrossOutletSettlement s) async {
    final amtController = TextEditingController();
    final refController = TextEditingController();
    String method = 'mpesa';

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => AlertDialog(
          title: const Text('Option 1: Collect Additional Payment'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Master Bill: ${s.masterBillNumber ?? s.id}'),
                Text('Outlet: ${s.outletName ?? 'Supplying Outlet'}'),
                const SizedBox(height: 12),
                TextField(
                  controller: amtController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Additional Amount (KES)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: method,
                  decoration: const InputDecoration(
                    labelText: 'Payment Method',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'mpesa', child: Text('M-Pesa')),
                    DropdownMenuItem(value: 'cash', child: Text('Cash')),
                    DropdownMenuItem(value: 'card', child: Text('Card')),
                    DropdownMenuItem(value: 'room_charge', child: Text('Room Folio Charge')),
                  ],
                  onChanged: (v) {
                    if (v != null) setDlgState(() => method = v);
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: refController,
                  decoration: const InputDecoration(
                    labelText: 'M-Pesa Code / Room Number / Ref',
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Collect & Confirm'),
            ),
          ],
        ),
      ),
    );

    if (confirmed != true) return;
    final extraAmt = double.tryParse(amtController.text.trim()) ?? 0;
    if (extraAmt <= 0) {
      _snack('Please enter a valid amount', error: true);
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(outletPosRepositoryProvider).accountantResolveDisputedSettlement(
            settlementId: s.id,
            action: 'option1_collect_additional_payment',
            additionalAmount: extraAmt,
            paymentMethod: method,
            reference: refController.text.trim(),
          );
      _snack('Option 1 executed successfully! Additional payment recorded.');
      await _load();
    } catch (e) {
      _snack('Failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Option 2: Re-allocate Settlement Shares
  Future<void> _option2ReallocateShares(CrossOutletSettlement s) async {
    final amtController = TextEditingController(text: '${s.amount}');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Option 2: Re-allocate Settlement Share'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Master Bill: ${s.masterBillNumber ?? s.id}'),
            Text('Outlet: ${s.outletName ?? 'Supplying Outlet'}'),
            const SizedBox(height: 12),
            TextField(
              controller: amtController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Corrected Outlet Share (KES)',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Re-allocate & Confirm'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    final newAmt = double.tryParse(amtController.text.trim()) ?? 0;
    setState(() => _busy = true);
    try {
      await ref.read(outletPosRepositoryProvider).accountantResolveDisputedSettlement(
            settlementId: s.id,
            action: 'option2_reallocate_shares',
            newAllocations: [
              {'outlet_id': s.id, 'amount': newAmt}
            ],
          );
      _snack('Option 2 executed! Shares re-allocated.');
      await _load();
    } catch (e) {
      _snack('Failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Option 3: Authorize Manager Void / Discount
  Future<void> _option3AuthorizeVoid(CrossOutletSettlement s) async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Option 3: Authorize Manager Void / Discount'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Master Bill: ${s.masterBillNumber ?? s.id}'),
            Text('Disputed Amount: ${_money(s.amount)}'),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              maxLines: 3,
              decoration: const InputDecoration(
                labelText: 'Manager Void / Discount Justification Reason',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.orange.shade800),
            child: const Text('Authorize Void'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    final reason = reasonController.text.trim();
    if (reason.isEmpty) {
      _snack('Please provide a void justification reason', error: true);
      return;
    }

    setState(() => _busy = true);
    try {
      await ref.read(outletPosRepositoryProvider).accountantResolveDisputedSettlement(
            settlementId: s.id,
            action: 'option3_authorize_void_discount',
            voidReason: reason,
          );
      _snack('Option 3 executed! Manager void logged and dispute resolved.');
      await _load();
    } catch (e) {
      _snack('Failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.gavel, color: Colors.orange),
              const SizedBox(width: 8),
              Text(
                'Master Bill Disputes Resolution Workbench',
                style: theme.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.bold),
              ),
              const Spacer(),
              IconButton(
                onPressed: _busy ? null : _load,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Branch Accountant & Auditor Control Center for Resolving Disputed Cross-Outlet Master Bills',
            style: theme.textTheme.bodyMedium?.copyWith(color: Colors.grey.shade700),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Text('Failed to load: $_error',
                            style: const TextStyle(color: Colors.red)))
                    : _disputes.isEmpty
                        ? const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.check_circle_outline,
                                    size: 48, color: Colors.green),
                                SizedBox(height: 12),
                                Text(
                                  'No pending master bill disputes across any branch outlets.',
                                  style: TextStyle(fontSize: 16, color: Colors.grey),
                                ),
                              ],
                            ),
                          )
                        : ListView.separated(
                            itemCount: _disputes.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 16),
                            itemBuilder: (_, i) {
                              final s = _disputes[i];
                              return Card(
                                elevation: 3,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  side: BorderSide(color: Colors.orange.shade300),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(16.0),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            s.masterBillNumber ?? 'Master Bill',
                                            style: theme.textTheme.titleLarge
                                                ?.copyWith(
                                                    fontWeight: FontWeight.bold),
                                          ),
                                          const Spacer(),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 12, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: Colors.red.shade100,
                                              borderRadius:
                                                  BorderRadius.circular(20),
                                            ),
                                            child: const Text(
                                              'DISPUTED',
                                              style: TextStyle(
                                                  color: Colors.red,
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 12),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        'Customer: ${s.customerName}${s.tableNumber != null ? ' • Table ${s.tableNumber}' : ''}',
                                        style: theme.textTheme.bodyMedium,
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        'Supplying Outlet: ${s.outletName ?? 'Outlet'} • Collected by ${s.settlementCashierName ?? 'Origin Cashier'} (${s.originOutletName ?? 'Origin Outlet'})',
                                        style: TextStyle(
                                            color: Colors.grey.shade800,
                                            fontWeight: FontWeight.w600),
                                      ),
                                      const SizedBox(height: 8),
                                      Container(
                                        padding: const EdgeInsets.all(12),
                                        decoration: BoxDecoration(
                                          color: Colors.red.shade50,
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(
                                              color: Colors.red.shade200),
                                        ),
                                        child: Row(
                                          children: [
                                            const Icon(Icons.warning,
                                                color: Colors.red, size: 20),
                                            const SizedBox(width: 8),
                                            Expanded(
                                              child: Text(
                                                'Dispute Reason: ${s.disputeReason ?? 'Reason omitted'}',
                                                style: const TextStyle(
                                                    color: Colors.red,
                                                    fontWeight: FontWeight.w700),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 12),
                                      Text(
                                        'Disputed Share Amount: ${_money(s.amount)}',
                                        style: theme.textTheme.titleMedium
                                            ?.copyWith(
                                                fontWeight: FontWeight.extrabold,
                                                color: Colors.blue.shade900),
                                      ),
                                      const SizedBox(height: 16),
                                      const Divider(),
                                      const SizedBox(height: 8),
                                      Text('Accountant Resolution Actions:',
                                          style: theme.textTheme.titleSmall
                                              ?.copyWith(
                                                  fontWeight: FontWeight.bold)),
                                      const SizedBox(height: 8),
                                      Wrap(
                                        spacing: 8,
                                        runSpacing: 8,
                                        children: [
                                          ElevatedButton.icon(
                                            onPressed: _busy
                                                ? null
                                                : () => _option1CollectPayment(s),
                                            icon: const Icon(Icons.payments, size: 16),
                                            label: const Text('Option 1: Collect Addl Payment'),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.green.shade700,
                                              foregroundColor: Colors.white,
                                            ),
                                          ),
                                          ElevatedButton.icon(
                                            onPressed: _busy
                                                ? null
                                                : () => _option2ReallocateShares(s),
                                            icon: const Icon(Icons.pie_chart, size: 16),
                                            label: const Text('Option 2: Reallocate Shares'),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.blue.shade700,
                                              foregroundColor: Colors.white,
                                            ),
                                          ),
                                          ElevatedButton.icon(
                                            onPressed: _busy
                                                ? null
                                                : () => _option3AuthorizeVoid(s),
                                            icon: const Icon(Icons.block, size: 16),
                                            label: const Text('Option 3: Authorize Void'),
                                            style: ElevatedButton.styleFrom(
                                              backgroundColor: Colors.orange.shade800,
                                              foregroundColor: Colors.white,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
          ),
        ],
      ),
    );
  }
}
