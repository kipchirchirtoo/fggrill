import 'package:flutter/material.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';

// ─── Shared ────────────────────────────────────────────────────────────────

Widget _header(String title, IconData icon, {String? subtitle}) => Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
      decoration: const BoxDecoration(
          color: Colors.white,
          border: Border(bottom: BorderSide(color: AppColors.kDivider))),
      child: Row(children: [
        Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
                color: AppColors.kPrimary.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10)),
            child: Icon(icon, color: AppColors.kPrimary, size: 20)),
        const SizedBox(width: 14),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.kTextPrimary)),
          if (subtitle != null)
            Text(subtitle,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary)),
        ]),
      ]),
    );

class _StatCard extends StatelessWidget {
  final String label, value;
  final IconData icon;
  final Color color;
  const _StatCard(
      {required this.label,
      required this.value,
      required this.icon,
      required this.color});
  @override
  Widget build(BuildContext context) => Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
        child: Padding(
            padding: const EdgeInsets.all(16),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(icon, color: color, size: 18),
              const SizedBox(height: 8),
              Text(value,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w700)),
              Text(label,
                  style: const TextStyle(
                      fontSize: 11, color: AppColors.kTextSecondary)),
            ])),
      );
}

Widget _emptyTable(String title) => Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Text(title,
                style: const TextStyle(
                    fontWeight: FontWeight.w600, fontSize: 14))),
        const Divider(height: 1),
        const Padding(
            padding: EdgeInsets.all(20),
            child: Center(
                child: Text('No records found',
                    style: TextStyle(color: AppColors.kTextSecondary)))),
      ]),
    );

// ═══════════════════════════════════════════════════════════════════
// BRANCH OPERATIONS
// ═══════════════════════════════════════════════════════════════════

class BranchOpsOverviewSection extends StatelessWidget {
  const BranchOpsOverviewSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Branch Operations', PhosphorIcons.buildings(),
            subtitle: 'Overview of all branch operational performance'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Active Branches',
                            value: '—',
                            icon: PhosphorIcons.buildings(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Occupied Rooms',
                            value: '—',
                            icon: PhosphorIcons.bed(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Today\'s Revenue',
                            value: '—',
                            icon: PhosphorIcons.currencyDollar(),
                            color: Colors.blue)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Active Staff',
                            value: '—',
                            icon: PhosphorIcons.users(),
                            color: Colors.orange)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Branch Performance'),
                ]))),
      ]);
}

class StockLevelsSection extends StatelessWidget {
  const StockLevelsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Stock Levels', PhosphorIcons.package(),
            subtitle: 'Branch-level stock monitoring and alerts'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Total SKUs',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Low Stock',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Out of Stock',
                            value: '—',
                            icon: PhosphorIcons.x(),
                            color: Colors.red)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Stock Levels'),
                ]))),
      ]);
}

class StockTakesSection extends StatelessWidget {
  const StockTakesSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Stock Takes', PhosphorIcons.clipboardText(),
            subtitle: 'Schedule and conduct inventory stock counts'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Stock Takes',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        ElevatedButton.icon(
                          onPressed: () async {
                            final ok = await showDialog<bool>(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                      title: const Text('Start Stock Take'),
                                      content: const Text(
                                          'Begin a new stock count for all facility assets?'),
                                      actions: [
                                        TextButton(
                                            onPressed: () =>
                                                Navigator.pop(ctx, false),
                                            child: const Text('Cancel')),
                                        ElevatedButton(
                                            onPressed: () =>
                                                Navigator.pop(ctx, true),
                                            child: const Text('Start'))
                                      ],
                                    ));
                            if (ok == true && context.mounted) {
                              AppNotifier.showSnackBar(
                                  context,
                                  const SnackBar(
                                      content: Text('Stock take started')));
                            }
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('New Stock Take'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 20),
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'In Progress',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Completed This Month',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Variances Found',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.red)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Stock Take History'),
                ]))),
      ]);
}

class BranchSchedulingSection extends StatelessWidget {
  const BranchSchedulingSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Scheduling', PhosphorIcons.calendarBlank(),
            subtitle: 'Staff scheduling and shift management'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Scheduled Today',
                            value: '—',
                            icon: PhosphorIcons.users(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Open Shifts',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Upcoming (7 days)',
                            value: '—',
                            icon: PhosphorIcons.calendar(),
                            color: Colors.blue)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Schedule'),
                ]))),
      ]);
}

