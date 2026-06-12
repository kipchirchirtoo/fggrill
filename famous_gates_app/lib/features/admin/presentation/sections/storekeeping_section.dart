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
          const SizedBox(height: 16),
          _CommandHero(ref: ref),
          const SizedBox(height: 16),
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
          const SizedBox(height: 22),
          _OperationsGrid(ref: ref),
          const SizedBox(height: 22),
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

class _CommandHero extends StatelessWidget {
  const _CommandHero({required this.ref});

  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    final shortcuts = [
      _CentralAction('Receive Goods', 'Post GRN',
          PhosphorIcons.downloadSimple(), AdminSection.goodsReceiving),
      _CentralAction('Create PO', 'Supplier order', PhosphorIcons.fileText(),
          AdminSection.purchaseOrders),
      _CentralAction('Pack Requests', 'Approved stock', PhosphorIcons.package(),
          AdminSection.packing),
      _CentralAction('Reports', 'Valuation & GRNI', PhosphorIcons.chartBar(),
          AdminSection.centralReports),
    ];

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.kDivider.withValues(alpha: .72)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: LayoutBuilder(builder: (context, constraints) {
          final narrow = constraints.maxWidth < 860;
          final intro = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(PhosphorIcons.activity(),
                      color: AppColors.kPrimary, size: 22),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        "Today's Store Command",
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: AppColors.kTextPrimary,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Receive, fulfill, audit and report from one focused workspace.',
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.kTextSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ]),
            ],
          );

          final actions = Wrap(
            spacing: 10,
            runSpacing: 10,
            alignment: narrow ? WrapAlignment.start : WrapAlignment.end,
            children: shortcuts
                .map(
                  (action) => _HeroShortcut(
                    action: action,
                    onTap: () => ref.read(adminSectionProvider.notifier).state =
                        action.section,
                  ),
                )
                .toList(),
          );

          if (narrow) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                intro,
                const SizedBox(height: 14),
                actions,
              ],
            );
          }

          return Row(
            children: [
              Expanded(child: intro),
              const SizedBox(width: 20),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 580),
                child: actions,
              ),
            ],
          );
        }),
      ),
    );
  }
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
      minWidth: 250,
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
      minWidth: 300,
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
    final primaryActions = [
      _CentralAction('Goods Receiving', 'Post supplier GRNs',
          PhosphorIcons.downloadSimple(), AdminSection.goodsReceiving),
      _CentralAction('Stock Requests', 'Approve and fulfill branches',
          PhosphorIcons.clipboardText(), AdminSection.requisitions),
      _CentralAction('Packing', 'Prepare approved stock',
          PhosphorIcons.package(), AdminSection.packing),
      _CentralAction('Dispatch Notes', 'Dispatch and delivery tracking',
          PhosphorIcons.truck(), AdminSection.dispatchNotes),
      _CentralAction('Purchase Orders', 'Supplier procurement',
          PhosphorIcons.fileText(), AdminSection.purchaseOrders),
      _CentralAction('Goods Receipt (GRN)', 'Posted receipt register',
          PhosphorIcons.receipt(), AdminSection.goodsReceiptGRN),
    ];
    final referenceActions = [
      _CentralAction('Master Inventory', 'Create items, SKU and barcode',
          PhosphorIcons.package(), AdminSection.inventory),
      _CentralAction('Foodstuffs', 'Food store stock and valuation',
          PhosphorIcons.forkKnife(), AdminSection.foodstuffs),
      _CentralAction('Bar & Beverages', 'Alcohol and beverage store',
          PhosphorIcons.wine(), AdminSection.barBeverages),
      _CentralAction('Stock Takes', 'Physical counts and variances',
          PhosphorIcons.clipboardText(), AdminSection.centralStockTakes),
      _CentralAction('Spoilage Log', 'Record and approve store losses',
          PhosphorIcons.trash(), AdminSection.centralSpoilage),
      _CentralAction('Suppliers', 'Supplier database and contacts',
          PhosphorIcons.users(), AdminSection.suppliers),
      _CentralAction('Central Reports', 'Valuation, VAT, GRNI and aging',
          PhosphorIcons.chartBar(), AdminSection.centralReports),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionTitle(
          title: 'Shortcut Links',
          subtitle: 'Open the most-used central store workflows.',
        ),
        const SizedBox(height: 10),
        _ResponsiveCards(
          minWidth: 290,
          children: primaryActions
              .map(
                (action) => _ActionTile(
                  action: action,
                  emphasized: true,
                  onTap: () => ref.read(adminSectionProvider.notifier).state =
                      action.section,
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 14),
        _ResponsiveCards(
          minWidth: 260,
          children: referenceActions
              .map(
                (action) => _ActionTile(
                  action: action,
                  onTap: () => ref.read(adminSectionProvider.notifier).state =
                      action.section,
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _QueueGrid extends StatelessWidget {
  const _QueueGrid({required this.ref});

  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionTitle(
          title: 'Live Queues',
          subtitle: 'Latest documents and work waiting for action.',
        ),
        const SizedBox(height: 10),
        _ResponsiveCards(
          minWidth: 340,
          children: [
            _QueueCard(
              title: 'Stock Requests',
              icon: PhosphorIcons.clipboardText(),
              color: Colors.orange,
              value: ref.watch(centralApprovedStoreRequestsProvider),
              statusKey: 'status',
              openSection: AdminSection.requisitions,
              ref: ref,
            ),
            _QueueCard(
              title: 'Dispatch Notes',
              icon: PhosphorIcons.truck(),
              color: Colors.green,
              value: ref.watch(centralStoreDispatchesProvider),
              statusKey: 'status',
              openSection: AdminSection.dispatchNotes,
              ref: ref,
            ),
            _QueueCard(
              title: 'Purchase Orders',
              icon: PhosphorIcons.fileText(),
              color: AppColors.kPrimary,
              value: ref.watch(centralPurchaseOrdersProvider),
              statusKey: 'status',
              openSection: AdminSection.purchaseOrders,
              ref: ref,
            ),
            _QueueCard(
              title: 'GRNs',
              icon: PhosphorIcons.receipt(),
              color: Colors.teal,
              value: ref.watch(centralGrnsProvider),
              statusKey: 'status',
              openSection: AdminSection.goodsReceiptGRN,
              ref: ref,
            ),
            _QueueCard(
              title: 'Stock Takes',
              icon: PhosphorIcons.clipboardText(),
              color: Colors.purple,
              value: ref.watch(centralStockTakesProvider),
              statusKey: 'status',
              openSection: AdminSection.centralStockTakes,
              ref: ref,
            ),
            _QueueCard(
              title: 'Spoilage',
              icon: PhosphorIcons.trash(),
              color: Colors.red,
              value: ref.watch(centralSpoilageProvider),
              statusKey: 'status',
              openSection: AdminSection.centralSpoilage,
              ref: ref,
            ),
          ],
        ),
      ],
    );
  }
}

class _QueueCard extends StatelessWidget {
  const _QueueCard({
    required this.title,
    required this.icon,
    required this.color,
    required this.value,
    required this.statusKey,
    required this.openSection,
    required this.ref,
  });

  final String title;
  final IconData icon;
  final Color color;
  final AsyncValue<List<Map<String, dynamic>>> value;
  final String statusKey;
  final AdminSection openSection;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return _Panel(
      child: value.when(
        loading: () => SizedBox(
          height: 150,
          child: Center(
            child: CircularProgressIndicator(color: color),
          ),
        ),
        error: (error, _) => _ErrorBand(message: apiErrorMessage(error)),
        data: (rows) {
          final pending = rows.where((row) {
            final status = '${row[statusKey] ?? ''}'.toLowerCase();
            return status.contains('pending') ||
                status.contains('draft') ||
                status.contains('ready') ||
                status.contains('progress') ||
                status.contains('partial');
          }).length;
          final latest = rows.take(2).toList();
          return SizedBox(
            height: 184,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: .12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(icon, color: color, size: 19),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: AppColors.kTextPrimary,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: () => ref
                          .read(adminSectionProvider.notifier)
                          .state = openSection,
                      child: const Text('Open'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    _TinyStat(label: 'Total', value: '${rows.length}'),
                    const SizedBox(width: 10),
                    _TinyStat(label: 'Needs Action', value: '$pending'),
                  ],
                ),
                const SizedBox(height: 12),
                if (latest.isEmpty)
                  const Expanded(
                    child: Center(
                      child: Text(
                        'No records found',
                        style: TextStyle(color: AppColors.kTextSecondary),
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.start,
                      children: [
                        for (var index = 0; index < latest.length; index++)
                          Padding(
                            padding: EdgeInsets.only(
                              bottom: index == latest.length - 1 ? 0 : 7,
                            ),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    _firstText(latest[index], const [
                                      'request_number',
                                      'dispatch_number',
                                      'po_number',
                                      'grn_number',
                                      'session_number',
                                      'reference_number',
                                      'id',
                                    ]),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.kTextPrimary,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Flexible(
                                  flex: 0,
                                  child: _StatusPill(
                                    '${latest[index][statusKey] ?? 'open'}',
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 28,
          decoration: BoxDecoration(
            color: AppColors.kPrimary,
            borderRadius: BorderRadius.circular(99),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: AppColors.kTextPrimary,
                ),
              ),
              const SizedBox(height: 1),
              Text(
                subtitle,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.kTextSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
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
    return Container(
      constraints: const BoxConstraints(minHeight: 92),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.7)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.025),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          Positioned(
            left: 0,
            top: 0,
            bottom: 0,
            child: Container(
              width: 4,
              color: color.withValues(alpha: 0.85),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
            child: Row(
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(11),
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
                          fontWeight: FontWeight.w900,
                          color: AppColors.kTextPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
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
          ),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({
    required this.action,
    required this.onTap,
    this.emphasized = false,
  });

  final _CentralAction action;
  final VoidCallback onTap;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    final borderColor = emphasized
        ? AppColors.kPrimary.withValues(alpha: 0.28)
        : AppColors.kDivider.withValues(alpha: 0.72);
    final background = emphasized ? const Color(0xFFF8FBFF) : Colors.white;
    final iconBackground = emphasized
        ? AppColors.kPrimary.withValues(alpha: 0.12)
        : AppColors.kSurface;

    return Material(
      color: background,
      borderRadius: BorderRadius.circular(13),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          height: emphasized ? 76 : 70,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(13),
            border: Border.all(color: borderColor),
          ),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: iconBackground,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(action.icon, color: AppColors.kPrimary, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      action.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w900,
                        color: AppColors.kTextPrimary,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      action.description,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.kTextSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.chevron_right,
                color:
                    emphasized ? AppColors.kPrimary : AppColors.kTextSecondary,
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroShortcut extends StatelessWidget {
  const _HeroShortcut({required this.action, required this.onTap});

  final _CentralAction action;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(999),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          width: 132,
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: AppColors.kDivider.withValues(alpha: 0.82),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(action.icon, size: 17, color: AppColors.kPrimary),
              const SizedBox(width: 7),
              Flexible(
                child: Text(
                  action.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: AppColors.kTextPrimary,
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

class _Panel extends StatelessWidget {
  const _Panel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.7)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 14,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [child],
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
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: AppColors.kDivider.withValues(alpha: 0.55),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              value,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: AppColors.kTextPrimary,
              ),
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
  if (value is num) return _groupedWhole(value);
  final parsed = num.tryParse('$value');
  return _groupedWhole(parsed ?? 0);
}

String _money(dynamic value) {
  final amount = value is num ? value : num.tryParse('$value') ?? 0;
  return 'KES ${_groupedWhole(amount)}';
}

String _groupedWhole(num value) {
  final rounded = value.round();
  final sign = rounded < 0 ? '-' : '';
  final digits = rounded.abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    final fromEnd = digits.length - i;
    buffer.write(digits[i]);
    if (fromEnd > 1 && fromEnd % 3 == 1) buffer.write(',');
  }
  return '$sign$buffer';
}
