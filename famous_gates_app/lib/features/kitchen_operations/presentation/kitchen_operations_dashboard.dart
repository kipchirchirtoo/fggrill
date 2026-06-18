import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/widgets.dart' hide DataColumn, DataRow;
import '../../../core/widgets/record_detail_screen.dart';
import '../data/repository.dart';

enum KitchenOperationsSection {
  overview,
  stock,
  requisitions,
  recipes,
  usage,
  wastage,
  foodControls,
  sessions,
  spoilage,
  shiftConfirmations,
}

enum KitchenFoodTab { rules, portions, expected, variance, reports }

class KitchenOperationsDashboard extends ConsumerStatefulWidget {
  const KitchenOperationsDashboard({
    super.key,
    this.initialSection = KitchenOperationsSection.overview,
    this.stockSku,
    this.initialFoodTab = KitchenFoodTab.rules,
    this.embedded = false,
  });

  final KitchenOperationsSection initialSection;
  final String? stockSku;
  final KitchenFoodTab initialFoodTab;
  final bool embedded;

  @override
  ConsumerState<KitchenOperationsDashboard> createState() =>
      _KitchenOperationsDashboardState();
}

class _KitchenOperationsDashboardState
    extends ConsumerState<KitchenOperationsDashboard> {
  late KitchenOperationsSection _section;
  late KitchenFoodTab _foodTab;
  late Future<_KitchenSnapshot> _future;

  String _stockSearch = '';
  String _transactionType = 'ALL';
  String _requisitionStatus = 'ALL';
  String _usageType = 'ALL';
  String _wastageReason = 'ALL';
  String _recipeSearch = '';
  String _selectedStockTab = 'levels';
  String? _detailSku;
  String _sessionShiftFilter = 'ALL';

  KitchenOpsRepository get _repo => ref.read(kitchenOpsRepositoryProvider);

  @override
  void initState() {
    super.initState();
    _section = widget.initialSection;
    _foodTab = widget.initialFoodTab;
    _detailSku = widget.stockSku;
    if (_detailSku != null) _selectedStockTab = 'detail';
    _future = _load();
  }

  @override
  void didUpdateWidget(covariant KitchenOperationsDashboard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialSection != widget.initialSection ||
        oldWidget.stockSku != widget.stockSku ||
        oldWidget.initialFoodTab != widget.initialFoodTab) {
      _section = widget.initialSection;
      _foodTab = widget.initialFoodTab;
      _detailSku = widget.stockSku;
      _selectedStockTab = _detailSku == null ? 'levels' : 'detail';
      _refresh();
    }
  }

  Future<_KitchenSnapshot> _load() async {
    final today = DateTime.now();
    final start = today.subtract(const Duration(days: 30));
    final startDate = _isoDate(start);
    final endDate = _isoDate(today);
    final results = await Future.wait<dynamic>([
      _safe(_repo.getDashboardStats(), <String, dynamic>{}),
      _safe(_repo.getStock(search: _stockSearch), <Map<String, dynamic>>[]),
      _safe(
        _repo.getLedger(
          transactionType: _transactionType,
          itemSku: _detailSku,
        ),
        <Map<String, dynamic>>[],
      ),
      _safe(_repo.getManualLedger(), <Map<String, dynamic>>[]),
      _safe(_repo.getStoreReceipts(), <Map<String, dynamic>>[]),
      _safe(_repo.getPortionTracking(), <Map<String, dynamic>>[]),
      _safe(_repo.getVarianceLogs(), <Map<String, dynamic>>[]),
      _safe(_repo.getRequisitions(status: _requisitionStatus),
          <Map<String, dynamic>>[]),
      _safe(_repo.getRecipes(), <Map<String, dynamic>>[]),
      _safe(_repo.getUsage(usageType: _usageType), <Map<String, dynamic>>[]),
      _safe(_repo.getWastage(reason: _wastageReason), <Map<String, dynamic>>[]),
      _safe(_repo.getFoodControls(), <Map<String, dynamic>>[]),
      _safe(_repo.getPortionStock(), <Map<String, dynamic>>[]),
      _safe(_repo.getExpectedPortions(), <Map<String, dynamic>>[]),
      _safe(_repo.getVarianceReasons(), <Map<String, dynamic>>[]),
      _safe(_repo.getVariance(), <Map<String, dynamic>>[]),
      _safe(_repo.getYieldReport(startDate: startDate, endDate: endDate),
          <Map<String, dynamic>>[]),
      _safe(_repo.getLossReport(startDate: startDate, endDate: endDate),
          <Map<String, dynamic>>[]),
      _safe(
          _repo.getProductionSessions(
              shiftType: _sessionShiftFilter == 'ALL'
                  ? null
                  : _sessionShiftFilter),
          <Map<String, dynamic>>[]),
      _safe(_repo.getRecipesWithIngredients(), <Map<String, dynamic>>[]),
      _safe(_repo.getKitchenStaff(), <Map<String, dynamic>>[]),
      _safe(_repo.getSpoilage(), <Map<String, dynamic>>[]),
      _safe(_repo.getShiftsPendingChefConfirmation(), <Map<String, dynamic>>[]),
    ]);
    return _KitchenSnapshot(
      stats: Map<String, dynamic>.from(results[0] as Map),
      stock: _rows(results[1]),
      ledger: _rows(results[2]),
      manualLedger: _rows(results[3]),
      receipts: _rows(results[4]),
      portionTracking: _rows(results[5]),
      varianceLogs: _rows(results[6]),
      requisitions: _rows(results[7]),
      recipes: _rows(results[8]),
      usage: _rows(results[9]),
      wastage: _rows(results[10]),
      foodControls: _rows(results[11]),
      portionStock: _rows(results[12]),
      expectedPortions: _rows(results[13]),
      varianceReasons: _rows(results[14]),
      variance: _rows(results[15]),
      yieldReport: _rows(results[16]),
      lossReport: _rows(results[17]),
      sessions: _rows(results[18]),
      recipesWithIngredients: _rows(results[19]),
      staffProfiles: _rows(results[20]),
      spoilage: _rows(results[21]),
      pendingShiftConfirmations: _rows(results[22]),
    );
  }

  Future<T> _safe<T>(Future<T> future, T fallback) async {
    try {
      return await future;
    } catch (error, stackTrace) {
      debugPrint('Kitchen operations load warning: $error');
      debugPrint('$stackTrace');
      return fallback;
    }
  }

  void _refresh() {
    setState(() {
      _future = _load();
    });
  }

  void _selectSection(KitchenOperationsSection section) {
    if (widget.embedded) {
      setState(() {
        _section = section;
        _detailSku = null;
        _selectedStockTab = 'levels';
        _future = _load();
      });
      return;
    }
    context.go(_pathFor(section));
  }

  String _pathFor(KitchenOperationsSection section) {
    switch (section) {
      case KitchenOperationsSection.overview:
        return '/kitchen-operations';
      case KitchenOperationsSection.stock:
        return '/kitchen-operations/stock';
      case KitchenOperationsSection.requisitions:
        return '/kitchen-operations/requisitions';
      case KitchenOperationsSection.recipes:
        return '/kitchen-operations/recipes';
      case KitchenOperationsSection.usage:
        return '/kitchen-operations/usage';
      case KitchenOperationsSection.wastage:
        return '/kitchen-operations/wastage';
      case KitchenOperationsSection.foodControls:
        return '/kitchen-operations/food-controls';
      case KitchenOperationsSection.sessions:
        return '/kitchen-operations/sessions';
      case KitchenOperationsSection.spoilage:
        return '/kitchen-operations/spoilage';
      case KitchenOperationsSection.shiftConfirmations:
        return '/kitchen-operations/shift-confirmations';
    }
  }

  @override
  Widget build(BuildContext context) {
    final content = FutureBuilder<_KitchenSnapshot>(
      key: ValueKey(
        '${_section.name}-$_stockSearch-$_transactionType-$_requisitionStatus-$_usageType-$_wastageReason-$_detailSku-$_foodTab',
      ),
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
          return const Padding(
            padding: EdgeInsets.all(24),
            child: LoadingSkeleton(type: SkeletonType.list),
          );
        }
        if (snapshot.hasError) {
          return ErrorState(
            message: '${snapshot.error}',
            onRetry: _refresh,
          );
        }
        final data = snapshot.data ?? _KitchenSnapshot.empty();
        return _buildSection(data);
      },
    );
    if (widget.embedded) return content;

    return MasterDashboardShell<KitchenOperationsSection>(
      title: 'Kitchen Operations',
      subtitle: 'Stock, recipes and food controls',
      initials: 'KO',
      breadcrumbRoot: 'Kitchen Operations',
      searchHint: 'Search SKU, recipe, requisition...',
      currentSection: _section,
      items: const [
        MasterNavItem(
          section: KitchenOperationsSection.overview,
          label: 'Overview',
          icon: Icons.dashboard_outlined,
          group: 'Kitchen',
        ),
        MasterNavItem(
          section: KitchenOperationsSection.stock,
          label: 'Stock Ledger',
          icon: Icons.inventory_2_outlined,
          group: 'Kitchen',
        ),
        MasterNavItem(
          section: KitchenOperationsSection.requisitions,
          label: 'Request Stock',
          icon: Icons.shopping_cart_outlined,
          group: 'Kitchen',
        ),
        MasterNavItem(
          section: KitchenOperationsSection.recipes,
          label: 'Recipes & BOM',
          icon: Icons.menu_book_outlined,
          group: 'Production',
        ),
        MasterNavItem(
          section: KitchenOperationsSection.usage,
          label: 'Usage Tracking',
          icon: Icons.playlist_add_check_outlined,
          group: 'Production',
        ),
        MasterNavItem(
          section: KitchenOperationsSection.sessions,
          label: 'Kitchen Sessions',
          icon: Icons.soup_kitchen_outlined,
          group: 'Shifts',
        ),
        MasterNavItem(
          section: KitchenOperationsSection.shiftConfirmations,
          label: 'Shift Confirmations',
          icon: Icons.fact_check,
          group: 'Shifts',
        ),
        MasterNavItem(
          section: KitchenOperationsSection.spoilage,
          label: 'Spoilage',
          icon: Icons.warning_amber_outlined,
          group: 'Shifts',
        ),
        MasterNavItem(
          section: KitchenOperationsSection.wastage,
          label: 'Record Wastage',
          icon: Icons.delete_outline,
          group: 'Controls',
        ),
        MasterNavItem(
          section: KitchenOperationsSection.foodControls,
          label: 'Food Controls',
          icon: Icons.fact_check_outlined,
          group: 'Controls',
        ),
      ],
      onSectionSelected: _selectSection,
      child: content,
    );
  }

  Widget _buildSection(_KitchenSnapshot data) {
    switch (_section) {
      case KitchenOperationsSection.overview:
        return _overview(data);
      case KitchenOperationsSection.stock:
        return _stock(data);
      case KitchenOperationsSection.requisitions:
        return _requisitions(data);
      case KitchenOperationsSection.recipes:
        return _recipes(data);
      case KitchenOperationsSection.usage:
        return _usage(data);
      case KitchenOperationsSection.wastage:
        return _wastage(data);
      case KitchenOperationsSection.foodControls:
        return _foodControls(data);
      case KitchenOperationsSection.sessions:
        return _sessions(data);
      case KitchenOperationsSection.spoilage:
        return _spoilage(data);
      case KitchenOperationsSection.shiftConfirmations:
        return _shiftConfirmations(data);
    }
  }

  Widget _overview(_KitchenSnapshot data) {
    final stats = data.stats;
    return _Page(
      title: 'Kitchen Operations',
      subtitle: 'Daily kitchen stock, requisitions, recipes and food controls.',
      actions: [
        _ActionButton(
          label: 'Refresh',
          icon: Icons.refresh,
          onPressed: _refresh,
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _StatTile('Receipts Today', _value(stats, ['receiptsToday'])),
              _StatTile('Usage Today', _value(stats, ['usageToday'])),
              _StatTile('Wastage Today', _value(stats, ['wastageToday'])),
              _StatTile('Wastage Value', _money(stats['wastageValue'])),
              _StatTile('Low Stock', _value(stats, ['lowStockCount'])),
            ],
          ),
          const SizedBox(height: 24),
          _SectionCard(
            title: 'Quick Actions',
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                _QuickAction(
                  icon: Icons.inventory_2_outlined,
                  label: 'Open Stock Ledger',
                  onTap: () => context.go('/kitchen-operations/stock'),
                ),
                _QuickAction(
                  icon: Icons.add_shopping_cart_outlined,
                  label: 'Request Stock',
                  onTap: () => context.go('/kitchen-operations/requisitions'),
                ),
                _QuickAction(
                  icon: Icons.menu_book_outlined,
                  label: 'Recipes & BOM',
                  onTap: () => context.go('/kitchen-operations/recipes'),
                ),
                _QuickAction(
                  icon: Icons.playlist_add_check_outlined,
                  label: 'Record Usage',
                  onTap: () => context.go('/kitchen-operations/usage'),
                ),
                _QuickAction(
                  icon: Icons.delete_outline,
                  label: 'Record Wastage',
                  onTap: () => context.go('/kitchen-operations/wastage'),
                ),
                _QuickAction(
                  icon: Icons.scale_outlined,
                  label: 'Food Controls',
                  onTap: () => context.go('/kitchen-operations/food-controls'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _SectionCard(
            title: 'Low Stock Watch',
            child: _SimpleRows(
              rows: data.stock
                  .where((row) =>
                      _num(row['current_balance']) <=
                      _num(row['reorder_level']))
                  .take(8)
                  .toList(),
              empty: 'No low-stock kitchen items found.',
              title: (row) => _value(row, ['item_name', 'item_sku']),
              subtitle: (row) =>
                  'Balance ${_value(row, ['current_balance'])} ${_value(row, [
                    'unit_of_measure'
                  ])} • Reorder ${_value(row, ['reorder_level'])}',
              trailing: (row) => TextButton(
                onPressed: () => _openSku(_value(row, ['item_sku'])),
                child: const Text('Ledger'),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stock(_KitchenSnapshot data) {
    final detailRows = _detailSku == null
        ? data.ledger
        : data.ledger
            .where((row) => _value(row, ['item_sku']) == _detailSku)
            .toList();
    return _Page(
      title: _detailSku == null ? 'Kitchen Stock Ledger' : 'SKU $_detailSku',
      subtitle:
          'Stock levels, manual daily ledger capture, transaction history and auditor submissions.',
      actions: [
        _ActionButton(
          label: 'Export PDF',
          icon: Icons.picture_as_pdf_outlined,
          onPressed: () => _export('kitchen_ledger'),
        ),
        _ActionButton(
          label: 'Capture Entry',
          icon: Icons.add,
          onPressed: () => _showManualLedgerDialog(data.stock),
          filled: true,
        ),
      ],
      child: Column(
        children: [
          _Toolbar(
            searchHint: 'Search item or SKU',
            searchValue: _stockSearch,
            onSearch: (value) {
              _stockSearch = value;
              _refresh();
            },
            filters: [
              _ChipSelect(
                value: _selectedStockTab,
                values: const {
                  'levels': 'Stock Levels',
                  'manual': 'Manual Ledger',
                  'receipts': 'Receipts',
                  'portion_tracking': 'Portion Tracking',
                  'variance_logs': 'Variance Logs',
                  'transactions': 'Transactions',
                  'detail': 'SKU Detail',
                },
                onChanged: (value) => setState(() => _selectedStockTab = value),
              ),
              _ChipSelect(
                value: _transactionType,
                values: const {
                  'ALL': 'All Movements',
                  'RECEIPT': 'Receipts',
                  'USAGE': 'Usage',
                  'WASTAGE': 'Wastage',
                  'ADJUSTMENT': 'Adjustments',
                },
                onChanged: (value) {
                  _transactionType = value;
                  _refresh();
                },
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_selectedStockTab == 'levels')
            _SimpleRows(
              rows: data.stock,
              empty: 'No kitchen stock items found.',
              title: (row) => _value(row, ['item_name', 'item_sku']),
              subtitle: (row) =>
                  'SKU ${_value(row, ['item_sku'])} • Balance ${_value(row, [
                    'current_balance'
                  ])} ${_value(row, [
                    'unit_of_measure'
                  ])} • Reorder ${_value(row, ['reorder_level'])}',
              trailing: (row) => TextButton(
                onPressed: () => _openSku(_value(row, ['item_sku'])),
                child: const Text('History'),
              ),
            )
          else if (_selectedStockTab == 'manual')
            _SimpleRows(
              rows: data.manualLedger,
              empty: 'No manual ledger entries found.',
              title: (row) => '${_value(row, [
                    'entry_number'
                  ])} • ${_value(row, ['item_name'])}',
              subtitle: (row) =>
                  '${_value(row, ['entry_date'])} • Open ${_value(row, [
                    'opening_balance'
                  ])}, Rec ${_value(row, [
                    'received_quantity'
                  ])}, Used ${_value(row, [
                    'used_quantity'
                  ])}, Waste ${_value(row, [
                    'wastage_quantity'
                  ])}, Close ${_value(row, ['closing_balance'])}',
              trailing: (row) => _RowActions(actions: [
                _RowAction(
                  'Edit',
                  Icons.edit_outlined,
                  () => _showManualLedgerDialog(data.stock, existing: row),
                ),
                if (_value(row, ['status']).toLowerCase() == 'draft')
                  _RowAction(
                    'Submit',
                    Icons.send_outlined,
                    () => _run(() => _repo.updateManualLedgerStatus(
                          '${row['id']}',
                          'submitted',
                        )),
                  ),
              ]),
            )
          else if (_selectedStockTab == 'receipts')
            _SimpleRows(
              rows: data.receipts,
              empty: 'No kitchen store receipts found.',
              title: (row) => '${_value(row, [
                    'receipt_number',
                    'id'
                  ])} • ${_value(row, ['supplier_name', 'source'])}',
              subtitle: (row) => '${_value(row, [
                    'receipt_date',
                    'created_at'
                  ])} • Items ${_value(row, [
                    'items_count',
                    'total_items'
                  ])} • Status ${_value(row, ['status'])}',
              trailing: (row) => _RowActions(actions: [
                _RowAction(
                  'Verify',
                  Icons.verified_outlined,
                  () => _run(() => _repo.verifyStoreReceipt(
                        '${row['id']}',
                        'verified',
                      )),
                ),
              ]),
            )
          else if (_selectedStockTab == 'portion_tracking')
            _SimpleRows(
              rows: data.portionTracking,
              empty: 'No portion tracking records found.',
              title: (row) =>
                  _value(row, ['portion_name', 'item_name', 'item_sku']),
              subtitle: (row) => '${_value(row, [
                    'tracking_date',
                    'created_at'
                  ])} • Produced ${_value(row, [
                    'produced_portions',
                    'portions_produced'
                  ])} • Sold ${_value(row, [
                    'sold_portions',
                    'portions_sold'
                  ])}',
            )
          else if (_selectedStockTab == 'variance_logs')
            _SimpleRows(
              rows: data.varianceLogs,
              empty: 'No kitchen variance logs found.',
              title: (row) => '${_value(row, [
                    'item_name',
                    'item_sku'
                  ])} • ${_value(row, ['variance_quantity', 'variance'])}',
              subtitle: (row) => '${_value(row, [
                    'created_at',
                    'variance_date'
                  ])} • ${_value(row, [
                    'reason',
                    'notes'
                  ])} • Status ${_value(row, ['status'])}',
              trailing: (row) => _RowActions(actions: [
                _RowAction(
                  'Approve',
                  Icons.check_circle_outline,
                  () => _run(() => _repo.approveVarianceLog(
                        '${row['id']}',
                        'approved',
                      )),
                ),
              ]),
            )
          else
            _SimpleRows(
              rows: _selectedStockTab == 'detail' ? detailRows : data.ledger,
              empty: 'No stock movements found.',
              title: (row) => '${_value(row, [
                    'transaction_type'
                  ])} • ${_value(row, ['item_name', 'item_sku'])}',
              subtitle: (row) => '${_value(row, [
                    'transaction_date',
                    'created_at'
                  ])} • In ${_value(row, ['quantity_in'])}, Out ${_value(row, [
                    'quantity_out'
                  ])}, Close ${_value(row, ['closing_balance'])} ${_value(row, [
                    'unit_of_measure'
                  ])} • ${_value(row, ['reference_type'])}',
              trailing: (row) => Text(_value(row, ['shift'])),
            ),
        ],
      ),
    );
  }

  Widget _requisitions(_KitchenSnapshot data) {
    return _Page(
      title: 'Kitchen Requisitions',
      subtitle:
          'Create, review, approve, reject and fulfill branch kitchen stock requests.',
      actions: [
        _ActionButton(
          label: 'New Requisition',
          icon: Icons.add,
          onPressed: () => _showRequisitionDialog(data.stock),
          filled: true,
        ),
      ],
      child: Column(
        children: [
          _Toolbar(
            filters: [
              _ChipSelect(
                value: _requisitionStatus,
                values: const {
                  'ALL': 'All',
                  'PENDING': 'Pending',
                  'APPROVED': 'Approved',
                  'FULFILLED': 'Fulfilled',
                  'REJECTED': 'Rejected',
                },
                onChanged: (value) {
                  _requisitionStatus = value;
                  _refresh();
                },
              ),
            ],
          ),
          const SizedBox(height: 16),
          _SimpleRows(
            rows: data.requisitions,
            empty: 'No requisitions found.',
            title: (row) => '${_value(row, [
                  'requisition_number',
                  'id'
                ])} • ${_value(row, ['priority'])}',
            subtitle: (row) =>
                'Status ${_value(row, ['status'])} • ${_value(row, [
                  'reason',
                  'notes'
                ])} • ${_value(row, ['requested_at', 'created_at'])}',
            trailing: (row) => _RowActions(actions: [
              _RowAction('Detail', Icons.visibility_outlined,
                  () => _showRequisitionDetail(row)),
              _RowAction('Activity', Icons.link_outlined,
                  () => _showRequisitionRelatedActivity(row)),
              if (_value(row, ['status']) == 'PENDING')
                _RowAction(
                  'Approve',
                  Icons.check_circle_outline,
                  () => _approveRequisition(row),
                ),
              if (_value(row, ['status']) == 'PENDING')
                _RowAction(
                  'Reject',
                  Icons.cancel_outlined,
                  () => _rejectRequisition(row),
                ),
              if (_value(row, ['status']) == 'APPROVED')
                _RowAction(
                  'Fulfill',
                  Icons.local_shipping_outlined,
                  () => _fulfillRequisition(row),
                ),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _recipes(_KitchenSnapshot data) {
    final rows = data.recipes.where((row) {
      if (_recipeSearch.trim().isEmpty) return true;
      return _value(row, ['menu_item_name', 'recipe_name', 'name'])
          .toLowerCase()
          .contains(_recipeSearch.toLowerCase());
    }).toList();
    return _Page(
      title: 'Recipes & BOM',
      subtitle:
          'Manage recipe ingredients, costs, active state, locks and automatic deductions.',
      actions: [
        _ActionButton(
          label: 'New Recipe',
          icon: Icons.add,
          onPressed: () => _showRecipeDialog(data.stock),
          filled: true,
        ),
      ],
      child: Column(
        children: [
          _Toolbar(
            searchHint: 'Search menu item',
            searchValue: _recipeSearch,
            onSearch: (value) => setState(() => _recipeSearch = value),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: rows.isEmpty
                ? [const EmptyState(message: 'No recipes found.')]
                : rows
                    .map((row) => _RecipeCard(
                          row: row,
                          onEdit: () =>
                              _showRecipeDialog(data.stock, existing: row),
                          onDelete: () => _confirm(
                            'Deactivate recipe?',
                            () => _repo.deleteRecipe('${row['id']}'),
                          ),
                          onLock: () => _run(() =>
                              _value(row, ['is_locked']) == 'true'
                                  ? _repo.unlockRecipe('${row['id']}')
                                  : _repo.lockRecipe('${row['id']}')),
                        ))
                    .toList(),
          ),
        ],
      ),
    );
  }

  Widget _usage(_KitchenSnapshot data) {
    return _Page(
      title: 'Usage Tracking',
      subtitle:
          'Manual kitchen usage capture with review and audit actions synced to stock ledger.',
      actions: [
        _ActionButton(
          label: 'Record Usage',
          icon: Icons.add,
          onPressed: () => _showUsageDialog(data.stock),
          filled: true,
        ),
      ],
      child: Column(
        children: [
          _Toolbar(
            filters: [
              _ChipSelect(
                value: _usageType,
                values: const {
                  'ALL': 'All Types',
                  'STAFF_MEAL': 'Staff Meal',
                  'COMPLIMENTARY': 'Complimentary',
                  'TEST': 'Test',
                  'SALES': 'Sales',
                  'OTHER': 'Other',
                },
                onChanged: (value) {
                  _usageType = value;
                  _refresh();
                },
              ),
            ],
          ),
          const SizedBox(height: 16),
          _SimpleRows(
            rows: data.usage,
            empty: 'No usage records found.',
            title: (row) => '${_value(row, [
                  'item_name',
                  'item_sku'
                ])} • ${_value(row, ['usage_type'])}',
            subtitle: (row) => '${_value(row, ['quantity'])} ${_value(row, [
                  'unit_of_measure'
                ])} • Shift ${_value(row, ['shift'])} • ${_value(row, [
                  'usage_date',
                  'created_at'
                ])} • ${_value(row, ['notes'])}',
            trailing: (row) => _RowActions(actions: [
              _RowAction(
                  'Review', Icons.fact_check_outlined, () => _reviewUsage(row)),
              _RowAction('Approve', Icons.verified_outlined,
                  () => _auditUsage(row, 'approved')),
              _RowAction('Reject', Icons.block_outlined,
                  () => _auditUsage(row, 'rejected')),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _wastage(_KitchenSnapshot data) {
    return _Page(
      title: 'Wastage',
      subtitle:
          'Capture wastage with value, reason, shift and review/audit controls.',
      actions: [
        _ActionButton(
          label: 'Record Wastage',
          icon: Icons.add,
          onPressed: () => _showWastageDialog(data.stock),
          filled: true,
        ),
      ],
      child: Column(
        children: [
          _Toolbar(
            filters: [
              _ChipSelect(
                value: _wastageReason,
                values: const {
                  'ALL': 'All Reasons',
                  'SPOILAGE': 'Spoilage',
                  'OVERCOOKING': 'Overcooking',
                  'CONTAMINATION': 'Contamination',
                  'EXPIRED': 'Expired',
                  'DROPPED': 'Dropped',
                  'OTHER': 'Other',
                },
                onChanged: (value) {
                  _wastageReason = value;
                  _refresh();
                },
              ),
            ],
          ),
          const SizedBox(height: 16),
          _SimpleRows(
            rows: data.wastage,
            empty: 'No wastage records found.',
            title: (row) => '${_value(row, [
                  'item_name',
                  'item_sku'
                ])} • ${_value(row, ['reason'])}',
            subtitle: (row) => '${_value(row, ['quantity'])} ${_value(row, [
                  'unit_of_measure'
                ])} • ${_money(row['estimated_value'])} • Shift ${_value(row, [
                  'shift'
                ])} • ${_value(row, ['wastage_date', 'created_at'])}',
            trailing: (row) => _RowActions(actions: [
              _RowAction('Edit', Icons.edit_outlined,
                  () => _showWastageDialog(data.stock, existing: row)),
              _RowAction('Review', Icons.fact_check_outlined,
                  () => _reviewWastage(row)),
              _RowAction('Approve', Icons.verified_outlined,
                  () => _auditWastage(row, 'approved')),
              _RowAction(
                  'Delete',
                  Icons.delete_outline,
                  () => _confirm('Delete wastage record?', () {
                        return _repo.deleteWastage('${row['id']}');
                      })),
            ]),
          ),
        ],
      ),
    );
  }

  // ── Kitchen Sessions ──────────────────────────────────────────────────────

  Widget _sessions(_KitchenSnapshot data) {
    final sessions = data.sessions;
    return _Page(
      title: 'Kitchen Sessions',
      subtitle: 'Shift-based production sessions with stock issue, yield tracking and staff accountability.',
      actions: [
        _ActionButton(
          label: 'Open New Session',
          icon: Icons.add,
          onPressed: () => _showNewSessionSheet(data),
          filled: true,
        ),
      ],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Toolbar(
            filters: [
              _ChipSelect(
                value: _sessionShiftFilter,
                values: const {
                  'ALL': 'All Shifts',
                  'shift_a': 'Shift A',
                  'shift_b': 'Shift B',
                },
                onChanged: (value) {
                  setState(() => _sessionShiftFilter = value);
                  _refresh();
                },
              ),
            ],
          ),
          const SizedBox(height: 16),
          _SimpleRows(
            rows: sessions,
            empty: 'No sessions found. Open a new session to begin.',
            title: (row) {
              final shift = '${row['shift_type'] ?? ''}' == 'shift_b'
                  ? 'Shift B'
                  : 'Shift A';
              return '${_value(row, ['session_number'])} · $shift';
            },
            subtitle: (row) {
              final status = _value(row, ['status']);
              final staff = _value(row, ['staff_name']);
              final date = _value(row, ['session_date', 'created_at']);
              final penalty = row['total_penalty'] != null &&
                      double.tryParse('${row['total_penalty']}') != null &&
                      double.parse('${row['total_penalty']}') > 0
                  ? ' · Penalty ${_money(row['total_penalty'])}'
                  : '';
              return '$status · $staff · $date$penalty';
            },
            trailing: (row) {
              final status = _value(row, ['status']);
              return _RowActions(actions: [
                if (status == 'in_production')
                  _RowAction('Close Session', Icons.check_circle_outline,
                      () => _showCloseSessionSheet(row, data)),
                _RowAction('View Detail', Icons.info_outline,
                    () => _viewSessionDetail(row)),
              ]);
            },
          ),
        ],
      ),
    );
  }

  // ── Spoilage ──────────────────────────────────────────────────────────────

  Widget _spoilage(_KitchenSnapshot data) {
    return _Page(
      title: 'Spoilage',
      subtitle: 'Record kitchen spoilage events linked to shift sessions.',
      actions: [
        _ActionButton(
          label: 'Record Spoilage',
          icon: Icons.add,
          onPressed: () => _showSpoilageDialog(data),
          filled: true,
        ),
      ],
      child: Column(
        children: [
          const SizedBox(height: 8),
          _SimpleRows(
            rows: data.spoilage,
            empty: 'No spoilage records found.',
            title: (row) =>
                '${_value(row, ['item_name', 'item_sku'])} · ${_value(row, ['quantity'])} ${_value(row, ['unit_of_measure'])}',
            subtitle: (row) {
              final cost = row['total_cost'] != null
                  ? ' · ${_money(row['total_cost'])}'
                  : '';
              return '${_value(row, ['wastage_date', 'created_at'])} · Shift ${_value(row, ['shift'])} · ${_value(row, ['status'])}$cost';
            },
            trailing: (row) => _RowActions(actions: [
              _RowAction('Approve', Icons.verified_outlined,
                  () => _auditWastage(row, 'approved')),
              _RowAction(
                  'Delete',
                  Icons.delete_outline,
                  () => _confirm('Delete spoilage record?', () {
                        return _repo.deleteWastage('${row['id']}');
                      })),
            ]),
          ),
        ],
      ),
    );
  }

  Widget _shiftConfirmations(_KitchenSnapshot data) {
    return _Page(
      title: 'Shift Confirmations',
      subtitle: 'Closed kitchen shifts awaiting chef confirmation of production and variance.',
      actions: [
        _ActionButton(
          label: 'Refresh',
          icon: Icons.refresh,
          onPressed: _refresh,
        ),
      ],
      child: Column(
        children: [
          const SizedBox(height: 8),
          _SimpleRows(
            rows: data.pendingShiftConfirmations,
            empty: 'No shifts pending your confirmation.',
            title: (row) => '${_value(row, ['shift_number'])} · ${_value(row, ['shift_date'])}',
            subtitle: (row) {
              final variance = _num(row['total_variance_cost']);
              return 'Store keeper: ${row['store_keeper']?['first_name'] ?? '—'}'
                  '${variance != 0 ? ' · Variance ${_money(variance)}' : ''}';
            },
            trailing: (row) => _RowActions(actions: [
              _RowAction('Review', Icons.fact_check_outlined,
                  () => _showChefConfirmDialog(row)),
            ]),
          ),
        ],
      ),
    );
  }

  Future<void> _showChefConfirmDialog(Map<String, dynamic> shiftRow) async {
    Map<String, dynamic> detail;
    try {
      detail = await _repo.getKitchenShiftDetail('${shiftRow['id']}');
    } catch (e) {
      if (mounted) _snack('Failed to load shift: $e');
      return;
    }
    if (!mounted) return;
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _ChefConfirmDialog(detail: detail),
    );
    if (result == null) return;
    final confirmed = result['confirmed'] == true;
    final notes = '${result['notes'] ?? ''}'.trim();
    await _run(() async {
      await _repo.chefConfirmShift('${shiftRow['id']}', confirmed: confirmed, notes: notes.isEmpty ? null : notes);
    },
        successMessage:
            confirmed ? 'Shift confirmed — sent to accountant for review' : 'Shift rejected back to store keeper');
  }

  // ── Session dialogs ───────────────────────────────────────────────────────

  Future<void> _showNewSessionSheet(_KitchenSnapshot data) async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _NewSessionDialog(
        stock: data.stock,
        recipesWithIngredients: data.recipesWithIngredients,
        staffProfiles: data.staffProfiles,
      ),
    );
    if (result == null) return;
    await _run(() async {
      await _repo.createProductionSession(result);
    }, successMessage: 'Session opened');
  }

  Future<void> _showCloseSessionSheet(
      Map<String, dynamic> session, _KitchenSnapshot data) async {
    final entries =
        List<Map<String, dynamic>>.from(session['entries'] as List? ?? []);
    final issues =
        List<Map<String, dynamic>>.from(session['issues'] as List? ?? []);
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      barrierDismissible: false,
      builder: (_) => _CloseSessionDialog(
        session: session,
        entries: entries,
        issues: issues,
      ),
    );
    if (result == null) return;
    await _run(() async {
      await _repo.completeProductionSession('${session['id']}', result);
    }, successMessage: 'Session closed');
  }

  void _viewSessionDetail(Map<String, dynamic> session) {
    final entries =
        List<Map<String, dynamic>>.from(session['entries'] as List? ?? []);
    final issues =
        List<Map<String, dynamic>>.from(session['issues'] as List? ?? []);
    final staff =
        List<Map<String, dynamic>>.from(session['session_staff'] as List? ?? []);
    final closing =
        List<Map<String, dynamic>>.from(session['closing_stock'] as List? ?? []);
    final shift = '${session['shift_type'] ?? ''}' == 'shift_b' ? 'B' : 'A';

    showDialog(
      context: context,
      builder: (_) => AlertDialog(
        title: Text('Session ${_value(session, ['session_number'])} · Shift $shift'),
        content: SizedBox(
          width: 620,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _DetailRow('Status', _value(session, ['status'])),
                _DetailRow('Staff', _value(session, ['staff_name'])),
                _DetailRow('Date', _value(session, ['session_date', 'created_at'])),
                if (session['total_penalty'] != null &&
                    double.tryParse('${session['total_penalty']}') != null &&
                    double.parse('${session['total_penalty']}') > 0)
                  _DetailRow(
                      'Variance Penalty', _money(session['total_penalty'])),
                if (staff.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('Shift Staff',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  ...staff.map((s) => _DetailRow(
                      _value(s, ['staff_name']),
                      '${_value(s, ['role'])} · ${(s['is_accountable'] == true) ? 'Accountable' : 'Not accountable'}')),
                ],
                if (issues.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('Issued to Kitchen',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  ...issues.map((i) => _DetailRow(
                      _value(i, ['item_name', 'item_sku']),
                      '${_value(i, ['quantity_issued'])} ${_value(i, ['unit'])}')),
                ],
                if (entries.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('Production Entries',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  ...entries.map((e) => _DetailRow(
                      _value(e, ['menu_item_name']),
                      'Expected: ${_value(e, ['expected_quantity'])} · Actual: ${_value(e, ['actual_quantity'])} · Variance: ${_value(e, ['variance'])}')),
                ],
                if (closing.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  const Text('Closing Stock',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  ...closing.map((c) => _DetailRow(
                      _value(c, ['item_name', 'item_sku']),
                      'Issued: ${_value(c, ['issued_quantity'])} ${_value(c, ['unit'])} · Closing: ${_value(c, ['closing_quantity'])} ${_value(c, ['unit'])}')),
                ],
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  Future<void> _showSpoilageDialog(_KitchenSnapshot data) async {
    String? selectedSku;
    final itemNameCtrl = TextEditingController();
    final qtyCtrl = TextEditingController();
    final unitCtrl = TextEditingController(text: 'kg');
    final unitCostCtrl = TextEditingController(text: '0');
    final notesCtrl = TextEditingController();
    String shift = 'A';
    String? sessionId;

    // Build a session picker list for in-progress / recent sessions
    final activeSessions = data.sessions
        .where((s) =>
            s['status'] == 'in_production' || s['status'] == 'completed')
        .toList();

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) {
          final qty = double.tryParse(qtyCtrl.text) ?? 0;
          final cost = double.tryParse(unitCostCtrl.text) ?? 0;
          final total = (qty * cost * 100).round() / 100;

          return AlertDialog(
            title: const Text('Record Spoilage'),
            content: SizedBox(
              width: 540,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _StockDropdown(
                      stock: data.stock,
                      value: selectedSku,
                      onChanged: (sku) {
                        setS(() => selectedSku = sku);
                        if (sku != null) {
                          final match = data.stock.firstWhere(
                            (s) =>
                                s['item_sku'] == sku || s['sku'] == sku,
                            orElse: () => {},
                          );
                          if (match.isNotEmpty) {
                            itemNameCtrl.text =
                                _value(match, ['item_name', 'name']);
                          }
                        }
                      },
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: itemNameCtrl,
                      decoration: const InputDecoration(
                          labelText: 'Item name', isDense: true),
                    ),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(
                        flex: 2,
                        child: TextField(
                          controller: qtyCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                              labelText: 'Quantity', isDense: true),
                          onChanged: (_) => setS(() {}),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: unitCtrl,
                          decoration: const InputDecoration(
                              labelText: 'Unit', isDense: true),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 2,
                        child: TextField(
                          controller: unitCostCtrl,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                              labelText: 'Unit cost (Ksh)', isDense: true),
                          onChanged: (_) => setS(() {}),
                        ),
                      ),
                    ]),
                    if (total > 0)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Total cost: Ksh ${total.toStringAsFixed(2)}',
                          style: const TextStyle(
                              color: Colors.red,
                              fontWeight: FontWeight.bold,
                              fontSize: 13),
                        ),
                      ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: shift,
                      decoration: const InputDecoration(
                          labelText: 'Shift', isDense: true),
                      items: const [
                        DropdownMenuItem(
                            value: 'A',
                            child: Text('Shift A (Morning)')),
                        DropdownMenuItem(
                            value: 'B',
                            child: Text('Shift B (Evening)')),
                      ],
                      onChanged: (v) => setS(() => shift = v ?? shift),
                    ),
                    if (activeSessions.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: sessionId,
                        decoration: const InputDecoration(
                          labelText: 'Link to session (optional)',
                          isDense: true,
                        ),
                        items: [
                          const DropdownMenuItem(
                              value: null,
                              child: Text('— No session —')),
                          ...activeSessions.map((s) => DropdownMenuItem(
                                value: '${s['id']}',
                                child: Text(
                                    '${s['session_number']} · ${s['shift_type'] == 'shift_b' ? 'Shift B' : 'Shift A'}'),
                              )),
                        ],
                        onChanged: (v) => setS(() => sessionId = v),
                      ),
                    ],
                    const SizedBox(height: 12),
                    TextField(
                      controller: notesCtrl,
                      maxLines: 2,
                      decoration: const InputDecoration(
                          labelText: 'Notes', isDense: true),
                    ),
                  ],
                ),
              ),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(ctx, true),
                child: const Text('Save Spoilage'),
              ),
            ],
          );
        },
      ),
    );
    if (saved != true) return;

    final qty = double.tryParse(qtyCtrl.text) ?? 0;
    final cost = double.tryParse(unitCostCtrl.text) ?? 0;
    await _run(() => _repo.recordSpoilage({
          'item_sku': selectedSku ?? itemNameCtrl.text.trim(),
          'item_name': itemNameCtrl.text.trim(),
          'quantity': qty,
          'unit_of_measure': unitCtrl.text.trim().ifEmpty('kg'),
          'unit_cost': cost,
          'total_cost': (qty * cost * 100).round() / 100,
          'shift': shift,
          if (sessionId != null) 'session_id': sessionId,
          'notes': notesCtrl.text.trim(),
        }),
        successMessage: 'Spoilage recorded');
  }

  Widget _foodControls(_KitchenSnapshot data) {
    return _Page(
      title: 'Food Controls',
      subtitle:
          'Yield rules, expected portions, stock-take variance reconciliation and loss reports.',
      actions: [
        if (_foodTab == KitchenFoodTab.rules)
          _ActionButton(
            label: 'New Yield Rule',
            icon: Icons.add,
            onPressed: () => _showFoodControlDialog(),
            filled: true,
          ),
        _ActionButton(
          label: 'Export PDF',
          icon: Icons.picture_as_pdf_outlined,
          onPressed: () => _export('kitchen_food_controls'),
        ),
      ],
      child: Column(
        children: [
          _Toolbar(
            filters: [
              _ChipSelect(
                value: _foodTab.name,
                values: const {
                  'rules': 'Yield Rules',
                  'portions': 'Portion Stock',
                  'expected': 'Expected Portions',
                  'variance': 'Variance',
                  'reports': 'Reports',
                },
                onChanged: (value) => setState(() {
                  _foodTab = KitchenFoodTab.values
                      .firstWhere((tab) => tab.name == value);
                }),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (_foodTab == KitchenFoodTab.rules)
            _foodRules(data)
          else if (_foodTab == KitchenFoodTab.portions)
            _portionStock(data)
          else if (_foodTab == KitchenFoodTab.expected)
            _expectedPortions(data)
          else if (_foodTab == KitchenFoodTab.variance)
            _variance(data)
          else
            _reports(data),
        ],
      ),
    );
  }

  Widget _foodRules(_KitchenSnapshot data) {
    return Column(
      children: [
        _SectionCard(
          title: 'Yield Calculator',
          child: _YieldCalculator(
            rules: data.foodControls,
            onCalculate: (id, input) async {
              final result = await _repo.calculateYield(
                  ruleId: id, rawInputQuantity: input);
              if (!mounted) return;
              _snack('Expected portions: ${_value(result, [
                    'expected_portions'
                  ])}');
            },
          ),
        ),
        const SizedBox(height: 16),
        _SimpleRows(
          rows: data.foodControls,
          empty: 'No food-control yield rules found.',
          title: (row) => '${_value(row, ['raw_item_name'])} → ${_value(row, [
                'produced_item_name'
              ])}',
          subtitle: (row) => '${_value(row, ['raw_quantity'])} ${_value(row, [
                'raw_unit'
              ])} produces ${_value(row, ['produced_portions'])} portions',
          trailing: (row) => _RowActions(actions: [
            _RowAction('Edit', Icons.edit_outlined,
                () => _showFoodControlDialog(existing: row)),
            _RowAction(
                'Delete',
                Icons.delete_outline,
                () => _confirm('Delete yield rule?', () {
                      return _repo.deleteFoodControl('${row['id']}');
                    })),
          ]),
        ),
      ],
    );
  }

  Widget _portionStock(_KitchenSnapshot data) {
    return _SimpleRows(
      rows: data.portionStock,
      empty: 'No portion stock records found.',
      title: (row) => _value(row, ['portion_name', 'item_sku']),
      subtitle: (row) =>
          'SKU ${_value(row, ['item_sku'])} • Expected ${_value(row, [
            'expected_balance'
          ])} • Updated ${_value(row, ['last_updated', 'updated_at'])}',
      trailing: (row) => Text(_value(row, ['status'])),
    );
  }

  Widget _expectedPortions(_KitchenSnapshot data) {
    return _SimpleRows(
      rows: data.expectedPortions,
      empty: 'No expected portion records found.',
      title: (row) =>
          _value(row, ['menu_item_name', 'portion_name', 'item_name', 'id']),
      subtitle: (row) => 'Expected ${_value(row, [
            'expected_portions',
            'expected_quantity'
          ])} • Actual ${_value(row, [
            'actual_portions',
            'actual_quantity'
          ])} • Status ${_value(row, ['status'])}',
      trailing: (row) => _RowActions(actions: [
        _RowAction(
          'Verify',
          Icons.verified_outlined,
          () => _showExpectedPortionDialog(row),
        ),
      ]),
    );
  }

  Widget _variance(_KitchenSnapshot data) {
    return _SimpleRows(
      rows: data.variance,
      empty: 'No variance records found.',
      title: (row) => '${_value(row, [
            'item_name',
            'item_sku'
          ])} • Variance ${_value(row, ['variance'])}',
      subtitle: (row) =>
          '${_value(row, ['variance_date'])} • Expected ${_value(row, [
            'expected_quantity',
            'expected_portions'
          ])}, Actual ${_value(row, [
            'actual_quantity',
            'actual_portions'
          ])} • Loss ${_money(row['cost_value'])}',
      trailing: (row) => _RowActions(actions: [
        _RowAction('Reason', Icons.edit_note_outlined,
            () => _showVarianceReasonDialog(row, data.varianceReasons)),
        _RowAction('Approve', Icons.check_circle_outline,
            () => _approveVariance(row, 'approved')),
        _RowAction('Reject', Icons.cancel_outlined,
            () => _approveVariance(row, 'rejected')),
      ]),
    );
  }

  Widget _reports(_KitchenSnapshot data) {
    return Column(
      children: [
        _SectionCard(
          title: 'Yield Report',
          child: _SimpleRows(
            rows: data.yieldReport,
            empty: 'No yield report rows found.',
            title: (row) => _value(row, ['name', 'portion_name', 'sku']),
            subtitle: (row) =>
                'Expected ${_value(row, ['expected'])} • Sold ${_value(row, [
                  'sold'
                ])} • Variance ${_value(row, ['variance'])}',
          ),
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Loss Report',
          child: _SimpleRows(
            rows: data.lossReport,
            empty: 'No loss report rows found.',
            title: (row) => _value(row, ['item_name', 'item_sku']),
            subtitle: (row) =>
                '${_value(row, ['variance_date'])} • Variance ${_value(row, [
                  'variance'
                ])} • Loss ${_money(row['cost_value'])}',
          ),
        ),
      ],
    );
  }

  void _openSku(String sku) {
    if (sku.isEmpty) return;
    context.go('/kitchen-operations/stock/$sku');
  }

  Future<void> _export(String reportType) async {
    await _run(() async {
      final file = await _repo.exportBrandedPdf(reportType);
      if (!mounted) return;
      _snack('Saved ${file.path}');
    }, successMessage: null);
  }

  Future<void> _run(
    Future<void> Function() action, {
    String? successMessage = 'Saved',
  }) async {
    try {
      await action();
      if (!mounted) return;
      if (successMessage != null) _snack(successMessage);
      _refresh();
    } catch (error) {
      if (!mounted) return;
      _snack('$error');
    }
  }

  void _snack(String message) {
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }

  Future<void> _confirm(String title, Future<void> Function() action) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: const Text('This action will update kitchen records.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
    if (ok == true) await _run(action);
  }

  Future<void> _showManualLedgerDialog(
    List<Map<String, dynamic>> stock, {
    Map<String, dynamic>? existing,
  }) async {
    final form = _FormBag({
      'item_id': _value(existing ?? {}, ['item_id', 'item_sku']),
      'item_name': _value(existing ?? {}, ['item_name']),
      'entry_date': _value(existing ?? {}, ['entry_date'])
          .ifEmpty(_isoDate(DateTime.now())),
      'opening_balance': _value(existing ?? {}, ['opening_balance']),
      'received_quantity': _value(existing ?? {}, ['received_quantity']),
      'used_quantity': _value(existing ?? {}, ['used_quantity']),
      'wastage_quantity': _value(existing ?? {}, ['wastage_quantity']),
      'expected_sales': _value(existing ?? {}, ['expected_sales']),
      'system_sales': _value(existing ?? {}, ['system_sales']),
      'unit_of_measure':
          _value(existing ?? {}, ['unit_of_measure']).ifEmpty('kg'),
      'remarks': _value(existing ?? {}, ['remarks']),
    });
    final saved = await _showFormDialog(
      title: existing == null ? 'Capture Daily Ledger' : 'Edit Ledger Entry',
      form: form,
      stock: stock,
      stockField: 'item_id',
      fields: const [
        _FieldSpec('item_name', 'Item name'),
        _FieldSpec('entry_date', 'Entry date'),
        _FieldSpec('opening_balance', 'Opening balance', number: true),
        _FieldSpec('received_quantity', 'Received', number: true),
        _FieldSpec('used_quantity', 'Used', number: true),
        _FieldSpec('wastage_quantity', 'Wastage', number: true),
        _FieldSpec('expected_sales', 'Expected sales', number: true),
        _FieldSpec('system_sales', 'System sales', number: true),
        _FieldSpec('unit_of_measure', 'Unit'),
        _FieldSpec('remarks', 'Remarks', maxLines: 2),
      ],
    );
    if (saved == null) return;
    await _run(() {
      final payload = form.numeric([
        'opening_balance',
        'received_quantity',
        'used_quantity',
        'wastage_quantity',
        'expected_sales',
        'system_sales',
      ]);
      return existing == null
          ? _repo.createManualLedger(payload)
          : _repo.updateManualLedger('${existing['id']}', payload);
    });
  }

  Future<void> _showRequisitionDialog(List<Map<String, dynamic>> stock) async {
    final priority = ValueNotifier('NORMAL');
    final reason = TextEditingController();
    final selectedSku = ValueNotifier<String?>(null);
    final quantity = TextEditingController();
    final notes = TextEditingController();
    final lines = <Map<String, dynamic>>[];
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('New Kitchen Requisition'),
          content: SizedBox(
            width: 620,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ValueListenableBuilder<String>(
                    valueListenable: priority,
                    builder: (_, value, __) => DropdownButtonFormField<String>(
                      initialValue: value,
                      decoration: const InputDecoration(labelText: 'Priority'),
                      items: const ['LOW', 'NORMAL', 'HIGH', 'URGENT']
                          .map((item) => DropdownMenuItem(
                                value: item,
                                child: Text(item),
                              ))
                          .toList(),
                      onChanged: (value) => priority.value = value ?? 'NORMAL',
                    ),
                  ),
                  TextField(
                    controller: reason,
                    decoration: const InputDecoration(labelText: 'Reason'),
                  ),
                  const SizedBox(height: 16),
                  _StockDropdown(
                    stock: stock,
                    value: selectedSku.value,
                    onChanged: (value) {
                      selectedSku.value = value;
                      final match = _findStock(stock, value);
                      notes.text =
                          _value(match, ['unit_of_measure']).ifEmpty('kg');
                      setDialogState(() {});
                    },
                  ),
                  TextField(
                    controller: quantity,
                    keyboardType: TextInputType.number,
                    decoration:
                        const InputDecoration(labelText: 'Requested quantity'),
                  ),
                  TextField(
                    controller: notes,
                    decoration:
                        const InputDecoration(labelText: 'Unit / line notes'),
                  ),
                  const SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: OutlinedButton.icon(
                      onPressed: () {
                        final sku = selectedSku.value;
                        if (sku == null || sku.isEmpty) return;
                        final item = _findStock(stock, sku);
                        lines.add({
                          'item_sku': sku,
                          'item_name': _value(item, ['item_name', 'name']),
                          'requested_quantity': _num(quantity.text),
                          'unit_of_measure': notes.text,
                        });
                        quantity.clear();
                        setDialogState(() {});
                      },
                      icon: const Icon(Icons.add, size: 16),
                      label: const Text('Add Line'),
                    ),
                  ),
                  const SizedBox(height: 8),
                  ...lines.map((line) => ListTile(
                        dense: true,
                        title: Text(_value(line, ['item_name', 'item_sku'])),
                        subtitle: Text(
                            '${line['requested_quantity']} ${line['unit_of_measure']}'),
                        trailing: IconButton(
                          icon: const Icon(Icons.close),
                          onPressed: () => setDialogState(() {
                            lines.remove(line);
                          }),
                        ),
                      )),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed:
                  lines.isEmpty ? null : () => Navigator.pop(context, true),
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
    if (saved == true) {
      await _run(() => _repo.createRequisition({
            'priority': priority.value,
            'reason': reason.text,
            'items': lines,
          }));
    }
  }

  Future<void> _showRequisitionDetail(Map<String, dynamic> row) async {
    final detail = await _safe(_repo.getRequisition('${row['id']}'), row);
    if (!mounted) return;
    openRecordDetailScreen(
      context,
      title: 'Requisition ${_value(detail, ['requisition_number', 'id'])}',
      subtitle: 'Kitchen Requisition',
      record: detail,
    );
  }

  Future<void> _showRequisitionRelatedActivity(Map<String, dynamic> row) async {
    try {
      final activity = await _repo.getRequisitionRelatedActivity('${row['id']}');
      if (!mounted) return;
      final grns = _rows(activity['grns']);
      final usageEntries = _rows(activity['usageEntries']);
      final wastageEntries = _rows(activity['wastageEntries']);
      final issueEntries = _rows(activity['issueEntries']);
      final ledgerEntries = _rows(activity['ledgerEntries']);

      showDialog<void>(
        context: context,
        builder: (context) => AlertDialog(
          title: Text('Related Activity — ${_value(row, ['requisition_number', 'id'])}'),
          content: SizedBox(
            width: 640,
            height: 480,
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (grns.isNotEmpty)
                    _ActivitySection(title: 'GRN Receipts (${grns.length})', children: grns.map((g) => ListTile(
                      dense: true,
                      title: Text('GRN #${_value(g, ['grn_number', 'id'])}'),
                      subtitle: Text('${_isoDate(DateTime.tryParse('${g['created_at'] ?? ''}') ?? DateTime.now())} | ${_rows(g['items']).length} items'),
                    )).toList()),
                  if (ledgerEntries.isNotEmpty)
                    _ActivitySection(title: 'Stock Ledger (${ledgerEntries.length})', children: ledgerEntries.map((l) => ListTile(
                      dense: true,
                      title: Text('${_value(l, ['item_name', 'item_sku'])}'),
                      subtitle: Text('${l['transaction_type']} | ${_num(l['quantity_in']) > 0 ? '+' : '-'}${_num(l['quantity_in']) > 0 ? _num(l['quantity_in']) : _num(l['quantity_out'])} ${l['unit_of_measure'] ?? ''}'),
                    )).toList()),
                  if (usageEntries.isNotEmpty)
                    _ActivitySection(title: 'Kitchen Usage (${usageEntries.length})', children: usageEntries.map((u) => ListTile(
                      dense: true,
                      title: Text('${_value(u, ['item_name', 'item_sku'])}'),
                      subtitle: Text('${_isoDate(DateTime.tryParse('${u['usage_date'] ?? ''}') ?? DateTime.now())} | ${_num(u['quantity'])} ${u['unit_of_measure'] ?? ''} | ${u['usage_type'] ?? 'CONSUMPTION'}'),
                    )).toList()),
                  if (wastageEntries.isNotEmpty)
                    _ActivitySection(title: 'Wastage (${wastageEntries.length})', children: wastageEntries.map((w) => ListTile(
                      dense: true,
                      title: Text('${_value(w, ['item_name', 'item_sku'])}'),
                      subtitle: Text('${_isoDate(DateTime.tryParse('${w['wastage_date'] ?? ''}') ?? DateTime.now())} | ${_num(w['quantity'])} ${w['unit_of_measure'] ?? ''} | ${w['reason'] ?? ''}'),
                    )).toList()),
                  if (issueEntries.isNotEmpty)
                    _ActivitySection(title: 'Department Issues (${issueEntries.length})', children: issueEntries.map((i) => ListTile(
                      dense: true,
                      title: Text('${_value(i, ['item_name', 'item_sku'])}'),
                      subtitle: Text('${_isoDate(DateTime.tryParse('${i['issued_at'] ?? ''}') ?? DateTime.now())} | Dept: ${i['department_code'] ?? i['department_name'] ?? ''}'),
                    )).toList()),
                  if (grns.isEmpty && ledgerEntries.isEmpty && usageEntries.isEmpty && wastageEntries.isEmpty && issueEntries.isEmpty)
                    const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('No related activity found yet.'))),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
          ],
        ),
      );
    } catch (error) {
      _snack('Failed to load activity: $error');
    }
  }

  Future<void> _approveRequisition(Map<String, dynamic> row) async {
    final items = _rows(row['items']);
    await _run(() => _repo.approveRequisition(
          '${row['id']}',
          items
              .map((item) => {
                    'item_id': item['id'],
                    'approved_quantity':
                        _num(item['requested_quantity']).toString(),
                  })
              .toList(),
        ));
  }

  Future<void> _rejectRequisition(Map<String, dynamic> row) async {
    final reason = await _prompt('Reject Requisition', 'Rejection reason');
    if (reason == null) return;
    await _run(() => _repo.rejectRequisition('${row['id']}', reason));
  }

  Future<void> _fulfillRequisition(Map<String, dynamic> row) async {
    final items = _rows(row['items']);
    await _run(() => _repo.fulfillRequisition(
          '${row['id']}',
          items
              .map((item) => {
                    'item_id': item['id'],
                    'issued_quantity': _num(item['approved_quantity'] ??
                        item['requested_quantity']),
                  })
              .toList(),
        ));
  }

  Future<void> _showRecipeDialog(
    List<Map<String, dynamic>> stock, {
    Map<String, dynamic>? existing,
  }) async {
    final form = _FormBag({
      'menu_item_name': _value(existing ?? {}, ['menu_item_name']),
      'portion_size': _value(existing ?? {}, ['portion_size']),
      'portions_per_recipe':
          _value(existing ?? {}, ['portions_per_recipe']).ifEmpty('1'),
      'selling_price': _value(existing ?? {}, ['selling_price']),
      'cooking_instructions': _value(existing ?? {}, ['cooking_instructions']),
    });
    final ingredients = _rows(existing?['ingredients']);
    final saved = await _showFormDialog(
      title: existing == null ? 'New Recipe' : 'Edit Recipe',
      form: form,
      fields: const [
        _FieldSpec('menu_item_name', 'Menu item name'),
        _FieldSpec('portion_size', 'Portion size'),
        _FieldSpec('portions_per_recipe', 'Portions per recipe', number: true),
        _FieldSpec('selling_price', 'Selling price', number: true),
        _FieldSpec('cooking_instructions', 'Cooking instructions', maxLines: 3),
      ],
      extra: _IngredientEditor(stock: stock, ingredients: ingredients),
    );
    if (saved == null) return;
    await _run(() {
      final payload = form.numeric(['portions_per_recipe', 'selling_price']);
      payload['ingredients'] = ingredients.isEmpty
          ? [
              {
                'item_sku': 'MANUAL',
                'item_name': 'Manual ingredient',
                'quantity_per_portion': 1,
                'unit_of_measure': 'unit',
                'unit_cost': 0,
              }
            ]
          : ingredients;
      return existing == null
          ? _repo.createRecipe(payload)
          : _repo.updateRecipe('${existing['id']}', payload);
    });
  }

  Future<void> _showUsageDialog(List<Map<String, dynamic>> stock) async {
    final form = _FormBag({
      'item_sku': '',
      'item_name': '',
      'quantity': '',
      'unit_of_measure': 'kg',
      'usage_type': 'STAFF_MEAL',
      'shift': 'DAY',
      'notes': '',
    });
    final saved = await _showFormDialog(
      title: 'Record Usage',
      form: form,
      stock: stock,
      stockField: 'item_sku',
      fields: const [
        _FieldSpec('item_name', 'Item name'),
        _FieldSpec('quantity', 'Quantity', number: true),
        _FieldSpec('unit_of_measure', 'Unit'),
        _FieldSpec('usage_type', 'Usage type'),
        _FieldSpec('shift', 'Shift'),
        _FieldSpec('notes', 'Notes', maxLines: 2),
      ],
    );
    if (saved == null) return;
    await _run(() => _repo.recordUsage(form.numeric(['quantity'])));
  }

  Future<void> _showWastageDialog(
    List<Map<String, dynamic>> stock, {
    Map<String, dynamic>? existing,
  }) async {
    final _existingSku = _value(existing ?? {}, ['item_sku']);
    String? selectedSku = _existingSku.trim().isEmpty ? null : _existingSku;
    final itemNameCtrl = TextEditingController(
        text: _value(existing ?? {}, ['item_name']));
    final quantityCtrl = TextEditingController(
        text: _value(existing ?? {}, ['quantity']));
    final unitCtrl = TextEditingController(
        text: _value(existing ?? {}, ['unit_of_measure']).ifEmpty('kg'));
    final unitCostCtrl = TextEditingController(
        text: _value(existing ?? {}, ['unit_cost']).ifEmpty('0'));
    final notesCtrl = TextEditingController(
        text: _value(existing ?? {}, ['notes']));
    String reason =
        _value(existing ?? {}, ['reason']).ifEmpty('SPOILAGE');
    String shift = _value(existing ?? {}, ['shift']).ifEmpty('A');

    final saved = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: Text(existing == null ? 'Record Wastage' : 'Edit Wastage'),
          content: SizedBox(
            width: 540,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _StockDropdown(
                    stock: stock,
                    value: selectedSku,
                    onChanged: (sku) {
                      selectedSku = sku;
                      if (sku != null) {
                        final match = stock.firstWhere(
                          (s) =>
                              s['item_sku'] == sku || s['sku'] == sku,
                          orElse: () => {},
                        );
                        if (match.isNotEmpty) {
                          itemNameCtrl.text = _value(
                              match, ['item_name', 'name']);
                        }
                      }
                    },
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: itemNameCtrl,
                    decoration: const InputDecoration(
                        labelText: 'Item name', isDense: true),
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: quantityCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Quantity', isDense: true),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: unitCtrl,
                        decoration: const InputDecoration(
                            labelText: 'Unit', isDense: true),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: unitCostCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Unit cost (Ksh)', isDense: true),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: reason,
                    decoration: const InputDecoration(
                        labelText: 'Reason', isDense: true),
                    items: const [
                      DropdownMenuItem(
                          value: 'SPOILAGE', child: Text('Spoilage')),
                      DropdownMenuItem(
                          value: 'OVERCOOKING',
                          child: Text('Overcooking')),
                      DropdownMenuItem(
                          value: 'CONTAMINATION',
                          child: Text('Contamination')),
                      DropdownMenuItem(
                          value: 'EXPIRED', child: Text('Expired')),
                      DropdownMenuItem(
                          value: 'DROPPED', child: Text('Dropped')),
                      DropdownMenuItem(
                          value: 'OTHER', child: Text('Other')),
                    ],
                    onChanged: (v) => setS(() => reason = v ?? reason),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: shift,
                    decoration: const InputDecoration(
                        labelText: 'Shift', isDense: true),
                    items: const [
                      DropdownMenuItem(
                          value: 'A', child: Text('Shift A (Morning)')),
                      DropdownMenuItem(
                          value: 'B', child: Text('Shift B (Evening)')),
                    ],
                    onChanged: (v) => setS(() => shift = v ?? shift),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notesCtrl,
                    maxLines: 2,
                    decoration: const InputDecoration(
                        labelText: 'Notes', isDense: true),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    if (saved != true) return;

    final qty = double.tryParse(quantityCtrl.text) ?? 0;
    final unitCost = double.tryParse(unitCostCtrl.text) ?? 0;
    final payload = {
      'item_sku': selectedSku ?? itemNameCtrl.text.trim(),
      'item_name': itemNameCtrl.text.trim(),
      'quantity': qty,
      'unit_of_measure': unitCtrl.text.trim().ifEmpty('kg'),
      'reason': reason,
      'unit_cost': unitCost,
      'total_cost': (qty * unitCost * 100).round() / 100,
      'estimated_value': (qty * unitCost * 100).round() / 100,
      'shift': shift,
      'notes': notesCtrl.text.trim(),
    };
    await _run(() => existing == null
        ? _repo.recordWastage(payload)
        : _repo.updateWastage('${existing['id']}', payload));
  }

  Future<void> _showFoodControlDialog({Map<String, dynamic>? existing}) async {
    final form = _FormBag({
      'raw_item_name': _value(existing ?? {}, ['raw_item_name']),
      'raw_quantity': _value(existing ?? {}, ['raw_quantity']),
      'raw_unit': _value(existing ?? {}, ['raw_unit']).ifEmpty('kg'),
      'produced_item_name': _value(existing ?? {}, ['produced_item_name']),
      'produced_portions': _value(existing ?? {}, ['produced_portions']),
    });
    final saved = await _showFormDialog(
      title: existing == null ? 'New Yield Rule' : 'Edit Yield Rule',
      form: form,
      fields: const [
        _FieldSpec('raw_item_name', 'Raw item name'),
        _FieldSpec('raw_quantity', 'Raw quantity', number: true),
        _FieldSpec('raw_unit', 'Raw unit'),
        _FieldSpec('produced_item_name', 'Produced item name'),
        _FieldSpec('produced_portions', 'Produced portions', number: true),
      ],
    );
    if (saved == null) return;
    await _run(() {
      final payload = form.numeric(['raw_quantity', 'produced_portions']);
      return existing == null
          ? _repo.createFoodControl(payload)
          : _repo.updateFoodControl('${existing['id']}', payload);
    });
  }

  Future<void> _showExpectedPortionDialog(Map<String, dynamic> row) async {
    final form = _FormBag({
      'actual_portions': _value(row, ['actual_portions', 'actual_quantity']),
      'notes': _value(row, ['notes', 'verification_notes']),
    });
    final saved = await _showFormDialog(
      title: 'Verify Expected Portions',
      form: form,
      fields: const [
        _FieldSpec('actual_portions', 'Actual portions', number: true),
        _FieldSpec('notes', 'Notes'),
      ],
    );
    if (saved == null) return;
    final actual = double.tryParse(form.values['actual_portions'] ?? '') ?? 0;
    await _run(() => _repo.verifyExpectedPortion(
          '${row['id']}',
          actualPortions: actual,
          notes: form.values['notes'],
        ));
  }

  Future<void> _showVarianceReasonDialog(
    Map<String, dynamic> row,
    List<Map<String, dynamic>> reasons,
  ) async {
    String? reasonId = reasons.isEmpty
        ? null
        : '${reasons.first['id'] ?? reasons.first['value']}';
    final notes = TextEditingController(text: _value(row, ['notes']));
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Variance Reason'),
        content: SizedBox(
          width: 480,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: reasonId,
                decoration: const InputDecoration(labelText: 'Reason'),
                items: reasons
                    .map((reason) => DropdownMenuItem(
                          value: '${reason['id']}',
                          child: Text(_value(reason, ['reason', 'name'])),
                        ))
                    .toList(),
                onChanged: (value) => reasonId = value,
              ),
              TextField(
                controller: notes,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Notes'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
    if (saved == true && reasonId != null) {
      await _run(() => _repo.submitVarianceReason(
            '${row['id']}',
            reasonId: reasonId!,
            notes: notes.text,
          ));
    }
  }

  Future<void> _approveVariance(Map<String, dynamic> row, String status) async {
    final notes = await _prompt('Variance ${status.capitalize()}', 'Notes');
    if (notes == null) return;
    await _run(() => _repo.approveVariance(
          '${row['id']}',
          status: status,
          notes: notes,
        ));
  }

  Future<void> _reviewUsage(Map<String, dynamic> row) async {
    final notes = await _prompt('Review Usage', 'Review notes');
    if (notes == null) return;
    await _run(() => _repo.reviewUsage('${row['id']}', notes));
  }

  Future<void> _auditUsage(Map<String, dynamic> row, String status) async {
    final notes = await _prompt('Audit Usage', 'Audit notes');
    if (notes == null) return;
    await _run(() => _repo.auditUsage('${row['id']}', status, notes));
  }

  Future<void> _reviewWastage(Map<String, dynamic> row) async {
    final notes = await _prompt('Review Wastage', 'Review notes');
    if (notes == null) return;
    await _run(() => _repo.reviewWastage('${row['id']}', notes));
  }

  Future<void> _auditWastage(Map<String, dynamic> row, String status) async {
    final notes = await _prompt('Audit Wastage', 'Audit notes');
    if (notes == null) return;
    await _run(() => _repo.auditWastage('${row['id']}', status, notes));
  }

  Future<String?> _prompt(String title, String label) async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          maxLines: 3,
          decoration: InputDecoration(labelText: label),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, controller.text),
            child: const Text('Submit'),
          ),
        ],
      ),
    );
  }

  Future<Map<String, String>?> _showFormDialog({
    required String title,
    required _FormBag form,
    required List<_FieldSpec> fields,
    List<Map<String, dynamic>> stock = const [],
    String? stockField,
    Widget? extra,
  }) {
    return showDialog<Map<String, String>>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: SizedBox(
          width: 620,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (stockField != null)
                  _StockDropdown(
                    stock: stock,
                    value: form.values[stockField],
                    onChanged: (value) {
                      form.values[stockField] = value ?? '';
                      final item = _findStock(stock, value);
                      form.controller('item_name').text =
                          _value(item, ['item_name', 'name']);
                      form.controller('unit_of_measure').text =
                          _value(item, ['unit_of_measure']).ifEmpty(
                        form.values['unit_of_measure'] ?? 'kg',
                      );
                    },
                  ),
                ...fields.map((field) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: TextField(
                        controller: form.controller(field.key),
                        maxLines: field.maxLines,
                        keyboardType: field.number
                            ? const TextInputType.numberWithOptions(
                                decimal: true)
                            : TextInputType.text,
                        decoration: InputDecoration(labelText: field.label),
                      ),
                    )),
                if (extra != null) extra,
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, form.values),
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }
}

