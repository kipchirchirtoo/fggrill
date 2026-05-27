import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/admin_providers.dart';
import '../../data/module_guides_data.dart';

// ─── Shared helpers ────────────────────────────────────────────────────────

Widget _sectionHeader(String title, IconData icon, {String? subtitle}) {
  return Container(
    padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(bottom: BorderSide(color: AppColors.kDivider)),
    ),
    child: Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.kPrimary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: AppColors.kPrimary, size: 20),
        ),
        const SizedBox(width: 14),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.kTextPrimary)),
            if (subtitle != null)
              Text(subtitle,
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.kTextSecondary)),
          ],
        ),
      ],
    ),
  );
}

// ─── Kyogong Services ──────────────────────────────────────────────────────

class KyogongServicesSection extends StatelessWidget {
  const KyogongServicesSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _sectionHeader('Kyogong Services', PhosphorIcons.slidersHorizontal(),
            subtitle: 'Spa, sports bar, and executive bar management'),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _KyogongOutletCard(
                    name: 'Spa',
                    path: 'kyogong/spa',
                    icon: PhosphorIcons.sparkle()),
                const SizedBox(height: 12),
                _KyogongOutletCard(
                    name: 'Sports Bar',
                    path: 'kyogong/sports-bar',
                    icon: PhosphorIcons.trophy()),
                const SizedBox(height: 12),
                _KyogongOutletCard(
                    name: 'Executive Bar',
                    path: 'kyogong/executive-bar',
                    icon: PhosphorIcons.wine()),
                const SizedBox(height: 12),
                _KyogongOutletCard(
                    name: 'Reception',
                    path: 'kyogong/reception',
                    icon: PhosphorIcons.user()),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _KyogongOutletCard extends StatelessWidget {
  final String name;
  final String path;
  final IconData icon;
  const _KyogongOutletCard(
      {required this.name, required this.path, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
      child: ListTile(
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
              color: AppColors.kPrimary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10)),
          child: Icon(icon, color: AppColors.kPrimary, size: 20),
        ),
        title: Text('$name POS',
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('Manage $name point-of-sale operations',
            style:
                const TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
        trailing: Icon(PhosphorIcons.caretRight(),
            size: 16, color: AppColors.kTextSecondary),
      ),
    );
  }
}

// ─── Wastage Analytics ────────────────────────────────────────────────────

class WastageAnalyticsSection extends ConsumerWidget {
  const WastageAnalyticsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wastageAsync = ref.watch(adminWastageProvider);
    return Column(
      children: [
        _sectionHeader('Wastage Analytics', PhosphorIcons.trash(),
            subtitle: 'Track and analyse product wastage across all outlets'),
        Expanded(
          child: wastageAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
                child: Text('Error: $e',
                    style: const TextStyle(color: AppColors.kError))),
            data: (records) {
              final now = DateTime.now();
              final todayRecords = records.where((r) {
                final d = r['created_at'] ?? r['date'] ?? '';
                return d.toString().startsWith(
                    '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}');
              }).toList();
              final todayQty = todayRecords.fold<num>(
                  0, (s, r) => s + ((r['quantity'] ?? 0) as num));
              final totalQty = records.fold<num>(
                  0, (s, r) => s + ((r['quantity'] ?? 0) as num));

              // Group by reason/category
              final Map<String, num> byCategory = {};
              for (final r in records) {
                final cat =
                    (r['reason'] ?? r['category'] ?? 'Other').toString();
                byCategory[cat] =
                    (byCategory[cat] ?? 0) + ((r['quantity'] ?? 0) as num);
              }
              final maxQty =
                  byCategory.values.fold<num>(0, (m, v) => v > m ? v : m);

              return SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      _WastageStatCard(
                          title: 'Today\'s Qty',
                          value: '$todayQty',
                          icon: PhosphorIcons.trash(),
                          color: Colors.red),
                      const SizedBox(width: 12),
                      _WastageStatCard(
                          title: 'Total Records',
                          value: '${records.length}',
                          icon: PhosphorIcons.listBullets(),
                          color: Colors.orange),
                      const SizedBox(width: 12),
                      _WastageStatCard(
                          title: 'Total Qty',
                          value: '$totalQty',
                          icon: PhosphorIcons.calendar(),
                          color: AppColors.kPrimary),
                    ]),
                    const SizedBox(height: 24),
                    Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Wastage by Reason',
                              style: TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.w600)),
                          TextButton.icon(
                            onPressed: () =>
                                ref.invalidate(adminWastageProvider),
                            icon: const Icon(Icons.refresh, size: 14),
                            label: const Text('Refresh'),
                          ),
                        ]),
                    const SizedBox(height: 12),
                    if (byCategory.isEmpty)
                      const Text('No wastage records found',
                          style: TextStyle(color: AppColors.kTextSecondary))
                    else
                      ...byCategory.entries.map((e) => _WastageRow(
                            label: e.key,
                            amount: e.value.toStringAsFixed(1),
                            percent:
                                maxQty > 0 ? (e.value / maxQty).toDouble() : 0,
                          )),
                    if (records.isNotEmpty) ...[
                      const SizedBox(height: 24),
                      const Text('Recent Records',
                          style: TextStyle(
                              fontSize: 15, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 8),
                      ...records.take(10).map((r) => Card(
                            elevation: 0,
                            margin: const EdgeInsets.only(bottom: 6),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(10),
                                side: BorderSide(
                                    color: AppColors.kDivider
                                        .withValues(alpha: 0.5))),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor:
                                    Colors.red.withValues(alpha: 0.1),
                                child: Icon(PhosphorIcons.trash(),
                                    color: Colors.red, size: 16),
                              ),
                              title: Text(
                                  (r['item_name'] ?? r['item'] ?? 'Item')
                                      .toString(),
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w500,
                                      fontSize: 13)),
                              subtitle: Text(
                                  'Reason: ${r['reason'] ?? '—'}  •  Qty: ${r['quantity'] ?? '—'}',
                                  style: const TextStyle(fontSize: 11)),
                              trailing: Text(
                                (r['created_at'] ?? r['date'] ?? '')
                                    .toString()
                                    .split('T')
                                    .first,
                                style: const TextStyle(
                                    fontSize: 11,
                                    color: AppColors.kTextSecondary),
                              ),
                            ),
                          )),
                    ],
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _WastageStatCard extends StatelessWidget {
  final String title, value;
  final IconData icon;
  final Color color;
  const _WastageStatCard(
      {required this.title,
      required this.value,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 8),
            Text(value,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
            Text(title,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary)),
          ]),
        ),
      ),
    );
  }
}

