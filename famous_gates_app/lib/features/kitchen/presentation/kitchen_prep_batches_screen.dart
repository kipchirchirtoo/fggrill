import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../auth/domain/auth_notifier.dart';
import '../../branch_storekeeper/data/branch_storekeeper_repository.dart';
import '../data/repository.dart';
import '../domain/session_models.dart';


class KitchenPrepBatchesScreen extends ConsumerStatefulWidget {
  const KitchenPrepBatchesScreen({
    super.key,
    required this.shift,
  });

  final KitchenShift shift;

  @override
  ConsumerState<KitchenPrepBatchesScreen> createState() =>
      _KitchenPrepBatchesScreenState();
}

class _KitchenPrepBatchesScreenState
    extends ConsumerState<KitchenPrepBatchesScreen> {
  final _quantityController = TextEditingController();
  final _notesController = TextEditingController();
  final _rawSearchController = TextEditingController();
  final _destinationSearchController = TextEditingController();

  bool _isLoading = true;
  bool _isSaving = false;
  List<Map<String, dynamic>> _recipeCatalog = const [];
  List<Map<String, dynamic>> _inventoryItems = const [];
  List<KitchenPrepBatch> _batches = const [];
  String? _selectedRawSku;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _notesController.dispose();
    _rawSearchController.dispose();
    _destinationSearchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    final repo = ref.read(kitchenRepositoryProvider);
    final results = await Future.wait([
      repo.getRecipeCatalog(),
      repo.getStoreInventoryItems(limit: 1000),
      repo.getPrepBatches(widget.shift.id),
    ]);
    if (!mounted) return;
    setState(() {
      _recipeCatalog = List<Map<String, dynamic>>.from(results[0] as List);
      _inventoryItems = List<Map<String, dynamic>>.from(results[1] as List);
      _batches = List<KitchenPrepBatch>.from(results[2] as List);
      _isLoading = false;
    });
  }

  List<Map<String, dynamic>> get _eligibleRecipes {
    return _recipeCatalog.where((recipe) {
      final rawSku = (recipe['raw_item_sku'] ?? '').toString().trim();
      final producedName = (recipe['produced_item_name'] ?? '').toString().trim();
      final yieldType = (recipe['yield_type_code'] ?? '').toString().trim();
      return rawSku.isNotEmpty &&
          rawSku != 'MULTI' &&
          producedName.isNotEmpty &&
          yieldType.toUpperCase() != 'DIRECT';
    }).toList()
      ..sort((a, b) {
        final left =
            '${a['raw_item_name'] ?? ''} ${a['produced_item_name'] ?? ''}';
        final right =
            '${b['raw_item_name'] ?? ''} ${b['produced_item_name'] ?? ''}';
        return left.compareTo(right);
      });
  }

  List<Map<String, dynamic>> get _prepFamilies {
    final grouped = <String, Map<String, dynamic>>{};
    for (final recipe in _eligibleRecipes) {
      final rawSku = (recipe['raw_item_sku'] ?? '').toString().trim();
      if (rawSku.isEmpty) continue;
      grouped.putIfAbsent(rawSku, () {
        return {
          'raw_item_sku': rawSku,
          'raw_item_name': (recipe['raw_item_name'] ?? 'Raw stock').toString(),
          'raw_unit': (recipe['raw_unit'] ?? 'unit').toString(),
          'recipes': <Map<String, dynamic>>[],
        };
      });
      (grouped[rawSku]!['recipes'] as List<Map<String, dynamic>>)
          .add(Map<String, dynamic>.from(recipe));
    }
    final values = grouped.values.toList()
      ..sort((a, b) => '${a['raw_item_name']}'.compareTo('${b['raw_item_name']}'));
    return values;
  }

  Map<String, dynamic>? get _selectedFamily {
    if (_selectedRawSku == null || _selectedRawSku!.trim().isEmpty) return null;
    for (final family in _prepFamilies) {
      if ((family['raw_item_sku'] ?? '').toString() == _selectedRawSku) {
        return family;
      }
    }
    return null;
  }

  List<Map<String, dynamic>> get _availableDestinations {
    final recipes = List<Map<String, dynamic>>.from(
      _selectedFamily?['recipes'] as List<Map<String, dynamic>>? ?? const [],
    );
    recipes.sort((a, b) {
      final leftOrder = a['prep_stage_order'] != null
          ? _numField(a['prep_stage_order']).toInt()
          : 9999;
      final rightOrder = b['prep_stage_order'] != null
          ? _numField(b['prep_stage_order']).toInt()
          : 9999;
      if (leftOrder != rightOrder) return leftOrder.compareTo(rightOrder);
      final leftStage = '${a['prep_stage_code'] ?? ''}';
      final rightStage = '${b['prep_stage_code'] ?? ''}';
      if (leftStage != rightStage) return leftStage.compareTo(rightStage);
      return '${a['produced_item_name']}'.compareTo(
        '${b['produced_item_name']}',
      );
    });
    return recipes;
  }

  List<Map<String, dynamic>> _upstreamRecipesFor(Map<String, dynamic>? recipe) {
    if (recipe == null) return const [];
    final rawSku = (recipe['raw_item_sku'] ?? '').toString().trim();
    if (rawSku.isEmpty) return const [];
    return _eligibleRecipes.where((candidate) {
      if ((candidate['id'] ?? '').toString() == (recipe['id'] ?? '').toString()) {
        return false;
      }
      final producedInventorySku =
          (candidate['produced_inventory_item_sku'] ?? '').toString().trim();
      final producedSku =
          (candidate['produced_item_sku'] ?? '').toString().trim();
      return producedInventorySku == rawSku || producedSku == rawSku;
    }).toList();
  }

  bool _hasReturnedBatchForRecipeIds(Iterable<String> recipeIds) {
    final idSet = recipeIds.where((id) => id.trim().isNotEmpty).toSet();
    if (idSet.isEmpty) return true;
    for (final batch in _batches) {
      if (batch.status == 'returned' && idSet.contains(batch.recipeId)) {
        return true;
      }
    }
    return false;
  }

  Map<String, dynamic>? get _selectedRawStockRow {
    final rawSku = (_selectedRawSku ?? '').trim();
    if (rawSku.isEmpty) return null;
    for (final row in _inventoryItems) {
      if ((row['sku'] ?? '').toString().trim() == rawSku) return row;
    }
    return null;
  }

  List<String> _defaultAssignedStaffIds() {
    final ids = widget.shift.assignedDispenseIds.isNotEmpty
        ? widget.shift.assignedDispenseIds
        : widget.shift.assignedChefIds;
    return ids.where((e) => e.trim().isNotEmpty).toList();
  }

  /// The first recipe in the selected family (by prep_stage_order) used as
  /// the batch anchor when sending. All siblings are shown on receive.
  Map<String, dynamic>? get _primaryRecipe {
    final dests = _availableDestinations;
    return dests.isNotEmpty ? dests.first : null;
  }

  /// All prerequisites across every recipe in the selected family.
  List<Map<String, dynamic>> get _familyPrerequisites {
    final seen = <String>{};
    final result = <Map<String, dynamic>>[];
    for (final recipe in _availableDestinations) {
      for (final upstream in _upstreamRecipesFor(recipe)) {
        final id = (upstream['id'] ?? '').toString();
        if (seen.add(id)) result.add(upstream);
      }
    }
    return result;
  }

  bool get _familyPrerequisitesSatisfied {
    final ids = _familyPrerequisites.map((r) => (r['id'] ?? '').toString());
    return _hasReturnedBatchForRecipeIds(ids);
  }

  Future<void> _sendForPrep() async {
    final messenger = ScaffoldMessenger.of(context);
    final recipe = _primaryRecipe;
    final qty = double.tryParse(_quantityController.text.trim()) ?? 0;
    if (recipe == null) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Select a raw stock family first.')),
      );
      return;
    }
    if (qty <= 0) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Enter a quantity greater than zero.')),
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      await ref.read(kitchenRepositoryProvider).sendPrepBatch(widget.shift.id, {
        'recipe_id': recipe['id'],
        'raw_quantity_sent': qty,
        'assigned_staff_ids': _defaultAssignedStaffIds(),
        'sent_notes': _notesController.text.trim(),
      });
      _quantityController.clear();
      _notesController.clear();
      _rawSearchController.clear();
      _destinationSearchController.clear();
      _selectedRawSku = null;
      // _selectedRecipe removed
      await _load();
      if (!mounted) return;
      final family = _prepFamilies
          .where((f) =>
              (f['raw_item_sku'] ?? '').toString() ==
              (recipe['raw_item_sku'] ?? '').toString())
          .firstOrNull;
      final familyName =
          (family?['raw_item_name'] ?? recipe['raw_item_name'] ?? 'batch')
              .toString();
      messenger.showSnackBar(
        SnackBar(content: Text('$familyName sent for prep successfully.')),
      );
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _showIssueToKitchenDialog(KitchenPrepBatch batch) async {
    final outputs = batch.extraOutputs.isNotEmpty
        ? batch.extraOutputs
        : batch.returnedQuantity != null
            ? [
                {
                  'name': batch.producedItemName,
                  'sku': batch.producedItemSku ?? '',
                  'quantity': batch.returnedQuantity,
                  'unit': batch.returnedUnit ?? batch.producedUnit,
                }
              ]
            : <Map<String, dynamic>>[];

    if (outputs.isEmpty) return;
    final messenger = ScaffoldMessenger.of(context);

    final items = await showDialog<List<Map<String, dynamic>>>(
      context: context,
      builder: (_) => _IssueToKitchenDialog(
        batch: batch,
        outputs: outputs,
        staffIds: _defaultAssignedStaffIds(),
      ),
    );

    if (items == null || items.isEmpty || !mounted) return;

    try {
      await ref
          .read(branchStorekeeperRepositoryProvider)
          .addShiftStock(widget.shift.id, items);
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text('Failed: $e')));
      return;
    }

    if (!mounted) return;
    messenger.showSnackBar(SnackBar(
      content: Text(
          '${items.length} output${items.length == 1 ? '' : 's'} issued to kitchen.'),
    ));
  }

  /// Parse a JSON field that may arrive as int, double, or string.
  static double _numField(dynamic val) {
    if (val == null) return 0.0;
    if (val is num) return val.toDouble();
    return double.tryParse(val.toString()) ?? 0.0;
  }

  /// Expected usable return in raw units based on the prep recipe yield standard.
  /// Returns 0.0 when units differ (e.g. recipe produces portions, not kg).
  double _expectedUsableReturn(KitchenPrepBatch batch) {
    try {
      final recipe = _eligibleRecipes.where(
        (r) => (r['id'] ?? '').toString() == batch.recipeId,
      ).firstOrNull;
      if (recipe == null) return 0.0;
      final producedUnit =
          (recipe['produced_unit'] ?? '').toString().toLowerCase().trim();
      final rawUnitStr = batch.rawUnit.toLowerCase().trim();
      if (producedUnit != rawUnitStr) return 0.0;
      final stdRaw = _numField(recipe['raw_quantity']);
      final stdOut = _numField(recipe['produced_quantity']);
      if (stdRaw <= 0 || stdOut <= 0) return 0.0;
      return batch.rawQuantitySent * (stdOut / stdRaw);
    } catch (_) {
      return 0.0;
    }
  }

  Future<void> _showReceiveDialog(KitchenPrepBatch batch) async {
    final producedName = batch.producedItemName.trim().isNotEmpty
        ? batch.producedItemName
        : '${batch.rawItemName} (prepared)';
    final rawUnit = batch.rawUnit;
    final expectedUsable = _expectedUsableReturn(batch);
    final messenger = ScaffoldMessenger.of(context);

    final input = await showDialog<_ReceiveInput>(
      context: context,
      builder: (_) => _PrepReceiveDialog(
        batch: batch,
        producedName: producedName,
        rawUnit: rawUnit,
        expectedUsable: expectedUsable,
      ),
    );

    if (input == null || !mounted) return;

    // Step 1: Receive (must succeed first)
    try {
      await ref.read(kitchenRepositoryProvider).receivePrepBatch(
        widget.shift.id,
        batch.id,
        {
          'returned_quantity': input.returned,
          'process_loss_quantity': input.processLoss,
          'wastage_quantity': input.wastage,
          'wastage_reason': input.wastageReason,
          'return_notes': input.notes,
        },
      );
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text('Receive failed: $e')));
      return;
    }

    // Step 2: Issue to kitchen
    Object? issueErr;
    if (input.issueQty > 0) {
      final producedSku = (batch.producedItemSku ?? '').trim();
      if (producedSku.isNotEmpty) {
        try {
          await ref
              .read(branchStorekeeperRepositoryProvider)
              .addShiftStock(widget.shift.id, [
            {
              'sku': producedSku,
              'item_name': producedName,
              'quantity': input.issueQty,
              'unit': rawUnit,
              'purpose_channel': 'pos_restaurant',
              'responsible_staff_ids': _defaultAssignedStaffIds(),
              'notes': 'Issued from prep batch ${batch.id.substring(0, 8)}',
            }
          ]);
        } catch (e) {
          issueErr = e;
        }
      }
    }

    if (!mounted) return;
    await _load();
    if (!mounted) return;

    if (issueErr != null) {
      messenger.showSnackBar(SnackBar(
        content: Text(
          'Received ${input.returned.toStringAsFixed(2)} $rawUnit into branch stock. '
          'Issue to kitchen failed — tap "Issue to Kitchen" on the batch card. '
          'Detail: $issueErr',
        ),
        duration: const Duration(seconds: 8),
      ));
    } else {
      messenger.showSnackBar(SnackBar(
        content: Text(input.issueQty > 0
            ? 'Received ${input.returned.toStringAsFixed(2)} $rawUnit. '
                'Issued ${input.issueQty.toStringAsFixed(2)} $rawUnit to kitchen.'
            : 'Received ${input.returned.toStringAsFixed(2)} $rawUnit into branch stock.'),
      ));
    }
  }

  @override
  Widget build(BuildContext context) {
    final rawStock = _selectedRawStockRow;
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final branchName =
        (user?.branchName ?? '').trim().isEmpty ? 'Branch' : user!.branchName;
    final dateText =
        DateFormat('yyyy-MM-dd').format(DateTime.parse(widget.shift.shiftDate));

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.fromLTRB(24, 24, 24, 28),
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Prep Return Flow',
                              style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F2E5E),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Send raw stock for prep. Receive the measured usable quantity back into branch stock, then issue all or part to the POS kitchen. POS sales consume from the issued stock independently per menu item.',
                              style: TextStyle(
                                color: Colors.grey.shade700,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      OutlinedButton.icon(
                        onPressed: () => Navigator.of(context).pop(),
                        icon: const Icon(Icons.arrow_back, size: 18),
                        label: const Text('Back to Kitchen Sessions'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Wrap(
                        spacing: 24,
                        runSpacing: 12,
                        children: [
                          _MetaTile(label: 'Branch', value: branchName),
                          _MetaTile(label: 'Shift', value: widget.shift.shiftNumber),
                          _MetaTile(
                            label: 'Session',
                            value: widget.shift.subShiftType == null
                                ? 'Single Shift'
                                : 'Shift ${widget.shift.subShiftType}',
                          ),
                          _MetaTile(label: 'Date', value: dateText),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Send Raw Stock for Prep',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 18,
                              color: Color(0xFF0F2E5E),
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'Select the raw stock family first, then choose the configured prep destination set in Branch Accountant Food Control Standards.',
                            style: TextStyle(color: Colors.grey.shade700),
                          ),
                          const SizedBox(height: 16),
                          // ── Raw family search ─────────────────────────
                          Autocomplete<Map<String, dynamic>>(
                            displayStringForOption: (option) =>
                                '${option['raw_item_name'] ?? 'Raw stock'}',
                            optionsBuilder: (value) {
                              final q = value.text.trim().toLowerCase();
                              if (q.isEmpty) return _prepFamilies.take(12);
                              return _prepFamilies.where((family) {
                                final raw =
                                    '${family['raw_item_name'] ?? ''}'.toLowerCase();
                                return raw.contains(q);
                              }).take(12);
                            },
                            onSelected: (family) {
                              setState(() {
                                _selectedRawSku =
                                    (family['raw_item_sku'] ?? '').toString();
                                // _selectedRecipe removed
                                _rawSearchController.text =
                                    '${family['raw_item_name'] ?? 'Raw stock'}';
                                _destinationSearchController.clear();
                              });
                            },
                            fieldViewBuilder: (context, controller, focusNode, _) {
                              if (_rawSearchController.text.isNotEmpty &&
                                  controller.text.isEmpty) {
                                controller.text = _rawSearchController.text;
                              }
                              return TextFormField(
                                controller: controller,
                                focusNode: focusNode,
                                decoration: const InputDecoration(
                                  labelText: 'Search raw stock family',
                                  border: OutlineInputBorder(),
                                  prefixIcon: Icon(Icons.search),
                                ),
                              );
                            },
                          ),

                          // ── Expected outputs panel (auto, no picker needed) ─
                          if (_selectedRawSku != null &&
                              _availableDestinations.isNotEmpty) ...[
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF0FDF4),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                    color: const Color(0xFFBBF7D0)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(Icons.output_outlined,
                                          size: 16,
                                          color: Color(0xFF059669)),
                                      const SizedBox(width: 6),
                                      Text(
                                        'POS consumption standards linked to this prepared stock',
                                        style: TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 13,
                                          color: Colors.green.shade800,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),
                                  ..._availableDestinations.map((recipe) {
                                    final name = (recipe['produced_item_name'] ??
                                            'Produced item')
                                        .toString();
                                    final stdRaw =
                                        _numField(recipe['raw_quantity']);
                                    final stdOut =
                                        _numField(recipe['produced_quantity']);
                                    final unit =
                                        (recipe['produced_unit'] ?? '').toString();
                                    final rawUnit =
                                        (recipe['raw_unit'] ?? '').toString();
                                    // Scale expected yield to the qty entered
                                    final enteredQty = double.tryParse(
                                            _quantityController.text.trim()) ??
                                        0;
                                    final scaleFactor = stdRaw > 0
                                        ? enteredQty / stdRaw
                                        : 1.0;
                                    final expectedYield = stdOut * scaleFactor;

                                    return Padding(
                                      padding:
                                          const EdgeInsets.only(bottom: 6),
                                      child: Row(
                                        children: [
                                          const Icon(Icons.arrow_right,
                                              size: 18,
                                              color: Color(0xFF059669)),
                                          const SizedBox(width: 4),
                                          Expanded(
                                            child: Text(
                                              name,
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w600),
                                            ),
                                          ),
                                          if (stdRaw > 0 && stdOut > 0)
                                            Text(
                                              enteredQty > 0
                                                  ? '≈ ${expectedYield.toStringAsFixed(1)} $unit'
                                                  : 'Std: ${stdOut.toStringAsFixed(1)} $unit / ${stdRaw.toStringAsFixed(0)} $rawUnit',
                                              style: TextStyle(
                                                color: Colors.green.shade700,
                                                fontWeight: FontWeight.w500,
                                                fontSize: 13,
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

                          // ── Prerequisites warning ──────────────────────────
                          if (_selectedRawSku != null &&
                              _familyPrerequisites.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: _familyPrerequisitesSatisfied
                                    ? const Color(0xFFE8F5E9)
                                    : const Color(0xFFFFF3E0),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: _familyPrerequisitesSatisfied
                                      ? const Color(0xFF81C784)
                                      : const Color(0xFFFFCC80),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _familyPrerequisitesSatisfied
                                        ? 'Prerequisite prep completed'
                                        : 'Earlier prep stage required first',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: _familyPrerequisitesSatisfied
                                          ? const Color(0xFF2E7D32)
                                          : const Color(0xFF9A6700),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    _familyPrerequisites
                                        .map((r) =>
                                            (r['recipe_name'] ??
                                                    r['produced_item_name'] ??
                                                    'prep stage')
                                                .toString())
                                        .join(', '),
                                    style: TextStyle(
                                        color: Colors.grey.shade800),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: 16),
                          // ── Stock available + qty to send ─────────────────
                          Row(
                            children: [
                              Expanded(
                                child: _ReadOnlyField(
                                  label: 'Current branch stock available',
                                  value: rawStock == null
                                      ? '-'
                                      : '${_numField(rawStock['quantity']).toStringAsFixed(2)} '
                                          '${rawStock['unit_of_measure'] ?? rawStock['unit'] ?? ''}',
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: StatefulBuilder(
                                  builder: (ctx, setQtyState) =>
                                      TextFormField(
                                    controller: _quantityController,
                                    keyboardType:
                                        const TextInputType.numberWithOptions(
                                            decimal: true),
                                    onChanged: (_) => setState(() {}),
                                    decoration: InputDecoration(
                                      labelText:
                                          'Raw quantity sent (${_primaryRecipe?['raw_unit'] ?? rawStock?['unit_of_measure'] ?? 'unit'})',
                                      border: const OutlineInputBorder(),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _notesController,
                            maxLines: 3,
                            decoration: const InputDecoration(
                              labelText: 'Prep notes (optional)',
                              border: OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Align(
                            alignment: Alignment.centerRight,
                            child: FilledButton.icon(
                              onPressed: _isSaving ||
                                      _primaryRecipe == null ||
                                      !_familyPrerequisitesSatisfied
                                  ? null
                                  : _sendForPrep,
                              icon: const Icon(Icons.send_outlined),
                              label: Text(_isSaving
                                  ? 'Sending...'
                                  : 'Send for Prep'),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Card(
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(color: Colors.grey.shade200),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              const Expanded(
                                child: Text(
                                  'Prep Batches',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w800,
                                    fontSize: 18,
                                    color: Color(0xFF0F2E5E),
                                  ),
                                ),
                              ),
                              IconButton(
                                onPressed: _load,
                                icon: const Icon(Icons.refresh),
                                tooltip: 'Refresh',
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          if (_batches.isEmpty)
                            Text(
                              'No prep batches recorded for this shift yet.',
                              style: TextStyle(color: Colors.grey.shade700),
                            )
                          else
                            ..._batches.map((batch) {
                              final sent = DateFormat('HH:mm')
                                  .format(DateTime.parse(batch.sentAt).toLocal());
                              final isReturned = batch.status == 'returned';
                              return Container(
                                margin: const EdgeInsets.only(top: 12),
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: Colors.grey.shade200),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Expanded(
                                          child: Text(
                                            '${batch.rawItemName} -> ${batch.producedItemName}',
                                            style: const TextStyle(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 15,
                                            ),
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 10, vertical: 6),
                                          decoration: BoxDecoration(
                                            color: isReturned
                                                ? const Color(0xFFE7F7E6)
                                                : const Color(0xFFFFF4E5),
                                            borderRadius: BorderRadius.circular(999),
                                          ),
                                          child: Text(
                                            isReturned ? 'RETURNED' : 'SENT',
                                            style: TextStyle(
                                              fontWeight: FontWeight.w800,
                                              color: isReturned
                                                  ? const Color(0xFF2E7D32)
                                                  : const Color(0xFF9A6700),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    Wrap(
                                      spacing: 12,
                                      runSpacing: 8,
                                      children: [
                                        _InfoChip('Sent',
                                            '${batch.rawQuantitySent.toStringAsFixed(2)} ${batch.rawUnit}'),
                                        _InfoChip('Time', sent),
                                        if (batch.returnedQuantity != null)
                                          _InfoChip(
                                            'Total returned',
                                            '${batch.returnedQuantity!.toStringAsFixed(2)} ${batch.returnedUnit ?? batch.producedUnit}',
                                          ),
                                        if ((batch.processLossQuantity ?? 0) > 0)
                                          _InfoChip(
                                            'Process loss',
                                            '${batch.processLossQuantity!.toStringAsFixed(2)} ${batch.processLossUnit ?? batch.rawUnit}',
                                          ),
                                        if ((batch.wastageQuantity ?? 0) > 0)
                                          _InfoChip(
                                            'Wastage',
                                            '${batch.wastageQuantity!.toStringAsFixed(2)} ${batch.wastageUnit ?? batch.rawUnit}',
                                          ),
                                        if (batch.unexplainedVarianceQuantity != null)
                                          _InfoChip(
                                            'Variance',
                                            '${batch.unexplainedVarianceQuantity!.toStringAsFixed(2)} ${batch.unexplainedVarianceUnit ?? batch.rawUnit}',
                                          ),
                                      ],
                                    ),
                                    // Multi-output breakdown (shown when multiple items returned)
                                    if (isReturned && batch.extraOutputs.length > 1) ...[
                                      const SizedBox(height: 10),
                                      Text('Output breakdown',
                                          style: TextStyle(
                                              fontWeight: FontWeight.w600,
                                              fontSize: 12,
                                              color: Colors.grey.shade700)),
                                      const SizedBox(height: 4),
                                      ...batch.extraOutputs.map((o) {
                                        final name = (o['name'] ?? o['sku'] ?? '').toString();
                                        final qty = _numField(o['quantity']);
                                        final unit = (o['unit'] ?? '').toString();
                                        return Padding(
                                          padding: const EdgeInsets.symmetric(vertical: 2),
                                          child: Row(
                                            children: [
                                              const Icon(Icons.arrow_right,
                                                  size: 16, color: Color(0xFF059669)),
                                              const SizedBox(width: 4),
                                              Expanded(
                                                child: Text(
                                                  '$name: ${qty.toStringAsFixed(2)} $unit',
                                                  style: const TextStyle(fontSize: 13),
                                                ),
                                              ),
                                            ],
                                          ),
                                        );
                                      }),
                                    ],
                                    if ((batch.sentNotes ?? '').trim().isNotEmpty) ...[
                                      const SizedBox(height: 8),
                                      Text(
                                        'Notes: ${batch.sentNotes}',
                                        style: TextStyle(color: Colors.grey.shade700),
                                      ),
                                    ],
                                    if ((batch.wastageReason ?? '').trim().isNotEmpty) ...[
                                      const SizedBox(height: 6),
                                      Text(
                                        'Wastage reason: ${batch.wastageReason}',
                                        style: TextStyle(color: Colors.red.shade700),
                                      ),
                                    ],
                                    const SizedBox(height: 12),
                                    if (!isReturned)
                                      Align(
                                        alignment: Alignment.centerRight,
                                        child: FilledButton.icon(
                                          onPressed: () =>
                                              _showReceiveDialog(batch),
                                          icon: const Icon(
                                              Icons.inventory_2_outlined),
                                          label:
                                              const Text('Receive Return'),
                                        ),
                                      )
                                    else
                                      Row(
                                        children: [
                                          const Icon(Icons.check_circle,
                                              color: Color(0xFF059669),
                                              size: 16),
                                          const SizedBox(width: 6),
                                          Expanded(
                                            child: Text(
                                              'In branch stock — ready to issue to kitchen.',
                                              style: TextStyle(
                                                color: Colors.green.shade800,
                                                fontWeight: FontWeight.w600,
                                                fontSize: 13,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          FilledButton.icon(
                                            onPressed: () =>
                                                _showIssueToKitchenDialog(
                                                    batch),
                                            icon: const Icon(
                                                Icons.kitchen_outlined,
                                                size: 16),
                                            label: const Text(
                                                'Issue to Kitchen'),
                                            style: FilledButton.styleFrom(
                                              backgroundColor:
                                                  const Color(0xFF059669),
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                      horizontal: 14,
                                                      vertical: 10),
                                              textStyle: const TextStyle(
                                                  fontSize: 13),
                                            ),
                                          ),
                                        ],
                                      ),
                                  ],
                                ),
                              );
                            }),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

// ── Receive prep return dialog ────────────────────────────────────────────────

typedef _ReceiveInput = ({
  double returned,
  double processLoss,
  double wastage,
  String wastageReason,
  String notes,
  double issueQty,
});

class _PrepReceiveDialog extends StatefulWidget {
  const _PrepReceiveDialog({
    required this.batch,
    required this.producedName,
    required this.rawUnit,
    required this.expectedUsable,
  });

  final KitchenPrepBatch batch;
  final String producedName;
  final String rawUnit;
  final double expectedUsable;

  @override
  State<_PrepReceiveDialog> createState() => _PrepReceiveDialogState();
}

class _PrepReceiveDialogState extends State<_PrepReceiveDialog> {
  late final TextEditingController _returnedCtl;
  late final TextEditingController _processLossCtl;
  late final TextEditingController _wastageCtl;
  late final TextEditingController _wastageReasonCtl;
  late final TextEditingController _notesCtl;
  late final TextEditingController _issueCtl;

  @override
  void initState() {
    super.initState();
    final defaultText = widget.expectedUsable > 0
        ? widget.expectedUsable.toStringAsFixed(2)
        : '';
    _returnedCtl = TextEditingController(text: defaultText);
    _processLossCtl = TextEditingController(text: '0');
    _wastageCtl = TextEditingController(text: '0');
    _wastageReasonCtl = TextEditingController();
    _notesCtl = TextEditingController();
    _issueCtl = TextEditingController(text: defaultText);
  }

  @override
  void dispose() {
    _returnedCtl.dispose();
    _processLossCtl.dispose();
    _wastageCtl.dispose();
    _wastageReasonCtl.dispose();
    _notesCtl.dispose();
    _issueCtl.dispose();
    super.dispose();
  }

  double get _variance {
    final ret = double.tryParse(_returnedCtl.text.trim()) ?? 0;
    final pl = double.tryParse(_processLossCtl.text.trim()) ?? 0;
    final w = double.tryParse(_wastageCtl.text.trim()) ?? 0;
    return widget.batch.rawQuantitySent - ret - pl - w;
  }

  void _onReturnedChanged(String v) {
    final ret = double.tryParse(v.trim()) ?? 0;
    final iss = double.tryParse(_issueCtl.text.trim()) ?? 0;
    if (iss > ret) {
      _issueCtl.text = ret <= 0 ? '0' : ret.toStringAsFixed(2);
    }
    setState(() {});
  }

  void _submit() {
    final returned = double.tryParse(_returnedCtl.text.trim()) ?? 0;
    final processLoss = double.tryParse(_processLossCtl.text.trim()) ?? 0;
    final wastage = double.tryParse(_wastageCtl.text.trim()) ?? 0;
    final issueQty = double.tryParse(_issueCtl.text.trim()) ?? 0;
    final rawUnit = widget.rawUnit;

    if (returned <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Enter the usable quantity returned from prep.')));
      return;
    }
    if (processLoss < 0 || wastage < 0) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Process loss and wastage cannot be negative.')));
      return;
    }
    if (wastage > 0 && _wastageReasonCtl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Wastage reason is required when wastage > 0.')));
      return;
    }
    if (issueQty > returned + 0.001) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Issue qty cannot exceed returned qty '
              '(${returned.toStringAsFixed(2)} $rawUnit).')));
      return;
    }

    Navigator.of(context).pop<_ReceiveInput>((
      returned: returned,
      processLoss: processLoss,
      wastage: wastage,
      wastageReason: _wastageReasonCtl.text.trim(),
      notes: _notesCtl.text.trim(),
      issueQty: issueQty,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final variance = _variance;
    final varianceColor = variance.abs() < 0.5
        ? Colors.green.shade700
        : variance.abs() < 2.0
            ? Colors.orange.shade700
            : Colors.red.shade700;
    final rawUnit = widget.rawUnit;
    final producedName = widget.producedName;
    final batch = widget.batch;
    final expectedUsable = widget.expectedUsable;

    return AlertDialog(
      title: const Text('Receive Prep Return'),
      content: SizedBox(
        width: 480,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFBFDBFE)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.inventory_2_outlined,
                            size: 16, color: Color(0xFF1D4ED8)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            '${batch.rawItemName}  ·  Sent: '
                            '${batch.rawQuantitySent.toStringAsFixed(2)} $rawUnit',
                            style: const TextStyle(
                                fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                    if (expectedUsable > 0) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const SizedBox(width: 24),
                          Text(
                            'Expected usable return: '
                            '${expectedUsable.toStringAsFixed(2)} $rawUnit'
                            '  (${(expectedUsable / batch.rawQuantitySent * 100).toStringAsFixed(0)}% standard yield)',
                            style: TextStyle(
                                color: Colors.blue.shade700, fontSize: 12),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 16),
              const Text('Step 1 — Record what came back from prep',
                  style:
                      TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 10),
              TextFormField(
                controller: _returnedCtl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                onChanged: _onReturnedChanged,
                decoration: InputDecoration(
                  labelText: 'Usable $producedName returned ($rawUnit)',
                  hintText: '0',
                  border: const OutlineInputBorder(),
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _processLossCtl,
                      keyboardType: const TextInputType.numberWithOptions(
                          decimal: true),
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        labelText: 'Process loss ($rawUnit)',
                        hintText: '0',
                        border: const OutlineInputBorder(),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _wastageCtl,
                      keyboardType: const TextInputType.numberWithOptions(
                          decimal: true),
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        labelText: 'Wastage ($rawUnit)',
                        hintText: '0',
                        border: const OutlineInputBorder(),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _wastageReasonCtl,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Wastage reason (required if wastage > 0)',
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _notesCtl,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Return notes (optional)',
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: variance.abs() < 0.5
                      ? Colors.green.shade50
                      : variance.abs() < 2.0
                          ? Colors.orange.shade50
                          : Colors.red.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: varianceColor.withAlpha(80)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          variance.abs() < 0.5
                              ? Icons.check_circle_outline
                              : Icons.warning_amber_outlined,
                          color: varianceColor,
                          size: 16,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Prep variance: '
                            '${variance.toStringAsFixed(3)} $rawUnit',
                            style: TextStyle(
                                fontWeight: FontWeight.w600,
                                color: varianceColor,
                                fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${batch.rawQuantitySent.toStringAsFixed(2)} sent'
                      ' − usable returned − process loss − wastage',
                      style: TextStyle(
                          color: varianceColor.withAlpha(160), fontSize: 11),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.kitchen_outlined,
                            size: 16, color: Color(0xFF059669)),
                        SizedBox(width: 6),
                        Text(
                          'Step 2 — Issue to POS Kitchen',
                          style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                              color: Color(0xFF065F46)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Partial issues allowed. Leave 0 to issue from the batch card later.',
                      style: TextStyle(
                          color: Colors.green.shade800, fontSize: 12),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _issueCtl,
                      keyboardType: const TextInputType.numberWithOptions(
                          decimal: true),
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        labelText: '$producedName to issue ($rawUnit)',
                        hintText: '0',
                        helperText: () {
                          final ret =
                              double.tryParse(_returnedCtl.text.trim()) ?? 0;
                          return ret > 0
                              ? 'Max: ${ret.toStringAsFixed(2)} $rawUnit'
                              : 'Enter returned qty above first';
                        }(),
                        border: const OutlineInputBorder(),
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton.icon(
          onPressed: _submit,
          icon: const Icon(Icons.check_circle_outline, size: 18),
          label: const Text('Receive & Issue'),
          style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF059669)),
        ),
      ],
    );
  }
}

// ── Issue to kitchen dialog ───────────────────────────────────────────────────

class _IssueToKitchenDialog extends StatefulWidget {
  const _IssueToKitchenDialog({
    required this.batch,
    required this.outputs,
    required this.staffIds,
  });

  final KitchenPrepBatch batch;
  final List<Map<String, dynamic>> outputs;
  final List<String> staffIds;

  static double _numField(dynamic val) {
    if (val == null) return 0.0;
    if (val is num) return val.toDouble();
    return double.tryParse(val.toString()) ?? 0.0;
  }

  @override
  State<_IssueToKitchenDialog> createState() => _IssueToKitchenDialogState();
}

class _IssueToKitchenDialogState extends State<_IssueToKitchenDialog> {
  late final List<TextEditingController> _controllers;
  late final TextEditingController _notesCtl;

  @override
  void initState() {
    super.initState();
    _controllers = [
      for (final o in widget.outputs)
        TextEditingController(
            text: _IssueToKitchenDialog._numField(o['quantity'])
                .toStringAsFixed(2)),
    ];
    _notesCtl = TextEditingController();
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    _notesCtl.dispose();
    super.dispose();
  }

  void _submit() {
    final items = <Map<String, dynamic>>[];
    for (var i = 0; i < widget.outputs.length; i++) {
      final qty = double.tryParse(_controllers[i].text.trim()) ?? 0;
      if (qty <= 0) continue;
      final o = widget.outputs[i];
      final available = _IssueToKitchenDialog._numField(o['quantity']);
      if (qty > available + 0.001) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(
              'Cannot issue more than available: ${o['name']} '
              'max ${available.toStringAsFixed(2)} ${o['unit']}'),
        ));
        return;
      }
      items.add({
        'sku': (o['sku'] ?? '').toString(),
        'item_name': (o['name'] ?? '').toString(),
        'quantity': qty,
        'unit': (o['unit'] ?? '').toString(),
        'purpose_channel': 'pos_restaurant',
        'notes': _notesCtl.text.trim().isNotEmpty
            ? _notesCtl.text.trim()
            : 'Issued from prep batch ${widget.batch.id.substring(0, 8)}',
        'responsible_staff_ids': widget.staffIds,
      });
    }
    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Enter at least one quantity to issue.')));
      return;
    }
    Navigator.of(context).pop<List<Map<String, dynamic>>>(items);
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Issue to POS Kitchen'),
      content: SizedBox(
        width: 460,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.kitchen_outlined,
                        size: 18, color: Color(0xFF059669)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Issuing prep outputs from '
                        '${widget.batch.rawItemName} batch to kitchen.',
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 13),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Partial issues are allowed — remaining quantity stays '
                'available for later.',
                style:
                    TextStyle(color: Colors.grey.shade600, fontSize: 12),
              ),
              const SizedBox(height: 14),
              ...List.generate(widget.outputs.length, (i) {
                final o = widget.outputs[i];
                final name = (o['name'] ?? o['sku'] ?? '').toString();
                final unit = (o['unit'] ?? '').toString();
                final available =
                    _IssueToKitchenDialog._numField(o['quantity']);
                return Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: TextFormField(
                    controller: _controllers[i],
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: '$name ($unit)',
                      helperText:
                          'Available: ${available.toStringAsFixed(2)} $unit',
                      border: const OutlineInputBorder(),
                      contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                    ),
                  ),
                );
              }),
              const SizedBox(height: 4),
              TextFormField(
                controller: _notesCtl,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Notes (optional)',
                  border: OutlineInputBorder(),
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton.icon(
          onPressed: _submit,
          icon: const Icon(Icons.kitchen_outlined),
          label: const Text('Issue to Kitchen'),
          style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF059669)),
        ),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _MetaTile extends StatelessWidget {
  const _MetaTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 220,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade600)),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }
}

class _ReadOnlyField extends StatelessWidget {
  const _ReadOnlyField({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFF9FAFB),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
          const SizedBox(height: 6),
          Text(
            value,
            style: const TextStyle(
              fontWeight: FontWeight.w700,
              color: Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoChip extends StatelessWidget {
  const _InfoChip(this.label, this.value);

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF4F7FB),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        '$label: $value',
        style: const TextStyle(
          fontWeight: FontWeight.w600,
          color: Color(0xFF0F2E5E),
        ),
      ),
    );
  }
}