// ── _DetailRow ────────────────────────────────────────────────────────────

class _DetailRow extends StatelessWidget {
  const _DetailRow(this.label, this.value);
  final String label;
  final String value;
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SizedBox(
              width: 160,
              child: Text(label,
                  style: const TextStyle(
                      color: AppColors.kTextSecondary, fontSize: 13)),
            ),
            Expanded(
                child: Text(value, style: const TextStyle(fontSize: 13))),
          ],
        ),
      );
}

// ── _NewSessionDialog (multi-step) ────────────────────────────────────────

class _NewSessionDialog extends StatefulWidget {
  const _NewSessionDialog({
    required this.stock,
    required this.recipesWithIngredients,
    required this.staffProfiles,
  });
  final List<Map<String, dynamic>> stock;
  final List<Map<String, dynamic>> recipesWithIngredients;
  final List<Map<String, dynamic>> staffProfiles;

  @override
  State<_NewSessionDialog> createState() => _NewSessionDialogState();
}

class _NewSessionDialogState extends State<_NewSessionDialog> {
  int _step = 0;

  // Step 0: Shift
  String _shiftType = 'shift_a';

  // Step 1: Staff
  final List<Map<String, dynamic>> _selectedStaff = [];

  // Step 2: Stock issues + yield
  final List<Map<String, dynamic>> _issues = [];
  final List<Map<String, dynamic>> _plannedItems = [];