// ═══════════════════════════════════════════════════════════════════
// FACILITIES
// ═══════════════════════════════════════════════════════════════════

class FacilitiesOverviewSection extends StatelessWidget {
  const FacilitiesOverviewSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Facilities Overview', PhosphorIcons.buildings(),
            subtitle: 'Housekeeping, maintenance and room management'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Rooms Cleaned',
                            value: '—',
                            icon: PhosphorIcons.sparkle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Pending Cleaning',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Open Work Orders',
                            value: '—',
                            icon: PhosphorIcons.wrench(),
                            color: Colors.red)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Inspections Due',
                            value: '—',
                            icon: PhosphorIcons.clipboardText(),
                            color: AppColors.kPrimary)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Facilities Summary'),
                ]))),
      ]);
}

class HousekeepingTasksSection extends StatelessWidget {
  const HousekeepingTasksSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Tasks', PhosphorIcons.clipboardText(),
            subtitle: 'Housekeeping task assignments and status'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Pending',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'In Progress',
                            value: '—',
                            icon: PhosphorIcons.spinner(),
                            color: Colors.blue)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Completed Today',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Task List'),
                ]))),
      ]);
}

class HousekeepingInspectionsSection extends StatelessWidget {
  const HousekeepingInspectionsSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Inspections', PhosphorIcons.magnifyingGlass(),
            subtitle: 'Room and facility quality inspections'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Scheduled Today',
                            value: '—',
                            icon: PhosphorIcons.calendar(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Pass Rate',
                            value: '—',
                            icon: PhosphorIcons.chartBar(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Flagged',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.red)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Inspection Records'),
                ]))),
      ]);
}

class LostFoundSection extends StatelessWidget {
  const LostFoundSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Lost & Found', PhosphorIcons.question(),
            subtitle: 'Track and manage lost and found items'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Lost & Found Items',
                            style: TextStyle(
                                fontWeight: FontWeight.w600, fontSize: 14)),
                        ElevatedButton.icon(
                          onPressed: () {
                            final descCtrl = TextEditingController();
                            final locationCtrl = TextEditingController();
                            showDialog(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Log Lost & Found Item'),
                                content: Column(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      TextField(
                                          controller: descCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Item Description')),
                                      const SizedBox(height: 12),
                                      TextField(
                                          controller: locationCtrl,
                                          decoration: const InputDecoration(
                                              labelText: 'Found Location')),
                                    ]),
                                actions: [
                                  TextButton(
                                      onPressed: () => Navigator.pop(ctx),
                                      child: const Text('Cancel')),
                                  ElevatedButton(
                                      onPressed: () {
                                        Navigator.pop(ctx);
                                        AppNotifier.showSnackBar(
                                            context,
                                            const SnackBar(
                                                content: Text('Item logged')));
                                      },
                                      child: const Text('Log')),
                                ],
                              ),
                            );
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('Log Item'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 20),
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Unclaimed',
                            value: '—',
                            icon: PhosphorIcons.question(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Returned',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Items Register'),
                ]))),
      ]);
}

class WorkOrdersSection extends StatelessWidget {
  const WorkOrdersSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Work Orders', PhosphorIcons.wrench(),
            subtitle: 'Maintenance work orders and repair tickets'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Open',
                            value: '—',
                            icon: PhosphorIcons.wrench(),
                            color: Colors.red)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'In Progress',
                            value: '—',
                            icon: PhosphorIcons.spinner(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Closed Today',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                  ]),
                  const SizedBox(height: 20),
                  Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Work Orders',
                            style: TextStyle(fontWeight: FontWeight.w600)),
                        ElevatedButton.icon(
                          onPressed: () {
                            final titleCtrl = TextEditingController();
                            final locationCtrl = TextEditingController();
                            String priority = 'medium';
                            showDialog(
                              context: context,
                              builder: (ctx) => StatefulBuilder(
                                builder: (ctx, setS) => AlertDialog(
                                  title: const Text('New Work Order'),
                                  content: Column(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        TextField(
                                            controller: titleCtrl,
                                            decoration: const InputDecoration(
                                                labelText:
                                                    'Issue Description')),
                                        const SizedBox(height: 12),
                                        TextField(
                                            controller: locationCtrl,
                                            decoration: const InputDecoration(
                                                labelText: 'Location')),
                                        const SizedBox(height: 12),
                                        DropdownButtonFormField<String>(
                                          initialValue: priority,
                                          decoration: const InputDecoration(
                                              labelText: 'Priority'),
                                          items: [
                                            'low',
                                            'medium',
                                            'high',
                                            'urgent'
                                          ]
                                              .map((p) => DropdownMenuItem(
                                                  value: p,
                                                  child: Text(p.toUpperCase())))
                                              .toList(),
                                          onChanged: (v) => setS(
                                              () => priority = v ?? priority),
                                        ),
                                      ]),
                                  actions: [
                                    TextButton(
                                        onPressed: () => Navigator.pop(ctx),
                                        child: const Text('Cancel')),
                                    ElevatedButton(
                                        onPressed: () {
                                          Navigator.pop(ctx);
                                          AppNotifier.showSnackBar(
                                              context,
                                              const SnackBar(
                                                  content: Text(
                                                      'Work order created')));
                                        },
                                        child: const Text('Create')),
                                  ],
                                ),
                              ),
                            );
                          },
                          icon: Icon(PhosphorIcons.plus(), size: 14),
                          label: const Text('New Work Order'),
                          style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.kPrimary,
                              foregroundColor: Colors.white,
                              minimumSize: const Size(0, 36)),
                        ),
                      ]),
                  const SizedBox(height: 12),
                  _emptyTable('Work Orders'),
                ]))),
      ]);
}

