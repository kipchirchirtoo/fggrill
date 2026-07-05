import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

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

  const StockTakePage({
    super.key,
    required this.stockTakeType,
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

    // Categories list for filter bar
    final categories = state.items.map((i) => itemCategoryName(i)).toSet().toList()..sort();

    // Filter items based on local search & category (not date/location which require backend refresh)
    final filteredItems = state.items.where((item) {
      final matchesSearch = _localSearch.isEmpty ||
          item.productName.toLowerCase().contains(_localSearch.toLowerCase()) ||
          item.sku.toLowerCase().contains(_localSearch.toLowerCase());

      final matchesCategory = _localCategory == 'all' ||
          itemCategoryName(item).toLowerCase() == _localCategory.toLowerCase();

      return matchesSearch && matchesCategory;
    }).toList();

    // Sort items so beers are on one side (first), then other categories, and then by name
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
    int physicalCount = 0;
    int totalVariance = 0;

    for (final item in filteredItems) {
      totalOpening += item.openingStock;
      totalSales += item.sales;
      totalSdds += item.sdds;
      if (item.physicalCount != null) {
        physicalCount += item.physicalCount!;
        totalVariance += item.variance;
      }
    }
    int expectedClosing = totalOpening - totalSales - totalSdds;

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
          onPressed: () => Navigator.pop(context),
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
      body: Column(
        children: [
          // Shift info banner — shows which cashier shift this stocktake is for
          if (state.currentShift != null || (!state.isLoading && state.items.isEmpty))
            _buildShiftBanner(context, state),
          // Filter Bar
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

          // Main Spreadsheet Grid Area
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: state.isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : StockTable(
                      items: sortedItems,
                      isReadOnly: state.isSubmitted,
                      isStorekeeper: isStorekeeper,
                      onPhysicalCountChanged: (id, val) {
                        notifier.updatePhysicalCount(id, val);
                      },
                      onReasonChanged: (id, val) {
                        notifier.updateReason(id, val);
                      },
                    ),
            ),
          ),

          // Summary Section Card
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
            ),
          ),

          // Bottom Action Bar
          BottomActionBar(
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
        ],
      ),
    );
  }

  String itemCategoryName(StockTakeItem item) {
    return item.category;
  }

  void _confirmSubmit(BuildContext context, StockTakeState state, StockTakeNotifier notifier) {
    // Check if there are any variances without reasons
    final unexplained = state.items.where(
      (item) => item.physicalCount != null && item.variance != 0 && (item.reason == null || item.reason!.isEmpty),
    );

    if (unexplained.isNotEmpty) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: Row(
            children: [
              const Icon(Icons.error_outline, color: Color(0xFFD32F2F)),
              const SizedBox(width: 8),
              const Text('Validation Error'),
            ],
          ),
          content: Text(
            'All items with a variance must have an explanation reason selected before you can submit.\n\n'
            'Please select reasons for:\n' +
            unexplained.map((i) => '• ${i.productName}').join('\n'),
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

    // Confirmation dialog
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
            onPressed: () async {
              Navigator.pop(context);
              final success = await notifier.submitStockTake();
              if (success && context.mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Stock take submitted successfully!'),
                    backgroundColor: Colors.green,
                  ),
                );
              }
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
}

