import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/database/app_database.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/mobile_shell.dart';
import '../../data/repository.dart';
import 'mobile_barcode_scan_screen.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _stockTakeCategoryProvider = StateProvider<String>((ref) => 'All');
final _stockTakeLinesProvider =
    StateProvider<List<_StockTakeLine>>((ref) => const []);
final _stockTakeSessionIdProvider =
    StateProvider<String>((ref) => const Uuid().v4());

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

class _StockTakeLine {
  _StockTakeLine({
    required this.localId,
    required this.itemId,
    required this.itemSku,
    required this.itemName,
    required this.itemUnit,
    required this.category,
    required this.systemStock,
    required this.physicalCount,
  });

  final String localId;
  final String itemId;
  final String itemSku;
  final String itemName;
  final String itemUnit;
  final String category;
  final double systemStock;
  double physicalCount;

  double get variance => physicalCount - systemStock;
  double get variancePct =>
      systemStock == 0 ? 0 : (variance / systemStock * 100);
  bool get isLow => variancePct < -5;
  bool get isExcess => variancePct > 5;

  _StockTakeLine copyWith({double? physicalCount}) {
    return _StockTakeLine(
      localId: localId,
      itemId: itemId,
      itemSku: itemSku,
      itemName: itemName,
      itemUnit: itemUnit,
      category: category,
      systemStock: systemStock,
      physicalCount: physicalCount ?? this.physicalCount,
    );
  }

  Map<String, dynamic> toApiMap() => {
        'item_id': itemId,
        'sku': itemSku,
        'system_quantity': systemStock,
        'physical_quantity': physicalCount,
        'variance': variance,
      };
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/// Mobile Physical Inventory Stock Take.
/// Categories: All / Foodstuffs / Bar / Stationery / General
/// Flow: scan barcode → enter physical count → view variance → submit.
class MobileStockTakeScreen extends ConsumerStatefulWidget {
  const MobileStockTakeScreen({super.key});

