import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/repository.dart';

/// Kitchen Stocktake Review - Branch Accountant.
/// Shows submitted shifts for action and all reviewed/approved/rejected shifts
/// in a history tab.
class KitchenStocktakeReviewScreen extends ConsumerStatefulWidget {
  const KitchenStocktakeReviewScreen({super.key});

  @override
  ConsumerState<KitchenStocktakeReviewScreen> createState() =>
      _KitchenStocktakeReviewScreenState();
}

class _KitchenStocktakeReviewScreenState
    extends ConsumerState<KitchenStocktakeReviewScreen> {
  late Future<List<Map<String, dynamic>>> _pendingFuture = _loadPending();
  late Future<List<Map<String, dynamic>>> _historyFuture = _loadHistory();
  final Set<String> _busyIds = {};
  List<Map<String, dynamic>> _staffList = [];

  @override
  void initState() {
    super.initState();
    _loadStaff();
  }

  Future<void> _loadStaff() async {
    try {
      final staff = await ref.read(branchAccountantRepositoryProvider).getBranchStaff();
      if (mounted) {
        setState(() {
          _staffList = staff;
        });
      }
    } catch (e) {
      // Fail silently
    }
  }

  Future<List<Map<String, dynamic>>> _loadPending() => ref
      .read(branchAccountantRepositoryProvider)
      .getKitchenStocktakeShifts(status: 'submitted');

  Future<List<Map<String, dynamic>>> _loadHistory() =>
      ref.read(branchAccountantRepositoryProvider).getKitchenStocktakeShifts();

  void _refresh() => setState(() {
        _pendingFuture = _loadPending();
        _historyFuture = _loadHistory();
      });

  num _num(dynamic v) => v == null ? 0 : (num.tryParse('$v') ?? 0);

  Future<String?> _askNotes(String title, String hint,
      {bool required = false}) async {
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
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              final text = ctrl.text.trim();
              if (required && text.isEmpty) return;
              Navigator.pop(ctx, text);
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  Future<void> _runAction(
    String id,
    Future<void> Function(BranchAccountantRepository repo) action,
    String msg,
  ) async {
    setState(() => _busyIds.add(id));
    try {
      await action(ref.read(branchAccountantRepositoryProvider));
      if (mounted) {
        _notify(context, msg);
        _refresh();
      }
    } catch (e) {
      if (mounted) _notify(context, 'Action failed: $e');
    } finally {
      if (mounted) setState(() => _busyIds.remove(id));
    }
  }

  void _openShiftGrid(Map<String, dynamic> shift) {
    final items = (shift['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
    showDialog<void>(
      context: context,
      builder: (ctx) {
        final actionsList = <String>[];
        for (final staff in _staffList) {
          final name = _getStaffName(staff);
          if (name.isNotEmpty) {
            actionsList.add('Credited to $name');
          }
        }
        actionsList.addAll([
          'Approved Spoilage',
          'Stock Adjustment',
          'Write Off',
          'Supplier Refund',
          'Pending Investigation',
          'No Action Needed',
          'Other',
        ]);

        return Dialog(
          insetPadding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1100, maxHeight: 720),
            child: StatefulBuilder(
              builder: (ctx2, setDialogState) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      color: const Color(0xFF1565C0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Kitchen Stocktake - ${shift['stocktake_date']} Shift ${shift['shift']}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 18,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Branch ${shift['branch_id'] ?? '-'} - ${_statusLabel(shift['status'])}',
                            style: TextStyle(
                                color: Colors.white.withOpacity(0.84)),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(16),
                        scrollDirection: Axis.horizontal,
                        child: SingleChildScrollView(
                          child: DataTable(
                            headingRowColor: WidgetStateProperty.all(
                              const Color(0xFFE3F2FD),
                            ),
                            columns: const [
                              DataColumn(label: Text('Item')),
                              DataColumn(label: Text('Opening')),
                              DataColumn(label: Text('Added')),
                              DataColumn(label: Text('Closing')),
                              DataColumn(label: Text('Variance')),
                              DataColumn(label: Text('Explanation')),
                              DataColumn(label: Text('Action Taken')),
                            ],
                            rows: items.map((it) {
                              final variance = _num(it['closing_qty']) -
                                  _num(it['opening_qty']) -
                                  _num(it['added_qty']);
                              final hasVar = variance != 0;

                              return DataRow(
                                cells: [
                                  DataCell(Text('${it['item_name'] ?? ''}')),
                                  DataCell(Text('${_num(it['opening_qty'])}')),
                                  DataCell(Text('${_num(it['added_qty'])}')),
                                  DataCell(Text('${_num(it['closing_qty'])}')),
                                  DataCell(Text(
                                    '${variance >= 0 ? '+' : ''}${variance.toStringAsFixed(variance == variance.roundToDouble() ? 0 : 1)}',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                      color: variance < 0 ? Colors.red : Colors.green,
                                    ),
                                  )),
                                  DataCell(
                                    SizedBox(
                                      width: 150,
                                      child: InlineTextCell(
                                        value: it['explanation'] ?? '',
                                        readOnly: shift['status'] != 'submitted',
                                        onChanged: (val) {
                                          it['explanation'] = val;
                                        },
                                      ),
                                    ),
                                  ),
                                  DataCell(
                                    DropdownButtonHideUnderline(
                                      child: DropdownButton<String>(
                                        value: hasVar && actionsList.contains(it['action_taken'])
                                            ? it['action_taken']
                                            : null,
                                        hint: Text(hasVar ? 'Select…' : '—',
                                            style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
                                        style: const TextStyle(fontSize: 11, color: Colors.black),
                                        isDense: true,
                                        iconSize: 16,
                                        items: hasVar
                                            ? actionsList
                                                .map((r) => DropdownMenuItem(
                                                    value: r,
                                                    child: Text(r, style: const TextStyle(fontSize: 11))))
                                                .toList()
                                            : [],
                                        onChanged: shift['status'] == 'submitted' && hasVar
                                            ? (v) {
                                                setDialogState(() {
                                                  it['action_taken'] = v;
                                                });
                                              }
                                            : null,
                                      ),
                                    ),
                                  ),
                                ],
                              );
                            }).toList(),
                          ),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          if (shift['status'] == 'submitted') ...[
                            FilledButton.icon(
                              onPressed: () async {
                                try {
                                  final repo = ref.read(branchAccountantRepositoryProvider);
                                  await repo.updateKitchenStocktakeItems(
                                    '${shift['id']}',
                                    items.map((i) => {
                                      'item_name': i['item_name'],
                                      'explanation': i['explanation'] ?? '',
                                      'action_taken': i['action_taken'] ?? '',
                                    }).toList(),
                                  );
                                  ScaffoldMessenger.of(ctx).showSnackBar(
                                    const SnackBar(
                                      content: Text('Kitchen items updated successfully.'),
                                      backgroundColor: Colors.green,
                                    ),
                                  );
                                  _refresh();
                                } catch (e) {
                                  ScaffoldMessenger.of(ctx).showSnackBar(
                                    SnackBar(
                                      content: Text('Save failed: $e'),
                                      backgroundColor: Colors.red,
                                    ),
                                  );
                                }
                              },
                              icon: const Icon(Icons.save),
                              label: const Text('Save Changes'),
                              style: FilledButton.styleFrom(
                                backgroundColor: const Color(0xFF2E7D32),
                              ),
                            ),
                            const SizedBox(width: 8),
                          ],
                          OutlinedButton(
                            onPressed: () => Navigator.pop(ctx),
                            child: const Text('Close'),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        );
      },
    );
  }

  Widget _buildTab({
    required Future<List<Map<String, dynamic>>> future,
    required bool history,
  }) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: future,
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return _ErrorState(message: '${snap.error}', onRetry: _refresh);
        }

        final shifts = snap.data ?? [];
        if (shifts.isEmpty) {
          return Center(
            child: Text(history
                ? 'No kitchen stocktake history found.'
                : 'No kitchen stocktakes pending review.'),
          );
        }

        return ListView(
          padding: const EdgeInsets.all(16),
          children: shifts.map((shift) {
            final id = '${shift['id']}';
            final busy = _busyIds.contains(id);
            final items =
                (shift['items'] as List?)?.cast<Map<String, dynamic>>() ?? [];
            final shortages = items.where((it) {
              final variance = _num(it['closing_qty']) -
                  _num(it['opening_qty']) -
                  _num(it['added_qty']);
              return variance < 0;
            }).length;
            final status = '${shift['status'] ?? 'submitted'}';

            return Card(
              margin: const EdgeInsets.only(bottom: 14),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(children: [
                      Expanded(
                        child: Text(
                          'Kitchen - ${shift['stocktake_date']} Shift ${shift['shift']}',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                      ),
                      Chip(
                        label: Text(_statusLabel(status)),
                        labelStyle: TextStyle(
                          color: _statusColor(status),
                          fontWeight: FontWeight.w800,
                          fontSize: 11,
                        ),
                        backgroundColor:
                            _statusColor(status).withOpacity(0.12),
                        side: BorderSide.none,
                      ),
                    ]),
                    const SizedBox(height: 4),
                    if ((shift['dispenser_name'] ?? '').toString().isNotEmpty)
                      Text(
                        'Dispenser: ${shift['dispenser_name']}',
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.kTextSecondary,
                        ),
                      ),
                    Text(
                      'Branch ${shift['branch_id'] ?? '-'} - ${items.length} items - $shortages shortages',
                      style: TextStyle(
                        color: shortages > 0 ? Colors.red : Colors.green,
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 10),
                    for (final it in items.take(history ? 4 : items.length))
                      _KitchenItemLine(item: it),
                    if (history && items.length > 4)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          '+ ${items.length - 4} more items',
                          style:
                              const TextStyle(color: AppColors.kTextSecondary),
                        ),
                      ),
                    const SizedBox(height: 12),
                    Row(children: [
                      OutlinedButton.icon(
                        onPressed: () => _openShiftGrid(shift),
                        icon: const Icon(Icons.table_chart_outlined, size: 18),
                        label: Text(
                            history ? 'Open History Grid' : 'Open Review Grid'),
                      ),
                      const Spacer(),
                      if (!history) ...[
                        OutlinedButton(
                          onPressed: busy
                              ? null
                              : () async {
                                  final notes = await _askNotes(
                                    'Reject Stocktake',
                                    'Reason (required)',
                                    required: true,
                                  );
                                  if (notes == null || notes.isEmpty) return;
                                  await _runAction(
                                    id,
                                    (r) => r.rejectKitchenStocktake(
                                      id,
                                      notes: notes,
                                    ),
                                    'Stocktake rejected',
                                  );
                                },
                          child: const Text('Reject'),
                        ),
                        const SizedBox(width: 10),
                        OutlinedButton(
                          onPressed: busy
                              ? null
                              : () async {
                                  final notes = await _askNotes(
                                    'Review Stocktake',
                                    'Notes (optional)',
                                  );
                                  if (notes == null) return;
                                  await _runAction(
                                    id,
                                    (r) => r.reviewKitchenStocktake(
                                      id,
                                      notes: notes,
                                    ),
                                    'Stocktake reviewed',
                                  );
                                },
                          child: const Text('Review'),
                        ),
                        const SizedBox(width: 10),
                        FilledButton(
                          onPressed: busy
                              ? null
                              : () async {
                                  final notes = await _askNotes(
                                    'Approve Stocktake',
                                    'Notes (optional)',
                                  );
                                  if (notes == null) return;
                                  await _runAction(
                                    id,
                                    (r) => r.approveKitchenStocktake(
                                      id,
                                      notes: notes,
                                    ),
                                    'Stocktake approved - restaurant stock updated',
                                  );
                                },
                          child: const Text('Approve'),
                        ),
                      ],
                    ]),
                  ],
                ),
              ),
            );
          }).toList(),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Kitchen Stocktake Review'),
          actions: [
            IconButton(onPressed: _refresh, icon: const Icon(Icons.refresh)),
          ],
          bottom: const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.pending_actions), text: 'Pending Review'),
              Tab(icon: Icon(Icons.history), text: 'History'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _buildTab(future: _pendingFuture, history: false),
            _buildTab(future: _historyFuture, history: true),
          ],
        ),
      ),
    );
  }
}

