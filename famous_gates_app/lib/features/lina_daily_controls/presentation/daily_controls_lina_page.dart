import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../branch_storekeeper/daily_control/widgets/bom_control_tab.dart';
import '../../food_control_report/presentation/food_control_report_screen.dart';
import '../../branch_storekeeper/daily_control/widgets/daily_summary_tab.dart';
import '../../branch_storekeeper/daily_control/widgets/kitchen_vs_sales_tab.dart';
import '../../branch_storekeeper/daily_control/widgets/stock_ledger_tab.dart';
import '../../branch_storekeeper/daily_control/widgets/stock_vs_sales_tab.dart';
import '../../branch_storekeeper/daily_control/widgets/parent_yield_splits_tab.dart';
import '../domain/lina_daily_controls_provider.dart';

/// Daily Controls (Lina) — the storekeeper Daily Food Control view with a
/// Lina AI briefing on top. Embedded (no Scaffold) in the branch accountant
/// dashboard (own branch) and the superadmin module (any branch via selector).
class DailyControlsLinaPage extends ConsumerStatefulWidget {
  const DailyControlsLinaPage({
    super.key,
    this.allowBranchSelection = false,
    this.branches = const [],
  });

  /// Central mode: show a branch dropdown (superadmin/director).
  final bool allowBranchSelection;

  /// Branches for the dropdown: list of (id, name). Only used in central mode.
  final List<(int, String)> branches;

  @override
  ConsumerState<DailyControlsLinaPage> createState() =>
      _DailyControlsLinaPageState();
}

