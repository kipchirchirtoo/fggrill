import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_notifier.dart';
import '../data/repository.dart';

/// Reason options shown when approved_qty < requested_qty.
const _kReasons = [
  'Budget constraint',
  'Overstocked at branch',
  'Awaiting central stock',
  'Other',
];

// ---------------------------------------------------------------------------
// Per-request editing state — one instance per expanded request card.
// ---------------------------------------------------------------------------
class _ItemState {
  _ItemState({required this.requestedQty, required this.itemId}) {
    controller = TextEditingController(text: requestedQty.toString());
  }

  final String itemId;
  final int requestedQty;
  late final TextEditingController controller;
  String? reason;
  String? otherNotes;

  int get approvedQty =>
      (int.tryParse(controller.text.trim()) ?? requestedQty).clamp(
        0,
        requestedQty,
      );

  bool get isValid {
    if (approvedQty < 0 || approvedQty > requestedQty) return false;
    if (approvedQty < requestedQty && (reason == null || reason!.isEmpty)) {
      return false;
    }
    return true;
  }

  void dispose() => controller.dispose();
}

/// Returns the computed overall status label given a list of item states.
String _computeStatus(List<_ItemState> states) {
  if (states.isEmpty) return 'APPROVED';
  final allApproved = states.every((s) => s.approvedQty == s.requestedQty);
  final allZero = states.every((s) => s.approvedQty == 0);
  if (allApproved) return 'APPROVED';
  if (allZero) return 'REJECTED';
  return 'PARTIALLY APPROVED';
}

