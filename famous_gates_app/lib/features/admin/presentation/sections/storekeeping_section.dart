import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/api_error_message.dart';
import '../../domain/admin_providers.dart';

class StorekeepingSection extends ConsumerWidget {
  const StorekeepingSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboardAsync = ref.watch(centralStoreDashboardProvider);
    final valuationAsync = ref.watch(centralStoreValuationProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref
          ..invalidate(centralStoreDashboardProvider)
          ..invalidate(centralStoreValuationProvider)
          ..invalidate(centralStoreRequestsProvider)
          ..invalidate(centralApprovedStoreRequestsProvider)
          ..invalidate(centralStoreDispatchesProvider)
          ..invalidate(centralPurchaseOrdersProvider)
          ..invalidate(centralGrnsProvider)
          ..invalidate(centralStockTakesProvider)
          ..invalidate(centralSpoilageProvider);
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
        children: [
          _sectionHeader(
            title: 'Central Store',
            subtitle:
                'Live procurement, receiving, stock control, dispatch and audit queues',
            icon: PhosphorIcons.warehouse(),
          ),
          const SizedBox(height: 20),
          dashboardAsync.when(
            loading: () => const _LoadingBand(),
            error: (error, _) => _ErrorBand(message: apiErrorMessage(error)),
            data: (dashboard) => _DashboardCards(dashboard: dashboard),
          ),
          const SizedBox(height: 16),
          valuationAsync.when(
            loading: () => const _LoadingBand(),
            error: (error, _) => _ErrorBand(message: apiErrorMessage(error)),
            data: (valuation) => _ValuationCards(valuation: valuation),
          ),
          const SizedBox(height: 24),
          _OperationsGrid(ref: ref),
          const SizedBox(height: 24),
          _QueueGrid(ref: ref),
        ],
      ),
    );
  }
}

Widget _sectionHeader({
  required String title,
  required String subtitle,
  required IconData icon,
}) {
  return Row(
    children: [
      Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: AppColors.kPrimary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: AppColors.kPrimary),
      ),
      const SizedBox(width: 14),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w800,
                color: AppColors.kTextPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: const TextStyle(
                  fontSize: 13, color: AppColors.kTextSecondary),
            ),
          ],
        ),
      ),
    ],
  );
}

class _DashboardCards extends StatelessWidget {
  const _DashboardCards({required this.dashboard});

  final Map<String, dynamic> dashboard;

  @override
  Widget build(BuildContext context) {
    final stats = dashboard['stats'] is Map
        ? Map<String, dynamic>.from(dashboard['stats'] as Map)
        : dashboard;
    return _ResponsiveCards(
      children: [
        _MetricCard(
          label: 'Master Items',
          value: _intText(stats['totalMasterItems'] ?? dashboard['totalItems']),
          icon: PhosphorIcons.package(),
          color: AppColors.kPrimary,
        ),
        _MetricCard(
          label: 'Pending Requests',
          value: _intText(stats['pendingRequests']),
          icon: PhosphorIcons.clipboardText(),
          color: Colors.orange,
        ),
        _MetricCard(
          label: 'Ready / In Transit',
          value: _intText(stats['inTransit']),
          icon: PhosphorIcons.truck(),
          color: Colors.green,
        ),
        _MetricCard(
          label: 'Low Stock Items',
          value: _intText(
            stats['totalLowStockItems'] ?? dashboard['lowStockCount'],
          ),
          icon: PhosphorIcons.warning(),
          color: Colors.red,
        ),
      ],
    );
  }
}

class _ValuationCards extends StatelessWidget {
  const _ValuationCards({required this.valuation});

  final Map<String, dynamic> valuation;

  @override
  Widget build(BuildContext context) {
    final food = _map(valuation['foodstuffs']);
    final bar = _map(valuation['bar_store']);
    final total = _map(valuation['grand_total']);
    return _ResponsiveCards(
      children: [
        _MetricCard(
          label: 'Foodstuffs Value',
          value: _money(food['total_value']),
          detail: '${_intText(food['item_count'])} items',
          icon: PhosphorIcons.forkKnife(),
          color: Colors.teal,
        ),
        _MetricCard(
          label: 'Bar Store Value',
          value: _money(bar['total_value']),
          detail: '${_intText(bar['item_count'])} items',
          icon: PhosphorIcons.wine(),
          color: Colors.purple,
        ),
        _MetricCard(
          label: 'Total Stock Value',
          value: _money(total['total_value']),
          detail: '${_intText(total['item_count'])} active items',
          icon: PhosphorIcons.currencyDollar(),
          color: Colors.green,
        ),
      ],
    );
  }
}