class _WastageRow extends StatelessWidget {
  final String label, amount;
  final double percent;
  const _WastageRow(
      {required this.label, required this.amount, required this.percent});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        SizedBox(
            width: 120,
            child: Text(label, style: const TextStyle(fontSize: 13))),
        Expanded(
            child: LinearProgressIndicator(
                value: percent,
                backgroundColor: AppColors.kDivider,
                color: AppColors.kPrimary,
                minHeight: 6,
                borderRadius: BorderRadius.circular(3))),
        const SizedBox(width: 12),
        SizedBox(
            width: 60,
            child: Text(amount,
                textAlign: TextAlign.right,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w500))),
      ]),
    );
  }
}

// ─── Role Migration ───────────────────────────────────────────────────────

class RoleMigrationSection extends StatelessWidget {
  const RoleMigrationSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _sectionHeader('Role Migration', PhosphorIcons.arrowsCounterClockwise(),
            subtitle:
                'Migrate and manage user role assignments across the system'),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Card(
                  elevation: 0,
                  color: Colors.amber.shade50,
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: Colors.amber.shade200)),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(children: [
                      Icon(PhosphorIcons.warning(),
                          color: Colors.amber.shade700, size: 20),
                      const SizedBox(width: 10),
                      const Expanded(
                          child: Text(
                              'Role migrations are irreversible. Review carefully before executing.',
                              style: TextStyle(fontSize: 13))),
                    ]),
                  ),
                ),
                const SizedBox(height: 20),
                const _MigrationItem(
                    title: 'SUPER_ADMIN → GENERAL_MANAGER',
                    status: 'Pending',
                    date: '—'),
                const _MigrationItem(
                    title: 'BRANCH_MANAGER → RECEPTIONIST',
                    status: 'Completed',
                    date: '—'),
                const _MigrationItem(
                    title: 'AUDITOR → HR_MANAGER',
                    status: 'Pending',
                    date: '—'),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _MigrationItem extends StatelessWidget {
  final String title, status, date;
  const _MigrationItem(
      {required this.title, required this.status, required this.date});

  @override
  Widget build(BuildContext context) {
    final isComplete = status == 'Completed';
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
      child: ListTile(
        leading: Icon(
            isComplete ? PhosphorIcons.checkCircle() : PhosphorIcons.clock(),
            color: isComplete ? Colors.green : Colors.orange,
            size: 20),
        title: Text(title,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
        trailing: Chip(
          label: Text(status,
              style: TextStyle(
                  fontSize: 11,
                  color: isComplete
                      ? Colors.green.shade700
                      : Colors.orange.shade700)),
          backgroundColor:
              isComplete ? Colors.green.shade50 : Colors.orange.shade50,
          side: BorderSide(
              color:
                  isComplete ? Colors.green.shade200 : Colors.orange.shade200),
          padding: EdgeInsets.zero,
        ),
      ),
    );
  }
}

// ─── ID Cards ─────────────────────────────────────────────────────────────

class IdCardsSection extends ConsumerWidget {
  const IdCardsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final staffAsync = ref.watch(adminStaffProvider);

