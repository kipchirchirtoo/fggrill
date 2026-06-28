import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme/app_theme.dart';
import '../utils/readable_record.dart';

Future<T?> openRecordDetailScreen<T>(
  BuildContext context, {
  required Map<String, dynamic> record,
  String title = 'Details',
  String? subtitle,
  List<Widget> actions = const [],
}) {
  return Navigator.of(context).push<T>(
    MaterialPageRoute(
      builder: (_) => RecordDetailScreen(
        record: record,
        title: title,
        subtitle: subtitle,
        actions: actions,
      ),
    ),
  );
}

class RecordDetailScreen extends StatefulWidget {
  const RecordDetailScreen({
    super.key,
    required this.record,
    this.title = 'Details',
    this.subtitle,
    this.actions = const [],
    this.limit = 80,
  });

  final Map<String, dynamic> record;
  final String title;
  final String? subtitle;
  final List<Widget> actions;
  final int limit;

  @override
  State<RecordDetailScreen> createState() => _RecordDetailScreenState();
}

class _RecordDetailScreenState extends State<RecordDetailScreen> {
  @override
  Widget build(BuildContext context) {
    final model = _EntityDetailModel.fromRecord(
      widget.record,
      title: widget.title,
      subtitle: widget.subtitle,
      limit: widget.limit,
    );
    final tabs = <Tab>[
      const Tab(icon: Icon(Icons.dashboard_outlined), text: 'Overview'),
      Tab(
        icon: const Icon(Icons.table_rows_outlined),
        text:
            'Items (${model.tables.fold<int>(0, (sum, t) => sum + t.rows.length)})',
      ),
      const Tab(icon: Icon(Icons.timeline_outlined), text: 'Activity'),
      const Tab(icon: Icon(Icons.settings_outlined), text: 'Technical'),
    ];

    return DefaultTabController(
      length: tabs.length,
      child: Scaffold(
        backgroundColor: AppColors.kSurface,
        appBar: AppBar(
          title: Text(widget.title, overflow: TextOverflow.ellipsis),
          actions: [
            IconButton(
              tooltip: 'Copy reference',
              onPressed: model.reference.isEmpty
                  ? null
                  : () => _copy(model.reference, 'Reference copied'),
              icon: const Icon(Icons.copy_rounded),
            ),
            ...widget.actions,
            const SizedBox(width: 8),
          ],
          bottom: TabBar(
            isScrollable: true,
            tabs: tabs,
          ),
        ),
        body: SafeArea(
          child: TabBarView(
            children: [
              _OverviewTab(model: model),
              _ItemsTab(tables: model.tables),
              _ActivityTab(model: model),
              _TechnicalTab(model: model),
            ],
          ),
        ),
      ),
    );
  }

  void _copy(String value, String message) {
    Clipboard.setData(ClipboardData(text: value));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }
}

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({required this.model});

  final _EntityDetailModel model;

  @override
  Widget build(BuildContext context) {
    return _DetailScroll(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _EntityHeaderCard(model: model),
          if (model.metrics.isNotEmpty) ...[
            const SizedBox(height: 16),
            _SummaryMetricGrid(metrics: model.metrics),
          ],
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              final twoColumn = constraints.maxWidth >= 860;
              final info = _InfoCard(
                title: 'Business Information',
                icon: Icons.fact_check_outlined,
                entries: model.businessEntries,
              );
              final related = _InfoCard(
                title: 'People & Branches',
                icon: Icons.account_tree_outlined,
                entries: model.relationEntries,
              );
              if (!twoColumn) {
                return Column(
                  children: [
                    info,
                    const SizedBox(height: 12),
                    related,
                  ],
                );
              }
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: info),
                  const SizedBox(width: 12),
                  Expanded(child: related),
                ],
              );
            },
          ),
          if (model.attachments.isNotEmpty) ...[
            const SizedBox(height: 16),
            _AttachmentGallery(attachments: model.attachments),
          ],
          const SizedBox(height: 16),
          _AnalyticsCard(model: model),
        ],
      ),
    );
  }
}

class _ItemsTab extends StatelessWidget {
  const _ItemsTab({required this.tables});

  final List<_EntityTableModel> tables;

