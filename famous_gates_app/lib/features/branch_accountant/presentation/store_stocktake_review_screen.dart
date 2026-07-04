import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/app_notifier.dart';
import '../../branch_storekeeper/stock_take/models/stock_take_item.dart';
import '../../branch_storekeeper/stock_take/providers/stock_take_provider.dart';
import '../data/repository.dart';
import 'stock_take_review_detail_page.dart';

/// Store Stocktake Review - Branch Accountant.
/// Shows pending submissions and historical store stocktakes grouped by branch
/// and stocktake date.
class StoreStocktakeReviewScreen extends ConsumerStatefulWidget {
  const StoreStocktakeReviewScreen({super.key});

  @override
  ConsumerState<StoreStocktakeReviewScreen> createState() =>
      _StoreStocktakeReviewScreenState();
}

class _StoreStocktakeReviewScreenState
    extends ConsumerState<StoreStocktakeReviewScreen> {
  late Future<List<Map<String, dynamic>>> _pendingFuture = _loadPending();
  late Future<List<Map<String, dynamic>>> _historyFuture = _loadHistory();
  final Set<String> _busyIds = {};

  Future<List<Map<String, dynamic>>> _loadPending() => ref
      .read(branchAccountantRepositoryProvider)
      .getStoreStocktakeRecords(status: 'pending');

  Future<List<Map<String, dynamic>>> _loadHistory() => ref
      .read(branchAccountantRepositoryProvider)
      .getStoreStocktakeRecords(status: 'all', history: true);

  void _refresh() => setState(() {
        _pendingFuture = _loadPending();
        _historyFuture = _loadHistory();
      });

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

  Future<void> _reviewAction(
      List<String> ids, String branchId, String stocktakeDate, String? notes) async {
    await _runAction(ids, (r) => r.batchReviewStoreStocktake(
          branchId: branchId,
          stocktakeDate: stocktakeDate,
          notes: notes,
        ), 'Stocktake reviewed');
  }

  Future<void> _approveAction(
      List<String> ids, String branchId, String stocktakeDate, String? notes) async {
    await _runAction(ids, (r) => r.batchApproveStoreStocktake(
          branchId: branchId,
          stocktakeDate: stocktakeDate,
          notes: notes,
        ), 'Stocktake approved - branch stock updated');
  }

  Future<void> _rejectAction(
      List<String> ids, String branchId, String stocktakeDate, String notes) async {
    await _runAction(ids, (r) => r.batchRejectStoreStocktake(
          branchId: branchId,
          stocktakeDate: stocktakeDate,
          notes: notes,
        ), 'Stocktake rejected');
  }

  void _openReviewDetail(
    BuildContext context,
    String date,
    String branchId,
    List<Map<String, dynamic>> rows,
    List<String> ids, {
    required bool showActions,
  }) async {
    final stockTakeItems = rows.map(_toStockTakeItem).toList();
    final status = rows.isEmpty ? 'unknown' : '${rows.first['status']}';
    final safeDate = (date == 'null' || date.isEmpty)
        ? '${rows.firstOrNull?['stocktake_date'] ?? date}'
        : date;

    final result = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (context) => StockTakeReviewDetailPage(
          stockTakeType: StockTakeType.store,
          title: 'Store Stocktake',
          subtitle: () {
            final shiftNum = rows.isEmpty ? null : rows.first['shift_number'];
            final cashierName = rows.isEmpty ? null : rows.first['cashier_name'];
            final base = '$safeDate - ${_statusLabel(status)}';
            if (shiftNum != null) {
              final c = cashierName != null ? ' ($cashierName)' : '';
              return '$base · Shift #$shiftNum$c';
            }
            return base;
          }(),
          items: stockTakeItems,
          ids: ids,
          showActions: showActions,
          onApprove: (notes) => _approveAction(ids, branchId, safeDate, notes),
          onReject: (notes) => _rejectAction(ids, branchId, safeDate, notes),
          onReview: (notes) => _reviewAction(ids, branchId, safeDate, notes),
        ),
      ),
    );

    if (result == true) _refresh();
  }

  StockTakeItem _toStockTakeItem(Map<String, dynamic> r) {
    final systemQty = _num(r['system_quantity'] ?? r['quantity'] ?? 0).toInt();
    final physical = _nullableNum(
      r['physical_quantity'] ?? r['counted_quantity'] ?? r['actual_quantity'],
    )?.toInt();
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
  }

  Map<String, List<Map<String, dynamic>>> _groupRecords(
    List<Map<String, dynamic>> records,
  ) {
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final r in records) {
      final branch = '${r['branch_id'] ?? ''}';
      final shift = '${r['shift_id'] ?? 'no_shift'}';
      groups.putIfAbsent('${branch}__${r['stocktake_date']}__$shift', () => []).add(r);
    }
    return groups;
  }

  Widget _buildTab({
    required Future<List<Map<String, dynamic>>> future,
    required bool history,
  }) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return _ErrorState(message: '${snap.error}', onRetry: _refresh);
        }

        final groups = _groupRecords(snap.data ?? []);
        if (groups.isEmpty) {
          return Center(
            child: Text(history
                ? 'No store stocktake history found.'
                : 'No store stocktakes pending review.'),
          );
        }

        return ListView(
          padding: const EdgeInsets.all(16),
          children: groups.entries.map((entry) {
            final rows = entry.value;
            final ids = rows.map((r) => '${r['item_id'] ?? r['id']}').toList();
            final busy = rows.any((r) => _busyIds.contains('${r['item_id'] ?? r['id']}'));
            final status = '${rows.first['status'] ?? 'pending'}';
            final shortageCount =
                rows.where((r) => _num(r['variance']) < 0).length;
            final shortageValue = rows
                .where((r) => _num(r['variance']) < 0)
                .fold<num>(0, (sum, r) => sum + _num(r['variance']).abs());
            final date = '${rows.first['stocktake_date'] ?? ''}';
            final branchId = '${rows.first['branch_id'] ?? ''}';

            final shiftNum = rows.first['shift_number'];
            final cashierName = rows.first['cashier_name'];

            return _StocktakeGroupCard(
              title: shiftNum != null
                  ? 'Store - $date (Shift #$shiftNum)'
                  : 'Store - $date',
              subtitle: cashierName != null
                  ? 'Branch ${rows.first['branch_id'] ?? '-'} · Cashier: $cashierName - ${rows.length} items'
                  : 'Branch ${rows.first['branch_id'] ?? '-'} - ${rows.length} items',
              metric:
                  '$shortageCount shortages - KES ${shortageValue.toStringAsFixed(2)}',
              status: status,
              buttonLabel: history
                  ? 'Open Excel History Grid'
                  : 'Open Excel Review Grid',
              isBusy: busy,
              onOpen: busy
                  ? null
                  : () => _openReviewDetail(
                        context,
                        date,
                        branchId,
                        rows,
                        ids,
                        showActions: !history &&
                            ['pending', 'reviewed'].contains(status),
                      ),
            );
          }).toList(),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor:
            isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA),
        appBar: AppBar(
          title: const Text('Store Stocktake Review'),
          actions: [
            IconButton(onPressed: _refresh, icon: const Icon(Icons.refresh)),
          ],
          bottom: const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.pending_actions), text: 'Pending Review'),
              Tab(icon: Icon(Icons.history), text: 'History'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _buildTab(future: _pendingFuture, history: false),
            _buildTab(future: _historyFuture, history: true),
          ],
        ),
      ),
    );
  }
}

