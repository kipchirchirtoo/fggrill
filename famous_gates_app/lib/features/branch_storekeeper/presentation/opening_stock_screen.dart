import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/branch_storekeeper_repository.dart';

const _kOpeningStockLocations = [
  ('branch_store', 'Branch Store'),
  ('main_bar', 'Main Bar'),
  ('executive_bar', 'Executive Bar'),
];

/// Opening Stock submission — Branch Storekeeper side of the opening-stock
/// gate. Each location is submitted independently; once submitted it locks
/// (only the accountant can unlock by re-running the gate check).
class OpeningStockScreen extends ConsumerStatefulWidget {
  const OpeningStockScreen({super.key});

  @override
  ConsumerState<OpeningStockScreen> createState() =>
      _OpeningStockScreenState();
}

class _OpeningStockScreenState extends ConsumerState<OpeningStockScreen> {
  late Future<_OpeningStockData> _future = _load();
  String? _shiftId;

  Future<_OpeningStockData> _load() async {
    final repo = ref.read(branchStorekeeperRepositoryProvider);
    final shifts = await repo.openCashierShifts();
    if (shifts.isEmpty) {
      return const _OpeningStockData(
        shiftId: null,
        status: {},
        submittedItems: [],
        candidateItems: [],
      );
    }
    final shift = shifts.first;
    final shiftId = '${shift['id']}';
    _shiftId = shiftId;
    final gate = await repo.getOpeningStockStatus(shiftId);
    final candidateItems = await repo.branchStock();
    final status = gate['status'] is Map
        ? Map<String, dynamic>.from(gate['status'])
        : <String, dynamic>{};
    final submittedItems = (gate['items'] as List? ?? [])
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    return _OpeningStockData(
      shiftId: shiftId,
      status: status,
      submittedItems: submittedItems,
      candidateItems: candidateItems,
    );
  }

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Opening Stock')),
      body: FutureBuilder<_OpeningStockData>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return Center(child: Text('Failed to load: ${snap.error}'));
          }
          final data = snap.data!;
          if (data.shiftId == null) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: Text(
                  'No open or pending cashier shift found for this branch.',
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _StatusHeader(status: data.status),
                const SizedBox(height: 16),
                for (final (locationKey, locationLabel)
                    in _kOpeningStockLocations)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: _LocationSection(
                      shiftId: data.shiftId!,
                      locationKey: locationKey,
                      locationLabel: locationLabel,
                      complete: data.status['${locationKey}_complete'] ==
                          true,
                      candidateItems: data.candidateItems,
                      submittedItems: data.submittedItems
                          .where((i) => i['stock_location'] == locationKey)
                          .toList(),
                      onSubmitted: _refresh,
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _OpeningStockData {
  const _OpeningStockData({
    required this.shiftId,
    required this.status,
    required this.submittedItems,
    required this.candidateItems,
  });
  final String? shiftId;
  final Map<String, dynamic> status;
  final List<Map<String, dynamic>> submittedItems;
  final List<Map<String, dynamic>> candidateItems;
}

class _StatusHeader extends StatelessWidget {
  const _StatusHeader({required this.status});
  final Map<String, dynamic> status;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Wrap(
        spacing: 16,
        runSpacing: 8,
        children: [
          for (final (key, label) in _kOpeningStockLocations)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  status['${key}_complete'] == true
                      ? Icons.check_circle
                      : Icons.hourglass_bottom,
                  size: 18,
                  color: status['${key}_complete'] == true
                      ? Colors.green
                      : Colors.orange,
                ),
                const SizedBox(width: 6),
                Text(
                    '$label: ${status['${key}_complete'] == true ? "Submitted" : "Pending"}'),
              ],
            ),
        ],
      ),
    );
  }
}

class _LocationSection extends ConsumerStatefulWidget {
  const _LocationSection({
    required this.shiftId,
    required this.locationKey,
    required this.locationLabel,
    required this.complete,
    required this.candidateItems,
    required this.submittedItems,
    required this.onSubmitted,
  });

  final String shiftId;
  final String locationKey;
  final String locationLabel;
  final bool complete;
  final List<Map<String, dynamic>> candidateItems;
  final List<Map<String, dynamic>> submittedItems;
  final VoidCallback onSubmitted;

  @override
  ConsumerState<_LocationSection> createState() => _LocationSectionState();
}

class _LocationSectionState extends ConsumerState<_LocationSection> {
  final Map<String, TextEditingController> _controllers = {};
  bool _expanded = false;
  bool _submitting = false;

  TextEditingController _ctrlFor(String itemId) =>
      _controllers.putIfAbsent(itemId, () => TextEditingController());

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    final items = <Map<String, dynamic>>[];
    for (final item in widget.candidateItems) {
      final itemId = '${item['id']}';
      final ctrl = _controllers[itemId];
      final actual = double.tryParse(ctrl?.text.trim() ?? '');
      if (actual == null) continue;
      items.add({
        'item_id': itemId,
        'system_quantity': item['quantity'] ?? 0,
        'actual_quantity': actual,
      });
    }
    if (items.isEmpty) {
      _notify(context, 'Enter at least one actual quantity');
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(branchStorekeeperRepositoryProvider).submitOpeningStock(
            widget.shiftId,
            stockLocation: widget.locationKey,
            items: items,
          );
      if (mounted) {
        _notify(context, '${widget.locationLabel} stock submitted');
        widget.onSubmitted();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Submit failed: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: widget.complete ? Colors.green.shade200 : AppColors.kDivider,
        ),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          initiallyExpanded: _expanded,
          onExpansionChanged: (v) => setState(() => _expanded = v),
          title: Text(widget.locationLabel,
              style: const TextStyle(fontWeight: FontWeight.w800)),
          trailing: widget.complete
              ? const Icon(Icons.check_circle, color: Colors.green)
              : const Icon(Icons.expand_more),
          children: [
            if (widget.complete)
              Container(
                width: double.infinity,
                margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text('✅ Submitted',
                    style: TextStyle(
                        color: Colors.green, fontWeight: FontWeight.w700)),
              )
            else
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final item in widget.candidateItems)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          children: [
                            Expanded(
                              flex: 2,
                              child: Text('${item['name'] ?? 'Item'}'),
                            ),
                            Expanded(
                              child: Text(
                                'Sys: ${item['quantity'] ?? 0}',
                                style: const TextStyle(
                                    color: AppColors.kTextSecondary,
                                    fontSize: 12),
                              ),
                            ),
                            Expanded(
                              child: TextField(
                                controller: _ctrlFor('${item['id']}'),
                                enabled: !widget.complete,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                        decimal: true),
                                decoration: const InputDecoration(
                                    isDense: true, hintText: 'Actual'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: _submitting ? null : _submit,
                      child: Text(_submitting
                          ? 'Submitting…'
                          : 'Submit ${widget.locationLabel}'),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

void _notify(BuildContext context, String message) {
  AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
}
