import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/branch_storekeeper_repository.dart';
import 'record_spoilage_screen.dart';

/// Store Stocktake — Branch Storekeeper. Physical count vs system quantity
/// for every general store item (everything that isn't bar stock or the
/// fixed kitchen-counter items): foodstuffs, stationery, non_consumables.
/// Submit-only here; approve/reject is accountant-only.
class StoreStocktakeScreen extends ConsumerStatefulWidget {
  const StoreStocktakeScreen({super.key});

  @override
  ConsumerState<StoreStocktakeScreen> createState() => _StoreStocktakeScreenState();
}

class _StoreStocktakeScreenState extends ConsumerState<StoreStocktakeScreen> {
  late Future<_StoreStocktakeData> _future = _load();
  final Map<String, TextEditingController> _controllers = {};
  final TextEditingController _searchCtrl = TextEditingController();
  String _search = '';
  bool _submitting = false;
  final today = DateFormat('yyyy-MM-dd').format(DateTime.now());

  Future<_StoreStocktakeData> _load() async {
    final repo = ref.read(branchStorekeeperRepositoryProvider);
    final items = await repo.storeStocktakeRecords(date: today);
    final submitted = items.isNotEmpty && items.first['physical_quantity'] != null;
    return _StoreStocktakeData(submitted: submitted, items: items);
  }

  TextEditingController _ctrlFor(String itemId) =>
      _controllers.putIfAbsent(itemId, () => TextEditingController());

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit(List<Map<String, dynamic>> candidates) async {
    final items = <Map<String, dynamic>>[];
    for (final item in candidates) {
      final itemId = '${item['id']}';
      final ctrl = _controllers[itemId];
      final physical = double.tryParse(ctrl?.text.trim() ?? '');
      if (physical == null) continue;
      items.add({'item_id': itemId, 'physical_quantity': physical});
    }
    if (items.isEmpty) {
      _notify(context, 'Enter at least one physical count');
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(branchStorekeeperRepositoryProvider).submitStoreStocktake(
            items: items,
            stocktakeDate: today,
          );
      if (mounted) {
        _notify(context, 'Stocktake submitted for accountant review');
        setState(() => _future = _load());
      }
    } catch (e) {
      if (mounted) _notify(context, 'Submit failed: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Store Stocktake'),
        actions: [
          IconButton(
            tooltip: 'Record Spoilage',
            icon: const Icon(Icons.report_problem_outlined),
            onPressed: () => Navigator.push(
              context,
              MaterialPageRoute(
                builder: (_) => const RecordSpoilageScreen(initialArea: 'store'),
              ),
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text('Stocktake date: $today',
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          Expanded(
            child: FutureBuilder<_StoreStocktakeData>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snap.hasError) {
                  return Center(child: Text('Failed to load: ${snap.error}'));
                }
                final data = snap.data!;
                if (data.submitted) {
                  return _submittedView(data.items);
                }
                return _candidatesView(data.items);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _submittedView(List<Map<String, dynamic>> items) {
    final negativeVariance = items
        .where((i) => _num(i['variance']) < 0)
        .fold<num>(0, (sum, i) => sum + _num(i['variance']).abs());
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: Colors.amber.shade50,
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Text('⏳ Pending Accountant Review',
              style: TextStyle(color: Colors.amber, fontWeight: FontWeight.w800)),
        ),
        const SizedBox(height: 12),
        Text(
          'Items with shortage: ${items.where((i) => _num(i['variance']) < 0).length} · Total shortage units: ${negativeVariance.toStringAsFixed(1)}',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 12),
        for (final item in items)
          ListTile(
            title: Text('${item['item_name'] ?? item['item_id']}'),
            subtitle: Text(
                'System: ${item['system_quantity']} · Physical: ${item['physical_quantity']}'),
            trailing: Text(
              '${_num(item['variance']) >= 0 ? '+' : ''}${item['variance']}',
              style: TextStyle(
                color: _num(item['variance']) < 0 ? Colors.red : Colors.green,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
      ],
    );
  }

  Widget _candidatesView(List<Map<String, dynamic>> allCandidates) {
    final filtered = _search.isEmpty
        ? allCandidates
        : allCandidates
            .where((c) => '${c['name'] ?? ''}'.toLowerCase().contains(_search.toLowerCase()))
            .toList();

    // Group by category for readability (foodstuffs/stationery/non_consumables
    // mix together otherwise — this list runs ~200+ items).
    final byCategory = <String, List<Map<String, dynamic>>>{};
    for (final item in filtered) {
      final cat = '${item['category'] ?? 'Other'}';
      byCategory.putIfAbsent(cat, () => []).add(item);
    }
    final categories = byCategory.keys.toList()..sort();

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: TextField(
            controller: _searchCtrl,
            decoration: const InputDecoration(
              isDense: true,
              prefixIcon: Icon(Icons.search, size: 18),
              hintText: 'Search items…',
              border: OutlineInputBorder(),
            ),
            onChanged: (v) => setState(() => _search = v),
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          child: Row(
            children: [
              Expanded(flex: 2, child: Text('ITEM', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12))),
              Expanded(child: Text('SYSTEM', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12))),
              Expanded(child: Text('PHYSICAL', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12))),
              Expanded(child: Text('VAR', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12))),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            itemCount: categories.length,
            itemBuilder: (context, catIndex) {
              final cat = categories[catIndex];
              final items = byCategory[cat]!;
              return ExpansionTile(
                title: Text(cat, style: const TextStyle(fontWeight: FontWeight.w800)),
                subtitle: Text('${items.length} items'),
                initiallyExpanded: categories.length <= 3,
                children: [for (final item in items) _itemRow(item)],
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _submitting ? null : () => _submit(allCandidates),
              child: Text(_submitting ? 'Submitting…' : 'Submit Stocktake'),
            ),
          ),
        ),
      ],
    );
  }

  Widget _itemRow(Map<String, dynamic> item) {
    final ctrl = _ctrlFor('${item['id']}');
    final system = _num(item['quantity']);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(flex: 2, child: Text('${item['name'] ?? 'Item'}')),
          Expanded(
            child: Text('Sys: $system',
                style: const TextStyle(color: AppColors.kTextSecondary, fontSize: 12)),
          ),
          Expanded(
            child: TextField(
              controller: ctrl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(isDense: true, hintText: 'Physical'),
              onChanged: (_) => setState(() {}),
            ),
          ),
          Expanded(
            child: Builder(builder: (context) {
              final physical = double.tryParse(ctrl.text.trim());
              if (physical == null) return const Text('—');
              final variance = physical - system;
              return Text(
                '${variance >= 0 ? '+' : ''}${variance.toStringAsFixed(1)}',
                style: TextStyle(
                  color: variance < 0 ? Colors.red : Colors.green,
                  fontWeight: FontWeight.w700,
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}

class _StoreStocktakeData {
  const _StoreStocktakeData({required this.submitted, required this.items});
  final bool submitted;
  final List<Map<String, dynamic>> items;
}

num _num(dynamic v) => v is num ? v : num.tryParse('${v ?? 0}') ?? 0;

void _notify(BuildContext context, String message) {
  AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
}