  @override
  Widget build(BuildContext context) {
    return _DetailScroll(
      child: tables.isEmpty
          ? const _EmptyState(
              icon: Icons.table_rows_outlined,
              title: 'No line items',
              message: 'This record does not include itemized rows.',
            )
          : Column(
              children: tables
                  .map(
                    (table) => Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: _EntityDataTable(table: table),
                    ),
                  )
                  .toList(),
            ),
    );
  }
}

class _ActivityTab extends StatelessWidget {
  const _ActivityTab({required this.model});

  final _EntityDetailModel model;

  @override
  Widget build(BuildContext context) {
    return _DetailScroll(
      child: Column(
        children: [
          _TimelineCard(events: model.timeline),
          const SizedBox(height: 16),
          _ActivityFeed(events: model.activity),
        ],
      ),
    );
  }
}

class _TechnicalTab extends StatelessWidget {
  const _TechnicalTab({required this.model});

  final _EntityDetailModel model;

  @override
  Widget build(BuildContext context) {
    return _DetailScroll(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _InfoCard(
            title: 'Audit Information',
            icon: Icons.verified_user_outlined,
            entries: model.auditEntries,
          ),
          const SizedBox(height: 16),
          _TechnicalDetails(entries: model.technicalEntries),
        ],
      ),
    );
  }
}

class _DetailScroll extends StatelessWidget {
  const _DetailScroll({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 1180),
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [child],
        ),
      ),
    );
  }
}

class _EntityHeaderCard extends StatelessWidget {
  const _EntityHeaderCard({required this.model});

  final _EntityDetailModel model;

  @override
  Widget build(BuildContext context) {
    final statusColor = _statusColor(model.status);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF173D5F), Color(0xFF24577E)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: AppColors.kPrimary.withValues(alpha: 0.16),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 720;
          final details = Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                model.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                ),
              ),
              if (model.subtitle.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  model.subtitle,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.78),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
              const SizedBox(height: 14),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (model.status.isNotEmpty)
                    _EnterpriseStatusChip(model.status, color: statusColor),
                  if (model.reference.isNotEmpty)
                    _HeaderPill(Icons.tag_outlined, model.reference),
                  if (model.branch.isNotEmpty)
                    _HeaderPill(Icons.business_outlined, model.branch),
                  if (model.createdAt.isNotEmpty)
                    _HeaderPill(Icons.schedule_outlined, model.createdAt),
                ],
              ),
            ],
          );
          final avatar = Container(
            width: 66,
            height: 66,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.22)),
            ),
            child: Icon(model.icon, color: Colors.white, size: 34),
          );

          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                avatar,
                const SizedBox(height: 14),
                details,
              ],
            );
          }
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              avatar,
              const SizedBox(width: 16),
              Expanded(child: details),
            ],
          );
        },
      ),
    );
  }
}

class _HeaderPill extends StatelessWidget {
  const _HeaderPill(this.icon, this.label);

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 15),
          const SizedBox(width: 6),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 260),
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EnterpriseStatusChip extends StatelessWidget {
  const _EnterpriseStatusChip(this.status, {required this.color});

  final String status;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.16),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.42)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 7),
          Text(
            readableStatus(status).toUpperCase(),
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryMetricGrid extends StatelessWidget {
  const _SummaryMetricGrid({required this.metrics});

  final List<_MetricModel> metrics;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final count = width >= 980
            ? 4
            : width >= 700
                ? 3
                : width >= 460
                    ? 2
                    : 1;
        return GridView.count(
          crossAxisCount: count,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: width < 460 ? 4.3 : 3.1,
          children: metrics.take(8).map((metric) {
            return _SummaryMetricCard(metric: metric);
          }).toList(),
        );
      },
    );
  }
}

class _SummaryMetricCard extends StatelessWidget {
  const _SummaryMetricCard({required this.metric});

  final _MetricModel metric;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: metric.color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(metric.icon, color: metric.color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  metric.value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  metric.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.title,
    required this.icon,
    required this.entries,
  });

  final String title;
  final IconData icon;
  final List<MapEntry<String, dynamic>> entries;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionTitle(title: title, icon: icon),
          const SizedBox(height: 12),
          if (entries.isEmpty)
            const Text(
              'No business details available.',
              style: TextStyle(color: AppColors.kTextSecondary),
            )
          else
            ...entries.map((entry) => _DetailFact(entry: entry)),
        ],
      ),
    );
  }
}

