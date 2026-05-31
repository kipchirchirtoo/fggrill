import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/admin_providers.dart';
import '../../data/admin_repository.dart';

// ─── Shared helpers ────────────────────────────────────────────────────────

Widget _header(String title, IconData icon, {String? subtitle}) {
  return Container(
    padding: const EdgeInsets.fromLTRB(28, 28, 28, 10),
    color: Colors.white,
    child: Row(children: [
      Container(
        width: 52,
        height: 52,
        decoration: BoxDecoration(
          color: const Color(0xFF1D1917),
          borderRadius: BorderRadius.circular(14),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 14,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Icon(icon, color: Colors.white, size: 24),
      ),
      const SizedBox(width: 18),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 27,
                  fontWeight: FontWeight.w800,
                  color: AppColors.kTextPrimary)),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(subtitle,
                style: const TextStyle(
                    fontSize: 14, color: AppColors.kTextSecondary)),
          ],
        ]),
      ),
    ]),
  );
}

Widget _emptyMsg(String msg) => Center(
        child: Padding(
      padding: const EdgeInsets.all(40),
      child: Text(msg,
          style:
              const TextStyle(color: AppColors.kTextSecondary, fontSize: 14)),
    ));

class _Stat {
  final String label, value;
  final IconData icon;
  final Color color;
  const _Stat(this.label, this.value, this.icon, this.color);
}

class _StatCard extends StatelessWidget {
  final _Stat stat;
  const _StatCard({required this.stat});
  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(right: 12),
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Icon(stat.icon, color: stat.color, size: 18),
          const SizedBox(height: 8),
          Text(stat.value,
              style:
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
          Text(stat.label,
              style: const TextStyle(
                  fontSize: 11, color: AppColors.kTextSecondary)),
        ]),
      ),
    );
  }
}

class _AuditBranchSelector extends ConsumerWidget {
  const _AuditBranchSelector();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedId = ref.watch(adminSelectedBranchProvider);
    final branchesAsync = ref.watch(adminBranchesProvider);
    return branchesAsync.when(
      data: (branches) {
        var selectedName = 'All Branches';
        for (final branch in branches) {
          if (branch.id == selectedId) {
            selectedName = branch.name;
            break;
          }
        }
        return PopupMenuButton<String?>(
          tooltip: 'Filter by branch',
          initialValue: selectedId,
          onSelected: (value) =>
              ref.read(adminSelectedBranchProvider.notifier).state = value,
          itemBuilder: (context) => [
            const PopupMenuItem<String?>(
              value: null,
              child: Text('All Branches'),
            ),
            for (final branch in branches)
              PopupMenuItem<String?>(
                value: branch.id,
                child: Text(branch.name),
              ),
          ],
          child: Container(
            height: 52,
            padding: const EdgeInsets.symmetric(horizontal: 14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.kDivider),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Text(
                'Branch:',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(width: 10),
              Icon(PhosphorIcons.buildings(),
                  color: AppColors.kPrimary, size: 16),
              const SizedBox(width: 8),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 180),
                child: Text(
                  selectedName,
                  overflow: TextOverflow.ellipsis,
                  maxLines: 1,
                  style: const TextStyle(
                    color: AppColors.kPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Icon(PhosphorIcons.caretDown(), size: 14),
            ]),
          ),
        );
      },
      loading: () => Container(
        height: 52,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: AppColors.kSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.kDivider),
        ),
        child: const Text(
          'Loading branches...',
          style: TextStyle(color: AppColors.kTextSecondary),
        ),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

class _AuditBranchFilterBar extends StatelessWidget {
  const _AuditBranchFilterBar();

  @override
  Widget build(BuildContext context) {
    return const Row(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [_AuditBranchSelector()],
    );
  }
}

Widget _tableCard(String title, List<String> columns, List<List<String>> rows) {
  return Card(
    elevation: 0,
    shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
        child: Text(title,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      ),
      const Divider(height: 1),
      if (rows.isEmpty)
        const Padding(
            padding: EdgeInsets.all(20),
            child: Center(
                child: Text('No records found',
                    style: TextStyle(color: AppColors.kTextSecondary))))
      else
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
            columns: columns
                .map((c) => DataColumn(
                    label: Text(c,
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w600))))
                .toList(),
            rows: rows
                .map((r) => DataRow(
                    cells: r
                        .map((c) => DataCell(
                            Text(c, style: const TextStyle(fontSize: 12))))
                        .toList()))
                .toList(),
          ),
        ),
    ]),
  );
}

