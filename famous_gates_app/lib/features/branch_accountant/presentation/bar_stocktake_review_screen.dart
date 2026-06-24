import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/repository.dart';

/// Bar Stocktake Review — Branch Accountant.
/// Lists pending bar stocktake submissions grouped by location/date and
/// provides Review / Approve / Reject actions for each group.
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

  Future<void> _review(List<String> ids) async {
    final notes = await _askNotes('Review Stocktake', 'Add review notes (optional)');
    if (notes == null) return;
    await _runAction(ids, (repo) async {
      for (final id in ids) await repo.reviewBarStocktake(id, notes: notes);
    }, 'Stocktake reviewed');
  }

  Future<void> _approve(List<String> ids) async {
    final notes = await _askNotes('Approve Stocktake', 'Add approval notes (optional)');
    if (notes == null) return;
    await _runAction(ids, (repo) async {
      for (final id in ids) await repo.approveBarStocktake(id, notes: notes);
    }, 'Stocktake approved');
  }

  Future<void> _reject(List<String> ids) async {
    final notes = await _askNotes('Reject Stocktake', 'Reason for rejection (required)', required: true);
    if (notes == null || notes.isEmpty) return;
    await _runAction(ids, (repo) async {
      for (final id in ids) await repo.rejectBarStocktake(id, notes: notes);
    }, 'Stocktake rejected');
  }

  Future<String?> _askNotes(String title, String hint, {bool required = false}) async {
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
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
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
    String successMessage,
  ) async {
    setState(() => _busyIds.addAll(ids));
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      await action(repo);
      if (mounted) {
        _notify(context, successMessage);
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Action failed: $e');
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
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                      child: Text('${r['item_name'] ?? r['item_id']}',
                                          style: const TextStyle(fontWeight: FontWeight.w600))),
                                  Text(
                                    '${_num(r['variance']) >= 0 ? '+' : ''}${r['variance']}',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      color: _num(r['variance']) < 0
                                          ? Colors.red
                                          : Colors.green,
                                    ),
                                  ),
                                ],
                              ),
                              Text(
                                'Open: ${r['opening_stock'] ?? 0} · Add: ${r['additions'] ?? 0} · '
                                'Sales: ${r['sales'] ?? 0} · Sys: ${r['system_quantity']} · Phys: ${r['physical_quantity']}',
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.kTextSecondary),
                              ),
                              if ((r['reason_for_variance'] ?? '').toString().isNotEmpty)
                                Text(
                                  'Reason: ${r['reason_for_variance']}',
                                  style: const TextStyle(
                                      fontSize: 12,
                                      fontStyle: FontStyle.italic,
                                      color: AppColors.kTextSecondary),
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
                          OutlinedButton(
                            onPressed: busy ? null : () => _review(ids),
                            child: const Text('Review'),
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

String _itemLabel(Map<String, dynamic> row) {
  final item = row['item'];
  final nestedName =
      item is Map ? item['name'] : item is Map<dynamic, dynamic> ? item['name'] : null;
  final value = row['item_name'] ?? row['name'] ?? nestedName ?? row['item_id'];
  return '${value ?? 'Unknown item'}';
}

num? _systemQuantity(Map<String, dynamic> row) {
  return _nullableNum(
    row['system_quantity'] ?? row['system_closing_stock'] ?? row['closing_balance'],
  );
}

num? _physicalQuantity(Map<String, dynamic> row) {
  return _nullableNum(
    row['physical_quantity'] ?? row['counted_quantity'] ?? row['actual_quantity'],
  );
}

num _variance(Map<String, dynamic> row) {
  final stored = _nullableNum(row['variance']);
  if (stored != null) return stored;
  final system = _systemQuantity(row);
  final physical = _physicalQuantity(row);
  if (system != null && physical != null) return physical - system;
  return 0;
}

num _num(dynamic v) => v is num ? v : num.tryParse('${v ?? 0}') ?? 0;

num? _nullableNum(dynamic v) {
  if (v == null) return null;
  if (v is num) return v;
  return num.tryParse('$v');
}

String _displayQty(num? value) {
  if (value == null) return '-';
  return value == value.roundToDouble() ? value.toInt().toString() : '$value';
}

void _notify(BuildContext context, String message) {
  AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
}