class _OperationsGrid extends StatelessWidget {
  const _OperationsGrid({required this.ref});

  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final actions = [
      _CentralAction('Master Inventory', 'Create items, SKU, barcode and stock',
          PhosphorIcons.package(), AdminSection.inventory),
      _CentralAction('Foodstuffs', 'Food store stock and valuation',
          PhosphorIcons.forkKnife(), AdminSection.foodstuffs),
      _CentralAction('Bar & Beverages', 'Alcohol and beverage store',
          PhosphorIcons.wine(), AdminSection.barBeverages),
      _CentralAction('Stock Requests', 'Branch requisitions and approvals',
          PhosphorIcons.clipboardText(), AdminSection.requisitions),
      _CentralAction('Packing', 'Prepare approved stock requests',
          PhosphorIcons.package(), AdminSection.packing),
      _CentralAction('Dispatch Notes', 'Dispatch and delivery tracking',
          PhosphorIcons.truck(), AdminSection.dispatchNotes),
      _CentralAction('Purchase Orders', 'Supplier procurement orders',
          PhosphorIcons.fileText(), AdminSection.purchaseOrders),
      _CentralAction('Goods Receipt (GRN)', 'Receive supplier deliveries',
          PhosphorIcons.downloadSimple(), AdminSection.goodsReceiptGRN),
      _CentralAction('Stock Takes', 'Food and bar-store physical counts',
          PhosphorIcons.clipboardText(), AdminSection.centralStockTakes),
      _CentralAction('Spoilage Log', 'Record and approve store losses',
          PhosphorIcons.trash(), AdminSection.centralSpoilage),
      _CentralAction('Suppliers', 'Supplier database and contacts',
          PhosphorIcons.users(), AdminSection.suppliers),
      _CentralAction('Central Reports', 'Valuation, VAT, GRNI and aging',
          PhosphorIcons.chartBar(), AdminSection.centralReports),
    ];

    return _Panel(
      title: 'Operational Areas',
      child: _ResponsiveCards(
        minWidth: 260,
        children: actions
            .map(
              (action) => _ActionTile(
                action: action,
                onTap: () => ref.read(adminSectionProvider.notifier).state =
                    action.section,
              ),
            )
            .toList(),
      ),
    );
  }
}

class _QueueGrid extends StatelessWidget {
  const _QueueGrid({required this.ref});

  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return _ResponsiveCards(
      minWidth: 360,
      children: [
        _QueueCard(
          title: 'Stock Requests',
          value: ref.watch(centralApprovedStoreRequestsProvider),
          statusKey: 'status',
          openSection: AdminSection.requisitions,
          ref: ref,
        ),
        _QueueCard(
          title: 'Dispatch Notes',
          value: ref.watch(centralStoreDispatchesProvider),
          statusKey: 'status',
          openSection: AdminSection.dispatchNotes,
          ref: ref,
        ),
        _QueueCard(
          title: 'Purchase Orders',
          value: ref.watch(centralPurchaseOrdersProvider),
          statusKey: 'status',
          openSection: AdminSection.purchaseOrders,
          ref: ref,
        ),
        _QueueCard(
          title: 'GRNs',
          value: ref.watch(centralGrnsProvider),
          statusKey: 'status',
          openSection: AdminSection.goodsReceiptGRN,
          ref: ref,
        ),
        _QueueCard(
          title: 'Stock Takes',
          value: ref.watch(centralStockTakesProvider),
          statusKey: 'status',
          openSection: AdminSection.centralStockTakes,
          ref: ref,
        ),
        _QueueCard(
          title: 'Spoilage',
          value: ref.watch(centralSpoilageProvider),
          statusKey: 'status',
          openSection: AdminSection.centralSpoilage,
          ref: ref,
        ),
      ],
    );
  }
}

class _QueueCard extends StatelessWidget {
  const _QueueCard({
    required this.title,
    required this.value,
    required this.statusKey,
    required this.openSection,
    required this.ref,
  });