    return Column(
      children: [
        _sectionHeader('ID Cards', PhosphorIcons.identificationCard(),
            subtitle: 'Generate and manage employee ID cards'),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _showGenerateDialog(
                          context, ref, staffAsync.valueOrNull ?? []),
                      icon: Icon(PhosphorIcons.plus(), size: 16),
                      label: const Text('Generate New ID Card'),
                      style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.kPrimary,
                          foregroundColor: Colors.white),
                    ),
                  ),
                  const SizedBox(width: 12),
                  OutlinedButton.icon(
                    onPressed: () => _showBulkPrintDialog(
                        context, ref, staffAsync.valueOrNull ?? []),
                    icon: Icon(PhosphorIcons.printer(), size: 16),
                    label: const Text('Bulk Print'),
                  ),
                ]),
                const SizedBox(height: 20),
                staffAsync.when(
                  data: (staff) => Column(
                    children: [
                      _IdCardRow(
                        name: 'All Staff',
                        count: '${staff.length}',
                        lastGenerated: 'On demand',
                      ),
                      _IdCardRow(
                        name: 'Active Staff',
                        count: '${staff.where((s) => s.isActive).length}',
                        lastGenerated: '—',
                      ),
                    ],
                  ),
                  loading: () => const CircularProgressIndicator(),
                  error: (e, _) => Text('Error: $e',
                      style: const TextStyle(color: AppColors.kError)),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  void _showGenerateDialog(
      BuildContext context, WidgetRef ref, List<dynamic> staff) {
    if (staff.isEmpty) {
      AppNotifier.showSnackBar(
        context,
        const SnackBar(content: Text('No staff members found')),
      );
      return;
    }

    dynamic selectedStaff = staff.first;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setStateDialog) => AlertDialog(
          title: const Text('Generate ID Card'),
          content: DropdownButtonFormField<dynamic>(
            initialValue: selectedStaff,
            decoration: const InputDecoration(labelText: 'Select Staff Member'),
            items: staff
                .map((s) => DropdownMenuItem(value: s, child: Text(s.name)))
                .toList(),
            onChanged: (v) =>
                setStateDialog(() => selectedStaff = v ?? selectedStaff),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(ctx);
                AppNotifier.showSnackBar(
                  context,
                  SnackBar(
                      content: Text(
                          'ID card generation requested for ${selectedStaff.name}')),
                );
              },
              child: const Text('Generate'),
            ),
          ],
        ),
      ),
    );
  }

  void _showBulkPrintDialog(
      BuildContext context, WidgetRef ref, List<dynamic> staff) {
    final selected = <String>{};
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setStateDialog) => AlertDialog(
          title: const Text('Bulk Print ID Cards'),
          content: SizedBox(
            width: 360,
            height: 400,
            child: Column(
              children: [
                Row(
                  children: [
                    Checkbox(
                      value: selected.length == staff.length,
                      onChanged: (v) => setStateDialog(() {
                        if (v == true) {
                          selected.addAll(staff.map((s) => s.id.toString()));
                        } else {
                          selected.clear();
                        }
                      }),
                    ),
                    const Text('Select All',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                  ],
                ),
                const Divider(),
                Expanded(
                  child: ListView.builder(
                    itemCount: staff.length,
                    itemBuilder: (_, i) {
                      final s = staff[i];
                      final id = s.id.toString();
                      return CheckboxListTile(
                        value: selected.contains(id),
                        title: Text(s.name),
                        dense: true,
                        onChanged: (v) => setStateDialog(() {
                          if (v == true) {
                            selected.add(id);
                          } else {
                            selected.remove(id);
                          }
                        }),
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: selected.isEmpty
                  ? null
                  : () {
                      Navigator.pop(ctx);
                      AppNotifier.showSnackBar(
                        context,
                        SnackBar(
                            content: Text(
                                'Printing ${selected.length} ID card(s)...')),
                      );
                    },
              child: Text('Print (${selected.length})'),
            ),
          ],
        ),
      ),
    );
  }
}

class _IdCardRow extends StatelessWidget {
  final String name, count, lastGenerated;
  const _IdCardRow(
      {required this.name, required this.count, required this.lastGenerated});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
      child: ListTile(
        leading: Icon(PhosphorIcons.identificationBadge(),
            color: AppColors.kPrimary, size: 20),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w500)),
        trailing: Text(count,
            style: const TextStyle(
                fontWeight: FontWeight.w700, color: AppColors.kPrimary)),
      ),
    );
  }
}

// ─── Cashier Station ──────────────────────────────────────────────────────

