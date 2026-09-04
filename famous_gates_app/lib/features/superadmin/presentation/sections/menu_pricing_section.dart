import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

import '../../../../core/services/services.dart';
import '../../../../core/utils/api_error_message.dart';
import '../../../../core/widgets/app_notifier.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../menu_pricing/data/menu_pricing_repository.dart';
import '../../../menu_pricing/domain/menu_pricing_providers.dart';

final _branchesProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) {
  return ref.read(systemServiceProvider).getBranches();
});

List<Map<String, dynamic>> _branchRows(Map<String, dynamic> response) {
  final data = response['data'];
  final list = data is List
      ? data
      : (data is Map && data['data'] is List ? data['data'] as List : const []);
  return list.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList();
}

/// SuperAdmin: per-branch cost price + selling price for every restaurant and
/// bar menu item. Feeds branch accountant analysis and director profitability.
class MenuPricingSection extends ConsumerStatefulWidget {
  const MenuPricingSection({super.key});

  @override
  ConsumerState<MenuPricingSection> createState() => _MenuPricingSectionState();
}

class _MenuPricingSectionState extends ConsumerState<MenuPricingSection> {
  int? _branchId;
  String _type = 'all'; // all | restaurant | bar
  String _search = '';
  bool _saving = false;

  // key -> pending edit (cost, selling). selling null = inherit base.
  final Map<String, ({double cost, double? selling})> _pending = {};

  BranchPricingArgs? get _args {
    if (_branchId == null) return null;
    return (branchId: _branchId!, type: _type == 'all' ? null : _type);
  }

  void _onRowChanged(String key, double cost, double? selling) {
    _pending[key] = (cost: cost, selling: selling);
    setState(() {});
  }

