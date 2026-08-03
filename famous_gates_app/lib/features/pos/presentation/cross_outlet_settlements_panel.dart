import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/outlet_pos_repository.dart';

/// Opens the cashier's Cross-Outlet Settlements screen: sub-bills of a master
/// bill that were collected by ANOTHER (origin) cashier and are waiting for
/// this outlet cashier to confirm (or dispute) their allocated amount. The
/// amount is read-only — the cashier can only confirm or dispute.
Future<void> showCrossOutletSettlementsPanel(BuildContext context) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    builder: (_) => const Dialog(
      insetPadding: EdgeInsets.all(24),
      child: SizedBox(width: 720, child: CrossOutletClearancesTab()),
    ),
  );
}

class CrossOutletClearancesTab extends ConsumerStatefulWidget {
  const CrossOutletClearancesTab({super.key});

  @override
  ConsumerState<CrossOutletClearancesTab> createState() =>
      _CrossOutletClearancesTabState();
}

class _CrossOutletClearancesTabState
    extends ConsumerState<CrossOutletClearancesTab> {
  bool _loading = true;
  bool _busy = false;
  String _filter = 'pending'; // pending | all
  String? _error;
  List<CrossOutletSettlement> _items = const [];

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
      final items = await repo.getCrossOutletSettlements(status: _filter);
      if (!mounted) return;
      setState(() {
        _items = items;
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

  Future<void> _confirm(CrossOutletSettlement s) async {
    setState(() => _busy = true);
    try {
      await ref
          .read(outletPosRepositoryProvider)
          .confirmCrossOutletSettlement(s.id);
      _snack('Confirmed ${_money(s.amount)} for ${s.outletName ?? 'your outlet'}.');
      await _load();
    } catch (e) {
      _snack('Confirm failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _dispute(CrossOutletSettlement s) async {
    final controller = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Dispute settlement'),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLines: 3,
          decoration: const InputDecoration(
            hintText: 'Why is this share wrong? (required)',
            border: OutlineInputBorder(),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text.trim()),
            child: const Text('Raise dispute'),
          ),
        ],
      ),
    );
    if (reason == null || reason.isEmpty) return;
    setState(() => _busy = true);
    try {
      await ref
          .read(outletPosRepositoryProvider)
          .disputeCrossOutletSettlement(settlementId: s.id, reason: reason);
      _snack('Dispute raised for ${s.masterBillNumber ?? 'bill'}.');
      await _load();
    } catch (e) {
      _snack('Dispute failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resolve(CrossOutletSettlement s, String resolution) async {
    setState(() => _busy = true);
    try {
      await ref
          .read(outletPosRepositoryProvider)
          .resolveDisputedSettlement(settlementId: s.id, resolution: resolution);
      _snack(resolution == 'reopen'
          ? 'Sent back to ${s.outletName ?? 'the outlet'} to re-confirm.'
          : 'Dispute resolved and confirmed.');
      await _load();
    } catch (e) {
      _snack('Resolve failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SizedBox(
      height: 560,
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Row(
              children: [
                const Icon(Icons.sync_alt),
                const SizedBox(width: 8),
                Expanded(
                  child: Text('Cross-Outlet Settlements',
                      style: theme.textTheme.titleLarge
                          ?.copyWith(fontWeight: FontWeight.w700)),
                ),
                IconButton(
                    onPressed: _busy ? null : _load,
                    icon: const Icon(Icons.refresh)),
                IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close)),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                ChoiceChip(
                  label: const Text('Pending confirmation'),
                  selected: _filter == 'pending',
                  onSelected: (_) {
                    setState(() => _filter = 'pending');
                    _load();
                  },
                ),
                const SizedBox(width: 8),
                ChoiceChip(
                  label: const Text('All'),
                  selected: _filter == 'all',
                  onSelected: (_) {
                    setState(() => _filter = 'all');
                    _load();
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          const Divider(height: 1),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(
                        child: Text('Failed to load: $_error',
                            style: const TextStyle(color: Colors.red)))
                    : _items.isEmpty
                        ? Center(
                            child: Text(
                                _filter == 'pending'
                                    ? 'Nothing to confirm — you\'re all settled.'
                                    : 'No cross-outlet settlements yet.',
                                style: const TextStyle(color: Colors.grey)))
                        : ListView.separated(
                            padding: const EdgeInsets.all(16),
                            itemCount: _items.length,
                            separatorBuilder: (_, __) =>
                                const SizedBox(height: 10),
                            itemBuilder: (_, i) =>
                                _settlementCard(_items[i], theme),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _settlementCard(CrossOutletSettlement s, ThemeData theme) {
    final (statusText, statusColor) = switch (s.status) {
      'cashier_confirmed' => ('Confirmed', Colors.green),
      'disputed' => ('Disputed', Colors.red),
      _ => ('Pending confirmation', Colors.orange),
    };
    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade300),
        borderRadius: BorderRadius.circular(12),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  s.masterBillNumber ?? 'Master bill',
                  style: theme.textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(statusText,
                    style: TextStyle(
                        fontSize: 11,
                        color: statusColor,
                        fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${s.customerName}${s.tableNumber != null ? ' • Table ${s.tableNumber}' : ''}',
            style: theme.textTheme.bodySmall,
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              Expanded(
                child: Text(
                  'Collected by ${s.settlementCashierName ?? 'origin cashier'}'
                  '${s.originOutletName != null ? ' (${s.originOutletName})' : ''}'
                  '${s.paymentMethod != null ? ' • ${s.paymentMethod!.toUpperCase()}' : ''}',
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: Colors.grey.shade700),
                ),
              ),
              Text('Your share: ${_money(s.amount)}',
                  style: theme.textTheme.titleMedium
                      ?.copyWith(fontWeight: FontWeight.w800)),
            ],
          ),
          if (s.isDisputed && s.disputeReason != null) ...[
            const SizedBox(height: 6),
            Text('Dispute: ${s.disputeReason}',
                style: const TextStyle(color: Colors.red, fontSize: 12)),
          ],
          // The collector resolves a dispute; the outlet cashier just waits.
          if (s.isDisputed && s.viewerIsCollector) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => _resolve(s, 'reopen'),
                    icon: const Icon(Icons.undo, size: 18),
                    label: const Text('Send back'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _busy ? null : () => _resolve(s, 'confirm'),
                    icon: const Icon(Icons.done_all, size: 18),
                    label: const Text('Resolve & confirm'),
                  ),
                ),
              ],
            ),
          ] else if (s.isDisputed) ...[
            const SizedBox(height: 6),
            Text('Awaiting ${s.settlementCashierName ?? 'the collecting cashier'} to resolve.',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
          ],
          if (s.isPending) ...[
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _busy ? null : () => _dispute(s),
                    icon: const Icon(Icons.flag_outlined, size: 18),
                    label: const Text('Dispute'),
                    style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton.icon(
                    onPressed: _busy ? null : () => _confirm(s),
                    icon: const Icon(Icons.check, size: 18),
                    label: const Text('Confirm'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
