import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/repository.dart';

/// Branch Stock Request Review — Branch Accountant.
/// Lists pending branch stock requests and allows approve/reject.
/// Approved requests are forwarded to the central store for packing/dispatch.
class BranchStockRequestReviewScreen extends ConsumerStatefulWidget {
  const BranchStockRequestReviewScreen({super.key});

  @override
  ConsumerState<BranchStockRequestReviewScreen> createState() =>
      _BranchStockRequestReviewScreenState();
}

class _BranchStockRequestReviewScreenState
    extends ConsumerState<BranchStockRequestReviewScreen> {
  late Future<List<Map<String, dynamic>>> _future = _load();
  final Set<String> _busyIds = {};

  Future<List<Map<String, dynamic>>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getStockRequests(status: 'PENDING_BRANCH_ACCOUNTANT_APPROVAL');

  void _refresh() => setState(() => _future = _load());

  Future<void> _approve(Map<String, dynamic> request) async {
    final id = '${request['id']}';
    final items = (request['items'] as List<dynamic>? ?? []).cast<Map<String, dynamic>>();
    final itemApprovals = items.map((item) => {
      'id': '${item['id']}',
      'approved_quantity': item['requested_quantity'] ?? 0,
      'status': 'APPROVED',
    }).toList();

    await _runAction(id, (repo) async {
      await repo.approveStockRequest(
        id,
        itemApprovals: itemApprovals,
        notes: 'Approved by branch accountant',
      );
    }, 'Stock request approved and sent to central store');
  }

  Future<void> _reject(Map<String, dynamic> request) async {
    final id = '${request['id']}';
    final ctrl = TextEditingController();
    final notes = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reject Stock Request'),
        content: TextField(
          controller: ctrl,
          minLines: 2,
          maxLines: 4,
          decoration: const InputDecoration(labelText: 'Reason (required)'),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, ctrl.text.trim()),
              child: const Text('Reject')),
        ],
      ),
    );
    if (notes == null || notes.isEmpty) return;

    await _runAction(id, (repo) async {
      await repo.rejectStockRequest(id, notes: notes);
    }, 'Stock request rejected');
  }

  Future<void> _runAction(
    String id,
    Future<void> Function(BranchAccountantRepository repo) action,
    String successMessage,
  ) async {
    setState(() => _busyIds.add(id));
    try {
      final repo = ref.read(branchAccountantRepositoryProvider);
      await action(repo);
      if (mounted) {
        _notify(context, successMessage);
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Action failed: $e');
    } finally {
      if (mounted) setState(() => _busyIds.remove(id));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Branch Stock Requests'),
        actions: [
          IconButton(onPressed: _refresh, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          final requests = snap.data ?? [];
          if (requests.isEmpty) {
            return const Center(child: Text('No pending stock requests.'));
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: requests.length,
            itemBuilder: (context, i) {
              final request = requests[i];
              final items = (request['items'] as List<dynamic>? ?? [])
                  .cast<Map<String, dynamic>>();
              final id = '${request['id']}';
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
                            child: Text(
                              '${request['request_number'] ?? id}',
                              style: const TextStyle(
                                  fontWeight: FontWeight.w800),
                            ),
                          ),
                          _StatusChip(status: '${request['status']}'),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Branch: ${request['requesting_branch_id'] ?? request['branch_id']} · '
                        '${request['priority'] ?? 'normal'} · ${request['request_type'] ?? 'ROUTINE'}',
                        style: const TextStyle(
                            fontSize: 12, color: AppColors.kTextSecondary),
                      ),
                      if ((request['reason'] ?? '').toString().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Text('Reason: ${request['reason']}',
                            style: const TextStyle(fontSize: 12)),
                      ],
                      const SizedBox(height: 12),
                      for (final item in items)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 3),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  '${item['item_name'] ?? item['item_sku']}',
                                  style: const TextStyle(fontSize: 13),
                                ),
                              ),
                              Text(
                                'Req: ${item['requested_quantity']}',
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.kTextSecondary),
                              ),
                            ],
                          ),
                        ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          OutlinedButton(
                            onPressed: busy ? null : () => _reject(request),
                            child: const Text('Reject'),
                          ),
                          const SizedBox(width: 10),
                          FilledButton(
                            onPressed: busy ? null : () => _approve(request),
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

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = status.toLowerCase().contains('pending')
        ? Colors.amber
        : status.toLowerCase().contains('approved')
            ? Colors.green
            : status.toLowerCase().contains('rejected')
                ? Colors.red
                : AppColors.kTextSecondary;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status,
        style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.w700),
      ),
    );
  }
}

void _notify(BuildContext context, String message) {
  AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
}
