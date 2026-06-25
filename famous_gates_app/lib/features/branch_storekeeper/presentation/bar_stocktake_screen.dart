import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../../../core/widgets/kes_text.dart';
import '../data/branch_storekeeper_repository.dart';
import 'record_spoilage_screen.dart';

/// Bar Stocktake — Branch Storekeeper.
///
/// The storekeeper only records the physical (closing) count.
/// Opening, additions, and sales are system-calculated:
///   opening = previous stocktake's physical count
///   additions = restock/dispatch from bar_stock_ledger during the last
///               closed cashier shift at this bar (not calendar day — a
///               stocktake follows shift handover, so sales must be scoped
///               to that shift, not "today so far")
///   sales = POS bar sales from bar_stock_ledger, same shift window
///   system = opening + additions - sales
///   variance = physical - system
/// A reason for variance is required whenever variance is non-zero.
class BarStocktakeScreen extends ConsumerStatefulWidget {
  const BarStocktakeScreen({super.key});

  @override
  ConsumerState<BarStocktakeScreen> createState() =>
      _BarStocktakeScreenState();
}

class _BarStocktakeScreenState extends ConsumerState<BarStocktakeScreen> {
  final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
  Future<int?>? _branchIdFuture;

  @override
  Widget build(BuildContext context) {
    // Lazy-init (rather than initState) so a hot-reloaded build on an
    // already-mounted instance still works.
    _branchIdFuture ??=
        ref.read(branchStorekeeperRepositoryProvider).currentBranchId();
    return FutureBuilder<int?>(
      future: _branchIdFuture,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Scaffold(
              body: Center(child: CircularProgressIndicator()));
        }
        // Only Kyogong (branch 1) has a separate Executive Bar outlet —
        // every other branch has just one bar.
        final hasExecutiveBar = snap.data == 1;
        return _BarStocktakeTabs(
            today: today, hasExecutiveBar: hasExecutiveBar);
      },
    );
  }
}

class _BarStocktakeTabs extends StatefulWidget {
  const _BarStocktakeTabs({required this.today, required this.hasExecutiveBar});
  final String today;
  final bool hasExecutiveBar;

  @override
  State<_BarStocktakeTabs> createState() => _BarStocktakeTabsState();
}

