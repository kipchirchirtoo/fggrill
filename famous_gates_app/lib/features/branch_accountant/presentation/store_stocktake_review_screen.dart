import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/app_notifier.dart';
import '../../branch_storekeeper/stock_take/models/stock_take_item.dart';
import '../../branch_storekeeper/stock_take/providers/stock_take_provider.dart';
import '../data/repository.dart';
import 'stock_take_review_detail_page.dart';

/// Store Stocktake Review — Branch Accountant.
/// Lists pending store stocktake submissions grouped by date and provides
/// Review / Approve / Reject actions.
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

  num? _nullableNum(dynamic v) {
    if (v == null) return null;
    if (v is num) return v;
    return num.tryParse('$v');
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
      rethrow;
    } finally {
      if (mounted) setState(() => _busyIds.removeAll(ids));
    }
  }

  Future<void> _reviewAction(List<String> ids, String? notes) async {
    await _runAction(ids, (r) async {
      for (final id in ids) { await r.reviewStoreStocktake(id, notes: notes); }
    }, 'Stocktake reviewed');
  }

  Future<void> _approveAction(List<String> ids, String? notes) async {
    await _runAction(ids, (r) async {
      await r.approveStoreStocktake(ids.first, notes: notes);
    }, 'Stocktake approved — branch stock updated');
  }

  Future<void> _rejectAction(List<String> ids, String notes) async {
    await _runAction(ids, (r) async {
      for (final id in ids) { await r.rejectStoreStocktake(id, notes: notes); }
    }, 'Stocktake rejected');
  }

  void _openReviewDetail(
    BuildContext context,
    String date,
    List<Map<String, dynamic>> rows,
    List<String> ids,
  ) async {
    final stockTakeItems = rows.map((r) {
      final systemQty = _num(r['system_quantity'] ?? r['quantity'] ?? 0).toInt();
      final physical = _nullableNum(r['physical_quantity'] ?? r['counted_quantity'] ?? r['actual_quantity'])?.toInt();
      return StockTakeItem(
        id: '${r['item_id'] ?? r['id']}',
        sku: '${r['item']?['sku'] ?? r['sku'] ?? ''}',
        productName: '${r['item_name'] ?? r['name'] ?? 'Item'}',
        imageUrl: '',
        openingStock: systemQty,
        sales: 0,
        sdds: 0,
        physicalCount: physical,
        reason: r['notes'] ?? r['reason_for_variance'],
        category: '${r['category'] ?? 'Other'}',
      );
    }).toList();

    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (context) => StockTakeReviewDetailPage(
          stockTakeType: StockTakeType.store,
          title: 'Store Stocktake Review',
          subtitle: date,
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
                elevation: 2,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: InkWell(
                  borderRadius: BorderRadius.circular(12),
                  onTap: busy
                      ? null
                      : () => _openReviewDetail(context, entry.key, rows, ids),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Store — ${entry.key}',
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
                          '$shortageCount shortages',
                          style: TextStyle(
                            color: shortageCount > 0 ? Colors.red : Colors.green,
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
                                : () => _openReviewDetail(context, entry.key, rows, ids),
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

void _notify(BuildContext context, String msg) =>
    AppNotifier.showSnackBar(context, SnackBar(content: Text(msg)));
