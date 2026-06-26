import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/app_notifier.dart';
import '../../branch_storekeeper/stock_take/models/stock_take_item.dart';
import '../../branch_storekeeper/stock_take/providers/stock_take_provider.dart';
import '../data/repository.dart';
import 'stock_take_review_detail_page.dart';

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

  Future<void> _reviewAction(List<String> ids, String? notes) async {
    await _runAction(ids, (repo) async {
      for (final id in ids) {
        await repo.reviewBarStocktake(id, notes: notes);
      }
    }, 'Stocktake reviewed');
  }

  Future<void> _approveAction(List<String> ids, String? notes) async {
    await _runAction(ids, (repo) async {
      for (final id in ids) {
        await repo.approveBarStocktake(id, notes: notes);
      }
    }, 'Stocktake approved');
  }

  Future<void> _rejectAction(List<String> ids, String notes) async {
    await _runAction(ids, (repo) async {
      for (final id in ids) {
        await repo.rejectBarStocktake(id, notes: notes);
      }
    }, 'Stocktake rejected');
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
      rethrow;
    } finally {
      if (mounted) setState(() => _busyIds.removeAll(ids));
    }
  }

  void _openReviewDetail(
    BuildContext context,
    Map<String, dynamic> first,
    List<Map<String, dynamic>> rows,
    List<String> ids,
  ) async {
    final stockTakeItems = rows.map((r) {
      final opening = _num(r['opening_stock'] ?? r['opening'] ?? 0).toInt();
      final sales = _num(r['sales'] ?? 0).toInt();
      final additions = _num(r['additions'] ?? 0).toInt();
      final sdds = -additions;
      final physical = _nullableNum(r['physical_quantity'] ?? r['counted_quantity'] ?? r['actual_quantity'])?.toInt();
      return StockTakeItem(
        id: '${r['item_id'] ?? r['id']}',
        sku: '${r['item']?['sku'] ?? r['sku'] ?? ''}',
        productName: '${r['item_name'] ?? r['name'] ?? 'Item'}',
        imageUrl: '',
        openingStock: opening,
        sales: sales,
        sdds: sdds,
        physicalCount: physical,
        reason: r['reason_for_variance'] ?? r['notes'],
        category: getBarCategory('${r['item_name'] ?? r['name'] ?? 'Item'}'),
      );
    }).toList();

    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (context) => StockTakeReviewDetailPage(
          stockTakeType: StockTakeType.bar,
          title: '${_locationLabel(first['bar_location'])} Review',
          subtitle: '${first['stocktake_date']}',
          items: stockTakeItems,
          ids: ids,
          onApprove: (notes) => _approveAction(ids, notes),
          onReject: (notes) => _rejectAction(ids, notes),
          onReview: (notes) => _reviewAction(ids, notes),
        ),
      ),
    );

    if (result == true) {
      _refresh();
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA),
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
                elevation: 2,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: busy
                      ? null
                      : () => _openReviewDetail(context, first, rows, ids),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '${_locationLabel(first['bar_location'])} — ${first['stocktake_date']}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFF1565C0).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '${rows.length} items',
                                style: const TextStyle(
                                  color: Color(0xFF1565C0),
                                  fontWeight: FontWeight.bold,
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Shortage value: KES ${negativeVariance.toStringAsFixed(2)}',
                          style: TextStyle(
                            color: negativeVariance > 0 ? Colors.red : Colors.green,
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton.icon(
                            onPressed: busy
                                ? null
                                : () => _openReviewDetail(context, first, rows, ids),
                            style: FilledButton.styleFrom(
                              backgroundColor: const Color(0xFF1565C0),
                              shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8)),
                            ),
                            icon: const Icon(Icons.table_chart_outlined, size: 18),
                            label: const Text(
                              'Open Excel Review Grid',
                              style: TextStyle(fontWeight: FontWeight.bold),
                            ),
                          ),
                        ),
                      ],
                    ),
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

num? _nullableNum(dynamic v) {
  if (v == null) return null;
  if (v is num) return v;
  return num.tryParse('$v');
}

void _notify(BuildContext context, String message) {
  AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
}
