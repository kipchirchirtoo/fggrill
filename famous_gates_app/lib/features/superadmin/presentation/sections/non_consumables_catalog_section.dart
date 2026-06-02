import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/superadmin_providers.dart';

/// Manages the Non-Consumables POS catalogue.
///
/// Non-consumables POS reads its items from the `dynamic_services` table
/// (synced into `pos_outlet_items`). Each entry has a name, price, service
/// type, and an optional branch (null = available to all branches).
class NonConsumablesCatalogSection extends ConsumerStatefulWidget {
  const NonConsumablesCatalogSection({super.key});

  @override
  ConsumerState<NonConsumablesCatalogSection> createState() =>
      _NonConsumablesCatalogSectionState();
}

class _NonConsumablesCatalogSectionState
    extends ConsumerState<NonConsumablesCatalogSection> {
  // Service types the non-consumables POS station recognises.
  static const _serviceTypes = <String, String>{
    'non_consumable': 'Non-consumable',
    'car_wash': 'Car Wash',
    'swimming': 'Swimming',
    'pool': 'Pool',
    'pool_token': 'Pool Token',
    'sauna': 'Sauna',
  };

  List<Map<String, dynamic>> _items = [];
  List<Map<String, dynamic>> _branches = [];
  int? _branchFilter; // null = all
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(superadminGodRepositoryProvider);
      final branches = await repo.getBranches();
      final items = await repo.getNonConsumables(branchId: _branchFilter);
      if (!mounted) return;
      setState(() {
        _branches = branches;
        _items = items;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String _branchName(dynamic id) {
    if (id == null) return 'All Branches';
    final match = _branches.firstWhere(
      (b) => '${b['id']}' == '$id',
      orElse: () => const {},
    );
    return (match['name'] ?? 'Branch $id').toString();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 20),
          _buildFilters(),
          const SizedBox(height: 16),
          if (_loading)
            const Padding(
              padding: EdgeInsets.all(48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            _errorState()
          else if (_items.isEmpty)
            _emptyState()
          else
            _buildTable(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        Icon(PhosphorIcons.package(), color: AppColors.kPrimary, size: 28),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Non-Consumables POS Catalogue',
                  style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.kTextPrimary)),
              Text(
                  'Items sold at the Non-consumables POS station — per branch with price.',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
            ],
          ),
        ),
        FilledButton.icon(
          onPressed: () => _openEditor(),
          icon: const Icon(Icons.add),
          label: const Text('Add Item'),
          style: FilledButton.styleFrom(backgroundColor: AppColors.kPrimary),
        ),
      ],
    );
  }

  Widget _buildFilters() {
    return Row(
      children: [
        const Text('Branch:', style: TextStyle(fontWeight: FontWeight.w600)),
        const SizedBox(width: 10),
        DropdownButton<int?>(
          value: _branchFilter,
          hint: const Text('All Branches'),
          items: [
            const DropdownMenuItem<int?>(
                value: null, child: Text('All Branches')),
            ..._branches.map((b) => DropdownMenuItem<int?>(
                  value: b['id'] is int
                      ? b['id'] as int
                      : int.tryParse('${b['id']}'),
                  child: Text('${b['name']}'),
                )),
          ],
          onChanged: (v) {
            setState(() => _branchFilter = v);
            _load();
          },
        ),
        const Spacer(),
        IconButton(
          tooltip: 'Refresh',
          onPressed: _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
    );
  }

  Widget _buildTable() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          for (final item in _items) _itemTile(item),
        ],
      ),
    );
  }

  Widget _itemTile(Map<String, dynamic> item) {
    final active = item['is_active'] == true;
    final price = item['base_price'];
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
        child: Icon(PhosphorIcons.tag(), color: AppColors.kPrimary, size: 18),
      ),
      title: Text('${item['name']}',
          style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text(
        '${_serviceTypes[item['service_type']] ?? item['service_type']} • '
        '${_branchName(item['branch_id'])}'
        '${active ? '' : ' • INACTIVE'}',
        style: TextStyle(
            fontSize: 12,
            color: active ? Colors.grey.shade600 : Colors.red.shade400),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text('KES ${_fmt(price)}',
              style: const TextStyle(
                  fontWeight: FontWeight.w800, color: AppColors.kPrimary)),
          IconButton(
            tooltip: 'Edit',
            icon: const Icon(Icons.edit, size: 18),
            onPressed: () => _openEditor(item: item),
          ),
          IconButton(
            tooltip: 'Deactivate',
            icon: const Icon(Icons.delete_outline, size: 18),
            color: Colors.red.shade400,
            onPressed: () => _delete(item),
          ),
        ],
      ),
    );
  }

  String _fmt(dynamic v) {
    final n = v is num ? v : num.tryParse('$v') ?? 0;
    return n.toStringAsFixed(2);
  }

  Widget _emptyState() => Container(
        padding: const EdgeInsets.all(48),
        alignment: Alignment.center,
        child: Column(children: [
          Icon(PhosphorIcons.package(), size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text('No non-consumable items yet',
              style: TextStyle(color: Colors.grey.shade600)),
          const SizedBox(height: 4),
          Text('Add items that the Non-consumables POS station will sell.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade400)),
        ]),
      );

  Widget _errorState() => Container(
        padding: const EdgeInsets.all(32),
        alignment: Alignment.center,
        child: Column(children: [
          Icon(Icons.error_outline, color: Colors.red.shade300, size: 40),
          const SizedBox(height: 12),
          Text(_error ?? 'Failed to load',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade700)),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: _load,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ]),
      );

  Future<void> _delete(Map<String, dynamic> item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Deactivate Item'),
        content: Text(
            'Deactivate "${item['name']}"? It will stop appearing in the POS catalogue.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              style: FilledButton.styleFrom(backgroundColor: Colors.red),
              child: const Text('Deactivate')),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ref.read(superadminGodRepositoryProvider).deleteNonConsumable(
          item['id'] is int ? item['id'] as int : int.parse('${item['id']}'));
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Item deactivated')));
      }
      _load();
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Failed: $e')));
      }
    }
  }

  Future<void> _openEditor({Map<String, dynamic>? item}) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _NonConsumableEditor(
        existing: item,
        branches: _branches,
        serviceTypes: _serviceTypes,
      ),
    );
    if (saved == true) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
                content: Text(item == null ? 'Item added' : 'Item updated')));
      }
      _load();
    }
  }
}

