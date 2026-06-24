import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/repository.dart';

/// Store Stocktake Review — Branch Accountant.
/// Lists pending store stocktake submissions grouped by date and provides
/// Review / Approve / Reject actions. Approving one record batch-approves
/// all records for that date and updates branch_stock quantities.
class StoreStocktakeReviewScreen extends ConsumerStatefulWidget {
  const StoreStocktakeReviewScreen({super.key});

  @override
  ConsumerState<StoreStocktakeReviewScreen> createState() =>
      _StoreStocktakeReviewScreenState();
}

class _StoreStocktakeReviewScreenState
    extends ConsumerState<StoreStocktakeReviewScreen> {
  late Future<List<Map<String, dynamic>>> _future = _load();
  final Set<String> _busyIds = {};

  Future<List<Map<String, dynamic>>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getStoreStocktakeRecords(status: 'pending');

  void _refresh() => setState(() => _future = _load());

  num _num(dynamic v) => v == null ? 0 : (num.tryParse('$v') ?? 0);

  Future<String?> _askNotes(String title, String hint,
      {bool required = false}) async {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: ctrl,
          minLines: 2,
          maxLines: 4,
          decoration: InputDecoration(labelText: hint),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              final text = ctrl.text.trim();
              if (required && text.isEmpty) return;
              Navigator.pop(ctx, text);
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  Future<void> _runAction(
    List<String> ids,
    Future<void> Function(BranchAccountantRepository repo) action,
    String msg,
  ) async {
    setState(() => _busyIds.addAll(ids));
    try {
      await action(ref.read(branchAccountantRepositoryProvider));
      if (mounted) {
        _notify(context, msg);
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Action failed: $e');
    } finally {
      if (mounted) setState(() => _busyIds.removeAll(ids));
    }
  }

  Future<void> _review(List<String> ids) async {
    final notes = await _askNotes('Review Stocktake', 'Notes (optional)');
    if (notes == null) return;
    await _runAction(ids, (r) async {
      for (final id in ids) { await r.reviewStoreStocktake(id, notes: notes); }
    }, 'Stocktake reviewed');
  }

  Future<void> _approve(List<String> ids) async {
    final notes = await _askNotes('Approve Stocktake', 'Notes (optional)');
    if (notes == null) return;
    // Approving the first record batch-approves all (backend handles it)
    await _runAction(ids, (r) async {
      await r.approveStoreStocktake(ids.first, notes: notes);
    }, 'Stocktake approved — branch stock updated');
  }

  Future<void> _reject(List<String> ids) async {
    final notes = await _askNotes('Reject Stocktake',
        'Reason for rejection (required)',
        required: true);
    if (notes == null || notes.isEmpty) return;
    await _runAction(ids, (r) async {
      for (final id in ids) { await r.rejectStoreStocktake(id, notes: notes); }
    }, 'Stocktake rejected');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Store Stocktake Review'),
        actions: [
          IconButton(onPressed: _refresh, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final records = snap.data ?? [];
          final groups = <String, List<Map<String, dynamic>>>{};
          for (final r in records) {
            groups
                .putIfAbsent('${r['stocktake_date']}', () => [])
                .add(r);
          }
          if (groups.isEmpty) {
            return const Center(
                child: Text('No store stocktakes pending review.'));
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: groups.entries.map((entry) {
              final rows = entry.value;
              final ids = rows.map((r) => '${r['id']}').toList();
              final busy = rows.any((r) => _busyIds.contains('${r['id']}'));
              final shortages = rows.where((r) => _num(r['variance']) < 0);
              final shortageCount = shortages.length;
              return Card(
                margin: const EdgeInsets.only(bottom: 14),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Store — ${entry.key}',
                          style: const TextStyle(fontWeight: FontWeight.w800)),
                      const SizedBox(height: 4),
                      Text('${rows.length} items · $shortageCount shortages',
                          style: TextStyle(
                              color: shortageCount > 0
                                  ? Colors.red
                                  : Colors.green,
                              fontWeight: FontWeight.w700,
                              fontSize: 13)),
                      const SizedBox(height: 10),
                      for (final r in rows)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Row(
                            children: [
                              Expanded(
                                  child: Text(
                                      '${r['item_name'] ?? r['item_id']}',
                                      style: const TextStyle(fontSize: 13))),
                              Text(
                                '${_num(r['variance']) >= 0 ? '+' : ''}${r['variance']}',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: _num(r['variance']) < 0
                                      ? Colors.red
                                      : Colors.green,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Sys:${r['system_quantity']} Phy:${r['physical_quantity']}',
                                style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.kTextSecondary),
                              ),
                            ],
                          ),
                        ),
                      const SizedBox(height: 12),
                      Row(children: [
                        OutlinedButton(
                            onPressed: busy ? null : () => _reject(ids),
                            child: const Text('Reject')),
                        const SizedBox(width: 10),
                        OutlinedButton(
                            onPressed: busy ? null : () => _review(ids),
                            child: const Text('Review')),
                        const SizedBox(width: 10),
                        FilledButton(
                            onPressed: busy ? null : () => _approve(ids),
                            child: const Text('Approve')),
                      ]),
                    ],
                  ),
                ),
              );
            }).toList(),
          );
        },
      ),
    );
  }
}

void _notify(BuildContext context, String msg) =>
    AppNotifier.showSnackBar(context, SnackBar(content: Text(msg)));
