import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:printing/printing.dart';

import '../../../core/widgets/app_notifier.dart';
import '../data/branch_storekeeper_repository.dart';

/// Goods Received Notes (GRN) — branch storekeeper.
///
/// Lists every GRN for the storekeeper's branch (raised from central-store
/// dispatches and supplier purchase orders). Pending GRNs (status != posted)
/// sit in the CURRENT tab where they can be viewed, printed and approved;
/// approving posts the received stock to inventory and moves the GRN to the
/// HISTORY tab. Posted GRNs are read-only (view / print only).
class GrnScreen extends ConsumerStatefulWidget {
  final VoidCallback? onBack;
  const GrnScreen({super.key, this.onBack});

  @override
  ConsumerState<GrnScreen> createState() => _GrnScreenState();
}

class _GrnScreenState extends ConsumerState<GrnScreen>
    with SingleTickerProviderStateMixin {
  static const _blue = Color(0xFF1565C0);
  static const _navy = Color(0xFF173D5F);

  late final TabController _tab = TabController(length: 2, vsync: this);
  final _money = NumberFormat('#,##0.00');
  final Set<String> _busy = {};

  bool _loading = true;
  String? _error;
  String _search = '';
  List<Map<String, dynamic>> _all = const [];

  @override
  void initState() {
    super.initState();
    _tab.addListener(() => setState(() {}));
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  BranchStorekeeperRepository get _repo =>
      ref.read(branchStorekeeperRepositoryProvider);

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final rows = await _repo.grns();
      if (!mounted) return;
      setState(() {
        _all = rows;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  // ── helpers ────────────────────────────────────────────────────────────
  String _str(Map g, List<String> keys, {String fallback = ''}) {
    for (final k in keys) {
      final v = g[k];
      if (v != null && v.toString().trim().isNotEmpty) return v.toString();
    }
    return fallback;
  }

  double _n(dynamic v) => double.tryParse('${v ?? ''}') ?? 0;

  // Approved (History) = actually signed off: an 'approved' status, or a
  // 'posted' GRN that carries an approver. A posted GRN with no approver is
  // still awaiting sign-off and stays in Current (approvable). This prevents
  // re-approving an already-signed GRN (which would double-post stock).
  bool _isApproved(Map g) {
    final s = _str(g, ['status']).toLowerCase();
    if (s.contains('approved')) return true;
    final approver = _str(g, ['approved_by_id', 'approved_by']);
    return s == 'posted' && approver.isNotEmpty;
  }

  String _fmtDate(Map g) {
    final raw = _str(g, ['grn_date', 'delivery_date', 'received_at', 'created_at']);
    if (raw.isEmpty) return '—';
    final d = DateTime.tryParse(raw);
    return d == null ? raw : DateFormat('dd MMM yyyy').format(d.toLocal());
  }

  List<Map<String, dynamic>> _filter(bool posted) {
    final q = _search.trim().toLowerCase();
    return _all.where((g) {
      if (_isApproved(g) != posted) return false;
      if (q.isEmpty) return true;
      return _str(g, ['grn_number']).toLowerCase().contains(q) ||
          _str(g, ['po_number']).toLowerCase().contains(q) ||
          _str(g, ['supplier_name']).toLowerCase().contains(q);
    }).toList();
  }

  // ── actions ────────────────────────────────────────────────────────────
  Future<void> _print(Map g) async {
    final id = _str(g, ['id']);
    if (id.isEmpty) return;
    setState(() => _busy.add(id));
    try {
      final bytes = await _repo.grnPdfBytes(id);
      if (bytes.isEmpty) throw 'Empty PDF';
      await Printing.layoutPdf(
        name: '${_str(g, ['grn_number'], fallback: 'GRN')}.pdf',
        onLayout: (_) async => Uint8List.fromList(bytes),
      );
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Could not print GRN: $e', isError: true);
      }
    } finally {
      if (mounted) setState(() => _busy.remove(id));
    }
  }

  Future<void> _approve(Map g) async {
    final id = _str(g, ['id']);
    if (id.isEmpty) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Approve GRN'),
        content: Text(
          'Approve ${_str(g, ['grn_number'], fallback: 'this GRN')}?\n\n'
          'This posts the received stock to inventory and moves the GRN to '
          'History. This cannot be undone.',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: _blue),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Approve & Post'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _busy.add(id));
    try {
      await _repo.approveGrn(id);
      if (mounted) {
        AppNotifier.show(context, 'GRN approved and posted to inventory.');
      }
      await _load();
      if (mounted) _tab.animateTo(1); // jump to History
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Approval failed: $e', isError: true);
      }
    } finally {
      if (mounted) setState(() => _busy.remove(id));
    }
  }

  Future<void> _view(Map g) async {
    final id = _str(g, ['id']);
    Map<String, dynamic> detail = Map<String, dynamic>.from(g);
    try {
      if (id.isNotEmpty) detail = await _repo.grn(id);
    } catch (_) {
      // fall back to the list row we already have
    }
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => _GrnDetailDialog(
        grn: detail,
        money: _money,
        posted: _isApproved(detail),
      ),
    );
  }

  // ── build ──────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final current = _loading ? const <Map<String, dynamic>>[] : _filter(false);
    final history = _loading ? const <Map<String, dynamic>>[] : _filter(true);

    return Scaffold(
      backgroundColor: const Color(0xFFF5F7FA),
      appBar: AppBar(
        backgroundColor: _blue,
        foregroundColor: Colors.white,
        leading: widget.onBack != null
            ? IconButton(
                icon: const Icon(Icons.arrow_back), onPressed: widget.onBack)
            : null,
        title: const Text('Goods Received Notes',
            style: TextStyle(fontWeight: FontWeight.bold)),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            icon: const Icon(Icons.refresh),
            onPressed: _loading ? null : _load,
          ),
          const SizedBox(width: 8),
        ],
        bottom: TabBar(
          controller: _tab,
          indicatorColor: Colors.white,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          tabs: [
            Tab(text: 'Current (${current.length})'),
            Tab(text: 'History (${history.length})'),
          ],
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
            child: TextField(
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: 'Search GRN #, PO # or supplier',
                isDense: true,
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: Colors.grey.shade300)),
              ),
              onChanged: (v) => setState(() => _search = v),
            ),
          ),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? _errorView()
                    : TabBarView(
                        controller: _tab,
                        children: [
                          _list(current, approvable: true),
                          _list(history, approvable: false),
                        ],
                      ),
          ),
        ],
      ),
    );
  }

  Widget _errorView() => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: Colors.red, size: 40),
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              child: Text('Failed to load GRNs.\n$_error',
                  textAlign: TextAlign.center),
            ),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh),
              label: const Text('Retry'),
            ),
          ],
        ),
      );

  Widget _list(List<Map<String, dynamic>> rows, {required bool approvable}) {
    if (rows.isEmpty) {
      return RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          children: [
            SizedBox(
              height: 320,
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                        approvable
                            ? Icons.inbox_outlined
                            : Icons.history_toggle_off,
                        size: 44,
                        color: Colors.grey.shade400),
                    const SizedBox(height: 10),
                    Text(
                      approvable
                          ? 'No GRNs pending approval'
                          : 'No approved GRNs yet',
                      style: TextStyle(color: Colors.grey.shade600),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        itemCount: rows.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (_, i) => _card(rows[i], approvable: approvable),
      ),
    );
  }

  Widget _card(Map<String, dynamic> g, {required bool approvable}) {
    final id = _str(g, ['id']);
    final busy = _busy.contains(id);
    final posted = _isApproved(g);
    final po = _str(g, ['po_number']);
    final supplier = _str(g, ['supplier_name'], fallback: 'N/A');
    final items = _str(g, ['total_items'], fallback: '0');
    final value = _n(g['total_value']);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFEFF6FF),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.receipt_long, color: _navy),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_str(g, ['grn_number'], fallback: 'GRN'),
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 15)),
                    const SizedBox(height: 2),
                    Text(
                      '${po.isEmpty ? 'No PO' : 'PO: $po'}  ·  $supplier',
                      style: TextStyle(
                          color: Colors.grey.shade600, fontSize: 12.5),
                    ),
                    Text(
                      '${_fmtDate(g)}  ·  $items item(s)  ·  KES ${_money.format(value)}',
                      style: TextStyle(
                          color: Colors.grey.shade600, fontSize: 12.5),
                    ),
                  ],
                ),
              ),
              _statusChip(posted, _str(g, ['status'], fallback: 'draft')),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _actionBtn(
                icon: Icons.visibility_outlined,
                label: 'View',
                onTap: busy ? null : () => _view(g),
              ),
              const SizedBox(width: 8),
              _actionBtn(
                icon: Icons.print_outlined,
                label: 'Print',
                onTap: busy ? null : () => _print(g),
              ),
              const Spacer(),
              if (approvable && !posted)
                busy
                    ? const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 12),
                        child: SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2)),
                      )
                    : FilledButton.icon(
                        style: FilledButton.styleFrom(backgroundColor: _blue),
                        onPressed: () => _approve(g),
                        icon: const Icon(Icons.check, size: 18),
                        label: const Text('Approve'),
                      ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _actionBtn(
      {required IconData icon,
      required String label,
      required VoidCallback? onTap}) {
    return OutlinedButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 18),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: _navy,
        side: BorderSide(color: Colors.grey.shade300),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
    );
  }

  Widget _statusChip(bool posted, String status) {
    final color = posted ? const Color(0xFF2E7D32) : const Color(0xFFE65100);
    final bg = posted ? const Color(0xFFE8F5E9) : const Color(0xFFFFF3E0);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(
        posted ? 'APPROVED' : status.toUpperCase(),
        style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 11),
      ),
    );
  }
}