class _DailyControlsLinaPageState extends ConsumerState<DailyControlsLinaPage>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  bool get _central => widget.allowBranchSelection;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 6, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final notifier = ref.read(linaDailyControlsProvider(_central).notifier);
      if (_central && widget.branches.isNotEmpty) {
        final current = ref.read(linaDailyControlsProvider(_central)).branchId;
        if (current == null) {
          notifier.changeBranch(widget.branches.first.$1);
          return;
        }
      }
      notifier.loadAll();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final state = ref.read(linaDailyControlsProvider(_central));
    final initial = DateTime.tryParse(state.date) ?? DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(2025),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    ref
        .read(linaDailyControlsProvider(_central).notifier)
        .changeDate(picked.toIso8601String().split('T').first);
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(linaDailyControlsProvider(_central));
    final notifier = ref.read(linaDailyControlsProvider(_central).notifier);

    return Container(
      color: const Color(0xFFF5F6FA),
      child: Column(
        children: [
          _HeaderBar(
            state: state,
            central: _central,
            branches: widget.branches,
            onBranchChanged: notifier.changeBranch,
            onPickDate: _pickDate,
            onShiftChanged: notifier.changeShift,
            onRefresh: notifier.refresh,
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(12),
              children: [
                _LinaBriefingCard(
                  state: state,
                  onRetry: () => notifier.loadBriefing(force: true),
                ),
                const SizedBox(height: 12),
                if (state.errorMessage != null)
                  _Banner(
                    color: Colors.red,
                    icon: Icons.error_outline,
                    message: state.errorMessage!,
                  ),
                if (!state.isLoading &&
                    !state.hasKitchenSession &&
                    state.hasAnyData)
                  _Banner(
                    color: Colors.orange,
                    icon: Icons.warning_amber_rounded,
                    message:
                        'No kitchen production session found for this date${state.shift != null ? ' / Shift ${state.shift}' : ''}. '
                        'Actual quantities are estimated from stock movements.',
                  ),
                if (!state.isLoading &&
                    state.hasKitchenSession &&
                    state.totalIssuedQty <= 0 &&
                    state.hasAnyData)
                  const _Banner(
                    color: Colors.orange,
                    icon: Icons.warning_amber_rounded,
                    message:
                        'A kitchen shift exists but no ingredient usage has been confirmed — '
                        '"Actual" shows 0 because nothing was logged, not because nothing was used.',
                  ),
                if (!state.isLoading &&
                    !state.hasAnyData &&
                    state.errorMessage == null)
                  _Banner(
                    color: Colors.blue,
                    icon: Icons.info_outline,
                    message:
                        'No POS food sales recorded for ${state.date}${state.shift != null ? ' Shift ${state.shift}' : ''}.',
                  ),
                // ── Tabs ────────────────────────────────────────────────────
                Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    children: [
                      TabBar(
                        controller: _tabController,
                        isScrollable: true,
                        labelColor: const Color(0xFF1565C0),
                        unselectedLabelColor: Colors.grey.shade600,
                        indicatorColor: const Color(0xFF1565C0),
                        tabs: const [
                          Tab(text: 'Stock Ledger'),
                          Tab(text: 'BOM Control'),
                          Tab(text: 'Parent & Yield Splits'),
                          Tab(text: 'Kitchen vs Sales'),
                          Tab(text: 'Stock vs Sales'),
                          Tab(text: 'Summary'),
                        ],
                      ),
                      SizedBox(
                        height: 520,
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
                                  ParentYieldSplitsTab(
                                    items: state.parentChildSales,
                                  ),
                                  KitchenVsSalesTab(
                                      items: state.kitchenVsSales),
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
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Header ──────────────────────────────────────────────────────────────────

class _HeaderBar extends StatelessWidget {
  const _HeaderBar({
    required this.state,
    required this.central,
    required this.branches,
    required this.onBranchChanged,
    required this.onPickDate,
    required this.onShiftChanged,
    required this.onRefresh,
  });

  final LinaDailyControlsState state;
  final bool central;
  final List<(int, String)> branches;
  final ValueChanged<int?> onBranchChanged;
  final VoidCallback onPickDate;
  final ValueChanged<String?> onShiftChanged;
  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF1565C0),
      padding: const EdgeInsets.fromLTRB(16, 12, 12, 12),
      child: Row(
        children: [
          Icon(PhosphorIcons.sparkle(), color: Colors.white, size: 20),
          const SizedBox(width: 8),
          const Expanded(
            child: Text(
              'Daily Controls (Lina)',
              style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w800),
            ),
          ),
          if (central && branches.isNotEmpty) ...[
            _headerDropdown<int>(
              value: state.branchId,
              hint: 'Branch',
              items: [
                for (final (id, name) in branches)
                  DropdownMenuItem(value: id, child: Text(name)),
              ],
              onChanged: onBranchChanged,
            ),
            const SizedBox(width: 8),
          ],
          OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.white,
              side: const BorderSide(color: Colors.white54),
            ),
            onPressed: onPickDate,
            icon: const Icon(Icons.calendar_today, size: 14),
            label: Text(state.date, style: const TextStyle(fontSize: 12)),
          ),
          const SizedBox(width: 8),
          _headerDropdown<String?>(
            value: state.shift,
            hint: 'Full day',
            items: const [
              DropdownMenuItem(value: null, child: Text('Full day')),
              DropdownMenuItem(value: 'A', child: Text('Shift A')),
              DropdownMenuItem(value: 'B', child: Text('Shift B')),
            ],
            onChanged: onShiftChanged,
          ),
          IconButton(
            tooltip: 'Stocksheet Report (Store Stocksheet + Controls)',
            onPressed: () => Navigator.of(context).push<void>(
              MaterialPageRoute(
                builder: (_) =>
                    FoodControlReportScreen(branchId: state.branchId),
              ),
            ),
            icon: const Icon(Icons.table_chart_outlined, color: Colors.white),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: state.isLoading ? null : onRefresh,
            icon: const Icon(Icons.refresh, color: Colors.white),
          ),
        ],
      ),
    );
  }

  Widget _headerDropdown<T>({
    required T? value,
    required String hint,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(6),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          hint: Text(hint, style: const TextStyle(fontSize: 12)),
          style: const TextStyle(fontSize: 12, color: Colors.black87),
          items: items,
          onChanged: onChanged,
        ),
      ),
    );
  }
}

// ── Lina briefing card ──────────────────────────────────────────────────────

Color _severityColor(String severity) {
  switch (severity) {
    case 'critical':
      return const Color(0xFFC62828);
    case 'high':
      return const Color(0xFFEF6C00);
    case 'medium':
      return const Color(0xFFF9A825);
    default:
      return const Color(0xFF546E7A);
  }
}

class _LinaBriefingCard extends StatelessWidget {
  const _LinaBriefingCard({required this.state, required this.onRetry});

