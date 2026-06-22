import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/repository.dart';

/// Bar Stocktake Review — Branch Accountant. Approve/reject is
/// accountant-only; submission happens on the storekeeper side.
class BarStocktakeReviewScreen extends ConsumerStatefulWidget {
  const BarStocktakeReviewScreen({super.key});

  @override
  ConsumerState<BarStocktakeReviewScreen> createState() =>
      _BarStocktakeReviewScreenState();
}

class _BarStocktakeReviewScreenState
    extends ConsumerState<BarStocktakeReviewScreen> {
  late Future<List<Map<String, dynamic>>> _future = _load();
  final Set<String> _busyIds = {};

  Future<List<Map<String, dynamic>>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getBarStocktakeRecords(status: 'pending');

  void _refresh() => setState(() => _future = _load());

  Future<void> _approve(List<String> ids) async {
    setState(() => _busyIds.addAll(ids));
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      for (final id in ids) {
        await repo.approveBarStocktake(id);
      }
      if (mounted) {
        _notify(context, 'Bar stocktake approved');
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Approve failed: $e');
    } finally {
      if (mounted) setState(() => _busyIds.removeAll(ids));
    }
  }

  Future<void> _reject(List<String> ids) async {
    final ctrl = TextEditingController();
    final notes = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Bar Stocktake'),
        content: TextField(
          controller: ctrl,
          minLines: 2,
          maxLines: 4,
          decoration: const InputDecoration(labelText: 'Reason (required)'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
              child: const Text('Reject')),
        ],
      ),
    );
    if (notes == null || notes.isEmpty) return;
    setState(() => _busyIds.addAll(ids));
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      for (final id in ids) {
        await repo.rejectBarStocktake(id, notes: notes);
      }
      if (mounted) {
        _notify(context, 'Bar stocktake rejected');
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Reject failed: $e');
    } finally {
      if (mounted) setState(() => _busyIds.removeAll(ids));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bar Stocktake Review'),
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
          // Group flat item rows by (bar_location, stocktake_date) submission.
          final groups = <String, List<Map<String, dynamic>>>{};
          for (final r in records) {
            final key = '${r['bar_location']}__${r['stocktake_date']}';
            groups.putIfAbsent(key, () => []).add(r);
          }
          if (groups.isEmpty) {
            return const Center(child: Text('No bar stocktakes pending review.'));
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: groups.entries.map((entry) {
              final rows = entry.value;
              final first = rows.first;
              final ids = rows.map((r) => '${r['id']}').toList();
              final negativeVariance = rows
                  .where((r) => _num(r['variance']) < 0)
                  .fold<num>(0, (sum, r) => sum + _num(r['variance']).abs());
              final busy = rows.any((r) => _busyIds.contains('${r['id']}'));
              return Card(
                margin: const EdgeInsets.only(bottom: 14),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${_locationLabel(first['bar_location'])} — ${first['stocktake_date']}',
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 8),
                      Text('Shortage value: KES ${negativeVariance.toStringAsFixed(2)}',
                          style: TextStyle(
                              color: negativeVariance > 0
                                  ? Colors.red
                                  : Colors.green,
                              fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      for (final r in rows)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 2),
                          child: Row(
                            children: [
                              Expanded(
                                  child: Text('${r['item_name'] ?? r['item_id']}')),
                              Text('Sys: ${r['system_quantity']}',
                                  style: const TextStyle(
                                      fontSize: 12,
                                      color: AppColors.kTextSecondary)),
                              const SizedBox(width: 10),
                              Text('Phys: ${r['physical_quantity']}',
                                  style: const TextStyle(fontSize: 12)),
                              const SizedBox(width: 10),
                              Text(
                                '${_num(r['variance']) >= 0 ? '+' : ''}${r['variance']}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: _num(r['variance']) < 0
                                      ? Colors.red
                                      : Colors.green,
                                ),
                              ),
                            ],
                          ),
                        ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          OutlinedButton(
                            onPressed: busy ? null : () => _reject(ids),
                            child: const Text('Reject'),
                          ),
                          const SizedBox(width: 10),
                          FilledButton(
                            onPressed: busy ? null : () => _approve(ids),
                            child: const Text('Approve'),
                          ),
                        ],
                      ),
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

String _locationLabel(dynamic key) {
  switch (key) {
    case 'main_bar':
      return 'Main Bar';
    case 'executive_bar':
      return 'Executive Bar';
    default:
      return '$key';
  }
}

num _num(dynamic v) => v is num ? v : num.tryParse('${v ?? 0}') ?? 0;

void _notify(BuildContext context, String message) {
  AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
}
