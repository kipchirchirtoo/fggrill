import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../services/report_service.dart';
import '../../domain/admin_providers.dart';
import '../../data/models/branch.dart';
import '../../data/models/inventory_item.dart';
import '../widgets/stat_card.dart';
import '../widgets/admin_table.dart';
import 'package:famous_gates_app/features/admin/data/admin_repository.dart';

final _inventoryFilteredProvider =
    FutureProvider.autoDispose<List<InventoryItem>>((ref) async {
  final repo = ref.read(adminRepositoryProvider);
  final branchId = ref.watch(adminSelectedBranchProvider);
  return repo.getInventory(branchId: branchId);
});

final _inventoryCategories = [
  'All',
  'Produce',
  'Dairy',
  'Meat',
  'Dry Goods',
  'Beverages',
  'Cleaning',
  'Other'
];

class InventorySection extends ConsumerStatefulWidget {
  const InventorySection({super.key});

  @override
  ConsumerState<InventorySection> createState() => _InventorySectionState();
}

class _InventorySectionState extends ConsumerState<InventorySection> {
  final _searchCtrl = TextEditingController();
  String _search = '';
  String _category = 'All';
  String _statusFilter = 'All';

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final branchesAsync = ref.watch(adminBranchesProvider);
    final itemsAsync = ref.watch(_inventoryFilteredProvider);