Color _statusColor(String status) {
  final lower = status.toLowerCase();
  if (lower.contains('partial')) return Colors.orange;
  if (lower.contains('approved')) return Colors.green;
  if (lower.contains('reject')) return Colors.red;
  if (lower.contains('pending')) return Colors.amber;
  return AppColors.kTextSecondary;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
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

  /// Expanded request id → per-item editing state.
  final Map<String, List<_ItemState>> _expanded = {};

  Future<List<Map<String, dynamic>>> _load() => ref
      .read(branchAccountantRepositoryProvider)
      .getStockRequests(status: 'PENDING_BRANCH_ACCOUNTANT_APPROVAL');

  void _refresh() {
    // dispose all editing state before reload
    for (final states in _expanded.values) {
      for (final s in states) {
        s.dispose();
      }
    }
    _expanded.clear();
    setState(() => _future = _load());
  }

  @override
  void dispose() {
    for (final states in _expanded.values) {
      for (final s in states) {
        s.dispose();
      }
    }
    super.dispose();
  }

  // ── Toggle expand/collapse ────────────────────────────────────────────────

  void _toggleExpand(Map<String, dynamic> request) {
    final id = '${request['id']}';
    setState(() {
      if (_expanded.containsKey(id)) {
        for (final s in _expanded[id]!) {
          s.dispose();
        }
        _expanded.remove(id);
      } else {
        final items = (request['items'] as List<dynamic>? ?? [])
            .cast<Map<String, dynamic>>();
        _expanded[id] = items.map((item) {
          final qty = _toInt(item['requested_quantity']);
          return _ItemState(requestedQty: qty, itemId: '${item['id']}');
        }).toList();
      }
    });
  }

  // ── Quick approve (full qty, no expansion needed) ─────────────────────────

  Future<void> _approve(Map<String, dynamic> request) async {
    final id = '${request['id']}';
    final items = (request['items'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    final itemApprovals = items.map((item) {
      return {
        'id': '${item['id']}',
        'approved_quantity': _toInt(item['requested_quantity']),
        'status': 'APPROVED',
      };
    }).toList();

    await _runAction(id, (repo) async {
      await repo.approveStockRequest(
        id,
        itemApprovals: itemApprovals,
        notes: 'Approved by branch accountant',
      );
    }, 'Stock request approved and sent to central store');
  }

  // ── Quick reject (dialog for notes) ──────────────────────────────────────

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
    ctrl.dispose();
    if (notes == null || notes.isEmpty) return;

    await _runAction(id, (repo) async {
      await repo.rejectStockRequest(id, notes: notes);
    }, 'Stock request rejected');
  }

  // ── Submit per-item decision ──────────────────────────────────────────────

  Future<void> _submitDecision(
      String id, List<_ItemState> states, String overallNotes) async {
    // Validate
    final invalid = states.where((s) => !s.isValid).toList();
    if (invalid.isNotEmpty) {
      _notify(
          context, 'Please fill in a reason for all reduced-quantity items.');
      return;
    }

    final itemApprovals = states.map((s) {
      String itemStatus;
      if (s.approvedQty == s.requestedQty) {
        itemStatus = 'APPROVED';
      } else if (s.approvedQty == 0) {
        itemStatus = 'REJECTED';
      } else {
        itemStatus = 'PARTIALLY_APPROVED';
      }
      return {
        'id': s.itemId,
        'approved_quantity': s.approvedQty,
        'status': itemStatus,
        if (s.reason != null && s.reason!.isNotEmpty) 'reason': s.reason,
        if (s.reason == 'Other' &&
            s.otherNotes != null &&
            s.otherNotes!.isNotEmpty)
          'notes': s.otherNotes,
      };
    }).toList();

    final allZero = states.every((s) => s.approvedQty == 0);

    await _runAction(id, (repo) async {
      if (allZero) {
        await repo.rejectStockRequest(
          id,
          notes: overallNotes.isNotEmpty
              ? overallNotes
              : 'Rejected: all quantities set to zero',
        );
      } else {
        await repo.approveStockRequest(
          id,
          itemApprovals: itemApprovals,
          notes: overallNotes.isNotEmpty
              ? overallNotes
              : 'Reviewed by branch accountant',
        );
      }
    }, 'Decision submitted successfully');
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

  // ── Build ─────────────────────────────────────────────────────────────────

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
          if (snap.hasError) {
            return Center(child: Text('Error: ${snap.error}'));
          }
          final requests = snap.data ?? [];
          if (requests.isEmpty) {
            return const Center(child: Text('No pending stock requests.'));
          }
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: requests.length,
            itemBuilder: (context, i) => _RequestCard(
              request: requests[i],
              busy: _busyIds.contains('${requests[i]['id']}'),
              expandedStates: _expanded['${requests[i]['id']}'],
              onToggleExpand: () => _toggleExpand(requests[i]),
              onApprove: () => _approve(requests[i]),
              onReject: () => _reject(requests[i]),
              onSubmitDecision: (states, notes) =>
                  _submitDecision('${requests[i]['id']}', states, notes),
              onStateChanged: () => setState(() {}),
            ),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Request card (collapsed + expanded views)
// ---------------------------------------------------------------------------
class _RequestCard extends StatefulWidget {
  const _RequestCard({
    required this.request,
    required this.busy,
    required this.expandedStates,
    required this.onToggleExpand,
    required this.onApprove,
    required this.onReject,
    required this.onSubmitDecision,
    required this.onStateChanged,
  });

  final Map<String, dynamic> request;
  final bool busy;
  final List<_ItemState>? expandedStates;
  final VoidCallback onToggleExpand;
  final VoidCallback onApprove;
  final VoidCallback onReject;
  final Future<void> Function(List<_ItemState> states, String notes)
      onSubmitDecision;
  final VoidCallback onStateChanged;

  @override
  State<_RequestCard> createState() => _RequestCardState();
}

class _RequestCardState extends State<_RequestCard> {
  final _overallNotesCtrl = TextEditingController();

  @override
  void dispose() {
    _overallNotesCtrl.dispose();
    super.dispose();
  }

  bool get _isExpanded => widget.expandedStates != null;

  @override
  Widget build(BuildContext context) {
    final request = widget.request;
    final id = '${request['id']}';
    final items = (request['items'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>();
    final busy = widget.busy;
    final states = widget.expandedStates;

    // Compute live status if expanded, else use server status.
    final liveStatus =
        states != null ? _computeStatus(states) : '${request['status']}';

    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Header row ──────────────────────────────────────────────────
          InkWell(
            onTap: busy ? null : widget.onToggleExpand,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${request['request_number'] ?? id}',
                          style: const TextStyle(fontWeight: FontWeight.w800),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'Branch: ${request['requesting_branch_id'] ?? request['branch_id']} · '
                          '${request['priority'] ?? 'normal'} · '
                          '${request['request_type'] ?? 'ROUTINE'}',
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.kTextSecondary),
                        ),
                      ],
                    ),
                  ),
                  _StatusChip(status: liveStatus),
                  const SizedBox(width: 6),
                  Icon(
                    _isExpanded
                        ? Icons.keyboard_arrow_up
                        : Icons.keyboard_arrow_down,
                    color: AppColors.kTextSecondary,
                  ),
                ],
              ),
            ),
          ),

          if ((request['reason'] ?? '').toString().isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
              child: Text(
                'Reason: ${request['reason']}',
                style: const TextStyle(fontSize: 12),
              ),
            ),

          // ── Collapsed item summary ───────────────────────────────────────
          if (!_isExpanded) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 4),
              child: Column(
                children: [
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
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 14),
              child: Row(
                children: [
                  OutlinedButton(
                    onPressed: busy ? null : widget.onReject,
                    child: const Text('Reject'),
                  ),
                  const SizedBox(width: 10),
                  FilledButton(
                    onPressed: busy ? null : widget.onApprove,
                    child: const Text('Approve All'),
                  ),
                  const SizedBox(width: 10),
                  OutlinedButton.icon(
                    onPressed: busy ? null : widget.onToggleExpand,
                    icon: const Icon(Icons.edit_note, size: 18),
                    label: const Text('Review'),
                  ),
                ],
              ),
            ),
          ],

          // ── Expanded per-item editing panel ──────────────────────────────
          if (_isExpanded && states != null) ...[
            const Divider(height: 1),
            _ExpandedPanel(
              requestId: id,
              items: items,
              states: states,
              overallNotesCtrl: _overallNotesCtrl,
              busy: busy,
              liveStatus: liveStatus,
              onApproveAll: () {
                for (final s in states) {
                  s.controller.text = s.requestedQty.toString();
                  s.reason = null;
                  s.otherNotes = null;
                }
                widget.onStateChanged();
              },
              onRejectAll: () {
                for (final s in states) {
                  s.controller.text = '0';
                  s.reason ??= 'Budget constraint';
                }
                widget.onStateChanged();
              },
              onStateChanged: widget.onStateChanged,
              onSubmit: () => widget.onSubmitDecision(
                states,
                _overallNotesCtrl.text.trim(),
              ),
              onCancel: widget.onToggleExpand,
            ),
          ],
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Expanded editing panel
// ---------------------------------------------------------------------------
class _ExpandedPanel extends StatefulWidget {
  const _ExpandedPanel({
    required this.requestId,
    required this.items,
    required this.states,
    required this.overallNotesCtrl,
    required this.busy,
    required this.liveStatus,
    required this.onApproveAll,
    required this.onRejectAll,
    required this.onStateChanged,
    required this.onSubmit,
    required this.onCancel,
  });