class CashierStationSection extends StatelessWidget {
  const CashierStationSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _sectionHeader('Cashier Station', PhosphorIcons.creditCard(),
            subtitle: 'POS cashier terminal and payment processing'),
        Expanded(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: const BorderSide(color: AppColors.kDivider),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(PhosphorIcons.creditCard(),
                          size: 48, color: AppColors.kPrimary),
                      const SizedBox(height: 16),
                      const Text(
                        'Open the live Cashier Station',
                        style: TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w800),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Bill lookup, POS cart, unpaid bills, credit bills, shifts, barcode scan, and reconciliation are handled in the dedicated cashier module.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.kTextSecondary),
                      ),
                      const SizedBox(height: 18),
                      FilledButton.icon(
                        onPressed: () => context.go('/cashier'),
                        icon: const Icon(Icons.point_of_sale, size: 18),
                        label: const Text('Go to Cashier Station'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Bookings & Invoices ──────────────────────────────────────────────────

class BookingsInvoicesSection extends ConsumerWidget {
  const BookingsInvoicesSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const filters = <String, String?>{};
    final reservationsAsync = ref.watch(adminReservationsProvider(filters));

    return Column(
      children: [
        _sectionHeader('Bookings & Invoices', PhosphorIcons.calendar(),
            subtitle: 'Manage hotel bookings and generate invoices'),
        Expanded(
          child: reservationsAsync.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Center(
                child: Text('Error loading bookings: $e',
                    style: const TextStyle(color: AppColors.kError))),
            data: (bookings) {
              final active = bookings
                  .where((b) =>
                      b['status'] == 'confirmed' || b['status'] == 'checked_in')
                  .length;
              final pending =
                  bookings.where((b) => b['status'] == 'pending').length;

              return SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      _BookingStatCard(
                          title: 'Active',
                          value: '$active',
                          icon: PhosphorIcons.calendar(),
                          color: AppColors.kPrimary),
                      const SizedBox(width: 12),
                      _BookingStatCard(
                          title: 'Pending',
                          value: '$pending',
                          icon: PhosphorIcons.clock(),
                          color: Colors.orange),
                      const SizedBox(width: 12),
                      _BookingStatCard(
                          title: 'Total',
                          value: '${bookings.length}',
                          icon: PhosphorIcons.listChecks(),
                          color: Colors.green),
                    ]),
                    const SizedBox(height: 20),
                    Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Recent Bookings',
                              style: TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.w600)),
                          TextButton.icon(
                            onPressed: () => ref
                                .read(adminSectionProvider.notifier)
                                .state = AdminSection.reservations,
                            icon: Icon(PhosphorIcons.arrowUpRight(), size: 14),
                            label: const Text('View All in Reservations'),
                          ),
                        ]),
                    const SizedBox(height: 8),
                    if (bookings.isEmpty)
                      Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(
                              color: AppColors.kDivider.withValues(alpha: 0.5)),
                        ),
                        child: const Padding(
                          padding: EdgeInsets.all(20),
                          child: Center(
                            child: Text('No bookings found',
                                style:
                                    TextStyle(color: AppColors.kTextSecondary)),
                          ),
                        ),
                      )
                    else
                      ...bookings
                          .take(5)
                          .map((b) => _BookingListTile(booking: b)),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _BookingStatCard extends StatelessWidget {
  final String title, value;
  final IconData icon;
  final Color color;
  const _BookingStatCard(
      {required this.title,
      required this.value,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 8),
            Text(value,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
            Text(title,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary)),
          ]),
        ),
      ),
    );
  }
}

class _BookingListTile extends StatelessWidget {
  final Map<String, dynamic> booking;
  const _BookingListTile({required this.booking});

  @override
  Widget build(BuildContext context) {
    final guest = booking['guest_name'] ?? booking['guestName'] ?? 'Guest';
    final status = (booking['status'] ?? '').toString();
    final checkIn =
        (booking['check_in'] ?? booking['checkIn'] ?? '').toString();
    final displayDate =
        checkIn.length >= 10 ? checkIn.substring(0, 10) : checkIn;
    Color statusColor;
    switch (status) {
      case 'confirmed':
        statusColor = AppColors.kPrimary;
        break;
      case 'checked_in':
        statusColor = AppColors.kSuccess;
        break;
      case 'pending':
        statusColor = AppColors.kWarning;
        break;
      case 'cancelled':
        statusColor = AppColors.kError;
        break;
      default:
        statusColor = AppColors.kTextSecondary;
    }

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: statusColor.withValues(alpha: 0.1),
          child: Text(
            guest.toString().isNotEmpty
                ? guest.toString()[0].toUpperCase()
                : '?',
            style: TextStyle(color: statusColor, fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(guest.toString(),
            style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('Check-in: $displayDate'),
        trailing: Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            status[0].toUpperCase() + status.substring(1).replaceAll('_', ' '),
            style: TextStyle(
                fontSize: 11, fontWeight: FontWeight.bold, color: statusColor),
          ),
        ),
      ),
    );
  }
}

// ─── Employee Docs ────────────────────────────────────────────────────────

class EmployeeDocsSection extends StatefulWidget {
  const EmployeeDocsSection({super.key});

  @override
  State<EmployeeDocsSection> createState() => _EmployeeDocsSectionState();
}

class _EmployeeDocsSectionState extends State<EmployeeDocsSection> {
  ModuleGuide? _selectedGuide;
  final _searchController = TextEditingController();
  String _searchQuery = '';
  bool _isPdfGenerating = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<ModuleGuide> get _filteredGuides {
    final q = _searchQuery.toLowerCase();
    if (q.isEmpty) return kModuleGuides;
    return kModuleGuides
        .where((g) =>
            g.title.toLowerCase().contains(q) ||
            g.description.toLowerCase().contains(q))
        .toList();
  }

  IconData _guideIcon(String key) {
    switch (key) {
      case 'ShieldCheck':
        return PhosphorIcons.shieldCheck();
      case 'Package':
        return PhosphorIcons.package();
      case 'Truck':
        return PhosphorIcons.truck();
      case 'Landmark':
        return PhosphorIcons.bank();
      case 'Bed':
        return PhosphorIcons.bed();
      case 'Shield':
        return PhosphorIcons.shield();
      case 'Utensils':
        return PhosphorIcons.forkKnife();
      case 'TrendingUp':
        return PhosphorIcons.trendUp();
      case 'Users':
        return PhosphorIcons.users();
      case 'RefreshCw':
        return PhosphorIcons.arrowsClockwise();
      case 'Layout':
        return PhosphorIcons.layoutDashboard();
      case 'Activity':
        return PhosphorIcons.activity();
      case 'Wallet':
        return PhosphorIcons.wallet();
      default:
        return PhosphorIcons.fileText();
    }
  }