  String _text(Map<String, dynamic> row, List<String> keys) {
    for (final k in keys) {
      final v = row[k];
      if (v != null && '$v'.trim().isNotEmpty) return '$v';
    }
    return '';
  }

  void _next() => setState(() => _step++);
  void _back() => setState(() => _step--);

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text([
        'Step 1 of 3: Select Shift',
        'Step 2 of 3: Assign Staff',
        'Step 3 of 3: Issue Stock',
      ][_step]),
      content: SizedBox(
        width: 600,
        child: SingleChildScrollView(
          child: [
            _buildShiftStep(),
            _buildStaffStep(),
            _buildStockStep(),
          ][_step],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => _step == 0
              ? Navigator.pop(context)
              : _back(),
          child: Text(_step == 0 ? 'Cancel' : 'Back'),
        ),
        FilledButton(
          onPressed: _canProceed() ? _handleNext : null,
          child: Text(_step < 2 ? 'Next' : 'Open Session'),
        ),
      ],
    );
  }

  bool _canProceed() {
    if (_step == 0) return true;
    if (_step == 1) return _selectedStaff.isNotEmpty;
    if (_step == 2) return _issues.isNotEmpty;
    return false;
  }

  void _handleNext() {
    if (_step < 2) {
      _next();
    } else {
      // Compute planned items from yield preview
      Navigator.pop(context, {
        'shift_type': _shiftType,
        'session_staff': _selectedStaff,
        'issues': _issues,
        'planned_items': _plannedItems,
      });
    }
  }

  Widget _buildShiftStep() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('Select which kitchen shift this session is for:'),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Expanded(
              child: _ShiftCard(
                label: 'Shift A',
                subtitle: 'Morning / First shift',
                icon: Icons.wb_sunny_outlined,
                selected: _shiftType == 'shift_a',
                onTap: () => setState(() => _shiftType = 'shift_a'),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _ShiftCard(
                label: 'Shift B',
                subtitle: 'Evening / Second shift',
                icon: Icons.nights_stay_outlined,
                selected: _shiftType == 'shift_b',
                onTap: () => setState(() => _shiftType = 'shift_b'),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStaffStep() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('Select staff on duty for this shift. Accountable staff will share variance penalty bills.'),
        const SizedBox(height: 12),
        if (widget.staffProfiles.isEmpty)
          const Text('No staff profiles found. Add staff in HR module.'),
        ...widget.staffProfiles.map((profile) {
          final profileId = _text(profile, ['id']);
          final name =
              '${_text(profile, ['first_name'])} ${_text(profile, ['last_name'])}'.trim();
          final existing = _selectedStaff.firstWhere(
            (s) => s['staff_profile_id'] == profileId,
            orElse: () => {},
          );
          final isSelected = existing.isNotEmpty;
          return StatefulBuilder(
            builder: (ctx, setS) => CheckboxListTile(
              dense: true,
              value: isSelected,
              title: Text(name.isNotEmpty ? name : profileId),
              subtitle: isSelected
                  ? DropdownButtonFormField<String>(
                      value: existing['role'] as String? ?? 'cook',
                      isDense: true,
                      decoration: const InputDecoration(
                          contentPadding: EdgeInsets.symmetric(vertical: 4)),
                      items: const [
                        DropdownMenuItem(value: 'cook', child: Text('Cook')),
                        DropdownMenuItem(
                            value: 'helper', child: Text('Helper')),
                        DropdownMenuItem(
                            value: 'supervisor', child: Text('Supervisor')),
                      ],
                      onChanged: (v) => setState(() {
                        existing['role'] = v;
                      }),
                    )
                  : null,
              secondary: isSelected
                  ? Checkbox(
                      value: existing['is_accountable'] as bool? ?? true,
                      onChanged: (v) => setState(() {
                        existing['is_accountable'] = v;
                      }),
                    )
                  : null,
              onChanged: (checked) => setState(() {
                if (checked == true) {
                  _selectedStaff.add({
                    'staff_profile_id': profileId,
                    'staff_name': name.isNotEmpty ? name : profileId,
                    'role': 'cook',
                    'is_accountable': true,
                  });
                } else {
                  _selectedStaff.removeWhere(
                      (s) => s['staff_profile_id'] == profileId);
                }
              }),
            ),
          );
        }),
        if (_selectedStaff.isEmpty)
          const Padding(
            padding: EdgeInsets.only(top: 8),
            child: Text('Select at least one staff member.',
                style: TextStyle(color: Colors.red, fontSize: 12)),
          ),
      ],
    );
  }

  Widget _buildStockStep() {
    // Compute yield preview per recipe based on current issues
    final yieldLines = <Map<String, dynamic>>[];
    for (final recipe in widget.recipesWithIngredients) {
      final ingredients =
          (recipe['ingredients'] as List?)?.cast<Map<String, dynamic>>() ?? [];
      final outputQty = double.tryParse('${recipe['output_quantity']}') ?? 0;
      final outputUnit = _text(recipe, ['output_unit']);
      final menuItemName = _text(recipe, ['menu_item_name', 'recipe_name']);

      double minPossible = double.infinity;
      bool hasAnyIssue = false;
      for (final ing in ingredients) {
        final sku = _text(ing, ['item_sku']);
        final reqQty =
            double.tryParse('${ing['quantity_required']}') ?? 0;
        if (reqQty <= 0) continue;
        final issue = _issues.firstWhere((i) => i['item_sku'] == sku,
            orElse: () => {});
        if (issue.isEmpty) continue;
        hasAnyIssue = true;
        final issued =
            double.tryParse('${issue['quantity_issued']}') ?? 0;
        final possible = (issued / reqQty) * outputQty;
        if (possible < minPossible) minPossible = possible;
      }
      if (hasAnyIssue && minPossible != double.infinity) {
        yieldLines.add({
          'menu_item_id': _text(recipe, ['menu_item_id']),
          'menu_item_name': menuItemName,
          'expected_quantity': minPossible.round(),
          'output_unit': outputUnit,
        });
      }
    }

    // Update planned_items whenever stock step is shown
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        _plannedItems
          ..clear()
          ..addAll(yieldLines);
      }
    });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('Record stock items issued to kitchen for this session:'),
        const SizedBox(height: 12),
        _IssueEditor(
          stock: widget.stock,
          issues: _issues,
          onChanged: () => setState(() {}),
        ),
        if (yieldLines.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Divider(),
          const Text('Expected Yield (auto-calculated from recipes)',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 8),
          ...yieldLines.map((y) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  children: [
                    const Icon(Icons.restaurant_outlined,
                        size: 16, color: Colors.green),
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text(_text(y, ['menu_item_name']),
                            style: const TextStyle(fontSize: 13))),
                    Text(
                        '${y['expected_quantity']} ${_text(y, ['output_unit'])}',
                        style: const TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Colors.green)),
                  ],
                ),
              )),
        ],
      ],
    );
  }
}

