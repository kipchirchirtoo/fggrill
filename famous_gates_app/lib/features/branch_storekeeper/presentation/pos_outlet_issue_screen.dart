import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../core/theme/app_theme.dart';
import '../data/branch_storekeeper_repository.dart';

/// Standalone POS Outlet Issue screen, extracted from the branch storekeeper
/// dashboard monolith. Combines the previous "POS Outlet Issue" and
/// "Outlet Production" sections into tabs, plus a dedicated issue-history tab.
///
/// All branch-wide state (stock, outlets, movements) is owned by the
/// dashboard and passed in here; mutations call back into the dashboard via
/// [onRefresh] so the single source of truth never moves.
class PosOutletIssueScreen extends ConsumerStatefulWidget {
  const PosOutletIssueScreen({
    super.key,
    required this.outlets,
    required this.selectedOutletId,
    required this.onSelectOutlet,
    required this.branchStock,
    required this.movements,
    required this.outletItemsLoading,
    required this.search,
    required this.onSearchChanged,
    required this.onRefresh,
    required this.onViewDetail,
    required this.stockForOutlet,
    required this.outletDisplayName,
  });

  final List<Map<String, dynamic>> outlets;
  final String? selectedOutletId;
  final ValueChanged<String> onSelectOutlet;
  final List<Map<String, dynamic>> branchStock;
  final List<Map<String, dynamic>> movements;
  final bool outletItemsLoading;
  final String search;
  final ValueChanged<String> onSearchChanged;
  final VoidCallback onRefresh;
  final void Function(String title, Map<String, dynamic> data) onViewDetail;
  final List<Map<String, dynamic>> Function(String? outletId) stockForOutlet;
  final String Function(Map<String, dynamic>) outletDisplayName;

  @override
  ConsumerState<PosOutletIssueScreen> createState() =>
      _PosOutletIssueScreenState();
}