  Future<void> _generatePdf({ModuleGuide? guide}) async {
    setState(() => _isPdfGenerating = true);
    try {
      final guides = guide != null ? [guide] : kModuleGuides;
      final pdf = pw.Document();
      final font = await PdfGoogleFonts.nunitoRegular();
      final fontBold = await PdfGoogleFonts.nunitoBold();
      final fontItalic = await PdfGoogleFonts.nunitoItalic();

      // Cover page
      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          build: (_) => pw.Container(
            color: const PdfColor.fromInt(0xFF1c1917),
            child: pw.Center(
              child: pw.Column(
                mainAxisAlignment: pw.MainAxisAlignment.center,
                children: [
                  pw.Text(
                    'FamousGate Hotels',
                    style: pw.TextStyle(
                      font: fontBold,
                      fontSize: 32,
                      color: PdfColors.white,
                    ),
                  ),
                  pw.SizedBox(height: 12),
                  pw.Text(
                    'Systems Documentation',
                    style: pw.TextStyle(
                      font: font,
                      fontSize: 22,
                      color: PdfColors.white,
                    ),
                  ),
                  pw.SizedBox(height: 8),
                  pw.Text(
                    guide != null ? guide.title : 'Complete Employee Manual',
                    style: pw.TextStyle(
                      font: fontItalic,
                      fontSize: 14,
                      color: const PdfColor(0.8, 0.8, 0.8),
                    ),
                  ),
                  pw.SizedBox(height: 80),
                  pw.Text(
                    'Prepared by HIRALL SOLUTIONS',
                    style: pw.TextStyle(font: font, fontSize: 10, color: PdfColors.grey400),
                  ),
                  pw.Text(
                    DateTime.now().toLocal().toString().split(' ')[0],
                    style: pw.TextStyle(font: font, fontSize: 10, color: PdfColors.grey400),
                  ),
                  pw.SizedBox(height: 4),
                  pw.Text(
                    'CONFIDENTIAL — INTERNAL USE ONLY',
                    style: pw.TextStyle(font: fontBold, fontSize: 9, color: PdfColors.grey400),
                  ),
                ],
              ),
            ),
          ),
        ),
      );