// ── _ShiftCard ────────────────────────────────────────────────────────────

class _ShiftCard extends StatelessWidget {
  const _ShiftCard({
    required this.label,
    required this.subtitle,
    required this.icon,
    required this.selected,
    required this.onTap,
  });
  final String label;
  final String subtitle;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: selected
              ? theme.colorScheme.primary.withOpacity(0.1)
              : theme.colorScheme.surface,
          border: Border.all(
            color: selected
                ? theme.colorScheme.primary
                : theme.dividerColor,
            width: selected ? 2 : 1,
          ),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Column(
          children: [
            Icon(icon,
                size: 32,
                color: selected
                    ? theme.colorScheme.primary
                    : theme.colorScheme.onSurface),
            const SizedBox(height: 8),
            Text(label,
                style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.bold,
                    color: selected
                        ? theme.colorScheme.primary
                        : null)),
            const SizedBox(height: 4),
            Text(subtitle,
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary)),
          ],
        ),
      ),
    );
  }
}

// ── _IssueEditor ──────────────────────────────────────────────────────────

class _IssueEditor extends StatefulWidget {
  const _IssueEditor({
    required this.stock,
    required this.issues,
    required this.onChanged,
  });
  final List<Map<String, dynamic>> stock;
  final List<Map<String, dynamic>> issues;
  final VoidCallback onChanged;

