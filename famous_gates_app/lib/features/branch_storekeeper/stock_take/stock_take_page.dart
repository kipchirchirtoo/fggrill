import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../../core/widgets/safe_avatar.dart';
import '../../auth/domain/auth_notifier.dart';
import 'models/stock_take_item.dart';
import 'providers/stock_take_provider.dart';
import 'widgets/filter_bar.dart';
import 'widgets/stock_table.dart';
import 'widgets/summary_card.dart';
import 'widgets/bottom_action_bar.dart';

class StockTakePage extends ConsumerStatefulWidget {
  final StockTakeType stockTakeType;
  final VoidCallback? onBack;

  const StockTakePage({
    super.key,
    required this.stockTakeType,
    this.onBack,
  });

  @override
  ConsumerState<StockTakePage> createState() => _StockTakePageState();
}

class _StockTakePageState extends ConsumerState<StockTakePage> {
  // Local filter states (copied from provider state when it changes,
  // but allowing changes before clicking 'Apply Filters')
  String _localSearch = '';
  String _localCategory = 'all';
  String _localLocation = '';
  String _localDate = DateTime.now().toIso8601String().split('T')[0]; // never empty
  bool _filtersInitialized = false;

  @override
  void initState() {
    super.initState();
    // Schedule initial load after build
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final provider = widget.stockTakeType == StockTakeType.bar
          ? barStockTakeProvider
          : storeStockTakeProvider;
      ref.read(provider.notifier).loadData();
    });
  }

  void _initializeFilters(StockTakeState state) {
    if (_filtersInitialized) return;
    _localLocation = state.locationFilter;
    _localDate = state.dateFilter;
    _filtersInitialized = true;
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    final provider = widget.stockTakeType == StockTakeType.bar
        ? barStockTakeProvider
        : storeStockTakeProvider;

    final state = ref.watch(provider);
    final notifier = ref.read(provider.notifier);

    // Sync filter states once loaded
    if (!state.isLoading && state.items.isNotEmpty) {
      _initializeFilters(state);
    }

    final user = ref.watch(authNotifierProvider).valueOrNull;
    final branchName = user?.branchName ?? 'Famous Gates';
    final isStorekeeper = user?.role == 'branch_storekeeper';

    final scopedItems = widget.stockTakeType == StockTakeType.store
        ? state.items.where((item) {
            return isAllowedStoreStocktakeItem(
              category: item.category,
              sku: item.sku,
              name: item.productName,
            );
          }).toList()
        : state.items;

    // Categories list for filter bar
    final categories =
        scopedItems.map((i) => i.category).toSet().toList()..sort();

    // Filter items based on local search & category (not date/location which require backend refresh)
    final filteredItems = scopedItems.where((item) {
      final matchesSearch = _localSearch.isEmpty ||
          item.productName.toLowerCase().contains(_localSearch.toLowerCase()) ||
          item.sku.toLowerCase().contains(_localSearch.toLowerCase());

      final matchesCategory = _localCategory == 'all' ||
          item.category.toLowerCase() == _localCategory.toLowerCase();

      return matchesSearch && matchesCategory;
    }).toList();

    final countedLines =
        filteredItems.where((item) => item.physicalCount != null).length;

    // Sort: BEERs first, then alphabetically by category then by name
    final sortedItems = List<StockTakeItem>.from(filteredItems)
      ..sort((a, b) {
        final catA = a.category;
        final catB = b.category;
        if (catA != catB) {
          if (catA == 'BEERS') return -1;
          if (catB == 'BEERS') return 1;
          return catA.compareTo(catB);
        }
        return a.productName.compareTo(b.productName);
      });

    // Summary calculations
    int totalOpening = 0;
    int totalSales = 0;
    int totalSdds = 0;
    double physicalCount = 0;
    double totalVariance = 0;

    for (final item in filteredItems) {
      totalOpening += item.openingStock;
      totalSales += item.sales;
      totalSdds += item.sdds;
      if (item.physicalCount != null) {
        physicalCount += item.physicalCount!;
        totalVariance += item.variance;
      }
    }
    final int expectedClosing = totalOpening - totalSales - totalSdds;

    // Show error message as a banner or snackbar if it changes
    if (state.errorMessage != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(state.errorMessage!),
            backgroundColor: const Color(0xFFD32F2F),
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: 'OK',
              textColor: Colors.white,
              onPressed: () => notifier.clearError(),
            ),
          ),
        );
        notifier.clearError();
      });
    }

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : const Color(0xFFF5F7FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1565C0), // Material 3 blue AppBar
        foregroundColor: Colors.white,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (widget.onBack != null) {
              widget.onBack!();
            } else {
              Navigator.pop(context);
            }
          },
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.stockTakeType == StockTakeType.bar
                  ? 'Bar Stock Take'
                  : 'Store Stock Take',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            Text(
              () {
                final shift = state.currentShift;
                final num = shift?['shift_number'];
                final cashier = shift?['cashier_name'];
                if (num != null) {
                  final c = cashier != null ? ' · $cashier' : '';
                  return '$branchName · Shift #$num$c';
                }
                return '$branchName · ${state.dateFilter}';
              }(),
              style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 12),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Download blank count sheet (PDF)',
            icon: const Icon(Icons.download_rounded),
            onPressed: (state.isLoading || sortedItems.isEmpty)
                ? null
                : () => _exportCountSheet(
                      context,
                      state,
                      sortedItems,
                      branchName,
                    ),
          ),
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: state.isLoading
                ? null
                : () {
                    notifier.loadData(
                      date: _localDate,
                      location: _localLocation,
                    );
                  },
          ),
          const SizedBox(width: 8),
          if (user != null)
            Padding(
              padding: const EdgeInsets.only(right: 16.0),
              child: SafeAvatar(
                imageUrl: user.avatar,
                name: user.name,
                radius: 16,
              ),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.only(bottom: 24),
        child: Column(
          children: [
            // Shift info banner — shows which cashier shift this stocktake is for (Only for Bar shifts)
            if (widget.stockTakeType == StockTakeType.bar && (state.currentShift != null || (!state.isLoading && state.items.isEmpty)))
              _buildShiftBanner(context, state),
            if (isStorekeeper)
              _buildBlindCountBanner(
                countedLines: countedLines,
                totalLines: filteredItems.length,
              ),
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: FilterBar(
                search: _localSearch,
                selectedCategory: _localCategory,
                categories: categories,
                selectedLocation: _localLocation.isEmpty
                    ? (widget.stockTakeType == StockTakeType.bar ? 'main_bar' : 'branch_store')
                    : _localLocation,
                hasExecutiveBar: state.hasExecutiveBar,
                selectedDate: _localDate.isEmpty
                    ? DateTime.now().toIso8601String().split('T')[0]
                    : _localDate,
                isBarType: widget.stockTakeType == StockTakeType.bar,
                onSearchChanged: (v) => setState(() => _localSearch = v),
                onCategoryChanged: (v) => setState(() => _localCategory = v),
                onLocationChanged: (v) => setState(() => _localLocation = v),
                onDateChanged: (v) => setState(() => _localDate = v),
                onApply: () {
                  notifier.loadData(
                    date: _localDate,
                    location: _localLocation,
                  );
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: state.isLoading
                  ? const SizedBox(
                      height: 320,
                      child: Center(child: CircularProgressIndicator()),
                    )
                  : StockTable(
                      items: sortedItems,
                      isReadOnly: state.isSubmitted,
                      isStorekeeper: isStorekeeper,
                      isStoreType: widget.stockTakeType == StockTakeType.store,
                      onPhysicalCountChanged: (id, val) {
                        notifier.updatePhysicalCount(id, val);
                      },
                      onReasonChanged: (id, val) {
                        notifier.updateReason(id, val);
                      },
                    ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
              child: SummaryCard(
                totalOpening: totalOpening,
                totalSales: totalSales,
                totalSdds: totalSdds,
                expectedClosing: expectedClosing,
                physicalCount: physicalCount,
                totalVariance: totalVariance,
                isStorekeeper: isStorekeeper,
                isStoreType: widget.stockTakeType == StockTakeType.store,
                totalItems: filteredItems.length,
                countedLines: countedLines,
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: BottomActionBar(
                isReadOnly: state.isSubmitted,
                isSubmitting: state.isSubmitting,
                onSaveDraft: () async {
                  await notifier.saveDraft();
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Stock take draft saved locally.'),
                        backgroundColor: Colors.teal,
                      ),
                    );
                  }
                },
                onSubmit: () => _confirmSubmit(context, state, notifier),
              ),
            ),
          ],
        ),
      ),
    );
  }
  void _executeSubmit(BuildContext context, StockTakeNotifier notifier, int varianceCount) async {
    final success = await notifier.submitStockTake();
    if (success && mounted) {
      final message = varianceCount > 0
          ? 'Stock take submitted. $varianceCount ${varianceCount == 1 ? 'item has a variance' : 'items have variances'} and ${varianceCount == 1 ? 'has' : 'have'} been sent to the accountant for review.'
          : 'Stock take submitted successfully!';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 6),
        ),
      );
    }
  }

  void _confirmSubmit(BuildContext context, StockTakeState state, StockTakeNotifier notifier) {
    final missingCounts = state.items.where((item) => item.physicalCount == null);
    if (missingCounts.isNotEmpty) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Row(
            children: [
              const Icon(Icons.warning_amber_rounded, color: Color(0xFFF9A825)),
              const SizedBox(width: 8),
              const Text('Missing Physical Counts'),
            ],
          ),
          content: Text(
            'Some items are missing physical counts. You must enter a count for every item before submitting.\n\n'
            'Missing:\n' +
            missingCounts.map((i) => '• ${i.productName}').join('\n'),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }

    final varianceCount = state.items.where((item) {
      if (item.physicalCount == null) return false;
      return item.physicalCount!.toDouble() != item.closingStock.toDouble();
    }).length;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Submit Stock Take'),
        content: const Text(
          'Are you sure you want to submit this stock take? Once submitted, it will be locked and sent to the Accountant for review.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              Navigator.pop(context);
              _executeSubmit(context, notifier, varianceCount);
            },
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF1565C0),
            ),
            child: const Text('Confirm & Submit'),
          ),
        ],
      ),
    );
  }

  Widget _buildBlindCountBanner({
    required int countedLines,
    required int totalLines,
  }) {
    final remaining = totalLines - countedLines < 0 ? 0 : totalLines - countedLines;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.fromLTRB(16, 16, 16, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.visibility_off_outlined,
              color: Color(0xFF1565C0),
            ),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Blind count mode',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'Only physical count is shown. Press Enter after each number to jump to the next line.',
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF475569),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '$countedLines / $totalLines counted · $remaining remaining',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: Color(0xFF334155),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildShiftBanner(BuildContext context, StockTakeState state) {
    final shift = state.currentShift;
    final bool hasShift = shift != null && shift['shift_id'] != null;

    if (!hasShift) {
      return Container(
        width: double.infinity,
        color: const Color(0xFFFFF3E0),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: Color(0xFFE65100), size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'No closed cashier shift found for ${state.dateFilter}. '
                'Stocktake will be saved without a shift link.',
                style: const TextStyle(color: Color(0xFFE65100), fontSize: 12),
              ),
            ),
          ],
        ),
      );
    }

    final shiftNum = shift['shift_number'];
    final cashierName = shift['cashier_name'];
    final openedAt = shift['shift_opened_at'];
    final closedAt = shift['shift_closed_at'];

    String timeRange = '';
    if (openedAt != null) {
      try {
        final open = DateTime.parse(openedAt.toString()).toLocal();
        final fmt = '${open.hour.toString().padLeft(2, '0')}:${open.minute.toString().padLeft(2, '0')}';
        timeRange = 'Opened $fmt';
        if (closedAt != null) {
          final close = DateTime.parse(closedAt.toString()).toLocal();
          final fmtC = '${close.hour.toString().padLeft(2, '0')}:${close.minute.toString().padLeft(2, '0')}';
          timeRange += ' \u2013 $fmtC';
        }
      } catch (_) {}
    }

    return Container(
      width: double.infinity,
      color: const Color(0xFFE8F5E9),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      child: Row(
        children: [
          const Icon(Icons.schedule_rounded, color: Color(0xFF2E7D32), size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: RichText(
              text: TextSpan(
                style: const TextStyle(color: Color(0xFF1B5E20), fontSize: 12),
                children: [
                  TextSpan(
                    text: 'Shift #${shiftNum ?? '—'}',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  if (cashierName != null)
                    TextSpan(text: '  \u00b7  Cashier: $cashierName'),
                  if (timeRange.isNotEmpty)
                    TextSpan(text: '  \u00b7  $timeRange'),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Printable BLANK count sheet (branded PDF).
  //
  // Mirrors exactly what's on screen — same category grouping and order — but
  // with empty boxes for Actual Count / Sold / Total Sales so the count can be
  // done on paper first and keyed into the system after. Header carries the
  // cashier / shift / date / start & end times; the bottom has Credit Bills and
  // Paid Bills sections (10 lines each).
  // ---------------------------------------------------------------------------
  Future<void> _exportCountSheet(
    BuildContext context,
    StockTakeState state,
    List<StockTakeItem> items,
    String branchName,
  ) async {
    try {
      final bytes = await _buildCountSheetPdf(state, items, branchName);
      final isBar = widget.stockTakeType == StockTakeType.bar;
      final label = isBar ? 'Bar' : 'Store';
      // Save straight to the Downloads folder (falls back to app documents).
      final dir =
          await getDownloadsDirectory() ?? await getApplicationDocumentsDirectory();
      final safeName =
          '${label}_Stocktake_${state.dateFilter}.pdf'.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
      final file = File('${dir.path}/$safeName');
      await file.writeAsBytes(bytes, flush: true);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Count sheet downloaded to ${file.path}'),
          backgroundColor: const Color(0xFF2E7D32),
          duration: const Duration(seconds: 6),
        ),
      );
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not download count sheet: $error'),
          backgroundColor: const Color(0xFFD32F2F),
        ),
      );
    }
  }

  Future<pw.MemoryImage?> _loadBrandLogo() async {
    try {
      final data = await rootBundle.load('assets/frontend_public/fglogo.png');
      return pw.MemoryImage(data.buffer.asUint8List());
    } catch (_) {
      return null;
    }
  }

  String _fmtPdfTime(dynamic iso) {
    if (iso == null) return '';
    try {
      final d = DateTime.parse(iso.toString()).toLocal();
      return '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }

  Future<Uint8List> _buildCountSheetPdf(
    StockTakeState state,
    List<StockTakeItem> items,
    String branchName,
  ) async {
    final doc = pw.Document();
    final logo = await _loadBrandLogo();
    const primary = PdfColor.fromInt(0xFF173D5F);
    const muted = PdfColor.fromInt(0xFF667085);
    const border = PdfColor.fromInt(0xFFD0D5DD);
    const soft = PdfColor.fromInt(0xFFF7F9FC);

    final isBar = widget.stockTakeType == StockTakeType.bar;
    final sheetTitle = isBar ? 'BAR STOCK TAKE' : 'STORE STOCK TAKE';
    final shift = state.currentShift;
    final cashier = shift?['cashier_name']?.toString() ?? '';
    final shiftNo = shift?['shift_number']?.toString() ?? '';
    final startTime = _fmtPdfTime(shift?['shift_opened_at']);
    final endTime = _fmtPdfTime(shift?['shift_closed_at']);
    final location = (_localLocation.isEmpty
            ? (isBar ? 'main_bar' : 'branch_store')
            : _localLocation)
        .replaceAll('_', ' ')
        .toUpperCase();

    // Group items by category, preserving the on-screen order.
    final groups = <String, List<StockTakeItem>>{};
    for (final it in items) {
      groups
          .putIfAbsent(it.category.isEmpty ? 'OTHERS' : it.category, () => [])
          .add(it);
    }

    pw.Widget field(String label, String value, {double width = 150}) {
      return pw.Container(
        width: width,
        margin: const pw.EdgeInsets.only(right: 14, bottom: 8),
        child: pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Text(label.toUpperCase(),
                style: const pw.TextStyle(fontSize: 7, color: muted)),
            pw.SizedBox(height: 3),
            pw.Container(
              padding: const pw.EdgeInsets.only(bottom: 3),
              decoration: const pw.BoxDecoration(
                border: pw.Border(
                    bottom: pw.BorderSide(color: primary, width: 0.8)),
              ),
              child: pw.Text(value.isEmpty ? ' ' : value,
                  style:
                      pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold)),
            ),
          ],
        ),
      );
    }

    // Returns the category header and its table as SEPARATE widgets (not a
    // Column) so MultiPage can split a long category across pages — a Column
    // is unsplittable and overflows a short landscape page (TooManyPages).
    List<pw.Widget> categoryTable(String category, List<StockTakeItem> rows) {
      final headers = isBar
          ? const [
              '#',
              'ITEM',
              'SKU',
              'ACTUAL COUNT',
              'SOLD',
              'TOTAL SALES',
            ]
          : const [
              '#',
              'ITEM',
              'SKU',
              'ACTUAL COUNT',
              'REMARKS / NOTES',
            ];

      final tableData = [
        for (var i = 0; i < rows.length; i++)
          if (isBar)
            [
              '${i + 1}',
              rows[i].productName,
              rows[i].sku,
              '',
              '',
              '',
            ]
          else
            [
              '${i + 1}',
              rows[i].productName,
              rows[i].sku,
              '',
              '',
            ],
      ];

      final colWidths = isBar
          ? {
              0: const pw.FixedColumnWidth(22),
              1: const pw.FlexColumnWidth(3),
              2: const pw.FlexColumnWidth(2),
              3: const pw.FlexColumnWidth(1.4),
              4: const pw.FlexColumnWidth(1.2),
              5: const pw.FlexColumnWidth(1.4),
            }
          : {
              0: const pw.FixedColumnWidth(22),
              1: const pw.FlexColumnWidth(3.5),
              2: const pw.FlexColumnWidth(2),
              3: const pw.FlexColumnWidth(1.8),
              4: const pw.FlexColumnWidth(2.5),
            };

      final alignments = isBar
          ? {
              0: pw.Alignment.centerLeft,
              1: pw.Alignment.centerLeft,
              2: pw.Alignment.centerLeft,
              3: pw.Alignment.center,
              4: pw.Alignment.center,
              5: pw.Alignment.center,
            }
          : {
              0: pw.Alignment.centerLeft,
              1: pw.Alignment.centerLeft,
              2: pw.Alignment.centerLeft,
              3: pw.Alignment.center,
              4: pw.Alignment.centerLeft,
            };

      return [
          pw.Container(
            width: double.infinity,
            margin: const pw.EdgeInsets.only(top: 12, bottom: 4),
            padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            color: primary,
            child: pw.Text('$category  (${rows.length})',
                style: pw.TextStyle(
                    color: PdfColors.white,
                    fontSize: 9,
                    fontWeight: pw.FontWeight.bold)),
          ),
          pw.TableHelper.fromTextArray(
            border: pw.TableBorder.all(color: border, width: 0.5),
            headers: headers,
            data: tableData,
            headerStyle: pw.TextStyle(
                color: primary, fontWeight: pw.FontWeight.bold, fontSize: 7.5),
            headerDecoration: const pw.BoxDecoration(color: soft),
            cellStyle: const pw.TextStyle(fontSize: 8),
            cellHeight: 20,
            cellPadding:
                const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 3),
            columnWidths: colWidths,
            cellAlignments: alignments,
          ),
      ];
    }

    pw.Widget billsBlock(String title) {
      return pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Container(
            width: double.infinity,
            margin: const pw.EdgeInsets.only(bottom: 4),
            padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            color: primary,
            child: pw.Text(title,
                style: pw.TextStyle(
                    color: PdfColors.white,
                    fontSize: 9,
                    fontWeight: pw.FontWeight.bold)),
          ),
          pw.TableHelper.fromTextArray(
            border: pw.TableBorder.all(color: border, width: 0.5),
            headers: const ['#', 'CUSTOMER / BILL REF', 'AMOUNT (KES)'],
            data: [
              for (var i = 1; i <= 10; i++) ['$i', '', ''],
            ],
            headerStyle: pw.TextStyle(
                color: primary, fontWeight: pw.FontWeight.bold, fontSize: 7.5),
            headerDecoration: const pw.BoxDecoration(color: soft),
            cellStyle: const pw.TextStyle(fontSize: 8),
            cellHeight: 18,
            cellPadding:
                const pw.EdgeInsets.symmetric(horizontal: 4, vertical: 3),
            columnWidths: {
              0: const pw.FixedColumnWidth(22),
              1: const pw.FlexColumnWidth(3),
              2: const pw.FlexColumnWidth(1.6),
            },
            cellAlignments: {
              0: pw.Alignment.centerLeft,
              1: pw.Alignment.centerLeft,
              2: pw.Alignment.centerRight,
            },
          ),
        ],
      );
    }

    doc.addPage(
      pw.MultiPage(
        pageFormat: PdfPageFormat.a4.landscape,
        margin: const pw.EdgeInsets.fromLTRB(30, 28, 30, 30),
        footer: (context) => pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text('FamousGate Hotels · $sheetTitle Count Sheet',
                style:
                    const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey600)),
            pw.Text('Page ${context.pageNumber} of ${context.pagesCount}',
                style:
                    const pw.TextStyle(fontSize: 7.5, color: PdfColors.grey600)),
          ],
        ),
        build: (context) => [
          // Branded header
          pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              if (logo != null)
                pw.Image(logo, width: 58, height: 58, fit: pw.BoxFit.contain)
              else
                pw.Text('FG',
                    style: pw.TextStyle(
                        fontSize: 22,
                        fontWeight: pw.FontWeight.bold,
                        color: primary)),
              pw.SizedBox(width: 14),
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    pw.Text(branchName,
                        style: pw.TextStyle(
                            fontSize: 13,
                            fontWeight: pw.FontWeight.bold,
                            color: primary)),
                    pw.Text('$sheetTitle - COUNT SHEET',
                        style: pw.TextStyle(
                            fontSize: 15, fontWeight: pw.FontWeight.bold)),
                    pw.Text('$location · ${state.dateFilter}',
                        style: const pw.TextStyle(fontSize: 9, color: muted)),
                  ],
                ),
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text('Items: ${items.length}',
                      style: const pw.TextStyle(fontSize: 9, color: muted)),
                  if (shiftNo.isNotEmpty && isBar)
                    pw.Text('Shift #$shiftNo',
                        style: pw.TextStyle(
                            fontSize: 11, fontWeight: pw.FontWeight.bold)),
                ],
              ),
            ],
          ),
          pw.SizedBox(height: 12),
          pw.Container(height: 1, color: border),
          pw.SizedBox(height: 12),
          // Fill-in header fields
          pw.Wrap(children: [
            if (isBar) ...[
              field('Cashier Name', cashier, width: 165),
              field('Shift No.', shiftNo, width: 70),
            ],
            field('Date', state.dateFilter, width: 100),
            if (isBar) ...[
              field('Shift Start Time', startTime, width: 110),
              field('Shift End Time', endTime, width: 110),
            ],
            field(isBar ? 'Counted By (Bar Storekeeper)' : 'Counted By (Branch Storekeeper)', '', width: 160),
            field('Verified By (Auditor)', '', width: 160),
          ]),
          pw.SizedBox(height: 4),
          // Category-grouped item tables
          for (final entry in groups.entries)
            ...categoryTable(entry.key, entry.value),
          pw.SizedBox(height: 18),
          // Bills sections at the bottom (ONLY for Bar stocktake shifts, NOT for Store Stocktake)
          if (isBar) ...[
            billsBlock('CREDIT BILLS'),
            pw.SizedBox(height: 12),
            billsBlock('PAID BILLS'),
            pw.SizedBox(height: 24),
          ],
          pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              _pdfSignatureLine(isBar ? 'Counted By (Bar Storekeeper)' : 'Counted By (Branch Storekeeper)'),
              _pdfSignatureLine('Verified By (Auditor)'),
              _pdfSignatureLine('Accountant / Branch Manager'),
            ],
          ),
        ],
      ),
    );

    return doc.save();
  }

  pw.Widget _pdfSignatureLine(String label) {
    return pw.Container(
      width: 150,
      child: pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(height: 18),
          pw.Container(height: 0.8, color: PdfColors.black),
          pw.SizedBox(height: 4),
          pw.Text(label, style: const pw.TextStyle(fontSize: 8)),
        ],
      ),
    );
  }
}

