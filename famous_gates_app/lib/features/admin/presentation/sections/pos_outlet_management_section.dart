import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/app_notifier.dart';
import '../../data/admin_repository.dart';
import '../../data/models/branch.dart';

const _outletTypes = <String, String>{
  'restaurant': 'Restaurant POS',
  'main_bar': 'Main Bar POS',
  'executive_bar': 'Executive Bar POS',
  'non_consumables': 'Non-consumables POS',
  'cashier': 'Cashier POS',
};

const _pinPrefixes = <String, String>{
  'restaurant': 'R',
  'main_bar': 'M',
  'executive_bar': 'E',
  'non_consumables': 'N',
  'cashier': 'C',
};

class PosOutletManagementSection extends ConsumerStatefulWidget {
  const PosOutletManagementSection({super.key});

  @override
  ConsumerState<PosOutletManagementSection> createState() =>
      _PosOutletManagementSectionState();
}

class _PosOutletManagementSectionState
    extends ConsumerState<PosOutletManagementSection> {
  String? _branchId;
  String? _outletType;
  String? _selectedOutletId;
  late Future<void> _loadFuture;
  List<AdminBranch> _branches = const [];
  List<Map<String, dynamic>> _outlets = const [];
  List<Map<String, dynamic>> _items = const [];
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadFuture = _load();
  }

  Future<void> _load() async {
    final repo = ref.read(adminRepositoryProvider);
    final results = await Future.wait([
      repo.getBranches(),
      repo.getPosOutlets(branchId: _branchId, outletType: _outletType),
    ]);
    _branches = results[0] as List<AdminBranch>;
    _outlets = results[1] as List<Map<String, dynamic>>;
    if (_selectedOutletId == null ||
        !_outlets.any((row) => _id(row) == _selectedOutletId)) {
      _selectedOutletId = _outlets.isEmpty ? null : _id(_outlets.first);
    }
    await _loadItems();
  }

  Future<void> _loadItems() async {
    if (_selectedOutletId == null) {
      _items = const [];
      return;
    }
    _items = await ref
        .read(adminRepositoryProvider)
        .getPosOutletItems(_selectedOutletId!);
  }

  Future<void> _refresh() async {
    setState(() {
      _loadFuture = _load();
    });
    await _loadFuture;
    if (mounted) setState(() {});
  }

  String _id(Map<String, dynamic> row) => '${row['id'] ?? ''}';

  String _text(Map<String, dynamic> row, String key, [String fallback = '']) {
    final value = row[key];
    if (value == null || '$value' == 'null') return fallback;
    return '$value';
  }

  num _num(Map<String, dynamic> row, String key) {
    final value = row[key];
    if (value is num) return value;
    return num.tryParse('$value') ?? 0;
  }

  Map<String, dynamic>? get _selectedOutlet {
    for (final outlet in _outlets) {
      if (_id(outlet) == _selectedOutletId) return outlet;
    }
    return null;
  }

  String _branchName(dynamic branchId) {
    final id = '$branchId';
    for (final branch in _branches) {
      if (branch.id == id) return branch.name;
    }
    return id.isEmpty || id == 'null' ? '-' : id;
  }

  Future<void> _run(String success, Future<void> Function() action) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await action();
      if (mounted) await AppNotifier.show(context, success, isError: false);
      await _refresh();
    } catch (e) {
      if (mounted) await AppNotifier.show(context, '$e', isError: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<void>(
      future: _loadFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snapshot.hasError) {
          return _ErrorState(
            message: '${snapshot.error}',
            onRetry: _refresh,
          );
        }
        return RefreshIndicator(
          onRefresh: _refresh,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildToolbar(),
                const SizedBox(height: 18),
                _buildOutletGrid(),
                const SizedBox(height: 18),
                _buildItemsPanel(),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildToolbar() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.kDivider),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SizedBox(
              width: 260,
              child: DropdownButtonFormField<String?>(
                initialValue: _branchId,
                decoration: const InputDecoration(labelText: 'Branch'),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('All branches'),
                  ),
                  ..._branches.map(
                    (branch) => DropdownMenuItem<String?>(
                      value: branch.id,
                      child: Text(branch.name, overflow: TextOverflow.ellipsis),
                    ),
                  ),
                ],
                onChanged: (value) {
                  _branchId = value;
                  _selectedOutletId = null;
                  _refresh();
                },
              ),
            ),
            SizedBox(
              width: 260,
              child: DropdownButtonFormField<String?>(
                initialValue: _outletType,
                decoration: const InputDecoration(labelText: 'Outlet type'),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('All outlet types'),
                  ),
                  ..._outletTypes.entries.map(
                    (entry) => DropdownMenuItem<String?>(
                      value: entry.key,
                      child: Text(entry.value, overflow: TextOverflow.ellipsis),
                    ),
                  ),
                ],
                onChanged: (value) {
                  _outletType = value;
                  _selectedOutletId = null;
                  _refresh();
                },
              ),
            ),
            OutlinedButton.icon(
              onPressed: _busy ? null : _refresh,
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Refresh'),
            ),
            FilledButton.icon(
              onPressed: _busy ? null : () => _showOutletDialog(),
              icon: const Icon(Icons.add_business, size: 18),
              label: const Text('Outlet'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildOutletGrid() {
    if (_outlets.isEmpty) {
      return const _EmptyPanel(
        icon: Icons.storefront,
        title: 'No POS outlets configured',
        subtitle:
            'Create restaurant, bar, and non-consumables POS outlets per branch.',
      );
    }
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: _outlets.map((outlet) {
        final selected = _id(outlet) == _selectedOutletId;
        final type = _text(outlet, 'outlet_type');
        return SizedBox(
          width: 300,
          child: InkWell(
            borderRadius: BorderRadius.circular(12),
            onTap: () async {
              setState(() => _selectedOutletId = _id(outlet));
              await _loadItems();
              if (mounted) setState(() {});
            },
            child: Card(
              elevation: 0,
              color: selected
                  ? AppColors.kPrimary.withValues(alpha: 0.06)
                  : Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(
                  color: selected ? AppColors.kPrimary : AppColors.kDivider,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _OutletIcon(type: type),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _text(outlet, 'name',
                                _outletTypes[type] ?? 'POS outlet'),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.kTextPrimary,
                            ),
                          ),
                        ),
                        IconButton(
                          tooltip: 'Edit outlet',
                          onPressed: _busy
                              ? null
                              : () => _showOutletDialog(outlet: outlet),
                          icon: const Icon(Icons.edit, size: 18),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(_outletTypes[type] ?? type,
                        style:
                            const TextStyle(color: AppColors.kTextSecondary)),
                    const SizedBox(height: 4),
                    Text(
                      '${_branchName(outlet['branch_id'])}  •  PIN ${_text(outlet, 'pin_prefix')}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.kPrimary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildItemsPanel() {
    final outlet = _selectedOutlet;
    if (outlet == null) {
      return _EmptyPanel(
        icon: PhosphorIcons.listBullets(),
        title: 'Select an outlet',
        subtitle: 'Choose an outlet to view or define sellable POS items.',
      );
    }
    final type = _text(outlet, 'outlet_type');
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.kDivider),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              spacing: 12,
              runSpacing: 12,
              alignment: WrapAlignment.spaceBetween,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(
                  width: 420,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${_text(outlet, 'name')} Items',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _sourceText(type),
                        style: const TextStyle(color: AppColors.kTextSecondary),
                      ),
                    ],
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: _busy
                      ? null
                      : () => _run('Items synced', () async {
                            await ref
                                .read(adminRepositoryProvider)
                                .syncPosOutletItems(_id(outlet));
                          }),
                  icon: const Icon(Icons.sync, size: 18),
                  label: const Text('Sync source items'),
                ),
                FilledButton.icon(
                  onPressed: _busy ? null : () => _showItemDialog(outlet),
                  icon: const Icon(Icons.add, size: 18),
                  label: const Text('Add item'),
                ),
              ],
            ),
            const SizedBox(height: 14),
            if (_items.isEmpty)
              const Padding(
                padding: EdgeInsets.all(28),
                child: Center(
                  child: Text(
                    'No items configured. Sync from source menus or add items manually.',
                    style: TextStyle(color: AppColors.kTextSecondary),
                  ),
                ),
              )
            else
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: DataTable(
                  headingRowColor:
                      const WidgetStatePropertyAll(AppColors.kSurface),
                  columns: const [
                    DataColumn(label: Text('Item')),
                    DataColumn(label: Text('Category')),
                    DataColumn(label: Text('Unit')),
                    DataColumn(label: Text('Selling')),
                    DataColumn(label: Text('Stock')),
                    DataColumn(label: Text('Track')),
                    DataColumn(label: Text('Action')),
                  ],
                  rows: _items.map((item) {
                    return DataRow(cells: [
                      DataCell(SizedBox(
                        width: 260,
                        child: Text(
                          _text(item, 'name'),
                          overflow: TextOverflow.ellipsis,
                        ),
                      )),
                      DataCell(Text(_text(item, 'category', '-'))),
                      DataCell(Text(_text(item, 'unit', 'each'))),
                      DataCell(Text('KES ${_num(item, 'selling_price')}')),
                      DataCell(Text('${_num(item, 'current_stock')}')),
                      DataCell(
                          Text(item['track_stock'] == false ? 'No' : 'Yes')),
                      DataCell(TextButton.icon(
                        onPressed: _busy
                            ? null
                            : () => _showItemDialog(outlet, item: item),
                        icon: const Icon(Icons.edit, size: 16),
                        label: const Text('Edit'),
                      )),
                    ]);
                  }).toList(),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _sourceText(String type) {
    switch (type) {
      case 'restaurant':
        return 'Loads active restaurant menu items for order taking.';
      case 'main_bar':
      case 'executive_bar':
        return 'Loads active bar drinks and alcohol items. Add outlet-specific drinks here.';
      case 'non_consumables':
        return 'Define swimming pool, pool tokens, car wash and other non-consumable services.';
      default:
        return 'Define the sellable items for this POS outlet.';
    }
  }

  Future<void> _showOutletDialog({Map<String, dynamic>? outlet}) async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _OutletDialog(
        branches: _branches,
        outlet: outlet,
      ),
    );
    if (result == null) return;
    await _run(outlet == null ? 'Outlet saved' : 'Outlet updated', () async {
      final repo = ref.read(adminRepositoryProvider);
      if (outlet == null) {
        await repo.createPosOutlet(result);
      } else {
        await repo.updatePosOutlet(_id(outlet), result);
      }
    });
  }

  Future<void> _showItemDialog(
    Map<String, dynamic> outlet, {
    Map<String, dynamic>? item,
  }) async {
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (_) => _OutletItemDialog(item: item),
    );
    if (result == null) return;
    await _run(item == null ? 'Item saved' : 'Item updated', () async {
      final repo = ref.read(adminRepositoryProvider);
      if (item == null) {
        await repo.createPosOutletItem(_id(outlet), result);
      } else {
        await repo.updatePosOutletItem(_id(outlet), _id(item), result);
      }
    });
  }
}