  @override
  State<_IssueEditor> createState() => _IssueEditorState();
}

class _IssueEditorState extends State<_IssueEditor> {
  String _text(Map<String, dynamic> row, List<String> keys) {
    for (final k in keys) {
      final v = row[k];
      if (v != null && '$v'.trim().isNotEmpty) return '$v';
    }
    return '';
  }

  void _addIssue() {
    setState(() {
      widget.issues.add({
        'item_sku': '',
        'item_name': '',
        'quantity_issued': '0',
        'unit': 'kg',
        'unit_cost': '0',
      });
    });
    widget.onChanged();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ...List.generate(widget.issues.length, (i) {
          final issue = widget.issues[i];
          return Card(
            margin: const EdgeInsets.only(bottom: 8),
            child: Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: _StockDropdown(
                          stock: widget.stock,
                          value: issue['item_sku'] as String? ?? '',
                          onChanged: (sku) => setState(() {
                            issue['item_sku'] = sku ?? '';
                            // Look up item name from stock list
                            final match = widget.stock.firstWhere(
                              (s) => s['item_sku'] == sku || s['sku'] == sku,
                              orElse: () => {},
                            );
                            issue['item_name'] = match.isEmpty
                                ? sku ?? ''
                                : (match['item_name'] ??
                                    match['name'] ??
                                    sku ??
                                    '');
                            widget.onChanged();
                          }),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextFormField(
                          initialValue: '${issue['quantity_issued']}',
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'Qty',
                            isDense: true,
                          ),
                          onChanged: (v) {
                            issue['quantity_issued'] = v;
                            widget.onChanged();
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextFormField(
                          initialValue: issue['unit'] as String? ?? 'kg',
                          decoration: const InputDecoration(
                            labelText: 'Unit',
                            isDense: true,
                          ),
                          onChanged: (v) {
                            issue['unit'] = v;
                            widget.onChanged();
                          },
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.remove_circle_outline,
                            color: Colors.red),
                        onPressed: () => setState(() {
                          widget.issues.removeAt(i);
                          widget.onChanged();
                        }),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          );
        }),
        TextButton.icon(
          icon: const Icon(Icons.add),
          label: const Text('Add Stock Item'),
          onPressed: _addIssue,
        ),
      ],
    );
  }
}

