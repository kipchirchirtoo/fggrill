import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../../auth/domain/auth_notifier.dart';
import '../../kitchen/data/repository.dart';
import '../../kitchen/domain/session_models.dart';
import '../../kitchen/domain/session_providers.dart';
import '../data/branch_storekeeper_repository.dart';

class KitchenProductionLoggingScreen extends ConsumerWidget {
  const KitchenProductionLoggingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activeShiftAsync = ref.watch(activeKitchenShiftProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text(
          'Production Logging',
          style: TextStyle(
            color: Color(0xFF0F172A),
            fontWeight: FontWeight.w800,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.kPrimary),
            onPressed: () {
              ref.invalidate(activeKitchenShiftProvider);
            },
          ),
        ],
      ),
      body: activeShiftAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.red),
              const SizedBox(height: 12),
              Text('Error: $error', textAlign: TextAlign.center),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: () => ref.invalidate(activeKitchenShiftProvider),
                icon: const Icon(Icons.refresh),
                label: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (shift) {
          if (shift == null) {
            return _NoActiveShiftView(
              onRefresh: () => ref.invalidate(activeKitchenShiftProvider),
            );
          }
          return _ProductionLoggingLedger(shift: shift);
        },
      ),
    );
  }
}

class _ProductionLoggingLedger extends ConsumerStatefulWidget {
  const _ProductionLoggingLedger({required this.shift});

  final KitchenShift shift;

  @override
  ConsumerState<_ProductionLoggingLedger> createState() =>
      _ProductionLoggingLedgerState();
}

