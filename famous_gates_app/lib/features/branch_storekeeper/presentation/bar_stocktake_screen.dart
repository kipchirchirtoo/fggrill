import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../../../core/widgets/kes_text.dart';
import '../data/branch_storekeeper_repository.dart';

const _kBarLocations = [
  ('main_bar', 'Main Bar'),
  ('executive_bar', 'Executive Bar'),
];

/// Bar Stocktake — Branch Storekeeper. Submit-only here; approve/reject is
/// accountant-only (see BarStocktakeReviewScreen in branch_accountant).
class BarStocktakeScreen extends ConsumerStatefulWidget {
  const BarStocktakeScreen({super.key});

  @override
  ConsumerState<BarStocktakeScreen> createState() =>
      _BarStocktakeScreenState();
}

class _BarStocktakeScreenState extends ConsumerState<BarStocktakeScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController =
      TabController(length: 2, vsync: this);
  final today = DateFormat('yyyy-MM-dd').format(DateTime.now());

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Bar Stocktake'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [Tab(text: 'Main Bar'), Tab(text: 'Executive Bar')],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text('Stocktake date: $today',
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _BarLocationStocktake(barLocation: 'main_bar', date: today),
                _BarLocationStocktake(
                    barLocation: 'executive_bar', date: today),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BarLocationStocktake extends ConsumerStatefulWidget {
  const _BarLocationStocktake({required this.barLocation, required this.date});
  final String barLocation;
  final String date;

  @override
  ConsumerState<_BarLocationStocktake> createState() =>
      _BarLocationStocktakeState();
}

class _BarLocationStocktakeState
    extends ConsumerState<_BarLocationStocktake> {
  late Future<_BarStocktakeData> _future = _load();
  final Map<String, TextEditingController> _controllers = {};
  bool _submitting = false;

  Future<_BarStocktakeData> _load() async {
    final repo = ref.read(branchStorekeeperRepositoryProvider);
    final existing = await repo.barStocktakeRecords(
      barLocation: widget.barLocation,
      date: widget.date,
    );
    if (existing.isNotEmpty) {
      return _BarStocktakeData(submitted: true, items: existing);
    }
    final candidates = await repo.branchStock();
    return _BarStocktakeData(submitted: false, items: candidates);
  }

  TextEditingController _ctrlFor(String itemId) =>
      _controllers.putIfAbsent(itemId, () => TextEditingController());

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
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
      await ref.read(branchStorekeeperRepositoryProvider).submitBarStocktake(
            barLocation: widget.barLocation,
            items: items,
            stocktakeDate: widget.date,
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
    return FutureBuilder<_BarStocktakeData>(
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
          final negativeVariance = data.items
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
                    style: TextStyle(
                        color: Colors.amber, fontWeight: FontWeight.w800)),
              ),
              const SizedBox(height: 12),
              Text(
                  'Items with shortage: ${data.items.where((i) => _num(i['variance']) < 0).length} · Total shortage value: ',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              KesText(negativeVariance,
                  style: const TextStyle(
                      color: Colors.red, fontWeight: FontWeight.w800)),
              const SizedBox(height: 12),
              for (final item in data.items)
                ListTile(
                  title: Text('${item['item_name'] ?? item['item_id']}'),
                  subtitle: Text(
                      'System: ${item['system_quantity']} · Physical: ${item['physical_quantity']}'),
                  trailing: Text(
                    '${_num(item['variance']) >= 0 ? '+' : ''}${item['variance']}',
                    style: TextStyle(
                      color:
                          _num(item['variance']) < 0 ? Colors.red : Colors.green,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
            ],
          );
        }

        final candidates = data.items;
        return Column(
          children: [
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: candidates.length,
                itemBuilder: (context, i) {
                  final item = candidates[i];
                  final ctrl = _ctrlFor('${item['id']}');
                  final system = _num(item['quantity']);
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(
                      children: [
                        Expanded(
                            flex: 2, child: Text('${item['name'] ?? 'Item'}')),
                        Expanded(
                          child: Text('Sys: $system',
                              style: const TextStyle(
                                  color: AppColors.kTextSecondary,
                                  fontSize: 12)),
                        ),
                        Expanded(
                          child: TextField(
                            controller: ctrl,
                            keyboardType: const TextInputType.numberWithOptions(
                                decimal: true),
                            decoration: const InputDecoration(
                                isDense: true, hintText: 'Physical'),
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
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _submitting ? null : () => _submit(candidates),
                  child:
                      Text(_submitting ? 'Submitting…' : 'Submit Stocktake'),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _BarStocktakeData {
  const _BarStocktakeData({required this.submitted, required this.items});
  final bool submitted;
  final List<Map<String, dynamic>> items;
}

num _num(dynamic v) => v is num ? v : num.tryParse('${v ?? 0}') ?? 0;

void _notify(BuildContext context, String message) {
  AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
}
