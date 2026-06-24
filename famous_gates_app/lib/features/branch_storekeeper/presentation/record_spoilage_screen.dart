import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../core/widgets/app_notifier.dart';
import '../data/branch_storekeeper_repository.dart';

/// Record Spoilage — Branch Storekeeper. Shared by the bar, kitchen, and
/// store stocktake screens (each links here with its area preselected) so
/// spoiled stock is logged the same way no matter where it happened.
/// Entries sit pending until a branch accountant approves or rejects them —
/// only approval applies the stock deduction.
class RecordSpoilageScreen extends ConsumerStatefulWidget {
  const RecordSpoilageScreen({
    super.key,
    this.initialArea = 'bar',
    this.initialBarLocation,
    this.initialShift,
  });

  /// 'bar' | 'kitchen' | 'store'
  final String initialArea;
  final String? initialBarLocation;
  final String? initialShift;

  @override
  ConsumerState<RecordSpoilageScreen> createState() => _RecordSpoilageScreenState();
}

const _reasons = [
  ('EXPIRED', 'Expired'),
  ('DAMAGED', 'Damaged'),
  ('BREAKAGE', 'Breakage'),
  ('CONTAMINATION', 'Contamination'),
  ('THEFT', 'Theft'),
  ('QUALITY_ISSUE', 'Quality issue'),
  ('OTHER', 'Other'),
];

class _RecordSpoilageScreenState extends ConsumerState<RecordSpoilageScreen> {
  late String _area = widget.initialArea;
  late String _barLocation = widget.initialBarLocation ?? 'main_bar';
  late String _shift = widget.initialShift ?? 'A';
  String _reason = _reasons.first.$1;
  bool _hasExecutiveBar = false;

  final _quantityCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  late Future<List<Map<String, dynamic>>> _candidatesFuture = _loadCandidates();
  Map<String, dynamic>? _selectedItem;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    ref.read(branchStorekeeperRepositoryProvider).currentBranchId().then((id) {
      if (mounted) setState(() => _hasExecutiveBar = id == 1);
    });
  }

  @override
  void dispose() {
    _quantityCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<List<Map<String, dynamic>>> _loadCandidates() {
    return ref.read(branchStorekeeperRepositoryProvider).spoilageCandidates(_area);
  }

  void _onAreaChanged(String area) {
    setState(() {
      _area = area;
      _selectedItem = null;
      _candidatesFuture = _loadCandidates();
    });
  }

  Future<void> _submit() async {
    final item = _selectedItem;
    if (item == null) {
      _notify('Select an item first');
      return;
    }
    final qty = double.tryParse(_quantityCtrl.text.trim());
    if (qty == null || qty <= 0) {
      _notify('Enter a quantity greater than 0');
      return;
    }

    setState(() => _submitting = true);
    try {
      await ref.read(branchStorekeeperRepositoryProvider).recordBranchSpoilage(
            area: _area,
            itemId: '${item['id']}',
            quantity: qty,
            reason: _reason,
            unit: item['unit'] as String?,
            notes: _notesCtrl.text.trim().isEmpty ? null : _notesCtrl.text.trim(),
            barLocation: _area == 'bar' ? _barLocation : null,
            shift: _area == 'kitchen' ? _shift : null,
            spoilageDate: DateFormat('yyyy-MM-dd').format(DateTime.now()),
          );
      if (mounted) {
        _notify('Spoilage recorded — pending accountant approval');
        setState(() {
          _selectedItem = null;
          _quantityCtrl.clear();
          _notesCtrl.clear();
        });
      }
    } catch (e) {
      if (mounted) _notify('Could not record spoilage: $e');
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _notify(String message) {
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Record Spoilage')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Area', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'bar', label: Text('Bar')),
              ButtonSegment(value: 'kitchen', label: Text('Kitchen')),
              ButtonSegment(value: 'store', label: Text('Store')),
            ],
            selected: {_area},
            onSelectionChanged: (s) => _onAreaChanged(s.first),
          ),
          const SizedBox(height: 16),
          if (_area == 'bar') ...[
            const Text('Bar location', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _barLocation,
              decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
              items: [
                const DropdownMenuItem(value: 'main_bar', child: Text('Main Bar')),
                if (_hasExecutiveBar)
                  const DropdownMenuItem(value: 'executive_bar', child: Text('Executive Bar')),
              ],
              onChanged: (v) => setState(() => _barLocation = v ?? 'main_bar'),
            ),
            const SizedBox(height: 16),
          ],
          if (_area == 'kitchen') ...[
            const Text('Shift', style: TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _shift,
              decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
              items: const [
                DropdownMenuItem(value: 'A', child: Text('Shift A')),
                DropdownMenuItem(value: 'B', child: Text('Shift B')),
              ],
              onChanged: (v) => setState(() => _shift = v ?? 'A'),
            ),
            const SizedBox(height: 16),
          ],
          const Text('Item', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          FutureBuilder<List<Map<String, dynamic>>>(
            future: _candidatesFuture,
            builder: (context, snap) {
              if (snap.connectionState == ConnectionState.waiting) {
                return const LinearProgressIndicator();
              }
              final candidates = snap.data ?? [];
              return Autocomplete<Map<String, dynamic>>(
                displayStringForOption: (o) => '${o['name'] ?? ''}',
                optionsBuilder: (value) {
                  if (value.text.isEmpty) return candidates;
                  final q = value.text.toLowerCase();
                  return candidates.where(
                      (c) => '${c['name'] ?? ''}'.toLowerCase().contains(q));
                },
                onSelected: (o) => setState(() => _selectedItem = o),
                fieldViewBuilder: (context, ctrl, focusNode, onSubmit) {
                  return TextField(
                    controller: ctrl,
                    focusNode: focusNode,
                    decoration: const InputDecoration(
                      isDense: true,
                      border: OutlineInputBorder(),
                      hintText: 'Search item…',
                    ),
                  );
                },
              );
            },
          ),
          const SizedBox(height: 16),
          const Text('Quantity spoiled', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          TextField(
            controller: _quantityCtrl,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              isDense: true,
              border: const OutlineInputBorder(),
              suffixText: _selectedItem?['unit'] as String?,
            ),
          ),
          const SizedBox(height: 16),
          const Text('Reason', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            initialValue: _reason,
            decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
            items: [
              for (final r in _reasons) DropdownMenuItem(value: r.$1, child: Text(r.$2)),
            ],
            onChanged: (v) => setState(() => _reason = v ?? _reason),
          ),
          const SizedBox(height: 16),
          const Text('Notes (optional)', style: TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          TextField(
            controller: _notesCtrl,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(isDense: true, border: OutlineInputBorder()),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _submitting ? null : _submit,
              child: Text(_submitting ? 'Submitting…' : 'Record Spoilage'),
            ),
          ),
        ],
      ),
    );
  }
}