class _KitchenItemLine extends StatelessWidget {
  const _KitchenItemLine({required this.item});

  final Map<String, dynamic> item;

  num _num(dynamic v) => v == null ? 0 : (num.tryParse('$v') ?? 0);

  @override
  Widget build(BuildContext context) {
    final variance = _num(item['closing_qty']) -
        _num(item['opening_qty']) -
        _num(item['added_qty']);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Expanded(
            child: Text(
              '${item['item_name']}',
              style: const TextStyle(fontSize: 13),
            ),
          ),
          Text(
            '${variance >= 0 ? '+' : ''}${variance.toStringAsFixed(variance == variance.roundToDouble() ? 0 : 1)}',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: variance < 0 ? Colors.red : Colors.green,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            'O:${_num(item['opening_qty'])} A:${_num(item['added_qty'])} C:${_num(item['closing_qty'])}',
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.kTextSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 44),
          const SizedBox(height: 10),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class InlineTextCell extends StatefulWidget {
  final String value;
  final ValueChanged<String> onChanged;
  final bool readOnly;

  const InlineTextCell({
    super.key,
    required this.value,
    required this.onChanged,
    required this.readOnly,
  });

  @override
  State<InlineTextCell> createState() => _InlineTextCellState();
}

class _InlineTextCellState extends State<InlineTextCell> {
  late final TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.value);
  }

