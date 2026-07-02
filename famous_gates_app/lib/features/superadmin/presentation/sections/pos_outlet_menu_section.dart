import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';

import '../../../../core/theme/app_theme.dart';
import '../../domain/superadmin_providers.dart';

class PosOutletMenuSection extends ConsumerStatefulWidget {
  const PosOutletMenuSection({super.key});

  @override
  ConsumerState<PosOutletMenuSection> createState() =>
      _PosOutletMenuSectionState();
}

class _PosOutletMenuSectionState extends ConsumerState<PosOutletMenuSection> {
  List<Map<String, dynamic>> _branches = [];
  List<Map<String, dynamic>> _outlets = [];
  List<Map<String, dynamic>> _items = [];
  int? _branchId;
  String? _outletId;
  String _search = '';
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load({bool keepOutlet = true}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(superadminGodRepositoryProvider);
      final branches = await repo.getBranches();
      final outlets = await repo.getPosOutlets(branchId: _branchId);
      var nextOutletId = keepOutlet ? _outletId : null;
      if (nextOutletId == null ||
          !outlets.any((outlet) => '${outlet['id']}' == nextOutletId)) {
        nextOutletId = outlets.isEmpty ? null : '${outlets.first['id']}';
      }
      final items = nextOutletId == null
          ? <Map<String, dynamic>>[]
          : await repo.getPosOutletItems(nextOutletId);
      if (!mounted) return;
      setState(() {
        _branches = branches;
        _outlets = outlets;
        _outletId = nextOutletId;
        _items = items;
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _sync() async {
    final outletId = _outletId;
    if (outletId == null) return;
    setState(() => _saving = true);
    try {
      await ref.read(superadminGodRepositoryProvider).syncPosOutletItems(outletId);
      await _load();
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(content: Text('POS outlet menu synced')),
        );
      }
    } catch (e) {
      if (mounted) _notifyError('Sync failed: $e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _items.where((item) {
      if (_search.trim().isEmpty) return true;
      final text = [
        item['name'],
        item['sku'],
        item['category'],
        item['source_table'],
      ].join(' ').toLowerCase();
      return text.contains(_search.toLowerCase());
    }).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header(),
          const SizedBox(height: 16),
          _filters(),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            _errorState()
          else
            _table(filtered),
        ],
      ),
    );
  }

  Widget _header() {
    return Row(
      children: [
        const Icon(Icons.storefront, color: AppColors.kPrimary, size: 28),
        const SizedBox(width: 12),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'POS Outlet Menu',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              ),
              Text(
                'Edit the exact pos_outlet_items rows fetched by outlet POS.',
                style: TextStyle(fontSize: 13, color: AppColors.kTextSecondary),
              ),
            ],
          ),
        ),
        OutlinedButton.icon(
          onPressed: _saving || _outletId == null ? null : _sync,
          icon: Icon(PhosphorIcons.arrowsClockwise(), size: 18),
          label: const Text('Sync From Menus'),
        ),
        const SizedBox(width: 8),
        FilledButton.icon(
          onPressed: _saving || _outletId == null ? null : () => _editItem(),
          icon: const Icon(Icons.add),
          label: const Text('Add Item'),
          style: FilledButton.styleFrom(backgroundColor: AppColors.kPrimary),
        ),
      ],
    );
  }

  Widget _filters() {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        SizedBox(
          width: 230,
          child: DropdownButtonFormField<int?>(
            initialValue: _branchId,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Branch'),
            items: [
              const DropdownMenuItem<int?>(
                value: null,
                child: Text('All branches'),
              ),
              ..._branches.map((branch) => DropdownMenuItem<int?>(
                    value: int.tryParse('${branch['id']}'),
                    child: Text('${branch['name']}'),
                  )),
            ],
            onChanged: (value) {
              setState(() => _branchId = value);
              _load(keepOutlet: false);
            },
          ),
        ),
        SizedBox(
          width: 300,
          child: DropdownButtonFormField<String>(
            initialValue: _outletId,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'POS outlet'),
            items: _outlets.isEmpty
                ? [
                    const DropdownMenuItem<String>(
                      value: null,
                      enabled: false,
                      child: Text('No outlets available'),
                    ),
                  ]
                : _outlets.map((outlet) {
                    return DropdownMenuItem<String>(
                      value: '${outlet['id']}',
                      child: Text(_outletLabel(outlet)),
                    );
                  }).toList(),
            onChanged: _outlets.isEmpty
                ? null
                : (value) {
                    setState(() => _outletId = value);
                    _load();
                  },
          ),
        ),
        SizedBox(
          width: 280,
          child: TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              labelText: 'Search items',
            ),
            onChanged: (value) => setState(() => _search = value),
          ),
        ),
        IconButton(
          tooltip: 'Refresh',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
    );
  }

  Widget _table(List<Map<String, dynamic>> rows) {
    if (_outlets.isEmpty) {
      return _empty('No POS outlets found for this branch.');
    }
    if (rows.isEmpty) {
      return _empty('No POS outlet items found.');
    }
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingRowColor: WidgetStatePropertyAll(Colors.grey.shade50),
          columns: const [
            DataColumn(label: Text('Item')),
            DataColumn(label: Text('Source')),
            DataColumn(label: Text('Category')),
            DataColumn(label: Text('Price')),
            DataColumn(label: Text('Cost')),
            DataColumn(label: Text('Stock')),
            DataColumn(label: Text('Available')),
            DataColumn(label: Text('Actions')),
          ],
          rows: rows.map((item) {
            final active = item['is_active'] != false &&
                item['is_available'] != false &&
                item['status'] != 'inactive';
            return DataRow(cells: [
              DataCell(Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${item['name'] ?? '-'}',
                      style: const TextStyle(fontWeight: FontWeight.w700)),
                  Text('${item['sku'] ?? ''}',
                      style: const TextStyle(
                          fontSize: 11, color: AppColors.kTextSecondary)),
                ],
              )),
              DataCell(Text(_sourceLabel(item))),
              DataCell(Text('${item['category'] ?? '-'}')),
              DataCell(Text('KES ${_money(item['selling_price'])}')),
              DataCell(Text('KES ${_money(item['cost_price'])}')),
              DataCell(Text(
                  '${_qty(item['current_stock'])} ${item['unit'] ?? 'each'}')),
              DataCell(_StatusChip(active: active)),
              DataCell(IconButton(
                tooltip: 'Edit item',
                icon: const Icon(Icons.edit_outlined),
                onPressed: () => _editItem(item: item),
              )),
            ]);
          }).toList(),
        ),
      ),
    );
  }

  Widget _empty(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(message, textAlign: TextAlign.center),
    );
  }

  Widget _errorState() {
    return _empty(_error ?? 'Failed to load POS outlet menu.');
  }

  Future<void> _editItem({Map<String, dynamic>? item}) async {
    final outletId = _outletId;
    if (outletId == null) return;
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _PosOutletItemDialog(outletId: outletId, item: item),
    );
    if (saved != true) return;
    await _load();
    if (!mounted) return;
  }

  String _outletLabel(Map<String, dynamic> outlet) {
    final branch = _branches.firstWhere(
      (b) => '${b['id']}' == '${outlet['branch_id']}',
      orElse: () => const {},
    );
    final branchName = branch['name'] == null ? '' : ' - ${branch['name']}';
    return '${outlet['name'] ?? 'POS outlet'}$branchName';
  }

  String _sourceLabel(Map<String, dynamic> item) {
    final source = '${item['source_table'] ?? 'manual'}';
    if (source == 'restaurant_menu_items') return 'Restaurant menu';
    if (source == 'bar_drinks') return 'Bar menu';
    if (source == 'dynamic_services') return 'Dynamic service';
    return 'Manual';
  }

  String _money(dynamic value) {
    final n = value is num ? value : num.tryParse('$value') ?? 0;
    return n.toStringAsFixed(2);
  }

  String _qty(dynamic value) {
    final n = value is num ? value : num.tryParse('$value') ?? 0;
    return n % 1 == 0 ? n.toStringAsFixed(0) : n.toStringAsFixed(2);
  }

  void _notifyError(String message) {
    AppNotifier.showSnackBar(
      context,
      SnackBar(content: Text(message), backgroundColor: AppColors.kError),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.active});
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(active ? 'Active' : 'Inactive'),
      visualDensity: VisualDensity.compact,
      backgroundColor: active
          ? AppColors.kSuccess.withValues(alpha: 0.12)
          : AppColors.kError.withValues(alpha: 0.10),
      labelStyle: TextStyle(
        color: active ? AppColors.kSuccess : AppColors.kError,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _PosOutletItemDialog extends ConsumerStatefulWidget {
  const _PosOutletItemDialog({required this.outletId, this.item});
  final String outletId;
  final Map<String, dynamic>? item;

  @override
  ConsumerState<_PosOutletItemDialog> createState() =>
      _PosOutletItemDialogState();
}

class _PosOutletItemDialogState extends ConsumerState<_PosOutletItemDialog> {
  final _formKey = GlobalKey<FormState>();
  late final _name =
      TextEditingController(text: '${widget.item?['name'] ?? ''}');
  late final _sku = TextEditingController(text: '${widget.item?['sku'] ?? ''}');
  late final _category =
      TextEditingController(text: '${widget.item?['category'] ?? ''}');
  late final _unit =
      TextEditingController(text: '${widget.item?['unit'] ?? 'each'}');
  late final _price =
      TextEditingController(text: '${widget.item?['selling_price'] ?? ''}');
  late final _cost =
      TextEditingController(text: '${widget.item?['cost_price'] ?? ''}');
  late final _opening =
      TextEditingController(text: '${widget.item?['opening_stock'] ?? 0}');
  late final _current =
      TextEditingController(text: '${widget.item?['current_stock'] ?? 0}');
  late bool _trackStock = widget.item?['track_stock'] != false;
  late bool _active = widget.item?['is_active'] != false &&
      widget.item?['is_available'] != false &&
      widget.item?['status'] != 'inactive';
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _sku.dispose();
    _category.dispose();
    _unit.dispose();
    _price.dispose();
    _cost.dispose();
    _opening.dispose();
    _current.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.item == null ? 'Add POS Outlet Item' : 'Edit POS Item'),
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
                  decoration: const InputDecoration(labelText: 'Item name *'),
                  validator: (v) =>
                      v == null || v.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(
                    child: TextFormField(
                      controller: _sku,
                      decoration: const InputDecoration(labelText: 'SKU *'),
                      validator: (v) =>
                          v == null || v.trim().isEmpty ? 'Required' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _category,
                      decoration: const InputDecoration(labelText: 'Category'),
                    ),
                  ),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: _numberField(_price, 'Selling price *')),
                  const SizedBox(width: 12),
                  Expanded(child: _numberField(_cost, 'Cost price')),
                ]),
                const SizedBox(height: 12),
                Row(children: [
                  Expanded(child: _numberField(_opening, 'Opening stock')),
                  const SizedBox(width: 12),
                  Expanded(child: _numberField(_current, 'Current stock')),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _unit,
                      decoration: const InputDecoration(labelText: 'Unit'),
                    ),
                  ),
                ]),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _trackStock,
                  title: const Text('Track stock for this item'),
                  onChanged: (value) => setState(() => _trackStock = value),
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  value: _active,
                  title: const Text('Available in POS'),
                  onChanged: (value) => setState(() => _active = value),
                ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context, false),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Text('Save'),
        ),
      ],
    );
  }

  TextFormField _numberField(TextEditingController controller, String label) {
    return TextFormField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(labelText: label),
      validator: (v) {
        if (label.contains('*') && (v == null || v.trim().isEmpty)) {
          return 'Required';
        }
        if (v != null &&
            v.trim().isNotEmpty &&
            num.tryParse(v.trim()) == null) {
          return 'Enter a number';
        }
        return null;
      },
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final body = {
        'name': _name.text.trim(),
        'sku': _sku.text.trim(),
        'category': _category.text.trim().isEmpty
            ? 'Manual'
            : _category.text.trim(),
        'unit': _unit.text.trim().isEmpty ? 'each' : _unit.text.trim(),
        'selling_price': num.tryParse(_price.text.trim()) ?? 0,
        'cost_price': num.tryParse(_cost.text.trim()) ?? 0,
        'opening_stock': num.tryParse(_opening.text.trim()) ?? 0,
        'current_stock': num.tryParse(_current.text.trim()) ?? 0,
        'track_stock': _trackStock,
        'is_active': _active,
        'is_available': _active,
        'status': _active ? 'active' : 'inactive',
      };
      final repo = ref.read(superadminGodRepositoryProvider);
      if (widget.item == null) {
        await repo.createPosOutletItem(widget.outletId, body);
      } else {
        await repo.updatePosOutletItem(
            widget.outletId, '${widget.item!['id']}', body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text('Save failed: $e')),
        );
        setState(() => _saving = false);
      }
    }
  }
}