    return Column(
      children: [
        branchesAsync.when(
          data: (branches) => _BranchSelector(branches: branches),
          loading: () => const SizedBox(height: 48),
          error: (_, __) => const SizedBox(height: 48),
        ),
        Expanded(
          child: itemsAsync.when(
            loading: () => const LoadingSkeleton(type: SkeletonType.table),
            error: (e, _) => ErrorState(
              message: '$e',
              onRetry: () => ref.invalidate(_inventoryFilteredProvider),
            ),
            data: (items) => _buildContent(items),
          ),
        ),
      ],
    );
  }

  Widget _buildContent(List<InventoryItem> items) {
    final filtered = items.where((i) {
      if (_search.isNotEmpty &&
          !i.name.toLowerCase().contains(_search.toLowerCase())) {
        return false;
      }
      if (_category != 'All' && i.category != _category.toLowerCase()) {
        return false;
      }
      if (_statusFilter != 'All') {
        if (_statusFilter == 'OK' &&
            i.status != 'ok' &&
            i.status != 'in_stock' &&
            i.quantity > i.reorderLevel * 1.5) {
          return false;
        }
        if (_statusFilter == 'Low' &&
            i.status != 'low' &&
            !(i.quantity <= i.reorderLevel * 1.5 &&
                i.quantity > i.reorderLevel)) {
          return false;
        }
        if (_statusFilter == 'Critical' &&
            i.status != 'critical' &&
            !(i.quantity <= i.reorderLevel && i.quantity > 0)) {
          return false;
        }
        if (_statusFilter == 'Out' && i.status != 'out' && i.quantity > 0) {
          return false;
        }
      }
      return true;
    }).toList();

    final totalItems = items.length;
    final lowStock = items.where((i) => i.quantity <= i.reorderLevel).length;
    final totalValue = items.fold(0.0, (sum, i) => sum + i.totalValue);
    final pendingRequests =
        items.where((i) => i.quantity <= i.reorderLevel * 0.5).length;

    return Stack(
      children: [
        SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                      child: AdminStatCard(
                          label: 'Total Items',
                          value: '$totalItems',
                          icon: PhosphorIcons.package(),
                          color: AppColors.kPrimary)),
                  const SizedBox(width: 16),
                  Expanded(
                      child: AdminStatCard(
                          label: 'Low Stock',
                          value: '$lowStock',
                          icon: PhosphorIcons.warningCircle(),
                          color: AppColors.kWarning)),
                  const SizedBox(width: 16),
                  Expanded(
                      child: AdminStatCard(
                          label: 'Total Value',
                          value: 'KES ${totalValue.toStringAsFixed(0)}',
                          icon: PhosphorIcons.coins(),
                          color: AppColors.kAccent)),
                  const SizedBox(width: 16),
                  Expanded(
                      child: AdminStatCard(
                          label: 'Pending Requests',
                          value: '$pendingRequests',
                          icon: PhosphorIcons.creditCard(),
                          color: AppColors.kError)),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  SizedBox(
                    width: 250,
                    child: TextField(
                      controller: _searchCtrl,
                      decoration: InputDecoration(
                        hintText: 'Search items...',
                        prefixIcon:
                            Icon(PhosphorIcons.magnifyingGlass(), size: 18),
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 10),
                      ),
                      onChanged: (v) => setState(() => _search = v),
                    ),
                  ),
                  const SizedBox(width: 16),
                  _FilterDropdown(
                    label: 'Category',
                    value: _category,
                    items: _inventoryCategories,
                    onChanged: (v) => setState(() => _category = v ?? 'All'),
                  ),
                  const SizedBox(width: 12),
                  _FilterDropdown(
                    label: 'Status',
                    value: _statusFilter,
                    items: const ['All', 'OK', 'Low', 'Critical', 'Out'],
                    onChanged: (v) =>
                        setState(() => _statusFilter = v ?? 'All'),
                  ),
                  const Spacer(),
                  OutlinedButton.icon(
                    onPressed: filtered.isEmpty
                        ? null
                        : () => _printInventory(filtered),
                    icon: Icon(PhosphorIcons.filePdf(), size: 16),
                    label: const Text('PDF / Print'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              AdminTable(
                columns: const [
                  'Item Name',
                  'SKU',
                  'Category',
                  'Qty',
                  'Unit',
                  'Reorder',
                  'Status',
                  'Value',
                  'Actions'
                ],
                rows: filtered.isEmpty
                    ? [
                        [
                          const Text('No items found',
                              style: TextStyle(color: AppColors.kTextSecondary))
                        ]
                      ]
                    : filtered.map((item) {
                        final status = item.quantity <= 0
                            ? 'Out'
                            : item.quantity <= item.reorderLevel
                                ? 'Critical'
                                : item.quantity <= item.reorderLevel * 1.5
                                    ? 'Low'
                                    : 'OK';
                        final statusColor = status == 'OK'
                            ? AppColors.kSuccess
                            : status == 'Low'
                                ? AppColors.kWarning
                                : status == 'Critical'
                                    ? Colors.orange
                                    : AppColors.kError;
                        return [
                          Text(item.name,
                              style:
                                  const TextStyle(fontWeight: FontWeight.w500)),
                          Text(item.sku, style: const TextStyle(fontSize: 12)),
                          Text(item.category,
                              style: const TextStyle(fontSize: 12)),
                          Text(item.quantity.toStringAsFixed(1)),
                          Text(item.unit),
                          Text('${item.reorderLevel}'),
                          StatusBadge(status: status, color: statusColor),
                          Text('KES ${item.totalValue.toStringAsFixed(0)}',
                              style: const TextStyle(fontSize: 12)),
                          Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                tooltip: 'Edit',
                                icon:
                                    Icon(PhosphorIcons.pencilLine(), size: 16),
                                onPressed: () => _showItemDialog(item: item),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints.tightFor(
                                    width: 32, height: 32),
                              ),
                              IconButton(
                                tooltip: 'Delete',
                                icon: Icon(PhosphorIcons.trash(), size: 16),
                                color: AppColors.kError,
                                onPressed: () => _deleteItem(item),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints.tightFor(
                                    width: 32, height: 32),
                              ),
                            ],
                          ),
                        ];
                      }).toList(),
              ),
            ],
          ),
        ),
        Positioned(
          right: 24,
          bottom: 24,
          child: FloatingActionButton(
            backgroundColor: AppColors.kPrimary,
            onPressed: () => _showItemDialog(),
            child: Icon(PhosphorIcons.plus(), color: Colors.white),
          ),
        ),
      ],
    );
  }

  Future<void> _printInventory(List<InventoryItem> items) async {
    final totalValue = items.fold(0.0, (sum, item) => sum + item.totalValue);
    await ReportService().generateAndPrint(
      title: 'Master Inventory',
      subtitle: 'Simple items master catalog',
      sections: [
        ReportSection(
          title: 'Items',
          tableHeaders: const [
            'SKU',
            'Item',
            'Category',
            'Qty',
            'Unit',
            'Cost',
            'Value'
          ],
          tableRows: items
              .map((item) => [
                    item.sku,
                    item.name,
                    item.category,
                    item.quantity.toStringAsFixed(1),
                    item.unit,
                    item.unitCost.toStringAsFixed(0),
                    item.totalValue.toStringAsFixed(0),
                  ])
              .toList(),
          totalLabel: 'Total Value',
          totalValue: 'KES ${totalValue.toStringAsFixed(0)}',
        ),
      ],
    );
  }

  void _showItemDialog({InventoryItem? item}) {
    final isEdit = item != null;
    final nameCtrl = TextEditingController(text: item?.name ?? '');
    final skuCtrl = TextEditingController(text: item?.sku ?? '');
    final qtyCtrl =
        TextEditingController(text: (item?.quantity ?? 0).toString());
    final reorderCtrl =
        TextEditingController(text: (item?.reorderLevel ?? 10).toString());
    final costCtrl =
        TextEditingController(text: (item?.unitCost ?? 0).toString());
    String category = _categoryLabel(item?.category ?? 'produce');
    String unit = item?.unit.isNotEmpty == true ? item!.unit : 'kg';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: nameCtrl,
                  decoration: const InputDecoration(labelText: 'Item Name')),
              const SizedBox(height: 12),
              TextField(
                controller: skuCtrl,
                enabled: !isEdit,
                decoration: const InputDecoration(labelText: 'SKU'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: category,
                decoration: const InputDecoration(labelText: 'Category'),
                items: _inventoryCategories
                    .skip(1)
                    .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                    .toList(),
                onChanged: (v) => category = v ?? category,
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                      child: TextField(
                          controller: qtyCtrl,
                          decoration:
                              const InputDecoration(labelText: 'Quantity'),
                          keyboardType: TextInputType.number)),
                  const SizedBox(width: 12),
                  Expanded(
                    child: DropdownButtonFormField<String>(
                      initialValue: unit,
                      decoration: const InputDecoration(labelText: 'Unit'),
                      items: ['kg', 'g', 'l', 'ml', 'pcs', 'units']
                          .map(
                              (u) => DropdownMenuItem(value: u, child: Text(u)))
                          .toList(),
                      onChanged: (v) => unit = v ?? unit,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                  controller: reorderCtrl,
                  decoration: const InputDecoration(labelText: 'Reorder Level'),
                  keyboardType: TextInputType.number),
              const SizedBox(height: 12),
              TextField(
                  controller: costCtrl,
                  decoration: const InputDecoration(labelText: 'Unit Cost'),
                  keyboardType: TextInputType.number),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameCtrl.text.isEmpty) return;
              final payload = {
                'item_name': nameCtrl.text.trim(),
                'name': nameCtrl.text.trim(),
                'sku': skuCtrl.text,
                'category': category.toLowerCase(),
                'quantity': double.tryParse(qtyCtrl.text) ?? 0,
                'unit_of_measure': unit,
                'unit': unit,
                'reorder_level': int.tryParse(reorderCtrl.text) ?? 10,
                'cost_price': double.tryParse(costCtrl.text) ?? 0,
                'unit_cost': double.tryParse(costCtrl.text) ?? 0,
                'status': 'in_stock',
              };
              if (isEdit) {
                await ref
                    .read(adminRepositoryProvider)
                    .updateInventoryItem(item.sku, payload);
              } else {
                await ref
                    .read(adminRepositoryProvider)
                    .createInventoryItem(payload);
              }
              if (ctx.mounted) Navigator.pop(ctx);
              ref.invalidate(_inventoryFilteredProvider);
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  Future<void> _deleteItem(InventoryItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Inventory Item'),
        content: Text('Delete ${item.name}?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.kError,
              foregroundColor: Colors.white,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;
    await ref.read(adminRepositoryProvider).deleteInventoryItem(item.sku);
    ref.invalidate(_inventoryFilteredProvider);
  }

  String _categoryLabel(String value) {
    final lower = value.toLowerCase();
    for (final category in _inventoryCategories.skip(1)) {
      if (category.toLowerCase() == lower) return category;
    }
    return 'Other';
  }
}

class _BranchSelector extends ConsumerWidget {
  final List<AdminBranch> branches;

  const _BranchSelector({required this.branches});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedId = ref.watch(adminSelectedBranchProvider);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(
        children: [
          Icon(PhosphorIcons.buildings(),
              size: 18, color: AppColors.kTextSecondary),
          const SizedBox(width: 8),
          const Text('Branch:',
              style: TextStyle(color: AppColors.kTextSecondary, fontSize: 14)),
          const SizedBox(width: 12),
          SizedBox(
            width: 200,
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String?>(
                value: selectedId,
                hint: const Text('All Branches'),
                isDense: true,
                items: [
                  const DropdownMenuItem(
                      value: null, child: Text('All Branches')),
                  ...branches.map((b) =>
                      DropdownMenuItem(value: b.id, child: Text(b.name))),
                ],
                onChanged: (v) =>
                    ref.read(adminSelectedBranchProvider.notifier).state = v,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterDropdown extends StatelessWidget {
  final String label;
  final String value;
  final List<String> items;
  final ValueChanged<String?> onChanged;

  const _FilterDropdown({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: DropdownButtonFormField<String>(
        initialValue: value,
        isDense: true,
        decoration: InputDecoration(
          labelText: label,
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        ),
        items: items
            .map((i) => DropdownMenuItem(
                value: i, child: Text(i, style: const TextStyle(fontSize: 13))))
            .toList(),
        onChanged: onChanged,
      ),
    );
  }
}
