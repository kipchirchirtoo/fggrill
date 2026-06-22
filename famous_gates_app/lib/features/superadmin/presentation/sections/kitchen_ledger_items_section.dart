import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../domain/superadmin_providers.dart';

/// Controls which `inventory_items` are tracked on the kitchen ledger for a
/// branch. Toggling ON calls `addKitchenLedgerItem`, toggling OFF calls
/// `removeKitchenLedgerItem`. branch_id is sent as int, item_id as the
/// inventory_items UUID string.
class KitchenLedgerItemsSection extends ConsumerStatefulWidget {
  const KitchenLedgerItemsSection({super.key});

  @override
  ConsumerState<KitchenLedgerItemsSection> createState() =>
      _KitchenLedgerItemsSectionState();
}

class _KitchenLedgerItemsSectionState
    extends ConsumerState<KitchenLedgerItemsSection> {
  List<Map<String, dynamic>> _branches = [];
  List<Map<String, dynamic>> _items = [];
  // item_id -> kitchen_ledger_items.id
  Map<String, String> _enabled = {};
  int? _branchId;
  final Set<String> _busyItemIds = {};
  String _search = '';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _init());
  }

  Future<void> _init() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(superadminGodRepositoryProvider);
      final branches = await repo.getBranches();
      final items = await repo.getInventoryItems();
      if (!mounted) return;
      setState(() {
        _branches = branches;
        _items = items;
        _branchId ??= branches.isNotEmpty
            ? (branches.first['id'] is int
                ? branches.first['id'] as int
                : int.tryParse('${branches.first['id']}'))
            : null;
      });
      await _loadLedger();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Future<void> _loadLedger() async {
    if (_branchId == null) {
      setState(() {
        _enabled = {};
        _loading = false;
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final repo = ref.read(superadminGodRepositoryProvider);
      final ledger = await repo.getKitchenLedgerItems(branchId: _branchId);
      if (!mounted) return;
      setState(() {
        _enabled = {
          for (final row in ledger) '${row['item_id']}': '${row['id']}',
        };
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _toggle(Map<String, dynamic> item, bool turnOn) async {
    final itemId = '${item['id']}';
    final branchId = _branchId;
    if (branchId == null) return;
    setState(() => _busyItemIds.add(itemId));
    try {
      final repo = ref.read(superadminGodRepositoryProvider);
      if (turnOn) {
        await repo.addKitchenLedgerItem(branchId: branchId, itemId: itemId);
      } else {
        final ledgerId = _enabled[itemId];
        if (ledgerId != null) {
          await repo.removeKitchenLedgerItem(ledgerId);
        }
      }
      await _loadLedger();
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(
              content: Text(turnOn
                  ? '${item['name']} added to kitchen ledger'
                  : '${item['name']} removed from kitchen ledger')),
        );
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Failed: $e')));
      }
    } finally {
      if (mounted) setState(() => _busyItemIds.remove(itemId));
    }
  }

  String _branchName(dynamic id) {
    final match = _branches.firstWhere(
      (b) => '${b['id']}' == '$id',
      orElse: () => const {},
    );
    return (match['name'] ?? 'Branch $id').toString();
  }

  List<Map<String, dynamic>> get _filteredItems {
    if (_search.trim().isEmpty) return _items;
    final q = _search.trim().toLowerCase();
    return _items
        .where((i) => '${i['name']}'.toLowerCase().contains(q))
        .toList();
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
          else if (_branchId == null)
            _emptyBranchesState()
          else if (_filteredItems.isEmpty)
            _emptyItemsState()
          else
            _buildTable(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        Icon(PhosphorIcons.cookingPot(), color: AppColors.kPrimary, size: 28),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Kitchen Ledger Items',
                  style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: AppColors.kTextPrimary)),
              Text(
                  'Choose which inventory items are tracked on the kitchen production ledger, per branch.',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600)),
            ],
          ),
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
          value: _branchId,
          hint: const Text('Select Branch'),
          items: _branches
              .map((b) => DropdownMenuItem<int?>(
                    value: b['id'] is int
                        ? b['id'] as int
                        : int.tryParse('${b['id']}'),
                    child: Text('${b['name']}'),
                  ))
              .toList(),
          onChanged: (v) {
            setState(() => _branchId = v);
            _loadLedger();
          },
        ),
        const SizedBox(width: 20),
        Expanded(
          child: TextField(
            decoration: InputDecoration(
              hintText: 'Search items…',
              prefixIcon: const Icon(Icons.search, size: 20),
              isDense: true,
              contentPadding:
                  const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onChanged: (v) => setState(() => _search = v),
          ),
        ),
        const SizedBox(width: 10),
        IconButton(
          tooltip: 'Refresh',
          onPressed: _loadLedger,
          icon: const Icon(Icons.refresh),
        ),
      ],
    );
  }

  Widget _buildTable() {
    final filtered = _filteredItems;
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Row(
              children: [
                Text(
                  '${_enabled.length} of ${_items.length} items on the kitchen ledger for ${_branchName(_branchId)}',
                  style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          for (final item in filtered) _itemTile(item),
        ],
      ),
    );
  }

  Widget _itemTile(Map<String, dynamic> item) {
    final itemId = '${item['id']}';
    final isOn = _enabled.containsKey(itemId);
    final busy = _busyItemIds.contains(itemId);
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
        child: Icon(PhosphorIcons.package(), color: AppColors.kPrimary, size: 18),
      ),
      title: Text('${item['name']}',
          style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Text('${item['unit'] ?? ''}',
          style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
      trailing: busy
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2))
          : Switch(
              value: isOn,
              onChanged: (v) => _toggle(item, v),
              activeColor: AppColors.kPrimary,
            ),
    );
  }

  Widget _emptyItemsState() => Container(
        padding: const EdgeInsets.all(48),
        alignment: Alignment.center,
        child: Column(children: [
          Icon(PhosphorIcons.package(), size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text('No inventory items match this search',
              style: TextStyle(color: Colors.grey.shade600)),
        ]),
      );

  Widget _emptyBranchesState() => Container(
        padding: const EdgeInsets.all(48),
        alignment: Alignment.center,
        child: Text('No branches available',
            style: TextStyle(color: Colors.grey.shade600)),
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
            onPressed: _loadLedger,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ]),
      );
}