class _OutletDialog extends StatefulWidget {
  final List<AdminBranch> branches;
  final Map<String, dynamic>? outlet;

  const _OutletDialog({required this.branches, this.outlet});

  @override
  State<_OutletDialog> createState() => _OutletDialogState();
}

class _OutletDialogState extends State<_OutletDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  String? _branchId;
  String _type = 'restaurant';
  bool _active = true;

  @override
  void initState() {
    super.initState();
    final outlet = widget.outlet;
    _name = TextEditingController(text: '${outlet?['name'] ?? ''}');
    _branchId = outlet == null ? null : '${outlet['branch_id']}';
    _type = '${outlet?['outlet_type'] ?? 'restaurant'}';
    _active = outlet?['is_active'] != false;
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.outlet == null ? 'Add POS Outlet' : 'Edit POS Outlet'),
      content: SizedBox(
        width: 460,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<String>(
                initialValue: _branchId,
                decoration: const InputDecoration(labelText: 'Branch'),
                items: widget.branches
                    .map((branch) => DropdownMenuItem(
                          value: branch.id,
                          child: Text(branch.name,
                              overflow: TextOverflow.ellipsis),
                        ))
                    .toList(),
                validator: (value) => value == null || value.isEmpty
                    ? 'Branch is required'
                    : null,
                onChanged: widget.outlet == null
                    ? (value) => setState(() => _branchId = value)
                    : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue:
                    _outletTypes.containsKey(_type) ? _type : 'restaurant',
                decoration: const InputDecoration(labelText: 'Outlet type'),
                items: _outletTypes.entries
                    .map((entry) => DropdownMenuItem(
                          value: entry.key,
                          child: Text(entry.value),
                        ))
                    .toList(),
                onChanged: widget.outlet == null
                    ? (value) => setState(() {
                          _type = value ?? 'restaurant';
                          if (_name.text.trim().isEmpty) {
                            _name.text = _outletTypes[_type] ?? '';
                          }
                        })
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Outlet name'),
                validator: (value) => value == null || value.trim().isEmpty
                    ? 'Name is required'
                    : null,
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Active'),
                value: _active,
                onChanged: (value) => setState(() => _active = value),
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
          onPressed: () {
            if (!_formKey.currentState!.validate()) return;
            Navigator.pop(context, {
              'branch_id': _branchId,
              'outlet_type': _type,
              'name': _name.text.trim(),
              'pin_prefix': _pinPrefixes[_type] ?? 'R',
              'is_active': _active,
            });
          },
          child: const Text('Save'),
        ),
      ],
    );
  }
}

