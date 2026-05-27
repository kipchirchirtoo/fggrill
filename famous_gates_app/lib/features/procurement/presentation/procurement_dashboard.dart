import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/widgets.dart';
import '../domain/providers.dart';

class ProcurementDashboard extends ConsumerStatefulWidget {
  const ProcurementDashboard({super.key});

  @override
  ConsumerState<ProcurementDashboard> createState() =>
      _ProcurementDashboardState();
}

class _ProcurementDashboardState extends ConsumerState<ProcurementDashboard> {
  int _currentTab = 0;

  @override
  Widget build(BuildContext context) {
    final tabs = [
      DashboardTab(
          label: 'Overview',
          icon: PhosphorIcons.chartBar(),
          content: _buildOverview()),
      DashboardTab(
          label: 'Purchase Orders',
          icon: PhosphorIcons.fileText(),
          content: _buildPurchaseOrders()),
      DashboardTab(
          label: 'Suppliers',
          icon: PhosphorIcons.users(),
          content: _buildSuppliers()),
    ];

    return DashboardShell(
      title: 'Procurement',
      currentTab: _currentTab,
      onTabChanged: (i) => setState(() => _currentTab = i),
      tabs: tabs,
    );
  }

  Widget _buildOverview() {
    final poAsync = ref.watch(recentPurchaseOrdersProvider);
    final grniAsync = ref.watch(procurementGrniProvider);
    final invoicesAsync = ref.watch(pendingInvoicesProvider);
    final suppliersAsync = ref.watch(procurementSuppliersProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Procurement Overview',
                        style: Theme.of(context).textTheme.displaySmall),
                    const SizedBox(height: 4),
                    const Text('Manage your supply chain and accounts payable',
                        style: TextStyle(color: AppColors.kTextSecondary)),
                  ],
                ),
              ),
              ElevatedButton.icon(
                style:
                    ElevatedButton.styleFrom(minimumSize: const Size(180, 44)),
                onPressed: () => AppNotifier.showSnackBar(
                  context,
                  const SnackBar(
                      content: Text(
                          'Purchase order creation opens from the Purchase Orders tab')),
                ),
                icon: Icon(PhosphorIcons.plus(), size: 16),
                label: const Text('New Purchase Order'),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              _StatCard(
                  label: 'Pending POs',
                  value: poAsync.maybeWhen(
                      data: (d) =>
                          '${d.where((p) => p.status == 'pending').length}',
                      orElse: () => '-'),
                  icon: PhosphorIcons.clock(),
                  color: AppColors.kWarning),
              const SizedBox(width: 16),
              _StatCard(
                  label: 'Open GRNI',
                  value: grniAsync.maybeWhen(
                      data: (d) => '${d.length}', orElse: () => '-'),
                  icon: PhosphorIcons.package(),
                  color: AppColors.kPrimary),
              const SizedBox(width: 16),
              _StatCard(
                  label: 'Pending Invoices',
                  value: invoicesAsync.maybeWhen(
                      data: (d) => '${d.length}', orElse: () => '-'),
                  icon: PhosphorIcons.fileText(),
                  color: AppColors.kAccent),
              const SizedBox(width: 16),
              _StatCard(
                  label: 'Low Stock',
                  value: grniAsync.maybeWhen(
                      data: (d) =>
                          '${d.where((e) => e['is_low_stock'] == true || e['low_stock'] == true).length}',
                      orElse: () => '-'),
                  icon: PhosphorIcons.warningCircle(),
                  color: AppColors.kError),
            ],
          ),
          const SizedBox(height: 32),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Recent Purchase Orders',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 16),
                  poAsync.when(
                    data: (items) => items.isEmpty
                        ? const EmptyState(message: 'No purchase orders found')
                        : ListView.separated(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: items.take(5).length,
                            separatorBuilder: (_, __) => const Divider(),
                            itemBuilder: (context, index) {
                              final item = items[index];
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: const CircleAvatar(
                                  backgroundColor: AppColors.kSurface,
                                  child: Icon(Icons.receipt_long_outlined),
                                ),
                                title: Text(item.id.isEmpty
                                    ? 'Purchase Order'
                                    : 'PO #${item.id}'),
                                subtitle: Text(item.supplierName),
                                trailing: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                        'KES ${item.total.toStringAsFixed(0)}'),
                                    const SizedBox(width: 12),
                                    _statusBadge(item.status),
                                  ],
                                ),
                              );
                            },
                          ),
                    loading: () =>
                        const LoadingSkeleton(type: SkeletonType.list),
                    error: (e, _) => ErrorState(message: '$e'),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: _quickAccessCard()),
              const SizedBox(width: 16),
              Expanded(
                  child: _complianceCard(
                suppliersVerified: suppliersAsync.maybeWhen(
                  data: (s) => s.where((e) => e.name.isNotEmpty).length,
                  orElse: () => 0,
                ),
                openGrni:
                    grniAsync.maybeWhen(data: (d) => d.length, orElse: () => 0),
              )),
            ],
          ),
        ],
      ),
    );
  }

  Widget _quickAccessCard() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Quick Access',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _quickLink(PhosphorIcons.users(), 'Supplier Directory',
                () => setState(() => _currentTab = 2)),
            _quickLink(PhosphorIcons.listBullets(), 'Item Master List', () {}),
            _quickLink(PhosphorIcons.chartLine(), 'Aging Analysis', () {}),
          ],
        ),
      ),
    );
  }

  Widget _complianceCard(
      {required int suppliersVerified, required int openGrni}) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Compliance Status',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            _complianceRow('KRA VAT PINs Verified', suppliersVerified > 0),
            _complianceRow('Audit Logs Active', true),
            _complianceRow('Open GRNIs Below Limit', openGrni <= 10),
          ],
        ),
      ),
    );
  }

  Widget _quickLink(IconData icon, String label, VoidCallback onTap) =>
      ListTile(
        dense: true,
        contentPadding: EdgeInsets.zero,
        leading: Icon(icon, color: AppColors.kPrimary),
        title: Text(label),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      );

  Widget _complianceRow(String label, bool ok) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Icon(ok ? PhosphorIcons.checkCircle() : PhosphorIcons.xCircle(),
                color: ok ? AppColors.kSuccess : AppColors.kError, size: 18),
            const SizedBox(width: 8),
            Expanded(child: Text(label)),
          ],
        ),
      );

  Widget _buildPurchaseOrders() {
    final poAsync = ref.watch(purchaseOrdersProvider);
    return poAsync.when(
      data: (orders) => orders.isEmpty
          ? const EmptyState(message: 'No purchase orders found', icon: null)
          : ListView.builder(
              padding: const EdgeInsets.all(24),
              itemCount: orders.length,
              itemBuilder: (context, index) {
                final po = orders[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      children: [
                        Icon(PhosphorIcons.fileText(),
                            color: AppColors.kPrimary, size: 28),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('PO #${po.id}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 15)),
                              Text(po.supplierName,
                                  style: const TextStyle(
                                      color: AppColors.kTextSecondary)),
                              Text('Total: KES ${po.total.toStringAsFixed(0)}',
                                  style: const TextStyle(
                                      color: AppColors.kTextSecondary,
                                      fontSize: 12)),
                            ],
                          ),
                        ),
                        _statusBadge(po.status),
                        const SizedBox(width: 12),
                        ElevatedButton(
                          onPressed: () => AppNotifier.showSnackBar(
                            context,
                            SnackBar(
                                content: Text('Approving PO #${po.id}...')),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.kSuccess,
                            minimumSize: const Size(80, 36),
                          ),
                          child: const Text('Approve',
                              style: TextStyle(fontSize: 12)),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
      loading: () =>
          const Center(child: LoadingSkeleton(type: SkeletonType.list)),
      error: (e, _) => ErrorState(
          message: '$e', onRetry: () => ref.invalidate(purchaseOrdersProvider)),
    );
  }

  Widget _buildSuppliers() {
    final suppliersAsync = ref.watch(procurementSuppliersProvider);
    return suppliersAsync.when(
      data: (suppliers) => suppliers.isEmpty
          ? const EmptyState(message: 'No suppliers found')
          : ListView.builder(
              padding: const EdgeInsets.all(24),
              itemCount: suppliers.length,
              itemBuilder: (context, index) {
                final s = suppliers[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AppColors.kPrimary,
                      child: Text(
                        s.name.isNotEmpty ? s.name[0].toUpperCase() : '?',
                        style: const TextStyle(
                            color: Colors.white, fontWeight: FontWeight.bold),
                      ),
                    ),
                    title: Text(s.name,
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (s.email.isNotEmpty) Text(s.email),
                        if (s.phone.isNotEmpty) Text(s.phone),
                      ],
                    ),
                    trailing: s.category.isNotEmpty
                        ? Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.kPrimary.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(s.category,
                                style: const TextStyle(
                                    fontSize: 11, color: AppColors.kPrimary)),
                          )
                        : null,
                  ),
                );
              },
            ),
      loading: () =>
          const Center(child: LoadingSkeleton(type: SkeletonType.list)),
      error: (e, _) => ErrorState(
          message: '$e',
          onRetry: () => ref.invalidate(procurementSuppliersProvider)),
    );
  }

  Widget _statusBadge(String status) {
    Color color;
    switch (status.toLowerCase()) {
      case 'approved':
        color = AppColors.kSuccess;
        break;
      case 'pending':
        color = AppColors.kWarning;
        break;
      case 'rejected':
        color = AppColors.kError;
        break;
      default:
        color = AppColors.kTextSecondary;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status.isEmpty ? 'unknown' : status,
        style:
            TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _StatCard(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 16),
              Text(value,
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.bold)),
              Text(label,
                  style: const TextStyle(
                      color: AppColors.kTextSecondary, fontSize: 12)),
            ],
          ),
        ),
      ),
    );
  }
}