// ── _CloseSessionDialog ───────────────────────────────────────────────────

class _CloseSessionDialog extends StatefulWidget {
  const _CloseSessionDialog({
    required this.session,
    required this.entries,
    required this.issues,
  });
  final Map<String, dynamic> session;
  final List<Map<String, dynamic>> entries;
  final List<Map<String, dynamic>> issues;

  @override
  State<_CloseSessionDialog> createState() => _CloseSessionDialogState();
}

class _CloseSessionDialogState extends State<_CloseSessionDialog> {
  late final List<Map<String, dynamic>> _entryActuals;
  late final List<Map<String, dynamic>> _closingStock;

  @override
  void initState() {
    super.initState();
    _entryActuals = widget.entries
        .map((e) => {
              'entry_id': e['id'],
              'menu_item_name': e['menu_item_name'] ?? '',
              'expected_quantity': e['expected_quantity'] ?? 0,
              'actual_controller':
                  TextEditingController(text: '${e['actual_quantity'] ?? 0}'),
            })
        .toList();
    _closingStock = widget.issues
        .map((i) => {
              'item_sku': i['item_sku'] ?? '',
              'item_name': i['item_name'] ?? '',
              'issued_quantity': i['quantity_issued'] ?? 0,
              'unit': i['unit'] ?? 'kg',
              'closing_controller': TextEditingController(text: '0'),
            })
        .toList();
  }