      // Content pages for each guide
      for (final g in guides) {
        pdf.addPage(
          pw.MultiPage(
            pageFormat: PdfPageFormat.a4,
            margin: const pw.EdgeInsets.all(36),
            build: (_) => [
              // Module title banner
              pw.Container(
                padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFFf5f5f4)),
                child: pw.Text(
                  g.title,
                  style: pw.TextStyle(font: fontBold, fontSize: 20, color: const PdfColor.fromInt(0xFF1c1917)),
                ),
              ),
              pw.SizedBox(height: 8),
              // Description
              pw.Text(
                g.description,
                style: pw.TextStyle(font: fontItalic, fontSize: 11, color: PdfColors.grey700),
              ),
              pw.SizedBox(height: 16),

              // Key Capabilities
              pw.Text('KEY CAPABILITIES',
                  style: pw.TextStyle(font: fontBold, fontSize: 13, color: const PdfColor.fromInt(0xFF1c1917))),
              pw.SizedBox(height: 6),
              ...g.features.map(
                (f) => pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 6),
                  child: pw.Row(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Text('• ', style: pw.TextStyle(font: fontBold, fontSize: 10)),
                      pw.Expanded(
                        child: pw.RichText(
                          text: pw.TextSpan(
                            children: [
                              if (f.contains(':'))
                                pw.TextSpan(
                                  text: '${f.split(':').first}: ',
                                  style: pw.TextStyle(font: fontBold, fontSize: 10),
                                ),
                              pw.TextSpan(
                                text: f.contains(':') ? f.split(':').skip(1).join(':') : f,
                                style: pw.TextStyle(font: font, fontSize: 10, color: PdfColors.grey800),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              pw.SizedBox(height: 14),

              // Detailed Overview
              pw.Text('DETAILED OVERVIEW',
                  style: pw.TextStyle(font: fontBold, fontSize: 13, color: const PdfColor.fromInt(0xFF1c1917))),
              pw.SizedBox(height: 6),
              ...g.content.split('\n').where((l) => l.trim().isNotEmpty).map((line) {
                final t = line.trim();
                if (t.startsWith('### ')) {
                  return pw.Padding(
                    padding: const pw.EdgeInsets.only(top: 10, bottom: 4),
                    child: pw.Text(t.replaceFirst('### ', ''),
                        style: pw.TextStyle(font: fontBold, fontSize: 13)),
                  );
                } else if (t.startsWith('#### ')) {
                  return pw.Padding(
                    padding: const pw.EdgeInsets.only(top: 6, bottom: 3),
                    child: pw.Text(t.replaceFirst('#### ', ''),
                        style: pw.TextStyle(font: fontBold, fontSize: 11)),
                  );
                } else if (t.startsWith('- ')) {
                  return pw.Padding(
                    padding: const pw.EdgeInsets.only(left: 12, bottom: 3),
                    child: pw.Text('• ${t.substring(2)}',
                        style: pw.TextStyle(font: font, fontSize: 10, color: PdfColors.grey800)),
                  );
                } else {
                  return pw.Padding(
                    padding: const pw.EdgeInsets.only(bottom: 4),
                    child: pw.Text(t,
                        style: pw.TextStyle(font: font, fontSize: 10, color: PdfColors.grey800)),
                  );
                }
              }),
              pw.SizedBox(height: 14),

              // Operational Steps
              pw.Text('OPERATIONAL STEPS',
                  style: pw.TextStyle(font: fontBold, fontSize: 13, color: const PdfColor.fromInt(0xFF1c1917))),
              pw.SizedBox(height: 6),
              ...g.howToUse.asMap().entries.map(
                (e) => pw.Padding(
                  padding: const pw.EdgeInsets.only(bottom: 6),
                  child: pw.Row(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      pw.Container(
                        width: 20,
                        height: 20,
                        decoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFF1c1917)),
                        child: pw.Center(
                          child: pw.Text(
                            '${e.key + 1}',
                            style: pw.TextStyle(font: fontBold, fontSize: 9, color: PdfColors.white),
                          ),
                        ),
                      ),
                      pw.SizedBox(width: 8),
                      pw.Expanded(
                        child: pw.Text(e.value,
                            style: pw.TextStyle(font: font, fontSize: 10, color: PdfColors.grey800)),
                      ),
                    ],
                  ),
                ),
              ),
              pw.SizedBox(height: 16),
              pw.Divider(color: PdfColors.grey300),
              pw.SizedBox(height: 4),
              pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text('FAMOUSGATE-DOC-${g.id.toUpperCase()}-2026',
                      style: pw.TextStyle(font: font, fontSize: 8, color: PdfColors.grey400)),
                  pw.Text('© HIRALL SOLUTIONS',
                      style: pw.TextStyle(font: font, fontSize: 8, color: PdfColors.grey400)),
                ],
              ),
            ],
          ),
        );
      }

      final bytes = await pdf.save();
      final filename = guide != null
          ? 'FamousGate_${guide.title.replaceAll(' ', '_')}_${DateTime.now().toIso8601String().split('T').first}.pdf'
          : 'FamousGate_Complete_Manual_${DateTime.now().toIso8601String().split('T').first}.pdf';
      await Printing.sharePdf(bytes: bytes, filename: filename);
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('PDF generation failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _isPdfGenerating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isMobile = MediaQuery.of(context).size.width < 768;
    final isShowingContent = _selectedGuide != null;

    return Column(
      children: [
        _sectionHeader('Systems Documentation', PhosphorIcons.bookOpen(),
            subtitle: 'Training guides & operational manuals — by HIRALL SOLUTIONS'),
        Expanded(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Top bar: badges + Print Full Manual button
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                          color: const Color(0xFF1c1917),
                          borderRadius: BorderRadius.circular(20)),
                      child: const Text('Internal',
                          style: TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1)),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(20)),
                      child: Text('Confidential',
                          style: TextStyle(
                              color: Colors.red.shade600,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1)),
                    ),
                    const Spacer(),
                    if (!isShowingContent || !isMobile)
                      ElevatedButton.icon(
                        onPressed: _isPdfGenerating ? null : () => _generatePdf(),
                        icon: _isPdfGenerating
                            ? const SizedBox(
                                width: 14,
                                height: 14,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : Icon(PhosphorIcons.printer(), size: 15),
                        label: const Text('Print Full Manual'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1c1917),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                          textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 16),

                // Main content: list + detail
                Expanded(
                  child: isMobile
                      ? _buildMobileLayout()
                      : _buildDesktopLayout(),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildMobileLayout() {
    if (_selectedGuide != null) {
      return _GuideDetailPanel(
        guide: _selectedGuide!,
        iconData: _guideIcon(_selectedGuide!.iconKey),
        onBack: () => setState(() => _selectedGuide = null),
        onDownload: () => _generatePdf(guide: _selectedGuide),
        isPdfGenerating: _isPdfGenerating,
      );
    }
    return _buildGuideList();
  }

  Widget _buildDesktopLayout() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left panel — guide list (1/3 width)
        SizedBox(
          width: 300,
          child: _buildGuideList(),
        ),
        const SizedBox(width: 16),
        // Right panel — content (2/3 width)
        Expanded(
          child: _selectedGuide != null
              ? _GuideDetailPanel(
                  guide: _selectedGuide!,
                  iconData: _guideIcon(_selectedGuide!.iconKey),
                  onBack: null, // no back on desktop
                  onDownload: () => _generatePdf(guide: _selectedGuide),
                  isPdfGenerating: _isPdfGenerating,
                )
              : _buildEmptyState(),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200, width: 2, style: BorderStyle.solid),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 10)],
              ),
              child: Icon(PhosphorIcons.bookOpen(), size: 32, color: Colors.grey.shade300),
            ),
            const SizedBox(height: 16),
            const Text('Education Hub',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF1c1917))),
            const SizedBox(height: 6),
            SizedBox(
              width: 260,
              child: Text(
                'Select a module from the list to view its comprehensive documentation and training guide.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGuideList() {
    final guides = _filteredGuides;
    return Column(
      children: [
        // Search bar
        TextField(
          controller: _searchController,
          onChanged: (v) => setState(() => _searchQuery = v),
          decoration: InputDecoration(
            hintText: 'Search modules...',
            prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 18, color: Colors.grey.shade500),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: Icon(PhosphorIcons.x(), size: 16),
                    onPressed: () {
                      _searchController.clear();
                      setState(() => _searchQuery = '');
                    })
                : null,
            border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: Colors.grey.shade200)),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: BorderSide(color: Colors.grey.shade200)),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(16),
                borderSide: const BorderSide(color: Color(0xFF1c1917), width: 1.5)),
            filled: true,
            fillColor: Colors.white,
            contentPadding: const EdgeInsets.symmetric(vertical: 14),
          ),
        ),
        const SizedBox(height: 12),
        Expanded(
          child: guides.isEmpty
              ? Center(
                  child: Text('No modules found',
                      style: TextStyle(color: Colors.grey.shade500, fontSize: 13)))
              : ListView.separated(
                  itemCount: guides.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 6),
                  itemBuilder: (_, i) {
                    final g = guides[i];
                    final isActive = _selectedGuide?.id == g.id;
                    return _GuideListTile(
                      guide: g,
                      iconData: _guideIcon(g.iconKey),
                      isActive: isActive,
                      onTap: () => setState(() => _selectedGuide = g),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class _GuideListTile extends StatelessWidget {
  final ModuleGuide guide;
  final IconData iconData;
  final bool isActive;
  final VoidCallback onTap;

  const _GuideListTile({
    required this.guide,
    required this.iconData,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isActive ? const Color(0xFF1c1917) : Colors.grey.shade100,
            width: isActive ? 1.5 : 1,
          ),
          boxShadow: isActive
              ? [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 12, offset: const Offset(0, 4))]
              : [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4)],
        ),
        child: Row(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 150),
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: isActive ? const Color(0xFF1c1917) : Colors.grey.shade50,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(iconData,
                  size: 22, color: isActive ? Colors.white : Colors.grey.shade400),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(guide.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 14,
                          color: isActive ? const Color(0xFF1c1917) : const Color(0xFF44403c))),
                  const SizedBox(height: 2),
                  Text(guide.description,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                ],
              ),
            ),
            Icon(PhosphorIcons.caretRight(),
                size: 14,
                color: isActive ? const Color(0xFF1c1917) : Colors.grey.shade300),
          ],
        ),
      ),
    );
  }
}