class _BarStocktakeTabsState extends State<_BarStocktakeTabs>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController = TabController(
    length: widget.hasExecutiveBar ? 2 : 1,
    vsync: this,
  );

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
        actions: [
          IconButton(
            tooltip: 'Record Spoilage',
            icon: const Icon(Icons.report_problem_outlined),
            onPressed: () {
              final barLocation =
                  widget.hasExecutiveBar && _tabController.index == 1
                      ? 'executive_bar'
                      : 'main_bar';
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => RecordSpoilageScreen(
                    initialArea: 'bar',
                    initialBarLocation: barLocation,
                  ),
                ),
              );
            },
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            const Tab(text: 'Main Bar'),
            if (widget.hasExecutiveBar) const Tab(text: 'Executive Bar'),
          ],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text('Stocktake date: ${widget.today}',
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _BarLocationStocktake(barLocation: 'main_bar', date: widget.today),
                if (widget.hasExecutiveBar)
                  _BarLocationStocktake(
                      barLocation: 'executive_bar', date: widget.today),
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

  final Map<String, TextEditingController> _physicalCtrls = {};
  final Map<String, TextEditingController> _reasonCtrls = {};
  bool _submitting = false;

  Future<_BarStocktakeData> _load() async {
    final repo = ref.read(branchStorekeeperRepositoryProvider);
    final items = await repo.barStocktakeRecords(
      barLocation: widget.barLocation,
      date: widget.date,
    );
    // Backend returns stocktake records (with physical_quantity) when
    // submitted, or bar-drink candidates (with name/quantity) when not.
    final submitted = items.isNotEmpty && items.first['physical_quantity'] != null;
    return _BarStocktakeData(submitted: submitted, items: items);
  }

  TextEditingController _ctrlFor(
      Map<String, TextEditingController> map, String key,
      [String? initialValue]) {
    return map.putIfAbsent(key, () {
      final ctrl = TextEditingController();
      if (initialValue != null && initialValue.isNotEmpty) {
        ctrl.text = initialValue;
      }
      return ctrl;
    });
  }

  @override
  void dispose() {
    for (final c in _physicalCtrls.values) {
      c.dispose();
    }
    for (final c in _reasonCtrls.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit(List<Map<String, dynamic>> candidates) async {
    final items = <Map<String, dynamic>>[];
    final missingReasons = <String>[];

    for (final item in candidates) {
      final itemId = '${item['id']}';
      final physical = double.tryParse(_physicalCtrls[itemId]?.text.trim() ?? '');
      if (physical == null) continue;

      final system = _num(item['opening_stock']) + _num(item['additions']) - _num(item['sales']);
      final variance = physical - system;
      final hasVariance = variance.abs() > 0.0001;

      if (hasVariance) {
        final reason = _reasonCtrls[itemId]?.text.trim() ?? '';
        if (reason.isEmpty) {
          missingReasons.add('${item['name'] ?? 'Item'} (variance: ${variance.toStringAsFixed(1)})');
          continue;
        }
      }

      items.add({
        'item_id': itemId,
        'physical_quantity': physical,
        if (hasVariance) 'reason_for_variance': _reasonCtrls[itemId]?.text.trim(),
      });
    }

    if (missingReasons.isNotEmpty) {
      _notify(context, 'Reason for variance required for:\n${missingReasons.join('\n')}');
      return;
    }

    if (items.isEmpty) {
      _notify(context, 'Enter physical count for at least one item');
      return;
    }

    setState(() => _submitting = true);
    try {
      await ref.read(branchStorekeeperRepositoryProvider).submitBarStocktake(
            barLocation: widget.barLocation,
            items: items,
            stocktakeDate: widget.date,
            shiftId: candidates.isNotEmpty ? '${candidates.first['shift_id'] ?? ''}' : null,
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
          return _SubmittedView(items: data.items);
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
                  final itemId = '${item['id']}';

                  final physicalCtrl = _ctrlFor(
                    _physicalCtrls,
                    itemId,
                  );
                  final reasonCtrl = _ctrlFor(_reasonCtrls, itemId);

                  return StatefulBuilder(
                    builder: (context, setTileState) {
                      final physical = double.tryParse(physicalCtrl.text.trim());
                      final system = _num(item['opening_stock']) + _num(item['additions']) - _num(item['sales']);
                      final variance = physical != null ? physical - system : null;
                      final hasVariance = variance != null && variance.abs() > 0.0001;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${item['name'] ?? 'Item'}',
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w800)),
                              const SizedBox(height: 10),
                              Wrap(
                                spacing: 12,
                                runSpacing: 4,
                                children: [
                                  _ReadOnlyChip(
                                    label: 'Opening',
                                    value: _fmt(item['opening_stock'] ?? 0),
                                  ),
                                  _ReadOnlyChip(
                                    label: 'Additions',
                                    value: _fmt(item['additions'] ?? 0),
                                  ),
                                  _ReadOnlyChip(
                                    label: 'Sales',
                                    value: _fmt(item['sales'] ?? 0),
                                  ),
                                  _ReadOnlyChip(
                                    label: 'System',
                                    value: _fmt(system),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  Expanded(
                                    child: _NumberField(
                                      label: 'Physical',
                                      hint: 'Actual count',
                                      controller: physicalCtrl,
                                      onChanged: () => setTileState(() {}),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text('System: ${_fmt(system)}',
                                            style: const TextStyle(
                                                fontSize: 12,
                                                color: AppColors
                                                    .kTextSecondary)),
                                        if (variance != null)
                                          Text(
                                            'Variance: ${variance >= 0 ? '+' : ''}${variance.toStringAsFixed(1)}',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w800,
                                              color: variance < 0
                                                  ? Colors.red
                                                  : Colors.green,
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              if (hasVariance) ...[
                                const SizedBox(height: 10),
                                TextField(
                                  controller: reasonCtrl,
                                  minLines: 1,
                                  maxLines: 3,
                                  decoration: const InputDecoration(
                                    labelText: 'Reason for variance *',
                                    hintText: 'e.g. breakage, spillage, free drinks',
                                    isDense: true,
                                    border: OutlineInputBorder(),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
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
                  child: Text(_submitting ? 'Submitting…' : 'Submit Stocktake'),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ReadOnlyChip extends StatelessWidget {
  const _ReadOnlyChip({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Text(
        '$label: $value',
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _SubmittedView extends StatelessWidget {
  const _SubmittedView({required this.items});
  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) {
    final negativeVariance = items
        .where((i) => _num(i['variance']) < 0)
        .fold<num>(0, (sum, i) => sum + _num(i['variance']).abs());

    final statuses = items.map((i) => '${i['status'] ?? ''}').toSet();
    final allApproved = statuses.every((s) => s == 'approved');
    final anyRejected = statuses.contains('rejected');
    final statusLabel = allApproved
        ? '✓ Approved by Accountant'
        : anyRejected
            ? '✗ Rejected by Accountant'
            : '⏳ Pending Accountant Review';
    final statusColor = allApproved
        ? Colors.green
        : anyRejected
            ? Colors.red
            : Colors.amber;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: statusColor.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(statusLabel,
              style: TextStyle(
                  color: statusColor, fontWeight: FontWeight.w800)),
        ),
        const SizedBox(height: 12),
        Text(
            'Items with shortage: ${items.where((i) => _num(i['variance']) < 0).length} · Total shortage value: ',
            style: const TextStyle(fontWeight: FontWeight.w700)),
        KesText(negativeVariance,
            style: const TextStyle(
                color: Colors.red, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        for (final item in items)
          ListTile(
            title: Text('${item['item_name'] ?? item['item_id']}'),
            subtitle: Text(
              'Open: ${item['opening_stock'] ?? 0} · Add: ${item['additions'] ?? 0} · Sales: ${item['sales'] ?? 0} · '
              'Sys: ${item['system_quantity']} · Phys: ${item['physical_quantity']}',
              style: const TextStyle(fontSize: 12),
            ),
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
}

class _NumberField extends StatelessWidget {
  const _NumberField({
    required this.label,
    required this.hint,
    required this.controller,
    required this.onChanged,
  });

  final String label;
  final String hint;
  final TextEditingController controller;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        isDense: true,
        border: const OutlineInputBorder(),
      ),
      onChanged: (_) => onChanged(),
    );
  }
}

class _BarStocktakeData {
  const _BarStocktakeData({required this.submitted, required this.items});
  final bool submitted;
  final List<Map<String, dynamic>> items;
}

num _num(dynamic v) => v is num ? v : num.tryParse('${v ?? 0}') ?? 0;

String _fmt(dynamic v) {
  final n = _num(v);
  return n == n.toInt() ? n.toInt().toString() : n.toStringAsFixed(2);
}

void _notify(BuildContext context, String message) {
  AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
}
