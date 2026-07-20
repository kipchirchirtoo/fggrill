import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/repository.dart';
import '../domain/providers.dart';

enum YieldType { complex, ratio, direct, subAssembly }
enum StocktakeControlMode { rawOnly, producedOnly, both, none }
enum StocktakeLocation { kitchen, store, both, none }

String _yieldTypeLabel(String? value) {
  switch ((value ?? '').toUpperCase()) {
    case 'DIRECT':
      return 'Direct';
    case 'PRODUCTION':
      return 'Production';
    case 'COMPLEX':
      return 'Complex';
    case 'SUB_ASSEMBLY':
      return 'Sub-Assembly';
    default:
      return 'Standard';
  }
}


String _stocktakeControlLabel(String? value) {
  switch ((value ?? '').toUpperCase()) {
    case 'RAW_ONLY':
      return 'Raw only';
    case 'PRODUCED_ONLY':
      return 'Produced only';
    case 'BOTH':
      return 'Raw + Produced';
    case 'NONE':
      return 'Do not count';
    default:
      return 'Raw + Produced';
  }
}

String _stocktakeLocationLabel(String? value) {
  switch ((value ?? '').toUpperCase()) {
    case 'KITCHEN':
      return 'Kitchen';
    case 'STORE':
      return 'Store';
    case 'BOTH':
      return 'Kitchen + Store';
    case 'NONE':
      return 'Do not load';
    default:
      return 'Kitchen';
  }
}

String _stocktakeControlCode(StocktakeControlMode value) {
  switch (value) {
    case StocktakeControlMode.rawOnly:
      return 'RAW_ONLY';
    case StocktakeControlMode.producedOnly:
      return 'PRODUCED_ONLY';
    case StocktakeControlMode.both:
      return 'BOTH';
    case StocktakeControlMode.none:
      return 'NONE';
  }
}

String _stocktakeLocationCode(StocktakeLocation value) {
  switch (value) {
    case StocktakeLocation.kitchen:
      return 'KITCHEN';
    case StocktakeLocation.store:
      return 'STORE';
    case StocktakeLocation.both:
      return 'BOTH';
    case StocktakeLocation.none:
      return 'NONE';
  }
}

StocktakeControlMode _defaultStocktakeControlForYield(YieldType value) {
  switch (value) {
    case YieldType.direct:
      return StocktakeControlMode.producedOnly;
    case YieldType.ratio:
      return StocktakeControlMode.rawOnly;
    case YieldType.complex:
      return StocktakeControlMode.both;
    case YieldType.subAssembly:
      return StocktakeControlMode.producedOnly;
  }
}

class FoodControlStandardsScreen extends ConsumerWidget {
  const FoodControlStandardsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.white,
          title: const Text('Food Control Standards',
              style: TextStyle(color: Colors.black)),
          elevation: 0,
          bottom: const TabBar(
            tabs: [
              Tab(text: 'Recipe Standards'),
              Tab(text: 'Channel Package Standards'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _RecipeStandardsTab(onAdd: () => _showAddDialog(context, ref)),
            const _ChannelPackageStandardsTab(),
          ],
        ),
      ),
    );
  }

  void _showAddDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const AddStandardDialog(),
    ).then((_) {
      ref.invalidate(kitchenRecipesProvider);
    });
  }
}

class _RecipeStandardsTab extends ConsumerWidget {
  const _RecipeStandardsTab({required this.onAdd});

  final VoidCallback onAdd;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final recipesAsync = ref.watch(kitchenRecipesProvider);
    final directItemsAsync = ref.watch(directFoodControlItemsProvider);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.refresh, color: AppColors.kPrimary),
                onPressed: () {
                  ref.invalidate(kitchenRecipesProvider);
                  ref.invalidate(directFoodControlItemsProvider);
                  ref.invalidate(rawStockCandidatesProvider);
                  ref.invalidate(linkableMenuItemsProvider);
                },
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: onAdd,
                icon: const Icon(Icons.add),
                label: const Text('New Recipe Standard'),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: _DirectMappingsCard(
            directItemsAsync: directItemsAsync,
            onAdd: () => _showAddDirectMappingDialog(context, ref),
            onDeactivate: (id) => _deactivateDirectMapping(context, ref, id),
          ),
        ),
        Expanded(
          child: recipesAsync.when(
            data: (recipes) {
              if (recipes.isEmpty) {
                return const Center(
                    child: Text('No recipe standards configured.'));
              }

              final Map<String, Map<String, dynamic>> grouped = {};
              for (final row in recipes) {
                final inputsList = row['inputs'] as List? ?? [];
                final String inputsKey;
                if (inputsList.isNotEmpty) {
                  final sortedInputs = List.from(inputsList)
                    ..sort((a, b) => (a['raw_item_sku'] ?? '')
                        .compareTo(b['raw_item_sku'] ?? ''));
                  inputsKey = sortedInputs
                      .map((i) => '${i['raw_item_sku']}_${i['quantity']}')
                      .join('|');
                } else {
                  inputsKey =
                      '${row['raw_item_sku'] ?? 'DIRECT'}_${row['raw_quantity'] ?? '0'}';
                }

                final groupKey =
                    '${inputsKey}_${row['recipe_name'] ?? 'Recipe'}';

                if (!grouped.containsKey(groupKey)) {
                  grouped[groupKey] = {
                    'recipe_name': row['recipe_name'],
                    'yield_type_code': row['yield_type_code'],
                    'raw_item_name': row['raw_item_name'],
                    'raw_quantity': row['raw_quantity'],
                    'raw_unit': row['raw_unit'],
                    'stocktake_control_mode': row['stocktake_control_mode'],
                    'stocktake_location': row['stocktake_location'],
                    'prep_stage_code': row['prep_stage_code'],
                    'prep_stage_group': row['prep_stage_group'],
                    'prep_stage_order': row['prep_stage_order'],
                    'inputs': inputsList,
                    'outputs': [],
                    'all_recipe_ids': <String>[],
                  };
                }

                final grp = grouped[groupKey]!;
                (grp['all_recipe_ids'] as List<String>)
                    .add(row['id']?.toString() ?? '');

                if (row['produced_item_name'] != null) {
                  (grp['outputs'] as List).add({
                    'produced_item_name': row['produced_item_name'],
                    'produced_quantity': row['produced_quantity'],
                    'produced_unit': row['produced_unit'],
                    'pos_outlet_item_id': row['pos_outlet_item_id'],
                  });
                }
              }
              final groupedRecipes = grouped.values.toList();

              return ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: groupedRecipes.length,
                itemBuilder: (context, index) {
                  final recipe = groupedRecipes[index];
                  final outputs = recipe['outputs'] as List? ?? [];
                  final inputs = recipe['inputs'] as List? ?? [];
                  final titleText = inputs.isNotEmpty
                      ? inputs
                          .map((i) =>
                              '${i['raw_item_name']} (${i['quantity']} ${i['unit']})')
                          .join(' + ')
                      : '${recipe['raw_item_name']} (${recipe['raw_quantity']} ${recipe['raw_unit']})';

                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                    child: ExpansionTile(
                      title: Text(titleText,
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text(
                          'Produces ${outputs.length} distinct item(s)',
                          style: TextStyle(
                              color: Colors.grey.shade600, fontSize: 13)),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.edit_outlined,
                                color: Color(0xFF1D4ED8)),
                            tooltip: 'Edit standard',
                            onPressed: () =>
                                _showEditDialog(context, ref, recipe),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline,
                                color: Colors.red),
                            tooltip: 'Deactivate standard',
                            onPressed: () => _confirmDelete(context, ref,
                                recipe['all_recipe_ids'] as List<String>),
                          ),
                        ],
                      ),
                      children: [
                        Padding(
                          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              Chip(
                                visualDensity: VisualDensity.compact,
                                label: Text(
                                  _yieldTypeLabel(
                                    outputs.isNotEmpty
                                        ? outputs.first['yield_type_code']
                                                ?.toString() ??
                                            recipe['yield_type_code']
                                                ?.toString()
                                        : recipe['yield_type_code']
                                            ?.toString(),
                                  ),
                                ),
                              ),
                              Chip(
                                visualDensity: VisualDensity.compact,
                                label: Text(
                                  'Count: ${_stocktakeControlLabel(recipe['stocktake_control_mode']?.toString())}',
                                ),
                              ),
                              Chip(
                                visualDensity: VisualDensity.compact,
                                label: Text(
                                  'Load: ${_stocktakeLocationLabel(recipe['stocktake_location']?.toString())}',
                                ),
                              ),
                              if (recipe['prep_stage_code'] != null)
                                const Chip(
                                  visualDensity: VisualDensity.compact,
                                  label: Text('Prep Return Flow'),
                                ),
                            ],
                          ),
                        ),
                        for (final out in outputs)
                          ListTile(
                            dense: true,
                            leading: const Icon(Icons.subdirectory_arrow_right,
                                size: 20),
                            title: Text(out['produced_item_name'] ?? 'Unknown'),
                            subtitle: Text(
                              recipe['recipe_name']?.toString().trim().isNotEmpty ==
                                      true
                                  ? recipe['recipe_name'].toString()
                                  : titleText,
                              style: TextStyle(
                                color: Colors.grey.shade600,
                                fontSize: 12,
                              ),
                            ),
                            trailing: Text(
                                '${out['produced_quantity']} ${out['produced_unit'] ?? 'pcs'}',
                                style: const TextStyle(
                                    fontWeight: FontWeight.w600)),
                          )
                      ],
                    ),
                  );
                },
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, st) => Center(child: Text('Error: $err')),
          ),
        ),
      ],
    );
  }

  void _showAddDirectMappingDialog(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const _AddDirectMappingDialog(),
    ).then((_) {
      ref.invalidate(directFoodControlItemsProvider);
    });
  }

  Future<void> _deactivateDirectMapping(
    BuildContext context,
    WidgetRef ref,
    String id,
  ) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove direct mapping?'),
        content: const Text(
          'This direct 1:1 food control mapping will stop loading into Daily Controls once removed.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Remove'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    try {
      await ref
          .read(branchAccountantRepositoryProvider)
          .deactivateDirectFoodControlItem(id);
      ref.invalidate(directFoodControlItemsProvider);
      if (context.mounted) {
        AppNotifier.show(context, 'Direct mapping removed.');
      }
    } catch (e) {
      if (context.mounted) {
        AppNotifier.show(
          context,
          'Failed to remove direct mapping: $e',
          isError: true,
        );
      }
    }
  }

  void _showEditDialog(
      BuildContext context, WidgetRef ref, Map<String, dynamic> recipe) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AddStandardDialog(editData: recipe),
    ).then((_) {
      ref.invalidate(kitchenRecipesProvider);
    });
  }

  void _confirmDelete(
      BuildContext context, WidgetRef ref, List<String> recipeIds) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Deactivate Standard?'),
        content: const Text(
            'Are you sure you want to remove this food control standard?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                for (final id in recipeIds) {
                  await ref
                      .read(branchAccountantRepositoryProvider)
                      .deactivateKitchenRecipe(id);
                }
                ref.invalidate(kitchenRecipesProvider);
                if (context.mounted) {
                  AppNotifier.show(context, 'Standard deactivated.');
                }
              } catch (e) {
                if (context.mounted) {
                  AppNotifier.show(context, 'Failed to deactivate: $e',
                      isError: true);
                }
              }
            },
            child: const Text('Deactivate'),
          ),
        ],
      ),
    );
  }
}