class _ProductionLoggingLedgerState
    extends ConsumerState<_ProductionLoggingLedger> {
  final TextEditingController _producedQtyController = TextEditingController();
  final TextEditingController _reasonController = TextEditingController();
  final TextEditingController _producedByController = TextEditingController();

  bool _isLoading = true;
  bool _isSaving = false;

  List<Map<String, dynamic>> _recipes = const [];
  List<Map<String, dynamic>> _staff = const [];
  List<Map<String, dynamic>> _productionHistory = const [];
  Map<String, dynamic> _shiftDetail = const {};
  Map<String, dynamic> _productionSummary = const {};
  Map<String, dynamic>? _selectedRecipe;
  Map<String, dynamic>? _selectedProducedBy;
  final Map<String, TextEditingController> _inputControllers = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant _ProductionLoggingLedger oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.shift.id != widget.shift.id) {
      _clearSelection();
      _load();
    }
  }

  @override
  void dispose() {
    _producedQtyController.dispose();
    _reasonController.dispose();
    _producedByController.dispose();
    for (final controller in _inputControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _isLoading = true);
    try {
      final kitchenRepo = ref.read(kitchenRepositoryProvider);
      final storekeeperRepo = ref.read(branchStorekeeperRepositoryProvider);
      final results = await Future.wait([
        storekeeperRepo.getProductionRecipes(),
        kitchenRepo.getShiftDetails(widget.shift.id),
        storekeeperRepo.getProductionSummary(widget.shift.id),
        kitchenRepo.getStaffProfiles(),
      ]);

      final allRecipes =
          List<Map<String, dynamic>>.from(results[0] as List<dynamic>);
      final eligibleRecipes = allRecipes.where((recipe) {
        final yieldType =
            (recipe['yield_type_code'] ?? '').toString().toUpperCase();
        final outputId = _resolveOutputItemId(recipe);
        return (yieldType == 'PRODUCTION' || yieldType == 'SUB_ASSEMBLY') &&
            outputId != null &&
            outputId.isNotEmpty;
      }).toList()
        ..sort(
            (a, b) => _recipeDisplayName(a).compareTo(_recipeDisplayName(b)));

      final detail = Map<String, dynamic>.from(results[1] as Map);
      final summary = Map<String, dynamic>.from(results[2] as Map);
      final staff =
          List<Map<String, dynamic>>.from(results[3] as List<dynamic>);
      final productions = ((detail['productions'] as List?) ?? const [])
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();

      if (!mounted) return;
      setState(() {
        _recipes = eligibleRecipes;
        _shiftDetail = detail;
        _productionSummary = summary;
        _staff = staff;
        _productionHistory = productions;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      AppNotifier.show(context, 'Failed to load production screen: $e',
          isError: true);
    }
  }

  void _clearSelection() {
    _selectedRecipe = null;
    _selectedProducedBy = null;
    _producedQtyController.clear();
    _reasonController.clear();
    _producedByController.clear();
    for (final controller in _inputControllers.values) {
      controller.dispose();
    }
    _inputControllers.clear();
  }

  String _shiftLabel() {
    final sub = widget.shift.subShiftType?.trim();
    if (sub != null && sub.isNotEmpty) {
      return 'Shift $sub';
    }
    return 'Single Shift';
  }

  String? _resolveOutputItemId(Map<String, dynamic> recipe) {
    final yieldType =
        (recipe['yield_type_code'] ?? '').toString().toUpperCase();
    if (yieldType == 'SUB_ASSEMBLY') {
      return recipe['produced_inventory_item_id']?.toString();
    }
    return recipe['pos_outlet_item_id']?.toString();
  }

  String _recipeDisplayName(Map<String, dynamic> recipe) {
    return (recipe['produced_item_name'] ??
            recipe['recipe_name'] ??
            'Unnamed production item')
        .toString();
  }

  List<Map<String, dynamic>> _recipeInputs() {
    return ((_selectedRecipe?['inputs'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Map<String, dynamic>? _findShiftItem(String sku) {
    final items = ((_shiftDetail['items'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item));
    for (final item in items) {
      if ((item['item_sku'] ?? '').toString() == sku) {
        return item;
      }
    }
    return null;
  }

  double _availableKitchenQty(String sku) {
    final item = _findShiftItem(sku);
    if (item == null) return 0;
    return ((item['opening_stock'] as num?)?.toDouble() ?? 0) +
        ((item['additions'] as num?)?.toDouble() ?? 0) -
        ((item['sold_quantity'] as num?)?.toDouble() ?? 0) -
        ((item['spoilage_quantity'] as num?)?.toDouble() ?? 0);
  }

  void _selectRecipe(Map<String, dynamic> recipe) {
    for (final controller in _inputControllers.values) {
      controller.dispose();
    }
    _inputControllers.clear();

    final inputs = ((recipe['inputs'] as List?) ?? const [])
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();

    for (final input in inputs) {
      final sku = (input['raw_item_sku'] ?? '').toString();
      final standardQty = ((input['quantity'] as num?)?.toDouble() ?? 0);
      _inputControllers[sku] = TextEditingController(
        text: standardQty > 0 ? standardQty.toStringAsFixed(2) : '',
      );
    }

    setState(() {
      _selectedRecipe = recipe;
      _producedQtyController.clear();
      _reasonController.clear();
    });
  }

  double get _expectedOutputQuantity {
    final recipe = _selectedRecipe;
    if (recipe == null) return 0;
    final inputs = _recipeInputs();
    if (inputs.isEmpty) return 0;

    final factors = <double>[];
    for (final input in inputs) {
      final sku = (input['raw_item_sku'] ?? '').toString();
      final standardQty = (input['quantity'] as num?)?.toDouble() ?? 0;
      final usedQty =
          double.tryParse(_inputControllers[sku]?.text.trim() ?? '') ?? 0;
      if (standardQty > 0 && usedQty > 0) {
        factors.add(usedQty / standardQty);
      }
    }
    if (factors.isEmpty) return 0;
    final minFactor = factors.reduce((a, b) => a < b ? a : b);
    return ((recipe['produced_quantity'] as num?)?.toDouble() ?? 0) * minFactor;
  }

  double get _actualOutputQuantity =>
      double.tryParse(_producedQtyController.text.trim()) ?? 0;

  double get _varianceQuantity =>
      _actualOutputQuantity - _expectedOutputQuantity;

  double get _variancePercent {
    final expected = _expectedOutputQuantity;
    if (expected <= 0) return 0;
    return (_varianceQuantity.abs() / expected) * 100;
  }

  double get _tolerancePercent {
    final recipe = _selectedRecipe;
    if (recipe == null) return 5;
    final tolerance = (recipe['allowed_variance_percent'] as num?)?.toDouble();
    if (tolerance == null || tolerance <= 0) return 5;
    return tolerance;
  }

  bool get _reasonRequired => _variancePercent > _tolerancePercent;

  Future<void> _submit() async {
    final recipe = _selectedRecipe;
    if (recipe == null) {
      AppNotifier.show(context, 'Select a batch-produced item first.',
          isError: true);
      return;
    }

    final outputItemId = _resolveOutputItemId(recipe);
    if (outputItemId == null || outputItemId.isEmpty) {
      AppNotifier.show(context, 'Selected standard has no output item mapping.',
          isError: true);
      return;
    }

    final inputs = _recipeInputs();
    if (inputs.isEmpty) {
      AppNotifier.show(context, 'Selected standard has no raw inputs.',
          isError: true);
      return;
    }

    final producedQty = _actualOutputQuantity;
    if (producedQty <= 0) {
      AppNotifier.show(context, 'Enter actual output produced.', isError: true);
      return;
    }

    if (_selectedProducedBy == null) {
      AppNotifier.show(context, 'Select the chef/staff attribution.',
          isError: true);
      return;
    }

    if (_reasonRequired && _reasonController.text.trim().isEmpty) {
      AppNotifier.show(
        context,
        'Variance exceeds tolerance. Reason is required before saving.',
        isError: true,
      );
      return;
    }

    final consumedInputs = <Map<String, dynamic>>[];
    for (final input in inputs) {
      final sku = (input['raw_item_sku'] ?? '').toString();
      final usedQty =
          double.tryParse(_inputControllers[sku]?.text.trim() ?? '') ?? 0;
      final unit = (input['unit'] ?? 'unit').toString();
      final availableQty = _availableKitchenQty(sku);

      if (usedQty <= 0) {
        AppNotifier.show(
          context,
          'Enter quantity used for ${(input['raw_item_name'] ?? sku)}.',
          isError: true,
        );
        return;
      }

      if (usedQty > availableQty) {
        AppNotifier.show(
          context,
          '${input['raw_item_name'] ?? sku} exceeds available kitchen stock.',
          isError: true,
        );
        return;
      }

      final inventoryRow = _findShiftItem(sku);
      consumedInputs.add({
        'raw_item_id': inventoryRow?['id']?.toString(),
        'raw_item_sku': sku,
        'raw_item_name': input['raw_item_name'],
        'quantity_used': usedQty,
        'unit': unit,
      });
    }

    setState(() => _isSaving = true);
    try {
      await ref.read(branchStorekeeperRepositoryProvider).logProductionEvent({
        'kitchen_shift_id': widget.shift.id,
        'output_item_id': outputItemId,
        'production_recipe_id': recipe['id'],
        'consumed_inputs': consumedInputs,
        'actual_produced_qty': producedQty,
        'output_unit': recipe['produced_unit'] ?? 'pcs',
        'produced_by': _selectedProducedBy!['id'],
        'idempotency_key':
            '${widget.shift.id}-${recipe['id']}-${DateTime.now().millisecondsSinceEpoch}',
        if (_reasonController.text.trim().isNotEmpty)
          'reason_note': _reasonController.text.trim(),
      });

      if (!mounted) return;
      AppNotifier.show(context, 'Production log saved successfully.');
      _clearSelection();
      await _load();
    } catch (e) {
      if (!mounted) return;
      AppNotifier.show(context, 'Failed to save production log: $e',
          isError: true);
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    final dateFmt = DateFormat('yyyy-MM-dd');
    final inputs = _recipeInputs();
    final expectedQty = _expectedOutputQuantity;
    final actualQty = _actualOutputQuantity;
    final varianceQty = _varianceQuantity;
    final variancePct = _variancePercent;
    final producedUnit =
        (_selectedRecipe?['produced_unit'] ?? 'pcs').toString();

    return _isLoading
        ? const Center(child: CircularProgressIndicator())
        : ListView(
            padding: const EdgeInsets.all(24),
            children: [
              Text(
                'Production Logging',
                style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF0F172A),
                    ),
              ),
              const SizedBox(height: 6),
              Text(
                'Record true batch production only. Normal kitchen issues remain controlled through POS sales and kitchen standards.',
                style: TextStyle(color: Colors.grey.shade700),
              ),
              const SizedBox(height: 16),
              _HeaderCard(
                entries: [
                  _HeaderEntry('Branch', user?.branchName ?? 'Branch'),
                  _HeaderEntry('Kitchen Shift', widget.shift.shiftNumber),
                  _HeaderEntry('Shift', _shiftLabel()),
                  _HeaderEntry(
                    'Business Date',
                    dateFmt.format(DateTime.parse(widget.shift.shiftDate)),
                  ),
                  _HeaderEntry(
                      'Storekeeper',
                      user?.name.isNotEmpty == true
                          ? user!.name
                          : widget.shift.openedBy),
                  _HeaderEntry(
                      'Department', widget.shift.department ?? 'KITCHEN'),
                ],
              ),
              const SizedBox(height: 16),
              _SectionCard(
                title: 'Select Produced Item',
                icon: Icons.search,
                child: _recipes.isEmpty
                    ? const Text(
                        'No true batch-production standards are configured yet. Add Production (Batch) standards in Branch Accountant → Food Control Standards.',
                      )
                    : _RecipePickerSection(
                        recipes: _recipes,
                        selectedRecipe: _selectedRecipe,
                        onSelected: _selectRecipe,
                        onCleared: () => setState(_clearSelection),
                      ),
              ),
              const SizedBox(height: 16),
              if (_selectedRecipe != null) ...[
                _SectionCard(
                  title: 'Standard Preview',
                  icon: Icons.preview_outlined,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _recipeDisplayName(_selectedRecipe!),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        'Raw Inputs Expected',
                        style: TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 8),
                      for (final input in inputs)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text(
                            '- ${input['raw_item_name']} : ${input['quantity']} ${input['unit'] ?? ''}',
                          ),
                        ),
                      const SizedBox(height: 10),
                      Text(
                        'Expected Output: ${_selectedRecipe!['produced_quantity']} $producedUnit',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Tolerance: ±${_tolerancePercent.toStringAsFixed(1)}%',
                        style: TextStyle(color: Colors.grey.shade700),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _SectionCard(
                  title: 'Raw Used Table',
                  icon: Icons.table_rows_outlined,
                  child: Column(
                    children: [
                      Row(
                        children: const [
                          Expanded(
                              flex: 3,
                              child: Text('# / Raw Item',
                                  style:
                                      TextStyle(fontWeight: FontWeight.w700))),
                          Expanded(
                              flex: 2,
                              child: Text('Available Qty',
                                  style:
                                      TextStyle(fontWeight: FontWeight.w700))),
                          Expanded(
                              flex: 2,
                              child: Text('Qty Used',
                                  style:
                                      TextStyle(fontWeight: FontWeight.w700))),
                          Expanded(
                              flex: 1,
                              child: Text('Unit',
                                  style:
                                      TextStyle(fontWeight: FontWeight.w700))),
                        ],
                      ),
                      const SizedBox(height: 10),
                      for (var i = 0; i < inputs.length; i++)
                        _RawInputLedgerRow(
                          index: i + 1,
                          input: inputs[i],
                          availableQty: _availableKitchenQty(
                              (inputs[i]['raw_item_sku'] ?? '').toString()),
                          controller: _inputControllers[
                              (inputs[i]['raw_item_sku'] ?? '').toString()]!,
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _SectionCard(
                  title: 'Actual Output',
                  icon: Icons.output_outlined,
                  child: Row(
                    children: [
                      Expanded(
                        child: _OutlineField(
                          controller: _producedQtyController,
                          label: 'Produced Quantity',
                          suffix: producedUnit,
                          keyboard: const TextInputType.numberWithOptions(
                              decimal: true),
                          onChanged: (_) => setState(() {}),
                          inputFormatters: [
                            FilteringTextInputFormatter.allow(
                              RegExp(r'^\d*\.?\d*'),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: _ReadOnlyStat(
                          label: 'Expected Output',
                          value:
                              '${expectedQty.toStringAsFixed(2)} $producedUnit',
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _SectionCard(
                  title: 'Produced By',
                  icon: Icons.person_outline,
                  child: _StaffAutocompleteField(
                    controller: _producedByController,
                    staffList: _staff,
                    selectedStaff: _selectedProducedBy,
                    preferredIds: {
                      ...widget.shift.assignedChefIds,
                      ...widget.shift.assignedDispenseIds,
                    },
                    onSelected: (staff) {
                      setState(() {
                        _selectedProducedBy = staff;
                        _producedByController.text = _staffDisplayName(staff);
                      });
                    },
                    onCleared: () {
                      setState(() {
                        _selectedProducedBy = null;
                        _producedByController.clear();
                      });
                    },
                  ),
                ),
                const SizedBox(height: 16),
                _SectionCard(
                  title: 'Variance Summary',
                  icon: Icons.analytics_outlined,
                  child: Wrap(
                    spacing: 16,
                    runSpacing: 16,
                    children: [
                      _ReadOnlyStat(
                        label: 'Expected Output',
                        value:
                            '${expectedQty.toStringAsFixed(2)} $producedUnit',
                      ),
                      _ReadOnlyStat(
                        label: 'Actual Output',
                        value: '${actualQty.toStringAsFixed(2)} $producedUnit',
                      ),
                      _ReadOnlyStat(
                        label: 'Variance',
                        value:
                            '${varianceQty >= 0 ? '+' : ''}${varianceQty.toStringAsFixed(2)} $producedUnit',
                        accent: varianceQty < 0
                            ? Colors.red.shade700
                            : Colors.green.shade700,
                      ),
                      _ReadOnlyStat(
                        label: 'Variance %',
                        value:
                            '${varianceQty >= 0 ? '+' : ''}${variancePct.toStringAsFixed(1)}%',
                        accent: variancePct > _tolerancePercent
                            ? Colors.red.shade700
                            : const Color(0xFF0F172A),
                      ),
                      _ReadOnlyStat(
                        label: 'Status',
                        value: _reasonRequired
                            ? 'Reason required'
                            : (variancePct == 0
                                ? 'Normal'
                                : varianceQty < 0
                                    ? 'Short'
                                    : 'Surplus'),
                        accent: _reasonRequired
                            ? Colors.red.shade700
                            : Colors.green.shade700,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _SectionCard(
                  title: 'Reason Note',
                  icon: Icons.notes_outlined,
                  child: _OutlineField(
                    controller: _reasonController,
                    label: _reasonRequired
                        ? 'Reason for variance (required)'
                        : 'Reason for variance (optional)',
                    hint:
                        'Explain shortages, surplus yield, poor raw quality, spillages, or other production conditions.',
                    maxLines: 3,
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    OutlinedButton.icon(
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close),
                      label: const Text('Cancel'),
                    ),
                    const Spacer(),
                    FilledButton.icon(
                      onPressed: _isSaving ? null : _submit,
                      icon: _isSaving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.save_outlined),
                      label: Text(
                        _isSaving ? 'Saving...' : 'Save Production Log',
                      ),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 20),
              _SectionCard(
                title: 'Production History',
                icon: Icons.history,
                child: _ProductionHistoryTable(
                  productions: _productionHistory,
                  pendingCount:
                      ((_productionSummary['pending_logs'] as List?) ??
                              const [])
                          .length,
                ),
              ),
            ],
          );
  }
}

class _NoActiveShiftView extends StatelessWidget {
  const _NoActiveShiftView({required this.onRefresh});

  final VoidCallback onRefresh;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.orange.shade50,
                shape: BoxShape.circle,
              ),
              child:
                  Icon(Icons.schedule, size: 56, color: Colors.orange.shade400),
            ),
            const SizedBox(height: 24),
            const Text(
              'No Active Kitchen Session',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              'A kitchen shift must be open before logging production. Open a shift from the Kitchen Sessions tab.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600, height: 1.5),
            ),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Check Again'),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeaderEntry {
  const _HeaderEntry(this.label, this.value);

  final String label;
  final String value;
}

class _HeaderCard extends StatelessWidget {
  const _HeaderCard({required this.entries});

  final List<_HeaderEntry> entries;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ],
      ),
      child: Wrap(
        spacing: 18,
        runSpacing: 16,
        children: entries
            .map((entry) => SizedBox(
                  width: 180,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        entry.label,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        entry.value,
                        style: const TextStyle(
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.icon,
    required this.child,
  });

  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
            child: Row(
              children: [
                Icon(icon, size: 20, color: AppColors.kPrimary),
                const SizedBox(width: 10),
                Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 15,
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Padding(
            padding: const EdgeInsets.all(16),
            child: child,
          ),
        ],
      ),
    );
  }
}

class _RecipePickerSection extends StatefulWidget {
  const _RecipePickerSection({
    required this.recipes,
    required this.selectedRecipe,
    required this.onSelected,
    required this.onCleared,
  });

  final List<Map<String, dynamic>> recipes;
  final Map<String, dynamic>? selectedRecipe;
  final ValueChanged<Map<String, dynamic>> onSelected;
  final VoidCallback onCleared;

  @override
  State<_RecipePickerSection> createState() => _RecipePickerSectionState();
}

class _RecipePickerSectionState extends State<_RecipePickerSection> {
  final TextEditingController _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Map<String, dynamic>> get _filtered {
    if (_query.isEmpty) return widget.recipes;
    return widget.recipes.where((recipe) {
      final haystack = [
        recipe['produced_item_name']?.toString() ?? '',
        recipe['recipe_name']?.toString() ?? '',
        recipe['produced_item_sku']?.toString() ?? '',
      ].join(' ').toLowerCase();
      return haystack.contains(_query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.selectedRecipe != null) {
      final recipe = widget.selectedRecipe!;
      final name = (recipe['produced_item_name'] ?? recipe['recipe_name'] ?? 'Selected Item').toString();
      final qty = recipe['produced_quantity']?.toString() ?? '?';
      final unit = (recipe['produced_unit'] ?? 'pcs').toString();
      return Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.kPrimary.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.kPrimary.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            const Icon(Icons.check_circle, color: AppColors.kPrimary, size: 20),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  Text('Expected output: $qty $unit', style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
                ],
              ),
            ),
            TextButton.icon(
              onPressed: widget.onCleared,
              icon: const Icon(Icons.close, size: 16),
              label: const Text('Change'),
            ),
          ],
        ),
      );
    }

    final filtered = _filtered;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          controller: _searchController,
          decoration: const InputDecoration(
            hintText: 'Search batch-production item...',
            border: OutlineInputBorder(),
            prefixIcon: Icon(Icons.search),
            isDense: true,
          ),
          onChanged: (value) => setState(() => _query = value.trim().toLowerCase()),
        ),
        const SizedBox(height: 12),
        if (filtered.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text(
              'No matching items found.',
              style: TextStyle(color: Colors.grey.shade600),
            ),
          )
        else
          Column(
            children: filtered.map((recipe) {
              final name = (recipe['produced_item_name'] ?? recipe['recipe_name'] ?? 'Unnamed').toString();
              final qty = recipe['produced_quantity']?.toString() ?? '?';
              final unit = (recipe['produced_unit'] ?? 'pcs').toString();
              final inputs = ((recipe['inputs'] as List?) ?? const [])
                  .whereType<Map>()
                  .toList();
              final inputSummary = inputs.isEmpty
                  ? (recipe['raw_item_name']?.toString() ?? '')
                  : inputs
                      .map((i) => '${i['raw_item_name'] ?? i['raw_item_sku'] ?? ''} ${i['quantity'] ?? ''} ${i['unit'] ?? ''}'.trim())
                      .join(' + ');

              return InkWell(
                onTap: () => widget.onSelected(recipe),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: AppColors.kPrimary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.blender_outlined, color: AppColors.kPrimary, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                            if (inputSummary.isNotEmpty)
                              Text(
                                'Uses: $inputSummary',
                                style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('$qty $unit', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                          Text('yield', style: TextStyle(color: Colors.grey.shade500, fontSize: 11)),
                        ],
                      ),
                      const SizedBox(width: 8),
                      const Icon(Icons.chevron_right, color: Colors.grey),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
      ],
    );
  }
}

class _RawInputLedgerRow extends StatelessWidget {
  const _RawInputLedgerRow({
    required this.index,
    required this.input,
    required this.availableQty,
    required this.controller,
  });

  final int index;
  final Map<String, dynamic> input;
  final double availableQty;
  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Expanded(
            flex: 3,
            child: Text(
              '$index. ${input['raw_item_name'] ?? input['raw_item_sku']}',
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(
            flex: 2,
            child: Text(
              availableQty.toStringAsFixed(2),
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(
            flex: 2,
            child: TextFormField(
              controller: controller,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
              ],
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                isDense: true,
                hintText: '0.00',
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text((input['unit'] ?? 'unit').toString()),
          ),
        ],
      ),
    );
  }
}

class _StaffAutocompleteField extends StatelessWidget {
  const _StaffAutocompleteField({
    required this.controller,
    required this.staffList,
    required this.selectedStaff,
    required this.preferredIds,
    required this.onSelected,
    required this.onCleared,
  });

  final TextEditingController controller;
  final List<Map<String, dynamic>> staffList;
  final Map<String, dynamic>? selectedStaff;
  final Set<String> preferredIds;
  final ValueChanged<Map<String, dynamic>> onSelected;
  final VoidCallback onCleared;

  @override
  Widget build(BuildContext context) {
    final sortedStaff = [...staffList]..sort((a, b) {
        final aPreferred = preferredIds.contains((a['id'] ?? '').toString());
        final bPreferred = preferredIds.contains((b['id'] ?? '').toString());
        if (aPreferred == bPreferred) {
          return _staffDisplayName(a).compareTo(_staffDisplayName(b));
        }
        return aPreferred ? -1 : 1;
      });

    return Autocomplete<Map<String, dynamic>>(
      displayStringForOption: _staffDisplayName,
      optionsBuilder: (textEditingValue) {
        final query = textEditingValue.text.trim().toLowerCase();
        if (query.isEmpty) return sortedStaff.take(10);
        return sortedStaff.where((staff) {
          final haystack = [
            _staffDisplayName(staff),
            staff['email']?.toString() ?? '',
            staff['employee_id']?.toString() ?? '',
          ].join(' ').toLowerCase();
          return haystack.contains(query);
        }).take(10);
      },
      onSelected: onSelected,
      fieldViewBuilder: (context, textController, focusNode, _) {
        if (textController.text != controller.text) {
          textController.value = controller.value;
        }
        return TextFormField(
          controller: textController,
          focusNode: focusNode,
          decoration: InputDecoration(
            labelText: 'Chef / staff attribution',
            hintText: 'Search assigned chef or kitchen staff',
            border: const OutlineInputBorder(),
            prefixIcon: const Icon(Icons.search),
            suffixIcon: selectedStaff != null
                ? IconButton(
                    onPressed: onCleared,
                    icon: const Icon(Icons.clear),
                  )
                : null,
          ),
          onChanged: (value) {
            if (controller.text != value) {
              controller.value = textController.value;
            }
          },
        );
      },
    );
  }
}

class _ReadOnlyStat extends StatelessWidget {
  const _ReadOnlyStat({
    required this.label,
    required this.value,
    this.accent,
  });

  final String label;
  final String value;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 180,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: accent ?? const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }
}

class _OutlineField extends StatelessWidget {
  const _OutlineField({
    required this.controller,
    required this.label,
    this.hint,
    this.suffix,
    this.keyboard,
    this.maxLines = 1,
    this.inputFormatters,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String? hint;
  final String? suffix;
  final TextInputType? keyboard;
  final int maxLines;
  final List<TextInputFormatter>? inputFormatters;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      maxLines: maxLines,
      keyboardType: keyboard,
      inputFormatters: inputFormatters,
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        suffixText: suffix,
        border: const OutlineInputBorder(),
      ),
    );
  }
}

class _ProductionHistoryTable extends StatelessWidget {
  const _ProductionHistoryTable({
    required this.productions,
    required this.pendingCount,
  });

  final List<Map<String, dynamic>> productions;
  final int pendingCount;

  @override
  Widget build(BuildContext context) {
    if (productions.isEmpty) {
      return Text(
        pendingCount > 0
            ? 'No production logs posted yet. $pendingCount production issue(s) are still pending this shift.'
            : 'No production logs posted yet for this shift.',
        style: TextStyle(color: Colors.grey.shade700),
      );
    }

    final timeFmt = DateFormat('hh:mm a');
    return Column(
      children: productions.take(12).map((production) {
        final time = DateTime.tryParse(
                (production['produced_at'] ?? production['created_at'] ?? '')
                    .toString()) ??
            DateTime.now();
        final variance =
            (production['variance_pct'] as num?)?.toDouble() ?? 0.0;
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              SizedBox(
                width: 90,
                child: Text(timeFmt.format(time)),
              ),
              Expanded(
                flex: 2,
                child: Text(
                  (production['produced_item_name'] ?? 'Produced item')
                      .toString(),
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
              Expanded(
                flex: 2,
                child: Text(
                  (production['raw_used_summary'] ??
                          '${production['raw_item_name'] ?? 'Raw inputs'} ${production['raw_quantity_used'] ?? ''} ${production['raw_unit'] ?? ''}')
                      .toString(),
                ),
              ),
              Expanded(
                child: Text(
                  '${production['actual_quantity'] ?? production['produced_quantity'] ?? ''} ${production['produced_unit'] ?? ''}',
                ),
              ),
              SizedBox(
                width: 90,
                child: Text(
                  '${variance.toStringAsFixed(1)}%',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: variance > 5
                        ? Colors.red.shade700
                        : const Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}

String _staffDisplayName(Map<String, dynamic> staff) {
  final first = (staff['first_name'] ?? '').toString().trim();
  final last = (staff['last_name'] ?? '').toString().trim();
  final full = '$first $last'.trim();
  if (full.isNotEmpty) return full;
  return (staff['name'] ?? staff['email'] ?? staff['id'] ?? 'Unknown Staff')
      .toString();
}
