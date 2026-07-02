import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/food_control_report_repository.dart';

/// Daily Food Control Report — digital STORE STOCKSHEET + CONTROLS, matching
/// the manual spreadsheet layout branch staff already know. Side-by-side
/// panels on wide screens, tab switcher on narrow ones. All numbers are
/// deterministic backend output; the AI summary card below the tables is
/// clearly separated and optional.
class FoodControlReportScreen extends ConsumerStatefulWidget {
  const FoodControlReportScreen({super.key, this.branchId});

  /// Null = signed-in user's own branch.
  final int? branchId;

  @override
  ConsumerState<FoodControlReportScreen> createState() =>
      _FoodControlReportScreenState();
}

class _FoodControlReportScreenState
    extends ConsumerState<FoodControlReportScreen> {
  String _date = DateTime.now().toIso8601String().split('T').first;
  Map<String, dynamic>? _report;
  bool _loading = true;
  String? _error;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final report = await ref
          .read(foodControlReportRepositoryProvider)
          .fetchReport(branchId: widget.branchId, date: _date);
      if (!mounted) return;
      setState(() {
        _report = report;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_date) ?? DateTime.now(),
      firstDate: DateTime(2025),
      lastDate: DateTime.now(),
    );
    if (picked == null) return;
    setState(() => _date = picked.toIso8601String().split('T').first);
    _load();
  }

  Future<void> _export(String format) async {
    setState(() => _exporting = true);
    try {
      final path = await ref
          .read(foodControlReportRepositoryProvider)
          .downloadExport(branchId: widget.branchId, date: _date, format: format);
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text('Saved to $path')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Export failed: $e'), backgroundColor: Colors.red));
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F6FA),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        title: const Text('Daily Food Control Report',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
        actions: [
          TextButton.icon(
            style: TextButton.styleFrom(foregroundColor: Colors.white),
            onPressed: _pickDate,
            icon: const Icon(Icons.calendar_today, size: 15),
            label: Text(_date, style: const TextStyle(fontSize: 12)),
          ),
          IconButton(
            tooltip: 'Export Excel',
            onPressed: _exporting ? null : () => _export('xlsx'),
            icon: const Icon(Icons.grid_on),
          ),
          IconButton(
            tooltip: 'Export PDF',
            onPressed: _exporting ? null : () => _export('pdf'),
            icon: const Icon(Icons.picture_as_pdf_outlined),
          ),
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      FilledButton(onPressed: _load, child: const Text('Try again')),
                    ],
                  ),
                )
              : _ReportBody(report: _report ?? const {}),
    );
  }
}

class _ReportBody extends StatelessWidget {
  const _ReportBody({required this.report});

  final Map<String, dynamic> report;

  List<Map<String, dynamic>> _rows(String key) =>
      ((report[key] as List?) ?? const [])
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .toList();