// ─── Audit Search ──────────────────────────────────────────────────────────

class AuditSearchSection extends StatefulWidget {
  const AuditSearchSection({super.key});
  @override
  State<AuditSearchSection> createState() => _AuditSearchSectionState();
}

class _AuditSearchSectionState extends State<AuditSearchSection> {
  final _ctrl = TextEditingController();
  bool _hasSearched = false;

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      _header('Universal Search', PhosphorIcons.shield(),
          subtitle: 'Cross-entity system intelligence and audit retrieval'),
      Expanded(
          child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side:
                  BorderSide(color: AppColors.kDivider.withValues(alpha: 0.55)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(children: [
                Row(children: [
                  Expanded(
                    child: TextField(
                      controller: _ctrl,
                      onSubmitted: (_) => setState(() => _hasSearched = true),
                      decoration: InputDecoration(
                        hintText:
                            'Search by reference, staff name, M-Pesa code, order ID...',
                        prefixIcon:
                            Icon(PhosphorIcons.magnifyingGlass(), size: 20),
                        border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 18, vertical: 15),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const _AuditBranchSelector(),
                  const SizedBox(width: 12),
                  FilledButton.icon(
                    onPressed: () => setState(() => _hasSearched = true),
                    icon: Icon(PhosphorIcons.magnifyingGlass(), size: 18),
                    label: const Text('Run Search'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.kWarning,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(150, 52),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ]),
                const SizedBox(height: 14),
                Container(
                  width: double.infinity,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.kSurface,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                        color: AppColors.kDivider.withValues(alpha: 0.45)),
                  ),
                  child: const Text(
                    'SEARCH DOMAINS:  OPERATIONS, FINANCE, HUMAN RESOURCES, GUEST RELATIONS, INVENTORY',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.kTextSecondary,
                      letterSpacing: 0.4,
                    ),
                  ),
                )
              ]),
            ),
          ),
          const SizedBox(height: 36),
          Expanded(
            child: _hasSearched
                ? _tableCard('Match Summary (0)',
                    ['Type', 'Title', 'Reference', 'Context', 'Action'], [])
                : Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 96,
                          height: 96,
                          decoration: BoxDecoration(
                            color: AppColors.kSurface,
                            borderRadius: BorderRadius.circular(34),
                            border: Border.all(color: AppColors.kDivider),
                          ),
                          child: Icon(PhosphorIcons.magnifyingGlass(),
                              size: 42,
                              color: AppColors.kTextSecondary
                                  .withValues(alpha: 0.28)),
                        ),
                        const SizedBox(height: 22),
                        const Text('Centralized Intelligence',
                            style: TextStyle(
                                fontSize: 22, fontWeight: FontWeight.w900)),
                        const SizedBox(height: 8),
                        const SizedBox(
                          width: 460,
                          child: Text(
                            'Perform a global cross-reference search across all operational nodes and financial records.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                color: AppColors.kTextSecondary,
                                fontWeight: FontWeight.w500),
                          ),
                        ),
                      ],
                    ),
                  ),
          ),
        ]),
      )),
    ]);
  }
}

// ─── Financial Verification ────────────────────────────────────────────────