class _PosOutletIssueScreenState extends ConsumerState<PosOutletIssueScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  bool _bulkIssuingBar = false;

  static const _barOutlets = {
    'main_bar': 'Main Bar',
    'executive_bar': 'Executive Bar',
    'kyogong_executive_bar': 'Executive Bar',
    'sports_bar': 'Sports Bar',
    'kyogong_sports_bar': 'Sports Bar',
  };

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  BranchStorekeeperRepository get _repo =>
      ref.read(branchStorekeeperRepositoryProvider);

  Map<String, dynamic>? get _selectedOutlet {
    final outlets = widget.outlets;
    if (outlets.isEmpty) return null;
    return outlets.firstWhere(
      (row) => _outletId(row) == widget.selectedOutletId,
      orElse: () => outlets.first,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Material(
          color: AppColors.kSurface,
          child: TabBar(
            controller: _tabController,
            isScrollable: true,
            tabs: const [
              Tab(text: 'Issue Stock'),
              Tab(text: 'Outlet Production Ledger'),
              Tab(text: 'Issue History'),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _issueStockTab(),
              _productionLedgerTab(),
              _issueHistoryTab(),
            ],
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // Tab 1: Issue Stock
  // ---------------------------------------------------------------------

  Widget _issueStockTab() {
    final outlets = widget.outlets;
    final selected = _selectedOutlet;
    final selectedId = selected == null ? null : _outletId(selected);
    final query = widget.search.trim().toLowerCase();
    final branchRows = widget.branchStock.where((item) {
      if (query.isEmpty) return true;
      final haystack = [
        _itemName(item),
        _optionSku(item),
        item['category'],
        item['unit_of_measure'],
        item['unit'],
      ].join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();
    final destinationRows = widget.stockForOutlet(selectedId);
    final branchValue = branchRows.fold<num>(
      0,
      (sum, item) => sum +
          (_num(item['quantity']) *
              _num(item['cost_price'] ?? item['unit_price'])),
    );
    final available =
        branchRows.where((item) => _num(item['quantity']) > 0).length;
    final lowStock = branchRows.where((item) {
      final reorder = _num(item['reorder_level'] ?? item['minimum_stock']);
      return reorder > 0 && _num(item['quantity']) <= reorder;
    }).length;
    final isBarSelected = selected != null &&
        (_outletType(selected).contains('bar') ||
            _barOutlets.containsKey(_outletType(selected)) ||
            widget.outletDisplayName(selected).toLowerCase().contains('bar'));

    return _Page(
      title: 'POS Outlet Issue',
      subtitle: isBarSelected
          ? 'Bar Stock Transfer — Issue branch store stock directly to the bar counter. No production or recipes required.'
          : 'POS outlet means a selling point such as Restaurant POS, Main Bar, Executive Bar, Sports Bar, kitchen pass, or cashier outlet. This screen issues branch-store stock into that outlet sellable counter.',
      actions: [
        _RefreshButton(onPressed: widget.onRefresh),
        FilledButton.icon(
          onPressed:
              selected == null ? null : () => _showIssueForm(selected),
          icon: Icon(isBarSelected
              ? Icons.local_bar_outlined
              : PhosphorIcons.package()),
          label:
              Text(isBarSelected ? 'Transfer to Bar' : 'Issue to POS Outlet'),
          style: isBarSelected
              ? FilledButton.styleFrom(backgroundColor: Colors.amber.shade700)
              : null,
        ),
        if (isBarSelected)
          OutlinedButton.icon(
            onPressed: selected == null || _bulkIssuingBar
                ? null
                : () => _issueAllBarStock(selected),
            icon: _bulkIssuingBar
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.playlist_add_check_circle_outlined),
            label: Text(_bulkIssuingBar ? 'Issuing All...' : 'Issue All'),
          ),
      ],
      children: [
        if (isBarSelected)
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.amber.shade300),
            ),
            child: Row(
              children: [
                Icon(Icons.local_bar_outlined,
                    color: Colors.amber.shade800, size: 26),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Bar Flow: Select items from branch stock → Transfer to bar counter → '
                    'Bar stock increases → Cashier sells → Stock decrements. '
                    'When bar runs low, come back here and transfer more.',
                    style: TextStyle(
                        color: Colors.amber.shade900,
                        fontSize: 13,
                        fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        _SectionCard(
          title: 'POS Outlets',
          subtitle: isBarSelected
              ? 'Select the bar counter to transfer stock into.'
              : 'Choose the salable outlet first. Every issue updates that outlet, not generic branch stock.',
          child: outlets.isEmpty
              ? const _EmptyState(
                  'No POS outlets configured for this branch. Create or sync POS outlets first.')
              : Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: outlets.map((outlet) {
                    final id = _outletId(outlet);
                    final rows = widget.stockForOutlet(id);
                    return ChoiceChip(
                      selected: id == selectedId,
                      label: Text(
                        '${widget.outletDisplayName(outlet)} (${rows.length})',
                        overflow: TextOverflow.ellipsis,
                      ),
                      avatar: const Icon(Icons.storefront_outlined, size: 18),
                      onSelected: (_) => widget.onSelectOutlet(id),
                    );
                  }).toList(),
                ),
        ),
        _SectionCard(
          title: 'Search Branch Stock',
          child: TextField(
            controller: TextEditingController(text: widget.search)
              ..selection =
                  TextSelection.collapsed(offset: widget.search.length),
            decoration: InputDecoration(
              labelText: selected == null
                  ? 'Search branch stock by item, SKU or category'
                  : 'Search branch stock to issue to ${widget.outletDisplayName(selected)}',
              prefixIcon: const Icon(Icons.search),
            ),
            onChanged: widget.onSearchChanged,
          ),
        ),
        _StatGrid(cards: [
          _StatCardData('Branch Stock SKUs', '${branchRows.length}',
              PhosphorIcons.package(), AppColors.kPrimary),
          _StatCardData('Available', '$available', PhosphorIcons.checkCircle(),
              AppColors.kSuccess),
          _StatCardData('Low / Zero', '$lowStock', PhosphorIcons.warning(),
              AppColors.kWarning),
          _StatCardData('Source Stock Value', _money(branchValue),
              PhosphorIcons.coins(), Colors.teal),
        ]),
        _SectionCard(
          title: selected == null
              ? 'Branch Stock Available for Outlet Issue'
              : 'Branch Stock Available for ${widget.outletDisplayName(selected)}',
          subtitle:
              'This is the source stock. Posting an issue deducts branch stock and writes movement audit logs.',
          child: _RecordList(
            emptyText: selected == null
                ? 'No outlet selected'
                : 'No branch stock available for outlet issue',
            children: branchRows.take(150).map((item) {
              final qty = _num(item['quantity']);
              final matchedOutletItem = selectedId == null
                  ? null
                  : _matchingOutletItemForSource(selectedId, item);
              return _RecordTile(
                icon: PhosphorIcons.package(),
                title: _itemName(item),
                subtitle:
                    '${_optionSku(item)} | Available ${_qtyText(qty)} ${item['unit_of_measure'] ?? item['unit'] ?? 'units'} | ${item['category'] ?? '-'}\n'
                    'Destination match: ${matchedOutletItem == null ? 'not configured in outlet stock' : _outletItemName(matchedOutletItem)}',
                trailing: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${_qtyText(qty)} ${item['unit_of_measure'] ?? item['unit'] ?? 'units'}',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    Text(
                      _money(qty * _num(item['cost_price'] ?? item['unit_price'])),
                      style: const TextStyle(
                        color: AppColors.kTextSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
                actions: [
                  TextButton(
                    onPressed: selected == null
                        ? null
                        : () => _showIssueForm(selected, presetOutput: item),
                    child: const Text('Issue'),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
        _SectionCard(
          title: selected == null
              ? 'Current Outlet Stock'
              : 'Current ${widget.outletDisplayName(selected)} Stock',
          subtitle:
              'Destination stock after previous issues and outlet sales. This is shown for audit context only.',
          child: _RecordList(
            emptyText: selected == null
                ? 'Select an outlet to view destination stock'
                : 'No destination outlet stock rows found',
            children: destinationRows.take(100).map((item) {
              final qty = _num(item['current_stock'] ?? item['quantity']);
              return _RecordTile(
                icon: Icons.storefront_outlined,
                title: _outletItemName(item),
                subtitle:
                    '${_outletItemSku(item)} | ${_movementLabel(_outletType(item))} | ${item['category'] ?? '-'}',
                trailing: Text(
                  '${_qtyText(qty)} ${item['unit'] ?? 'units'}',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // Tab 2: Outlet Production Ledger
  // ---------------------------------------------------------------------

  Widget _productionLedgerTab() {
    final productionMovements = widget.movements.where((movement) {
      final type = '${movement['movement_type'] ?? movement['movementType']}';
      return type.contains('production');
    }).toList();
    final outputs = productionMovements
        .where((movement) =>
            '${movement['movement_type'] ?? movement['movementType']}'
                .contains('output'))
        .toList();
    final inputs = productionMovements
        .where((movement) =>
            '${movement['movement_type'] ?? movement['movementType']}'
                .contains('consumption'))
        .toList();
    final producedQty =
        outputs.fold<num>(0, (sum, row) => sum + _num(row['quantity']));
    final consumedQty =
        inputs.fold<num>(0, (sum, row) => sum + _num(row['quantity']));
    final outlets = widget.outlets;
    final selectedOutlet = _selectedOutlet;
    final selectedOutletId =
        selectedOutlet == null ? null : _outletId(selectedOutlet);
    final selectedOutletDropdownId =
        outlets.any((outlet) => _outletId(outlet) == selectedOutletId)
            ? selectedOutletId
            : null;
    final outletItems = selectedOutletId == null
        ? <Map<String, dynamic>>[]
        : widget
            .stockForOutlet(selectedOutletId)
            .where((item) => _outletItemId(item).isNotEmpty)
            .toList();
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    bool isTodayMovement(Map<String, dynamic> row) {
      final rawDate = row['created_at'] ??
          row['createdAt'] ??
          row['timestamp'] ??
          row['date'];
      final parsed = DateTime.tryParse('$rawDate');
      if (parsed == null) return false;
      final local = parsed.toLocal();
      return !local.isBefore(today) &&
          local.isBefore(today.add(const Duration(days: 1)));
    }

    num producedTodayFor(Map<String, dynamic> item) {
      final itemId = _outletItemId(item);
      final sku = _outletItemSku(item);
      return outputs.fold<num>(0, (sum, row) {
        if (!isTodayMovement(row)) return sum;
        final meta = _dynamicMap(row['metadata']);
        final matchesId =
            itemId.isNotEmpty && '${meta['outlet_item_id'] ?? ''}' == itemId;
        final matchesSku =
            sku.isNotEmpty && '${row['item_sku'] ?? row['sku'] ?? ''}' == sku;
        return matchesId || matchesSku ? sum + _num(row['quantity']) : sum;
      });
    }

    final isBarOutlet = selectedOutlet != null &&
        (_outletType(selectedOutlet).contains('bar') ||
            _barOutlets.containsKey(_outletType(selectedOutlet)) ||
            widget
                .outletDisplayName(selectedOutlet)
                .toLowerCase()
                .contains('bar'));

    final filteredItems = outletItems.where((item) {
      final query = widget.search.toLowerCase().trim();
      if (query.isEmpty) return true;
      return [
        _outletItemName(item),
        _outletItemSku(item),
        item['category'],
      ].any((value) => '$value'.toLowerCase().contains(query));
    }).toList();

    return _Page(
      title: 'Outlet Production',
      subtitle: 'Select outlet, enter today produced quantity, commit.',
      actions: [
        _RefreshButton(onPressed: widget.onRefresh),
      ],
      children: [
        _StatGrid(cards: [
          _StatCardData('Production Runs', '${outputs.length}',
              Icons.precision_manufacturing_outlined, AppColors.kPrimary),
          _StatCardData('Raw Consumed', _qtyText(consumedQty),
              PhosphorIcons.trendDown(), AppColors.kError),
          _StatCardData('Output Produced', _qtyText(producedQty),
              PhosphorIcons.trendUp(), AppColors.kSuccess),
          _StatCardData('Menu Items', '${outletItems.length}',
              Icons.storefront_outlined, Colors.teal),
        ]),
        _SectionCard(
          title: 'Stockable Assembly',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: selectedOutletDropdownId,
                      decoration: const InputDecoration(
                        labelText: 'Assembly produced from point',
                        prefixIcon: Icon(Icons.storefront_outlined),
                      ),
                      items: outlets
                          .map(
                            (outlet) => DropdownMenuItem(
                              value: _outletId(outlet),
                              child: Text(
                                widget.outletDisplayName(outlet),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          )
                          .toList(),
                      onChanged: (value) {
                        if (value != null) widget.onSelectOutlet(value);
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  if (widget.outletItemsLoading)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              if (isBarOutlet) ...[
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.amber.shade50,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.amber.shade300),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.local_bar_outlined,
                          color: Colors.amber.shade800, size: 28),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Bar Outlet — Direct Stock Issue',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 15,
                                color: Colors.amber.shade900,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Bar items (beers, spirits, sodas, water, wines) are NOT produced — '
                              'they are issued directly from Branch Stock to the bar counter. '
                              'No portioning or recipe is required. '
                              'Use POS Outlet Issue to transfer stock into this bar.',
                              style: TextStyle(
                                  color: Colors.amber.shade900, fontSize: 13),
                            ),
                            const SizedBox(height: 12),
                            FilledButton.icon(
                              style: FilledButton.styleFrom(
                                  backgroundColor: Colors.amber.shade700),
                              onPressed: () => _tabController.animateTo(0),
                              icon: const Icon(Icons.storefront_outlined,
                                  size: 16),
                              label: const Text('Go to POS Outlet Issue'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ] else ...[
                TextField(
                  onChanged: widget.onSearchChanged,
                  decoration: InputDecoration(
                    hintText: selectedOutlet == null
                        ? 'Search menu item'
                        : 'Search ${widget.outletDisplayName(selectedOutlet)} menu item',
                    prefixIcon: const Icon(Icons.search),
                  ),
                ),
                const SizedBox(height: 12),
                _OutletProductionSheet(
                  items: filteredItems,
                  emptyText: selectedOutlet == null
                      ? 'Select POS outlet first'
                      : 'No menu items found for ${widget.outletDisplayName(selectedOutlet)}',
                  itemName: _outletItemName,
                  itemSku: _outletItemSku,
                  currentStock: producedTodayFor,
                  maxProduce: (item) => item['max_producible_quantity'] == null
                      ? null
                      : _num(item['max_producible_quantity']),
                  qtyText: _qtyText,
                  onCommit: selectedOutlet == null
                      ? null
                      : (item, quantity) => _commitOutletProductionItem(
                            selectedOutlet,
                            item,
                            quantity,
                          ),
                  onToggleTrackStock: selectedOutlet == null
                      ? null
                      : (item, trackStock) => _toggleOutletItemTrackStock(
                            selectedOutlet,
                            item,
                            trackStock,
                          ),
                ),
                const SizedBox(height: 8),
                const Text(
                  '(Double click item line to view production turns)',
                  style: TextStyle(
                    color: AppColors.kError,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ],
            ],
          ),
        ),
        _SectionCard(
          title: 'Recent Production',
          child: _RecordList(
            emptyText: 'No production ledger entries yet',
            children: productionMovements.take(120).map((row) {
              final type = '${row['movement_type'] ?? row['movementType']}';
              final meta =
                  Map<String, dynamic>.from((row['metadata'] as Map?) ?? {});
              final name = meta['item_name'] ??
                  row['item_name'] ??
                  row['sku'] ??
                  row['item_sku'] ??
                  'Production Item';
              return _RecordTile(
                icon: type.contains('output')
                    ? Icons.storefront_outlined
                    : PhosphorIcons.trendDown(),
                title: '$name',
                subtitle:
                    '${_movementLabel(type)} | ${row['document_number'] ?? row['documentNumber'] ?? '-'} | ${_date(row['created_at'])}',
                trailing: _StatusChip(
                  type.contains('output') ? 'POS Stock In' : 'Raw Stock Out',
                  success: type.contains('output'),
                  warning: !type.contains('output'),
                ),
                meta: [
                  _InfoPill('Qty', _qtyText(row['quantity'])),
                  if (meta['batch_reference'] != null)
                    _InfoPill('Batch', '${meta['batch_reference']}'),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // Tab 3: Issue History
  // ---------------------------------------------------------------------

  Widget _issueHistoryTab() {
    final selected = _selectedOutlet;
    final selectedId = selected == null ? null : _outletId(selected);
    final outletIssueMovements = widget.movements.where((movement) {
      final type =
          '${movement['movement_type'] ?? movement['movementType'] ?? movement['type']}'
              .toLowerCase();
      final meta = _dynamicMap(movement['metadata']);
      final destinationOutlet =
          '${movement['destination_outlet_id'] ?? meta['destination_outlet_id'] ?? ''}';
      return type.contains('production') &&
          (destinationOutlet == (selectedId ?? '') ||
              '${meta['source'] ?? ''}'.contains('pos_outlet_issue'));
    }).toList();

    return _Page(
      title: 'Issue History',
      subtitle: selected == null
          ? 'Posted movement records created by branch-stock-to-outlet issues.'
          : 'Posted issue movements for ${widget.outletDisplayName(selected)}.',
      actions: [
        _RefreshButton(onPressed: widget.onRefresh),
      ],
      children: [
        _SectionCard(
          title: 'Recent Outlet Issue Audit',
          subtitle:
              'Posted movement records created by branch-stock-to-outlet issues.',
          child: _RecordList(
            emptyText: 'No recent outlet issue movements',
            children: outletIssueMovements.take(200).map((movement) {
              final qty = _num(movement['quantity'] ??
                  movement['quantity_in'] ??
                  movement['quantity_out']);
              return _RecordTile(
                icon: PhosphorIcons.clipboardText(),
                title:
                    '${movement['item_name'] ?? movement['itemName'] ?? movement['item_sku'] ?? movement['sku'] ?? 'Stock movement'}',
                subtitle:
                    '${movement['movement_type'] ?? movement['movementType'] ?? 'movement'} | ${movement['document_number'] ?? movement['reference_number'] ?? movement['created_at'] ?? ''}',
                trailing: Text(
                  _qtyText(qty),
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                actions: [
                  TextButton(
                    onPressed: () =>
                        widget.onViewDetail('Outlet Issue Movement', movement),
                    child: const Text('View'),
                  ),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  // ---------------------------------------------------------------------
  // Actions (moved from the dashboard — exclusive to this feature)
  // ---------------------------------------------------------------------

  Map<String, dynamic>? _matchingOutletItemForSource(
    String outletId,
    Map<String, dynamic> source,
  ) {
    final sourceSku = _optionSku(source).toLowerCase();
    final sourceName = _itemName(source).toLowerCase();
    final outletItems = widget.stockForOutlet(outletId);
    for (final item in outletItems) {
      if (_outletItemSku(item).toLowerCase() == sourceSku) return item;
    }
    for (final item in outletItems) {
      if (_outletItemName(item).toLowerCase() == sourceName) return item;
    }
    return null;
  }

  // Issues branch stock for every item in a bar outlet in one go, so the
  // whole bar menu becomes sellable on POS without issuing item-by-item.
  // Intended for quickly seeding a bar outlet to test POS in production.
  Future<void> _issueAllBarStock(Map<String, dynamic> outlet) async {
    final outletId = _outletId(outlet);
    final items = widget.stockForOutlet(outletId);
    if (items.isEmpty) {
      _showSnack('No bar items found for ${widget.outletDisplayName(outlet)}',
          error: true);
      return;
    }

    const testQty = 50.0;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Issue All Bar Items'),
        content: Text(
          'Tops up branch stock into all ${items.length} item(s) in '
          '${widget.outletDisplayName(outlet)} (up to ${_qtyText(testQty)} units each, '
          'limited by what is available in branch store) so the whole bar menu '
          'is available to sell on POS. Existing stock is added to, not reduced.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Issue All'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _bulkIssuingBar = true);
    var issuedCount = 0;
    var skippedCount = 0;
    try {
      for (final output in items) {
        final outputSku = _outletItemSku(output);
        final matches = widget.branchStock.where((item) {
          return _optionSku(item) == outputSku ||
              _itemName(item).toLowerCase() ==
                  _outletItemName(output).toLowerCase();
        }).toList();
        if (matches.isEmpty) {
          skippedCount++;
          continue;
        }
        final source = matches.first;
        final availableQty = _num(source['quantity']);
        final qty = availableQty < testQty ? availableQty : testQty;
        if (qty <= 0) {
          skippedCount++;
          continue;
        }
        try {
          await _repo.createProductionRun({
            'destination_outlet_id': outletId,
            'production_area': 'pos_outlet_issue',
            'batch_reference':
                'BULK-${DateTime.now().millisecondsSinceEpoch}-$issuedCount',
            'inputs': [
              {
                'item_sku': _optionSku(source),
                'item_name': _itemName(source),
                'quantity': qty,
                'unit': source['unit_of_measure'] ?? source['unit'] ?? 'units',
                'unit_cost': _num(source['cost_price'] ??
                    source['unit_cost'] ??
                    source['unit_price']),
              }
            ],
            'outputs': [
              {
                'outlet_item_id': _outletItemId(output),
                'item_sku': outputSku,
                'item_name': _outletItemName(output),
                'quantity': qty,
                'unit': output['unit'] ?? 'units',
                'unit_cost': _num(output['cost_price'] ??
                    source['cost_price'] ??
                    source['unit_cost']),
                'category': output['category'],
                'metadata': {
                  'source': 'branch_store_pos_outlet_issue_bulk',
                  'source_sku': _optionSku(source),
                },
              }
            ],
            'remarks':
                'Bulk issue-all to ${widget.outletDisplayName(outlet)} (POS testing)',
          });
          issuedCount++;
        } catch (_) {
          skippedCount++;
        }
      }
      widget.onRefresh();
      _showSnack(
        'Issued $issuedCount item(s) to ${widget.outletDisplayName(outlet)}'
        '${skippedCount > 0 ? ' • $skippedCount skipped (no matching/available branch stock)' : ''}',
      );
    } finally {
      if (mounted) setState(() => _bulkIssuingBar = false);
    }
  }

  void _showIssueForm(
    Map<String, dynamic> outlet, {
    Map<String, dynamic>? presetOutput,
  }) {
    final outletId = _outletId(outlet);
    final outletType = _outletType(outlet);
    final isBarOutlet = _barOutlets.containsKey(outletType) ||
        outletType.contains('bar') ||
        widget.outletDisplayName(outlet).toLowerCase().contains('bar');

    final quantity = TextEditingController();
    final notes = TextEditingController();
    Map<String, dynamic>? sourceItem;
    Map<String, dynamic>? outputItem = presetOutput;
    bool wasAutoMatched = false;

    // If a preset output (clicked "Issue" from stock list), reverse-match source
    if (presetOutput != null) {
      final outputSku = _outletItemSku(presetOutput);
      final matches = widget.branchStock.where((item) {
        return _optionSku(item) == outputSku ||
            _itemName(item).toLowerCase() ==
                _outletItemName(presetOutput).toLowerCase();
      }).toList();
      sourceItem = matches.isEmpty ? null : matches.first;
    }

    // Helper: try to auto-match a branch stock item to its POS outlet item.
    // Matches in order: exact SKU → exact name (case-insensitive).
    Map<String, dynamic>? tryAutoMatch(Map<String, dynamic> source) {
      return _matchingOutletItemForSource(outletId, source);
    }

    showDialog<void>(
      context: context,
      builder: (context) => StatefulBuilder(builder: (context, setDialogState) {
        final outletItems = widget.stockForOutlet(outletId);
        final qty = _num(quantity.text);
        final available = _num(sourceItem?['quantity']);
        final hasOutletItem = outputItem != null &&
            _outletItemId(outputItem!).isNotEmpty &&
            _outletItemSku(outputItem!).isNotEmpty;
        final canPost =
            sourceItem != null && hasOutletItem && qty > 0 && available >= qty;

        return AlertDialog(
          title: Text('Issue to ${widget.outletDisplayName(outlet)}'),
          content: SizedBox(
            width: 760,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _InfoPill('Outlet', widget.outletDisplayName(outlet)),
                  // Bar-flow info banner
                  if (isBarOutlet) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.amber.shade50,
                        border: Border.all(color: Colors.amber.shade300),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.local_bar_outlined,
                              color: Colors.amber.shade800, size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Bar stock flow: selecting a branch stock item will automatically '
                              'link it to the matching bar POS item. Verify the link, then enter quantity.',
                              style: TextStyle(
                                  fontSize: 12, color: Colors.amber.shade900),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  const SizedBox(height: 12),
                  _SearchPickField(
                    label: 'Source branch stock',
                    hint: 'Search item, SKU, barcode or category',
                    options: widget.branchStock,
                    selected: sourceItem,
                    titleFor: _itemName,
                    subtitleFor: (item) =>
                        '${_optionSku(item)} | Available ${_qty(item)}',
                    icon: PhosphorIcons.package(),
                    onSelected: (item) {
                      // Auto-resolve POS item for bar outlets
                      Map<String, dynamic>? matched;
                      bool autoMatched = false;
                      if (isBarOutlet) {
                        matched = tryAutoMatch(item);
                        autoMatched = matched != null;
                      }
                      setDialogState(() {
                        sourceItem = item;
                        if (autoMatched) {
                          outputItem = matched;
                          wasAutoMatched = true;
                        } else {
                          // Clear previous auto-match when user picks a different source
                          if (wasAutoMatched) {
                            outputItem = null;
                            wasAutoMatched = false;
                          }
                        }
                      });
                    },
                  ),
                  const SizedBox(height: 12),
                  // Auto-match success banner
                  if (isBarOutlet && outputItem != null && wasAutoMatched) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.green.shade50,
                        border: Border.all(color: Colors.green.shade300),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.link,
                              color: Colors.green.shade700, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Auto-linked → ${_outletItemName(outputItem!)}',
                              style: TextStyle(
                                color: Colors.green.shade800,
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                          ),
                          TextButton(
                            onPressed: () => setDialogState(() {
                              outputItem = null;
                              wasAutoMatched = false;
                            }),
                            child: Text('Change',
                                style:
                                    TextStyle(color: Colors.green.shade700)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                  ],
                  // Auto-match failed banner for bar outlets
                  if (isBarOutlet &&
                      sourceItem != null &&
                      outputItem == null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.orange.shade50,
                        border: Border.all(color: Colors.orange.shade300),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.link_off,
                              color: Colors.orange.shade700, size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'No auto-match found — please select the bar POS item manually below.',
                              style: TextStyle(
                                color: Colors.orange.shade900,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 4),
                  ],
                  // POS item picker — always show for manual override
                  // For bar outlets: label changes based on auto-match state
                  _SearchPickField(
                    label: isBarOutlet && wasAutoMatched && outputItem != null
                        ? 'Bar POS item (auto-matched — tap to override)'
                        : 'POS outlet item to increase',
                    hint: 'Search the selected outlet menu/stock item',
                    options: outletItems,
                    selected: outputItem,
                    titleFor: _outletItemName,
                    subtitleFor: (item) =>
                        '${_outletItemSku(item)} | Current ${_qtyText(item['current_stock'] ?? item['quantity'])} ${item['unit'] ?? 'units'}',
                    icon: Icons.storefront_outlined,
                    onSelected: (item) => setDialogState(() {
                      outputItem = item;
                      wasAutoMatched = false; // manual override
                    }),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: quantity,
                    keyboardType: TextInputType.number,
                    onChanged: (_) => setDialogState(() {}),
                    decoration: InputDecoration(
                      labelText: 'Quantity to issue',
                      prefixIcon: const Icon(Icons.numbers),
                      helperText: sourceItem == null
                          ? 'Select source stock first'
                          : 'Available in branch store: ${_qtyText(available)}',
                      errorText: qty > available && sourceItem != null
                          ? 'Cannot issue more than branch stock available'
                          : null,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notes,
                    minLines: 2,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Notes',
                      prefixIcon: Icon(Icons.notes),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      _InfoPill('Branch Stock Out', _qtyText(qty)),
                      _InfoPill('POS Outlet Stock In', _qtyText(qty)),
                      if (outputItem != null)
                        _InfoPill('POS Item ID', _outletItemId(outputItem!)),
                      if (isBarOutlet && wasAutoMatched && outputItem != null)
                        _InfoPill('Link', 'Auto-matched ✓'),
                    ],
                  ),
                  if (outletItems.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 10),
                      child: Text(
                        'This POS outlet has no stock/menu items. Sync or create POS outlet items before issuing stock to it.',
                        style: TextStyle(
                          color: AppColors.kError,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
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
              onPressed: canPost
                  ? () async {
                      Navigator.pop(context);
                      try {
                        final source = sourceItem!;
                        final output = outputItem!;
                        await _repo.createProductionRun({
                          'destination_outlet_id': outletId,
                          'production_area': 'pos_outlet_issue',
                          'batch_reference':
                              'OUT-${DateTime.now().millisecondsSinceEpoch}',
                          'inputs': [
                            {
                              'item_sku': _optionSku(source),
                              'item_name': _itemName(source),
                              'quantity': qty,
                              'unit': source['unit_of_measure'] ??
                                  source['unit'] ??
                                  'units',
                              'unit_cost': _num(source['cost_price'] ??
                                  source['unit_cost'] ??
                                  source['unit_price']),
                            }
                          ],
                          'outputs': [
                            {
                              'outlet_item_id': _outletItemId(output),
                              'item_sku': _outletItemSku(output),
                              'item_name': _outletItemName(output),
                              'quantity': qty,
                              'unit': output['unit'] ?? 'units',
                              'unit_cost': _num(output['cost_price'] ??
                                  source['cost_price'] ??
                                  source['unit_cost']),
                              'category': output['category'],
                              'metadata': {
                                'source': 'branch_store_pos_outlet_issue',
                                'source_sku': _optionSku(source),
                                if (isBarOutlet)
                                  'bar_auto_matched': wasAutoMatched,
                              },
                            }
                          ],
                          'remarks': notes.text.trim().isEmpty
                              ? 'Branch store issue to ${widget.outletDisplayName(outlet)}'
                              : notes.text.trim(),
                        });
                        widget.onRefresh();
                        _showSnack(
                            '${_qtyText(qty)} ${_outletItemName(output)} issued to ${widget.outletDisplayName(outlet)}');
                      } catch (error) {
                        _showSnack(
                            'POS outlet issue failed: ${_errorText(error)}',
                            error: true);
                      }
                    }
                  : null,
              child: const Text('Post Issue'),
            ),
          ],
        );
      }),
    );

  }

  Future<void> _commitOutletProductionItem(
    Map<String, dynamic> outlet,
    Map<String, dynamic> output,
    num produced, {
    String? turnReference,
    String? notes,
  }) async {
    if (produced <= 0) {
      _showSnack('Enter produced quantity', error: true);
      return;
    }
    try {
      await _repo.createProductionRun({
        'destination_outlet_id': _outletId(outlet),
        'production_area': 'outlet_production',
        'batch_reference': turnReference?.trim().isNotEmpty == true
            ? turnReference!.trim()
            : 'TURN-${DateTime.now().millisecondsSinceEpoch}',
        'outputs': [
          {
            'outlet_item_id': _outletItemId(output),
            'item_sku': _outletItemSku(output),
            'item_name': _outletItemName(output),
            'quantity': produced,
            'unit': output['unit'] ?? 'units',
            'category': output['category'],
            'metadata': {
              'source': 'outlet_production_sheet',
              'recipe_id': output['recipe_id'],
              'menu_item_id':
                  output['linked_menu_item_id'] ?? output['source_item_id'],
            },
          }
        ],
        'remarks': notes?.trim() ?? '',
      });
      widget.onRefresh();
      _showSnack(
        '${_qtyText(produced)} ${_outletItemName(output)} added to ${widget.outletDisplayName(outlet)}',
      );
    } catch (error) {
      _showSnack('Production failed: ${_errorText(error)}', error: true);
    }
  }

  Future<void> _toggleOutletItemTrackStock(
    Map<String, dynamic> outlet,
    Map<String, dynamic> item,
    bool trackStock,
  ) async {
    try {
      final outletId = _outletId(outlet);
      final itemId = _outletItemId(item);
      await _repo.patchOutletItemTrackStock(
          outletId: outletId, itemId: itemId, trackStock: trackStock);
      item['track_stock'] = trackStock;
      widget.onRefresh();
      _showSnack(trackStock
          ? '${_outletItemName(item)} is now tracked — requires production.'
          : '${_outletItemName(item)} marked as Always On — available in POS without stock.');
    } catch (error) {
      _showSnack('Failed to update: ${_errorText(error)}', error: true);
    }
  }

  void _showSnack(String message, {bool error = false}) {
    if (!mounted) return;
    AppNotifier.showSnackBar(
      context,
      SnackBar(
        content: Text(message),
        backgroundColor: error ? AppColors.kError : AppColors.kPrimary,
      ),
    );
  }
}

// ---------------------------------------------------------------------
// Pure formatting/data helpers (duplicated from the dashboard — these are
// stateless and operate only on their arguments, so keeping a local copy
// avoids coupling this screen back to the 17k-line dashboard file).
// ---------------------------------------------------------------------

String _outletId(Map<String, dynamic> item) {
  final stockOutletId = '${item['outlet_id'] ?? item['outletId'] ?? ''}'.trim();
  if (stockOutletId.isNotEmpty && stockOutletId != 'null') {
    return stockOutletId;
  }
  return '${item['id'] ?? ''}'.trim();
}

String _outletType(Map<String, dynamic> item) =>
    '${item['outlet_type'] ?? item['outletType'] ?? item['type'] ?? 'pos_outlet'}'
        .trim();

String _outletItemId(Map<String, dynamic> item) =>
    '${item['id'] ?? item['outlet_item_id'] ?? item['outletItemId'] ?? ''}'
        .trim();

String _outletItemSku(Map<String, dynamic> item) =>
    '${item['sku'] ?? item['item_sku'] ?? item['output_sku'] ?? ''}'.trim();

String _outletItemName(Map<String, dynamic> item) {
  final raw =
      '${item['name'] ?? item['item_name'] ?? item['output_name'] ?? _outletItemSku(item)}'
          .trim();
  return raw.isEmpty || raw == 'null' ? 'Outlet Item' : raw;
}

String _itemName(Map<String, dynamic> item) {
  final nested = item['item'];
  if (nested is Map) {
    return '${nested['item_name'] ?? nested['name'] ?? nested['description'] ?? item['item_sku'] ?? ''}';
  }
  return '${item['item_name'] ?? item['name'] ?? item['description'] ?? item['item_sku'] ?? item['sku'] ?? 'Unknown Item'}';
}

String _optionSku(Map<String, dynamic> item) =>
    '${item['item_sku'] ?? item['sku'] ?? item['item_code'] ?? ''}'.trim();

String _qty(Map<String, dynamic> item) {
  final unit = item['item'] is Map
      ? item['item']['unit_of_measure'] ?? item['item']['unit']
      : item['unit_of_measure'] ?? item['unit'];
  return '${_num(item['quantity']).toStringAsFixed(_num(item['quantity']) % 1 == 0 ? 0 : 2)} ${unit ?? 'units'}';
}

String _qtyText(dynamic value) {
  final number = _num(value);
  return number.toStringAsFixed(number % 1 == 0 ? 0 : 2);
}

String _money(num value) => 'KES ${value.toStringAsFixed(2)}';

num _num(dynamic value) {
  if (value is num) return value;
  return num.tryParse('$value') ?? 0;
}

String _movementLabel(dynamic value) {
  final text = '$value'.trim();
  if (text.isEmpty || text == 'null') return '-';
  return text
      .split('_')
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1))
      .join(' ');
}

String _date(dynamic value) {
  if (value == null || '$value'.isEmpty || '$value' == 'null') return '-';
  final parsed = DateTime.tryParse('$value');
  if (parsed == null) return '$value';
  return '${parsed.year.toString().padLeft(4, '0')}-${parsed.month.toString().padLeft(2, '0')}-${parsed.day.toString().padLeft(2, '0')}';
}

String _errorText(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map) {
      final message = data['message'] ?? data['error'];
      if (message != null && '$message'.trim().isNotEmpty) {
        return '$message';
      }
    }
    if (error.message != null && error.message!.trim().isNotEmpty) {
      return error.message!;
    }
  }
  return '$error';
}

Map<String, dynamic> _dynamicMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  if (value is String && value.trim().isNotEmpty) {
    try {
      final decoded = jsonDecode(value);
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } catch (_) {
      return <String, dynamic>{};
    }
  }
  return <String, dynamic>{};
}

// ---------------------------------------------------------------------
// Presentational chrome (duplicated from the dashboard's private widget
// set — these are also used by ~10 other dashboard sections, so they stay
// defined there too; this is a deliberate lift-and-shift duplication
// rather than a shared-widget extraction, to keep this change scoped to
// the POS Outlet Issue feature only).
// ---------------------------------------------------------------------

class _Page extends StatelessWidget {
  const _Page({
    required this.title,
    required this.subtitle,
    required this.children,
    this.actions = const [],
  });

  final String title;
  final String subtitle;
  final List<Widget> actions;
  final List<Widget> children;

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
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 760),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.displaySmall,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: AppColors.kTextSecondary,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ),
              ),
              Wrap(spacing: 8, runSpacing: 8, children: actions),
            ],
          ),
          const SizedBox(height: 24),
          ...children.expand((child) => [child, const SizedBox(height: 18)]),
        ],
      ),
    );
  }
}

class _RefreshButton extends StatelessWidget {
  const _RefreshButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: const Icon(Icons.refresh),
      label: const Text('Refresh'),
    );
  }
}

class _StatCardData {
  const _StatCardData(this.label, this.value, this.icon, this.color);
  final String label;
  final String value;
  final IconData icon;
  final Color color;
}

class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.cards});

  final List<_StatCardData> cards;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final columns = constraints.maxWidth > 1100
          ? 4
          : constraints.maxWidth > 760
              ? 3
              : constraints.maxWidth > 520
                  ? 2
                  : 1;
      return GridView.count(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisCount: columns,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
        childAspectRatio: 3.2,
        children: cards.map((card) => _StatCard(card)).toList(),
      );
    });
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard(this.data);
  final _StatCardData data;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: data.color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(data.icon, color: data.color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    data.label.toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: AppColors.kTextSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(
                      data.value,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.child, this.subtitle});

  final String title;
  final String? subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
            ),
            if (subtitle != null && subtitle!.trim().isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(
                subtitle!,
                style: const TextStyle(
                  color: AppColors.kTextSecondary,
                  fontSize: 12,
                ),
              ),
            ],
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}

class _RecordList extends StatelessWidget {
  const _RecordList({required this.children, required this.emptyText});

  final List<Widget> children;
  final String emptyText;

  @override
  Widget build(BuildContext context) {
    if (children.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.grey.shade50,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Center(child: Text(emptyText)),
      );
    }
    return Column(children: children);
  }
}

class _RecordTile extends StatelessWidget {
  const _RecordTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.trailing,
    this.actions = const [],
    this.meta = const [],
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Widget? trailing;
  final List<Widget> actions;
  final List<Widget> meta;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.kPrimary.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: AppColors.kPrimary),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.kTextSecondary,
                      ),
                    ),
                    if (meta.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Wrap(spacing: 8, runSpacing: 8, children: meta),
                      ),
                    if (actions.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child:
                            Wrap(spacing: 8, runSpacing: 4, children: actions),
                      ),
                  ],
                ),
              ),
              if (trailing != null) ...[
                const SizedBox(width: 12),
                trailing!,
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.label,
      {this.success = false, this.warning = false, this.error = false});

  final String label;
  final bool success;
  final bool warning;
  final bool error;

  @override
  Widget build(BuildContext context) {
    final color = success
        ? AppColors.kSuccess
        : error
            ? AppColors.kError
            : warning
                ? AppColors.kWarning
                : AppColors.kPrimary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 260),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            label.toUpperCase(),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              fontSize: 10,
              color: AppColors.kTextSecondary,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.kSurface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(color: AppColors.kTextSecondary),
      ),
    );
  }
}

class _SearchPickField extends StatelessWidget {
  const _SearchPickField({
    required this.label,
    required this.hint,
    required this.options,
    required this.selected,
    required this.titleFor,
    required this.subtitleFor,
    required this.icon,
    required this.onSelected,
  });

  final String label;
  final String hint;
  final List<Map<String, dynamic>> options;
  final Map<String, dynamic>? selected;
  final String Function(Map<String, dynamic>) titleFor;
  final String Function(Map<String, dynamic>) subtitleFor;
  final IconData icon;
  final ValueChanged<Map<String, dynamic>> onSelected;

  String _display(Map<String, dynamic>? item) {
    if (item == null || item.isEmpty) return '';
    final title = titleFor(item);
    final subtitle = subtitleFor(item);
    return subtitle.trim().isEmpty ? title : '$title - $subtitle';
  }

  String _searchText(Map<String, dynamic> item) =>
      '${titleFor(item)} ${subtitleFor(item)} ${item.values.join(' ')}'
          .toLowerCase();

  @override
  Widget build(BuildContext context) {
    return Autocomplete<Map<String, dynamic>>(
      key: ValueKey('$label-${_display(selected)}'),
      initialValue: TextEditingValue(text: _display(selected)),
      displayStringForOption: _display,
      optionsBuilder: (value) {
        final query = value.text.trim().toLowerCase();
        return options
            .where((item) => query.isEmpty || _searchText(item).contains(query))
            .take(50);
      },
      onSelected: onSelected,
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
        return TextField(
          controller: controller,
          focusNode: focusNode,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            prefixIcon: Icon(icon),
          ),
        );
      },
      optionsViewBuilder: (context, onSelected, values) {
        final rows = values.toList();
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 8,
            borderRadius: BorderRadius.circular(12),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 720, maxHeight: 320),
              child: ListView.separated(
                padding: const EdgeInsets.symmetric(vertical: 6),
                itemCount: rows.length,
                separatorBuilder: (_, __) =>
                    const Divider(height: 1, indent: 16, endIndent: 16),
                itemBuilder: (context, index) {
                  final item = rows[index];
                  return ListTile(
                    dense: true,
                    leading: CircleAvatar(
                      radius: 18,
                      backgroundColor:
                          AppColors.kPrimary.withValues(alpha: 0.1),
                      child: Icon(icon, size: 18, color: AppColors.kPrimary),
                    ),
                    title: Text(
                      titleFor(item),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    subtitle: Text(
                      subtitleFor(item),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () => onSelected(item),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}

class _OutletProductionSheet extends StatefulWidget {
  const _OutletProductionSheet({
    required this.items,
    required this.emptyText,
    required this.itemName,
    required this.itemSku,
    required this.currentStock,
    required this.maxProduce,
    required this.qtyText,
    required this.onCommit,
    this.onToggleTrackStock,
  });

  final List<Map<String, dynamic>> items;
  final String emptyText;
  final String Function(Map<String, dynamic>) itemName;
  final String Function(Map<String, dynamic>) itemSku;
  final num Function(Map<String, dynamic>) currentStock;
  final num? Function(Map<String, dynamic>) maxProduce;
  final String Function(dynamic) qtyText;
  final Future<void> Function(Map<String, dynamic>, num)? onCommit;
  final Future<void> Function(Map<String, dynamic>, bool)? onToggleTrackStock;

  @override
  State<_OutletProductionSheet> createState() => _OutletProductionSheetState();
}

class _OutletProductionSheetState extends State<_OutletProductionSheet> {
  final Map<String, TextEditingController> _controllers = {};
  bool _posting = false;

  @override
  void didUpdateWidget(covariant _OutletProductionSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    final keys = widget.items.map(_keyFor).toSet();
    for (final key in _controllers.keys.toList()) {
      if (!keys.contains(key)) {
        _controllers.remove(key)?.dispose();
      }
    }
  }

  @override
  void dispose() {
    for (final controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  String _keyFor(Map<String, dynamic> item) =>
      '${item['id'] ?? item['outlet_item_id'] ?? widget.itemSku(item)}';

  TextEditingController _controllerFor(Map<String, dynamic> item) {
    final key = _keyFor(item);
    return _controllers.putIfAbsent(key, TextEditingController.new);
  }

  Future<void> _commit(Map<String, dynamic> item) async {
    final controller = _controllerFor(item);
    final quantity = num.tryParse(controller.text.trim()) ?? 0;
    if (widget.onCommit == null || quantity <= 0 || _posting) return;
    setState(() => _posting = true);
    try {
      await widget.onCommit!(item, quantity);
      controller.clear();
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  Future<void> _toggleTrackStock(
      BuildContext ctx, Map<String, dynamic> item) async {
    if (widget.onToggleTrackStock == null) return;
    final current = item['track_stock'] != false;
    final newValue = !current;
    final label = newValue ? 'Track Stock' : 'Always On (no stock required)';
    final confirmed = await showDialog<bool>(
      context: ctx,
      builder: (_) => AlertDialog(
        title: Text(newValue ? 'Enable Stock Tracking' : 'Mark as Always On'),
        content: Text(newValue
            ? 'This item will require production commits and will show out-of-stock in POS when stock hits zero.'
            : '"${item['name'] ?? item['item_name'] ?? 'This item'}" will be permanently available in POS. Stock tracking will be disabled — it won\'t block sales even at zero stock.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          FilledButton(
            style: newValue
                ? null
                : FilledButton.styleFrom(backgroundColor: Colors.green),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(label),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      setState(() => _posting = true);
      try {
        await widget.onToggleTrackStock!(item, newValue);
      } finally {
        if (mounted) setState(() => _posting = false);
      }
    }
  }

  Future<void> _turnOnAll(BuildContext ctx) async {
    if (widget.onToggleTrackStock == null || widget.items.isEmpty) return;

    final trackedCount =
        widget.items.where((item) => item['track_stock'] != false).length;

    if (trackedCount == 0) {
      ScaffoldMessenger.of(ctx).showSnackBar(
        const SnackBar(
          content: Text('All items are already set to Always On'),
          backgroundColor: Colors.green,
        ),
      );
      return;
    }

    final confirmed = await showDialog<bool>(
      context: ctx,
      builder: (_) => AlertDialog(
        title: const Text('Turn On All Items'),
        content: Text(
            'This will set ALL $trackedCount tracked items to "Always On" mode.\n\n'
            'Items will be permanently available in POS without requiring production commits or stock tracking.\n\n'
            'Are you sure you want to continue?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.green),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Turn On All'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      setState(() => _posting = true);
      try {
        int successCount = 0;
        int failCount = 0;

        for (final item in widget.items) {
          final isTracked = item['track_stock'] != false;
          if (isTracked) {
            try {
              await widget.onToggleTrackStock!(item, false);
              successCount++;
            } catch (e) {
              failCount++;
            }
          }
        }

        if (mounted) {
          ScaffoldMessenger.of(ctx).showSnackBar(
            SnackBar(
              content: Text(
                failCount == 0
                    ? '✓ Successfully turned on all $successCount items'
                    : '✓ Turned on $successCount items, $failCount failed',
              ),
              backgroundColor: failCount == 0 ? Colors.green : Colors.orange,
              duration: const Duration(seconds: 4),
            ),
          );
        }
      } finally {
        if (mounted) setState(() => _posting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) return _EmptyState(widget.emptyText);

    final trackedCount =
        widget.items.where((item) => item['track_stock'] != false).length;

    return Container(
      decoration: BoxDecoration(
        border: Border.all(color: AppColors.kDivider),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            color: AppColors.kPrimary,
            child: Row(
              children: [
                const SizedBox(
                    width: 48, child: Text('#', style: _headerStyle)),
                const Expanded(
                    flex: 3, child: Text('Item Name', style: _headerStyle)),
                const Expanded(
                    flex: 2,
                    child: Text('[ Total Registered Production Of The Day ]',
                        style: _headerStyle)),
                SizedBox(
                  width: 120,
                  child: Row(
                    children: [
                      const Text('Stock Control', style: _headerStyle),
                      const SizedBox(width: 4),
                      if (trackedCount > 0)
                        Tooltip(
                          message: 'Turn on all $trackedCount tracked items',
                          child: InkWell(
                            onTap: _posting ? null : () => _turnOnAll(context),
                            borderRadius: BorderRadius.circular(4),
                            child: Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.green,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.all_inclusive,
                                    size: 12,
                                    color: Colors.white,
                                  ),
                                  const SizedBox(width: 2),
                                  Text(
                                    'All',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(
                    width: 170,
                    child: Text('Add Qty Produced', style: _headerStyle)),
                const SizedBox(
                    width: 96, child: Text('Action', style: _headerStyle)),
              ],
            ),
          ),
          ...widget.items.asMap().entries.map((entry) {
            final index = entry.key;
            final item = entry.value;
            final controller = _controllerFor(item);
            final max = widget.maxProduce(item);
            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              color: index.isEven ? Colors.white : Colors.blueGrey.shade50,
              child: Row(
                children: [
                  SizedBox(width: 48, child: Text('${index + 1}')),
                  Expanded(
                    flex: 3,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.itemName(item),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        Text(
                          widget.itemSku(item),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.kTextSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    flex: 2,
                    child: Text(
                      '[ ${widget.qtyText(widget.currentStock(item))} ]'
                      '${max == null ? '' : '  Max ${widget.qtyText(max)}'}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  Builder(builder: (ctx) {
                    final tracked = item['track_stock'] != false;
                    return SizedBox(
                      width: 120,
                      child: GestureDetector(
                        onTap: _posting
                            ? null
                            : () => _toggleTrackStock(ctx, item),
                        child: Chip(
                          visualDensity: VisualDensity.compact,
                          padding: EdgeInsets.zero,
                          avatar: Icon(
                            tracked
                                ? Icons.track_changes_outlined
                                : Icons.all_inclusive,
                            size: 14,
                            color: tracked ? Colors.blue : Colors.green,
                          ),
                          label: Text(
                            tracked ? 'Tracked' : 'Always On',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: tracked
                                  ? Colors.blue.shade800
                                  : Colors.green.shade800,
                            ),
                          ),
                          backgroundColor: tracked
                              ? Colors.blue.shade50
                              : Colors.green.shade50,
                          side: BorderSide(
                              color: tracked
                                  ? Colors.blue.shade200
                                  : Colors.green.shade200),
                        ),
                      ),
                    );
                  }),
                  SizedBox(
                    width: 170,
                    child: TextField(
                      controller: controller,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: '0.00',
                      ),
                      onSubmitted: (_) => _commit(item),
                    ),
                  ),
                  const SizedBox(width: 10),
                  SizedBox(
                    width: 86,
                    child: FilledButton(
                      onPressed: _posting || widget.onCommit == null
                          ? null
                          : () => _commit(item),
                      child: const Text('Commit'),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}

const _headerStyle = TextStyle(
  color: Colors.white,
  fontWeight: FontWeight.w900,
  fontSize: 12,
);
