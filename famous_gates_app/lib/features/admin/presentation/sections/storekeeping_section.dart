import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../widgets/admin_table.dart';

enum _StoreTab {
  purchaseOrders,
  grn,
  dispatches,
  stockTakes,
  spoilage,
  stockRequests
}

final _storekeepingDataProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return {
    'purchase_orders': List.generate(
        8,
        (i) => {
              'po_number': 'PO-${2025000 + i}',
              'supplier': 'Fresh Supply Co.',
              'date': DateTime.now().subtract(Duration(days: i * 2)),
              'total': 50000.0 + (i * 5000),
              'status': ['pending', 'approved', 'received', 'cancelled'][i % 4],
            }),
    'grn': List.generate(
        6,
        (i) => {
              'grn_number': 'GRN-${3000 + i}',
              'po_number': 'PO-${2025000 + i}',
              'supplier': 'Global Foods Ltd',
              'date': DateTime.now().subtract(Duration(days: i * 3)),
              'items_count': 5 + i,
              'status': ['pending', 'completed', 'verified'][i % 3],
            }),
    'dispatches': List.generate(
        5,
        (i) => {
              'dispatch_number': 'DSP-${4000 + i}',
              'destination': [
                'Nairobi',
                'Mombasa',
                'Kisumu',
                'Nakuru',
                'Eldoret'
              ][i],
              'date': DateTime.now().subtract(Duration(days: i)),
              'items_count': 3 + i,
              'status': [
                'pending',
                'in_transit',
                'delivered',
                'cancelled'
              ][i % 4],
            }),
    'stock_takes': List.generate(
        4,
        (i) => {
              'date': DateTime.now().subtract(Duration(days: i * 7)),
              'location': [
                'Main Store',
                'Dry Store',
                'Cold Room',
                'Bar Store'
              ][i],
              'items_count': 50 + (i * 10),
              'discrepancies': i * 2,
              'status': ['completed', 'in_progress', 'pending', 'completed'][i],
            }),
    'spoilage': List.generate(
        5,
        (i) => {
              'item': 'Fresh Produce ${String.fromCharCode(65 + i)}',
              'quantity': '${(i + 1) * 2} kg',
              'reason': [
                'Expired',
                'Damaged',
                'Spoiled',
                'Contaminated',
                'Other'
              ][i],
              'cost': 2000.0 * (i + 1),
              'recorded_by': 'Storekeeper ${String.fromCharCode(65 + i)}',
              'date': DateTime.now().subtract(Duration(days: i)),
            }),
    'stock_requests': List.generate(
        7,
        (i) => {
              'item': 'Cooking Oil',
              'quantity': '${(i + 1) * 5} l',
              'from_branch': [
                'Nairobi',
                'Mombasa',
                'Kisumu',
                'Nakuru',
                'Eldoret',
                'Thika',
                'Malindi'
              ][i],
              'status': [
                'pending',
                'approved',
                'rejected',
                'pending',
                'approved',
                'pending',
                'approved'
              ][i],
            }),
  };
});

class StorekeepingSection extends ConsumerStatefulWidget {
  const StorekeepingSection({super.key});

  @override
  ConsumerState<StorekeepingSection> createState() =>
      _StorekeepingSectionState();
}

class _StorekeepingSectionState extends ConsumerState<StorekeepingSection> {
  _StoreTab _currentTab = _StoreTab.purchaseOrders;
  DateTime? _spoilageFrom;
  DateTime? _spoilageTo;

  @override
  Widget build(BuildContext context) {
    final dataAsync = ref.watch(_storekeepingDataProvider);

    return Column(
      children: [
        _SubTabBar(
          tabs: _StoreTab.values,
          selected: _currentTab,
          onChanged: (tab) => setState(() => _currentTab = tab),
        ),
        Expanded(
          child: dataAsync.when(
            loading: () => const TabbedSkeleton(tabCount: 6),
            error: (e, _) => ErrorState(
              message: '$e',
              onRetry: () => ref.invalidate(_storekeepingDataProvider),
            ),
            data: (data) => _buildContent(data),
          ),
        ),
      ],
    );
  }

  Widget _buildContent(Map<String, dynamic> data) {
    switch (_currentTab) {
      case _StoreTab.purchaseOrders:
        return _PurchaseOrdersTab(data: data);
      case _StoreTab.grn:
        return _GRNTab(data: data);
      case _StoreTab.dispatches:
        return _DispatchesTab(data: data);
      case _StoreTab.stockTakes:
        return _StockTakesTab(data: data);
      case _StoreTab.spoilage:
        return _SpoilageTab(
            data: data,
            from: _spoilageFrom,
            to: _spoilageTo,
            onFromChanged: (d) => setState(() => _spoilageFrom = d),
            onToChanged: (d) => setState(() => _spoilageTo = d));
      case _StoreTab.stockRequests:
        return _StockRequestsTab(data: data);
    }
  }
}

class _SubTabBar extends StatelessWidget {
  final List<_StoreTab> tabs;
  final _StoreTab selected;
  final ValueChanged<_StoreTab> onChanged;

