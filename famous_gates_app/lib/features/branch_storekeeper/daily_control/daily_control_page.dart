import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/domain/auth_notifier.dart';
import 'providers/daily_control_provider.dart';
import 'widgets/bom_control_tab.dart';
import 'widgets/control_filter_bar.dart';
import 'widgets/daily_summary_tab.dart';
import 'widgets/kitchen_vs_sales_tab.dart';
import 'widgets/stock_vs_sales_tab.dart';

const _tabNames = ['bom_control', 'kitchen_vs_sales', 'stock_vs_sales', 'summary'];

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
    _tabController = TabController(length: 4, vsync: this);
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
            Tab(text: 'BOM Control'),
            Tab(text: 'Kitchen vs Sales'),
            Tab(text: 'Stock vs Sales'),
            Tab(text: 'Summary'),
          ],
        ),
      ),
      body: Column(
        children: [
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