class _StocktakeGroupCard extends StatelessWidget {
  const _StocktakeGroupCard({
    required this.title,
    required this.subtitle,
    required this.metric,
    required this.status,
    required this.buttonLabel,
    required this.isBusy,
    required this.onOpen,
  });

  final String title;
  final String subtitle;
  final String metric;
  final String status;
  final String buttonLabel;
  final bool isBusy;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor(status);
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onOpen,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  Chip(
                    label: Text(_statusLabel(status)),
                    labelStyle: TextStyle(
                      color: statusColor,
                      fontWeight: FontWeight.w800,
                      fontSize: 11,
                    ),
                    backgroundColor: statusColor.withValues(alpha: 0.12),
                    side: BorderSide.none,
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(subtitle, style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 12),
              Text(
                metric,
                style: TextStyle(
                  color: metric.contains('0 shortages')
                      ? Colors.green
                      : Colors.red,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: isBusy ? null : onOpen,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFF1565C0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  icon: const Icon(Icons.table_chart_outlined, size: 18),
                  label: Text(
                    buttonLabel,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 44),
          const SizedBox(height: 10),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

String _statusLabel(dynamic value) {
  final status = '$value'.replaceAll('_', ' ').trim();
  if (status.isEmpty || status == 'null') return 'Unknown';
  return status
      .split(' ')
      .map((part) => part.isEmpty
          ? part
          : '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}')
      .join(' ');
}

Color _statusColor(String status) {
  switch (status.toLowerCase()) {
    case 'approved':
      return Colors.green.shade700;
    case 'rejected':
      return Colors.red.shade700;
    case 'reviewed':
      return Colors.blue.shade700;
    default:
      return Colors.orange.shade800;
  }
}

void _notify(BuildContext context, String msg) =>
    AppNotifier.showSnackBar(context, SnackBar(content: Text(msg)));