  const _SubTabBar(
      {required this.tabs, required this.selected, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 44,
      color: Colors.white,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 24),
        itemCount: tabs.length,
        separatorBuilder: (_, __) => const SizedBox(width: 4),
        itemBuilder: (context, index) {
          final tab = tabs[index];
          final label = tab.name
              .split('.')
              .last
              .replaceAllMapped(RegExp(r'[A-Z]'), (m) => ' ${m.group(0)}')
              .trim();
          final isSelected = tab == selected;
          return GestureDetector(
            onTap: () => onChanged(tab),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              margin: const EdgeInsets.symmetric(vertical: 8),
              decoration: BoxDecoration(
                color: isSelected ? AppColors.kPrimary : Colors.transparent,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                    color:
                        isSelected ? AppColors.kPrimary : AppColors.kDivider),
              ),
              child: Center(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight:
                        isSelected ? FontWeight.w600 : FontWeight.normal,
                    color: isSelected ? Colors.white : AppColors.kTextSecondary,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _PurchaseOrdersTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _PurchaseOrdersTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final pos = data['purchase_orders'] as List? ?? [];
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Purchase Orders',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'PO#',
              'Supplier',
              'Date',
              'Total',
              'Status',
              'Actions'
            ],
            rows: pos.map((p) {
              final po = p as Map<String, dynamic>;
              final status = '${po['status']}';
              return [
                Text('${po['po_number']}',
                    style: const TextStyle(fontWeight: FontWeight.w500)),
                Text('${po['supplier']}'),
                Text(po['date'] is DateTime
                    ? '${(po['date'] as DateTime).day}/${(po['date'] as DateTime).month}/${(po['date'] as DateTime).year}'
                    : ''),
                Text('KES ${(po['total'] as num).toStringAsFixed(0)}'),
                StatusBadge(status: status),
                status == 'pending'
                    ? SizedBox(
                        height: 28,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 12),
                              minimumSize: Size.zero),
                          onPressed: () async {
                            final confirm = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Approve PO'),
                                content: Text(
                                    'Approve PO #${po['po_number']} from ${po['supplier']}?'),
                                actions: [
                                  TextButton(
                                      onPressed: () =>
                                          Navigator.pop(ctx, false),
                                      child: const Text('Cancel')),
                                  ElevatedButton(
                                      onPressed: () => Navigator.pop(ctx, true),
                                      child: const Text('Approve')),
                                ],
                              ),
                            );
                            if (confirm == true && context.mounted) {
                              AppNotifier.showSnackBar(
                                context,
                                SnackBar(
                                    content: Text(
                                        'PO #${po['po_number']} approved')),
                              );
                            }
                          },
                          child: const Text('Approve',
                              style: TextStyle(fontSize: 11)),
                        ),
                      )
                    : const SizedBox.shrink(),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _GRNTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _GRNTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final grns = data['grn'] as List? ?? [];
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Goods Received Notes',
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'GRN#',
              'PO#',
              'Supplier',
              'Date',
              'Items',
              'Status'
            ],
            rows: grns.map((g) {
              final grn = g as Map<String, dynamic>;
              return [
                Text('${grn['grn_number']}',
                    style: const TextStyle(fontWeight: FontWeight.w500)),
                Text('${grn['po_number']}',
                    style: const TextStyle(fontSize: 12)),
                Text('${grn['supplier']}'),
                Text(grn['date'] is DateTime
                    ? '${(grn['date'] as DateTime).day}/${(grn['date'] as DateTime).month}/${(grn['date'] as DateTime).year}'
                    : ''),
                Text('${grn['items_count']} items'),
                StatusBadge(status: '${grn['status']}'),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _DispatchesTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _DispatchesTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final dispatches = data['dispatches'] as List? ?? [];
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Dispatches', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'Dispatch#',
              'Destination',
              'Date',
              'Items',
              'Status'
            ],
            rows: dispatches.map((d) {
              final dispatch = d as Map<String, dynamic>;
              return [
                Text('${dispatch['dispatch_number']}',
                    style: const TextStyle(fontWeight: FontWeight.w500)),
                Text('${dispatch['destination']}'),
                Text(dispatch['date'] is DateTime
                    ? '${(dispatch['date'] as DateTime).day}/${(dispatch['date'] as DateTime).month}/${(dispatch['date'] as DateTime).year}'
                    : ''),
                Text('${dispatch['items_count']} items'),
                StatusBadge(status: '${dispatch['status']}'),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _StockTakesTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _StockTakesTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final takes = data['stock_takes'] as List? ?? [];
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Stock Takes', style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'Date',
              'Location',
              'Items Counted',
              'Discrepancies',
              'Status'
            ],
            rows: takes.map((t) {
              final st = t as Map<String, dynamic>;
              return [
                Text(st['date'] is DateTime
                    ? '${(st['date'] as DateTime).day}/${(st['date'] as DateTime).month}/${(st['date'] as DateTime).year}'
                    : ''),
                Text('${st['location']}'),
                Text('${st['items_count']}'),
                Text('${st['discrepancies']}',
                    style: TextStyle(
                        color: (st['discrepancies'] as int) > 0
                            ? AppColors.kError
                            : AppColors.kSuccess)),
                StatusBadge(status: '${st['status']}'),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _SpoilageTab extends StatelessWidget {
  final Map<String, dynamic> data;
  final DateTime? from;
  final DateTime? to;
  final ValueChanged<DateTime?> onFromChanged;
  final ValueChanged<DateTime?> onToChanged;

  const _SpoilageTab({
    required this.data,
    required this.from,
    required this.to,
    required this.onFromChanged,
    required this.onToChanged,
  });

  @override
  Widget build(BuildContext context) {
    final spoilage = data['spoilage'] as List? ?? [];
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('Spoilage Records',
                  style: Theme.of(context).textTheme.displaySmall),
              const Spacer(),
              _DateFilter(label: 'From', date: from, onChanged: onFromChanged),
              const SizedBox(width: 12),
              _DateFilter(label: 'To', date: to, onChanged: onToChanged),
            ],
          ),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'Item',
              'Quantity',
              'Reason',
              'Cost',
              'Recorded By'
            ],
            rows: spoilage.map((s) {
              final entry = s as Map<String, dynamic>;
              return [
                Text('${entry['item']}'),
                Text('${entry['quantity']}'),
                Text('${entry['reason']}'),
                Text('KES ${(entry['cost'] as num).toStringAsFixed(0)}'),
                Text('${entry['recorded_by']}'),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _DateFilter extends StatelessWidget {
  final String label;
  final DateTime? date;
  final ValueChanged<DateTime?> onChanged;

  const _DateFilter(
      {required this.label, required this.date, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () async {
        final picked = await showDatePicker(
            context: context,
            initialDate: date ?? DateTime.now(),
            firstDate: DateTime(2020),
            lastDate: DateTime.now());
        if (picked != null) onChanged(picked);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          border: Border.all(color: AppColors.kDivider),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(label,
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 12)),
            const SizedBox(width: 8),
            Text(
                date != null
                    ? '${date!.day}/${date!.month}/${date!.year}'
                    : 'All',
                style: const TextStyle(fontSize: 12)),
          ],
        ),
      ),
    );
  }
}

class _StockRequestsTab extends StatelessWidget {
  final Map<String, dynamic> data;

  const _StockRequestsTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final requests = data['stock_requests'] as List? ?? [];
    final pendingCount =
        requests.where((r) => (r as Map)['status'] == 'pending').length;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Stock Requests',
                  style: Theme.of(context).textTheme.displaySmall),
              if (pendingCount > 0)
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.kSuccess,
                    minimumSize: const Size(160, 40),
                  ),
                  onPressed: () async {
                    final ok = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Batch Approve Requests'),
                        content: Text(
                            'Approve all $pendingCount pending stock requests?'),
                        actions: [
                          TextButton(
                              onPressed: () => Navigator.pop(ctx, false),
                              child: const Text('Cancel')),
                          ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.kSuccess),
                              onPressed: () => Navigator.pop(ctx, true),
                              child: const Text('Approve All')),
                        ],
                      ),
                    );
                    if (ok == true && context.mounted) {
                      AppNotifier.showSnackBar(
                          context,
                          SnackBar(
                              content:
                                  Text('$pendingCount requests approved')));
                    }
                  },
                  icon: Icon(PhosphorIcons.checkCircle(), size: 18),
                  label: Text('Batch Approve ($pendingCount)'),
                ),
            ],
          ),
          const SizedBox(height: 16),
          AdminTable(
            columns: const [
              'Item',
              'Quantity',
              'From Branch',
              'Status',
              'Actions'
            ],
            rows: requests.map((r) {
              final req = r as Map<String, dynamic>;
              final status = '${req['status']}';
              return [
                Text('${req['item']}'),
                Text('${req['quantity']}'),
                Text('${req['from_branch']}'),
                StatusBadge(status: status),
                status == 'pending'
                    ? Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: Icon(PhosphorIcons.checkCircle(),
                                color: AppColors.kSuccess, size: 20),
                            onPressed: () {
                              AppNotifier.showSnackBar(
                                  context,
                                  SnackBar(
                                      content: Text(
                                          'Request for ${req['item']} approved')));
                            },
                            tooltip: 'Approve',
                          ),
                          IconButton(
                            icon: Icon(PhosphorIcons.x(),
                                color: AppColors.kError, size: 20),
                            onPressed: () {
                              AppNotifier.showSnackBar(
                                  context,
                                  SnackBar(
                                      content: Text(
                                          'Request for ${req['item']} rejected')));
                            },
                            tooltip: 'Reject',
                          ),
                        ],
                      )
                    : Text(status == 'approved' ? 'Approved' : 'Rejected',
                        style: TextStyle(
                            color: status == 'approved'
                                ? AppColors.kSuccess
                                : AppColors.kError,
                            fontSize: 12)),
              ];
            }).toList(),
          ),
        ],
      ),
    );
  }
}
