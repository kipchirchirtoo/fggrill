import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/widgets/sticky_horizontal_scrollbar.dart';
import '../../kitchen/data/repository.dart';
import '../../kitchen/domain/session_models.dart';
import '../../kitchen/domain/session_providers.dart';

class DailyControlsScreen extends ConsumerStatefulWidget {
  const DailyControlsScreen({super.key, this.onBack, this.initialShiftId});

  final VoidCallback? onBack;
  final String? initialShiftId;

  @override
  ConsumerState<DailyControlsScreen> createState() => _DailyControlsScreenState();
}

class _DailyControlsScreenState extends ConsumerState<DailyControlsScreen> {
  String? _selectedShiftId;
  bool _isExporting = false;
  final Set<String> _expandedRowSkus = <String>{};
  Future<Map<String, dynamic>>? _reportFuture;
  String? _loadedShiftId;

  @override
  void initState() {
    super.initState();
    if (widget.initialShiftId != null) {
      _selectedShiftId = widget.initialShiftId;
    }
  }

  @override
  void didUpdateWidget(covariant DailyControlsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialShiftId != null && widget.initialShiftId != oldWidget.initialShiftId) {
      setState(() {
        _selectedShiftId = widget.initialShiftId;
        _loadedShiftId = null;
        _reportFuture = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final shiftsAsync = ref.watch(allKitchenShiftsProvider);

    return shiftsAsync.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (error, _) => Center(child: Text('Error loading kitchen shifts: $error')),
      data: (shifts) {
        final sorted = [...shifts]
          ..sort((a, b) {
            final dateCompare = b.shiftDate.compareTo(a.shiftDate);
            if (dateCompare != 0) return dateCompare;
            return b.shiftNumber.compareTo(a.shiftNumber);
          });

        if (sorted.isEmpty) {
          return const Center(
            child: Text(
              'No kitchen shifts found yet.',
              style: TextStyle(color: Colors.grey),
            ),
          );
        }

        _selectedShiftId ??= sorted.first.id;
        final selectedShift = sorted.firstWhere(
          (shift) => shift.id == _selectedShiftId,
          orElse: () => sorted.first,
        );

        if (_loadedShiftId != selectedShift.id || _reportFuture == null) {
          _loadedShiftId = selectedShift.id;
          _reportFuture = ref
              .read(kitchenRepositoryProvider)
              .getDailyControlsReport(selectedShift.id);
        }

        return FutureBuilder<Map<String, dynamic>>(
          future: _reportFuture,
          builder: (context, snapshot) {
            final loading = snapshot.connectionState == ConnectionState.waiting;
            final data = snapshot.data;
            final summary = Map<String, dynamic>.from(
              (data?['summary'] as Map?) ?? const {},
            );
            final frozen = data?['frozen'] == true;
            final frozenAt = data?['frozen_at']?.toString();
            final standardsConfigured = data?['standards_configured'] == true;
            final rows = ((data?['rows'] as List?) ?? const [])
                .whereType<Map>()
                .map((row) => Map<String, dynamic>.from(row))
                .toList();

            return SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        if (widget.onBack != null) ...[
                          OutlinedButton.icon(
                            onPressed: widget.onBack,
                            icon: const Icon(Icons.arrow_back),
                            label: const Text('Back'),
                          ),
                          const SizedBox(width: 16),
                        ],
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Daily Controls',
                                style: TextStyle(
                                    fontSize: 32, fontWeight: FontWeight.w700),
                              ),
                              SizedBox(height: 8),
                              Text(
                                'Review one kitchen shift at a time using only configured Food Control Standards. This page is a full-width accountant review sheet.',
                                style: TextStyle(
                                    color: Colors.black54, fontSize: 14),
                              ),
                            ],
                          ),
                        ),
                        if (!loading && data != null) ...[
                          const SizedBox(width: 16),
                          _buildExportMenu(selectedShift, data, rows),
                        ],
                      ],
                    ),
                    const SizedBox(height: 24),
                    Expanded(
                      child: ListView(
                        padding: EdgeInsets.zero,
                        children: [
                          _buildFilterCard(sorted, selectedShift),
                          const SizedBox(height: 20),
                          if (loading && !snapshot.hasData)
                            const SizedBox(
                              height: 240,
                              child: Center(child: CircularProgressIndicator()),
                            )
                          else if (snapshot.hasError)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(24),
                              decoration: BoxDecoration(
                                color: Colors.red.shade50,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.red.shade100),
                              ),
                              child: Text(
                                'Error loading daily controls: ${snapshot.error}',
                                style: TextStyle(color: Colors.red.shade700),
                              ),
                            )
                          else ...[
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 14,
                              ),
                              decoration: BoxDecoration(
                                color: !standardsConfigured
                                    ? const Color(0xFFFEF2F2)
                                    : frozen
                                        ? const Color(0xFFECFDF3)
                                        : const Color(0xFFFFF7ED),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: !standardsConfigured
                                      ? const Color(0xFFFECACA)
                                      : frozen
                                          ? const Color(0xFFA7F3D0)
                                          : const Color(0xFFFED7AA),
                                ),
                              ),
                              child: Wrap(
                                spacing: 12,
                                runSpacing: 8,
                                crossAxisAlignment: WrapCrossAlignment.center,
                                children: [
                                  Icon(
                                    !standardsConfigured
                                        ? Icons.warning_amber_rounded
                                        : frozen
                                            ? Icons.lock_clock_outlined
                                            : Icons.schedule_outlined,
                                    color: !standardsConfigured
                                        ? const Color(0xFFB91C1C)
                                        : frozen
                                            ? const Color(0xFF047857)
                                            : const Color(0xFFB45309),
                                  ),
                                  ConstrainedBox(
                                    constraints:
                                        const BoxConstraints(maxWidth: 1080),
                                    child: Text(
                                      !standardsConfigured
                                          ? 'No Food Control Standards are configured for this branch/shift scope yet. Daily Controls only loads items from the standards set in Food Control Standards.'
                                          : frozen
                                              ? 'Frozen snapshot loaded${(frozenAt != null && frozenAt.isNotEmpty) ? ' - saved $frozenAt' : ''}. These figures will not change.'
                                              : 'Live / provisional view loaded. Figures can still change until the cashier day is closed and frozen.',
                                      softWrap: true,
                                      style: TextStyle(
                                        color: !standardsConfigured
                                            ? const Color(0xFF991B1B)
                                            : frozen
                                                ? const Color(0xFF065F46)
                                                : const Color(0xFF9A3412),
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 20),
                            _buildSummaryRow(summary, data),
                            const SizedBox(height: 20),
                            _buildChannelControls(data ?? const <String, dynamic>{}),
                            _buildWastageCard(data ?? const <String, dynamic>{}),
                            _buildUnmatchedCard(data ?? const <String, dynamic>{}),
                            _buildSheetCard(rows, selectedShift, data ?? const <String, dynamic>{}),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  num _cNum(dynamic v) {
    if (v is num) return v;
    return num.tryParse('${v ?? ''}'.replaceAll(',', '').trim()) ?? 0;
  }

  String _cMoney(dynamic v) => 'KES ${NumberFormat('#,##0.00').format(_cNum(v))}';

  String _methodLabel(String method) {
    switch (method) {
      case 'recipe_standard':
        return 'POS sales standard (expected vs actual)';
      case 'cost_per_pax':
        return 'Net cost ÷ confirmed pax';
      case 'cost_margin':
        return 'Cost, revenue, food-cost %, margin, cost/guest';
      case 'cost_margin_returns':
        return 'Cost − returns, margin, cost/guest';
      case 'menu_x_served':
        return 'Menu standard × staff served';
      case 'wastage_approval':
        return 'Approved / pending loss';
      default:
        return method;
    }
  }

  Widget _buildChannelControls(Map<String, dynamic> data) {
    final channels = ((data['channel_controls'] as List?) ?? const [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    if (channels.isEmpty) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Channel Controls',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 4),
          const Text(
            'Each issue channel controlled by the method appropriate to it.',
            style: TextStyle(color: Colors.black54, fontSize: 13),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: channels.map(_channelControlCard).toList(),
          ),
        ],
      ),
    );
  }

  Widget _channelControlCard(Map<String, dynamic> c) {
    final revenue = _cNum(c['revenue']);
    final foodCostPct = c['food_cost_pct'];
    final grossMargin = c['gross_margin'];
    final costPerGuest = c['cost_per_guest'];
    final pax = _cNum(c['pax']);
    final returns = _cNum(c['returns']);
    final wastage = _cNum(c['wastage_cost']);
    final metrics = <List<String>>[
      ['Issued cost', _cMoney(c['issued_cost'])],
      if (returns > 0) ['Returns', _cMoney(returns)],
      ['Net cost', _cMoney(c['net_cost'])],
      if (revenue > 0) ['Revenue', _cMoney(revenue)],
      if (foodCostPct != null)
        ['Food cost %', '${_cNum(foodCostPct).toStringAsFixed(1)}%'],
      if (grossMargin != null) ['Gross margin', _cMoney(grossMargin)],
      if (pax > 0) ['Pax', pax.toStringAsFixed(0)],
      if (costPerGuest != null) ['Cost / guest', _cMoney(costPerGuest)],
      if (wastage > 0) ['Wastage', _cMoney(wastage)],
    ];
    return ConstrainedBox(
      constraints: const BoxConstraints(minWidth: 260, maxWidth: 340),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${c['channel_name'] ?? c['channel_code'] ?? ''}',
                style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                    color: Color(0xFF0F172A))),
            const SizedBox(height: 2),
            Text(_methodLabel('${c['control_method'] ?? ''}'),
                style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
            const SizedBox(height: 12),
            ...metrics.map((m) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 3),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(m[0],
                          style: const TextStyle(
                              fontSize: 12, color: Color(0xFF475569))),
                      Text(m[1],
                          style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF0F172A))),
                    ],
                  ),
                )),
          ],
        ),
      ),
    );
  }

  Widget _buildWastageCard(Map<String, dynamic> data) {
    final raw = data['wastage'];
    if (raw is! Map) return const SizedBox.shrink();
    final w = Map<String, dynamic>.from(raw);
    final approved = _cNum(w['approved_cost']);
    final pending = _cNum(w['pending_cost']);
    final entries = (w['entries'] as List?)?.whereType<Map>().toList() ?? const [];
    if (approved == 0 && pending == 0 && entries.isEmpty) {
      return const SizedBox.shrink();
    }
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFFED7AA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.delete_outline, color: Color(0xFFB45309)),
              const SizedBox(width: 8),
              const Text('Wastage / Spoilage',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              const Spacer(),
              Text('Approved ${_cMoney(approved)}   Pending ${_cMoney(pending)}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, color: Color(0xFF9A3412))),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Kept separate from unexplained variance. Requires accountant approval.',
            style: TextStyle(fontSize: 12, color: Color(0xFF9A3412)),
          ),
        ],
      ),
    );
  }

  Widget _buildUnmatchedCard(Map<String, dynamic> data) {
    final list = ((data['unmatched_pos_items'] as List?) ?? const [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .where((u) {
          final name = (u['item_name'] ?? '').toString().toLowerCase().trim();
          final isBarOrNonFood = name.contains('white cap') ||
              name.contains('tusker') ||
              name.contains('guinness') ||
              name.contains('guarana') ||
              name.contains('viceroy') ||
              name.contains('richot') ||
              name.contains('savanna') ||
              name.contains('manyatta') ||
              name.contains('faxe') ||
              name.contains('vodka') ||
              name.contains('captain morgan') ||
              name.contains('black & white') ||
              name.contains('kc ') ||
              name.contains('soda') ||
              name.contains('water') ||
              name.contains('juice') ||
              name.contains('nescafe') ||
              name.contains('token') ||
              name.contains('trust') ||
              name.contains('750ml') ||
              name.contains('350ml') ||
              name.contains('250ml') ||
              name.contains('cider') ||
              name.contains('lager');
          return !isBarOrNonFood;
        })
        .toList();
    if (list.isEmpty) return const SizedBox.shrink();
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.help_outline, color: Color(0xFFB91C1C)),
              SizedBox(width: 8),
              Expanded(
                child: Text('POS items needing food-control config',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          const Text(
            'Sold but not linked to a recipe / inventory / direct item. Register them in Food Control Standards so their consumption is controlled.',
            style: TextStyle(fontSize: 12, color: Color(0xFF991B1B)),
          ),
          const SizedBox(height: 12),
          ...list.map((u) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text('${u['item_name'] ?? 'Unmapped POS item'}',
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                              fontSize: 13, color: Color(0xFF7F1D1D))),
                    ),
                    Text('${_cNum(u['portions_sold']).toStringAsFixed(2)} sold',
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: Color(0xFF7F1D1D))),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildFilterCard(List<KitchenShift> shifts, KitchenShift selectedShift) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Shift Selection',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 360),
                child: DropdownButtonFormField<String>(
                  value: selectedShift.id,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Kitchen Shift',
                    border: OutlineInputBorder(),
                  ),
                  items: shifts
                      .map(
                        (shift) => DropdownMenuItem<String>(
                          value: shift.id,
                          child: Text(
                            '${shift.shiftDate} - ${shift.shiftNumber} - ${_shiftLabel(shift)} - ${shift.status.toUpperCase()}',
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (value) {
                    if (value == null || value == _selectedShiftId) return;
                    setState(() {
                      _selectedShiftId = value;
                      _loadedShiftId = value;
                      _reportFuture = ref
                          .read(kitchenRepositoryProvider)
                          .getDailyControlsReport(value);
                      _expandedRowSkus.clear();
                    });
                  },
                ),
              ),
              _metaChip('Date', selectedShift.shiftDate),
              _metaChip('Shift', _shiftLabel(selectedShift)),
              _metaChip('Department', selectedShift.department ?? 'KITCHEN'),
              _metaChip('Status', selectedShift.status.toUpperCase()),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryRow(Map<String, dynamic> summary, Map<String, dynamic>? data) {
    final currencyFmt = NumberFormat.currency(symbol: 'KES ', decimalDigits: 2);
    final numberFmt = NumberFormat('#,##0.###');

    final cards = [
      ('Items', '${summary['item_count'] ?? 0}'),
      ('Breakfast Pax', '${data?['breakfast_pax'] ?? 0}'),
      ('Staff Meal Pax', '${data?['staff_meal_pax'] ?? 0}'),
      ('Opening Qty', numberFmt.format((summary['total_opening_qty'] as num?) ?? 0)),
      ('Additions', numberFmt.format((summary['total_additions_qty'] as num?) ?? 0)),
      ('POS Sales', numberFmt.format((summary['total_pos_sales_qty'] as num?) ?? 0)),
      ('Spoilage', numberFmt.format((summary['total_spoilage_qty'] as num?) ?? 0)),
      ('Expected Cost', currencyFmt.format((summary['total_expected_cost'] as num?) ?? 0)),
      ('Actual Cost', currencyFmt.format((summary['total_actual_cost'] as num?) ?? 0)),
      ('Variance Cost', currencyFmt.format((summary['total_variance_cost'] as num?) ?? 0)),
    ];

    return Wrap(
      spacing: 16,
      runSpacing: 16,
      children: cards
          .map(
            (card) => Container(
              width: 220,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    card.$1,
                    style: const TextStyle(
                      fontSize: 13,
                      color: Colors.black54,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    card.$2,
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          )
          .toList(),
    );
  }

  Widget _buildSheetCard(
    List<Map<String, dynamic>> rows,
    KitchenShift selectedShift,
    Map<String, dynamic> data,
  ) {
    final currencyFmt = NumberFormat.currency(symbol: 'KES ', decimalDigits: 2);
    final qtyFmt = NumberFormat('#,##0.###');

    Widget header(String text, {double? width}) => SizedBox(
          width: width,
          child: Text(
            text,
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
        );

    Widget value(dynamic val, {double? width, TextAlign align = TextAlign.left, int maxLines = 2}) =>
        SizedBox(
          width: width,
          child: Padding(
            padding: const EdgeInsets.only(right: 8.0),
            child: Text(
              val?.toString() ?? '-',
              textAlign: align,
              maxLines: maxLines,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
            ),
          ),
        );

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Shift Control Sheet',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                      ),
                      SizedBox(height: 4),
                      Text(
                        'Expected consumption comes from the configured standards and shift-linked events. Actual consumption is derived from stock movement inside the shift ledger.',
                        style: TextStyle(fontSize: 13, color: Colors.black54),
                      ),
                    ],
                  ),
                ),
                if (rows.isNotEmpty) ...[
                  const SizedBox(width: 16),
                  OutlinedButton.icon(
                    onPressed: _isExporting
                        ? null
                        : () => _exportCsv(selectedShift, data, rows),
                    icon: const Icon(Icons.description_outlined, size: 16),
                    label: const Text('Export CSV'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF1E3D73),
                      side: const BorderSide(color: Color(0xFF1E3D73)),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton.icon(
                    onPressed: _isExporting
                        ? null
                        : () => _exportExcel(selectedShift, data, rows),
                    icon: const Icon(Icons.table_chart_rounded, size: 16),
                    label: const Text('Export Excel'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF107C41),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 10),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 16),
          StickyHorizontalScrollbar(
            contentWidth: 2050,
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                  decoration: const BoxDecoration(
                    color: Color(0xFF1E3D73),
                    borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
                  ),
                  child: Row(
                    children: [
                      header('#', width: 48),
                      header('Item', width: 220),
                      header('SKU', width: 110),
                      header('Unit', width: 80),
                      header('Main Channel', width: 150),
                      header('Opening', width: 90),
                      header('Additions', width: 90),
                      header('POS Sales', width: 90),
                      header('Spoilage', width: 90),
                      header('System Closing', width: 110),
                      header('Physical Closing', width: 120),
                      header('Expected Usage', width: 120),
                      header('Actual Usage', width: 110),
                      header('Variance Qty', width: 105),
                      header('Cost Price', width: 100),
                      header('Expected Cost', width: 120),
                      header('Actual Cost', width: 110),
                      header('Variance Cost', width: 110),
                    ],
                  ),
                ),
                // Rows scroll vertically inside a bounded viewport so the dark
                // column header above stays pinned (sticky) while reviewing.
                SizedBox(
                  height: (MediaQuery.of(context).size.height * 0.55)
                      .clamp(320.0, 900.0),
                  child: SingleChildScrollView(
                    child: Column(
                      children: [
                if (rows.isEmpty)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                      'No item-level control rows were generated for this shift.',
                      style: TextStyle(color: Colors.grey),
                    ),
                  )
                else
                  ...rows.asMap().entries.map((entry) {
                    final index = entry.key + 1;
                    final row = entry.value;
                    final sku = '${row['item_sku'] ?? index}';
                    final varianceCost =
                        (row['variance_cost'] as num?)?.toDouble() ?? 0;
                    final background =
                        index.isEven ? const Color(0xFFF8FAFD) : Colors.white;
                    final producedItems = ((row['produced_items'] as List?) ?? const [])
                        .whereType<Map>()
                        .map((e) => Map<String, dynamic>.from(e))
                        .toList();
                    final hasProduced = producedItems.isNotEmpty;
                    final isExpanded = _expandedRowSkus.contains(sku);

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        InkWell(
                          onTap: hasProduced
                              ? () {
                                  setState(() {
                                    if (isExpanded) {
                                      _expandedRowSkus.remove(sku);
                                    } else {
                                      _expandedRowSkus.add(sku);
                                    }
                                  });
                                }
                              : null,
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 20, vertical: 14),
                            decoration: BoxDecoration(
                              color: isExpanded ? const Color(0xFFEFF5FF) : background,
                              border: Border(
                                top: BorderSide(color: Colors.grey.shade200),
                              ),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.center,
                              children: [
                                value(index, width: 48),
                                SizedBox(
                                  width: 220,
                                  child: Row(
                                    children: [
                                      if (hasProduced)
                                        Icon(
                                          isExpanded
                                              ? Icons.keyboard_arrow_down_rounded
                                              : Icons.keyboard_arrow_right_rounded,
                                          size: 20,
                                          color: const Color(0xFF1E3D73),
                                        )
                                      else
                                        const SizedBox(width: 20),
                                      const SizedBox(width: 4),
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(
                                              '${row['item_name'] ?? '-'}',
                                              maxLines: 2,
                                              overflow: TextOverflow.ellipsis,
                                              style: TextStyle(
                                                fontSize: 13,
                                                fontWeight: FontWeight.w600,
                                                color: hasProduced
                                                    ? const Color(0xFF1E3D73)
                                                    : Colors.black87,
                                              ),
                                            ),
                                            if (hasProduced)
                                              Container(
                                                margin: const EdgeInsets.only(top: 3),
                                                padding: const EdgeInsets.symmetric(
                                                    horizontal: 6, vertical: 1.5),
                                                decoration: BoxDecoration(
                                                  color: isExpanded
                                                      ? const Color(0xFF1E3D73)
                                                      : const Color(0xFFE2ECF9),
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  '${producedItems.length} POS dishes ${isExpanded ? '▲' : '▼'}',
                                                  style: TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.w700,
                                                    color: isExpanded
                                                        ? Colors.white
                                                        : const Color(0xFF1E3D73),
                                                  ),
                                                ),
                                              ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                value(row['item_sku'], width: 110),
                                value(row['unit'], width: 80),
                                value(row['main_channel'], width: 150),
                                value(
                                    qtyFmt.format((row['opening_qty'] as num?) ?? 0),
                                    width: 90),
                                value(
                                    qtyFmt.format((row['additions_qty'] as num?) ?? 0),
                                    width: 90),
                                value(
                                    qtyFmt.format((row['pos_sales_qty'] as num?) ?? 0),
                                    width: 90),
                                value(
                                    qtyFmt.format((row['spoilage_qty'] as num?) ?? 0),
                                    width: 90),
                                value(
                                    qtyFmt.format(
                                        (row['system_closing_qty'] as num?) ?? 0),
                                    width: 110),
                                value(
                                    qtyFmt.format(
                                        (row['physical_closing_qty'] as num?) ?? 0),
                                    width: 120),
                                value(
                                    qtyFmt.format(
                                        (row['expected_consumption_qty'] as num?) ?? 0),
                                    width: 120),
                                value(
                                    qtyFmt.format(
                                        (row['actual_consumption_qty'] as num?) ?? 0),
                                    width: 110),
                                value(
                                    qtyFmt.format((row['variance_qty'] as num?) ?? 0),
                                    width: 105),
                                value(
                                    currencyFmt.format((row['cost_price'] as num?) ?? 0),
                                    width: 100),
                                value(
                                    currencyFmt.format((row['expected_cost'] as num?) ?? 0),
                                    width: 120),
                                value(
                                    currencyFmt.format((row['actual_cost'] as num?) ?? 0),
                                    width: 110),
                                SizedBox(
                                  width: 110,
                                  child: Text(
                                    currencyFmt.format(varianceCost),
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: varianceCost > 0
                                          ? Colors.red.shade700
                                          : varianceCost < 0
                                              ? Colors.green.shade700
                                              : Colors.black87,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        AnimatedCrossFade(
                          duration: const Duration(milliseconds: 200),
                          firstCurve: Curves.easeOutQuad,
                          secondCurve: Curves.easeInQuad,
                          crossFadeState: (isExpanded && hasProduced)
                              ? CrossFadeState.showSecond
                              : CrossFadeState.showFirst,
                          firstChild: const SizedBox(width: 2050, height: 0),
                          secondChild: hasProduced
                              ? Container(
                                  width: 2050,
                                  margin: const EdgeInsets.fromLTRB(48, 0, 20, 10),
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF7FAFD),
                                    borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12)),
                                    border: Border.all(color: const Color(0xFFC7D9F2), width: 1.2),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.all(6),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF1E3D73),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: const Icon(Icons.restaurant_rounded, size: 16, color: Colors.white),
                                          ),
                                          const SizedBox(width: 10),
                                          Text(
                                            'Linked POS Dishes Breakdown: ${row['item_name']} (${row['item_sku']})',
                                            style: const TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w700,
                                              color: Color(0xFF1E3D73),
                                            ),
                                          ),
                                          const Spacer(),
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                            decoration: BoxDecoration(
                                              color: Colors.white,
                                              borderRadius: BorderRadius.circular(20),
                                              border: Border.all(color: const Color(0xFFCBDDF5)),
                                            ),
                                            child: Text(
                                              'Total: ${((row['pos_sales_qty'] as num?)?.toDouble() ?? 0).toStringAsFixed(0)} portions sold  |  ${((row['expected_consumption_qty'] as num?)?.toDouble() ?? 0).toStringAsFixed(3)} ${row['unit'] ?? ''} standard consumed',
                                              style: const TextStyle(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
                                                color: Color(0xFF1E3D73),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 12),
                                      Container(
                                        constraints: const BoxConstraints(maxWidth: 1200),
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(color: Colors.grey.shade300),
                                        ),
                                        child: Column(
                                          children: [
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                              decoration: const BoxDecoration(
                                                color: Color(0xFF1E3D73),
                                                borderRadius: BorderRadius.vertical(top: Radius.circular(7)),
                                              ),
                                              child: const Row(
                                                children: [
                                                  SizedBox(width: 36, child: Text('#', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700))),
                                                  Expanded(flex: 4, child: Text('POS Menu Dish', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700))),
                                                  Expanded(flex: 2, child: Text('Portions Sold at POS', textAlign: TextAlign.right, style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700))),
                                                  Expanded(flex: 3, child: Text('Standard Raw Qty Consumed', textAlign: TextAlign.right, style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700))),
                                                  Expanded(flex: 2, child: Text('Share of Standard', textAlign: TextAlign.right, style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700))),
                                                ],
                                              ),
                                            ),
                                            ...producedItems.asMap().entries.map((subEntry) {
                                              final subIdx = subEntry.key + 1;
                                              final dish = subEntry.value;
                                              final portionsSold = (dish['portions_sold'] as num?)?.toDouble() ?? 0;
                                              final rawConsumed = (dish['raw_quantity_consumed'] as num?)?.toDouble() ?? 0;
                                              final totalExpected = (row['expected_consumption_qty'] as num?)?.toDouble() ?? 0;
                                              final pct = totalExpected > 0 ? (rawConsumed / totalExpected * 100).clamp(0.0, 100.0) : 0.0;

                                              return Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                                decoration: BoxDecoration(
                                                  color: subIdx.isEven ? const Color(0xFFF9FAFD) : Colors.white,
                                                  border: Border(top: BorderSide(color: Colors.grey.shade100)),
                                                ),
                                                child: Row(
                                                  children: [
                                                    SizedBox(width: 36, child: Text('$subIdx', style: TextStyle(color: Colors.grey.shade600, fontSize: 12))),
                                                    Expanded(
                                                      flex: 4,
                                                      child: Text(
                                                        '${dish['dish_name'] ?? ''}',
                                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.black87),
                                                      ),
                                                    ),
                                                    Expanded(
                                                      flex: 2,
                                                      child: Text(
                                                        '${qtyFmt.format(portionsSold)} sold',
                                                        textAlign: TextAlign.right,
                                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1E3D73)),
                                                      ),
                                                    ),
                                                    Expanded(
                                                      flex: 3,
                                                      child: Text(
                                                        '${qtyFmt.format(rawConsumed)} ${row['unit'] ?? ''}',
                                                        textAlign: TextAlign.right,
                                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF047857)),
                                                      ),
                                                    ),
                                                    Expanded(
                                                      flex: 2,
                                                      child: Text(
                                                        '${pct.toStringAsFixed(1)}%',
                                                        textAlign: TextAlign.right,
                                                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade700),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              );
                                            }),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                )
                              : const SizedBox.shrink(),
                        ),
                      ],
                    );
                  }),
                const SizedBox(height: 18),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _metaChip(String label, String value) {
    return Container(
      constraints: const BoxConstraints(minWidth: 160),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(fontSize: 12, color: Colors.black54),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }

  String _shiftLabel(KitchenShift shift) {
    if ((shift.subShiftType ?? '').trim().isNotEmpty) {
      return 'Shift ${shift.subShiftType}';
    }
    return shift.shiftType.replaceAll('_', ' ').toUpperCase();
  }

  Widget _buildExportMenu(
    KitchenShift selectedShift,
    Map<String, dynamic> data,
    List<Map<String, dynamic>> rows,
  ) {
    return PopupMenuButton<String>(
      tooltip: 'Export Food Controls Report',
      enabled: !_isExporting,
      onSelected: (format) {
        if (format == 'excel') {
          _exportExcel(selectedShift, data, rows);
        } else if (format == 'csv') {
          _exportCsv(selectedShift, data, rows);
        }
      },
      itemBuilder: (context) => [
        const PopupMenuItem(
          value: 'excel',
          child: Row(
            children: [
              Icon(Icons.table_chart_rounded,
                  color: Color(0xFF107C41), size: 22),
              SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Export to Excel (.xlsx)',
                    style:
                        TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  Text(
                    'Multi-sheet formatted Excel workbook',
                    style: TextStyle(color: Colors.black54, fontSize: 11),
                  ),
                ],
              ),
            ],
          ),
        ),
        const PopupMenuDivider(),
        const PopupMenuItem(
          value: 'csv',
          child: Row(
            children: [
              Icon(Icons.description_outlined,
                  color: Color(0xFF1E3D73), size: 22),
              SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Export to CSV (.csv)',
                    style:
                        TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                  ),
                  Text(
                    'Compatible with Excel, Sheets & Calc',
                    style: TextStyle(color: Colors.black54, fontSize: 11),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: const Color(0xFF107C41), // Excel green
          borderRadius: BorderRadius.circular(10),
          boxShadow: [
            const BoxShadow(
              color: Color(0x40107C41),
              blurRadius: 8,
              offset: Offset(0, 2),
            ),
          ],
        ),
        child: _isExporting
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.file_download_outlined,
                      color: Colors.white, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Export Report',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                  SizedBox(width: 6),
                  Icon(Icons.arrow_drop_down, color: Colors.white, size: 20),
                ],
              ),
      ),
    );
  }

  Future<void> _exportExcel(
    KitchenShift selectedShift,
    Map<String, dynamic>? data,
    List<Map<String, dynamic>> rows,
  ) async {
    if (_isExporting) return;
    setState(() => _isExporting = true);

    final safeShiftNum =
        selectedShift.shiftNumber.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
    final safeDate =
        selectedShift.shiftDate.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
    final filename = 'FG_DailyControls_${safeDate}_$safeShiftNum.xlsx';

    try {
      final file = await ref
          .read(kitchenRepositoryProvider)
          .downloadDailyControlsExcel(selectedShift.id, filename: filename);

      if (!mounted) return;
      _showExportSuccessSnackBar(
        'Excel workbook exported: ${file.path}',
        file,
      );
    } catch (e) {
      debugPrint(
          'Excel export via backend failed: $e. Falling back to CSV export.');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Excel download failed ($e). Generating CSV...'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
      if (data != null) {
        await _exportCsv(selectedShift, data, rows);
      }
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  Future<void> _exportCsv(
    KitchenShift selectedShift,
    Map<String, dynamic> data,
    List<Map<String, dynamic>> rows,
  ) async {
    if (_isExporting) return;
    setState(() => _isExporting = true);

    try {
      final summary = Map<String, dynamic>.from(
        (data['summary'] as Map?) ?? const {},
      );
      final frozen = data['frozen'] == true;
      final frozenAt = data['frozen_at']?.toString() ?? '';

      final safeShiftNum =
          selectedShift.shiftNumber.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
      final safeDate =
          selectedShift.shiftDate.replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
      final filename = 'FG_DailyControls_${safeDate}_$safeShiftNum.csv';

      final buffer = StringBuffer();
      // UTF-8 BOM so Excel opens it with proper Unicode characters
      buffer.write('\uFEFF');

      // Title & Shift Header
      buffer.writeln(
          _csvRow(['FAMOUS GATE HOTELS — DAILY FOOD CONTROLS REPORT']));
      buffer.writeln(_csvRow([
        'Kitchen Shift: ${selectedShift.shiftNumber}',
        'Date: ${selectedShift.shiftDate}',
        'Shift Type: ${_shiftLabel(selectedShift)}',
        'Department: ${selectedShift.department ?? 'KITCHEN'}',
        'Status: ${selectedShift.status.toUpperCase()}',
      ]));
      buffer.writeln(_csvRow([
        'Snapshot: ${frozen ? 'Frozen ($frozenAt)' : 'Live Provisional'}',
        'Exported At: ${DateFormat('yyyy-MM-dd HH:mm:ss').format(DateTime.now())}',
      ]));
      buffer.writeln();

      // Summary KPIs
      buffer.writeln(_csvRow(['SUMMARY METRICS']));
      buffer.writeln(_csvRow([
        'Items Count',
        'Breakfast Pax',
        'Staff Meal Pax',
        'Opening Qty',
        'Additions Qty',
        'POS Sales Qty',
        'Spoilage Qty',
        'Expected Cost (KES)',
        'Actual Cost (KES)',
        'Variance Cost (KES)',
      ]));
      buffer.writeln(_csvRow([
        '${summary['item_count'] ?? rows.length}',
        '${data['breakfast_pax'] ?? 0}',
        '${data['staff_meal_pax'] ?? 0}',
        _cNum(summary['total_opening_qty']).toStringAsFixed(3),
        _cNum(summary['total_additions_qty']).toStringAsFixed(3),
        _cNum(summary['total_pos_sales_qty']).toStringAsFixed(3),
        _cNum(summary['total_spoilage_qty']).toStringAsFixed(3),
        _cNum(summary['total_expected_cost']).toStringAsFixed(2),
        _cNum(summary['total_actual_cost']).toStringAsFixed(2),
        _cNum(summary['total_variance_cost']).toStringAsFixed(2),
      ]));
      buffer.writeln();

      // Channel Controls
      final channels = ((data['channel_controls'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (channels.isNotEmpty) {
        buffer.writeln(_csvRow(['CHANNEL CONTROLS BREAKDOWN']));
        buffer.writeln(_csvRow([
          'Channel',
          'Control Method',
          'Issued Cost (KES)',
          'Returns (KES)',
          'Net Cost (KES)',
          'Revenue (KES)',
          'Food Cost %',
          'Gross Margin (KES)',
          'Pax',
          'Cost / Guest (KES)',
          'Wastage (KES)',
        ]));
        for (final c in channels) {
          buffer.writeln(_csvRow([
            '${c['channel_name'] ?? c['channel_code'] ?? ''}',
            _methodLabel('${c['control_method'] ?? ''}'),
            _cNum(c['issued_cost']).toStringAsFixed(2),
            _cNum(c['returns']).toStringAsFixed(2),
            _cNum(c['net_cost']).toStringAsFixed(2),
            _cNum(c['revenue']).toStringAsFixed(2),
            c['food_cost_pct'] != null
                ? '${_cNum(c['food_cost_pct']).toStringAsFixed(1)}%'
                : '—',
            c['gross_margin'] != null
                ? _cNum(c['gross_margin']).toStringAsFixed(2)
                : '—',
            _cNum(c['pax']).toStringAsFixed(0),
            c['cost_per_guest'] != null
                ? _cNum(c['cost_per_guest']).toStringAsFixed(2)
                : '—',
            _cNum(c['wastage_cost']).toStringAsFixed(2),
          ]));
        }
        buffer.writeln();
      }

      // Shift Control Sheet Table
      buffer.writeln(_csvRow(['SHIFT CONTROL SHEET']));
      final sheetHeaders = [
        '#',
        'Item Name',
        'SKU',
        'Unit',
        'Main Channel',
        'Opening Qty',
        'Additions Qty',
        'POS Sales Qty',
        'Spoilage Qty',
        'System Closing Qty',
        'Physical Closing Qty',
        'Expected Consumption',
        'Actual Consumption',
        'Variance Qty',
        'Cost Price (KES)',
        'Expected Cost (KES)',
        'Actual Cost (KES)',
        'Variance Cost (KES)',
      ];
      buffer.writeln(_csvRow(sheetHeaders));

      for (var i = 0; i < rows.length; i++) {
        final r = rows[i];
        buffer.writeln(_csvRow([
          '${i + 1}',
          '${r['item_name'] ?? ''}',
          '${r['item_sku'] ?? ''}',
          '${r['unit'] ?? ''}',
          '${r['main_channel'] ?? ''}',
          _cNum(r['opening_qty']).toStringAsFixed(3),
          _cNum(r['additions_qty']).toStringAsFixed(3),
          _cNum(r['pos_sales_qty']).toStringAsFixed(3),
          _cNum(r['spoilage_qty']).toStringAsFixed(3),
          _cNum(r['system_closing_qty']).toStringAsFixed(3),
          _cNum(r['physical_closing_qty']).toStringAsFixed(3),
          _cNum(r['expected_consumption_qty']).toStringAsFixed(3),
          _cNum(r['actual_consumption_qty']).toStringAsFixed(3),
          _cNum(r['variance_qty']).toStringAsFixed(3),
          _cNum(r['cost_price']).toStringAsFixed(2),
          _cNum(r['expected_cost']).toStringAsFixed(2),
          _cNum(r['actual_cost']).toStringAsFixed(2),
          _cNum(r['variance_cost']).toStringAsFixed(2),
        ]));
      }

      // Unmatched POS Items
      final unmatched = ((data['unmatched_pos_items'] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();
      if (unmatched.isNotEmpty) {
        buffer.writeln();
        buffer
            .writeln(_csvRow(['POS ITEMS NEEDING FOOD-CONTROL CONFIGURATION']));
        buffer.writeln(_csvRow(['Item Name', 'Portions Sold']));
        for (final u in unmatched) {
          buffer.writeln(_csvRow([
            '${u['item_name'] ?? ''}',
            _cNum(u['portions_sold']).toStringAsFixed(2),
          ]));
        }
      }

      // Wastage section
      final rawWastage = data['wastage'];
      if (rawWastage is Map) {
        final w = Map<String, dynamic>.from(rawWastage);
        final approved = _cNum(w['approved_cost']);
        final pending = _cNum(w['pending_cost']);
        if (approved > 0 || pending > 0) {
          buffer.writeln();
          buffer.writeln(_csvRow(['WASTAGE / SPOILAGE SUMMARY']));
          buffer
              .writeln(_csvRow(['Approved Cost (KES)', 'Pending Cost (KES)']));
          buffer.writeln(_csvRow(
              [approved.toStringAsFixed(2), pending.toStringAsFixed(2)]));
        }
      }

      final directory = await getDownloadsDirectory() ??
          await getApplicationDocumentsDirectory();
      File file = File('${directory.path}/$filename');
      try {
        await file.writeAsString(buffer.toString(), flush: true);
      } on FileSystemException catch (_) {
        final ts = DateFormat('HHmmss').format(DateTime.now());
        final dotIdx = filename.lastIndexOf('.');
        final altName = dotIdx != -1
            ? '${filename.substring(0, dotIdx)}_$ts${filename.substring(dotIdx)}'
            : '${filename}_$ts.csv';
        file = File('${directory.path}/$altName');
        await file.writeAsString(buffer.toString(), flush: true);
      }

      if (!mounted) return;
      _showExportSuccessSnackBar('CSV file exported: ${file.path}', file);
    } catch (e) {
      debugPrint('Error exporting CSV: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to export CSV: $e'),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  String _csvCell(Object? value) {
    var text = '${value ?? ''}'.replaceAll('\r', ' ').replaceAll('\n', ' ');
    if (text.startsWith('=') ||
        text.startsWith('+') ||
        text.startsWith('-') ||
        text.startsWith('@')) {
      text = "'$text";
    }
    return '"${text.replaceAll('"', '""')}"';
  }

  String _csvRow(List<Object?> cells) => cells.map(_csvCell).join(',');

  void _showExportSuccessSnackBar(String message, File file) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded,
                color: Colors.white, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                message,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF047857),
        duration: const Duration(seconds: 8),
        action: SnackBarAction(
          label: 'OPEN FILE',
          textColor: Colors.white,
          onPressed: () => _openExportedFile(file),
        ),
      ),
    );
  }

  Future<void> _openExportedFile(File file) async {
    try {
      if (!kIsWeb && Platform.isWindows) {
        await Process.run('explorer.exe', [file.path]);
      } else {
        final uri = Uri.file(file.path);
        if (await canLaunchUrl(uri)) {
          await launchUrl(uri);
        }
      }
    } catch (e) {
      debugPrint('Could not open file: $e');
    }
  }
}
