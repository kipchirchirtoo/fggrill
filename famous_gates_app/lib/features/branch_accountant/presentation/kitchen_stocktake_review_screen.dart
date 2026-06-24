import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/repository.dart';

/// Kitchen Stocktake Review — Branch Accountant.
/// Lists submitted kitchen stocktake shifts grouped by date/shift.
/// Approving a shift confirms the closing counts and re-syncs them to
/// the restaurant POS outlet stock.
class KitchenStocktakeReviewScreen extends ConsumerStatefulWidget {
  const KitchenStocktakeReviewScreen({super.key});

  @override
  ConsumerState<KitchenStocktakeReviewScreen> createState() =>
      _KitchenStocktakeReviewScreenState();
}

class _KitchenStocktakeReviewScreenState
    extends ConsumerState<KitchenStocktakeReviewScreen> {
  late Future<List<Map<String, dynamic>>> _future = _load();
  final Set<String> _busyIds = {};

  Future<List<Map<String, dynamic>>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getKitchenStocktakeShifts(status: 'submitted');

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
    String id,
    Future<void> Function(BranchAccountantRepository repo) action,
    String msg,
  ) async {
    setState(() => _busyIds.add(id));
    try {
      await action(ref.read(branchAccountantRepositoryProvider));
      if (mounted) {
        _notify(context, msg);
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Action failed: $e');
    } finally {
      if (mounted) setState(() => _busyIds.remove(id));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Kitchen Stocktake Review'),
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
          final shifts = snap.data ?? [];
          if (shifts.isEmpty) {
            return const Center(
                child: Text('No kitchen stocktakes pending review.'));
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: shifts.map((shift) {
              final id = '${shift['id']}';
              final busy = _busyIds.contains(id);
              final items =
                  (shift['items'] as List?)?.cast<Map<String, dynamic>>() ??
                      [];
              final shortages = items.where((it) {
                final variance = _num(it['closing_qty']) -
                    _num(it['opening_qty']) -
                    _num(it['added_qty']);
                return variance < 0;
              }).length;
              return Card(
                margin: const EdgeInsets.only(bottom: 14),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Expanded(
                          child: Text(
                            'Kitchen — ${shift['stocktake_date']}  Shift ${shift['shift']}',
                            style: const TextStyle(fontWeight: FontWeight.w800),
                          ),
                        ),
                        if ((shift['dispenser_name'] ?? '').toString().isNotEmpty)
                          Text('Dispenser: ${shift['dispenser_name']}',
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.kTextSecondary)),
                      ]),
                      const SizedBox(height: 4),
                      Text('${items.length} items · $shortages shortages',
                          style: TextStyle(
                              color:
                                  shortages > 0 ? Colors.red : Colors.green,
                              fontWeight: FontWeight.w700,
                              fontSize: 13)),
                      const SizedBox(height: 10),
                      for (final it in items)
                        Builder(builder: (context) {
                          final variance = _num(it['closing_qty']) -
                              _num(it['opening_qty']) -
                              _num(it['added_qty']);
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 2),
                            child: Row(
                              children: [
                                Expanded(
                                    child: Text('${it['item_name']}',
                                        style:
                                            const TextStyle(fontSize: 13))),
                                Text(
                                  '${variance >= 0 ? '+' : ''}${variance.toStringAsFixed(variance == variance.roundToDouble() ? 0 : 1)}',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: variance < 0
                                        ? Colors.red
                                        : Colors.green,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  'O:${_num(it['opening_qty'])} A:${_num(it['added_qty'])} C:${_num(it['closing_qty'])}',
                                  style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.kTextSecondary),
                                ),
                              ],
                            ),
                          );
                        }),
                      const SizedBox(height: 12),
                      Row(children: [
                        OutlinedButton(
                          onPressed: busy
                              ? null
                              : () async {
                                  final notes = await _askNotes(
                                      'Reject Stocktake',
                                      'Reason (required)',
                                      required: true);
                                  if (notes == null || notes.isEmpty) return;
                                  await _runAction(
                                      id,
                                      (r) => r.rejectKitchenStocktake(id,
                                          notes: notes),
                                      'Stocktake rejected');
                                },
                          child: const Text('Reject'),
                        ),
                        const SizedBox(width: 10),
                        OutlinedButton(
                          onPressed: busy
                              ? null
                              : () async {
                                  final notes = await _askNotes(
                                      'Review Stocktake', 'Notes (optional)');
                                  if (notes == null) return;
                                  await _runAction(
                                      id,
                                      (r) => r.reviewKitchenStocktake(id,
                                          notes: notes),
                                      'Stocktake reviewed');
                                },
                          child: const Text('Review'),
                        ),
                        const SizedBox(width: 10),
                        FilledButton(
                          onPressed: busy
                              ? null
                              : () async {
                                  final notes = await _askNotes(
                                      'Approve Stocktake', 'Notes (optional)');
                                  if (notes == null) return;
                                  await _runAction(
                                      id,
                                      (r) => r.approveKitchenStocktake(id,
                                          notes: notes),
                                      'Stocktake approved — restaurant stock updated');
                                },
                          child: const Text('Approve'),
                        ),
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