class _GrnDetailDialog extends StatelessWidget {
  final Map<String, dynamic> grn;
  final NumberFormat money;
  final bool posted;
  const _GrnDetailDialog(
      {required this.grn, required this.money, required this.posted});

  String _s(List<String> keys, {String fallback = '—'}) {
    for (final k in keys) {
      final v = grn[k];
      if (v != null && v.toString().trim().isNotEmpty) return v.toString();
    }
    return fallback;
  }

  double _n(dynamic v) => double.tryParse('${v ?? ''}') ?? 0;

  @override
  Widget build(BuildContext context) {
    final items = (grn['items'] is List)
        ? List<Map<String, dynamic>>.from(
            (grn['items'] as List).map((e) => Map<String, dynamic>.from(e as Map)))
        : <Map<String, dynamic>>[];

    return Dialog(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720, maxHeight: 640),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                color: Color(0xFF173D5F),
                borderRadius: BorderRadius.vertical(top: Radius.circular(4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.receipt_long, color: Colors.white),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _s(['grn_number'], fallback: 'GRN'),
                      style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, color: Colors.white),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 24,
                      runSpacing: 10,
                      children: [
                        _field('PO Number', _s(['po_number'])),
                        _field('Supplier', _s(['supplier_name'])),
                        _field('GRN Date', _s(['grn_date', 'delivery_date'])),
                        _field('Delivery Note', _s(['delivery_note_number'])),
                        _field('Invoice No.', _s(['invoice_number'])),
                        _field('Vehicle', _s(['vehicle_number'])),
                        _field('Driver', _s(['driver_name'])),
                        _field('Status', posted ? 'APPROVED' : _s(['status'])),
                      ],
                    ),
                    const SizedBox(height: 16),
                    const Text('Items',
                        style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    _itemsTable(items),
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerRight,
                      child: Text(
                        'Total: KES ${money.format(_n(grn['total_value']))}',
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(String label, String value) => SizedBox(
        width: 150,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label.toUpperCase(),
                style: TextStyle(fontSize: 10, color: Colors.grey.shade600)),
            const SizedBox(height: 2),
            Text(value,
                style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          ],
        ),
      );