class _OutletItemDialog extends StatefulWidget {
  final Map<String, dynamic>? item;

  const _OutletItemDialog({this.item});

  @override
  State<_OutletItemDialog> createState() => _OutletItemDialogState();
}

class _OutletItemDialogState extends State<_OutletItemDialog> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _name;
  late final TextEditingController _sku;
  late final TextEditingController _category;
  late final TextEditingController _unit;
  late final TextEditingController _selling;
  late final TextEditingController _cost;
  late final TextEditingController _stock;
  bool _trackStock = true;
  bool _active = true;

  @override
  void initState() {
    super.initState();
    final item = widget.item;
    _name = TextEditingController(text: '${item?['name'] ?? ''}');
    _sku = TextEditingController(text: '${item?['sku'] ?? ''}');
    _category = TextEditingController(text: '${item?['category'] ?? ''}');
    _unit = TextEditingController(text: '${item?['unit'] ?? 'each'}');
    _selling = TextEditingController(text: '${item?['selling_price'] ?? ''}');
    _cost = TextEditingController(text: '${item?['cost_price'] ?? ''}');
    _stock = TextEditingController(text: '${item?['current_stock'] ?? '0'}');
    _trackStock = item?['track_stock'] != false;
    _active = item?['is_active'] != false;
  }

  @override
  void dispose() {
    _name.dispose();
    _sku.dispose();
    _category.dispose();
    _unit.dispose();
    _selling.dispose();
    _cost.dispose();
    _stock.dispose();
    super.dispose();
  }

  double _parse(String text) => double.tryParse(text.trim()) ?? 0;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.item == null ? 'Add POS Item' : 'Edit POS Item'),
      content: SizedBox(
        width: 560,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: _name,
                  decoration: const InputDecoration(labelText: 'Item name'),
                  validator: (value) => value == null || value.trim().isEmpty
                      ? 'Item name is required'
                      : null,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _sku,
                        decoration:
                            const InputDecoration(labelText: 'SKU/code'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _category,
                        decoration:
                            const InputDecoration(labelText: 'Category'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _unit,
                        decoration: const InputDecoration(labelText: 'Unit'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _selling,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Selling price'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _cost,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Cost price'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _stock,
                        keyboardType: TextInputType.number,
                        decoration:
                            const InputDecoration(labelText: 'Current stock'),
                      ),
                    ),
                  ],
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Track stock'),
                  value: _trackStock,
                  onChanged: (value) => setState(() => _trackStock = value),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Active'),
                  value: _active,
                  onChanged: (value) => setState(() => _active = value),
                ),
              ],
            ),
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
            if (!_formKey.currentState!.validate()) return;
            Navigator.pop(context, {
              'name': _name.text.trim(),
              'sku': _sku.text.trim().isEmpty
                  ? _name.text.trim().toUpperCase().replaceAll(' ', '-')
                  : _sku.text.trim(),
              'category': _category.text.trim().isEmpty
                  ? 'Manual'
                  : _category.text.trim(),
              'unit': _unit.text.trim().isEmpty ? 'each' : _unit.text.trim(),
              'selling_price': _parse(_selling.text),
              'cost_price': _parse(_cost.text),
              'opening_stock': _parse(_stock.text),
              'current_stock': _parse(_stock.text),
              'track_stock': _trackStock,
              'is_active': _active,
            });
          },
          child: const Text('Save'),
        ),
      ],
    );
  }
}

