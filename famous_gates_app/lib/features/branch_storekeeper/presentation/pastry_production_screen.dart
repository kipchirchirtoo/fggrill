import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/widgets/app_notifier.dart';
import '../data/branch_storekeeper_repository.dart';

/// Pastry Production — Branch Storekeeper. Items only appear in the Kitchen
/// Sessions ledger after explicit "Issue to Kitchen", not at log time.
class PastryProductionScreen extends ConsumerStatefulWidget {
  const PastryProductionScreen({super.key});

  @override
  ConsumerState<PastryProductionScreen> createState() =>
      _PastryProductionScreenState();
}

class _PastryProductionScreenState
    extends ConsumerState<PastryProductionScreen> {
  late Future<List<Map<String, dynamic>>> _future = _load();
  bool _issuing = false;

  Future<List<Map<String, dynamic>>> _load() => ref
      .read(branchStorekeeperRepositoryProvider)
      .pastryProduction(date: DateFormat('yyyy-MM-dd').format(DateTime.now()));

  void _refresh() => setState(() => _future = _load());

  Future<void> _issue(Map<String, dynamic> record) async {
    final openShifts = await ref
        .read(branchStorekeeperRepositoryProvider)
        .getKitchenShifts(status: 'open');
    if (!mounted) return;
    if (openShifts.isEmpty) {
      _notify(context, 'No open Kitchen Shift — open one in Kitchen Sessions first');
      return;
    }

    String? shiftId = openShifts.length == 1 ? '${openShifts.first['id']}' : null;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(builder: (ctx, setDialogState) {
        return AlertDialog(
          title: const Text('Issue to Kitchen'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                  'Issue ${record['quantity_produced']} of "${record['item_name'] ?? 'this item'}" into an open Kitchen Shift. This cannot be undone.'),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: shiftId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Kitchen Shift'),
                items: openShifts
                    .map((s) => DropdownMenuItem(
                          value: '${s['id']}',
                          child: Text('${s['shift_number'] ?? s['id']}'),
                        ))
                    .toList(),
                onChanged: (v) => setDialogState(() => shiftId = v),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel')),
            FilledButton(
                onPressed: shiftId == null ? null : () => Navigator.pop(ctx, true),
                child: const Text('Issue')),
          ],
        );
      }),
    );
    if (confirmed != true || shiftId == null) return;
    setState(() => _issuing = true);
    try {
      await ref
          .read(branchStorekeeperRepositoryProvider)
          .issuePastryToKitchen('${record['id']}', shiftId: shiftId!);
      if (mounted) {
        _notify(context, 'Issued to kitchen');
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Issue failed: $e');
    } finally {
      if (mounted) setState(() => _issuing = false);
    }
  }

  Future<void> _logProduction() async {
    final saved = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _LogProductionSheet(),
    );
    if (saved == true) _refresh();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pastry Production')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _logProduction,
        icon: const Icon(Icons.add),
        label: const Text('Log Production'),
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text('Failed to load: ${snap.error}'));
          }
          final items = snap.data ?? [];
          if (items.isEmpty) {
            return const Center(child: Text('No production logged today.'));
          }
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: items.length,
              itemBuilder: (context, i) {
                final item = items[i];
                final issued = item['issued_to_kitchen'] == true ||
                    '${item['status']}' == 'issued';
                return Card(
                  margin: const EdgeInsets.only(bottom: 10),
                  child: ListTile(
                    title: Text(
                        '${item['item']?['item_name'] ?? item['item_name'] ?? 'Pastry Item'}'),
                    subtitle: Text(
                      'Qty: ${item['quantity_produced']} · Shift: ${item['shift_id'] ?? '—'}',
                      style: const TextStyle(fontSize: 12),
                    ),
                    trailing: issued
                        ? Chip(
                            label: const Text('✅ Issued to Kitchen'),
                            backgroundColor: Colors.green.shade50,
                            labelStyle:
                                const TextStyle(color: Colors.green),
                          )
                        : OutlinedButton(
                            onPressed: _issuing ? null : () => _issue(item),
                            child: const Text('Issue to Kitchen'),
                          ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _LogProductionSheet extends ConsumerStatefulWidget {
  const _LogProductionSheet();

  @override
  ConsumerState<_LogProductionSheet> createState() =>
      _LogProductionSheetState();
}

class _LogProductionSheetState extends ConsumerState<_LogProductionSheet> {
  // Pastry items are a dedicated catalog slice (inventory_items.store_type
  // = 'pastry'), not branch_stock - most pastry SKUs never get a
  // branch_stock row since they're baked in-house, not received from a
  // supplier. Storekeeper/admin adds pastry items via inventory_items.
  late Future<List<Map<String, dynamic>>> _itemsFuture = ref
      .read(branchStorekeeperRepositoryProvider)
      .storeItems(storeType: 'pastry', limit: 500);
  String? _itemId;
  final _quantityCtrl = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _quantityCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final quantity = double.tryParse(_quantityCtrl.text.trim());
    if (_itemId == null || quantity == null || quantity <= 0) {
      _notify(context, 'Select an item and enter a valid quantity');
      return;
    }
    setState(() => _saving = true);
    try {
      await ref
          .read(branchStorekeeperRepositoryProvider)
          .recordPastryProduction(
            itemId: _itemId!,
            quantityProduced: quantity,
          );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) _notify(context, 'Failed to log production: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: 20 + MediaQuery.of(context).viewInsets.bottom,
      ),
      child: FutureBuilder<List<Map<String, dynamic>>>(
        future: _itemsFuture,
        builder: (context, snap) {
          final items = snap.data ?? [];
          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Log Production',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
              const SizedBox(height: 16),
              if (snap.connectionState == ConnectionState.waiting)
                const Center(child: CircularProgressIndicator())
              else if (items.isEmpty)
                const Text(
                  'No pastry items configured yet. Add items with '
                  "store_type = 'pastry' to inventory_items first.",
                  style: TextStyle(color: Colors.grey),
                )
              else
                DropdownButtonFormField<String>(
                  initialValue: _itemId,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Pastry Item'),
                  items: items
                      .map((i) => DropdownMenuItem(
                            value: '${i['id']}',
                            child:
                                Text('${i['item_name'] ?? i['name'] ?? 'Item'}'),
                          ))
                      .toList(),
                  onChanged: (v) => setState(() => _itemId = v),
                ),
              const SizedBox(height: 12),
              TextField(
                controller: _quantityCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Quantity'),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _saving ? null : _submit,
                  child: Text(_saving ? 'Submitting…' : 'Submit'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

void _notify(BuildContext context, String message) {
  AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
}