  Future<void> _saveAll() async {
    if (_branchId == null || _pending.isEmpty) return;
    setState(() => _saving = true);
    try {
      final items = _pending.entries.map((e) {
        final parts = e.key.split(':');
        return {
          'item_type': parts.first,
          'item_id': parts.sublist(1).join(':'),
          'cost_price': e.value.cost,
          'selling_price': e.value.selling,
        };
      }).toList();
      final saved = await ref.read(menuPricingRepositoryProvider).saveBulk(_branchId!, items);
      if (!mounted) return;
      setState(() => _pending.clear());
      ref.invalidate(branchPricingProvider(_args!));
      AppNotifier.showSnackBar(
        context,
        SnackBar(content: Text('Saved $saved item price${saved == 1 ? '' : 's'}')),
      );
    } catch (e) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(content: Text(apiErrorMessage(e, fallback: 'Save failed'))),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _resetItem(BranchMenuItemPricing item) async {
    if (_branchId == null) return;
    try {
      await ref.read(menuPricingRepositoryProvider).resetItem(_branchId!, item.itemType, item.itemId);
      if (!mounted) return;
      _pending.remove(item.key);
      ref.invalidate(branchPricingProvider(_args!));
      AppNotifier.showSnackBar(
        context,
        const SnackBar(content: Text('Reverted to base price')),
      );
    } catch (e) {
      if (!mounted) return;
      AppNotifier.showSnackBar(
        context,
        SnackBar(content: Text(apiErrorMessage(e, fallback: 'Reset failed'))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final branchesAsync = ref.watch(_branchesProvider);
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header(),
          const SizedBox(height: 16),
          _controls(branchesAsync),
          const SizedBox(height: 12),
          Expanded(
            child: _branchId == null
                ? _emptyHint('Select a branch to manage its menu cost & selling prices.')
                : _pricingList(),
          ),
        ],
      ),
    );
  }

  Widget _header() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Menu Pricing & Cost',
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(
                'Set the cost price and selling price of each restaurant & bar item per branch. '
                'Cost feeds profit analysis in the Branch Accountant and Director modules.',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.grey[600]),
              ),
            ],
          ),
        ),
        if (_pending.isNotEmpty)
          FilledButton.icon(
            onPressed: _saving ? null : _saveAll,
            icon: _saving
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : Icon(PhosphorIcons.check()),
            label: Text(_saving ? 'Saving…' : 'Save ${_pending.length} change${_pending.length == 1 ? '' : 's'}'),
          ),
      ],
    );
  }

  Widget _controls(AsyncValue<Map<String, dynamic>> branchesAsync) {
    final rows = branchesAsync.maybeWhen(data: _branchRows, orElse: () => const <Map<String, dynamic>>[]);
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        SizedBox(
          width: 240,
          child: DropdownButtonFormField<int?>(
            initialValue: _branchId,
            decoration: const InputDecoration(labelText: 'Branch', border: OutlineInputBorder(), isDense: true),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text('Select branch…')),
              ...rows.map((b) => DropdownMenuItem<int?>(
                    value: int.tryParse('${b['id']}'),
                    child: Text('${b['name'] ?? 'Branch'}', overflow: TextOverflow.ellipsis),
                  )),
            ],
            onChanged: (v) => setState(() {
              _branchId = v;
              _pending.clear();
            }),
          ),
        ),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'all', label: Text('All')),
            ButtonSegment(value: 'restaurant', label: Text('Restaurant')),
            ButtonSegment(value: 'bar', label: Text('Bar')),
            ButtonSegment(value: 'non_consumables', label: Text('Non-Consumables')),
          ],
          selected: {_type},
          onSelectionChanged: (s) => setState(() {
            _type = s.first;
            _pending.clear();
          }),
        ),
        SizedBox(
          width: 240,
          child: TextField(
            decoration: InputDecoration(
              labelText: 'Search item',
              prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 18),
              border: const OutlineInputBorder(),
              isDense: true,
            ),
            onChanged: (v) => setState(() => _search = v.trim().toLowerCase()),
          ),
        ),
      ],
    );
  }

  Widget _pricingList() {
    // _pricingList is only called from build when _branchId != null,
    // so _args is guaranteed non-null here.
    final args = _args!;
    final async = ref.watch(branchPricingProvider(args));
    return async.when(
      loading: () => const LoadingSkeleton(),
      error: (e, _) => ErrorState(
        message: apiErrorMessage(e, fallback: 'Could not load pricing'),
        onRetry: () => ref.invalidate(branchPricingProvider(args)),
      ),
      data: (result) {
        var items = result.items;
        if (_search.isNotEmpty) {
          items = items
              .where((i) =>
                  i.name.toLowerCase().contains(_search) ||
                  (i.category ?? '').toLowerCase().contains(_search))
              .toList();
        }
        if (items.isEmpty) {
          return _emptyHint('No menu items match.');
        }
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _summaryBar(result.summary),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.separated(
                itemCount: items.length,
                separatorBuilder: (_, __) => const SizedBox(height: 8),
                itemBuilder: (_, i) => _PricingRow(
                  key: ValueKey('${_branchId}_${items[i].key}'),
                  item: items[i],
                  onChanged: _onRowChanged,
                  onReset: () => _resetItem(items[i]),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _summaryBar(Map<String, dynamic> s) {
    String n(String k) => '${s[k] ?? 0}';
    return Wrap(
      spacing: 16,
      runSpacing: 8,
      children: [
        _stat('Items', n('total_items')),
        _stat('Branch overrides', n('with_override')),
        _stat('Costed', n('costed_items')),
        _stat('Avg margin', '${s['avg_margin_pct'] ?? 0}%'),
      ],
    );
  }

  Widget _stat(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.blueGrey.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text('$label: ', style: const TextStyle(fontSize: 12, color: Colors.grey)),
        Text(value, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
      ]),
    );
  }

  Widget _emptyHint(String text) {
    return Center(
      child: Text(text, style: TextStyle(color: Colors.grey[600])),
    );
  }
}

class _PricingRow extends StatefulWidget {
  const _PricingRow({
    super.key,
    required this.item,
    required this.onChanged,
    required this.onReset,
  });

  final BranchMenuItemPricing item;
  final void Function(String key, double cost, double? selling) onChanged;
  final VoidCallback onReset;

  @override
  State<_PricingRow> createState() => _PricingRowState();
}

class _PricingRowState extends State<_PricingRow> {
  late final TextEditingController _cost;
  late final TextEditingController _selling;

  @override
  void initState() {
    super.initState();
    final it = widget.item;
    _cost = TextEditingController(
      text: it.overrideCost != null
          ? _fmt(it.overrideCost!)
          : (it.baseCost > 0 ? _fmt(it.baseCost) : ''),
    );
    _selling = TextEditingController(
      text: it.overrideSelling != null ? _fmt(it.overrideSelling!) : '',
    );
  }

  @override
  void dispose() {
    _cost.dispose();
    _selling.dispose();
    super.dispose();
  }

  static String _fmt(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toStringAsFixed(2);

  double get _costVal => double.tryParse(_cost.text.trim()) ?? 0;
  double? get _sellVal {
    final t = _selling.text.trim();
    if (t.isEmpty) return null;
    return double.tryParse(t);
  }

  double get _effSelling => _sellVal ?? widget.item.basePrice;
  double get _margin => _effSelling - _costVal;
  double get _marginPct => _effSelling > 0 ? (_margin / _effSelling) * 100 : 0;

  void _emit() {
    widget.onChanged(widget.item.key, _costVal, _sellVal);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final it = widget.item;
    final marginColor = _margin < 0
        ? Colors.red
        : (_marginPct < 15 ? Colors.orange[800]! : Colors.green[700]!);
    final isNonConsumable = it.itemType == 'non_consumables' || it.itemType == 'non-consumables';
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: Colors.grey.withValues(alpha: 0.25)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: (it.itemType == 'bar'
                        ? Colors.purple
                        : isNonConsumable
                            ? Colors.blueGrey
                            : Colors.teal)
                    .withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                it.itemType == 'bar'
                    ? 'BAR'
                    : isNonConsumable
                        ? 'NON-CONSUMABLES'
                        : 'FOOD',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: it.itemType == 'bar'
                      ? Colors.purple
                      : isNonConsumable
                          ? Colors.blueGrey[800]
                          : Colors.teal,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              flex: 3,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(it.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  Text(
                    '${it.category ?? 'Uncategorised'}  ·  base ${_fmt(it.basePrice)}'
                    '${it.hasOverride ? '  ·  overridden' : ''}',
                    style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            _field(_cost, 'Cost', 'buy'),
            const SizedBox(width: 8),
            _field(_selling, 'Selling', _fmt(it.basePrice)),
            const SizedBox(width: 10),
            SizedBox(
              width: 78,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(_fmt(_margin), style: TextStyle(fontWeight: FontWeight.bold, color: marginColor)),
                  Text('${_marginPct.toStringAsFixed(0)}%',
                      style: TextStyle(fontSize: 11, color: marginColor)),
                ],
              ),
            ),
            IconButton(
              tooltip: 'Revert to base price',
              onPressed: it.hasOverride ? widget.onReset : null,
              icon: Icon(PhosphorIcons.arrowsClockwise(), size: 18),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(TextEditingController c, String label, String hint) {
    return SizedBox(
      width: 96,
      child: TextField(
        controller: c,
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))],
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          isDense: true,
          border: const OutlineInputBorder(),
          contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        ),
        onChanged: (_) => _emit(),
      ),
    );
  }
}