  final String title;
  final AsyncValue<List<Map<String, dynamic>>> value;
  final String statusKey;
  final AdminSection openSection;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      title: title,
      trailing: TextButton(
        onPressed: () =>
            ref.read(adminSectionProvider.notifier).state = openSection,
        child: const Text('Open'),
      ),
      child: value.when(
        loading: () => const SizedBox(
          height: 88,
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (error, _) => _ErrorBand(message: apiErrorMessage(error)),
        data: (rows) {
          final pending = rows.where((row) {
            final status = '${row[statusKey] ?? ''}'.toLowerCase();
            return status.contains('pending') ||
                status.contains('draft') ||
                status.contains('ready') ||
                status.contains('progress');
          }).length;
          final latest = rows.take(3).toList();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  _TinyStat(label: 'Total', value: '${rows.length}'),
                  const SizedBox(width: 12),
                  _TinyStat(label: 'Needs Action', value: '$pending'),
                ],
              ),
              const SizedBox(height: 12),
              if (latest.isEmpty)
                const Text(
                  'No records found',
                  style: TextStyle(color: AppColors.kTextSecondary),
                )
              else
                ...latest.map(
                  (row) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _firstText(row, const [
                              'request_number',
                              'dispatch_number',
                              'po_number',
                              'grn_number',
                              'session_number',
                              'reference_number',
                              'id',
                            ]),
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                        const SizedBox(width: 8),
                        _StatusPill('${row[statusKey] ?? 'open'}'),
                      ],
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

class _ResponsiveCards extends StatelessWidget {
  const _ResponsiveCards({required this.children, this.minWidth = 220});

  final List<Widget> children;
  final double minWidth;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 12.0;
        final columns = (constraints.maxWidth / minWidth).floor().clamp(1, 4);
        final width = (constraints.maxWidth - gap * (columns - 1)) / columns;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: children
              .map((child) => SizedBox(width: width.toDouble(), child: child))
              .toList(),
        );
      },
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    this.detail,
  });

  final String label;
  final String value;
  final String? detail;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: AppColors.kTextPrimary,
                  ),
                ),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.kTextSecondary,
                  ),
                ),
                if (detail != null)
                  Text(
                    detail!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 11,
                      color: AppColors.kTextSecondary,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.action, required this.onTap});

  final _CentralAction action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: _Panel(
        child: Row(
          children: [
            Icon(action.icon, color: AppColors.kPrimary),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    action.title,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    action.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.kTextSecondary,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.kTextSecondary),
          ],
        ),
      ),
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.child, this.title, this.trailing});

  final Widget child;
  final String? title;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.7)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (title != null) ...[
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title!,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  if (trailing != null) trailing!,
                ],
              ),
              const SizedBox(height: 12),
            ],
            child,
          ],
        ),
      ),
    );
  }
}

class _TinyStat extends StatelessWidget {
  const _TinyStat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: AppColors.kSurface,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.kTextSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill(this.status);

  final String status;

  @override
  Widget build(BuildContext context) {
    final lower = status.toLowerCase();
    final color = lower.contains('approve') ||
            lower.contains('complete') ||
            lower.contains('confirm') ||
            lower.contains('deliver')
        ? Colors.green
        : lower.contains('reject') || lower.contains('cancel')
            ? Colors.red
            : Colors.orange;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status.replaceAll('_', ' ').toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: color,
        ),
      ),
    );
  }
}

class _LoadingBand extends StatelessWidget {
  const _LoadingBand();

  @override
  Widget build(BuildContext context) {
    return const _Panel(
      child: SizedBox(
        height: 72,
        child: Center(child: CircularProgressIndicator()),
      ),
    );
  }
}

class _ErrorBand extends StatelessWidget {
  const _ErrorBand({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: Text(
        message,
        style: const TextStyle(color: Colors.red),
      ),
    );
  }
}

class _CentralAction {
  const _CentralAction(this.title, this.description, this.icon, this.section);

  final String title;
  final String description;
  final IconData icon;
  final AdminSection section;
}

Map<String, dynamic> _map(dynamic value) {
  if (value is Map) return Map<String, dynamic>.from(value);
  return {};
}

String _firstText(Map<String, dynamic> row, List<String> keys) {
  for (final key in keys) {
    final value = row[key];
    if (value != null && '$value'.trim().isNotEmpty && '$value' != 'null') {
      return '$value';
    }
  }
  return '—';
}

String _intText(dynamic value) {
  if (value is num) return value.round().toString();
  final parsed = num.tryParse('$value');
  return (parsed ?? 0).round().toString();
}

String _money(dynamic value) {
  final amount = value is num ? value : num.tryParse('$value') ?? 0;
  if (amount.abs() >= 1000000) {
    return 'KES ${(amount / 1000000).toStringAsFixed(1)}M';
  }
  if (amount.abs() >= 1000) {
    return 'KES ${(amount / 1000).toStringAsFixed(1)}K';
  }
  return 'KES ${amount.toStringAsFixed(0)}';
}