  @override
  ConsumerState<MobileStockTakeScreen> createState() =>
      _MobileStockTakeScreenState();
}

class _MobileStockTakeScreenState
    extends ConsumerState<MobileStockTakeScreen> {
  bool _submitting = false;

  static const _categories = [
    'All',
    'Foodstuffs',
    'Bar',
    'Stationery',
    'General',
  ];

  void _addScannedItem(Map<String, dynamic> item) {
    final itemId = item['id']?.toString() ?? '';
    final sku = item['sku']?.toString() ?? '';
    final name = item['name'] ?? item['item_name'] ?? 'Unknown';
    final unit = item['unit']?.toString() ?? 'pcs';
    final category = item['category']?.toString() ?? 'General';
    final sysStock = _toDouble(item['current_stock'] ?? item['quantity'] ?? 0);

    final lines = ref.read(_stockTakeLinesProvider);
    final idx = lines.indexWhere((l) => l.itemSku == sku);

    if (idx >= 0) {
      // Already counted — bump count by 1
      final updated = List<_StockTakeLine>.from(lines);
      updated[idx] = lines[idx]
          .copyWith(physicalCount: lines[idx].physicalCount + 1);
      ref.read(_stockTakeLinesProvider.notifier).state = updated;
      HapticFeedback.mediumImpact();
      return;
    }

    final newLine = _StockTakeLine(
      localId: const Uuid().v4(),
      itemId: itemId,
      itemSku: sku,
      itemName: name,
      itemUnit: unit,
      category: category,
      systemStock: sysStock,
      physicalCount: 1,
    );

    ref.read(_stockTakeLinesProvider.notifier).state = [...lines, newLine];
    HapticFeedback.mediumImpact();
  }

  double _toDouble(dynamic v) {
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0.0;
  }

  void _openScanner() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => UncontrolledProviderScope(
          container: ProviderScope.containerOf(context),
          child: MobileBarcodeScanScreen(
            onItemScanned: (item, action) {
              if (action == 'stock_take' || action == 'grn') {
                _addScannedItem(item);
              }
            },
          ),
        ),
      ),
    );
  }

  Future<void> _submitStockTake() async {
    final lines = ref.read(_stockTakeLinesProvider);
    if (lines.isEmpty) {
      if (mounted) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Scan items before finalising stock take.'), backgroundColor: AppColors.kError)); }
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Finalise Stock Take',
            style: TextStyle(fontFamily: 'SF Pro Display')),
        content: Text(
          'Submit ${lines.length} item(s)? This cannot be undone.',
          style: const TextStyle(fontFamily: 'SF Pro Display'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kPrimary),
            child: const Text('Finalise',
                style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _submitting = true);
    try {
      final repo = ref.read(storeRepositoryProvider);
      final sessionId = ref.read(_stockTakeSessionIdProvider);

      await repo.submitStockTake({
        'session_id': sessionId,
        'items': lines.map((l) => l.toApiMap()).toList(),
      });

      // Persist to local DB (already synced)
      final db = ref.read(appDatabaseProvider);
      for (final line in lines) {
        await db.scanSessionsDao.insertScan(ScanSessionEntry(
          localId: line.localId,
          sessionType: 'stock_take',
          sessionRef: sessionId,
          barcode: line.itemSku,
          itemId: line.itemId,
          itemSku: line.itemSku,
          itemName: line.itemName,
          itemUnit: line.itemUnit,
          scannedQuantity: line.physicalCount,
          systemStock: line.systemStock,
          scannedAt: DateTime.now().millisecondsSinceEpoch,
          synced: true,
        ));
      }

      // Reset session
      ref.read(_stockTakeLinesProvider.notifier).state = [];
      ref.read(_stockTakeSessionIdProvider.notifier).state =
          const Uuid().v4();

      if (mounted) {
        if (mounted) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Stock take submitted!'), backgroundColor: AppColors.kSuccess)); }
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        if (mounted) { ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Submission failed: $e'), backgroundColor: AppColors.kError)); }
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lines = ref.watch(_stockTakeLinesProvider);
    final category = ref.watch(_stockTakeCategoryProvider);

    final filtered = category == 'All'
        ? lines
        : lines
            .where((l) =>
                l.category.toLowerCase() == category.toLowerCase())
            .toList();

    final totalLines = lines.length;
    final discrepancies =
        lines.where((l) => l.isLow || l.isExcess).length;

    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        backgroundColor: AppColors.kPrimary,
        title: const Text(
          'Stock Take',
          style: TextStyle(
            color: Colors.white,
            fontFamily: 'SF Pro Display',
            fontWeight: FontWeight.w700,
          ),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        actions: [
          if (lines.isNotEmpty)
            TextButton(
              onPressed: _submitting ? null : _submitStockTake,
              child: _submitting
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Text(
                      'Submit ($totalLines)',
                      style: const TextStyle(
                        color: AppColors.kAccent,
                        fontWeight: FontWeight.w700,
                        fontFamily: 'SF Pro Display',
                      ),
                    ),
            ),
        ],
      ),
      body: Column(
        children: [
          // Summary bar
          if (totalLines > 0)
            Container(
              color: AppColors.kCardBg,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  _SummaryPill(
                      label: 'Scanned',
                      value: '$totalLines',
                      color: AppColors.kPrimary),
                  const SizedBox(width: 10),
                  _SummaryPill(
                      label: 'Discrepancies',
                      value: '$discrepancies',
                      color: discrepancies > 0
                          ? AppColors.kError
                          : AppColors.kSuccess),
                ],
              ),
            ),

          // Category filter chips
          Container(
            color: AppColors.kCardBg,
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: _categories
                  .map((c) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(c,
                              style: const TextStyle(
                                  fontFamily: 'SF Pro Display',
                                  fontSize: 12)),
                          selected: category == c,
                          selectedColor: AppColors.kPrimary,
                          labelStyle: TextStyle(
                            color: category == c
                                ? Colors.white
                                : AppColors.kTextSecondary,
                          ),
                          onSelected: (_) => ref
                              .read(_stockTakeCategoryProvider.notifier)
                              .state = c,
                        ),
                      ))
                  .toList(),
            ),
          ),

          // Items list
          Expanded(
            child: filtered.isEmpty
                ? MobileEmptyState(
                    icon: PhosphorIcons.clipboardText(),
                    title: lines.isEmpty
                        ? 'No items counted yet'
                        : 'No items in "$category"',
                    subtitle: lines.isEmpty
                        ? 'Tap the scan button to start counting inventory'
                        : 'Scan items in this category or switch to "All"',
                    action: lines.isEmpty
                        ? _ScanFab(onTap: _openScanner)
                        : null,
                  )
                : ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: filtered.length,
                    itemBuilder: (_, i) {
                      final line = filtered[i];
                      final globalIdx =
                          lines.indexWhere((l) => l.localId == line.localId);
                      return _StockTakeLineCard(
                        line: line,
                        onUpdate: (updated) {
                          if (globalIdx >= 0) {
                            final list = List<_StockTakeLine>.from(lines);
                            list[globalIdx] = updated;
                            ref
                                .read(_stockTakeLinesProvider.notifier)
                                .state = list;
                          }
                        },
                        onRemove: () {
                          if (globalIdx >= 0) {
                            final list = List<_StockTakeLine>.from(lines)
                              ..removeAt(globalIdx);
                            ref
                                .read(_stockTakeLinesProvider.notifier)
                                .state = list;
                          }
                        },
                      );
                    },
                  ),
          ),

          // Scan FAB
          if (lines.isNotEmpty)
            SafeArea(
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: _ScanFab(onTap: _openScanner),
              ),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Stock Take Line Card
// ---------------------------------------------------------------------------

class _StockTakeLineCard extends StatefulWidget {
  const _StockTakeLineCard({
    required this.line,
    required this.onUpdate,
    required this.onRemove,
  });

  final _StockTakeLine line;
  final void Function(_StockTakeLine) onUpdate;
  final VoidCallback onRemove;

  @override
  State<_StockTakeLineCard> createState() => _StockTakeLineCardState();
}

class _StockTakeLineCardState extends State<_StockTakeLineCard> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(
        text: widget.line.physicalCount.toStringAsFixed(0));
  }

  @override
  void didUpdateWidget(_StockTakeLineCard old) {
    super.didUpdateWidget(old);
    if (old.line.physicalCount != widget.line.physicalCount) {
      _ctrl.text = widget.line.physicalCount.toStringAsFixed(0);
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Color get _varianceColor {
    if (widget.line.isLow) return AppColors.kError;
    if (widget.line.isExcess) return AppColors.kWarning;
    return AppColors.kSuccess;
  }

  String get _varianceLabel {
    final v = widget.line.variancePct;
    final sign = v >= 0 ? '+' : '';
    return '$sign${v.toStringAsFixed(1)}%';
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: _varianceColor.withOpacity(0.3),
          width: 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 6,
                  height: 36,
                  decoration: BoxDecoration(
                    color: _varianceColor,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.line.itemName,
                        style: const TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          fontFamily: 'SF Pro Display',
                          color: AppColors.kTextPrimary,
                        ),
                      ),
                      Text(
                        'SKU: ${widget.line.itemSku} · ${widget.line.category}',
                        style: const TextStyle(
                          fontSize: 11,
                          color: AppColors.kTextSecondary,
                          fontFamily: 'SF Pro Display',
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: widget.onRemove,
                  icon: Icon(PhosphorIcons.trash(),
                      color: AppColors.kError, size: 18),
                  constraints: const BoxConstraints(),
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                // System stock (read-only)
                Expanded(
                  child: Column(
                    children: [
                      Text(
                        widget.line.systemStock.toStringAsFixed(0),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.kTextSecondary,
                          fontFamily: 'SF Pro Display',
                        ),
                      ),
                      const Text(
                        'System',
                        style: TextStyle(
                          fontSize: 10,
                          color: AppColors.kTextSecondary,
                          fontFamily: 'SF Pro Display',
                        ),
                      ),
                    ],
                  ),
                ),
                // Arrow
                Icon(
                  PhosphorIcons.caretRight(),
                  size: 16,
                  color: AppColors.kTextSecondary,
                ),
                // Physical count (editable)
                Expanded(
                  child: Column(
                    children: [
                      SizedBox(
                        width: 80,
                        child: TextField(
                          controller: _ctrl,
                          keyboardType:
                              const TextInputType.numberWithOptions(
                                  decimal: true),
                          textAlign: TextAlign.center,
                          onChanged: (v) {
                            final count = double.tryParse(v) ?? 0;
                            widget.onUpdate(
                                widget.line.copyWith(physicalCount: count));
                          },
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                                vertical: 4, horizontal: 8),
                            border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(6)),
                            filled: true,
                            fillColor: _varianceColor.withOpacity(0.06),
                          ),
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w700,
                            color: _varianceColor,
                            fontFamily: 'SF Pro Display',
                          ),
                        ),
                      ),
                      const Text(
                        'Physical',
                        style: TextStyle(
                          fontSize: 10,
                          color: AppColors.kTextSecondary,
                          fontFamily: 'SF Pro Display',
                        ),
                      ),
                    ],
                  ),
                ),
                // Variance badge
                Expanded(
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _varianceColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          _varianceLabel,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: _varianceColor,
                            fontFamily: 'SF Pro Display',
                          ),
                        ),
                      ),
                      const Text(
                        'Variance',
                        style: TextStyle(
                          fontSize: 10,
                          color: AppColors.kTextSecondary,
                          fontFamily: 'SF Pro Display',
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class _SummaryPill extends StatelessWidget {
  const _SummaryPill(
      {required this.label, required this.value, required this.color});

  final String label;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: RichText(
        text: TextSpan(
          children: [
            TextSpan(
              text: value,
              style: TextStyle(
                fontWeight: FontWeight.w700,
                fontSize: 13,
                color: color,
                fontFamily: 'SF Pro Display',
              ),
            ),
            TextSpan(
              text: ' $label',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.kTextSecondary,
                fontFamily: 'SF Pro Display',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ScanFab extends StatelessWidget {
  const _ScanFab({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: onTap,
        icon: Icon(Icons.qr_code_2, size: 20),
        label: const Text('Scan Item'),
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.kSuccess,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          textStyle: const TextStyle(
            fontFamily: 'SF Pro Display',
            fontWeight: FontWeight.w700,
            fontSize: 15,
          ),
        ),
      ),
    );
  }
}
