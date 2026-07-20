import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../auth/domain/auth_notifier.dart';
import '../data/repository.dart';
import '../domain/session_models.dart';

String _prepStageLabel(dynamic value) {
  switch ((value ?? '').toString().trim().toUpperCase()) {
    case 'PEEL':
      return 'Peel';
    case 'CUT':
      return 'Cut';
    case 'PREP_OTHER':
      return 'Other Prep';
    default:
      return 'Prep';
  }
}

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
  Map<String, dynamic>? _selectedRecipe;

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
      final leftOrder = (a['prep_stage_order'] as num?)?.toInt() ?? 9999;
      final rightOrder = (b['prep_stage_order'] as num?)?.toInt() ?? 9999;
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

  List<Map<String, dynamic>> get _selectedRecipePrerequisites =>
      _upstreamRecipesFor(_selectedRecipe);

  bool get _selectedRecipePrerequisiteSatisfied {
    final ids = _selectedRecipePrerequisites
        .map((recipe) => (recipe['id'] ?? '').toString());
    return _hasReturnedBatchForRecipeIds(ids);
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

  Future<void> _sendForPrep() async {
    final messenger = ScaffoldMessenger.of(context);
    final recipe = _selectedRecipe;
    final qty = double.tryParse(_quantityController.text.trim()) ?? 0;
    if (recipe == null) {
      messenger.showSnackBar(
        const SnackBar(content: Text('Select a prep standard first.')),
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
      _selectedRecipe = null;
      await _load();
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(content: Text('Prep batch sent successfully.')),
      );
    } catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text('Failed: $e')));
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _showReceiveDialog(KitchenPrepBatch batch) async {
    final qtyController = TextEditingController();
    final notesController = TextEditingController();
    final processLossController = TextEditingController(text: '0');
    final wastageController = TextEditingController(text: '0');
    final wastageReasonController = TextEditingController();
    final messenger = ScaffoldMessenger.of(context);
    bool saving = false;

    await showDialog(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setLocalState) {
            return AlertDialog(
              title: const Text('Receive Prep Return'),
              content: SizedBox(
                width: 440,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${batch.rawItemName} -> ${batch.producedItemName}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Sent out: ${batch.rawQuantitySent.toStringAsFixed(2)} ${batch.rawUnit}',
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: qtyController,
                      keyboardType:
                          const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: 'Returned usable quantity (${batch.producedUnit})',
                        border: const OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: notesController,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Return notes (optional)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: processLossController,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            decoration: InputDecoration(
                              labelText:
                                  'Normal process loss (${batch.rawUnit})',
                              border: const OutlineInputBorder(),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            controller: wastageController,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            decoration: InputDecoration(
                              labelText: 'Wastage (${batch.rawUnit})',
                              border: const OutlineInputBorder(),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: wastageReasonController,
                      maxLines: 2,
                      decoration: const InputDecoration(
                        labelText: 'Wastage reason (required if wastage > 0)',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Normal process loss covers peelings and trimming. Wastage is avoidable loss that needs a reason.',
                      style: TextStyle(
                        color: Colors.grey.shade700,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: saving ? null : () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: saving
                      ? null
                      : () async {
                          final qty =
                              double.tryParse(qtyController.text.trim()) ?? 0;
                          final processLoss = double.tryParse(
                                processLossController.text.trim(),
                              ) ??
                              0;
                          final wastage = double.tryParse(
                                wastageController.text.trim(),
                              ) ??
                              0;
                          if (qty <= 0) return;
                          if (processLoss < 0 || wastage < 0) return;
                          setLocalState(() => saving = true);
                          try {
                            await ref
                                .read(kitchenRepositoryProvider)
                                .receivePrepBatch(widget.shift.id, batch.id, {
                              'returned_quantity': qty,
                              'return_notes': notesController.text.trim(),
                              'process_loss_quantity': processLoss,
                              'wastage_quantity': wastage,
                              'wastage_reason':
                                  wastageReasonController.text.trim(),
                            });
                            if (!mounted) return;
                            if (dialogContext.mounted) {
                              Navigator.of(dialogContext).pop();
                            }
                            await _load();
                            if (!mounted) return;
                            messenger.showSnackBar(
                              const SnackBar(
                                content: Text('Prep return received successfully.'),
                              ),
                            );
                          } catch (e) {
                            if (!mounted) return;
                            messenger.showSnackBar(
                              SnackBar(content: Text('Failed: $e')),
                            );
                          } finally {
                            if (dialogContext.mounted) {
                              setLocalState(() => saving = false);
                            }
                          }
                        },
                  child: const Text('Receive Return'),
                ),
              ],
            );
          },
        );
      },
    );

    qtyController.dispose();
    notesController.dispose();
    processLossController.dispose();
    wastageController.dispose();
    wastageReasonController.dispose();
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
                              'Send raw stock for prep, receive the measured usable return, then issue the returned stock to kitchen from the normal issue screen.',
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
                                _selectedRecipe = null;
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
                          const SizedBox(height: 16),
                          DropdownButtonFormField<String>(
                            initialValue: _selectedRecipe == null
                                ? null
                                : (_selectedRecipe!['id'] ?? '').toString(),
                            decoration: const InputDecoration(
                              labelText: 'Prep destination / return stage',
                              border: OutlineInputBorder(),
                            ),
                            items: _availableDestinations
                                .map(
                                  (recipe) => DropdownMenuItem<String>(
                                    value: (recipe['id'] ?? '').toString(),
                                    child: Text(
                                      '${recipe['produced_item_name'] ?? 'Produced item'}'
                                      '${recipe['prep_stage_code'] == null ? '' : '  •  ${_prepStageLabel(recipe['prep_stage_code'])}'}'
                                      '${recipe['prep_stage_order'] == null ? '' : '  •  Step ${recipe['prep_stage_order']}'}',
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) {
                              setState(() {
                                _selectedRecipe = _availableDestinations
                                    .where((recipe) =>
                                        (recipe['id'] ?? '').toString() ==
                                        value)
                                    .cast<Map<String, dynamic>?>()
                                    .firstOrNull;
                                _destinationSearchController.text =
                                    _selectedRecipe == null
                                        ? ''
                                        : '${_selectedRecipe!['produced_item_name'] ?? 'Produced item'}';
                              });
                            },
                          ),
                          if (_selectedRecipe != null) ...[
                            const SizedBox(height: 12),
                            _ReadOnlyField(
                              label: 'Configured flow',
                              value: (_selectedRecipe!['recipe_name'] ?? '')
                                      .toString()
                                      .trim()
                                      .isNotEmpty
                                  ? _selectedRecipe!['recipe_name'].toString()
                                  : '${_selectedRecipe!['raw_item_name'] ?? 'Raw stock'} -> ${_selectedRecipe!['produced_item_name'] ?? 'Produced item'}',
                            ),
                            if ((_selectedRecipe!['prep_stage_code'] ?? '')
                                .toString()
                                .trim()
                                .isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Row(
                                children: [
                                  _InfoChip(
                                    'Stage',
                                    _prepStageLabel(
                                      _selectedRecipe!['prep_stage_code'],
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  if (_selectedRecipe!['prep_stage_order'] != null)
                                    _InfoChip(
                                      'Step',
                                      '${_selectedRecipe!['prep_stage_order']}',
                                    ),
                                  if ((_selectedRecipe!['prep_stage_group'] ?? '')
                                      .toString()
                                      .trim()
                                      .isNotEmpty) ...[
                                    const SizedBox(width: 8),
                                    _InfoChip(
                                      'Flow',
                                      '${_selectedRecipe!['prep_stage_group']}',
                                    ),
                                  ],
                                ],
                              ),
                            ],
                            if (_selectedRecipePrerequisites.isNotEmpty) ...[
                              const SizedBox(height: 12),
                              Container(
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: _selectedRecipePrerequisiteSatisfied
                                      ? const Color(0xFFE8F5E9)
                                      : const Color(0xFFFFF3E0),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: _selectedRecipePrerequisiteSatisfied
                                        ? const Color(0xFF81C784)
                                        : const Color(0xFFFFCC80),
                                  ),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _selectedRecipePrerequisiteSatisfied
                                          ? 'Prerequisite prep completed'
                                          : 'Earlier prep stage required',
                                      style: TextStyle(
                                        fontWeight: FontWeight.w800,
                                        color: _selectedRecipePrerequisiteSatisfied
                                            ? const Color(0xFF2E7D32)
                                            : const Color(0xFF9A6700),
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      _selectedRecipePrerequisites
                                          .map(
                                            (recipe) =>
                                                (recipe['recipe_name'] ?? recipe['produced_item_name'] ?? 'prep stage')
                                                    .toString(),
                                          )
                                          .join(', '),
                                      style: TextStyle(
                                        color: Colors.grey.shade800,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: _ReadOnlyField(
                                  label: 'Raw stock item',
                                  value: (_selectedRecipe?['raw_item_name'] ?? '-')
                                      .toString(),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: _ReadOnlyField(
                                  label: 'Processed return item',
                                  value:
                                      (_selectedRecipe?['produced_item_name'] ?? '-')
                                          .toString(),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: _ReadOnlyField(
                                  label: 'Current branch stock available',
                                  value: rawStock == null
                                      ? '-'
                                      : '${((rawStock['quantity'] as num?) ?? 0).toStringAsFixed(2)} '
                                          '${rawStock['unit_of_measure'] ?? rawStock['unit'] ?? ''}',
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextFormField(
                                  controller: _quantityController,
                                  keyboardType: const TextInputType.numberWithOptions(
                                      decimal: true),
                                  decoration: InputDecoration(
                                    labelText:
                                        'Raw quantity sent (${(_selectedRecipe?['raw_unit'] ?? rawStock?['unit_of_measure'] ?? 'unit')})',
                                    border: const OutlineInputBorder(),
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
                                      (_selectedRecipe != null &&
                                          !_selectedRecipePrerequisiteSatisfied)
                                  ? null
                                  : _sendForPrep,
                              icon: const Icon(Icons.send_outlined),
                              label: const Text('Send for Prep'),
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
                                        _InfoChip('Processed item',
                                            batch.producedUnit),
                                        _InfoChip('Time', sent),
                                        if (batch.returnedQuantity != null)
                                          _InfoChip(
                                            'Returned',
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
                                          onPressed: () => _showReceiveDialog(batch),
                                          icon: const Icon(Icons.inventory_2_outlined),
                                          label: const Text('Receive Return'),
                                        ),
                                      )
                                    else
                                      Text(
                                        'Returned stock is now back in branch stock and can be issued to kitchen from the normal Issue Stock screen.',
                                        style: TextStyle(
                                          color: Colors.green.shade800,
                                          fontWeight: FontWeight.w600,
                                        ),
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