// ── Add / Edit dialog ─────────────────────────────────────────────────────────
class _NonConsumableEditor extends ConsumerStatefulWidget {
  const _NonConsumableEditor({
    required this.existing,
    required this.branches,
    required this.serviceTypes,
  });
  final Map<String, dynamic>? existing;
  final List<Map<String, dynamic>> branches;
  final Map<String, String> serviceTypes;

  @override
  ConsumerState<_NonConsumableEditor> createState() =>
      _NonConsumableEditorState();
}

class _NonConsumableEditorState extends ConsumerState<_NonConsumableEditor> {
  late final TextEditingController _name =
      TextEditingController(text: widget.existing?['name']?.toString() ?? '');
  late final TextEditingController _price = TextEditingController(
      text: widget.existing?['base_price']?.toString() ?? '');
  late String _serviceType =
      widget.serviceTypes.keys.contains(widget.existing?['service_type'])
          ? widget.existing!['service_type'] as String
          : 'non_consumable';
  late int? _branchId = widget.existing?['branch_id'] == null
      ? null
      : (widget.existing!['branch_id'] is int
          ? widget.existing!['branch_id'] as int
          : int.tryParse('${widget.existing!['branch_id']}'));
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _price.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _name.text.trim();
    final price = num.tryParse(_price.text.trim());
    if (name.isEmpty) {
      AppNotifier.showSnackBar(
          context, const SnackBar(content: Text('Name is required')));
      return;
    }
    if (price == null || price < 0) {
      AppNotifier.showSnackBar(
          context, const SnackBar(content: Text('Enter a valid price')));
      return;
    }
    setState(() => _saving = true);
    try {
      final repo = ref.read(superadminGodRepositoryProvider);
      final body = {
        'name': name,
        'base_price': price,
        'service_type': _serviceType,
        'branch_id': _branchId,
      };
      if (widget.existing == null) {
        await repo.createNonConsumable(body);
      } else {
        final id = widget.existing!['id'];
        await repo.updateNonConsumable(id is int ? id : int.parse('$id'), body);
      }
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Failed: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.existing == null
          ? 'Add Non-Consumable Item'
          : 'Edit Non-Consumable Item'),
      content: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Item Name *'),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _price,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                  labelText: 'Price (KES) *', prefixText: 'KES '),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _serviceType,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'Type'),
              items: widget.serviceTypes.entries
                  .map((e) =>
                      DropdownMenuItem(value: e.key, child: Text(e.value)))
                  .toList(),
              onChanged: (v) =>
                  setState(() => _serviceType = v ?? 'non_consumable'),
            ),
            const SizedBox(height: 12),
            DropdownButtonFormField<int?>(
              initialValue: _branchId,
              isExpanded: true,
              decoration: const InputDecoration(
                  labelText: 'Branch',
                  helperText: 'Leave as All Branches for a global item'),
              items: [
                const DropdownMenuItem<int?>(
                    value: null, child: Text('All Branches')),
                ...widget.branches.map((b) => DropdownMenuItem<int?>(
                      value: b['id'] is int
                          ? b['id'] as int
                          : int.tryParse('${b['id']}'),
                      child: Text('${b['name']}'),
                    )),
              ],
              onChanged: (v) => setState(() => _branchId = v),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel')),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save'),
        ),
      ],
    );
  }
}
