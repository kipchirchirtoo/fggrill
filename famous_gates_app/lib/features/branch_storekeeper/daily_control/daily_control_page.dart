import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/domain/auth_notifier.dart';
import '../../food_control_report/presentation/food_control_report_screen.dart';
import 'providers/daily_control_provider.dart';
import 'widgets/bom_control_tab.dart';
import 'widgets/control_filter_bar.dart';
import 'widgets/daily_summary_tab.dart';
import 'widgets/kitchen_vs_sales_tab.dart';
import 'widgets/stock_ledger_tab.dart';
import 'widgets/stock_vs_sales_tab.dart';

const _tabNames = ['stock_ledger', 'bom_control', 'kitchen_vs_sales', 'stock_vs_sales', 'summary'];

class DailyControlPage extends ConsumerStatefulWidget {
  const DailyControlPage({super.key});

  @override
  ConsumerState<DailyControlPage> createState() => _DailyControlPageState();
}

class _DailyControlPageState extends ConsumerState<DailyControlPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  int _activeTab = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) return;
      setState(() => _activeTab = _tabController.index);
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(dailyControlProvider.notifier).loadAll();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _export() async {
    final notifier = ref.read(dailyControlProvider.notifier);
    try {
      final path = await notifier.exportToCSV(
        _activeTab,
        tabName: _tabNames[_activeTab],
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Exported to $path')),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Export failed: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(dailyControlProvider);
    final notifier = ref.read(dailyControlProvider.notifier);
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final branchName = user?.branchName ?? '';

    return Scaffold(
      backgroundColor: const Color(0xFFF5F6FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Daily Food Control',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            if (branchName.isNotEmpty)
              Text(branchName,
                  style: const TextStyle(
                      fontSize: 11, fontWeight: FontWeight.normal)),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Stocksheet Report (Store Stocksheet + Controls)',
            onPressed: () => Navigator.of(context).push<void>(
              MaterialPageRoute(
                  builder: (_) => const FoodControlReportScreen()),
            ),
            icon: const Icon(Icons.table_chart_outlined),
          ),
          IconButton(
            tooltip: 'Export CSV',
            onPressed: state.isLoading ? null : _export,
            icon: const Icon(Icons.download_outlined),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: state.isLoading ? null : notifier.refresh,
            icon: const Icon(Icons.refresh),
          ),
          const SizedBox(width: 4),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: const [
            Tab(text: 'Stock Ledger'),
            Tab(text: 'BOM Control'),
            Tab(text: 'Kitchen vs Sales'),
            Tab(text: 'Stock vs Sales'),
            Tab(text: 'Summary'),
          ],
        ),
      ),
      body: Column(
        children: [
          // ── Previous closed commercial day — finalized snapshot, frozen
          // when the next cashier shift opened. Never mixed with the live
          // date/shift-filtered view below.
          if (state.snapshotLoading)
            const Padding(
              padding: EdgeInsets.fromLTRB(12, 12, 12, 0),
              child: LinearProgressIndicator(minHeight: 2),
            )
          else if (state.snapshot != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
              child: _PreviousDaySnapshotCard(snapshot: state.snapshot!),
            ),
          const Padding(
            padding: EdgeInsets.fromLTRB(12, 12, 12, 0),
            child: _LiveProvisionalLabel(),
          ),
          // ── Filter bar (date + shift) ──────────────────────────────────
          Padding(
            padding: const EdgeInsets.all(12),
            child: ControlFilterBar(
              date: state.date,
              shift: state.shift,
              onDateChanged: notifier.changeDate,
              onShiftChanged: notifier.changeShift,
              onRefresh: notifier.refresh,
              onExport: _export,
              isLoading: state.isLoading,
            ),
          ),

          // ── Error banner ───────────────────────────────────────────────
          if (state.errorMessage != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: _Banner(
                color: Colors.red,
                icon: Icons.error_outline,
                message: state.errorMessage!,
              ),
            ),

          // ── No kitchen session warning ─────────────────────────────────
          if (!state.isLoading && !state.hasKitchenSession && state.hasAnyData)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: _Banner(
                color: Colors.orange,
                icon: Icons.warning_amber_rounded,
                message:
                    'No kitchen production session found for this date${state.shift != null ? ' / Shift ${state.shift}' : ''}. '
                    'Actual quantities shown are from branch stock movements (fallback). '
                    'Open a kitchen session to get precise ingredient issue data.',
              ),
            ),

          // ── Kitchen session open but nothing confirmed yet ───────────────
          // hasKitchenSession only means a shift row exists — it does not
          // mean any usage was confirmed. Without this, all-zero Actual
          // figures look identical to "genuinely zero usage" and to "no
          // data was ever recorded", which is misleading.
          if (!state.isLoading &&
              state.hasKitchenSession &&
              state.totalIssuedQty <= 0 &&
              state.hasAnyData)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: _Banner(
                color: Colors.orange,
                icon: Icons.warning_amber_rounded,
                message:
                    'A kitchen shift exists for this date${state.shift != null ? ' / Shift ${state.shift}' : ''}, but no ingredient '
                    'usage has been confirmed yet. The "Actual" column below is showing 0 '
                    'because nothing has been logged as used — not because zero was actually '
                    'consumed. Confirm production yields in Kitchen Sessions to populate real Actual data.',
              ),
            ),

          // ── No POS sales hint ──────────────────────────────────────────
          if (!state.isLoading &&
              !state.hasAnyData &&
              state.errorMessage == null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: _Banner(
                color: Colors.blue,
                icon: Icons.info_outline,
                message:
                    'No POS food sales recorded for ${state.date}${state.shift != null ? ' Shift ${state.shift}' : ''}. '
                    'Select a different date or shift.',
              ),
            ),

          // ── Tabs content ───────────────────────────────────────────────
          Expanded(
            child: state.isLoading
                ? const Center(child: CircularProgressIndicator())
                : TabBarView(
                    controller: _tabController,
                    children: [
                      StockLedgerTab(
                        items: state.stockLedger,
                        isLoading: state.stockLedgerLoading,
                      ),
                      BomControlTab(
                        items: state.bomControl,
                        noRecipeItems: state.noRecipeItems,
                      ),
                      KitchenVsSalesTab(items: state.kitchenVsSales),
                      StockVsSalesTab(summary: state.stockVsSales),
                      DailySummaryTab(
                        summary: state.summary,
                        kitchenVsSales: state.kitchenVsSales,
                      ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}

/// The previous CLOSED commercial day, frozen at handover time — distinct
/// from, and never mixed with, the live/provisional view below it.
class _PreviousDaySnapshotCard extends StatelessWidget {
  const _PreviousDaySnapshotCard({required this.snapshot});
  final Map<String, dynamic> snapshot;

  num _num(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;

  @override
  Widget build(BuildContext context) {
    final revenue = _num(snapshot['total_food_revenue']);
    final cogs = _num(snapshot['actual_ingredient_cost']);
    final varianceCost = _num(snapshot['bom_variance_cost']);
    final foodCostPct = snapshot['food_cost_percent'];
    final shiftDate = '${snapshot['shift_date'] ?? ''}';
    final shiftNumber = '${snapshot['shift_number'] ?? ''}';

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.green.shade50,
        border: Border.all(color: Colors.green.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.green.shade700,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text('FINALIZED',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: Colors.white)),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Previous Closed Day — $shiftDate${shiftNumber.isEmpty ? '' : ' ($shiftNumber)'}',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: Colors.green.shade900),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 16,
            runSpacing: 4,
            children: [
              _statText('Revenue', 'KES ${revenue.toStringAsFixed(0)}'),
              _statText('COGS', 'KES ${cogs.toStringAsFixed(0)}'),
              _statText('Variance', 'KES ${varianceCost.toStringAsFixed(0)}'),
              _statText('Food Cost %',
                  foodCostPct == null ? 'N/A' : '${_num(foodCostPct).toStringAsFixed(1)}%'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _statText(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10, color: Colors.grey)),
        Text(value,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
      ],
    );
  }
}

/// Labels everything below it (filter bar + tabs) as a live recomputation —
/// never a frozen/finalized number, regardless of which date is selected.
class _LiveProvisionalLabel extends StatelessWidget {
  const _LiveProvisionalLabel();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
          decoration: BoxDecoration(
            color: Colors.blue.shade700,
            borderRadius: BorderRadius.circular(4),
          ),
          child: const Text('LIVE / PROVISIONAL',
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Colors.white)),
        ),
        const SizedBox(width: 8),
        const Expanded(
          child: Text(
            'Recomputed fresh on every refresh — not yet finalized.',
            style: TextStyle(fontSize: 11, color: Colors.grey),
          ),
        ),
      ],
    );
  }
}

/// Compact inline banner used for warnings, errors, and info hints.
class _Banner extends StatelessWidget {
  const _Banner({
    required this.color,
    required this.icon,
    required this.message,
  });

  final MaterialColor color;
  final IconData icon;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: color.shade50,
        border: Border.all(color: color.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: color.shade800),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: TextStyle(
                color: color.shade800,
                fontSize: 12,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