  @override
  Widget build(BuildContext context) {
    final left = _rows('left_panel');
    final right = _rows('right_panel');
    final warnings =
        ((report['warnings'] as List?) ?? const []).map((e) => '$e').toList();
    final ai = report['ai_summary'] is Map
        ? Map<String, dynamic>.from(report['ai_summary'] as Map)
        : null;
    final totals = report['totals'] is Map
        ? Map<String, dynamic>.from(report['totals'] as Map)
        : const <String, dynamic>{};
    final provisional = report['is_provisional'] == true;

    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: provisional ? Colors.blue.shade700 : Colors.green.shade700,
                borderRadius: BorderRadius.circular(4),
              ),
              child: Text(provisional ? 'LIVE / PROVISIONAL' : 'FINALIZED',
                  style: const TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Colors.white)),
            ),
            const Spacer(),
            Text(
              'Total Shorts.v: KES ${_num(totals['controls_shorts_value']).toStringAsFixed(0)}',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                fontSize: 13,
                color: _num(totals['controls_shorts_value']) < 0
                    ? const Color(0xFFC62828)
                    : const Color(0xFF2E7D32),
              ),
            ),
          ],
        ),
        if (warnings.isNotEmpty) ...[
          const SizedBox(height: 8),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.orange.shade50,
              border: Border.all(color: Colors.orange.shade200),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('OPENING-STOCK WARNINGS',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: Colors.orange.shade900)),
                const SizedBox(height: 4),
                for (final w in warnings.take(6))
                  Text('• $w',
                      style: TextStyle(
                          fontSize: 11, color: Colors.orange.shade900)),
              ],
            ),
          ),
        ],
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            final wide = constraints.maxWidth >= 1100;
            final leftPanel = _PanelTable(
              title: 'STORE STOCKSHEET',
              headers: const [
                'ITEMS', 'O.P/STOCK', 'ADD', 'TOTALS', 'ISSUED', 'C.L/STOCK',
                'C.PRICE', 'O.P VALUE', 'ADD VALUE', 'C.L VALUE',
              ],
              rows: [
                for (final r in left)
                  [
                    r['item_name'], r['opening'], r['added'], r['totals'],
                    r['issued'], r['closing'], r['cost_price'],
                    r['opening_value'], r['add_value'], r['closing_value'],
                  ],
              ],
            );
            final rightPanel = _PanelTable(
              title: 'CONTROLS',
              highlightLastColumn: true,
              headers: const [
                'ITEMS', 'O.P/STOCK', 'ADDED', 'TOTALS', 'C.STOCK', 'REJECTS',
                'EXPECTED', 'SYSTEM SALES', 'VAR.', 's.p', 'Shorts.v',
              ],
              rows: [
                for (final r in right)
                  [
                    r['item_name'], r['opening'], r['added'], r['totals'],
                    r['closing'], r['rejects'], r['expected'],
                    r['system_sales'], r['variance'], r['selling_price'],
                    r['shorts_value'],
                  ],
              ],
            );
            if (wide) {
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: leftPanel),
                  const SizedBox(width: 12),
                  Expanded(child: rightPanel),
                ],
              );
            }
            return DefaultTabController(
              length: 2,
              child: Column(
                children: [
                  const TabBar(
                    labelColor: Color(0xFF1565C0),
                    tabs: [Tab(text: 'Store Stocksheet'), Tab(text: 'Controls')],
                  ),
                  SizedBox(
                    height: 560,
                    child: TabBarView(children: [
                      SingleChildScrollView(child: leftPanel),
                      SingleChildScrollView(child: rightPanel),
                    ]),
                  ),
                ],
              ),
            );
          },
        ),
        const SizedBox(height: 12),
        if (ai != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.indigo.shade50,
              border: Border.all(color: Colors.indigo.shade100),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('AI SUMMARY (interpretive — the tables above are the record)',
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: Colors.indigo.shade900)),
                const SizedBox(height: 6),
                Text('${ai['summary'] ?? ''}',
                    style: const TextStyle(fontSize: 12.5, height: 1.45)),
                for (final f in ((ai['flags'] as List?) ?? const []))
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('• $f',
                        style: TextStyle(
                            fontSize: 11.5, color: Colors.indigo.shade900)),
                  ),
              ],
            ),
          )
        else
          Text('Basic report — AI summary unavailable for this day.',
              style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
      ],
    );
  }
}

num _num(dynamic v) => v is num ? v : num.tryParse('$v') ?? 0;

class _PanelTable extends StatelessWidget {
  const _PanelTable({
    required this.title,
    required this.headers,
    required this.rows,
    this.highlightLastColumn = false,
  });

  final String title;
  final List<String> headers;
  final List<List<dynamic>> rows;
  final bool highlightLastColumn;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      padding: const EdgeInsets.all(10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style:
                  const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
          const SizedBox(height: 6),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text('No rows for this day.',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
            )
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowHeight: 34,
                dataRowMinHeight: 30,
                dataRowMaxHeight: 34,
                columnSpacing: 14,
                headingTextStyle: const TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w800,
                    color: Colors.black87),
                columns: [
                  for (final h in headers) DataColumn(label: Text(h)),
                ],
                rows: [
                  for (final row in rows)
                    DataRow(cells: [
                      for (var i = 0; i < row.length; i++)
                        DataCell(Text(
                          row[i] is num
                              ? (row[i] as num).toStringAsFixed(
                                  (row[i] as num) % 1 == 0 ? 0 : 2)
                              : '${row[i] ?? ''}',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight:
                                highlightLastColumn && i == row.length - 1
                                    ? FontWeight.w700
                                    : FontWeight.normal,
                            color: highlightLastColumn &&
                                    i == row.length - 1 &&
                                    row[i] is num
                                ? ((row[i] as num) < 0
                                    ? const Color(0xFFC62828)
                                    : (row[i] as num) > 0
                                        ? const Color(0xFF2E7D32)
                                        : Colors.black87)
                                : Colors.black87,
                          ),
                        )),
                    ]),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
