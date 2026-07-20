import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/widgets/sticky_horizontal_scrollbar.dart';
import '../../kitchen/data/repository.dart';
import '../../kitchen/domain/session_models.dart';
import '../../kitchen/domain/session_providers.dart';

class DailyControlsScreen extends ConsumerStatefulWidget {
  const DailyControlsScreen({super.key, this.onBack});

  final VoidCallback? onBack;

  @override
  ConsumerState<DailyControlsScreen> createState() => _DailyControlsScreenState();
}

class _DailyControlsScreenState extends ConsumerState<DailyControlsScreen> {
  String? _selectedShiftId;

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

        return FutureBuilder<Map<String, dynamic>>(
          future: ref
              .read(kitchenRepositoryProvider)
              .getDailyControlsReport(selectedShift.id),
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
                      ],
                    ),
                    const SizedBox(height: 24),
                    Expanded(
                      child: ListView(
                        padding: EdgeInsets.zero,
                        children: [
                          _buildFilterCard(sorted, selectedShift),
                          const SizedBox(height: 20),
                          if (loading)
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
                            _buildSheetCard(rows),
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
                    if (value == null) return;
                    setState(() => _selectedShiftId = value);
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

  Widget _buildSheetCard(List<Map<String, dynamic>> rows) {
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

    Widget value(dynamic value, {double? width, TextAlign align = TextAlign.left}) =>
        SizedBox(
          width: width,
          child: Text(
            value?.toString() ?? '-',
            textAlign: align,
            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
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
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, 12),
            child: Text(
              'Shift Control Sheet',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              'Expected consumption comes from the configured standards and shift-linked events. Actual consumption is derived from stock movement inside the shift ledger.',
              style: TextStyle(fontSize: 13, color: Colors.black54),
            ),
          ),
          const SizedBox(height: 16),
          StickyHorizontalScrollbar(
            contentWidth: 1910,
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
                    final varianceCost =
                        (row['variance_cost'] as num?)?.toDouble() ?? 0;
                    final background =
                        index.isEven ? const Color(0xFFF8FAFD) : Colors.white;

                    return Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 20, vertical: 16),
                      decoration: BoxDecoration(
                        color: background,
                        border: Border(
                          top: BorderSide(color: Colors.grey.shade200),
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          value(index, width: 48),
                          value(row['item_name'], width: 220),
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
                    );
                  }),
                const SizedBox(height: 18),
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
}