class FinancialVerificationSection extends ConsumerWidget {
  const FinancialVerificationSection({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clearancesAsync = ref.watch(adminCashierClearancesProvider);
    return Column(children: [
      _header('Financial Verification', PhosphorIcons.currencyDollar(),
          subtitle: 'Daily cash reconciliation and financial verification'),
      Expanded(
          child: clearancesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style: const TextStyle(color: AppColors.kError))),
        data: (rows) {
          final verified = rows.where((r) => r['status'] == 'approved').length;
          final pending = rows.where((r) => r['status'] == 'pending').length;
          final discrepancies = rows
              .where((r) => (r['variance'] != null && r['variance'] != 0))
              .length;
          final tableRows = rows.map((r) {
            final variance = r['variance'] ?? 0;
            return [
              (r['branch_name'] ?? '—').toString(),
              (r['shift'] ?? '—').toString(),
              (r['cashier_name'] ?? r['staff_name'] ?? '—').toString(),
              'KES ${(r['expected_amount'] ?? r['opening_balance'] ?? 0).toString()}',
              'KES ${(r['actual_amount'] ?? r['closing_balance'] ?? 0).toString()}',
              'KES $variance',
              (r['status'] ?? '—').toString(),
            ];
          }).toList();
          return SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                const _AuditBranchFilterBar(),
                const SizedBox(height: 20),
                Row(children: [
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Verified', '$verified',
                              PhosphorIcons.checkCircle(), Colors.green))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Pending', '$pending',
                              PhosphorIcons.clock(), Colors.orange))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Discrepancies', '$discrepancies',
                              PhosphorIcons.warning(), Colors.red))),
                ]),
                const SizedBox(height: 20),
                _tableCard(
                    'Verification Queue',
                    [
                      'Branch',
                      'Shift',
                      'Cashier',
                      'Expected',
                      'Actual',
                      'Variance',
                      'Status'
                    ],
                    tableRows),
              ]));
        },
      )),
    ]);
  }
}

// ─── Shift Verification ───────────────────────────────────────────────────

class ShiftVerificationSection extends ConsumerWidget {
  const ShiftVerificationSection({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final shiftsAsync = ref.watch(adminShiftSummariesProvider);
    return Column(children: [
      _header('Shift Verification', PhosphorIcons.clockClockwise(),
          subtitle: 'Verify and close daily operational shifts'),
      Expanded(
          child: shiftsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style: const TextStyle(color: AppColors.kError))),
        data: (rows) {
          final open = rows.where((r) => r['status'] == 'open').length;
          final closed = rows.where((r) => r['status'] == 'closed').length;
          final pending = rows.where((r) => r['status'] == 'pending').length;
          final tableRows = rows
              .map((r) => [
                    (r['branch_name'] ?? '—').toString(),
                    (r['date'] ?? r['created_at'] ?? '—')
                        .toString()
                        .split('T')
                        .first,
                    (r['manager_name'] ?? r['manager'] ?? '—').toString(),
                    'KES ${(r['total_sales'] ?? r['revenue'] ?? 0).toString()}',
                    'KES ${(r['cash_total'] ?? r['cash'] ?? 0).toString()}',
                    (r['status'] ?? '—').toString(),
                  ])
              .toList();
          return SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                const _AuditBranchFilterBar(),
                const SizedBox(height: 20),
                Row(children: [
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Open', '$open', PhosphorIcons.clock(),
                              Colors.orange))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Closed Today', '$closed',
                              PhosphorIcons.checkCircle(), Colors.green))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Pending', '$pending',
                              PhosphorIcons.pen(), AppColors.kPrimary))),
                ]),
                const SizedBox(height: 20),
                _tableCard(
                    'Shift Summary',
                    [
                      'Branch',
                      'Date',
                      'Manager',
                      'Total Sales',
                      'Cash',
                      'Status'
                    ],
                    tableRows),
              ]));
        },
      )),
    ]);
  }
}

// ─── Revenue Oversight ────────────────────────────────────────────────────

class RevenueOversightSection extends StatelessWidget {
  const RevenueOversightSection({super.key});
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      _header('Revenue Oversight', PhosphorIcons.trendUp(),
          subtitle: 'Monitor revenue streams and financial performance'),
      Expanded(
          child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                const _AuditBranchFilterBar(),
                const SizedBox(height: 20),
                Row(children: [
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Today\'s Revenue', '—',
                              PhosphorIcons.trendUp(), Colors.green))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat(
                              'vs Yesterday',
                              '—',
                              PhosphorIcons.arrowsLeftRight(),
                              AppColors.kPrimary))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Month-to-Date', '—',
                              PhosphorIcons.calendar(), Colors.blue))),
                ]),
                const SizedBox(height: 20),
                _tableCard(
                    'Revenue by Outlet',
                    ['Outlet', 'Today', 'Yesterday', 'This Week', 'This Month'],
                    []),
              ]))),
    ]);
  }
}

