import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/repository.dart';

/// Spoilage Review — Branch Accountant.
/// Lists pending spoilage entries from the storekeeper (bar/kitchen/store)
/// and provides Approve / Reject actions. Approval applies the stock
/// deduction; rejection never touches stock since nothing was applied yet.
class SpoilageReviewScreen extends ConsumerStatefulWidget {
  const SpoilageReviewScreen({super.key});

  @override
  ConsumerState<SpoilageReviewScreen> createState() => _SpoilageReviewScreenState();
}

class _SpoilageReviewScreenState extends ConsumerState<SpoilageReviewScreen> {
  late Future<List<Map<String, dynamic>>> _future = _load();
  final Set<String> _busyIds = {};

  Future<List<Map<String, dynamic>>> _load() =>
      ref.read(branchAccountantRepositoryProvider).getSpoilageRecords(status: 'pending');

  void _refresh() => setState(() => _future = _load());

  Future<void> _approve(String id) async {
    setState(() => _busyIds.add(id));
    try {
      await ref.read(branchAccountantRepositoryProvider).approveSpoilage(id);
      if (mounted) {
        _notify('Spoilage approved');
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify('Approve failed: $e');
    } finally {
      if (mounted) setState(() => _busyIds.remove(id));
    }
  }

  Future<void> _reject(String id) async {
    final notes = await _askNotes('Reject Spoilage', 'Reason for rejection (required)');
    if (notes == null || notes.isEmpty) return;
    setState(() => _busyIds.add(id));
    try {
      await ref.read(branchAccountantRepositoryProvider).rejectSpoilage(id, notes: notes);
      if (mounted) {
        _notify('Spoilage rejected');
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify('Reject failed: $e');
    } finally {
      if (mounted) setState(() => _busyIds.remove(id));
    }
  }

  Future<String?> _askNotes(String title, String hint) async {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: ctrl,
          minLines: 2,
          maxLines: 4,
          decoration: InputDecoration(labelText: hint),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              final text = ctrl.text.trim();
              if (text.isEmpty) return;
              Navigator.pop(ctx, text);
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  void _notify(String message) {
    AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Spoilage Review'),
        actions: [IconButton(onPressed: _refresh, icon: const Icon(Icons.refresh))],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final records = snap.data ?? [];
          if (records.isEmpty) {
            return const Center(child: Text('No spoilage records pending review.'));
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: records.length,
            itemBuilder: (context, i) {
              final r = records[i];
              final id = '${r['id']}';
              final busy = _busyIds.contains(id);
              return Card(
                margin: const EdgeInsets.only(bottom: 14),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text('${r['item_name'] ?? 'Item'}',
                                style: const TextStyle(fontWeight: FontWeight.w800)),
                          ),
                          _AreaChip(area: '${r['area']}'),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Qty: ${r['quantity']} ${r['unit'] ?? ''} · Reason: ${_reasonLabel(r['reason'])}',
                        style: const TextStyle(fontSize: 12, color: AppColors.kTextSecondary),
                      ),
                      if (r['area'] == 'bar' && r['bar_location'] != null)
                        Text(_locationLabel(r['bar_location']),
                            style: const TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
                      if (r['area'] == 'kitchen' && r['shift'] != null)
                        Text('Shift ${r['shift']}',
                            style: const TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
                      Text('Date: ${r['spoilage_date'] ?? ''}',
                          style: const TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
                      if ((r['notes'] ?? '').toString().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text('Notes: ${r['notes']}',
                              style: const TextStyle(
                                  fontSize: 12, fontStyle: FontStyle.italic, color: AppColors.kTextSecondary)),
                        ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          OutlinedButton(
                            onPressed: busy ? null : () => _reject(id),
                            child: const Text('Reject'),
                          ),
                          const SizedBox(width: 10),
                          FilledButton(
                            onPressed: busy ? null : () => _approve(id),
                            child: const Text('Approve'),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}

class _AreaChip extends StatelessWidget {
  const _AreaChip({required this.area});
  final String area;

  @override
  Widget build(BuildContext context) {
    final label = switch (area) {
      'bar' => 'Bar',
      'kitchen' => 'Kitchen',
      'store' => 'Store',
      _ => area,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}

String _locationLabel(dynamic key) {
  switch (key) {
    case 'main_bar':
      return 'Main Bar';
    case 'executive_bar':
      return 'Executive Bar';
    default:
      return '$key';
  }
}

String _reasonLabel(dynamic key) {
  switch (key) {
    case 'EXPIRED':
      return 'Expired';
    case 'DAMAGED':
      return 'Damaged';
    case 'BREAKAGE':
      return 'Breakage';
    case 'CONTAMINATION':
      return 'Contamination';
    case 'THEFT':
      return 'Theft';
    case 'QUALITY_ISSUE':
      return 'Quality issue';
    default:
      return 'Other';
  }
}