class _DetailFact extends StatelessWidget {
  const _DetailFact({required this.entry});

  final MapEntry<String, dynamic> entry;

  @override
  Widget build(BuildContext context) {
    final value = readableRecordValue(const {}, entry.key, entry.value);
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 150,
            child: Text(
              readableRecordLabel(entry.key),
              style: const TextStyle(
                color: AppColors.kTextSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          Expanded(
            child: SelectableText(
              value,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _EntityDataTable extends StatefulWidget {
  const _EntityDataTable({required this.table});

  final _EntityTableModel table;

  @override
  State<_EntityDataTable> createState() => _EntityDataTableState();
}

class _EntityDataTableState extends State<_EntityDataTable> {
  String _query = '';
  String? _sortKey;
  bool _sortAscending = true;

  @override
  Widget build(BuildContext context) {
    var rows = widget.table.rows.where((row) {
      if (_query.trim().isEmpty) return true;
      final needle = _query.toLowerCase();
      return row.values.any((value) => '$value'.toLowerCase().contains(needle));
    }).toList();

    if (_sortKey != null) {
      rows.sort((a, b) {
        final av = _cellText(a, _sortKey!);
        final bv = _cellText(b, _sortKey!);
        final an = num.tryParse(av.replaceAll(',', ''));
        final bn = num.tryParse(bv.replaceAll(',', ''));
        final result =
            an != null && bn != null ? an.compareTo(bn) : av.compareTo(bv);
        return _sortAscending ? result : -result;
      });
    }

    return _SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: _SectionTitle(
                  title: widget.table.title,
                  icon: Icons.table_chart_outlined,
                ),
              ),
              OutlinedButton.icon(
                onPressed: () => _copyTable(rows),
                icon: const Icon(Icons.download_outlined, size: 18),
                label: const Text('Export'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              hintText: 'Search this table',
              prefixIcon: Icon(Icons.search),
              isDense: true,
            ),
            onChanged: (value) => setState(() => _query = value),
          ),
          const SizedBox(height: 12),
          if (rows.isEmpty)
            const _EmptyState(
              icon: Icons.search_off_outlined,
              title: 'No matching rows',
              message: 'Try another search term.',
            )
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowColor: WidgetStatePropertyAll(Colors.grey.shade100),
                sortAscending: _sortAscending,
                sortColumnIndex: _sortKey == null
                    ? null
                    : widget.table.columns.indexOf(_sortKey!),
                columns: widget.table.columns.map((column) {
                  return DataColumn(
                    label: Text(readableRecordLabel(column)),
                    onSort: (_, ascending) {
                      setState(() {
                        _sortKey = column;
                        _sortAscending = ascending;
                      });
                    },
                  );
                }).toList(),
                rows: rows
                    .take(100)
                    .map(
                      (row) => DataRow(
                        cells: widget.table.columns.map((column) {
                          final text = _cellText(row, column);
                          return DataCell(
                            ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 220),
                              child: Text(
                                text,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    )
                    .toList(),
              ),
            ),
          if (rows.length > 100) ...[
            const SizedBox(height: 8),
            Text(
              'Showing first 100 of ${rows.length} rows. Use search to narrow results.',
              style: const TextStyle(color: AppColors.kTextSecondary),
            ),
          ],
        ],
      ),
    );
  }

  String _cellText(Map<String, dynamic> row, String column) {
    final value = row[column];
    if (value == null) return '-';
    if (value is Map) return readableMapName(value) ?? 'Linked record';
    if (value is List) return '${value.length} items';
    return readableRecordValue(row, column, value);
  }

  void _copyTable(List<Map<String, dynamic>> rows) {
    final lines = <String>[
      widget.table.columns.map(readableRecordLabel).join('\t'),
      ...rows.map((row) => widget.table.columns
          .map((column) => _cellText(row, column).replaceAll('\n', ' '))
          .join('\t')),
    ];
    Clipboard.setData(ClipboardData(text: lines.join('\n')));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${widget.table.title} copied as table text')),
    );
  }
}

class _TimelineCard extends StatelessWidget {
  const _TimelineCard({required this.events});

  final List<_TimelineEvent> events;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(
            title: 'Workflow Timeline',
            icon: Icons.timeline_outlined,
          ),
          const SizedBox(height: 12),
          if (events.isEmpty)
            const Text(
              'No timeline events were found for this record.',
              style: TextStyle(color: AppColors.kTextSecondary),
            )
          else
            ...events.map((event) => _TimelineRow(event: event)),
        ],
      ),
    );
  }
}