  @override
  void dispose() {
    for (final e in _entryActuals) {
      (e['actual_controller'] as TextEditingController).dispose();
    }
    for (final s in _closingStock) {
      (s['closing_controller'] as TextEditingController).dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Close Kitchen Session'),
      content: SizedBox(
        width: 620,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_entryActuals.isNotEmpty) ...[
                const Text('Actual production (how many portions were made):',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 8),
                ..._entryActuals.map((e) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: Text('${e['menu_item_name']}',
                                style: const TextStyle(fontSize: 13)),
                          ),
                          Text(
                              'Expected: ${e['expected_quantity']}  ',
                              style: const TextStyle(
                                  color: AppColors.kTextSecondary,
                                  fontSize: 12)),
                          Expanded(
                            child: TextFormField(
                              controller: e['actual_controller']
                                  as TextEditingController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                  labelText: 'Actual', isDense: true),
                            ),
                          ),
                        ],
                      ),
                    )),
              ],
              if (_closingStock.isNotEmpty) ...[
                const Divider(height: 24),
                const Text('Closing stock (stock returned to store):',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 8),
                ..._closingStock.map((s) => Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Row(
                        children: [
                          Expanded(
                            flex: 3,
                            child: Text(
                                '${s['item_name']} (${s['item_sku']})',
                                style: const TextStyle(fontSize: 13)),
                          ),
                          Text(
                              'Issued: ${s['issued_quantity']} ${s['unit']}  ',
                              style: const TextStyle(
                                  color: AppColors.kTextSecondary,
                                  fontSize: 12)),
                          Expanded(
                            child: TextFormField(
                              controller: s['closing_controller']
                                  as TextEditingController,
                              keyboardType: TextInputType.number,
                              decoration: const InputDecoration(
                                  labelText: 'Closing qty', isDense: true),
                            ),
                          ),
                        ],
                      ),
                    )),
              ],
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () {
            final entries = _entryActuals
                .map((e) => {
                      'entry_id': e['entry_id'],
                      'actual_quantity': double.tryParse(
                              (e['actual_controller']
                                      as TextEditingController)
                                  .text) ??
                          0,
                    })
                .toList();
            final closingStock = _closingStock
                .map((s) => {
                      'item_sku': s['item_sku'],
                      'item_name': s['item_name'],
                      'issued_quantity': s['issued_quantity'],
                      'unit': s['unit'],
                      'closing_quantity': double.tryParse(
                              (s['closing_controller']
                                      as TextEditingController)
                                  .text) ??
                          0,
                    })
                .toList();
            Navigator.pop(context, {
              'entries': entries,
              'closing_stock': closingStock,
            });
          },
          child: const Text('Close Session'),
        ),
      ],
    );
  }
}

class _KitchenSnapshot {
  const _KitchenSnapshot({
    required this.stats,
    required this.stock,
    required this.ledger,
    required this.manualLedger,
    required this.receipts,
    required this.portionTracking,
    required this.varianceLogs,
    required this.requisitions,
    required this.recipes,
    required this.usage,
    required this.wastage,
    required this.foodControls,
    required this.portionStock,
    required this.expectedPortions,
    required this.varianceReasons,
    required this.variance,
    required this.yieldReport,
    required this.lossReport,
    required this.sessions,
    required this.recipesWithIngredients,
    required this.staffProfiles,
    required this.spoilage,
    required this.pendingShiftConfirmations,
  });

  factory _KitchenSnapshot.empty() => const _KitchenSnapshot(
        stats: {},
        stock: [],
        ledger: [],
        manualLedger: [],
        receipts: [],
        portionTracking: [],
        varianceLogs: [],
        requisitions: [],
        recipes: [],
        usage: [],
        wastage: [],
        foodControls: [],
        portionStock: [],
        expectedPortions: [],
        varianceReasons: [],
        variance: [],
        yieldReport: [],
        lossReport: [],
        sessions: [],
        recipesWithIngredients: [],
        staffProfiles: [],
        spoilage: [],
        pendingShiftConfirmations: [],
      );

  final Map<String, dynamic> stats;
  final List<Map<String, dynamic>> stock;
  final List<Map<String, dynamic>> ledger;
  final List<Map<String, dynamic>> manualLedger;
  final List<Map<String, dynamic>> receipts;
  final List<Map<String, dynamic>> portionTracking;
  final List<Map<String, dynamic>> varianceLogs;
  final List<Map<String, dynamic>> requisitions;
  final List<Map<String, dynamic>> recipes;
  final List<Map<String, dynamic>> usage;
  final List<Map<String, dynamic>> wastage;
  final List<Map<String, dynamic>> foodControls;
  final List<Map<String, dynamic>> portionStock;
  final List<Map<String, dynamic>> expectedPortions;
  final List<Map<String, dynamic>> varianceReasons;
  final List<Map<String, dynamic>> variance;
  final List<Map<String, dynamic>> yieldReport;
  final List<Map<String, dynamic>> lossReport;
  final List<Map<String, dynamic>> sessions;
  final List<Map<String, dynamic>> recipesWithIngredients;
  final List<Map<String, dynamic>> staffProfiles;
  final List<Map<String, dynamic>> spoilage;
  final List<Map<String, dynamic>> pendingShiftConfirmations;
}

class _Page extends StatelessWidget {
  const _Page({
    required this.title,
    required this.subtitle,
    required this.child,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final Widget child;
  final List<Widget> actions;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 16,
            runSpacing: 12,
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(
                width: 520,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: Theme.of(context).textTheme.headlineSmall),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: const TextStyle(color: AppColors.kTextSecondary),
                    ),
                  ],
                ),
              ),
              Wrap(spacing: 8, runSpacing: 8, children: actions),
            ],
          ),
          const SizedBox(height: 24),
          child,
        ],
      ),
    );
  }
}

class _Toolbar extends StatelessWidget {
  const _Toolbar({
    this.searchHint,
    this.searchValue = '',
    this.onSearch,
    this.filters = const [],
  });

  final String? searchHint;
  final String searchValue;
  final ValueChanged<String>? onSearch;
  final List<Widget> filters;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        if (onSearch != null)
          SizedBox(
            width: 280,
            child: TextField(
              controller: TextEditingController(text: searchValue)
                ..selection =
                    TextSelection.collapsed(offset: searchValue.length),
              decoration: InputDecoration(
                hintText: searchHint ?? 'Search',
                prefixIcon: const Icon(Icons.search, size: 18),
                isDense: true,
              ),
              onSubmitted: onSearch,
            ),
          ),
        ...filters,
      ],
    );
  }
}

class _ChipSelect extends StatelessWidget {
  const _ChipSelect({
    required this.value,
    required this.values,
    required this.onChanged,
  });

  final String value;
  final Map<String, String> values;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: values.entries
          .map(
            (entry) => ChoiceChip(
              label: Text(entry.value),
              selected: entry.key == value,
              onSelected: (_) => onChanged(entry.key),
            ),
          )
          .toList(),
    );
  }
}

class _StatTile extends StatelessWidget {
  const _StatTile(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 190,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value.isEmpty ? '-' : value,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: const TextStyle(
                  color: AppColors.kTextSecondary,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 12),
            child,
          ],
        ),
      ),
    );
  }
}

class _ActivitySection extends StatelessWidget {
  const _ActivitySection({required this.title, required this.children});
  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 4),
          ...children,
          const Divider(),
        ],
      ),
    );
  }
}