  @override
  void didUpdateWidget(covariant InlineTextCell old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value && _ctrl.text != widget.value) {
      _ctrl.text = widget.value;
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.readOnly) {
      return Text(
        widget.value.isNotEmpty ? widget.value : '—',
        style: const TextStyle(fontSize: 11),
      );
    }
    return SizedBox(
      height: 26,
      child: TextField(
        controller: _ctrl,
        style: const TextStyle(fontSize: 11),
        onChanged: widget.onChanged,
        decoration: const InputDecoration(
          isDense: true,
          contentPadding: EdgeInsets.symmetric(horizontal: 4, vertical: 4),
          border: OutlineInputBorder(),
        ),
      ),
    );
  }
}

String _getStaffName(Map<String, dynamic> row) {
  final explicit = '${row['staff_name'] ?? row['full_name'] ?? row['name'] ?? ''}'.trim();
  if (explicit.isNotEmpty && explicit.toLowerCase() != 'null') return explicit;
  final first = '${row['first_name'] ?? row['firstName'] ?? ''}'.trim();
  final last = '${row['last_name'] ?? row['lastName'] ?? ''}'.trim();
  return '$first $last'.trim();
}

String _statusLabel(dynamic value) {
  final status = '$value'.replaceAll('_', ' ').trim();
  if (status.isEmpty || status == 'null') return 'Unknown';
  return status
      .split(' ')
      .map((part) => part.isEmpty
          ? part
          : '${part[0].toUpperCase()}${part.substring(1).toLowerCase()}')
      .join(' ');
}

Color _statusColor(String status) {
  switch (status.toLowerCase()) {
    case 'approved':
      return Colors.green.shade700;
    case 'rejected':
      return Colors.red.shade700;
    case 'reviewed':
      return Colors.blue.shade700;
    default:
      return Colors.orange.shade800;
  }
}

void _notify(BuildContext context, String msg) =>
    AppNotifier.showSnackBar(context, SnackBar(content: Text(msg)));