  final String requestId;
  final List<Map<String, dynamic>> items;
  final List<_ItemState> states;
  final TextEditingController overallNotesCtrl;
  final bool busy;
  final String liveStatus;
  final VoidCallback onApproveAll;
  final VoidCallback onRejectAll;
  final VoidCallback onStateChanged;
  final VoidCallback onSubmit;
  final VoidCallback onCancel;

  @override
  State<_ExpandedPanel> createState() => _ExpandedPanelState();
}

class _ExpandedPanelState extends State<_ExpandedPanel> {
  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Top shortcut bar ──────────────────────────────────────────────
          Row(
            children: [
              FilledButton.icon(
                onPressed: widget.busy ? null : widget.onApproveAll,
                icon: const Icon(Icons.done_all, size: 18),
                label: const Text('Approve All Full'),
                style: FilledButton.styleFrom(
                  backgroundColor: Colors.green,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  textStyle: const TextStyle(fontSize: 13),
                ),
              ),
              const SizedBox(width: 8),
              OutlinedButton.icon(
                onPressed: widget.busy ? null : widget.onRejectAll,
                icon: const Icon(Icons.block, size: 18),
                label: const Text('Reject All'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red,
                  side: const BorderSide(color: Colors.red),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  textStyle: const TextStyle(fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          // ── Items table header ────────────────────────────────────────────
          Container(
            color: theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
            child: const Row(
              children: [
                Expanded(
                  flex: 3,
                  child: Text('Item',
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700)),
                ),
                SizedBox(
                  width: 72,
                  child: Text('Req.',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700)),
                ),
                SizedBox(
                  width: 80,
                  child: Text('Approved',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700)),
                ),
                Expanded(
                  flex: 3,
                  child: Text('Reason',
                      style: TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),

          // ── Item rows ─────────────────────────────────────────────────────
          for (var i = 0; i < widget.items.length; i++)
            _ItemRow(
              item: widget.items[i],
              itemState: widget.states[i],
              onChanged: () {
                setState(() {});
                widget.onStateChanged();
              },
            ),

          const SizedBox(height: 14),

          // ── Computed status label ─────────────────────────────────────────
          Row(
            children: [
              const Text('Decision: ',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
              _StatusChip(status: widget.liveStatus),
            ],
          ),
          const SizedBox(height: 12),

          // ── Overall notes ─────────────────────────────────────────────────
          TextField(
            controller: widget.overallNotesCtrl,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Review notes (optional)',
              border: OutlineInputBorder(),
              isDense: true,
            ),
          ),
          const SizedBox(height: 14),

          // ── Actions ───────────────────────────────────────────────────────
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: widget.busy ? null : widget.onCancel,
                child: const Text('Cancel'),
              ),
              const SizedBox(width: 10),
              FilledButton(
                onPressed: widget.busy ? null : widget.onSubmit,
                child: widget.busy
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Submit Decision'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Single item editing row
// ---------------------------------------------------------------------------
class _ItemRow extends StatefulWidget {
  const _ItemRow({
    required this.item,
    required this.itemState,
    required this.onChanged,
  });

  final Map<String, dynamic> item;
  final _ItemState itemState;
  final VoidCallback onChanged;

  @override
  State<_ItemRow> createState() => _ItemRowState();
}

class _ItemRowState extends State<_ItemRow> {
  bool get _needsReason =>
      widget.itemState.approvedQty < widget.itemState.requestedQty;
  bool get _showOther => widget.itemState.reason == 'Other';

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final state = widget.itemState;

    return Container(
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFEEEEEE))),
      ),
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Name | Req | ApprovedQty | Reason (single row)
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Item name
              Expanded(
                flex: 3,
                child: Text(
                  '${item['item_name'] ?? item['item_sku']}',
                  style: const TextStyle(fontSize: 13),
                ),
              ),

              // Requested qty
              SizedBox(
                width: 72,
                child: Text(
                  '${item['requested_quantity']}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 13, color: AppColors.kTextSecondary),
                ),
              ),

              // Approved qty (editable)
              SizedBox(
                width: 80,
                child: TextFormField(
                  controller: state.controller,
                  keyboardType: TextInputType.number,
                  textAlign: TextAlign.center,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  style: const TextStyle(fontSize: 13),
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 8),
                    border: const OutlineInputBorder(),
                    errorText: _buildQtyError(state),
                  ),
                  onChanged: (_) {
                    setState(() {});
                    widget.onChanged();
                  },
                ),
              ),

              const SizedBox(width: 8),

              // Reason dropdown (visible when approved < requested)
              Expanded(
                flex: 3,
                child: _needsReason
                    ? DropdownButtonFormField<String>(
                        initialValue: state.reason,
                        isExpanded: true,
                        isDense: true,
                        decoration: InputDecoration(
                          isDense: true,
                          contentPadding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 8),
                          border: const OutlineInputBorder(),
                          errorText: state.reason == null ? 'Required' : null,
                        ),
                        hint: const Text('Select reason',
                            style: TextStyle(fontSize: 12)),
                        items: _kReasons
                            .map((r) => DropdownMenuItem(
                                value: r,
                                child: Text(r,
                                    style: const TextStyle(fontSize: 12))))
                            .toList(),
                        onChanged: (v) {
                          setState(() {
                            state.reason = v;
                            if (v != 'Other') state.otherNotes = null;
                          });
                          widget.onChanged();
                        },
                      )
                    : const SizedBox.shrink(),
              ),
            ],
          ),

          // "Other" free-text notes (shown below this row)
          if (_needsReason && _showOther) ...[
            const SizedBox(height: 8),
            TextFormField(
              initialValue: state.otherNotes,
              style: const TextStyle(fontSize: 12),
              decoration: const InputDecoration(
                isDense: true,
                contentPadding:
                    EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                border: OutlineInputBorder(),
                labelText: 'Describe reason',
              ),
              onChanged: (v) {
                state.otherNotes = v.trim().isEmpty ? null : v;
                widget.onChanged();
              },
            ),
          ],
        ],
      ),
    );
  }

  String? _buildQtyError(_ItemState state) {
    final text = state.controller.text.trim();
    if (text.isEmpty) return null;
    final qty = int.tryParse(text);
    if (qty == null) return 'Invalid';
    if (qty < 0) return 'Min 0';
    if (qty > state.requestedQty) return 'Max ${state.requestedQty}';
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared status chip
// ---------------------------------------------------------------------------
class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status,
        style: TextStyle(
            fontSize: 11, color: color, fontWeight: FontWeight.w700),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
int _toInt(dynamic value) {
  if (value is int) return value;
  if (value is double) return value.toInt();
  return int.tryParse('$value') ?? 0;
}

void _notify(BuildContext context, String message) {
  AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
}