class AssetManagementSection extends StatelessWidget {
  const AssetManagementSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Asset Management', PhosphorIcons.warehouse(),
            subtitle: 'Track and manage hotel assets and equipment'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Total Assets',
                            value: '—',
                            icon: PhosphorIcons.warehouse(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Under Maintenance',
                            value: '—',
                            icon: PhosphorIcons.wrench(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Decommissioned',
                            value: '—',
                            icon: PhosphorIcons.x(),
                            color: Colors.red)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Assets Register'),
                ]))),
      ]);
}

class MaintenanceScheduleSection extends StatelessWidget {
  const MaintenanceScheduleSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Schedule', PhosphorIcons.calendarBlank(),
            subtitle: 'Planned and preventive maintenance schedule'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Due Today',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.red)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'This Week',
                            value: '—',
                            icon: PhosphorIcons.calendar(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Completed',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Maintenance Schedule'),
                ]))),
      ]);
}

class RoomStatusSection extends StatelessWidget {
  const RoomStatusSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Room Status', PhosphorIcons.bed(),
            subtitle: 'Live room availability, occupancy and cleaning status'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Occupied',
                            value: '—',
                            icon: PhosphorIcons.bed(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Available',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Under Cleaning',
                            value: '—',
                            icon: PhosphorIcons.sparkle(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Out of Order',
                            value: '—',
                            icon: PhosphorIcons.x(),
                            color: Colors.red)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Room List'),
                ]))),
      ]);
}

class QualityComplianceSection extends StatelessWidget {
  const QualityComplianceSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Quality & Compliance', PhosphorIcons.shieldCheck(),
            subtitle:
                'Quality standards, compliance checks and certifications'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Compliance Score',
                            value: '—',
                            icon: PhosphorIcons.shieldCheck(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Pending Checks',
                            value: '—',
                            icon: PhosphorIcons.clock(),
                            color: Colors.orange)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Failing',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.red)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Compliance Checklist'),
                ]))),
      ]);
}

class SuppliesInventorySection extends StatelessWidget {
  const SuppliesInventorySection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Supplies & Inventory', PhosphorIcons.package(),
            subtitle: 'Housekeeping supplies and consumables inventory'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Total Items',
                            value: '—',
                            icon: PhosphorIcons.package(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Low Stock',
                            value: '—',
                            icon: PhosphorIcons.warning(),
                            color: Colors.orange)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Supplies'),
                ]))),
      ]);
}

class FacilitiesStaffSection extends StatelessWidget {
  const FacilitiesStaffSection({super.key});
  @override
  Widget build(BuildContext context) => Column(children: [
        _header('Staff Management', PhosphorIcons.users(),
            subtitle: 'Facilities and housekeeping staff management'),
        Expanded(
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: _StatCard(
                            label: 'Total Staff',
                            value: '—',
                            icon: PhosphorIcons.users(),
                            color: AppColors.kPrimary)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'On Duty',
                            value: '—',
                            icon: PhosphorIcons.checkCircle(),
                            color: Colors.green)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: _StatCard(
                            label: 'Off Duty',
                            value: '—',
                            icon: PhosphorIcons.moon(),
                            color: Colors.grey)),
                  ]),
                  const SizedBox(height: 20),
                  _emptyTable('Staff List'),
                ]))),
      ]);
}