class _ChannelPackageStandardsTab extends ConsumerStatefulWidget {
  const _ChannelPackageStandardsTab();

  static const _channels = [
    {'code': 'accommodation_breakfast', 'label': 'Accommodation Breakfast'},
    {'code': 'staff_meal', 'label': 'Staff Meal'},
    {'code': 'buffet', 'label': 'Buffet'},
    {'code': 'conference_event', 'label': 'Conference'},
    {'code': 'outside_catering', 'label': 'Outside Catering'},
    {'code': 'group_meal', 'label': 'Group Meal'},
  ];

  @override
  ConsumerState<_ChannelPackageStandardsTab> createState() =>
      _ChannelPackageStandardsTabState();
}

class _ChannelPackageStandardsTabState
    extends ConsumerState<_ChannelPackageStandardsTab> {
  final _packageNameController = TextEditingController();
  final List<_ChannelStandardDraftRow> _draftRows = [_ChannelStandardDraftRow()];
  final List<_ChannelMenuDraftRow> _menuRows = [_ChannelMenuDraftRow()];
  String _channel = 'accommodation_breakfast';
  bool _showEditor = false;
  bool _isSaving = false;

  @override
  void dispose() {
    _packageNameController.dispose();
    for (final row in _draftRows) {
      row.dispose();
    }
    for (final row in _menuRows) {
      row.dispose();
    }
    super.dispose();
  }

  String _labelFor(String code) {
    for (final row in _ChannelPackageStandardsTab._channels) {
      if (row['code'] == code) return row['label']!;
    }
    return code;
  }

  bool _channelRequiresEventOrder(String channel) {
    return {
      'buffet',
      'conference_event',
      'outside_catering',
      'group_meal',
    }.contains(channel);
  }

  bool _channelRequiresNamedPackage(String channel) {
    return _channelRequiresEventOrder(channel);
  }

  void _resetEditor() {
    _packageNameController.clear();
    for (final row in _draftRows) {
      row.dispose();
    }
    for (final row in _menuRows) {
      row.dispose();
    }
    _draftRows
      ..clear()
      ..add(_ChannelStandardDraftRow());
    _menuRows
      ..clear()
      ..add(_ChannelMenuDraftRow());
    _channel = 'accommodation_breakfast';
  }

  Future<void> _saveDraftRows() async {
    final validRawRows = _draftRows
        .where((row) =>
            row.selectedItem != null &&
            (double.tryParse(row.quantityController.text.trim()) ?? 0) > 0 &&
            row.unitController.text.trim().isNotEmpty)
        .toList();

    final validMenuRows = _menuRows
        .where((row) =>
            row.selectedItem != null &&
            (double.tryParse(row.quantityController.text.trim()) ?? 0) > 0 &&
            row.unitController.text.trim().isNotEmpty)
        .toList();

    if (validRawRows.isEmpty) {
      AppNotifier.show(
        context,
        'Add at least one valid raw item standard.',
        isError: true,
      );
      return;
    }

    if (validMenuRows.isEmpty) {
      AppNotifier.show(
        context,
        'Add at least one POS outlet menu item that this package serves.',
        isError: true,
      );
      return;
    }

    if (_channelRequiresNamedPackage(_channel) &&
        _packageNameController.text.trim().isEmpty) {
      AppNotifier.show(
        context,
        'Package / Menu Package Name is required for event-backed channels.',
        isError: true,
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      for (final row in validRawRows) {
        final item = row.selectedItem!;
        await repo.createChannelFoodStandard({
          'channel': _channel,
          'package_name': _packageNameController.text.trim(),
          'raw_item_sku': '${item['sku'] ?? ''}'.trim(),
          'raw_item_name':
              '${item['item_name'] ?? item['name'] ?? item['sku'] ?? ''}'.trim(),
          'quantity_per_pax':
              double.tryParse(row.quantityController.text.trim()) ?? 0,
          'unit': row.unitController.text.trim(),
        });
      }

      for (final row in validMenuRows) {
        final item = row.selectedItem!;
        await repo.createChannelPackageMenuItem({
          'channel': _channel,
          'package_name': _packageNameController.text.trim(),
          'pos_outlet_item_id': '${item['id'] ?? ''}'.trim(),
          'quantity_per_pax':
              double.tryParse(row.quantityController.text.trim()) ?? 0,
          'unit': row.unitController.text.trim(),
        });
      }

      ref.invalidate(channelFoodStandardsProvider);
      ref.invalidate(channelPackageMenuItemsProvider);
      if (!mounted) return;
      AppNotifier.show(context, 'Channel package standards saved.');
      setState(() {
        _showEditor = false;
        _resetEditor();
      });
    } catch (e) {
      if (!mounted) return;
      AppNotifier.show(
        context,
        'Failed to save channel standards: $e',
        isError: true,
      );
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final standardsAsync = ref.watch(channelFoodStandardsProvider);
    final menuStandardsAsync = ref.watch(channelPackageMenuItemsProvider);
    final rawCandidates =
        ref.watch(rawStockCandidatesProvider).valueOrNull ?? const [];
    final menuCandidates =
        ref.watch(linkableMenuItemsProvider).valueOrNull ?? const [];

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: Row(
            children: [
              IconButton(
                icon: const Icon(Icons.refresh, color: AppColors.kPrimary),
                onPressed: () {
                  ref.invalidate(channelFoodStandardsProvider);
                  ref.invalidate(channelPackageMenuItemsProvider);
                  ref.invalidate(rawStockCandidatesProvider);
                  ref.invalidate(linkableMenuItemsProvider);
                },
              ),
              const Spacer(),
              FilledButton.icon(
                onPressed: () => setState(() => _showEditor = true),
                icon: const Icon(Icons.add),
                label: const Text('New Channel Standard'),
              ),
            ],
          ),
        ),
        Expanded(
          child: standardsAsync.when(
            data: (rawRows) => menuStandardsAsync.when(
              data: (menuRows) {
                final grouped = <String, Map<String, dynamic>>{};

                for (final rawRow in rawRows) {
                  final key =
                      '${rawRow['channel']}::${rawRow['package_name'] ?? '__default__'}';
                  final group = grouped.putIfAbsent(key, () {
                    return {
                      'channel': rawRow['channel'],
                      'package_name': rawRow['package_name'],
                      'raw_items': <Map<String, dynamic>>[],
                      'menu_items': <Map<String, dynamic>>[],
                    };
                  });
                  (group['raw_items'] as List<Map<String, dynamic>>)
                      .add(Map<String, dynamic>.from(rawRow));
                }

                for (final menuRow in menuRows) {
                  final key =
                      '${menuRow['channel']}::${menuRow['package_name'] ?? '__default__'}';
                  final group = grouped.putIfAbsent(key, () {
                    return {
                      'channel': menuRow['channel'],
                      'package_name': menuRow['package_name'],
                      'raw_items': <Map<String, dynamic>>[],
                      'menu_items': <Map<String, dynamic>>[],
                    };
                  });
                  (group['menu_items'] as List<Map<String, dynamic>>)
                      .add(Map<String, dynamic>.from(menuRow));
                }

                final groups = grouped.values.toList()
                  ..sort((a, b) => '${a['channel']}${a['package_name'] ?? ''}'
                      .compareTo('${b['channel']}${b['package_name'] ?? ''}'));

                return ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_showEditor)
                      Card(
                        margin: const EdgeInsets.only(bottom: 16),
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Channel Package Standards Editor',
                                style: TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 6),
                              const Text(
                                'Set what POS outlet menu items a package serves, and the raw stock items needed per pax. Event Orders only load package names that are configured on both sides.',
                                style: TextStyle(color: Colors.black54),
                              ),
                              const SizedBox(height: 18),
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Expanded(
                                    child: DropdownButtonFormField<String>(
                                      initialValue: _channel,
                                      decoration: const InputDecoration(
                                        labelText: 'Channel',
                                      ),
                                      items: _ChannelPackageStandardsTab._channels
                                          .map(
                                            (item) => DropdownMenuItem<String>(
                                              value: item['code'],
                                              child: Text(item['label']!),
                                            ),
                                          )
                                          .toList(),
                                      onChanged: (value) => setState(
                                        () => _channel = value ?? _channel,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 16),
                                  Expanded(
                                    flex: 2,
                                    child: TextFormField(
                                      controller: _packageNameController,
                                      decoration: InputDecoration(
                                        labelText:
                                            _channelRequiresNamedPackage(_channel)
                                                ? 'Package / Menu Package Name'
                                                : 'Package / Standard Name',
                                        helperText:
                                            _channelRequiresNamedPackage(_channel)
                                                ? 'Required for Buffet, Conference, Outside Catering, and Group Meal. This must match the Event Order menu package.'
                                                : 'Leave blank only when this should be the default standard for the selected channel.',
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              if (_channelRequiresEventOrder(_channel)) ...[
                                const SizedBox(height: 12),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFFF7E8),
                                    border: Border.all(
                                      color: const Color(0xFFFFD785),
                                    ),
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: const Text(
                                    'This channel is Event Order backed. The served menu items and raw stock rows you save here define what the event order package means operationally.',
                                    style: TextStyle(fontSize: 13),
                                  ),
                                ),
                              ],
                              const SizedBox(height: 18),
                              _EditorMatrixSection(
                                title: 'POS Outlet Menu Items Served',
                                subtitle:
                                    'These are the menu items the guest/event package serves in the POS outlet.',
                                addLabel: 'Add Menu Item Line',
                                header: const [
                                  _MatrixColumn(label: '#', flex: 1),
                                  _MatrixColumn(label: 'POS Item Search', flex: 4),
                                  _MatrixColumn(label: 'Item Name', flex: 3),
                                  _MatrixColumn(label: 'SKU', flex: 2),
                                  _MatrixColumn(label: 'Unit', flex: 1),
                                  _MatrixColumn(label: 'Qty / Pax', flex: 1),
                                  _MatrixColumn(label: '', flex: 1),
                                ],
                                onAddLine: () => setState(
                                  () => _menuRows.add(_ChannelMenuDraftRow()),
                                ),
                                child: Column(
                                  children: [
                                    for (var index = 0;
                                        index < _menuRows.length;
                                        index++) ...[
                                      _ChannelMenuDraftRowWidget(
                                        index: index,
                                        row: _menuRows[index],
                                        menuCandidates: menuCandidates,
                                        selectedIds: _menuRows
                                            .asMap()
                                            .entries
                                            .where((entry) => entry.key != index)
                                            .map(
                                              (entry) => entry
                                                      .value.selectedItem?['id']
                                                      ?.toString() ??
                                                  '',
                                            )
                                            .where((id) => id.isNotEmpty)
                                            .toList(),
                                        onRemove: _menuRows.length == 1
                                            ? null
                                            : () => setState(() {
                                                  _menuRows[index].dispose();
                                                  _menuRows.removeAt(index);
                                                }),
                                      ),
                                      if (index != _menuRows.length - 1)
                                        Divider(
                                          height: 1,
                                          color: Colors.grey.shade200,
                                        ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(height: 18),
                              _EditorMatrixSection(
                                title: 'Raw Stock Items Required',
                                subtitle:
                                    'These are the raw stock items required per pax for this package.',
                                addLabel: 'Add Raw Item Line',
                                header: const [
                                  _MatrixColumn(label: '#', flex: 1),
                                  _MatrixColumn(label: 'Raw Item Search', flex: 4),
                                  _MatrixColumn(label: 'Item Name', flex: 3),
                                  _MatrixColumn(label: 'SKU', flex: 2),
                                  _MatrixColumn(label: 'Unit', flex: 1),
                                  _MatrixColumn(label: 'Qty / Pax', flex: 1),
                                  _MatrixColumn(label: '', flex: 1),
                                ],
                                onAddLine: () => setState(
                                  () =>
                                      _draftRows.add(_ChannelStandardDraftRow()),
                                ),
                                child: Column(
                                  children: [
                                    for (var index = 0;
                                        index < _draftRows.length;
                                        index++) ...[
                                      _ChannelStandardDraftRowWidget(
                                        index: index,
                                        row: _draftRows[index],
                                        rawCandidates: rawCandidates,
                                        onRemove: _draftRows.length == 1
                                            ? null
                                            : () => setState(() {
                                                  _draftRows[index].dispose();
                                                  _draftRows.removeAt(index);
                                                }),
                                      ),
                                      if (index != _draftRows.length - 1)
                                        Divider(
                                          height: 1,
                                          color: Colors.grey.shade200,
                                        ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(height: 18),
                              Row(
                                children: [
                                  TextButton(
                                    onPressed: _isSaving
                                        ? null
                                        : () => setState(() {
                                              _showEditor = false;
                                              _resetEditor();
                                            }),
                                    child: const Text('Cancel'),
                                  ),
                                  const Spacer(),
                                  FilledButton.icon(
                                    onPressed: _isSaving ? null : _saveDraftRows,
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
                                      _isSaving
                                          ? 'Saving...'
                                          : 'Save Channel Standard',
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    if (groups.isEmpty)
                      const Padding(
                        padding: EdgeInsets.only(top: 48),
                        child: Center(
                          child: Text(
                            'No channel package standards configured yet.',
                          ),
                        ),
                      )
                    else
                      ...groups.map((group) {
                        final packageName =
                            '${group['package_name'] ?? ''}'.trim().isEmpty
                                ? 'Default Standard'
                                : '${group['package_name']}';
                        final rawItems =
                            (group['raw_items'] as List<Map<String, dynamic>>?) ??
                                const [];
                        final servedItems = (group['menu_items']
                                as List<Map<String, dynamic>>?) ??
                            const [];

                        return Card(
                          margin: const EdgeInsets.only(bottom: 12),
                          child: ExpansionTile(
                            title: Text(
                              _labelFor('${group['channel']}'),
                              style: const TextStyle(fontWeight: FontWeight.w700),
                            ),
                            subtitle: Text(
                              '$packageName â€¢ ${servedItems.length} menu item(s) â€¢ ${rawItems.length} raw item(s)',
                            ),
                            childrenPadding:
                                const EdgeInsets.fromLTRB(16, 0, 16, 16),
                            children: [
                              const SizedBox(height: 4),
                              _ConfiguredPackageSection(
                                title: 'Served POS Menu Items',
                                emptyLabel:
                                    'No served POS outlet items configured for this package.',
                                children: servedItems.map((item) {
                                  final itemName =
                                      '${item['pos_item_name'] ?? item['item_name'] ?? item['name'] ?? 'POS Item'}'
                                          .trim();
                                  final sku =
                                      '${item['pos_item_sku'] ?? item['sku'] ?? ''}'
                                          .trim();
                                  final unit =
                                      '${item['unit'] ?? 'pcs'}'.trim();
                                  return ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(itemName.isEmpty ? sku : itemName),
                                    subtitle: Text('$sku â€¢ $unit'),
                                    trailing: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          '${item['quantity_per_pax']} $unit / pax',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        IconButton(
                                          icon: const Icon(
                                            Icons.delete_outline,
                                            color: Colors.red,
                                          ),
                                          onPressed: () async {
                                            await ref
                                                .read(
                                                  branchAccountantRepositoryProvider,
                                                )
                                                .deleteChannelPackageMenuItem(
                                                  '${item['id']}',
                                                );
                                            ref.invalidate(
                                              channelPackageMenuItemsProvider,
                                            );
                                          },
                                        ),
                                      ],
                                    ),
                                  );
                                }).toList(),
                              ),
                              const SizedBox(height: 12),
                              _ConfiguredPackageSection(
                                title: 'Raw Stock Items',
                                emptyLabel:
                                    'No raw stock standards configured for this package.',
                                children: rawItems.map((item) {
                                  final itemName =
                                      '${item['raw_item_name'] ?? item['item_name'] ?? item['raw_item_sku'] ?? 'Raw Item'}'
                                          .trim();
                                  final sku =
                                      '${item['raw_item_sku'] ?? item['sku'] ?? ''}'
                                          .trim();
                                  final unit =
                                      '${item['unit'] ?? 'unit'}'.trim();
                                  return ListTile(
                                    contentPadding: EdgeInsets.zero,
                                    title: Text(itemName.isEmpty ? sku : itemName),
                                    subtitle: Text('$sku â€¢ $unit'),
                                    trailing: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Text(
                                          '${item['quantity_per_pax']} $unit / pax',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        IconButton(
                                          icon: const Icon(
                                            Icons.delete_outline,
                                            color: Colors.red,
                                          ),
                                          onPressed: () async {
                                            await ref
                                                .read(
                                                  branchAccountantRepositoryProvider,
                                                )
                                                .deleteChannelFoodStandard(
                                                  '${item['id']}',
                                                );
                                            ref.invalidate(
                                              channelFoodStandardsProvider,
                                            );
                                          },
                                        ),
                                      ],
                                    ),
                                  );
                                }).toList(),
                              ),
                            ],
                          ),
                        );
                      }),
                  ],
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, st) => Center(child: Text('Error: $err')),
            ),
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (err, st) => Center(child: Text('Error: $err')),
          ),
        ),
      ],
    );
  }
}

class _ChannelStandardDraftRow {
  _ChannelStandardDraftRow() : quantityController = TextEditingController();

  Map<String, dynamic>? selectedItem;
  final TextEditingController quantityController;
  final TextEditingController unitController = TextEditingController();

  void applyItem(Map<String, dynamic> item) {
    selectedItem = Map<String, dynamic>.from(item);
    unitController.text =
        '${item['unit'] ?? item['unit_of_measure'] ?? ''}'.trim();
  }

  void dispose() {
    quantityController.dispose();
    unitController.dispose();
  }
}

class _ChannelMenuDraftRow {
  _ChannelMenuDraftRow() : quantityController = TextEditingController();

  Map<String, dynamic>? selectedItem;
  final TextEditingController quantityController;
  final TextEditingController unitController = TextEditingController();

  void applyItem(Map<String, dynamic> item) {
    selectedItem = Map<String, dynamic>.from(item);
    unitController.text = '${item['unit'] ?? 'pcs'}'.trim();
  }

  void dispose() {
    quantityController.dispose();
    unitController.dispose();
  }
}

class _MatrixColumn {
  const _MatrixColumn({required this.label, required this.flex});

  final String label;
  final int flex;
}

class _EditorMatrixSection extends StatelessWidget {
  const _EditorMatrixSection({
    required this.title,
    required this.subtitle,
    required this.addLabel,
    required this.header,
    required this.onAddLine,
    required this.child,
  });

  final String title;
  final String subtitle;
  final String addLabel;
  final List<_MatrixColumn> header;
  final VoidCallback onAddLine;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(color: Colors.black54),
            ),
            const SizedBox(height: 14),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: ConstrainedBox(
                constraints: const BoxConstraints(minWidth: 1040),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 14,
                      ),
                      decoration: const BoxDecoration(
                        color: Color(0xFF173A70),
                        borderRadius: BorderRadius.vertical(
                          top: Radius.circular(12),
                        ),
                      ),
                      child: Row(
                        children: [
                          for (final column in header)
                            Expanded(
                              flex: column.flex,
                              child: Text(
                                column.label,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    Container(
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade200),
                        borderRadius: const BorderRadius.vertical(
                          bottom: Radius.circular(12),
                        ),
                      ),
                      child: child,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            OutlinedButton.icon(
              onPressed: onAddLine,
              icon: const Icon(Icons.add),
              label: Text(addLabel),
            ),
          ],
        ),
      ),
    );
  }
}

class _ConfiguredPackageSection extends StatelessWidget {
  const _ConfiguredPackageSection({
    required this.title,
    required this.emptyLabel,
    required this.children,
  });

  final String title;
  final String emptyLabel;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFD),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          if (children.isEmpty)
            Text(
              emptyLabel,
              style: const TextStyle(color: Colors.black54),
            )
          else
            ...children,
        ],
      ),
    );
  }
}

class _ChannelMenuDraftRowWidget extends StatelessWidget {
  const _ChannelMenuDraftRowWidget({
    required this.index,
    required this.row,
    required this.menuCandidates,
    required this.selectedIds,
    required this.onRemove,
  });

  final int index;
  final _ChannelMenuDraftRow row;
  final List<Map<String, dynamic>> menuCandidates;
  final List<String> selectedIds;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          SizedBox(
            width: 48,
            child: Text(
              '${index + 1}',
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
          Expanded(
            flex: 4,
            child: Autocomplete<Map<String, dynamic>>(
              optionsBuilder: (textEditingValue) {
                final q = textEditingValue.text.trim().toLowerCase();
                final filtered = menuCandidates.where((item) {
                  final id = '${item['id'] ?? ''}'.trim();
                  if (id.isNotEmpty && selectedIds.contains(id)) return false;
                  final sku = '${item['sku'] ?? ''}'.toLowerCase();
                  final name =
                      '${item['name'] ?? item['item_name'] ?? ''}'.toLowerCase();
                  return q.isEmpty || sku.contains(q) || name.contains(q);
                });
                return filtered.take(20);
              },
              displayStringForOption: (option) =>
                  '${option['name'] ?? option['item_name'] ?? option['sku']}',
              fieldViewBuilder:
                  (context, controller, focusNode, onEditingComplete) {
                if (controller.text.isEmpty && row.selectedItem != null) {
                  controller.text =
                      '${row.selectedItem!['name'] ?? row.selectedItem!['item_name'] ?? row.selectedItem!['sku']}';
                }
                return TextFormField(
                  controller: controller,
                  focusNode: focusNode,
                  decoration: const InputDecoration(
                    hintText: 'Search menu item by name or SKU',
                    prefixIcon: Icon(Icons.search),
                  ),
                );
              },
              optionsViewBuilder: (context, onSelected, options) {
                final list = options.toList();
                return Align(
                  alignment: Alignment.topLeft,
                  child: Material(
                    elevation: 4,
                    borderRadius: BorderRadius.circular(12),
                    child: ConstrainedBox(
                      constraints:
                          const BoxConstraints(maxWidth: 460, maxHeight: 260),
                      child: ListView.builder(
                        padding: EdgeInsets.zero,
                        shrinkWrap: true,
                        itemCount: list.length,
                        itemBuilder: (context, index) {
                          final option = list[index];
                          return ListTile(
                            title: Text(
                              '${option['name'] ?? option['item_name'] ?? option['sku'] ?? 'POS Item'}',
                            ),
                            subtitle: Text(
                              '${option['sku'] ?? ''} â€¢ ${option['unit'] ?? 'pcs'}',
                            ),
                            onTap: () => onSelected(option),
                          );
                        },
                      ),
                    ),
                  ),
                );
              },
              onSelected: row.applyItem,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 3,
            child: Text(
              '${row.selectedItem?['name'] ?? row.selectedItem?['item_name'] ?? '-'}',
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: Text(
              '${row.selectedItem?['sku'] ?? '-'}',
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextFormField(
              controller: row.unitController,
              decoration: const InputDecoration(hintText: 'Unit'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextFormField(
              controller: row.quantityController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
              ],
              decoration: const InputDecoration(hintText: '0.00'),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 48,
            child: IconButton(
              onPressed: onRemove,
              icon: Icon(
                Icons.delete_outline,
                color: onRemove == null ? Colors.grey.shade400 : Colors.red,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
class _DirectMappingsCard extends StatelessWidget {
  const _DirectMappingsCard({
    required this.directItemsAsync,
    required this.onAdd,
    required this.onDeactivate,
  });

  final AsyncValue<List<Map<String, dynamic>>> directItemsAsync;
  final VoidCallback onAdd;
  final ValueChanged<String> onDeactivate;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Direct 1:1 POS Links',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                    SizedBox(height: 4),
                    Text(
                      'Use this for branch stock items that sell directly in POS without recipe conversion.',
                      style: TextStyle(fontSize: 13, color: Colors.black54),
                    ),
                  ],
                ),
              ),
              FilledButton.icon(
                onPressed: onAdd,
                icon: const Icon(Icons.add_link),
                label: const Text('Add Direct Link'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          directItemsAsync.when(
            data: (items) {
              if (items.isEmpty) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: Text(
                    'No direct 1:1 mappings configured.',
                    style: TextStyle(color: Colors.grey),
                  ),
                );
              }
              return Column(
                children: items.map((item) {
                  final pos = Map<String, dynamic>.from(
                    (item['pos_outlet_item'] as Map?) ?? const {},
                  );
                  final stockName = '${item['stock_item_name'] ?? ''}'.trim();
                  final stockSku = '${item['stock_item_sku'] ?? ''}'.trim();
                  final posName = '${pos['name'] ?? ''}'.trim();
                  final posSku = '${pos['sku'] ?? ''}'.trim();
                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFD),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Wrap(
                            spacing: 10,
                            runSpacing: 6,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text(
                                stockName.isEmpty ? stockSku : stockName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              if (stockSku.isNotEmpty)
                                Text(
                                  stockSku,
                                  style: const TextStyle(color: Colors.black54),
                                ),
                              const Icon(Icons.arrow_forward, size: 16),
                              Text(
                                posName.isEmpty ? 'POS item' : posName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.kPrimary,
                                ),
                              ),
                              if (posSku.isNotEmpty)
                                Text(
                                  posSku,
                                  style: const TextStyle(color: Colors.black54),
                                ),
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: 'Remove mapping',
                          onPressed: () =>
                              onDeactivate('${item['id'] ?? ''}'.trim()),
                          icon: const Icon(
                            Icons.delete_outline,
                            color: Colors.red,
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              );
            },
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, _) => Text(
              'Failed to load direct links: $error',
              style: const TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );
  }
}

class _AddDirectMappingDialog extends ConsumerStatefulWidget {
  const _AddDirectMappingDialog();

  @override
  ConsumerState<_AddDirectMappingDialog> createState() =>
      _AddDirectMappingDialogState();
}

class _AddDirectMappingDialogState
    extends ConsumerState<_AddDirectMappingDialog> {
  Map<String, dynamic>? _selectedRawItem;
  Map<String, dynamic>? _selectedPosItem;
  bool _isSaving = false;

  @override
  Widget build(BuildContext context) {
    final rawItemsAsync = ref.watch(rawStockCandidatesProvider);
    final posItemsAsync = ref.watch(linkableMenuItemsProvider);

    return AlertDialog(
      title: const Text('Add Direct 1:1 POS Link'),
      content: SizedBox(
        width: 760,
        child: rawItemsAsync.when(
          loading: () => const SizedBox(
            height: 180,
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (error, _) => Text('Failed to load raw stock: $error'),
          data: (rawItems) => posItemsAsync.when(
            loading: () => const SizedBox(
              height: 180,
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (error, _) => Text('Failed to load POS items: $error'),
            data: (posItems) => Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Create a direct pass-through mapping for branch stock items that sell in POS without recipe conversion.',
                  style: TextStyle(fontSize: 13, color: Colors.black54),
                ),
                const SizedBox(height: 16),
                _SearchableMapField(
                  label: 'Raw Stock Item',
                  hint: 'Search raw stock by item name or SKU',
                  options: rawItems,
                  value: _selectedRawItem,
                  displayBuilder: (row) =>
                      '${row['item_name'] ?? row['name'] ?? 'Unknown'}'.trim(),
                  searchTextBuilder: (row) =>
                      '${row['item_name'] ?? row['name'] ?? ''} ${row['sku'] ?? ''}'
                          .toLowerCase(),
                  subtitleBuilder: (row) =>
                      '${row['sku'] ?? ''} â€¢ ${row['unit'] ?? row['unit_of_measure'] ?? 'unit'}'
                          .trim(),
                  onChanged: (row) => setState(() => _selectedRawItem = row),
                ),
                const SizedBox(height: 16),
                _SearchableMapField(
                  label: 'POS Outlet Item',
                  hint: 'Search POS item by name or SKU',
                  options: posItems,
                  value: _selectedPosItem,
                  displayBuilder: (row) => '${row['name'] ?? 'Unknown'}'.trim(),
                  searchTextBuilder: (row) =>
                      '${row['name'] ?? ''} ${row['sku'] ?? ''}'.toLowerCase(),
                  subtitleBuilder: (row) =>
                      '${row['sku'] ?? ''} â€¢ ${row['unit'] ?? 'pcs'}'.trim(),
                  onChanged: (row) => setState(() => _selectedPosItem = row),
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFD),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Text(
                    _selectedRawItem == null || _selectedPosItem == null
                        ? 'Select both the raw stock item and the POS outlet item.'
                        : '${_selectedRawItem!['item_name'] ?? _selectedRawItem!['name'] ?? 'Raw item'} '
                            'will be treated as a direct 1:1 stock-controlled sale for '
                            '${_selectedPosItem!['name'] ?? 'the selected POS item'}.',
                    style: const TextStyle(fontSize: 13),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _isSaving ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _isSaving ? null : _save,
          child: _isSaving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2,
                  ),
                )
              : const Text('Save Direct Link'),
        ),
      ],
    );
  }

  Future<void> _save() async {
    if (_selectedRawItem == null || _selectedPosItem == null) {
      AppNotifier.show(
        context,
        'Select both the raw stock item and the POS outlet item.',
        isError: true,
      );
      return;
    }

    setState(() => _isSaving = true);
    try {
      await ref
          .read(branchAccountantRepositoryProvider)
          .createDirectFoodControlItem({
        'stock_item_sku':
            '${_selectedRawItem!['sku'] ?? _selectedRawItem!['item_id'] ?? ''}'
                .trim(),
        'stock_item_name':
            '${_selectedRawItem!['item_name'] ?? _selectedRawItem!['name'] ?? ''}'
                .trim(),
        'pos_outlet_item_id': '${_selectedPosItem!['id'] ?? ''}'.trim(),
      });
      if (!mounted) return;
      AppNotifier.show(context, 'Direct 1:1 link saved.');
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      AppNotifier.show(
        context,
        'Failed to save direct link: $e',
        isError: true,
      );
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }
}

class _SearchableMapField extends StatelessWidget {
  const _SearchableMapField({
    required this.label,
    required this.hint,
    required this.options,
    required this.value,
    required this.displayBuilder,
    required this.searchTextBuilder,
    required this.subtitleBuilder,
    required this.onChanged,
  });

  final String label;
  final String hint;
  final List<Map<String, dynamic>> options;
  final Map<String, dynamic>? value;
  final String Function(Map<String, dynamic>) displayBuilder;
  final String Function(Map<String, dynamic>) searchTextBuilder;
  final String Function(Map<String, dynamic>) subtitleBuilder;
  final ValueChanged<Map<String, dynamic>?> onChanged;

  @override
  Widget build(BuildContext context) {
    return Autocomplete<Map<String, dynamic>>(
      displayStringForOption: displayBuilder,
      optionsBuilder: (textEditingValue) {
        final query = textEditingValue.text.trim().toLowerCase();
        if (query.isEmpty) {
          return options.take(10);
        }
        return options.where(
          (row) => searchTextBuilder(row).contains(query),
        );
      },
      onSelected: (selection) => onChanged(selection),
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
        final selectedLabel =
            value == null ? '' : displayBuilder(value!).trim();
        if (selectedLabel.isNotEmpty && controller.text != selectedLabel) {
          controller.value = controller.value.copyWith(
            text: selectedLabel,
            selection: TextSelection.collapsed(offset: selectedLabel.length),
          );
        }

        return TextFormField(
          controller: controller,
          focusNode: focusNode,
          decoration: InputDecoration(
            labelText: label,
            hintText: hint,
            border: const OutlineInputBorder(),
            suffixIcon: value == null
                ? const Icon(Icons.search)
                : IconButton(
                    onPressed: () {
                      controller.clear();
                      onChanged(null);
                    },
                    icon: const Icon(Icons.clear),
                  ),
          ),
        );
      },
      optionsViewBuilder: (context, onSelected, optionValues) {
        final items = optionValues.toList();
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            borderRadius: BorderRadius.circular(10),
            child: ConstrainedBox(
              constraints: const BoxConstraints(
                maxWidth: 700,
                maxHeight: 260,
              ),
              child: ListView.separated(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: items.length,
                separatorBuilder: (_, __) =>
                    Divider(height: 1, color: Colors.grey.shade200),
                itemBuilder: (context, index) {
                  final item = items[index];
                  return InkWell(
                    onTap: () => onSelected(item),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            displayBuilder(item),
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            subtitleBuilder(item),
                            style: const TextStyle(
                              fontSize: 12,
                              color: Colors.black54,
                            ),
                          ),
                        ],
                      ),
                    ),
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

class _ChannelStandardDraftRowWidget extends StatelessWidget {
  const _ChannelStandardDraftRowWidget({
    required this.index,
    required this.row,
    required this.rawCandidates,
    required this.onRemove,
  });

  final int index;
  final _ChannelStandardDraftRow row;
  final List<Map<String, dynamic>> rawCandidates;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          SizedBox(
            width: 48,
            child: Text('${index + 1}',
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          Expanded(
            flex: 4,
            child: Autocomplete<Map<String, dynamic>>(
              optionsBuilder: (textEditingValue) {
                final q = textEditingValue.text.trim().toLowerCase();
                if (q.isEmpty) return rawCandidates.take(20);
                return rawCandidates.where((item) {
                  final sku = '${item['sku'] ?? ''}'.toLowerCase();
                  final name = '${item['item_name'] ?? ''}'.toLowerCase();
                  return sku.contains(q) || name.contains(q);
                }).take(20);
              },
              displayStringForOption: (option) =>
                  '${option['item_name'] ?? option['sku']}',
              fieldViewBuilder:
                  (context, controller, focusNode, onEditingComplete) {
                if (controller.text.isEmpty && row.selectedItem != null) {
                  controller.text =
                      '${row.selectedItem!['item_name'] ?? row.selectedItem!['sku']}';
                }
                return TextFormField(
                  controller: controller,
                  focusNode: focusNode,
                  decoration: const InputDecoration(
                    hintText: 'Search item by name or SKU',
                    prefixIcon: Icon(Icons.search),
                  ),
                );
              },
              optionsViewBuilder: (context, onSelected, options) {
                final list = options.toList();
                return Align(
                  alignment: Alignment.topLeft,
                  child: Material(
                    elevation: 4,
                    borderRadius: BorderRadius.circular(12),
                    child: ConstrainedBox(
                      constraints:
                          const BoxConstraints(maxWidth: 420, maxHeight: 260),
                      child: ListView.builder(
                        padding: EdgeInsets.zero,
                        shrinkWrap: true,
                        itemCount: list.length,
                        itemBuilder: (context, index) {
                          final option = list[index];
                          return ListTile(
                            title: Text('${option['item_name'] ?? 'Unnamed'}'),
                            subtitle: Text(
                                '${option['sku'] ?? ''} â€¢ ${option['unit'] ?? option['unit_of_measure'] ?? ''}'),
                            onTap: () => onSelected(option),
                          );
                        },
                      ),
                    ),
                  ),
                );
              },
              onSelected: row.applyItem,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            flex: 2,
            child: Text(
              '${row.selectedItem?['item_name'] ?? '-'}',
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              '${row.selectedItem?['sku'] ?? '-'}',
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextFormField(
              controller: row.unitController,
              decoration: const InputDecoration(hintText: 'Unit'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextFormField(
              controller: row.quantityController,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
              ],
              decoration: const InputDecoration(hintText: '0.00'),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 48,
            child: IconButton(
              onPressed: onRemove,
              icon: Icon(
                Icons.delete_outline,
                color: onRemove == null ? Colors.grey.shade400 : Colors.red,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AddChannelStandardDialog extends ConsumerStatefulWidget {
  const _AddChannelStandardDialog();

  @override
  ConsumerState<_AddChannelStandardDialog> createState() =>
      _AddChannelStandardDialogState();
}

class _AddChannelStandardDialogState
    extends ConsumerState<_AddChannelStandardDialog> {
  final _formKey = GlobalKey<FormState>();
  final _skuCtrl = TextEditingController();
  final _nameCtrl = TextEditingController();
  final _qtyCtrl = TextEditingController();
  final _unitCtrl = TextEditingController();
  final _packageCtrl = TextEditingController();
  String _channel = 'accommodation_breakfast';
  bool _saving = false;

  @override
  void dispose() {
    _skuCtrl.dispose();
    _nameCtrl.dispose();
    _qtyCtrl.dispose();
    _unitCtrl.dispose();
    _packageCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rawCandidates =
        ref.watch(rawStockCandidatesProvider).value ?? const [];
    return AlertDialog(
      title: const Text('New Channel Package Standard'),
      content: SizedBox(
        width: 520,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: _channel,
                  decoration: const InputDecoration(labelText: 'Channel'),
                  items: const [
                    DropdownMenuItem(
                        value: 'accommodation_breakfast',
                        child: Text('Accommodation Breakfast')),
                    DropdownMenuItem(
                        value: 'staff_meal', child: Text('Staff Meal')),
                    DropdownMenuItem(value: 'buffet', child: Text('Buffet')),
                    DropdownMenuItem(
                        value: 'conference_event', child: Text('Conference')),
                    DropdownMenuItem(
                        value: 'outside_catering',
                        child: Text('Outside Catering')),
                    DropdownMenuItem(
                        value: 'group_meal', child: Text('Group Meal')),
                  ],
                  onChanged: (value) =>
                      setState(() => _channel = value ?? _channel),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _packageCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Package Name',
                    helperText:
                        'Leave blank for default channel-wide standard. Use package names like Conference Lunch or Breakfast Standard.',
                  ),
                ),
                const SizedBox(height: 12),
                Autocomplete<Map<String, dynamic>>(
                  optionsBuilder: (textEditingValue) {
                    final q = textEditingValue.text.trim().toLowerCase();
                    if (q.isEmpty) return rawCandidates.take(20);
                    return rawCandidates.where((row) {
                      final sku = (row['sku'] ?? '').toString().toLowerCase();
                      final name =
                          (row['item_name'] ?? '').toString().toLowerCase();
                      return sku.contains(q) || name.contains(q);
                    }).take(20);
                  },
                  displayStringForOption: (option) =>
                      '${option['item_name'] ?? option['sku']}',
                  fieldViewBuilder:
                      (context, controller, focusNode, onEditingComplete) {
                    return TextFormField(
                      controller: controller,
                      focusNode: focusNode,
                      decoration:
                          const InputDecoration(labelText: 'Raw Item Search'),
                    );
                  },
                  onSelected: (option) {
                    _skuCtrl.text = '${option['sku'] ?? ''}';
                    _nameCtrl.text = '${option['item_name'] ?? ''}';
                    _unitCtrl.text =
                        '${option['unit'] ?? option['unit_of_measure'] ?? ''}';
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _skuCtrl,
                  decoration: const InputDecoration(labelText: 'Raw Item SKU'),
                  validator: (value) => (value == null || value.trim().isEmpty)
                      ? 'SKU required'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _nameCtrl,
                  decoration: const InputDecoration(labelText: 'Raw Item Name'),
                  validator: (value) => (value == null || value.trim().isEmpty)
                      ? 'Item name required'
                      : null,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _qtyCtrl,
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        decoration: const InputDecoration(
                            labelText: 'Quantity per Pax'),
                        validator: (value) =>
                            (double.tryParse(value ?? '') ?? 0) <= 0
                                ? 'Quantity required'
                                : null,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _unitCtrl,
                        decoration: const InputDecoration(labelText: 'Unit'),
                        validator: (value) =>
                            (value == null || value.trim().isEmpty)
                                ? 'Unit required'
                                : null,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _saving
              ? null
              : () async {
                  if (!_formKey.currentState!.validate()) return;
                  setState(() => _saving = true);
                  try {
                    await ref
                        .read(branchAccountantRepositoryProvider)
                        .createChannelFoodStandard({
                      'channel': _channel,
                      'package_name': _packageCtrl.text.trim(),
                      'raw_item_sku': _skuCtrl.text.trim(),
                      'raw_item_name': _nameCtrl.text.trim(),
                      'quantity_per_pax':
                          double.tryParse(_qtyCtrl.text.trim()) ?? 0,
                      'unit': _unitCtrl.text.trim(),
                    });
                    if (!mounted) return;
                    Navigator.pop(context);
                  } catch (e) {
                    if (!mounted) return;
                    AppNotifier.show(context, 'Failed to save: $e',
                        isError: true);
                  } finally {
                    if (mounted) setState(() => _saving = false);
                  }
                },
          child: const Text('Save'),
        ),
      ],
    );
  }
}

class AddStandardDialog extends ConsumerStatefulWidget {
  const AddStandardDialog({
    super.key,
    this.isPrepFlow = false,
    this.editData,
  });

  final bool isPrepFlow;
  /// When set, the dialog opens in edit mode pre-populated with this recipe group.
  final Map<String, dynamic>? editData;

  @override
  ConsumerState<AddStandardDialog> createState() => AddStandardDialogState();
}

class AddStandardDialogState extends ConsumerState<AddStandardDialog> {
  final ScrollController _dialogScrollController = ScrollController();
  YieldType _yieldType = YieldType.ratio;
  StocktakeControlMode _stocktakeControlMode =
      _defaultStocktakeControlForYield(YieldType.ratio);
  StocktakeLocation _stocktakeLocation = StocktakeLocation.kitchen;
  bool _showAdvancedSettings = false;
  final _recipeNameController = TextEditingController();
  bool _isPrepFlow = false;

  // Raw Inputs
  final List<_RawInputRow> _rawInputs = [];

  // Single Output (For Ratio/Direct)
  Map<String, dynamic>? _selectedPosItemSingle;
  final _singleOutputQtyController = TextEditingController(text: '1.0');

  // Sub-Assembly Output
  final _subAssemblyOutputNameController = TextEditingController();
  final _subAssemblyOutputQtyController = TextEditingController(text: '1.0');

  // Multi Output (For Complex)
  final List<_ComplexOutputRow> _complexOutputs = [];

  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    if (widget.editData != null) {
      _populateFromEditData(widget.editData!);
    } else {
      _isPrepFlow = widget.isPrepFlow;
      if (_isPrepFlow) {
        _showAdvancedSettings = true;
        _yieldType = YieldType.subAssembly;
        _stocktakeControlMode =
            _defaultStocktakeControlForYield(YieldType.subAssembly);
      }
      _rawInputs.add(_RawInputRow());
      _complexOutputs.add(_ComplexOutputRow());
    }
  }

  void _populateFromEditData(Map<String, dynamic> data) {
    // Yield type
    final yieldCode = (data['yield_type_code'] ?? '').toString().toUpperCase();
    _yieldType = switch (yieldCode) {
      'COMPLEX' => YieldType.complex,
      'SUB_ASSEMBLY' => YieldType.subAssembly,
      'DIRECT' => YieldType.direct,
      _ => YieldType.ratio,
    };

    // Recipe name
    _recipeNameController.text = (data['recipe_name'] ?? '').toString();

    // Stocktake settings
    final controlMode =
        (data['stocktake_control_mode'] ?? 'BOTH').toString().toUpperCase();
    _stocktakeControlMode = switch (controlMode) {
      'RAW_ONLY' => StocktakeControlMode.rawOnly,
      'PRODUCED_ONLY' => StocktakeControlMode.producedOnly,
      'NONE' => StocktakeControlMode.none,
      _ => StocktakeControlMode.both,
    };
    final location =
        (data['stocktake_location'] ?? 'KITCHEN').toString().toUpperCase();
    _stocktakeLocation = switch (location) {
      'STORE' => StocktakeLocation.store,
      'BOTH' => StocktakeLocation.both,
      'NONE' => StocktakeLocation.none,
      _ => StocktakeLocation.kitchen,
    };

    // Prep flow / advanced settings
    if ((data['prep_stage_code'] ?? '').toString().trim().isNotEmpty) {
      _isPrepFlow = true;
      _showAdvancedSettings = true;
    }

    // Raw inputs
    final inputsList = (data['inputs'] as List?) ?? [];
    if (inputsList.isNotEmpty) {
      for (final input in inputsList) {
        final row = _RawInputRow();
        row.rawItem = {
          'sku': input['raw_item_sku'],
          'id': input['raw_item_sku'],
          'item_name': input['raw_item_name'],
          'name': input['raw_item_name'],
        };
        final unit = (input['unit'] ?? '').toString().trim();
        row.selectedUnit = unit.isNotEmpty ? unit : null;
        row.qtyController.text =
            (input['quantity'] ?? 1.0).toString();
        _rawInputs.add(row);
      }
    } else {
      // Legacy single-input fields
      final rawSku = (data['raw_item_sku'] ?? '').toString().trim();
      if (rawSku.isNotEmpty && rawSku != 'MULTI') {
        final row = _RawInputRow();
        row.rawItem = {
          'sku': rawSku,
          'id': rawSku,
          'item_name': data['raw_item_name'] ?? rawSku,
          'name': data['raw_item_name'] ?? rawSku,
        };
        final unit = (data['raw_unit'] ?? '').toString().trim();
        row.selectedUnit = unit.isNotEmpty ? unit : null;
        row.qtyController.text =
            (data['raw_quantity'] ?? 1.0).toString();
        _rawInputs.add(row);
      } else {
        _rawInputs.add(_RawInputRow());
      }
    }

    // Outputs
    final outputsList = (data['outputs'] as List?) ?? [];
    if (_yieldType == YieldType.complex) {
      for (final out in outputsList) {
        final row = _ComplexOutputRow();
        row.posItem = {
          'id': out['pos_outlet_item_id'],
          'name': out['produced_item_name'],
        };
        row.qtyController.text =
            (out['produced_quantity'] ?? 1.0).toString();
        _complexOutputs.add(row);
      }
      if (_complexOutputs.isEmpty) _complexOutputs.add(_ComplexOutputRow());
    } else if (_yieldType == YieldType.subAssembly) {
      if (outputsList.isNotEmpty) {
        _subAssemblyOutputNameController.text =
            (outputsList.first['produced_item_name'] ?? '').toString();
        _subAssemblyOutputQtyController.text =
            (outputsList.first['produced_quantity'] ?? 1.0).toString();
      }
      _complexOutputs.add(_ComplexOutputRow());
    } else {
      // PRODUCTION or DIRECT — single output
      if (outputsList.isNotEmpty) {
        _selectedPosItemSingle = {
          'id': outputsList.first['pos_outlet_item_id'],
          'name': outputsList.first['produced_item_name'],
        };
        _singleOutputQtyController.text =
            (outputsList.first['produced_quantity'] ?? 1.0).toString();
      }
      _complexOutputs.add(_ComplexOutputRow());
    }
  }

  @override
  void dispose() {
    _dialogScrollController.dispose();
    for (final r in _rawInputs) {
      r.dispose();
    }
    for (final r in _complexOutputs) {
      r.dispose();
    }
    _singleOutputQtyController.dispose();
    _subAssemblyOutputNameController.dispose();
    _subAssemblyOutputQtyController.dispose();
    _recipeNameController.dispose();
    super.dispose();
  }

  String _defaultRecipeName() {
    final rawNames = _rawInputs
        .where((row) => row.rawItem != null)
        .map((row) => (row.rawItem!['item_name'] ?? row.rawItem!['name'] ?? '')
            .toString()
            .trim())
        .where((name) => name.isNotEmpty)
        .toList();
    final rawLabel = rawNames.isEmpty ? 'Input stock' : rawNames.join(' + ');

    String outputLabel = 'Produced item';
    if (_yieldType == YieldType.subAssembly) {
      final value = _subAssemblyOutputNameController.text.trim();
      if (value.isNotEmpty) outputLabel = value;
    } else if (_yieldType == YieldType.complex) {
      final values = _complexOutputs
          .where((row) => row.posItem != null)
          .map((row) => (row.posItem!['name'] ?? '').toString().trim())
          .where((name) => name.isNotEmpty)
          .toList();
      if (values.isNotEmpty) outputLabel = values.join(', ');
    } else {
      final value = (_selectedPosItemSingle?['name'] ?? '').toString().trim();
      if (value.isNotEmpty) outputLabel = value;
    }

    return '$rawLabel -> $outputLabel';
  }

  @override
  Widget build(BuildContext context) {
    final linkableItems = ref.watch(linkableMenuItemsProvider);
    final ingredientCandidates = ref.watch(ingredientInputCandidatesProvider);
    final availableUnits = ref.watch(inventoryUnitsProvider);
    final screenSize = MediaQuery.of(context).size;

    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Container(
        width: screenSize.width * 0.7,
        constraints: BoxConstraints(
          maxWidth: 1320,
          maxHeight: screenSize.height * 0.9,
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
                widget.editData != null
                    ? 'Edit Food Control Standard'
                    : 'New Food Control Standard',
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const Divider(height: 32),
            Expanded(
              child: Scrollbar(
                controller: _dialogScrollController,
                thumbVisibility: true,
                child: SingleChildScrollView(
                  controller: _dialogScrollController,
                  padding: const EdgeInsets.only(right: 8),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [

            Text(
              _yieldType == YieldType.subAssembly
                  ? 'Set the intermediate ingredient rule: raw stock in, kitchen sub-assembly item out.'
                  : 'Set the final recipe rule: raw stock and sub-assembly ingredients in, POS outlet item out.',
              style: TextStyle(color: Colors.grey.shade700),
            ),
            const SizedBox(height: 20),

            // Yield Type Toggle
            Row(
              children: [
                const Text('Yield Type: ',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(width: 16),
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: SegmentedButton<YieldType>(
                      segments: const [
                        ButtonSegment(
                            value: YieldType.ratio,
                            label: Text('Production (Batch)')),
                        ButtonSegment(
                            value: YieldType.complex,
                            label: Text('Complex (1:Many)')),
                        ButtonSegment(
                            value: YieldType.subAssembly,
                            label: Text('Sub-Assembly')),
                      ],
                      selected: {_yieldType},
                      onSelectionChanged: (set) => setState(() {
                        _yieldType = set.first;
                        _stocktakeControlMode =
                            _defaultStocktakeControlForYield(_yieldType);
                      }),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _recipeNameController,
              decoration: InputDecoration(
                labelText: 'Flow / Standard Name',
                hintText: 'Example: Potatoes -> Peeled Potatoes',
                border: const OutlineInputBorder(),
                suffixIcon: IconButton(
                  tooltip: 'Auto-fill from selected input and output',
                  onPressed: () {
                    setState(() {
                      _recipeNameController.text = _defaultRecipeName();
                    });
                  },
                  icon: const Icon(Icons.auto_fix_high),
                ),
              ),
            ),
            const SizedBox(height: 16),
            const SizedBox(height: 24),

            // For Direct (1:1): show only the POS outlet selector â€” no raw materials
            if (_yieldType == YieldType.direct) ...[
              // Direct Transfer â€” POS Outlet Item Selector
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  border: Border.all(color: Colors.blue.shade100),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: linkableItems.when(
                  data: (items) => _buildDirectOutputSection(items),
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Text('Error loading POS items: $e'),
                ),
              ),
            ] else ...[
              // Raw Stock Selection (hidden for Direct)
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  border: Border.all(color: Colors.grey.shade300),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                            _yieldType == YieldType.subAssembly
                                ? 'Ingredient Inputs'
                                : 'Ingredients Used (Raw Stock / Sub-Assembly)',
                            style: TextStyle(fontWeight: FontWeight.w600)),
                        TextButton.icon(
                          icon: const Icon(Icons.add, size: 18),
                          label: const Text('Add Input'),
                          onPressed: () {
                            setState(() => _rawInputs.add(_RawInputRow()));
                          },
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ..._rawInputs.asMap().entries.map((entry) {
                      final index = entry.key;
                      final r = entry.value;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 2,
                              child: ingredientCandidates.when(
                                data: (items) =>
                                    Autocomplete<Map<String, dynamic>>(
                                  displayStringForOption: (option) {
                                    final name = option['item_name'] ??
                                        option['name'] ??
                                        'Unknown';
                                    final type = (option['source_type'] ?? '')
                                        .toString()
                                        .trim()
                                        .toUpperCase();
                                    return type == 'SUB_ASSEMBLY'
                                        ? '$name (Sub-Assembly)'
                                        : '$name';
                                  },
                                  optionsBuilder: (textEditingValue) {
                                    if (textEditingValue.text.isEmpty) {
                                      return const Iterable<
                                          Map<String, dynamic>>.empty();
                                    }
                                    return items.where((i) {
                                      final name =
                                          (i['item_name'] ?? i['name'] ?? '')
                                              .toString()
                                              .toLowerCase();
                                      final sku =
                                          (i['sku'] ?? '').toString().toLowerCase();
                                      final query =
                                          textEditingValue.text.toLowerCase();
                                      return name.contains(query) ||
                                          sku.contains(query);
                                    });
                                  },
                                  onSelected: (val) => setState(() {
                                    r.rawItem = val;
                                    // Auto-select unit from the chosen item
                                    final itemUnit = (val['unit'] ??
                                            val['unit_of_measure'] ??
                                            '')
                                        .toString()
                                        .trim();
                                    r.selectedUnit =
                                        itemUnit.isNotEmpty ? itemUnit : null;
                                  }),
                                  fieldViewBuilder: (context, controller,
                                      focusNode, onFieldSubmitted) {
                                    if (r.rawItem != null &&
                                        controller.text.isEmpty) {
                                      controller.text =
                                          r.rawItem!['item_name'] ??
                                              r.rawItem!['name'] ??
                                              '';
                                    }
                                    return TextFormField(
                                      controller: controller,
                                      focusNode: focusNode,
                                      decoration: InputDecoration(
                                        labelText:
                                            'Search input item by name or SKU',
                                        border: const OutlineInputBorder(),
                                        suffixIcon: r.rawItem != null
                                            ? IconButton(
                                                icon: const Icon(Icons.clear,
                                                    size: 18),
                                                onPressed: () {
                                                  controller.clear();
                                                  r.selectedUnit = null;
                                                  setState(
                                                      () => r.rawItem = null);
                                                },
                                              )
                                            : null,
                                      ),
                                    );
                                  },
                                ),
                                loading: () => const LinearProgressIndicator(),
                                error: (e, _) =>
                                    Text('Error loading ingredient inputs: $e'),
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: TextFormField(
                                controller: r.qtyController,
                                decoration: const InputDecoration(
                                    labelText: 'Quantity',
                                    border: OutlineInputBorder()),
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                        decimal: true),
                                inputFormatters: [
                                  FilteringTextInputFormatter.allow(
                                      RegExp(r'^\d*\.?\d*')),
                                ],
                              ),
                            ),
                            const SizedBox(width: 16),
                            // Unit dropdown â€” auto-populated from inventory, overridable
                            Expanded(
                              child: availableUnits.when(
                                data: (units) {
                                  // Ensure the selected unit is in the list (in case of custom)
                                  final allUnits = {
                                    ...units,
                                    if (r.selectedUnit != null) r.selectedUnit!,
                                  }.toList()
                                    ..sort();
                                  return DropdownButtonFormField<String>(
                                    isExpanded: true,
                                    // ignore: deprecated_member_use
                                    value: r.selectedUnit,
                                    decoration: InputDecoration(
                                      labelText: 'Unit',
                                      border: const OutlineInputBorder(),
                                      filled: r.selectedUnit != null,
                                      fillColor: r.selectedUnit != null
                                          ? Colors.teal.shade50
                                          : null,
                                    ),
                                    hint: const Text('Select unit'),
                                    items: allUnits
                                        .map((u) => DropdownMenuItem(
                                              value: u,
                                              child: Text(u,
                                                  style: const TextStyle(
                                                      fontWeight:
                                                          FontWeight.w600)),
                                            ))
                                        .toList(),
                                    onChanged: (v) =>
                                        setState(() => r.selectedUnit = v),
                                  );
                                },
                                loading: () => const SizedBox(
                                  height: 56,
                                  child:
                                      Center(child: LinearProgressIndicator()),
                                ),
                                error: (_, __) => TextFormField(
                                  decoration: const InputDecoration(
                                      labelText: 'Unit',
                                      border: OutlineInputBorder()),
                                  onChanged: (v) =>
                                      setState(() => r.selectedUnit = v),
                                ),
                              ),
                            ),
                            if (_rawInputs.length > 1)
                              IconButton(
                                icon:
                                    const Icon(Icons.delete, color: Colors.red),
                                onPressed: () {
                                  setState(() => _rawInputs.removeAt(index));
                                },
                              ),
                          ],
                        ),
                      );
                    }),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.blue.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.blue.shade100),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.info_outline,
                              size: 16, color: Colors.blue.shade700),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _yieldType == YieldType.subAssembly
                                  ? 'Use raw stock here to define the intermediate kitchen item produced by this standard.'
                                  : 'Use both raw stock and previously created sub-assembly items here when the final POS outlet item depends on both.',
                              style: TextStyle(
                                  fontSize: 12, color: Colors.blue.shade800),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 16),
              const Icon(Icons.arrow_downward, color: Colors.grey),
              const SizedBox(height: 16),

              // POS Output Linkage
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  border: Border.all(color: Colors.blue.shade100),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: linkableItems.when(
                  data: (items) => _buildOutputSection(items),
                  loading: () =>
                      const Center(child: CircularProgressIndicator()),
                  error: (e, _) => Text('Error loading POS items: $e'),
                ),
              ),
            ],

            const SizedBox(height: 24),
            Card(
              elevation: 0,
              color: Colors.grey.shade50,
              clipBehavior: Clip.antiAlias,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: ExpansionTile(
                key: ValueKey<bool>(_showAdvancedSettings),
                initiallyExpanded: _showAdvancedSettings,
                tilePadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                title: const Text(
                  'Advanced Settings',
                  style: TextStyle(fontWeight: FontWeight.w600),
                ),
                subtitle: const Text(
                  'Prep flow stages and stocktake loading rules.',
                ),
                onExpansionChanged: (expanded) {
                  setState(() => _showAdvancedSettings = expanded);
                },
                children: [
                  SwitchListTile.adaptive(
                    contentPadding: EdgeInsets.zero,
                    value: _isPrepFlow,
                    title: const Text('Use Prep Return Flow'),
                    subtitle: const Text(
                      'Enable when raw stock is sent for preparation, received back as usable prepared stock, then issued to the kitchen.',
                    ),
                    onChanged: (value) => setState(() => _isPrepFlow = value),
                  ),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.amber.shade50,
                      border: Border.all(color: Colors.amber.shade200),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: DropdownButtonFormField<
                                  StocktakeControlMode>(
                                initialValue: _stocktakeControlMode,
                                decoration: const InputDecoration(
                                  labelText: 'Kitchen Stocktake Count Rule',
                                  border: OutlineInputBorder(),
                                ),
                                items: const [
                                  DropdownMenuItem(
                                    value: StocktakeControlMode.rawOnly,
                                    child: Text('Raw inputs only'),
                                  ),
                                  DropdownMenuItem(
                                    value: StocktakeControlMode.producedOnly,
                                    child: Text('Produced item only'),
                                  ),
                                  DropdownMenuItem(
                                    value: StocktakeControlMode.both,
                                    child: Text('Both raw and produced'),
                                  ),
                                  DropdownMenuItem(
                                    value: StocktakeControlMode.none,
                                    child: Text('Do not include in stocktake'),
                                  ),
                                ],
                                onChanged: (value) {
                                  if (value == null) return;
                                  setState(() => _stocktakeControlMode = value);
                                },
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: DropdownButtonFormField<StocktakeLocation>(
                                initialValue: _stocktakeLocation,
                                decoration: const InputDecoration(
                                  labelText: 'Where It Should Be Counted',
                                  border: OutlineInputBorder(),
                                ),
                                items: const [
                                  DropdownMenuItem(
                                    value: StocktakeLocation.kitchen,
                                    child: Text('Kitchen only'),
                                  ),
                                  DropdownMenuItem(
                                    value: StocktakeLocation.store,
                                    child: Text('Store only'),
                                  ),
                                  DropdownMenuItem(
                                    value: StocktakeLocation.both,
                                    child: Text('Kitchen and store'),
                                  ),
                                  DropdownMenuItem(
                                    value: StocktakeLocation.none,
                                    child: Text('Do not load anywhere'),
                                  ),
                                ],
                                onChanged: (value) {
                                  if (value == null) return;
                                  setState(() => _stocktakeLocation = value);
                                },
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'This controls whether Kitchen Stocktake counts the raw side, the produced side, both, or neither for this standard.',
                          style: TextStyle(
                              fontSize: 12, color: Colors.grey.shade700),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel')),
                const SizedBox(width: 16),
                FilledButton.icon(
                  onPressed: _isSaving ? null : _saveStandard,
                  icon: _isSaving
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2))
                      : const Icon(Icons.save),
                  label: Text(widget.editData != null
                      ? 'Update Standard'
                      : 'Save Standard'),
                ),
              ],
            )
          ],
        ),
      ),
    );
  }

  Widget _buildAutocomplete(
    List<Map<String, dynamic>> posItems,
    String label,
    Map<String, dynamic>? value,
    ValueChanged<Map<String, dynamic>?> onChanged, {
    List<String> excludeIds = const [],
  }) {
    return Autocomplete<Map<String, dynamic>>(
      displayStringForOption: (option) => option['name'] ?? 'Unknown',
      optionsBuilder: (textEditingValue) {
        if (textEditingValue.text.isEmpty) {
          return const Iterable<Map<String, dynamic>>.empty();
        }
        return posItems.where((i) {
          if (excludeIds.contains(i['id']?.toString())) return false;
          final name = (i['name'] ?? '').toString().toLowerCase();
          return name.contains(textEditingValue.text.toLowerCase());
        });
      },
      onSelected: onChanged,
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
        if (value != null && controller.text.isEmpty) {
          controller.text = value['name'] ?? '';
        }
        return TextFormField(
          controller: controller,
          focusNode: focusNode,
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(),
            isDense: true,
            suffixIcon: value != null
                ? IconButton(
                    icon: const Icon(Icons.clear, size: 18),
                    onPressed: () {
                      controller.clear();
                      onChanged(null);
                    },
                  )
                : null,
          ),
        );
      },
    );
  }

  // _buildComplexRow was removed (unused).

  /// Shown ONLY for Direct (1:1) â€” just a POS outlet picker, no raw materials.
  Widget _buildDirectOutputSection(List<Map<String, dynamic>> posItems) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.blue.shade100,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(Icons.swap_horiz_rounded,
                    color: Colors.blue.shade700, size: 20),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Direct Transfer to POS Outlet',
                        style: TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 14)),
                    SizedBox(height: 2),
                    Text(
                      'Stock is issued directly to the POS outlet as-is (no cooking/processing).',
                      style: TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(),
          const SizedBox(height: 12),
          const Text('Select POS Outlet Item',
              style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          _buildAutocomplete(
            posItems,
            'Search POS Item',
            _selectedPosItemSingle,
            (v) => setState(() => _selectedPosItemSingle = v),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.blue.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.blue.shade200),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.info_outline, size: 16, color: Colors.blue.shade700),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Quantity issued = quantity logged during production. No transformation ratio applied.',
                    style: TextStyle(fontSize: 12, color: Colors.blue.shade800),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOutputSection(List<Map<String, dynamic>> posItems) {
    if (_yieldType == YieldType.complex) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Linked POS Items & Yield Quantities',
                  style: TextStyle(fontWeight: FontWeight.w600)),
              TextButton.icon(
                onPressed: () =>
                    setState(() => _complexOutputs.add(_ComplexOutputRow())),
                icon: const Icon(Icons.add),
                label: const Text('Add Output'),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Column(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(_complexOutputs.length, (index) {
              final row = _complexOutputs[index];

              final List<String> otherSelectedIds = _complexOutputs
                  .where((r) => r != row && r.posItem != null)
                  .map((r) => r.posItem!['id']?.toString() ?? '')
                  .where((id) => id.isNotEmpty)
                  .toList();

              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: _buildAutocomplete(
                        posItems,
                        'Search POS Item',
                        row.posItem,
                        (v) => setState(() => row.posItem = v),
                        excludeIds: otherSelectedIds,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextFormField(
                        controller: row.qtyController,
                        decoration: const InputDecoration(
                            labelText: 'Yield Qty',
                            border: OutlineInputBorder(),
                            isDense: true),
                        keyboardType: const TextInputType.numberWithOptions(
                            decimal: true),
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(
                              RegExp(r'^\d*\.?\d*')),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close, color: Colors.red),
                      onPressed: () {
                        if (_complexOutputs.length > 1) {
                          setState(() => _complexOutputs.removeAt(index));
                        }
                      },
                    )
                  ],
                ),
              );
            }),
          )
        ],
      );
    } else if (_yieldType == YieldType.subAssembly) {
      return SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Intermediate Produced Item (Sub-Assembly)',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 2,
                  child: TextFormField(
                    controller: _subAssemblyOutputNameController,
                    decoration: const InputDecoration(
                      labelText: 'Produced Item Name (e.g. Burger Buns)',
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: TextFormField(
                    controller: _subAssemblyOutputQtyController,
                    decoration: const InputDecoration(
                      labelText: 'Yield Qty',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType:
                        const TextInputType.numberWithOptions(decimal: true),
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                    ],
                  ),
                ),
              ],
            ),
            const Padding(
              padding: EdgeInsets.only(top: 8.0),
              child: Text(
                  'This item will be automatically created in the kitchen ledger for use as an ingredient later.',
                  style: TextStyle(color: Colors.grey, fontSize: 12)),
            )
          ],
        ),
      );
    } else {
      // Single output (Direct or Ratio)
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Linked POS Outlet Item (Final Output)',
              style: TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                flex: 2,
                child: _buildAutocomplete(
                    posItems,
                    'Search POS Item',
                    _selectedPosItemSingle,
                    (v) => setState(() => _selectedPosItemSingle = v)),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: TextFormField(
                  controller: _singleOutputQtyController,
                  enabled: _yieldType == YieldType.ratio,
                  decoration: InputDecoration(
                    labelText: _yieldType == YieldType.direct
                        ? 'Yield Qty (Fixed to 1)'
                        : 'Yield Qty',
                    border: const OutlineInputBorder(),
                  ),
                  keyboardType:
                      const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d*')),
                  ],
                ),
              ),
            ],
          ),
          if (_yieldType == YieldType.direct)
            const Padding(
              padding: EdgeInsets.only(top: 8.0),
              child: Text(
                  'Direct yield outputs are fixed to 1-to-1 ratio based on raw quantity input.',
                  style: TextStyle(color: Colors.grey, fontSize: 12)),
            )
        ],
      );
    }
  }

  Future<void> _saveStandard() async {
    final inputs = <Map<String, dynamic>>[];
    // Direct (1:1) has NO raw material inputs â€” the POS item is the stock itself
    if (_yieldType != YieldType.direct) {
      for (final r in _rawInputs) {
        if (r.rawItem == null) {
          AppNotifier.show(
              context, 'Please select a raw stock item for all inputs.',
              isError: true);
          return;
        }
        if (r.selectedUnit == null || r.selectedUnit!.isEmpty) {
          final itemName =
              r.rawItem!['item_name'] ?? r.rawItem!['name'] ?? 'item';
          AppNotifier.show(context, 'Please select a unit for "$itemName".',
              isError: true);
          return;
        }
        final qty = double.tryParse(r.qtyController.text) ?? 0;
        if (qty <= 0) {
          AppNotifier.show(
              context, 'Raw quantity must be greater than 0 for all inputs.',
              isError: true);
          return;
        }
        inputs.add({
          'raw_item_sku': r.rawItem!['sku'] ??
              r.rawItem!['item_id'] ??
              'UNK',
          'raw_item_name':
              r.rawItem!['item_name'] ?? r.rawItem!['name'] ?? 'Unknown',
          'quantity': qty,
          'unit': r.selectedUnit!, // from dropdown â€” user-confirmed unit
        });
      }
    }

    List<Map<String, dynamic>> outputs = [];

    if (_yieldType == YieldType.complex) {
      for (final r in _complexOutputs) {
        if (r.posItem == null) {
          AppNotifier.show(
              context, 'All complex outputs must have a POS item selected.',
              isError: true);
          return;
        }

        final qty = double.tryParse(r.qtyController.text) ?? 1.0;
        if (qty <= 0) {
          AppNotifier.show(context,
              'Output quantity must be greater than 0 for all outputs.',
              isError: true);
          return;
        }

        outputs.add({
          'produced_item_name': r.posItem!['name'],
          'produced_quantity': qty,
          'produced_unit': 'pcs',
          'pos_outlet_item_id': r.posItem!['id'],
        });
      }
    } else if (_yieldType == YieldType.subAssembly) {
      final name = _subAssemblyOutputNameController.text.trim();
      final outQty = double.tryParse(_subAssemblyOutputQtyController.text) ?? 0;
      if (name.isEmpty) {
        AppNotifier.show(context, 'Please enter a name for the sub-assembly.',
            isError: true);
        return;
      }
      if (outQty <= 0) {
        AppNotifier.show(context, 'Output quantity must be greater than 0.',
            isError: true);
        return;
      }
      outputs.add({
        'produced_item_name': name,
        'produced_quantity': outQty,
        'produced_unit': 'pcs',
        'pos_outlet_item_id': null,
      });
    } else {
      if (_selectedPosItemSingle == null) {
        AppNotifier.show(context, 'Please select a POS item.', isError: true);
        return;
      }
      // For Direct: qty is 1.0 (pure 1:1 transfer, quantity set during production logging)
      final outQty = _yieldType == YieldType.direct
          ? 1.0
          : (double.tryParse(_singleOutputQtyController.text) ?? 0);

      if (outQty <= 0) {
        AppNotifier.show(context, 'Output quantity must be greater than 0.',
            isError: true);
        return;
      }
      outputs.add({
        'produced_item_name': _selectedPosItemSingle!['name'],
        'produced_quantity': outQty,
        'produced_unit': 'pcs',
        'pos_outlet_item_id': _selectedPosItemSingle!['id'],
      });
    }

    setState(() => _isSaving = true);

    try {
      String yieldTypeCode;
      switch (_yieldType) {
        case YieldType.complex:
          yieldTypeCode = 'COMPLEX';
          break;
        case YieldType.ratio:
          yieldTypeCode = 'PRODUCTION';
          break;
        case YieldType.direct:
          yieldTypeCode = 'DIRECT';
          break;
        case YieldType.subAssembly:
          yieldTypeCode = 'SUB_ASSEMBLY';
          break;
      }

      final repo = ref.read(branchAccountantRepositoryProvider);

      if (widget.editData != null) {
        // ── EDIT MODE ────────────────────────────────────────────────────────
        final existingIds =
            List<String>.from(widget.editData!['all_recipe_ids'] as List);

        // Build pos_outlet_item_id → recipe_id map from original data so
        // edits match by output identity rather than fragile positional index.
        final existingOutputs = ((widget.editData!['outputs'] as List?) ?? [])
            .map((o) => Map<String, dynamic>.from(o as Map))
            .toList();
        final idByPosItem = <String, String>{};
        for (int i = 0; i < existingOutputs.length && i < existingIds.length; i++) {
          final posId = existingOutputs[i]['pos_outlet_item_id']?.toString();
          if (posId != null && posId.isNotEmpty) {
            idByPosItem[posId] = existingIds[i];
          }
        }

        final basePayload = {
          if (_recipeNameController.text.trim().isNotEmpty)
            'recipe_name': _recipeNameController.text.trim(),
          'yield_type_code': yieldTypeCode,
          'stocktake_control_mode': _stocktakeControlCode(_stocktakeControlMode),
          'stocktake_location': _stocktakeLocationCode(_stocktakeLocation),
          'prep_stage_code': _isPrepFlow ? 'PREP_FLOW' : null,
          'inputs': inputs,
        };

        final usedRecipeIds = <String>{};
        for (final output in outputs) {
          final outputFields = {
            'produced_item_name': output['produced_item_name'],
            'produced_quantity': output['produced_quantity'],
            'produced_unit': output['produced_unit'],
            'pos_outlet_item_id': output['pos_outlet_item_id'],
          };
          final posId = output['pos_outlet_item_id']?.toString();
          final existingRecipeId =
              (posId != null && posId.isNotEmpty) ? idByPosItem[posId] : null;
          if (existingRecipeId != null) {
            await repo.updateKitchenRecipe(
                existingRecipeId, {...basePayload, ...outputFields});
            usedRecipeIds.add(existingRecipeId);
          } else {
            await repo.saveKitchenRecipe({
              ...basePayload,
              'outputs': [output],
            });
          }
        }
        // Deactivate recipe rows whose output was removed
        for (final id in existingIds) {
          if (!usedRecipeIds.contains(id)) {
            await repo.deactivateKitchenRecipe(id);
          }
        }
      } else {
        // ── CREATE MODE ──────────────────────────────────────────────────────
        final payload = {
          if (_recipeNameController.text.trim().isNotEmpty)
            'recipe_name': _recipeNameController.text.trim(),
          'yield_type_code': yieldTypeCode,
          'stocktake_control_mode': _stocktakeControlCode(_stocktakeControlMode),
          'stocktake_location': _stocktakeLocationCode(_stocktakeLocation),
          'prep_stage_code': _isPrepFlow ? 'PREP_FLOW' : null,
          'inputs': inputs,
          'outputs': outputs,
        };
        await repo.saveKitchenRecipe(payload);
      }

      if (mounted) {
        AppNotifier.show(context,
            widget.editData != null
                ? 'Standard updated — changes apply from now onwards.'
                : 'Food Control Standard saved successfully.');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Failed to save standard: $e', isError: true);
      }
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }
}

class _RawInputRow {
  Map<String, dynamic>? rawItem;
  String? selectedUnit;
  final TextEditingController qtyController =
      TextEditingController(text: '1.0');

  void dispose() {
    qtyController.dispose();
  }
}

class _ComplexOutputRow {
  Map<String, dynamic>? posItem;
  final TextEditingController qtyController =
      TextEditingController(text: '1.0');

  void dispose() {
    qtyController.dispose();
  }
}