// ─── Sold Items Analysis ──────────────────────────────────────────────────

class SoldItemsAnalysisSection extends ConsumerWidget {
  const SoldItemsAnalysisSection({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final itemsAsync = ref.watch(adminSoldItemsProvider);
    return Column(children: [
      _header('Sold Items Analysis', PhosphorIcons.shoppingCart(),
          subtitle: 'Analyse item-level sales data across all outlets'),
      Expanded(
          child: itemsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style: const TextStyle(color: AppColors.kError))),
        data: (items) {
          final totalQty = items.fold<num>(
              0, (s, i) => s + ((i['quantity_sold'] ?? i['qty'] ?? 0) as num));
          final topSeller = items.isNotEmpty
              ? (items.reduce((a, b) => ((a['quantity_sold'] ?? 0) as num) >
                          ((b['quantity_sold'] ?? 0) as num)
                      ? a
                      : b)['name'] ??
                  '—')
              : '—';
          final tableRows = items
              .map((i) => [
                    (i['name'] ?? i['item_name'] ?? '—').toString(),
                    (i['category'] ?? '—').toString(),
                    (i['quantity_sold'] ?? i['qty'] ?? '—').toString(),
                    'KES ${(i['revenue'] ?? i['total'] ?? 0).toString()}',
                    (i['outlet'] ?? i['branch_name'] ?? '—').toString(),
                  ])
              .toList();
          return SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                const _AuditBranchFilterBar(),
                const SizedBox(height: 20),
                Row(children: [
                  Expanded(
                      child: _StatCard(
                          stat: _Stat(
                              'Items Sold',
                              '$totalQty',
                              PhosphorIcons.shoppingCart(),
                              AppColors.kPrimary))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Top Seller', '$topSeller',
                              PhosphorIcons.trophy(), Colors.amber))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('SKUs', '${items.length}',
                              PhosphorIcons.tag(), Colors.blue))),
                ]),
                const SizedBox(height: 20),
                _tableCard(
                    'Item Sales',
                    ['Item', 'Category', 'Qty Sold', 'Revenue', 'Outlet'],
                    tableRows),
              ]));
        },
      )),
    ]);
  }
}

// ─── Staff Financials ─────────────────────────────────────────────────────

class StaffFinancialsSection extends StatelessWidget {
  const StaffFinancialsSection({super.key});
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      _header('Staff Financials', PhosphorIcons.wallet(),
          subtitle: 'Review staff financial transactions and accountability'),
      Expanded(
          child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                Row(children: [
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Cash Floats', '—',
                              PhosphorIcons.wallet(), AppColors.kPrimary))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Unreconciled', '—',
                              PhosphorIcons.warning(), Colors.orange))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Cleared Today', '—',
                              PhosphorIcons.checkCircle(), Colors.green))),
                ]),
                const SizedBox(height: 20),
                _tableCard(
                    'Staff Accountability',
                    ['Staff', 'Role', 'Float', 'Sales', 'Cleared', 'Balance'],
                    []),
              ]))),
    ]);
  }
}

// ─── Performance Leaderboard ──────────────────────────────────────────────

class PerformanceLeaderboardSection extends StatelessWidget {
  const PerformanceLeaderboardSection({super.key});
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      _header('Performance Leaderboard', PhosphorIcons.trophy(),
          subtitle: 'Staff performance rankings and metrics'),
      Expanded(
          child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                _tableCard('Top Performers', [
                  'Rank',
                  'Name',
                  'Department',
                  'Score',
                  'Sales',
                  'Attendance'
                ], []),
              ]))),
    ]);
  }
}

// ─── Stock Request Approvals ──────────────────────────────────────────────