  Widget _itemsTable(List<Map<String, dynamic>> items) {
    if (items.isEmpty) {
      return Text('No line items.',
          style: TextStyle(color: Colors.grey.shade600));
    }
    String iname(Map it) {
      final nested = it['item'];
      if (nested is Map && '${nested['name'] ?? ''}'.trim().isNotEmpty) {
        return '${nested['name']}';
      }
      return '${it['item_name'] ?? it['name'] ?? 'Item'}';
    }

    String isku(Map it) {
      final nested = it['item'];
      if (nested is Map && '${nested['item_code'] ?? ''}'.trim().isNotEmpty) {
        return '${nested['item_code']}';
      }
      return '${it['sku'] ?? ''}';
    }

    double n(dynamic v) => double.tryParse('${v ?? ''}') ?? 0;

    return Table(
      border: TableBorder.all(color: const Color(0xFFE2E8F0)),
      columnWidths: const {
        0: FlexColumnWidth(3),
        1: FlexColumnWidth(1.6),
        2: FlexColumnWidth(1),
        3: FlexColumnWidth(1),
        4: FlexColumnWidth(1.3),
        5: FlexColumnWidth(1.3),
      },
      children: [
        TableRow(
          decoration: const BoxDecoration(color: Color(0xFFF7F9FC)),
          children: const [
            _Th('Item'),
            _Th('SKU'),
            _Th('Ord'),
            _Th('Recv'),
            _Th('Unit Price'),
            _Th('Line Total'),
          ],
        ),
        for (final it in items)
          TableRow(children: [
            _Td(iname(it)),
            _Td(isku(it)),
            _Td('${n(it['quantity_ordered']).toStringAsFixed(0)} ${it['unit'] ?? ''}'.trim()),
            _Td('${n(it['quantity_received']).toStringAsFixed(0)}'),
            _Td(money.format(n(it['unit_price'])), right: true),
            _Td(money.format(n(it['line_total'] ?? it['total_value'])), right: true),
          ]),
      ],
    );
  }
}

class _Th extends StatelessWidget {
  final String text;
  const _Th(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Text(text,
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11)),
      );
}

class _Td extends StatelessWidget {
  final String text;
  final bool right;
  const _Td(this.text, {this.right = false});
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        child: Text(text,
            textAlign: right ? TextAlign.right : TextAlign.left,
            style: const TextStyle(fontSize: 12)),
      );
}
