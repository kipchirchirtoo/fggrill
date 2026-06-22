import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/kes_text.dart';
import '../data/branch_storekeeper_repository.dart';

/// Wastage Report — Branch Storekeeper.
class WastageReportScreen extends ConsumerStatefulWidget {
  const WastageReportScreen({super.key});

  @override
  ConsumerState<WastageReportScreen> createState() =>
      _WastageReportScreenState();
}

class _WastageReportScreenState extends ConsumerState<WastageReportScreen> {
  late String _from =
      DateFormat('yyyy-MM-dd').format(DateTime.now().subtract(const Duration(days: 30)));
  late String _to = DateFormat('yyyy-MM-dd').format(DateTime.now());
  late Future<Map<String, dynamic>> _future = _load();
  bool _exporting = false;

  Future<Map<String, dynamic>> _load() => ref
      .read(branchStorekeeperRepositoryProvider)
      .kitchenWastageReport(fromDate: _from, toDate: _to);

  void _apply() => setState(() => _future = _load());

  Future<void> _exportPdf(Map<String, dynamic> data) async {
    setState(() => _exporting = true);
    try {
      final doc = pw.Document();
      final byCategory = data['by_category'] is Map
          ? Map<String, dynamic>.from(data['by_category'])
          : <String, dynamic>{};
      final topItems = (data['top_10_wastage_items'] as List? ?? [])
          .whereType<Map>()
          .toList();
      doc.addPage(
        pw.Page(
          pageFormat: PdfPageFormat.a4,
          build: (context) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text('Wastage Report',
                  style: pw.TextStyle(
                      fontSize: 20, fontWeight: pw.FontWeight.bold)),
              pw.Text('$_from to $_to'),
              pw.SizedBox(height: 12),
              pw.Text(
                  'Total Wastage Cost: KES ${_num(data['total_wastage_cost']).toStringAsFixed(2)}'),
              pw.SizedBox(height: 12),
              pw.Text('By Category',
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
              ...byCategory.entries
                  .map((e) => pw.Text('${e.key}: ${e.value}')),
              pw.SizedBox(height: 12),
              pw.Text('Top Wastage Items',
                  style: pw.TextStyle(fontWeight: pw.FontWeight.bold)),
              ...topItems.map((i) => pw.Text(
                  '${i['item_name']}: KES ${_num(i['total_variance_cost']).toStringAsFixed(2)}')),
            ],
          ),
        ),
      );
      await Printing.layoutPdf(onLayout: (_) => doc.save());
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Wastage Report')),
      body: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snap) {
          final data = snap.data ?? {};
          final byCategory = data['by_category'] is Map
              ? Map<String, dynamic>.from(data['by_category'])
              : <String, dynamic>{};
          final topItems = (data['top_10_wastage_items'] as List? ?? [])
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
          final byChef = (data['by_chef'] as List? ?? [])
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
          final dailyTrend = (data['daily_trend'] as List? ?? [])
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Wrap(
                spacing: 12,
                runSpacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  _dateField('From', _from, (v) => setState(() => _from = v)),
                  _dateField('To', _to, (v) => setState(() => _to = v)),
                  FilledButton(onPressed: _apply, child: const Text('Apply')),
                  OutlinedButton.icon(
                    onPressed:
                        _exporting ? null : () => _exportPdf(data),
                    icon: const Icon(Icons.picture_as_pdf),
                    label: Text(_exporting ? 'Exporting…' : 'Export PDF'),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (snap.connectionState == ConnectionState.waiting)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 40),
                  child: Center(child: CircularProgressIndicator()),
                )
              else ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.kDivider),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.warning_amber, color: Colors.red),
                      const SizedBox(width: 10),
                      const Text('Total Wastage Cost',
                          style: TextStyle(fontWeight: FontWeight.w700)),
                      const Spacer(),
                      KesText(_num(data['total_wastage_cost']),
                          style: const TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w900,
                              color: Colors.red)),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                _chartCard(
                  'By Category',
                  byCategory.isEmpty
                      ? _emptyChart('No category data available')
                      : SizedBox(
                          height: 240,
                          child: Row(
                            children: [
                              Expanded(
                                child: PieChart(PieChartData(
                                  sections: byCategory.entries
                                      .map((e) => PieChartSectionData(
                                            value: _num(e.value).toDouble(),
                                            color: _categoryColor(e.key),
                                            title: e.key
                                                .replaceAll('_', ' ')
                                                .split(' ')
                                                .map((w) => w.isEmpty
                                                    ? w
                                                    : w[0].toUpperCase() +
                                                        w.substring(1))
                                                .join(' '),
                                            titleStyle: const TextStyle(
                                                fontSize: 9,
                                                color: Colors.white,
                                                fontWeight: FontWeight.bold),
                                            radius: 90,
                                          ))
                                      .toList(),
                                  centerSpaceRadius: 24,
                                )),
                              ),
                            ],
                          ),
                        ),
                ),
                _chartCard(
                  'Top 10 Wastage Items',
                  topItems.isEmpty
                      ? _emptyChart('No wastage items recorded')
                      : SizedBox(
                          height: 46.0 * topItems.length.clamp(1, 10) + 20,
                          child: BarChart(BarChartData(
                            alignment: BarChartAlignment.spaceAround,
                            barGroups: topItems.take(10).toList().asMap().entries.map(
                                (e) => BarChartGroupData(x: e.key, barRods: [
                                      BarChartRodData(
                                        toY: _num(e.value['total_variance_cost'])
                                            .toDouble(),
                                        color: Colors.redAccent,
                                        width: 16,
                                      ),
                                    ])).toList(),
                            titlesData: FlTitlesData(
                              rightTitles: const AxisTitles(
                                  sideTitles: SideTitles(showTitles: false)),
                              topTitles: const AxisTitles(
                                  sideTitles: SideTitles(showTitles: false)),
                              leftTitles: AxisTitles(
                                sideTitles: SideTitles(
                                  showTitles: true,
                                  reservedSize: 100,
                                  getTitlesWidget: (value, meta) {
                                    final idx = value.round();
                                    if (idx < 0 || idx >= topItems.length) {
                                      return const SizedBox.shrink();
                                    }
                                    return Text(
                                        '${topItems[idx]['item_name'] ?? ''}',
                                        style: const TextStyle(fontSize: 9));
                                  },
                                ),
                              ),
                              bottomTitles: const AxisTitles(
                                  sideTitles: SideTitles(showTitles: true)),
                            ),
                          )),
                        ),
                ),
                _chartCard(
                  'Wastage by Chef',
                  byChef.isEmpty
                      ? _emptyChart('No chef-level data available')
                      : SizedBox(
                          height: 260,
                          child: BarChart(BarChartData(
                            barGroups: byChef.asMap().entries.map(
                                (e) => BarChartGroupData(x: e.key, barRods: [
                                      BarChartRodData(
                                        toY: _num(e.value['total_variance_cost'])
                                            .toDouble(),
                                        color: Colors.deepOrange,
                                        width: 18,
                                      ),
                                    ])).toList(),
                            titlesData: FlTitlesData(
                              rightTitles: const AxisTitles(
                                  sideTitles: SideTitles(showTitles: false)),
                              topTitles: const AxisTitles(
                                  sideTitles: SideTitles(showTitles: false)),
                              bottomTitles: AxisTitles(
                                sideTitles: SideTitles(
                                  showTitles: true,
                                  getTitlesWidget: (value, meta) {
                                    final idx = value.round();
                                    if (idx < 0 || idx >= byChef.length) {
                                      return const SizedBox.shrink();
                                    }
                                    return Text(
                                        '${byChef[idx]['chef_name'] ?? ''}',
                                        style: const TextStyle(fontSize: 9));
                                  },
                                ),
                              ),
                            ),
                          )),
                        ),
                ),
                _chartCard(
                  'Daily Trend',
                  dailyTrend.isEmpty
                      ? _emptyChart('No daily trend data available')
                      : SizedBox(
                          height: 240,
                          child: LineChart(LineChartData(
                            lineBarsData: [
                              LineChartBarData(
                                spots: dailyTrend
                                    .asMap()
                                    .entries
                                    .map((e) => FlSpot(e.key.toDouble(),
                                        _num(e.value['wastage_cost']).toDouble()))
                                    .toList(),
                                isCurved: true,
                                color: Colors.red,
                                barWidth: 3,
                              ),
                            ],
                            titlesData: const FlTitlesData(
                              rightTitles:
                                  AxisTitles(sideTitles: SideTitles(showTitles: false)),
                              topTitles:
                                  AxisTitles(sideTitles: SideTitles(showTitles: false)),
                            ),
                          )),
                        ),
                ),
                _chartCard(
                  'Expected vs Actual vs POS',
                  dailyTrend.isEmpty
                      ? _emptyChart('No raw-usage data available')
                      : SizedBox(
                          height: 260,
                          child: Column(
                            children: [
                              Expanded(
                                child: LineChart(LineChartData(
                                  lineBarsData: [
                                    LineChartBarData(
                                      spots: dailyTrend
                                          .asMap()
                                          .entries
                                          .map((e) => FlSpot(
                                              e.key.toDouble(),
                                              _num(e.value['expected_raw_usage'])
                                                  .toDouble()))
                                          .toList(),
                                      isCurved: true,
                                      color: Colors.blue,
                                      barWidth: 2,
                                      dotData: const FlDotData(show: false),
                                    ),
                                    LineChartBarData(
                                      spots: dailyTrend
                                          .asMap()
                                          .entries
                                          .map((e) => FlSpot(
                                              e.key.toDouble(),
                                              _num(e.value['actual_raw_usage'])
                                                  .toDouble()))
                                          .toList(),
                                      isCurved: true,
                                      color: Colors.red,
                                      barWidth: 2,
                                      dotData: const FlDotData(show: false),
                                    ),
                                    LineChartBarData(
                                      spots: dailyTrend
                                          .asMap()
                                          .entries
                                          .map((e) => FlSpot(
                                              e.key.toDouble(),
                                              _num(e.value['pos_sales_consumption'])
                                                  .toDouble()))
                                          .toList(),
                                      isCurved: true,
                                      color: Colors.green,
                                      barWidth: 2,
                                      dotData: const FlDotData(show: false),
                                    ),
                                  ],
                                )),
                              ),
                              const SizedBox(height: 8),
                              Wrap(spacing: 16, children: const [
                                _LegendDot(color: Colors.blue, label: 'Expected'),
                                _LegendDot(color: Colors.red, label: 'Actual'),
                                _LegendDot(color: Colors.green, label: 'POS'),
                              ]),
                            ],
                          ),
                        ),
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _dateField(String label, String value, ValueChanged<String> onChanged) {
    return SizedBox(
      width: 160,
      child: TextField(
        readOnly: true,
        controller: TextEditingController(text: value),
        decoration: InputDecoration(labelText: label),
        onTap: () async {
          final picked = await showDatePicker(
            context: context,
            initialDate: DateTime.tryParse(value) ?? DateTime.now(),
            firstDate: DateTime(2020),
            lastDate: DateTime.now(),
          );
          if (picked != null) {
            onChanged(DateFormat('yyyy-MM-dd').format(picked));
          }
        },
      ),
    );
  }

  Widget _chartCard(String title, Widget child) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.kDivider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _emptyChart(String message) => SizedBox(
        height: 120,
        child: Center(
            child: Text(message,
                style: const TextStyle(color: AppColors.kTextSecondary))),
      );

  Color _categoryColor(String key) {
    switch (key) {
      case 'recipe_variance':
        return Colors.orange;
      case 'spoilage':
        return Colors.red;
      case 'unexplained_shortage':
        return Colors.purple;
      case 'production_shortfall':
        return Colors.blueGrey;
      default:
        return Colors.grey;
    }
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color, required this.label});
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(
          width: 10,
          height: 10,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 6),
      Text(label, style: const TextStyle(fontSize: 12)),
    ]);
  }
}

num _num(dynamic v) => v is num ? v : num.tryParse('${v ?? 0}') ?? 0;