  final LinaDailyControlsState state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final briefing = state.briefing;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.indigo.shade50, Colors.blue.shade50],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: Colors.indigo.shade100),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(PhosphorIcons.sparkle(),
                  size: 18, color: Colors.indigo.shade700),
              const SizedBox(width: 8),
              Text("Lina's Daily Briefing",
                  style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 14,
                      color: Colors.indigo.shade900)),
              const SizedBox(width: 8),
              if (briefing != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: briefing.isAiInterpreted
                        ? Colors.indigo.shade100
                        : Colors.grey.shade200,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    briefing.isAiInterpreted ? 'AI ANALYSIS' : 'BASIC ANALYSIS',
                    style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        color: briefing.isAiInterpreted
                            ? Colors.indigo.shade800
                            : Colors.grey.shade700),
                  ),
                ),
              const Spacer(),
              if (briefing != null && !state.briefingLoading)
                TextButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh, size: 14),
                  label:
                      const Text('Re-analyze', style: TextStyle(fontSize: 11)),
                ),
            ],
          ),
          const SizedBox(height: 10),
          if (state.briefingLoading)
            const Row(
              children: [
                SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2)),
                SizedBox(width: 10),
                Text('Lina is analyzing the day\'s food controls...',
                    style: TextStyle(fontSize: 12)),
              ],
            )
          else if (state.briefingError != null)
            Row(
              children: [
                Expanded(
                  child: Text(state.briefingError!,
                      style: const TextStyle(fontSize: 12)),
                ),
                TextButton(onPressed: onRetry, child: const Text('Retry')),
              ],
            )
          else if (briefing != null) ...[
            // Compact by design: headline + one-line concerns. Everything
            // else (explanations, actions, wins, data notes) sits behind
            // taps — the backend computes; the card only headlines.
            Text(briefing.headline,
                style:
                    const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text(briefing.foodCostAssessment,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    fontSize: 12, height: 1.4, color: Colors.grey.shade800)),
            if (briefing.concerns.isNotEmpty) ...[
              const SizedBox(height: 8),
              for (final concern in briefing.concerns.take(3))
                _ConcernRow(concern: concern),
            ],
            if (briefing.wins.isNotEmpty ||
                briefing.dataQualityNotes.isNotEmpty)
              Theme(
                data: Theme.of(context)
                    .copyWith(dividerColor: Colors.transparent),
                // The ListTile inside ExpansionTile paints its ink on the
                // nearest Material; without this transparent Material the
                // page's colored background hides it (framework assertion).
                child: Material(
                  type: MaterialType.transparency,
                  child: ExpansionTile(
                    tilePadding: EdgeInsets.zero,
                    dense: true,
                    visualDensity: VisualDensity.compact,
                    title: Text(
                      [
                        if (briefing.wins.isNotEmpty)
                          '${briefing.wins.length} OK',
                        if (briefing.dataQualityNotes.isNotEmpty)
                          '${briefing.dataQualityNotes.length} data note(s)',
                      ].join(' · '),
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Colors.grey.shade600),
                    ),
                    children: [
                      for (final win in briefing.wins)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 3),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Icon(Icons.check_circle_outline,
                                  size: 13, color: Color(0xFF2E7D32)),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(win,
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: Colors.grey.shade800)),
                              ),
                            ],
                          ),
                        ),
                      for (final note in briefing.dataQualityNotes)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 3),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.info_outline,
                                  size: 13, color: Colors.amber.shade900),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(note,
                                    style: TextStyle(
                                        fontSize: 11,
                                        color: Colors.amber.shade900)),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ),
          ] else
            const Text('Run a refresh to get Lina\'s take on the day.',
                style: TextStyle(fontSize: 12)),
        ],
      ),
    );
  }
}

/// Collapsed one-liner (severity chip + title); tap to reveal the
/// explanation and suggested action.
class _ConcernRow extends StatefulWidget {
  const _ConcernRow({required this.concern});

  final LinaBriefingConcern concern;

  @override
  State<_ConcernRow> createState() => _ConcernRowState();
}

class _ConcernRowState extends State<_ConcernRow> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final concern = widget.concern;
    final color = _severityColor(concern.severity);
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border(left: BorderSide(color: color, width: 3)),
      ),
      child: InkWell(
        onTap: () => setState(() => _expanded = !_expanded),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(concern.severity.toUpperCase(),
                        style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: color)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(concern.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                            fontSize: 12, fontWeight: FontWeight.w700)),
                  ),
                  Icon(_expanded ? Icons.expand_less : Icons.expand_more,
                      size: 16, color: Colors.grey.shade500),
                ],
              ),
              if (_expanded) ...[
                const SizedBox(height: 4),
                Text(concern.explanation,
                    style:
                        TextStyle(fontSize: 11.5, color: Colors.grey.shade700)),
                const SizedBox(height: 4),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.arrow_forward,
                        size: 12, color: Colors.grey.shade600),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(concern.action,
                          style: TextStyle(
                              fontSize: 11.5,
                              fontStyle: FontStyle.italic,
                              color: Colors.grey.shade800)),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Banner ──────────────────────────────────────────────────────────────────

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
      margin: const EdgeInsets.only(bottom: 12),
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
            child: Text(message,
                style: TextStyle(
                    color: color.shade800, fontSize: 12, height: 1.5)),
          ),
        ],
      ),
    );
  }
}
