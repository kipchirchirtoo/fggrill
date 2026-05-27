import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/master_dashboard_shell.dart';
import '../../../core/widgets/widgets.dart' hide DataColumn, DataRow;
import '../data/repository.dart';

enum KitchenOperationsSection {
  overview,
  stock,
  requisitions,
  recipes,
  usage,
  wastage,
  foodControls,
}

enum KitchenFoodTab { rules, portions, variance, reports }

class KitchenOperationsDashboard extends ConsumerStatefulWidget {
  const KitchenOperationsDashboard({
    super.key,
    this.initialSection = KitchenOperationsSection.overview,
    this.stockSku,
    this.initialFoodTab = KitchenFoodTab.rules,
  });

  final KitchenOperationsSection initialSection;
  final String? stockSku;
  final KitchenFoodTab initialFoodTab;

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
      _safe(_repo.getRequisitions(status: _requisitionStatus),
          <Map<String, dynamic>>[]),
      _safe(_repo.getRecipes(), <Map<String, dynamic>>[]),
      _safe(_repo.getUsage(usageType: _usageType), <Map<String, dynamic>>[]),
      _safe(_repo.getWastage(reason: _wastageReason), <Map<String, dynamic>>[]),
      _safe(_repo.getFoodControls(), <Map<String, dynamic>>[]),
      _safe(_repo.getPortionStock(), <Map<String, dynamic>>[]),
      _safe(_repo.getVarianceReasons(), <Map<String, dynamic>>[]),
      _safe(_repo.getVariance(), <Map<String, dynamic>>[]),
      _safe(_repo.getYieldReport(startDate: startDate, endDate: endDate),
          <Map<String, dynamic>>[]),
      _safe(_repo.getLossReport(startDate: startDate, endDate: endDate),
          <Map<String, dynamic>>[]),
    ]);
    return _KitchenSnapshot(
      stats: Map<String, dynamic>.from(results[0] as Map),
      stock: _rows(results[1]),
      ledger: _rows(results[2]),
      manualLedger: _rows(results[3]),
      requisitions: _rows(results[4]),
      recipes: _rows(results[5]),
      usage: _rows(results[6]),
      wastage: _rows(results[7]),
      foodControls: _rows(results[8]),
      portionStock: _rows(results[9]),
      varianceReasons: _rows(results[10]),
      variance: _rows(results[11]),
      yieldReport: _rows(results[12]),
      lossReport: _rows(results[13]),
    );
  }

  Future<T> _safe<T>(Future<T> future, T fallback) async {
    try {
      return await future;
    } catch (_) {
      return fallback;
    }
  }

  void _refresh() {
    setState(() => _future = _load());
  }

  void _selectSection(KitchenOperationsSection section) {
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
    }
  }

  @override
  Widget build(BuildContext context) {
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
      child: FutureBuilder<_KitchenSnapshot>(
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
      ),
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
    final items = _rows(detail['items']);
    await showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(_value(detail, ['requisition_number', 'id'])),
        content: SizedBox(
          width: 680,
          child: _SimpleRows(
            rows: items,
            empty: 'No requisition lines found.',
            title: (line) => _value(line, ['item_name', 'item_sku']),
            subtitle: (line) => 'Requested ${_value(line, [
                  'requested_quantity'
                ])}, Approved ${_value(line, [
                  'approved_quantity'
                ])}, Issued ${_value(line, [
                  'issued_quantity'
                ])} ${_value(line, ['unit_of_measure'])}',
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
    final form = _FormBag({
      'item_sku': _value(existing ?? {}, ['item_sku']),
      'item_name': _value(existing ?? {}, ['item_name']),
      'quantity': _value(existing ?? {}, ['quantity']),
      'unit_of_measure':
          _value(existing ?? {}, ['unit_of_measure']).ifEmpty('kg'),
      'reason': _value(existing ?? {}, ['reason']).ifEmpty('SPOILAGE'),
      'estimated_value': _value(existing ?? {}, ['estimated_value']),
      'shift': _value(existing ?? {}, ['shift']).ifEmpty('DAY'),
      'photo_url': _value(existing ?? {}, ['photo_url']),
    });
    final saved = await _showFormDialog(
      title: existing == null ? 'Record Wastage' : 'Edit Wastage',
      form: form,
      stock: stock,
      stockField: 'item_sku',
      fields: const [
        _FieldSpec('item_name', 'Item name'),
        _FieldSpec('quantity', 'Quantity', number: true),
        _FieldSpec('unit_of_measure', 'Unit'),
        _FieldSpec('reason', 'Reason'),
        _FieldSpec('estimated_value', 'Estimated value', number: true),
        _FieldSpec('shift', 'Shift'),
        _FieldSpec('photo_url', 'Photo URL'),
      ],
    );
    if (saved == null) return;
    await _run(() {
      final payload = form.numeric(['quantity', 'estimated_value']);
      return existing == null
          ? _repo.recordWastage(payload)
          : _repo.updateWastage('${existing['id']}', payload);
    });
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

class _KitchenSnapshot {
  const _KitchenSnapshot({
    required this.stats,
    required this.stock,
    required this.ledger,
    required this.manualLedger,
    required this.requisitions,
    required this.recipes,
    required this.usage,
    required this.wastage,
    required this.foodControls,
    required this.portionStock,
    required this.varianceReasons,
    required this.variance,
    required this.yieldReport,
    required this.lossReport,
  });

  factory _KitchenSnapshot.empty() => const _KitchenSnapshot(
        stats: {},
        stock: [],
        ledger: [],
        manualLedger: [],
        requisitions: [],
        recipes: [],
        usage: [],
        wastage: [],
        foodControls: [],
        portionStock: [],
        varianceReasons: [],
        variance: [],
        yieldReport: [],
        lossReport: [],
      );

  final Map<String, dynamic> stats;
  final List<Map<String, dynamic>> stock;
  final List<Map<String, dynamic>> ledger;
  final List<Map<String, dynamic>> manualLedger;
  final List<Map<String, dynamic>> requisitions;
  final List<Map<String, dynamic>> recipes;
  final List<Map<String, dynamic>> usage;
  final List<Map<String, dynamic>> wastage;
  final List<Map<String, dynamic>> foodControls;
  final List<Map<String, dynamic>> portionStock;
  final List<Map<String, dynamic>> varianceReasons;
  final List<Map<String, dynamic>> variance;
  final List<Map<String, dynamic>> yieldReport;
  final List<Map<String, dynamic>> lossReport;
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