class _GuideDetailPanel extends StatelessWidget {
  final ModuleGuide guide;
  final IconData iconData;
  final VoidCallback? onBack;
  final VoidCallback onDownload;
  final bool isPdfGenerating;

  const _GuideDetailPanel({
    required this.guide,
    required this.iconData,
    required this.onBack,
    required this.onDownload,
    required this.isPdfGenerating,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8)],
      ),
      child: Column(
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              border: Border(bottom: BorderSide(color: Colors.grey.shade100)),
            ),
            child: Row(
              children: [
                if (onBack != null) ...[
                  IconButton(
                    icon: Icon(PhosphorIcons.caretLeft(), size: 20, color: Colors.grey.shade600),
                    onPressed: onBack,
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  ),
                  const SizedBox(width: 8),
                ],
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    color: const Color(0xFF1c1917),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(iconData, color: Colors.white, size: 26),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(guide.title,
                          style: const TextStyle(
                              fontSize: 17, fontWeight: FontWeight.bold, color: Color(0xFF1c1917))),
                      Text(guide.description,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: isPdfGenerating ? null : onDownload,
                  icon: isPdfGenerating
                      ? const SizedBox(width: 12, height: 12, child: CircularProgressIndicator(strokeWidth: 1.5))
                      : Icon(PhosphorIcons.downloadSimple(), size: 14),
                  label: const Text('Download'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF1c1917),
                    side: const BorderSide(color: Color(0xFF1c1917)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ),
              ],
            ),
          ),

          // Body
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Key Capabilities
                  _SectionLabel(label: 'Key Capabilities'),
                  const SizedBox(height: 12),
                  LayoutBuilder(builder: (_, c) {
                    final cols = c.maxWidth > 500 ? 2 : 1;
                    return _FeatureGrid(features: guide.features, columns: cols);
                  }),
                  const SizedBox(height: 28),

                  // Deep Dive Analysis
                  _SectionLabel(label: 'Deep Dive Analysis'),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.grey.shade100),
                    ),
                    child: _MarkdownContent(content: guide.content),
                  ),
                  const SizedBox(height: 28),

                  // Operational Steps
                  _SectionLabel(label: 'Operational Steps'),
                  const SizedBox(height: 12),
                  ...guide.howToUse.asMap().entries.map(
                    (e) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: _StepTile(index: e.key + 1, text: e.value),
                    ),
                  ),

                  // Footer branding
                  const SizedBox(height: 28),
                  const Divider(),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          shape: BoxShape.circle,
                        ),
                        child: const Center(
                          child: Text('HS',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 10, color: Color(0xFF1c1917))),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Developed by HIRALL SOLUTIONS',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 11, letterSpacing: 0.5)),
                          Text('Excellence in Enterprise Resource Management',
                              style: TextStyle(fontSize: 10, color: Colors.grey.shade500)),
                        ],
                      ),
                      const Spacer(),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade50,
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          'FAMOUSGATE-DOC-${guide.id.toUpperCase()}-2026',
                          style: TextStyle(fontSize: 10, color: Colors.grey.shade400, fontWeight: FontWeight.w600),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel({required this.label});

  @override
  Widget build(BuildContext context) {
    return Text(label.toUpperCase(),
        style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: Colors.grey.shade400,
            letterSpacing: 1.5));
  }
}