class _OutletIcon extends StatelessWidget {
  final String type;

  const _OutletIcon({required this.type});

  @override
  Widget build(BuildContext context) {
    final icon = switch (type) {
      'restaurant' => PhosphorIcons.forkKnife(),
      'main_bar' || 'executive_bar' => PhosphorIcons.wine(),
      'non_consumables' => Icons.confirmation_number_outlined,
      'cashier' => Icons.point_of_sale,
      _ => Icons.storefront,
    };
    return Container(
      width: 38,
      height: 38,
      decoration: BoxDecoration(
        color: AppColors.kPrimary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Icon(icon, color: AppColors.kPrimary, size: 20),
    );
  }
}

class _EmptyPanel extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _EmptyPanel({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: const BorderSide(color: AppColors.kDivider),
      ),
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Center(
          child: Column(
            children: [
              Icon(icon, color: AppColors.kTextSecondary, size: 34),
              const SizedBox(height: 10),
              Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.kTextSecondary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  final String message;
  final Future<void> Function() onRetry;

  const _ErrorState({required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: AppColors.kError),
          ),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline,
                    color: AppColors.kError, size: 32),
                const SizedBox(height: 12),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppColors.kError),
                ),
                const SizedBox(height: 14),
                OutlinedButton.icon(
                  onPressed: onRetry,
                  icon: const Icon(Icons.refresh, size: 18),
                  label: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