class _SimpleRows extends StatelessWidget {
  const _SimpleRows({
    required this.rows,
    required this.empty,
    required this.title,
    required this.subtitle,
    this.trailing,
  });

  final List<Map<String, dynamic>> rows;
  final String empty;
  final String Function(Map<String, dynamic>) title;
  final String Function(Map<String, dynamic>) subtitle;
  final Widget Function(Map<String, dynamic>)? trailing;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) return EmptyState(message: empty);
    return Card(
      margin: EdgeInsets.zero,
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: rows.length,
        separatorBuilder: (_, __) => const Divider(height: 1),
        itemBuilder: (context, index) {
          final row = rows[index];
          return ListTile(
            title: Text(title(row)),
            subtitle: Text(subtitle(row)),
            trailing: trailing?.call(row),
          );
        },
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.filled = false,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    if (filled) {
      return FilledButton.icon(
        onPressed: onPressed,
        icon: Icon(icon, size: 18),
        label: Text(label),
      );
    }
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 190,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: 18),
        label: Text(label, maxLines: 2, overflow: TextOverflow.ellipsis),
      ),
    );
  }
}

class _RowAction {
  const _RowAction(this.label, this.icon, this.onTap);
  final String label;
  final IconData icon;
  final VoidCallback onTap;
}

class _RowActions extends StatelessWidget {
  const _RowActions({required this.actions});
  final List<_RowAction> actions;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<int>(
      icon: const Icon(Icons.more_vert),
      itemBuilder: (context) => [
        for (var i = 0; i < actions.length; i++)
          PopupMenuItem(
            value: i,
            child: Row(
              children: [
                Icon(actions[i].icon, size: 16),
                const SizedBox(width: 8),
                Text(actions[i].label),
              ],
            ),
          ),
      ],
      onSelected: (index) => actions[index].onTap(),
    );
  }
}

class _RecipeCard extends StatelessWidget {
  const _RecipeCard({
    required this.row,
    required this.onEdit,
    required this.onDelete,
    required this.onLock,
  });

  final Map<String, dynamic> row;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback onLock;

  @override
  Widget build(BuildContext context) {
    final ingredients = _rows(row['ingredients']);
    final locked = '${row['is_locked'] ?? false}' == 'true';
    return SizedBox(
      width: 320,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.menu_book_outlined),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _value(row, ['menu_item_name', 'name']),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text('Portion: ${_value(row, [
                    'portion_size'
                  ])} • Ingredients: ${ingredients.length}'),
              Text(
                  'Cost ${_money(row['standard_cost'])} • Food cost ${_value(row, [
                    'food_cost_percentage'
                  ])}%'),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: onEdit,
                    icon: const Icon(Icons.edit_outlined, size: 16),
                    label: const Text('Edit'),
                  ),
                  OutlinedButton.icon(
                    onPressed: onLock,
                    icon: Icon(locked ? Icons.lock_open : Icons.lock, size: 16),
                    label: Text(locked ? 'Unlock' : 'Lock'),
                  ),
                  IconButton(
                    tooltip: 'Deactivate',
                    onPressed: onDelete,
                    icon: const Icon(Icons.delete_outline),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StockDropdown extends StatefulWidget {
  const _StockDropdown({
    required this.stock,
    required this.value,
    required this.onChanged,
  });

  final List<Map<String, dynamic>> stock;
  final String? value;
  final ValueChanged<String?> onChanged;

  @override
  State<_StockDropdown> createState() => _StockDropdownState();
}

class _StockDropdownState extends State<_StockDropdown> {
  String? _value;

  @override
  void initState() {
    super.initState();
    _value = widget.value?.isEmpty == true ? null : widget.value;
  }

  @override
  Widget build(BuildContext context) {
    final seen = <String>{};
    final items = widget.stock
        .where((row) {
          final sku = _valueOf(row, ['item_sku', 'sku']);
          return sku.isNotEmpty && seen.add(sku);
        })
        .take(200)
        .map((row) {
          final sku = _valueOf(row, ['item_sku', 'sku']);
          return DropdownMenuItem<String>(
            value: sku,
            child: Text('${_valueOf(row, ['item_name', 'name'])} ($sku)'),
          );
        })
        .toList();
    if (_value != null && !seen.contains(_value)) _value = null;
    return DropdownButtonFormField<String>(
      initialValue: _value,
      decoration: const InputDecoration(labelText: 'Stock item'),
      items: items,
      onChanged: (value) {
        setState(() => _value = value);
        widget.onChanged(value);
      },
    );
  }
}

class _YieldCalculator extends StatefulWidget {
  const _YieldCalculator({required this.rules, required this.onCalculate});

  final List<Map<String, dynamic>> rules;
  final Future<void> Function(String id, double input) onCalculate;

  @override
  State<_YieldCalculator> createState() => _YieldCalculatorState();
}

class _YieldCalculatorState extends State<_YieldCalculator> {
  String? _ruleId;
  final _input = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final rules = widget.rules.where((row) => row['id'] != null).toList();
    _ruleId ??= rules.isEmpty ? null : '${rules.first['id']}';
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        SizedBox(
          width: 280,
          child: DropdownButtonFormField<String>(
            initialValue: _ruleId,
            decoration: const InputDecoration(labelText: 'Yield rule'),
            items: rules
                .map((row) => DropdownMenuItem(
                      value: '${row['id']}',
                      child: Text('${_valueOf(row, [
                            'raw_item_name'
                          ])} → ${_valueOf(row, ['produced_item_name'])}'),
                    ))
                .toList(),
            onChanged: (value) => setState(() => _ruleId = value),
          ),
        ),
        SizedBox(
          width: 160,
          child: TextField(
            controller: _input,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Raw input'),
          ),
        ),
        FilledButton.icon(
          onPressed: _ruleId == null
              ? null
              : () => widget.onCalculate(_ruleId!, _num(_input.text)),
          icon: const Icon(Icons.calculate_outlined, size: 16),
          label: const Text('Calculate'),
        ),
      ],
    );
  }
}

class _IngredientEditor extends StatefulWidget {
  const _IngredientEditor({required this.stock, required this.ingredients});

  final List<Map<String, dynamic>> stock;
  final List<Map<String, dynamic>> ingredients;

  @override
  State<_IngredientEditor> createState() => _IngredientEditorState();
}

class _IngredientEditorState extends State<_IngredientEditor> {
  String? _sku;
  final _qty = TextEditingController();
  final _unitCost = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Ingredients',
      child: Column(
        children: [
          _StockDropdown(
            stock: widget.stock,
            value: _sku,
            onChanged: (value) => setState(() => _sku = value),
          ),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _qty,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration:
                      const InputDecoration(labelText: 'Qty per portion'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: _unitCost,
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Unit cost'),
                ),
              ),
              IconButton(
                tooltip: 'Add ingredient',
                onPressed: () {
                  if (_sku == null || _sku!.isEmpty) return;
                  final stock = _findStock(widget.stock, _sku);
                  setState(() {
                    widget.ingredients.add({
                      'item_sku': _sku,
                      'item_name': _valueOf(stock, ['item_name', 'name']),
                      'quantity_per_portion': _num(_qty.text),
                      'unit_of_measure':
                          _valueOf(stock, ['unit_of_measure']).ifEmpty('unit'),
                      'unit_cost': _num(_unitCost.text),
                    });
                    _qty.clear();
                    _unitCost.clear();
                  });
                },
                icon: const Icon(Icons.add),
              ),
            ],
          ),
          ...widget.ingredients.map(
            (line) => ListTile(
              dense: true,
              title: Text(_valueOf(line, ['item_name', 'item_sku'])),
              subtitle: Text(
                  '${line['quantity_per_portion']} ${line['unit_of_measure']} • ${_money(line['unit_cost'])}'),
              trailing: IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => setState(() {
                  widget.ingredients.remove(line);
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FieldSpec {
  const _FieldSpec(
    this.key,
    this.label, {
    this.number = false,
    this.maxLines = 1,
  });

  final String key;
  final String label;
  final bool number;
  final int maxLines;
}

class _FormBag {
  _FormBag(Map<String, String> initial) : values = Map.of(initial);

  final Map<String, String> values;
  final Map<String, TextEditingController> _controllers = {};

  TextEditingController controller(String key) {
    return _controllers.putIfAbsent(
      key,
      () => TextEditingController(text: values[key] ?? '')
        ..addListener(() {
          values[key] = _controllers[key]?.text ?? '';
        }),
    );
  }

  Map<String, dynamic> numeric(List<String> keys) {
    return values.map((key, value) {
      if (keys.contains(key)) return MapEntry(key, _num(value));
      return MapEntry(key, value);
    });
  }
}

extension _StringX on String {
  String ifEmpty(String fallback) => trim().isEmpty ? fallback : this;
  String capitalize() =>
      isEmpty ? this : '${this[0].toUpperCase()}${substring(1)}';
}

List<Map<String, dynamic>> _rows(dynamic data) {
  if (data is List) {
    return data
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }
  if (data is Map) return [Map<String, dynamic>.from(data)];
  return <Map<String, dynamic>>[];
}

Map<String, dynamic> _findStock(List<Map<String, dynamic>> stock, String? sku) {
  if (sku == null) return {};
  return stock.firstWhere(
    (row) => _valueOf(row, ['item_sku', 'sku']) == sku,
    orElse: () => {},
  );
}

String _value(Map<String, dynamic> row, List<String> keys) =>
    _valueOf(row, keys);

String _valueOf(Map<dynamic, dynamic> row, List<String> keys) {
  for (final key in keys) {
    final value = row[key];
    if (value != null && '$value'.trim().isNotEmpty) return '$value';
  }
  return '';
}

double _num(dynamic value) {
  if (value is num) return value.toDouble();
  return double.tryParse('$value'.replaceAll(',', '')) ?? 0;
}

String _money(dynamic value) => 'KES ${_num(value).toStringAsFixed(2)}';

String _isoDate(DateTime date) => date.toIso8601String().split('T').first;

// ── Chef Confirmation Dialog ────────────────────────────────────────────────

class _ChefConfirmDialog extends StatefulWidget {
  const _ChefConfirmDialog({required this.detail});
  final Map<String, dynamic> detail;

  @override
  State<_ChefConfirmDialog> createState() => _ChefConfirmDialogState();
}

class _ChefConfirmDialogState extends State<_ChefConfirmDialog> {
  final _notesCtrl = TextEditingController();

  @override
  void dispose() {
    _notesCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final shift = (widget.detail['shift'] as Map?)?.cast<String, dynamic>() ?? {};
    final productions = (widget.detail['productions'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    final stockTake = (widget.detail['stock_take'] as List?)?.cast<Map<String, dynamic>>() ?? [];

    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640, maxHeight: 640),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('${shift['shift_number'] ?? 'Shift'}',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
              Text('${shift['shift_date'] ?? ''}', style: const TextStyle(color: Colors.grey)),
              const SizedBox(height: 16),
              Text('Production (${productions.length})', style: const TextStyle(fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              Flexible(
                child: productions.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Text('No production recorded.', style: TextStyle(color: Colors.grey)),
                      )
                    : ListView.builder(
                        shrinkWrap: true,
                        itemCount: productions.length,
                        itemBuilder: (ctx, i) {
                          final p = productions[i];
                          return ListTile(
                            dense: true,
                            title: Text('${p['raw_item_name']} → ${p['produced_item_name']}', style: const TextStyle(fontSize: 13)),
                            subtitle: Text(
                              '${p['raw_quantity_used']} ${p['raw_unit']} used → ${p['produced_quantity']} ${p['produced_unit']}',
                              style: const TextStyle(fontSize: 12),
                            ),
                          );
                        },
                      ),
              ),
              if (stockTake.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text('Variance', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                Flexible(
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: stockTake.length,
                    itemBuilder: (ctx, i) {
                      final st = stockTake[i];
                      final variance = _num(st['variance']);
                      return ListTile(
                        dense: true,
                        title: Text('${st['item_name'] ?? st['item_sku']}', style: const TextStyle(fontSize: 13)),
                        subtitle: Text(
                          'System ${_num(st['system_closing_stock']).toStringAsFixed(2)} · Physical ${_num(st['physical_count']).toStringAsFixed(2)}',
                          style: const TextStyle(fontSize: 12),
                        ),
                        trailing: Text(
                          '${variance >= 0 ? '+' : ''}${variance.toStringAsFixed(2)}',
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: variance == 0 ? Colors.grey : (variance > 0 ? Colors.green : Colors.red),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ],
              const SizedBox(height: 12),
              TextField(
                controller: _notesCtrl,
                decoration: const InputDecoration(labelText: 'Notes (optional)', border: OutlineInputBorder()),
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => Navigator.pop(context, {'confirmed': false, 'notes': _notesCtrl.text}),
                      icon: const Icon(Icons.cancel_outlined, color: Colors.red),
                      label: const Text('Reject'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => Navigator.pop(context, {'confirmed': true, 'notes': _notesCtrl.text}),
                      icon: const Icon(Icons.check),
                      label: const Text('Confirm Production'),
                      style: FilledButton.styleFrom(backgroundColor: Colors.green),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