class _FeatureGrid extends StatelessWidget {
  final List<String> features;
  final int columns;
  const _FeatureGrid({required this.features, required this.columns});

  @override
  Widget build(BuildContext context) {
    // Split features into rows
    final rows = <List<String>>[];
    for (var i = 0; i < features.length; i += columns) {
      rows.add(features.sublist(i, (i + columns).clamp(0, features.length)));
    }
    return Column(
      children: rows.map((row) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(
            children: row.map((f) {
              final parts = f.split(':');
              final title = parts.first.trim();
              final desc = parts.length > 1 ? parts.skip(1).join(':').trim() : '';
              return Expanded(
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade50,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.grey.shade100),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        margin: const EdgeInsets.only(top: 5),
                        decoration: const BoxDecoration(
                            color: Color(0xFF1c1917), shape: BoxShape.circle),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: RichText(
                          text: TextSpan(
                            style: const TextStyle(fontSize: 13, color: Color(0xFF44403c), height: 1.4),
                            children: [
                              TextSpan(text: '$title: ', style: const TextStyle(fontWeight: FontWeight.bold)),
                              TextSpan(text: desc),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        );
      }).toList(),
    );
  }
}

class _MarkdownContent extends StatelessWidget {
  final String content;
  const _MarkdownContent({required this.content});

  @override
  Widget build(BuildContext context) {
    final lines = content.split('\n');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: lines.map((line) {
        final t = line.trim();
        if (t.isEmpty) return const SizedBox(height: 4);
        if (t.startsWith('### ')) {
          return Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 6),
            child: Text(t.replaceFirst('### ', ''),
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF1c1917))),
          );
        } else if (t.startsWith('#### ')) {
          return Padding(
            padding: const EdgeInsets.only(top: 8, bottom: 4),
            child: Text(t.replaceFirst('#### ', ''),
                style: const TextStyle(
                    fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF1c1917))),
          );
        } else if (t.startsWith('- ')) {
          return Padding(
            padding: const EdgeInsets.only(left: 12, bottom: 4),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('• ', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF44403c))),
                Expanded(
                  child: Text(t.substring(2),
                      style: const TextStyle(fontSize: 14, color: Color(0xFF57534e), height: 1.6)),
                ),
              ],
            ),
          );
        } else {
          return Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text(t,
                style: const TextStyle(fontSize: 14, color: Color(0xFF57534e), height: 1.7)),
          );
        }
      }).toList(),
    );
  }
}

class _StepTile extends StatelessWidget {
  final int index;
  final String text;
  const _StepTile({required this.index, required this.text});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade100),
      ),
      child: Row(
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: const Color(0xFF1c1917),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Center(
              child: Text('$index',
                  style: const TextStyle(
                      color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(text,
                style: const TextStyle(fontSize: 13, color: Color(0xFF44403c), fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }
}

// ─── Communications ───────────────────────────────────────────────────────

class CommunicationsSection extends StatelessWidget {
  const CommunicationsSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _sectionHeader('Communications', PhosphorIcons.chatCircle(),
            subtitle: 'Internal messaging and communication hub'),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  _CommStatCard(
                      title: 'Unread Messages',
                      value: '—',
                      icon: PhosphorIcons.chatCircle(),
                      color: AppColors.kPrimary),
                  const SizedBox(width: 12),
                  _CommStatCard(
                      title: 'Active Channels',
                      value: '—',
                      icon: PhosphorIcons.users(),
                      color: Colors.green),
                  const SizedBox(width: 12),
                  _CommStatCard(
                      title: 'Announcements',
                      value: '—',
                      icon: PhosphorIcons.megaphone(),
                      color: Colors.orange),
                ]),
                const SizedBox(height: 20),
                const Text('Recent Channels',
                    style:
                        TextStyle(fontSize: 15, fontWeight: FontWeight.w600)),
                const SizedBox(height: 12),
                const _ChannelRow(name: 'General', unread: 0),
                const _ChannelRow(name: 'Management', unread: 0),
                const _ChannelRow(name: 'Kitchen', unread: 0),
                const _ChannelRow(name: 'Housekeeping', unread: 0),
                const _ChannelRow(name: 'Front Desk', unread: 0),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _CommStatCard extends StatelessWidget {
  final String title, value;
  final IconData icon;
  final Color color;
  const _CommStatCard(
      {required this.title,
      required this.value,
      required this.icon,
      required this.color});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: color, size: 20),
            const SizedBox(height: 8),
            Text(value,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
            Text(title,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary)),
          ]),
        ),
      ),
    );
  }
}

class _ChannelRow extends StatelessWidget {
  final String name;
  final int unread;
  const _ChannelRow({required this.name, required this.unread});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 6),
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
      child: ListTile(
        leading: Icon(PhosphorIcons.chatCircle(),
            color: AppColors.kPrimary, size: 20),
        title: Text('# $name',
            style: const TextStyle(fontWeight: FontWeight.w500)),
        trailing: unread > 0
            ? CircleAvatar(
                radius: 10,
                backgroundColor: AppColors.kPrimary,
                child: Text('$unread',
                    style: const TextStyle(fontSize: 10, color: Colors.white)))
            : null,
      ),
    );
  }
}