class _TimelineRow extends StatelessWidget {
  const _TimelineRow({required this.event});

  final _TimelineEvent event;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(event.label);
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(event.icon, color: color, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  event.label,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                const SizedBox(height: 2),
                Text(
                  readableDateTime(event.value),
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ActivityFeed extends StatelessWidget {
  const _ActivityFeed({required this.events});

  final List<_ActivityEvent> events;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(
            title: 'Activity Feed',
            icon: Icons.dynamic_feed_outlined,
          ),
          const SizedBox(height: 12),
          if (events.isEmpty)
            const Text(
              'No activity entries are linked to this record.',
              style: TextStyle(color: AppColors.kTextSecondary),
            )
          else
            ...events.map((event) {
              return Material(
                type: MaterialType.transparency,
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                    child: const Icon(Icons.history, color: AppColors.kPrimary),
                  ),
                  title: Text(event.title),
                  subtitle: Text(event.subtitle),
                ),
              );
            }),
        ],
      ),
    );
  }
}

class _AttachmentGallery extends StatelessWidget {
  const _AttachmentGallery({required this.attachments});

  final List<_AttachmentModel> attachments;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(
            title: 'Attachments',
            icon: Icons.attach_file_outlined,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: attachments.map((attachment) {
              return Container(
                width: 220,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Row(
                  children: [
                    Icon(
                      attachment.icon,
                      color: AppColors.kPrimary,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        attachment.label,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _AnalyticsCard extends StatelessWidget {
  const _AnalyticsCard({required this.model});

  final _EntityDetailModel model;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(
            title: 'Operational Snapshot',
            icon: Icons.insights_outlined,
          ),
          const SizedBox(height: 12),
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 700;
              final cards = [
                _SnapshotTile(
                  label: 'Data Quality',
                  value: '${model.visibleEntryCount} readable fields',
                  icon: Icons.check_circle_outline,
                  color: AppColors.kSuccess,
                ),
                _SnapshotTile(
                  label: 'Line Items',
                  value:
                      '${model.tables.fold<int>(0, (sum, t) => sum + t.rows.length)} rows',
                  icon: Icons.table_chart_outlined,
                  color: AppColors.kPrimary,
                ),
                _SnapshotTile(
                  label: 'Timeline Events',
                  value: '${model.timeline.length} events',
                  icon: Icons.timeline_outlined,
                  color: Colors.deepPurple,
                ),
              ];
              if (compact) {
                return Column(
                  children: cards
                      .map((card) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: card,
                          ))
                      .toList(),
                );
              }
              return Row(
                children: cards
                    .map((card) => Expanded(
                          child: Padding(
                            padding: const EdgeInsets.only(right: 10),
                            child: card,
                          ),
                        ))
                    .toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _SnapshotTile extends StatelessWidget {
  const _SnapshotTile({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withValues(alpha: 0.16)),
      ),
      child: Row(
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: const TextStyle(fontWeight: FontWeight.w900),
                ),
                Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TechnicalDetails extends StatelessWidget {
  const _TechnicalDetails({required this.entries});

  final List<MapEntry<String, dynamic>> entries;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionTitle(
            title: 'Technical Details',
            icon: Icons.code_outlined,
          ),
          const SizedBox(height: 8),
          Material(
            type: MaterialType.transparency,
            child: ExpansionTile(
              tilePadding: EdgeInsets.zero,
              title: Text('${entries.length} internal fields hidden'),
              subtitle: const Text('IDs, metadata, raw linked values and flags'),
              children: entries.isEmpty
                  ? const [
                      Padding(
                        padding: EdgeInsets.all(16),
                        child: Text('No technical fields were hidden.'),
                      ),
                    ]
                  : entries
                      .map((entry) => _DetailFact(entry: entry))
                      .toList(growable: false),
            ),
          ),
        ],
      ),
    );
  }
}

class _SurfaceCard extends StatelessWidget {
  const _SurfaceCard({
    required this.child,
    this.padding = const EdgeInsets.all(16),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.55)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.025),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.icon});

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 20, color: AppColors.kPrimary),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            title,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900),
          ),
        ),
      ],
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.message,
  });

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return _SurfaceCard(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Icon(icon, size: 38, color: AppColors.kTextSecondary),
            const SizedBox(height: 10),
            Text(title, style: const TextStyle(fontWeight: FontWeight.w900)),
            const SizedBox(height: 4),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.kTextSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

class _EntityDetailModel {
  const _EntityDetailModel({
    required this.title,
    required this.subtitle,
    required this.status,
    required this.reference,
    required this.branch,
    required this.createdAt,
    required this.icon,
    required this.metrics,
    required this.businessEntries,
    required this.relationEntries,
    required this.auditEntries,
    required this.technicalEntries,
    required this.tables,
    required this.timeline,
    required this.activity,
    required this.attachments,
    required this.visibleEntryCount,
  });

  final String title;
  final String subtitle;
  final String status;
  final String reference;
  final String branch;
  final String createdAt;
  final IconData icon;
  final List<_MetricModel> metrics;
  final List<MapEntry<String, dynamic>> businessEntries;
  final List<MapEntry<String, dynamic>> relationEntries;
  final List<MapEntry<String, dynamic>> auditEntries;
  final List<MapEntry<String, dynamic>> technicalEntries;
  final List<_EntityTableModel> tables;
  final List<_TimelineEvent> timeline;
  final List<_ActivityEvent> activity;
  final List<_AttachmentModel> attachments;
  final int visibleEntryCount;

  factory _EntityDetailModel.fromRecord(
    Map<String, dynamic> record, {
    required String title,
    String? subtitle,
    required int limit,
  }) {
    final reference = _firstText(record, _referenceKeys);
    final status = _firstText(record, _statusKeys);
    final created = _firstText(record, _createdKeys);
    final branch = _branchText(record);
    final entries = readableRecordEntries(record, limit: limit);
    final tables = _extractTables(record);
    final tableKeys = tables.map((t) => t.sourceKey).toSet();
    final attachments = _extractAttachments(record);
    final business = <MapEntry<String, dynamic>>[];
    final relations = <MapEntry<String, dynamic>>[];
    final audit = <MapEntry<String, dynamic>>[];
    final technical = <MapEntry<String, dynamic>>[];

    for (final entry in entries) {
      if (tableKeys.contains(entry.key)) continue;
      if (_isTechnicalKey(entry.key, entry.value)) {
        technical.add(entry);
      } else if (_isAuditKey(entry.key)) {
        audit.add(entry);
      } else if (_isRelationKey(entry.key, entry.value)) {
        relations.add(entry);
      } else {
        business.add(entry);
      }
    }

    return _EntityDetailModel(
      title: reference.isEmpty ? title : '$title $reference',
      subtitle: subtitle?.trim().isNotEmpty == true
          ? subtitle!.trim()
          : _subtitleFor(record),
      status: status,
      reference: reference,
      branch: branch,
      createdAt: created.isEmpty ? '' : readableDateTime(created),
      icon: _iconFor(title, record),
      metrics: _metricEntries(record, tables),
      businessEntries: business.take(18).toList(),
      relationEntries: relations.take(16).toList(),
      auditEntries: audit.take(16).toList(),
      technicalEntries: technical,
      tables: tables,
      timeline: _extractTimeline(record),
      activity: _extractActivity(record),
      attachments: attachments,
      visibleEntryCount: entries.length,
    );
  }
}

class _MetricModel {
  const _MetricModel({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  final String label;
  final String value;
  final IconData icon;
  final Color color;
}

class _EntityTableModel {
  const _EntityTableModel({
    required this.title,
    required this.sourceKey,
    required this.columns,
    required this.rows,
  });

  final String title;
  final String sourceKey;
  final List<String> columns;
  final List<Map<String, dynamic>> rows;
}

class _TimelineEvent {
  const _TimelineEvent({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final dynamic value;
  final IconData icon;
}

class _ActivityEvent {
  const _ActivityEvent({required this.title, required this.subtitle});

  final String title;
  final String subtitle;
}

class _AttachmentModel {
  const _AttachmentModel({
    required this.label,
    required this.url,
    required this.icon,
  });

  final String label;
  final String url;
  final IconData icon;
}

const _referenceKeys = [
  'request_number',
  'po_number',
  'purchase_order_number',
  'invoice_number',
  'grn_number',
  'receipt_number',
  'count_number',
  'take_number',
  'order_number',
  'booking_reference',
  'confirmation_number',
  'staff_number',
  'employee_number',
  'sku',
  'item_sku',
  'code',
  'room_number',
  'name',
];

const _statusKeys = [
  'status',
  'approval_status',
  'payment_status',
  'workflow_status',
  'state',
];

const _createdKeys = [
  'created_at',
  'createdAt',
  'updated_at',
  'date',
  'count_date',
  'request_date',
  'entry_date',
  'payment_date',
  'po_date',
  'invoice_date',
  'booking_date',
];

String _firstText(Map<String, dynamic> row, List<String> keys) {
  for (final key in keys) {
    final value = row[key];
    if (value == null) continue;
    final text = '$value'.trim();
    if (text.isNotEmpty && text != 'null') return text;
  }
  return '';
}

String _branchText(Map<String, dynamic> row) {
  final direct = _firstText(row, const ['branch_name', 'branchName']);
  if (direct.isNotEmpty) return direct;
  for (final key in const ['branch', 'requesting_branch', 'from_branch']) {
    final value = row[key];
    if (value is Map) {
      final name = readableMapName(value);
      if (name != null && name.isNotEmpty) return name;
    }
  }
  final id = _firstText(row, const ['branch_id', 'requesting_branch_id']);
  return id.isEmpty ? '' : 'Branch $id';
}

String _subtitleFor(Map<String, dynamic> row) {
  final candidates = [
    row['description'],
    row['notes'],
    row['supplier_name'],
    row['guest_name'],
    row['customer_name'],
    row['department'],
    row['category'],
  ];
  for (final value in candidates) {
    final text = '${value ?? ''}'.trim();
    if (text.isNotEmpty && text != 'null') return text;
  }
  return 'Enterprise record overview and workflow details';
}

IconData _iconFor(String title, Map<String, dynamic> row) {
  final haystack = '$title ${row.keys.join(' ')}'.toLowerCase();
  if (haystack.contains('purchase') || haystack.contains('po_')) {
    return Icons.shopping_cart_checkout_outlined;
  }
  if (haystack.contains('invoice') || haystack.contains('payment')) {
    return Icons.receipt_long_outlined;
  }
  if (haystack.contains('room') || haystack.contains('booking')) {
    return Icons.hotel_outlined;
  }
  if (haystack.contains('stock') || haystack.contains('inventory')) {
    return Icons.inventory_2_outlined;
  }
  if (haystack.contains('staff') || haystack.contains('employee')) {
    return Icons.badge_outlined;
  }
  if (haystack.contains('supplier') || haystack.contains('vendor')) {
    return Icons.storefront_outlined;
  }
  return Icons.description_outlined;
}

List<_MetricModel> _metricEntries(
  Map<String, dynamic> row,
  List<_EntityTableModel> tables,
) {
  const hints = [
    'net_salary',
    'gross_salary',
    'total_amount',
    'grand_total',
    'amount',
    'balance',
    'variance',
    'total_variance_value',
    'expected_cash',
    'actual_cash',
    'quantity',
    'quantity_received',
    'quantity_requested',
    'current_stock',
    'unit_cost',
    'unit_price',
    'tax_amount',
    'discount_amount',
  ];
  final metrics = <_MetricModel>[];
  for (final key in hints) {
    final value = row[key];
    final number = value is num ? value : num.tryParse('$value');
    if (number == null) continue;
    metrics.add(
      _MetricModel(
        label: readableRecordLabel(key),
        value: _formatMetric(key, number),
        icon: _metricIcon(key),
        color: _metricColor(key),
      ),
    );
    if (metrics.length >= 6) break;
  }

  final rowCount = tables.fold<int>(0, (sum, table) => sum + table.rows.length);
  if (rowCount > 0 && metrics.length < 8) {
    metrics.add(
      _MetricModel(
        label: 'Line Items',
        value: '$rowCount',
        icon: Icons.table_rows_outlined,
        color: AppColors.kPrimary,
      ),
    );
  }
  return metrics;
}

String _formatMetric(String key, num value) {
  final isMoney = key.contains('amount') ||
      key.contains('salary') ||
      key.contains('cash') ||
      key.contains('balance') ||
      key.contains('price') ||
      key.contains('cost') ||
      key.contains('value') ||
      key.contains('variance') ||
      key.contains('tax') ||
      key.contains('discount');
  final number = value == value.roundToDouble()
      ? value.toStringAsFixed(0)
      : value.toStringAsFixed(2);
  return isMoney ? 'KES $number' : number;
}

IconData _metricIcon(String key) {
  if (key.contains('quantity') || key.contains('stock')) {
    return Icons.inventory_2_outlined;
  }
  if (key.contains('variance')) return Icons.warning_amber_outlined;
  if (key.contains('salary') ||
      key.contains('amount') ||
      key.contains('cash')) {
    return Icons.payments_outlined;
  }
  return Icons.insights_outlined;
}

Color _metricColor(String key) {
  if (key.contains('variance') || key.contains('balance')) return Colors.orange;
  if (key.contains('quantity') || key.contains('stock')) return Colors.indigo;
  return AppColors.kSuccess;
}

List<_EntityTableModel> _extractTables(Map<String, dynamic> record) {
  final tables = <_EntityTableModel>[];
  for (final entry in record.entries) {
    final value = entry.value;
    if (value is! List || value.isEmpty) continue;
    final mapRows = value
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
    if (mapRows.isEmpty) continue;
    final columns = _columnsForRows(mapRows);
    if (columns.isEmpty) continue;
    tables.add(
      _EntityTableModel(
        title: readableRecordLabel(entry.key),
        sourceKey: entry.key,
        columns: columns,
        rows: mapRows,
      ),
    );
  }
  return tables;
}

List<String> _columnsForRows(List<Map<String, dynamic>> rows) {
  const preferred = [
    'item_name',
    'name',
    'description',
    'sku',
    'item_sku',
    'item_id',
    'quantity',
    'qty',
    'quantity_ordered',
    'quantity_requested',
    'quantity_approved',
    'quantity_received',
    'quantity_pending',
    'unit',
    'unit_of_measure',
    'unit_price',
    'unit_cost',
    'total',
    'total_amount',
    'line_total',
    'status',
    'created_at',
  ];
  final keys = <String>[];
  for (final key in preferred) {
    if (rows.any((row) => row.containsKey(key) && row[key] != null)) {
      keys.add(key);
    }
  }
  for (final row in rows) {
    for (final key in row.keys) {
      if (keys.length >= 9) break;
      if (keys.contains(key) || key.startsWith('_')) continue;
      final value = row[key];
      if (value is Map || value is List) continue;
      keys.add(key);
    }
    if (keys.length >= 9) break;
  }
  return keys.take(9).toList();
}

List<_TimelineEvent> _extractTimeline(Map<String, dynamic> record) {
  const timelineKeys = {
    'created_at': ('Created', Icons.add_circle_outline),
    'submitted_at': ('Submitted', Icons.upload_outlined),
    'requested_at': ('Requested', Icons.playlist_add_check_outlined),
    'approved_at': ('Approved', Icons.check_circle_outline),
    'reviewed_at': ('Reviewed', Icons.rate_review_outlined),
    'sent_at': ('Sent', Icons.send_outlined),
    'received_at': ('Received', Icons.inventory_2_outlined),
    'posted_at': ('Posted', Icons.task_alt_outlined),
    'paid_at': ('Paid', Icons.payments_outlined),
    'cancelled_at': ('Cancelled', Icons.cancel_outlined),
    'updated_at': ('Last Updated', Icons.update_outlined),
  };
  final events = <_TimelineEvent>[];
  timelineKeys.forEach((key, meta) {
    final value = record[key];
    if (value == null || '$value'.trim().isEmpty || '$value' == 'null') return;
    events.add(_TimelineEvent(label: meta.$1, value: value, icon: meta.$2));
  });
  return events;
}

List<_ActivityEvent> _extractActivity(Map<String, dynamic> record) {
  final raw = record['activity'] ??
      record['activities'] ??
      record['history'] ??
      record['audit_logs'] ??
      record['logs'];
  if (raw is! List) return const [];
  return raw.whereType<Map>().map((item) {
    final map = Map<String, dynamic>.from(item);
    final title = _firstText(map, const [
      'title',
      'action',
      'event',
      'description',
      'message',
      'status',
    ]);
    final actor = _firstText(map, const ['user_name', 'actor', 'created_by']);
    final when = _firstText(map, _createdKeys);
    return _ActivityEvent(
      title: title.isEmpty ? 'Activity recorded' : readableStatus(title),
      subtitle: [
        if (actor.isNotEmpty) actor,
        if (when.isNotEmpty) readableDateTime(when),
      ].join(' - '),
    );
  }).toList();
}

List<_AttachmentModel> _extractAttachments(Map<String, dynamic> record) {
  final attachments = <_AttachmentModel>[];
  void add(String label, String url) {
    final lower = url.toLowerCase();
    final icon = lower.endsWith('.pdf')
        ? Icons.picture_as_pdf_outlined
        : (lower.endsWith('.png') ||
                lower.endsWith('.jpg') ||
                lower.endsWith('.jpeg'))
            ? Icons.image_outlined
            : Icons.insert_drive_file_outlined;
    attachments.add(_AttachmentModel(label: label, url: url, icon: icon));
  }

  for (final entry in record.entries) {
    final key = entry.key.toLowerCase();
    final value = entry.value;
    if (value is String &&
        (key.contains('url') ||
            key.contains('file') ||
            key.contains('attachment') ||
            key.contains('document'))) {
      if (value.trim().isNotEmpty && value != 'null') {
        add(readableRecordLabel(entry.key), value);
      }
    } else if (value is List &&
        (key.contains('attachment') || key.contains('document'))) {
      for (final item in value) {
        if (item is String) {
          add(readableRecordLabel(entry.key), item);
        } else if (item is Map) {
          final url = _firstText(Map<String, dynamic>.from(item),
              const ['url', 'file_url', 'path']);
          if (url.isNotEmpty) add(readableMapName(item) ?? 'Document', url);
        }
      }
    }
  }
  return attachments.take(12).toList();
}

bool _isTechnicalKey(String key, dynamic value) {
  final lower = key.toLowerCase();
  return lower == 'id' ||
      lower == 'uuid' ||
      lower.endsWith('_id') ||
      lower.contains('token') ||
      lower.contains('raw') ||
      lower.contains('json') ||
      value is Map;
}

bool _isAuditKey(String key) {
  final lower = key.toLowerCase();
  return lower.endsWith('_at') ||
      lower.endsWith('_by') ||
      lower.contains('created') ||
      lower.contains('updated') ||
      lower.contains('approved') ||
      lower.contains('reviewed') ||
      lower.contains('posted') ||
      lower.contains('audit');
}

bool _isRelationKey(String key, dynamic value) {
  if (value is Map) return true;
  final lower = key.toLowerCase();
  // Plain display strings (e.g. staff_name, department) stay in Business
  // Information. Only bare foreign-key references go to People & Branches.
  final isDisplayLabel = lower.endsWith('_name') ||
      lower.endsWith('_label') ||
      lower == 'department' ||
      lower == 'role' ||
      lower == 'email';
  if (isDisplayLabel) return false;
  return lower.contains('branch') ||
      lower.contains('supplier') ||
      lower.contains('customer') ||
      lower.contains('guest') ||
      lower.contains('staff') ||
      lower.contains('employee') ||
      lower.contains('user');
}

Color _statusColor(String status) {
  final lower = status.toLowerCase();
  if (lower.contains('pending') ||
      lower.contains('draft') ||
      lower.contains('review')) {
    return const Color(0xFFB45309);
  }
  if (lower.contains('approved') ||
      lower.contains('complete') ||
      lower.contains('paid') ||
      lower.contains('posted') ||
      lower.contains('active') ||
      lower.contains('received')) {
    return const Color(0xFF15803D);
  }
  if (lower.contains('reject') ||
      lower.contains('cancel') ||
      lower.contains('void') ||
      lower.contains('flag')) {
    return AppColors.kError;
  }
  if (lower.contains('sent') || lower.contains('progress')) {
    return Colors.blue;
  }
  return Colors.blueGrey;
}