class StockRequestApprovalsSection extends ConsumerWidget {
  const StockRequestApprovalsSection({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requestsAsync = ref.watch(adminStockRequestApprovalsProvider);
    return Column(children: [
      _header('Stock Request Approvals', PhosphorIcons.checkCircle(),
          subtitle: 'Review and approve inter-branch stock requests'),
      Expanded(
          child: requestsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style: const TextStyle(color: AppColors.kError))),
        data: (requests) {
          return Column(
            children: [
              const Padding(
                padding: EdgeInsets.fromLTRB(24, 24, 24, 8),
                child: _AuditBranchFilterBar(),
              ),
              Expanded(
                child: requests.isEmpty
                    ? _emptyMsg('No pending stock requests')
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: requests.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (ctx, i) {
                          final r = requests[i];
                          final id = (r['id'] ?? '').toString();
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor:
                                  AppColors.kWarning.withValues(alpha: 0.1),
                              child: Icon(PhosphorIcons.package(),
                                  color: AppColors.kWarning, size: 18),
                            ),
                            title: Text(
                                (r['item_name'] ?? r['name'] ?? 'Request #$id'),
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                            subtitle: Text(
                              'Branch: ${r['branch_name'] ?? r['requesting_branch'] ?? '—'}  •  '
                              'Qty: ${r['quantity'] ?? '—'}  •  '
                              'By: ${r['requested_by'] ?? r['staff_name'] ?? '—'}',
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  icon: Icon(PhosphorIcons.checkCircle(),
                                      color: AppColors.kSuccess, size: 20),
                                  tooltip: 'Approve',
                                  onPressed: () async {
                                    try {
                                      await ref
                                          .read(adminRepositoryProvider)
                                          .approveStockRequest(id);
                                      ref.invalidate(
                                          adminStockRequestApprovalsProvider);
                                      if (ctx.mounted) {
                                        AppNotifier.showSnackBar(
                                            ctx,
                                            const SnackBar(
                                                content:
                                                    Text('Request approved')));
                                      }
                                    } catch (e) {
                                      if (ctx.mounted) {
                                        AppNotifier.showSnackBar(
                                            ctx,
                                            SnackBar(
                                                content: Text('Error: $e')));
                                      }
                                    }
                                  },
                                ),
                                IconButton(
                                  icon: Icon(PhosphorIcons.xCircle(),
                                      color: AppColors.kError, size: 20),
                                  tooltip: 'Reject',
                                  onPressed: () async {
                                    try {
                                      await ref
                                          .read(adminRepositoryProvider)
                                          .rejectStockRequest(id);
                                      ref.invalidate(
                                          adminStockRequestApprovalsProvider);
                                      if (ctx.mounted) {
                                        AppNotifier.showSnackBar(
                                            ctx,
                                            const SnackBar(
                                                content:
                                                    Text('Request rejected')));
                                      }
                                    } catch (e) {
                                      if (ctx.mounted) {
                                        AppNotifier.showSnackBar(
                                            ctx,
                                            SnackBar(
                                                content: Text('Error: $e')));
                                      }
                                    }
                                  },
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ],
          );
        },
      )),
    ]);
  }
}

// ─── Bar Stock Audits ─────────────────────────────────────────────────────

class BarStockAuditsSection extends ConsumerWidget {
  const BarStockAuditsSection({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auditsAsync = ref.watch(adminBarStockAuditsProvider);
    return Column(children: [
      _header('Bar Stock Audits', PhosphorIcons.wine(),
          subtitle: 'Audit bar inventory and beverage stock levels'),
      Expanded(
          child: auditsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style: const TextStyle(color: AppColors.kError))),
        data: (audits) {
          final variances = audits.fold<num>(
              0,
              (s, a) =>
                  s + ((a['variance_count'] ?? a['variances'] ?? 0) as num));
          final lastDate = audits.isNotEmpty
              ? (audits.first['created_at'] ?? audits.first['date'] ?? '—')
                  .toString()
                  .split('T')
                  .first
              : '—';
          final tableRows = audits
              .map((a) => [
                    (a['created_at'] ?? a['date'] ?? '—')
                        .toString()
                        .split('T')
                        .first,
                    (a['bar_name'] ?? a['outlet'] ?? '—').toString(),
                    (a['auditor_name'] ?? a['auditor'] ?? '—').toString(),
                    (a['items_count'] ?? a['items'] ?? '—').toString(),
                    (a['variance_count'] ?? a['variances'] ?? '0').toString(),
                    (a['status'] ?? '—').toString(),
                  ])
              .toList();
          return SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                const _AuditBranchFilterBar(),
                const SizedBox(height: 20),
                Row(children: [
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Last Audit', lastDate,
                              PhosphorIcons.clock(), AppColors.kPrimary))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Variances', '$variances',
                              PhosphorIcons.warning(), Colors.orange))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Total Audits', '${audits.length}',
                              PhosphorIcons.package(), Colors.green))),
                ]),
                const SizedBox(height: 20),
                _tableCard(
                    'Audit Records',
                    ['Date', 'Bar', 'Auditor', 'Items', 'Variances', 'Status'],
                    tableRows),
              ]));
        },
      )),
    ]);
  }
}

// ─── Purchase Audits ──────────────────────────────────────────────────────

class PurchaseAuditsSection extends ConsumerWidget {
  const PurchaseAuditsSection({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ordersAsync = ref.watch(adminPurchaseAuditOrdersProvider);
    return Column(children: [
      _header('Purchase Audits', PhosphorIcons.shoppingBag(),
          subtitle: 'Audit procurement records and supplier payments'),
      Expanded(
          child: ordersAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
            child: Text('Error: $e',
                style: const TextStyle(color: AppColors.kError))),
        data: (orders) {
          final total = orders.length;
          final unverified = orders
              .where(
                  (o) => o['status'] != 'verified' && o['status'] != 'approved')
              .length;
          final totalAmt = orders.fold<num>(0,
              (s, o) => s + ((o['total_amount'] ?? o['amount'] ?? 0) as num));
          final tableRows = orders
              .map((o) => [
                    (o['po_number'] ?? o['id'] ?? '—').toString(),
                    (o['supplier_name'] ?? o['supplier'] ?? '—').toString(),
                    (o['created_at'] ?? o['date'] ?? '—')
                        .toString()
                        .split('T')
                        .first,
                    'KES ${(o['total_amount'] ?? o['amount'] ?? 0).toString()}',
                    (o['status'] ?? '—').toString(),
                    (o['auditor_name'] ?? o['auditor'] ?? '—').toString(),
                  ])
              .toList();
          return SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                const _AuditBranchFilterBar(),
                const SizedBox(height: 20),
                Row(children: [
                  Expanded(
                      child: _StatCard(
                          stat: _Stat(
                              'Total POs',
                              '$total',
                              PhosphorIcons.shoppingBag(),
                              AppColors.kPrimary))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat('Unverified', '$unverified',
                              PhosphorIcons.warning(), Colors.orange))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: _StatCard(
                          stat: _Stat(
                              'Total Value',
                              'KES ${totalAmt.toStringAsFixed(0)}',
                              PhosphorIcons.calendar(),
                              Colors.blue))),
                ]),
                const SizedBox(height: 20),
                _tableCard(
                    'Purchase Orders',
                    ['PO #', 'Supplier', 'Date', 'Amount', 'Status', 'Auditor'],
                    tableRows),
              ]));
        },
      )),
    ]);
  }
}

// ─── Audit Reports ────────────────────────────────────────────────────────

class AuditReportsSection extends StatelessWidget {
  const AuditReportsSection({super.key});
  @override
  Widget build(BuildContext context) {
    return Column(children: [
      _header('Audit Reports', PhosphorIcons.fileSpreadsheet(),
          subtitle: 'Generate and export audit trail reports'),
      Expanded(
          child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(children: [
                Row(children: [
                  Expanded(
                      child: ElevatedButton.icon(
                    onPressed: () => AppNotifier.showSnackBar(
                        context,
                        const SnackBar(
                            content: Text('Generating daily audit report...'))),
                    icon: Icon(PhosphorIcons.fileText(), size: 16),
                    label: const Text('Daily Audit Report'),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.kPrimary,
                        foregroundColor: Colors.white),
                  )),
                  const SizedBox(width: 12),
                  Expanded(
                      child: OutlinedButton.icon(
                    onPressed: () => AppNotifier.showSnackBar(
                        context,
                        const SnackBar(
                            content: Text('Exporting audit log as CSV...'))),
                    icon: Icon(PhosphorIcons.fileSpreadsheet(), size: 16),
                    label: const Text('Export as CSV'),
                  )),
                ]),
                const SizedBox(height: 20),
                _tableCard('Recent Reports',
                    ['Report', 'Type', 'Generated By', 'Date', 'Status'], []),
              ]))),
    ]);
  }
}
