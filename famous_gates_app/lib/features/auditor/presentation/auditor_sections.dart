import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import 'dart:io';

import 'package:go_router/go_router.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/record_detail_screen.dart';
import '../../../core/utils/api_error_message.dart';
import '../../admin/domain/admin_providers.dart';
import '../data/repository.dart';

const _allBranchesMenuValue = '__all_branches__';

class _AuditorRawRequest {
  const _AuditorRawRequest(this.endpoint, this.branchId);

  final String endpoint;
  final String? branchId;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is _AuditorRawRequest &&
          endpoint == other.endpoint &&
          branchId == other.branchId;

  @override
  int get hashCode => Object.hash(endpoint, branchId);
}

_AuditorRawRequest _auditorRequest(WidgetRef ref, String endpoint) =>
    _AuditorRawRequest(endpoint, ref.watch(adminSelectedBranchProvider));

_AuditorRawRequest _currentAuditorRequest(WidgetRef ref, String endpoint) =>
    _AuditorRawRequest(endpoint, ref.read(adminSelectedBranchProvider));

final _auditorRawProvider =
    FutureProvider.family<dynamic, _AuditorRawRequest>((ref, request) {
  ref.watch(adminSelectedBranchProvider);
  return ref.read(auditorRepositoryProvider).getRaw(request.endpoint);
});

class _AuditorDataSection extends ConsumerWidget {
  const _AuditorDataSection({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.endpoint,
    required this.columns,
    this.listKeys = const [],
    this.summaryKeys = const [],
    this.actions = const [],
    this.enableExport = false,
    this.searchPlaceholder,
    this.emptyTitle,
    this.emptySubtitle,
    this.syncLabel = 'Refresh',
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final String endpoint;
  final List<String> columns;
  final List<String> listKeys;
  final List<String> summaryKeys;
  final List<_AuditorRowAction> actions;
  final bool enableExport;
  final String? searchPlaceholder;
  final String? emptyTitle;
  final String? emptySubtitle;
  final String syncLabel;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final request = _auditorRequest(ref, endpoint);
    final value = ref.watch(_auditorRawProvider(request));
    return Column(
      children: [
        _sectionHeader(context, ref),
        Expanded(
          child: value.when(
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (error, _) => _error(context, ref, error),
            data: (raw) => _body(context, ref, raw),
          ),
        ),
      ],
    );
  }

  Widget _error(BuildContext context, WidgetRef ref, Object error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(PhosphorIcons.warning(), color: AppColors.kError, size: 32),
            const SizedBox(height: 12),
            Text('Failed to load $title',
                style:
                    const TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 6),
            Text(apiErrorMessage(error),
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.kTextSecondary)),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => ref.invalidate(
                  _auditorRawProvider(_currentAuditorRequest(ref, endpoint))),
              icon: const Icon(Icons.refresh, size: 16),
              label: const Text('Retry'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionHeader(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.fromLTRB(28, 28, 28, 8),
      color: Colors.white,
      child: Row(children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: const Color(0xFF1D1917),
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.08),
                blurRadius: 14,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Icon(icon, color: Colors.white, size: 24),
        ),
        const SizedBox(width: 18),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title,
                style: const TextStyle(
                    fontSize: 27,
                    fontWeight: FontWeight.w800,
                    color: AppColors.kTextPrimary)),
            const SizedBox(height: 4),
            Text(subtitle,
                style: const TextStyle(
                    fontSize: 14, color: AppColors.kTextSecondary)),
          ]),
        ),
        const _AuditorBranchScopeChip(),
        const SizedBox(width: 10),
        FilledButton.icon(
          onPressed: () => ref.invalidate(
              _auditorRawProvider(_currentAuditorRequest(ref, endpoint))),
          icon: const Icon(Icons.refresh),
          label: Text(syncLabel),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF1D1917),
            foregroundColor: Colors.white,
            minimumSize: const Size(112, 44),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        const SizedBox(width: 8),
        OutlinedButton.icon(
          onPressed: () => _showCreateExceptionDialog(context, ref),
          icon: const Icon(Icons.report_problem_outlined, size: 16),
          label: const Text('Exception'),
        ),
        if (enableExport) ...[
          const SizedBox(width: 8),
          OutlinedButton.icon(
            onPressed: () => _exportCurrentView(context, ref),
            icon: const Icon(Icons.download, size: 16),
            label: const Text('Export'),
          ),
        ],
      ]),
    );
  }

  Widget _body(BuildContext context, WidgetRef ref, dynamic raw) {
    final root = _unwrap(raw);
    final summary = _summary(root);
    final rows = _rows(root);
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(
          _auditorRawProvider(_currentAuditorRequest(ref, endpoint))),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (summary.isNotEmpty) ...[
              _summaryCards(summary),
              const SizedBox(height: 20),
            ],
            _AuditorTableShell(section: this, rows: rows),
          ],
        ),
      ),
    );
  }

  Widget _summaryCards(Map<String, dynamic> summary) {
    final entries = summary.entries
        .where((entry) => _isRenderableSummaryValue(entry.value))
        .take(4)
        .toList();
    return Row(
      children: [
        for (var i = 0; i < entries.length; i++) ...[
          if (i > 0) const SizedBox(width: 12),
          Expanded(child: _auditStatCard(entries[i].key, entries[i].value)),
        ],
      ],
    );
  }

  Widget _auditStatCard(String key, dynamic value) {
    final color = _statAccent(key);
    return Container(
      constraints: const BoxConstraints(minHeight: 132),
      padding: const EdgeInsets.all(22),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.55)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.025),
            blurRadius: 12,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Stack(children: [
        Positioned(
          left: 0,
          top: 0,
          bottom: 0,
          child: Container(width: 4, color: color),
        ),
        Padding(
          padding: const EdgeInsets.only(left: 14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 21),
              ),
              const SizedBox(height: 18),
              Text(_format(value),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                      fontSize: 24, fontWeight: FontWeight.w900, color: color)),
              const SizedBox(height: 4),
              Text(_label(key).toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppColors.kTextSecondary,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.8,
                  )),
            ],
          ),
        ),
      ]),
    );
  }

  Widget _table(
      BuildContext context, WidgetRef ref, List<Map<String, dynamic>> rows) {
    final visibleColumns = actions.isEmpty ? columns : [...columns, 'actions'];
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(title,
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 14)),
                ),
                Text('${rows.length} records',
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.kTextSecondary)),
              ],
            ),
          ),
          const Divider(height: 1),
          if (rows.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 56, horizontal: 24),
              child: _auditEmptyState(
                title: emptyTitle ?? 'No matching records found',
                subtitle: emptySubtitle ?? 'All records are current.',
                icon: icon,
              ),
            )
          else
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
                columns: visibleColumns
                    .map((column) => DataColumn(
                        label: Text(
                            column == 'actions' ? 'Actions' : _label(column),
                            style: const TextStyle(
                                fontSize: 12, fontWeight: FontWeight.w700))))
                    .toList(),
                rows: rows
                    .map((row) => DataRow(
                          cells: [
                            for (final column in columns)
                              DataCell(SizedBox(
                                width: 150,
                                child: Text(
                                  _value(row, column),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 12),
                                ),
                              )),
                            if (actions.isNotEmpty)
                              DataCell(_actionButtons(context, ref, row)),
                          ],
                        ))
                    .toList(),
              ),
            ),
        ],
      ),
    );
  }

  Widget _actionButtons(
      BuildContext context, WidgetRef ref, Map<String, dynamic> row) {
    final visible = actions.where((action) => action.visible(row)).toList();
    if (visible.isEmpty) return const SizedBox(width: 120, child: Text('—'));
    return SizedBox(
      width: 96,
      child: PopupMenuButton<_AuditorRowAction>(
        tooltip: 'Review actions',
        onSelected: (action) => _handleAction(context, ref, row, action),
        itemBuilder: (context) => [
          for (final action in visible)
            PopupMenuItem(
              value: action,
              child: Row(children: [
                Icon(action.icon,
                    size: 18, color: action.color ?? AppColors.kPrimary),
                const SizedBox(width: 8),
                Text(action.label),
              ]),
            ),
        ],
        child: const Align(
          alignment: Alignment.centerLeft,
          child: Text('Review',
              style: TextStyle(
                  color: AppColors.kPrimary, fontWeight: FontWeight.w700)),
        ),
      ),
    );
  }

  Future<void> _handleAction(BuildContext context, WidgetRef ref,
      Map<String, dynamic> row, _AuditorRowAction action) async {
    if (action.isDetail) {
      _showDetailDialog(context, row);
      return;
    }
    if (action.isInvestigate) {
      await _showInvestigationDialog(context, ref, row);
      return;
    }

    final notes = await _showNotesDialog(context, action, row);
    if (notes == null) return;
    if (action.requiresNotes && notes.trim().isEmpty) {
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('${action.label} requires notes.'),
              backgroundColor: AppColors.kError,
            ));
      }
      return;
    }

    try {
      final path = _actionPath(action, row);
      await ref.read(auditorRepositoryProvider).submitAction(
            action.method,
            path,
            data: action.body(row, notes.trim()),
          );
      ref.invalidate(
          _auditorRawProvider(_currentAuditorRequest(ref, endpoint)));
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('${action.label} completed'),
              backgroundColor: AppColors.kSuccess,
            ));
      }
    } catch (error) {
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Failed: $error'),
              backgroundColor: AppColors.kError,
            ));
      }
    }
  }

  String _actionPath(_AuditorRowAction action, Map<String, dynamic> row) {
    final type = action.endpoint.contains('/staff/simple-payroll/')
        ? _payrollType(row)
        : action.endpoint.contains('/credit/:type/')
            ? _creditConfirmationType(row)
            : _rowEntityType(row, fallback: 'credit_bill');
    return action.endpoint
        .replaceAll(':id', _rowId(row))
        .replaceAll(':type', type);
  }

  dynamic _unwrap(dynamic raw) {
    if (raw is Map && raw['success'] == true && raw.containsKey('data')) {
      return raw['data'];
    }
    return raw;
  }

  Map<String, dynamic> _summary(dynamic data) {
    if (data is! Map) return {};
    for (final key in [...summaryKeys, 'summary', 'stats', 'totals']) {
      final value = data[key];
      if (value is Map) return Map<String, dynamic>.from(value);
    }
    return Map<String, dynamic>.from(data)
      ..removeWhere((_, value) => value is List || value is Map);
  }

  List<Map<String, dynamic>> _rows(dynamic data) {
    if (data is List) {
      return _mapsFromList(data);
    }
    if (data is Map) {
      final revenueByDept = data['revenue_by_dept'];
      if (revenueByDept is Map) {
        final totalRevenue = num.tryParse('${data['total_revenue'] ?? 0}') ?? 0;
        return revenueByDept.entries.map((entry) {
          final amount = num.tryParse('${entry.value}') ?? 0;
          return {
            'id': 'revenue_${entry.key}',
            'type': 'revenue_stream',
            'revenue_stream': _label('${entry.key}'),
            'amount': amount,
            'share': totalRevenue == 0
                ? '0%'
                : '${((amount / totalRevenue) * 100).toStringAsFixed(1)}%',
            'total_revenue': data['total_revenue'],
            'collected_revenue': data['collected_revenue'],
            'pending_revenue': data['pending_revenue'],
            'status': 'active',
          };
        }).toList();
      }

      final specificKeys = listKeys
          .where((key) => !{'items', 'rows', 'records', 'data'}.contains(key))
          .toList();
      final combined = <Map<String, dynamic>>[];
      for (final key in specificKeys) {
        final value = data[key];
        if (value is List) {
          combined.addAll(_mapsFromList(value, sourceKey: key));
        }
      }
      if (combined.isNotEmpty) return combined;

      for (final key in [
        ...listKeys,
        'items',
        'rows',
        'records',
        'data',
        'logs',
        'requests',
        'audits',
        'invoices',
        'deliveries',
        'payments',
        'branch_summaries',
      ]) {
        final value = data[key];
        if (value is List) {
          return _mapsFromList(value, sourceKey: key);
        }
      }
      for (final value in data.values) {
        if (value is List) {
          return _mapsFromList(value);
        }
      }

      final summary = data['summary'];
      if (summary is Map && summary['branch_summaries'] is List) {
        final rows = _mapsFromList(summary['branch_summaries'] as List,
            sourceKey: 'branch_summaries');
        if (rows.isNotEmpty) return rows;
      }
    }
    return [];
  }

  List<Map<String, dynamic>> _mapsFromList(List<dynamic> value,
      {String? sourceKey}) {
    return value.whereType<Map>().map((row) {
      final mapped = Map<String, dynamic>.from(row);
      if (sourceKey != null) {
        mapped.putIfAbsent('_source', () => sourceKey);
        final type = _sourceType(sourceKey);
        if (type != null) mapped.putIfAbsent('type', () => type);
      }
      return _normalizeRow(mapped);
    }).toList();
  }

  String _value(Map<String, dynamic> row, String key) {
    final direct = row[key];
    if (direct != null && '$direct'.isNotEmpty) return _format(direct);
    final snake = key.replaceAll(' ', '_').toLowerCase();
    final value = row[snake];
    if (value != null && '$value'.isNotEmpty) return _format(value);
    final derived = _derivedValue(row, snake);
    if (derived != null && '$derived'.isNotEmpty) return _format(derived);
    return '—';
  }

  Future<void> _exportCurrentView(BuildContext context, WidgetRef ref) async {
    try {
      await ref
          .read(auditorRepositoryProvider)
          .submitAction('POST', '/auditor/export/stock-ledger', data: {
        'view': title,
        'endpoint': endpoint,
      });
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context,
            const SnackBar(
              content: Text('Export requested'),
              backgroundColor: AppColors.kSuccess,
            ));
      }
    } catch (error) {
      if (context.mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Export failed: $error'),
              backgroundColor: AppColors.kError,
            ));
      }
    }
  }

  Future<void> _showCreateExceptionDialog(
      BuildContext context, WidgetRef ref) async {
    final typeCtrl = TextEditingController(text: title);
    final amountCtrl = TextEditingController();
    final referenceCtrl = TextEditingController();
    final descriptionCtrl = TextEditingController();
    String severity = 'medium';
    final saved = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          title: const Text('Create Audit Exception'),
          content: SizedBox(
            width: 480,
            child: SingleChildScrollView(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                TextField(
                  controller: typeCtrl,
                  decoration:
                      const InputDecoration(labelText: 'Exception type'),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: severity,
                  decoration: const InputDecoration(labelText: 'Severity'),
                  items: const [
                    DropdownMenuItem(value: 'low', child: Text('Low')),
                    DropdownMenuItem(value: 'medium', child: Text('Medium')),
                    DropdownMenuItem(value: 'high', child: Text('High')),
                    DropdownMenuItem(
                        value: 'critical', child: Text('Critical')),
                  ],
                  onChanged: (value) =>
                      setState(() => severity = value ?? severity),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: amountCtrl,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Amount'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: referenceCtrl,
                  decoration: const InputDecoration(labelText: 'Reference ID'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: descriptionCtrl,
                  minLines: 3,
                  maxLines: 5,
                  decoration: const InputDecoration(labelText: 'Description'),
                ),
              ]),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Create'),
            ),
          ],
        ),
      ),
    );
    if (saved != true) return;
    await ref.read(auditorRepositoryProvider).submitAction(
      'POST',
      '/auditor/exceptions',
      data: {
        'exception_type': typeCtrl.text.trim(),
        'severity': severity,
        'description': descriptionCtrl.text.trim(),
        'amount': num.tryParse(amountCtrl.text.trim()),
        'reference_type': endpoint,
        'reference_id': referenceCtrl.text.trim(),
      },
    );
    ref.invalidate(_auditorRawProvider(_currentAuditorRequest(ref, endpoint)));
    if (context.mounted) {
      AppNotifier.showSnackBar(
          context,
          const SnackBar(
            content: Text('Audit exception created'),
            backgroundColor: AppColors.kSuccess,
          ));
    }
  }
}

Widget _header(String title, IconData icon, {required String subtitle}) {
  return Container(
    padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
    decoration: const BoxDecoration(
      color: Colors.white,
      border: Border(bottom: BorderSide(color: AppColors.kDivider)),
    ),
    child: Row(children: [
      Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: AppColors.kPrimary.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Icon(icon, color: AppColors.kPrimary, size: 20),
      ),
      const SizedBox(width: 14),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.kTextPrimary)),
          Text(subtitle,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.kTextSecondary)),
        ]),
      ),
    ]),
  );
}

class _AuditorBranchScopeChip extends ConsumerWidget {
  const _AuditorBranchScopeChip();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedId = ref.watch(adminSelectedBranchProvider);
    final branchesAsync = ref.watch(adminBranchesProvider);
    return branchesAsync.when(
      data: (branches) {
        final selected = selectedId == null
            ? null
            : branches.where((branch) => branch.id == selectedId).firstOrNull;
        return PopupMenuButton<String>(
          tooltip: 'Filter by branch',
          initialValue: selectedId ?? _allBranchesMenuValue,
          onSelected: (value) => ref
              .read(adminSelectedBranchProvider.notifier)
              .state = value == _allBranchesMenuValue ? null : value,
          itemBuilder: (context) => [
            const PopupMenuItem<String>(
              value: _allBranchesMenuValue,
              child: Text('All Branches'),
            ),
            for (final branch in branches)
              PopupMenuItem<String>(
                value: branch.id,
                child: Text(branch.name),
              ),
          ],
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: BoxDecoration(
              color: AppColors.kPrimary.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(999),
              border:
                  Border.all(color: AppColors.kPrimary.withValues(alpha: 0.12)),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              const Text(
                'Branch:',
                style: TextStyle(
                  color: AppColors.kTextPrimary,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(width: 8),
              Icon(PhosphorIcons.buildings(),
                  size: 14, color: AppColors.kPrimary),
              const SizedBox(width: 6),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 160),
                child: Text(
                  selected?.name ?? 'All Branches',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: AppColors.kPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(width: 6),
              Icon(PhosphorIcons.caretDown(),
                  size: 12, color: AppColors.kPrimary),
            ]),
          ),
        );
      },
      loading: () => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.kSurface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppColors.kDivider),
        ),
        child: const Text(
          'Loading branches...',
          style: TextStyle(fontSize: 12, color: AppColors.kTextSecondary),
        ),
      ),
      error: (_, __) => const SizedBox.shrink(),
    );
  }
}

String _label(String value) => value
    .replaceAll('_', ' ')
    .split(' ')
    .where((part) => part.isNotEmpty)
    .map((part) => part[0].toUpperCase() + part.substring(1))
    .join(' ');

bool _isRenderableSummaryValue(dynamic value) {
  if (value == null || value is List || value is Map) return false;
  if (value is num) return true;
  return '$value'.trim().isNotEmpty;
}

Color _statAccent(String key) {
  final normalized = key.toLowerCase();
  if (normalized.contains('variance') ||
      normalized.contains('shortage') ||
      normalized.contains('alert') ||
      normalized.contains('leakage')) {
    return AppColors.kError;
  }
  if (normalized.contains('pending') ||
      normalized.contains('interaction') ||
      normalized.contains('live')) {
    return AppColors.kWarning;
  }
  if (normalized.contains('branch') ||
      normalized.contains('node') ||
      normalized.contains('count')) {
    return const Color(0xFF2563EB);
  }
  if (normalized.contains('surplus') ||
      normalized.contains('collected') ||
      normalized.contains('verified')) {
    return AppColors.kSuccess;
  }
  return const Color(0xFF1D1917);
}

Widget _auditEmptyState({
  required String title,
  required String subtitle,
  required IconData icon,
}) {
  return Column(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      Container(
        width: 74,
        height: 74,
        decoration: BoxDecoration(
          color: AppColors.kSurface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: Icon(icon,
            size: 34, color: AppColors.kTextSecondary.withValues(alpha: 0.35)),
      ),
      const SizedBox(height: 16),
      Text(title,
          textAlign: TextAlign.center,
          style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: AppColors.kTextPrimary)),
      const SizedBox(height: 6),
      Text(subtitle.toUpperCase(),
          textAlign: TextAlign.center,
          style: const TextStyle(
              fontSize: 11,
              color: AppColors.kTextSecondary,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8)),
    ],
  );
}

String _format(dynamic value) {
  if (value is Map) {
    final name = _nestedName(value) ??
        value['display_name'] ??
        value['name'] ??
        value['title'] ??
        value['branch_name'] ??
        value['code'] ??
        value['id'];
    return name == null ? '—' : '$name';
  }
  if (value is List) return '${value.length} items';
  final text = '$value';
  return _isUuidLike(text) ? _shortReference(text) : text;
}

bool _isUuidLike(String value) => RegExp(
        r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
    .hasMatch(value.trim());

String _shortReference(String value) {
  final trimmed = value.trim();
  if (trimmed.length <= 12) return trimmed;
  return '${trimmed.substring(0, 8)}...${trimmed.substring(trimmed.length - 4)}';
}

String _detailLabel(String key) {
  if (key == 'id') return 'Reference';
  if (key.endsWith('_user')) return _label(key.substring(0, key.length - 5));
  if (key.endsWith('_id')) return _label(key.substring(0, key.length - 3));
  return _label(key);
}

List<MapEntry<String, dynamic>> _detailEntries(Map<String, dynamic> raw,
    {int limit = 30}) {
  final row = _normalizeRow(Map<String, dynamic>.from(raw));
  return row.entries
      .where((entry) =>
          !entry.key.startsWith('_') &&
          entry.value != null &&
          '${entry.value}'.trim().isNotEmpty &&
          !_hideRawRelationshipField(row, entry.key))
      .take(limit)
      .toList();
}

bool _hideRawRelationshipField(Map<String, dynamic> row, String key) {
  if (key == 'branch_id' ||
      key == 'requesting_branch_id' ||
      key == 'from_branch_id' ||
      key == 'to_branch_id') {
    return _relatedName(row, key) != null;
  }
  if (_isUserReferenceKey(key)) return _relatedName(row, key) != null;
  return false;
}

bool _isUserReferenceKey(String key) {
  return {
    'created_by',
    'created_by_id',
    'requested_by',
    'requested_by_id',
    'approved_by',
    'approved_by_id',
    'reviewed_by',
    'reviewed_by_id',
    'verified_by',
    'verified_by_id',
    'counted_by',
    'counted_by_id',
    'auditor_id',
    'cashier_id',
    'user_id',
    'staff_id',
    'employee_id',
  }.contains(key);
}

String? _relatedName(Map<String, dynamic> row, String key) {
  if (key == 'branch_id' || key == 'requesting_branch_id') {
    return row['branch_name'] ??
        _nestedName(row['branch']) ??
        _nestedName(row['requesting_branch']);
  }
  if (key == 'from_branch_id') {
    return row['from_branch_name'] ?? _nestedName(row['from_branch']);
  }
  if (key == 'to_branch_id') {
    return row['to_branch_name'] ?? _nestedName(row['to_branch']);
  }

  final base = key.endsWith('_id') ? key.substring(0, key.length - 3) : key;
  final candidates = <dynamic>[
    row['${base}_user'],
    row[base],
    row['${base}_name'],
    if (base == 'auditor') row['auditor'],
    if (base == 'cashier') row['cashier'],
    if (base == 'staff' || base == 'employee') row['staff'],
    if (base == 'staff' || base == 'employee') row['employee'],
    if (base == 'user') row['user'],
  ];
  for (final candidate in candidates) {
    if (candidate is Map) {
      final name = _nestedName(candidate) ?? candidate['display_name'];
      if (name != null && '$name'.trim().isNotEmpty) return '$name';
    } else if (candidate != null &&
        '$candidate'.trim().isNotEmpty &&
        !_isUuidLike('$candidate')) {
      return '$candidate';
    }
  }
  return null;
}

String _formatDetailValue(Map<String, dynamic> row, String key, dynamic value) {
  final related = _relatedName(row, key);
  if (related != null) return related;
  if (key == 'id' && value != null) return _shortReference('$value');
  if (value is String && _isUuidLike(value)) return _shortReference(value);
  return _format(value);
}

String _displayReference(Map<String, dynamic> row) {
  final candidate = row['request_number'] ??
      row['request_no'] ??
      row['dispatch_number'] ??
      row['item_name'] ??
      row['branch_name'] ??
      row['name'] ??
      _rowId(row);
  if (candidate == null || '$candidate'.trim().isEmpty) return '—';
  return _format(candidate);
}

String? _sourceType(String sourceKey) {
  return switch (sourceKey) {
    'credit_bills' => 'credit_bill',
    'bills' => 'bill',
    'invoices' => 'invoice',
    'employee_bills' => 'employee',
    'guest_bills' => 'guest',
    'advances' => 'advance',
    'loans' => 'loan',
    'exceptions' => 'exception',
    'analysis' || 'sold_items' => 'sold_item',
    'usage' || 'entries' => 'kitchen_usage',
    'wastage' => 'wastage',
    'deliveries' => 'dispatch_note',
    'requests' || 'approvals' || 'requisitions' => 'stock_request',
    'stock_takes' || 'audits' => 'stock_audit',
    'transactions' || 'payments' || 'recent_transactions' => 'payment',
    'cashier_summaries' || 'branch_summaries' => 'logbook',
    'logbooks' || 'logs' => 'logbook',
    _ => null,
  };
}

dynamic _derivedValue(Map<String, dynamic> row, String key) {
  if (key == 'request_number') {
    return row['request_no'] ?? row['reference_number'] ?? row['id'];
  }
  if (key == 'reference') {
    return row['reference'] ??
        row['reference_number'] ??
        row['bill_number'] ??
        row['order_number'] ??
        row['id'];
  }
  if (key == 'staff_name' || key == 'employee_name') {
    return _nestedName(row['staff']) ??
        _nestedName(row['employee']) ??
        _nestedName(row['user']) ??
        _joinName(row['first_name'], row['last_name']) ??
        row['customer_name'];
  }
  if (key == 'cashier_name') {
    return _nestedName(row['cashier']) ?? _nestedName(row['user']);
  }
  if (key == 'requested_by') {
    return _nestedName(row['requester']) ??
        _nestedName(row['requested_by_user']) ??
        _nestedName(row['created_by']);
  }
  if (key == 'role') {
    return row['staff_role'] ?? row['position'];
  }
  if (key == 'action') {
    return row['action'] ?? row['type'] ?? row['description'];
  }
  if (key == 'supplier_name') {
    return row['counterparty_name'] ??
        row['supplier_name'] ??
        row['vendor_name'] ??
        row['customer_name'] ??
        _nestedName(row['supplier']) ??
        _nestedName(row['vendor']) ??
        _nestedName(row['customer']);
  }
  if (key == 'branch_name') {
    return _nestedName(row['branch']) ??
        _nestedName(row['requesting_branch']) ??
        _nestedName(row['from_branch']) ??
        _nestedName(row['to_branch']) ??
        row['destination_branch_name'];
  }
  if (key == 'item_name') {
    return _nestedName(row['item']) ??
        _nestedName(row['inventory_item']) ??
        _nestedName(row['drink']) ??
        row['name'] ??
        row['item_sku'];
  }
  if (key == 'item_details') {
    return row['item_details'] ??
        row['item_name'] ??
        _nestedName(row['item']) ??
        row['name'] ??
        row['item_sku'];
  }
  if (key == 'sku') {
    return row['item_sku'] ?? row['sku'];
  }
  if (key == 'movement_type') {
    return row['transaction_type'] ?? row['movement_type'];
  }
  if (key == 'quantity') {
    final quantity = row['quantity'];
    if (quantity != null) return quantity;
    final quantityIn = num.tryParse('${row['quantity_in'] ?? 0}') ?? 0;
    final quantityOut = num.tryParse('${row['quantity_out'] ?? 0}') ?? 0;
    if (quantityIn != 0) return quantityIn;
    if (quantityOut != 0) return -quantityOut;
  }
  if (key == 'amount') {
    return row['total_amount'] ??
        row['total'] ??
        row['value'] ??
        row['outstanding_balance'] ??
        row['balance'] ??
        row['advance_amount'] ??
        row['loan_amount'] ??
        row['credit_amount'];
  }
  if (key == 'total_amount') {
    return row['total_amount'] ??
        row['amount'] ??
        row['total'] ??
        row['bill_total'] ??
        row['invoice_total'] ??
        row['balance'];
  }
  if (key == 'total_sales') {
    final direct = row['total_sales'] ?? row['sales_total'];
    if (direct != null) return direct;
    final lines = row['lines'];
    if (lines is List) {
      return lines.whereType<Map>().fold<num>(0, (sum, line) {
        final amount = line['amount'];
        return sum + (amount is num ? amount : num.tryParse('$amount') ?? 0);
      });
    }
  }
  if (key == 'total_cash') {
    return row['total_cash'] ??
        row['cash_total'] ??
        row['closing_float'] ??
        row['cash_sales'];
  }
  if (key == 'expected_amount') {
    return row['expected_closing_float'] ??
        row['expected_cash'] ??
        row['total_sales'];
  }
  if (key == 'actual_amount') {
    return row['closing_float'] ?? row['total_payments'] ?? row['total_amount'];
  }
  if (key == 'expected_quantity') {
    return row['theoretical_quantity'] ??
        row['system_closing_stock'] ??
        row['opening_stock'];
  }
  if (key == 'quantity_sold') {
    return row['quantity'] ?? row['sold_quantity'];
  }
  if (key == 'gross_revenue') {
    return row['gross_revenue'] ??
        row['revenue'] ??
        row['total_revenue'] ??
        row['total_amount'];
  }
  if (key == 'stock_requested') {
    return row['stock_requested'] ??
        row['requested_quantity'] ??
        row['stock_request_quantity'] ??
        row['quantity_requested'] ??
        row['request_count'];
  }
  if (key == 'efficiency') {
    final value = row['efficiency'] ?? row['efficiency_score'];
    if (value != null) return value;
    final qty =
        num.tryParse('${row['quantity_sold'] ?? row['quantity'] ?? 0}') ?? 0;
    final requested = num.tryParse(
            '${row['stock_requested'] ?? row['requested_quantity'] ?? 0}') ??
        0;
    if (requested > 0) {
      return '${((qty / requested) * 100).toStringAsFixed(0)}%';
    }
  }
  if (key == 'bar_name') {
    return row['bar_name'] ??
        row['outlet_code'] ??
        row['store_type'] ??
        row['count_type'];
  }
  if (key == 'variance_count') {
    final items = row['items'];
    if (items is List) {
      return items.where((item) {
        if (item is! Map) return false;
        final variance = num.tryParse('${item['variance'] ?? 0}') ?? 0;
        return variance != 0;
      }).length;
    }
    return row['items_with_variance'] ?? row['items_with_discrepancies'];
  }
  if (key == 'type') {
    return _rowEntityType(row, fallback: '');
  }
  if (key == 'status') {
    return row['auditor_status'] ??
        row['approval_status'] ??
        row['review_status'] ??
        row['audit_status'];
  }
  if (key == 'created_at') {
    return row['submitted_at'] ?? row['requested_at'] ?? row['date'];
  }
  return null;
}

Map<String, dynamic> _normalizeRow(Map<String, dynamic> row) {
  final branchName = _nestedName(row['branch']) ??
      _nestedName(row['requesting_branch']) ??
      _nestedName(row['from_branch']) ??
      _nestedName(row['to_branch']) ??
      row['destination_branch_name'];
  if (branchName != null) row.putIfAbsent('branch_name', () => branchName);

  final itemName = _nestedName(row['item']) ??
      _nestedName(row['inventory_item']) ??
      _nestedName(row['drink']) ??
      row['name'] ??
      row['item_sku'];
  if (itemName != null) row.putIfAbsent('item_name', () => itemName);

  final cashierName = _nestedName(row['cashier']) ?? _nestedName(row['user']);
  if (cashierName != null) row.putIfAbsent('cashier_name', () => cashierName);

  final requestedBy = _nestedName(row['requester']) ??
      _nestedName(row['requested_by_user']) ??
      _nestedName(row['created_by_user']) ??
      _nestedName(row['created_by']);
  if (requestedBy != null) row.putIfAbsent('requested_by', () => requestedBy);

  final staffName = _nestedName(row['staff']) ??
      _nestedName(row['employee']) ??
      _nestedName(row['user']);
  if (staffName != null) {
    row.putIfAbsent('staff_name', () => staffName);
    row.putIfAbsent('employee_name', () => staffName);
  }

  final counterpartyName = row['counterparty_name'] ??
      row['supplier_name'] ??
      row['vendor_name'] ??
      row['customer_name'] ??
      _nestedName(row['supplier']) ??
      _nestedName(row['vendor']) ??
      _nestedName(row['customer']);
  if (counterpartyName != null) {
    row.putIfAbsent('supplier_name', () => counterpartyName);
    row.putIfAbsent('counterparty_name', () => counterpartyName);
  }

  row.putIfAbsent('role', () => row['staff_role'] ?? row['position']);
  row.putIfAbsent('action', () => row['type'] ?? row['description']);
  row.putIfAbsent('created_at', () => row['date']);
  row.putIfAbsent('invoice_number',
      () => row['bill_number'] ?? row['number'] ?? row['reference']);
  row.putIfAbsent(
      'total_amount', () => row['amount'] ?? row['total'] ?? row['bill_total']);
  row.putIfAbsent('total_sales', () => _derivedValue(row, 'total_sales'));
  row.putIfAbsent('total_cash', () => _derivedValue(row, 'total_cash'));
  row.putIfAbsent('request_number',
      () => row['request_no'] ?? row['reference_number'] ?? row['id']);
  row.putIfAbsent('sku', () => row['item_sku']);
  row.putIfAbsent(
      'movement_type', () => row['transaction_type'] ?? row['movement_type']);
  row.putIfAbsent('quantity', () {
    final quantityIn = num.tryParse('${row['quantity_in'] ?? 0}') ?? 0;
    final quantityOut = num.tryParse('${row['quantity_out'] ?? 0}') ?? 0;
    if (quantityIn != 0) return quantityIn;
    if (quantityOut != 0) return -quantityOut;
    return null;
  });
  row.putIfAbsent('quantity_sold', () => row['quantity']);
  row.putIfAbsent(
      'item_details', () => row['item_name'] ?? row['name'] ?? row['item_sku']);
  row.putIfAbsent('gross_revenue',
      () => row['gross_revenue'] ?? row['revenue'] ?? row['total_revenue']);
  row.putIfAbsent('stock_requested',
      () => row['requested_quantity'] ?? row['quantity_requested']);
  row.putIfAbsent('expected_quantity',
      () => row['theoretical_quantity'] ?? row['system_closing_stock']);
  row.putIfAbsent('expected_amount',
      () => row['expected_closing_float'] ?? row['expected_cash']);
  row.putIfAbsent(
      'actual_amount', () => row['closing_float'] ?? row['total_payments']);
  row.putIfAbsent('variance_count', () {
    final items = row['items'];
    if (items is! List) return null;
    return items.where((item) {
      if (item is! Map) return false;
      final variance = num.tryParse('${item['variance'] ?? 0}') ?? 0;
      return variance != 0;
    }).length;
  });

  return row;
}

String? _nestedName(dynamic value) {
  if (value is! Map) return null;
  return value['name'] ??
      value['full_name'] ??
      value['staff_name'] ??
      value['employee_name'] ??
      _joinName(value['first_name'], value['last_name']) ??
      value['title'];
}

String? _joinName(dynamic first, dynamic last) {
  final parts = [first, last]
      .where((part) => part != null && '$part'.trim().isNotEmpty)
      .map((part) => '$part'.trim())
      .toList();
  return parts.isEmpty ? null : parts.join(' ');
}

typedef _ActionBodyBuilder = Map<String, dynamic> Function(
    Map<String, dynamic> row, String notes);

class _AuditorTableShell extends ConsumerStatefulWidget {
  const _AuditorTableShell({required this.section, required this.rows});

  final _AuditorDataSection section;
  final List<Map<String, dynamic>> rows;

  @override
  ConsumerState<_AuditorTableShell> createState() => _AuditorTableShellState();
}

class _AuditorTableShellState extends ConsumerState<_AuditorTableShell> {
  final _searchCtrl = TextEditingController();
  String _status = 'all';
  DateTime? _from;
  DateTime? _to;
  int _page = 0;
  static const int _pageSize = 25;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filteredRows();
    final pageCount =
        filtered.isEmpty ? 1 : ((filtered.length - 1) ~/ _pageSize) + 1;
    final page = _page.clamp(0, pageCount - 1);
    final visible = filtered.skip(page * _pageSize).take(_pageSize).toList();
    final statusOptions = _statusOptions();
    // Guard against a stale selection when the dataset (e.g. branch) changes.
    final statusValue = statusOptions.contains(_status) ? _status : 'all';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Wrap(
              spacing: 12,
              runSpacing: 12,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                SizedBox(
                  width: 360,
                  child: TextField(
                    controller: _searchCtrl,
                    decoration: InputDecoration(
                      labelText: 'Search',
                      hintText: widget.section.searchPlaceholder ??
                          'Search by reference, branch, staff or item...',
                      prefixIcon: const Icon(Icons.search, size: 18),
                    ),
                    onChanged: (_) => setState(() => _page = 0),
                  ),
                ),
                const _AuditorBranchScopeChip(),
                if (statusOptions.length > 1)
                  SizedBox(
                    width: 220,
                    child: DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: statusValue,
                      decoration: const InputDecoration(labelText: 'Status'),
                      items: statusOptions
                          .map((value) => DropdownMenuItem(
                                value: value,
                                child: Text(
                                  _label(value),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ))
                          .toList(),
                      selectedItemBuilder: (context) => statusOptions
                          .map((value) => Align(
                                alignment: Alignment.centerLeft,
                                child: Text(
                                  _label(value),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ))
                          .toList(),
                      onChanged: (value) => setState(() {
                        _status = value ?? 'all';
                        _page = 0;
                      }),
                    ),
                  ),
                OutlinedButton.icon(
                  onPressed: () => _pickDate(isFrom: true),
                  icon: const Icon(Icons.date_range, size: 16),
                  label: Text(_from == null
                      ? 'From'
                      : _from!.toIso8601String().split('T').first),
                ),
                OutlinedButton.icon(
                  onPressed: () => _pickDate(isFrom: false),
                  icon: const Icon(Icons.event, size: 16),
                  label: Text(_to == null
                      ? 'To'
                      : _to!.toIso8601String().split('T').first),
                ),
                if (_from != null ||
                    _to != null ||
                    _searchCtrl.text.isNotEmpty ||
                    _status != 'all')
                  TextButton.icon(
                    onPressed: () => setState(() {
                      _searchCtrl.clear();
                      _status = 'all';
                      _from = null;
                      _to = null;
                      _page = 0;
                    }),
                    icon: const Icon(Icons.clear, size: 16),
                    label: const Text('Clear'),
                  ),
                if (widget.section.enableExport)
                  FilledButton.icon(
                    onPressed: () => _exportCsv(filtered),
                    icon: const Icon(Icons.file_download, size: 16),
                    label: Text(
                        widget.section.title == 'Branch Sales Performance'
                            ? 'Export Ledger'
                            : 'Export'),
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.kWarning,
                      foregroundColor: Colors.white,
                      minimumSize: const Size(118, 44),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 12),
        widget.section._table(context, ref, visible),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Text(
              '${filtered.length} filtered • page ${page + 1} of $pageCount',
              style: const TextStyle(
                  fontSize: 12, color: AppColors.kTextSecondary),
            ),
            const SizedBox(width: 12),
            IconButton(
              tooltip: 'Previous page',
              onPressed:
                  page == 0 ? null : () => setState(() => _page = page - 1),
              icon: const Icon(Icons.chevron_left),
            ),
            IconButton(
              tooltip: 'Next page',
              onPressed: page >= pageCount - 1
                  ? null
                  : () => setState(() => _page = page + 1),
              icon: const Icon(Icons.chevron_right),
            ),
          ],
        ),
      ],
    );
  }

  /// Status-bearing keys vary across auditor endpoints — read whichever the
  /// row actually carries so the dropdown populates for every section.
  static const _statusKeys = [
    'status',
    'state',
    'approval_status',
    'payment_status',
    'verification_status',
    'audit_status',
    'review_status',
    'order_status',
    'reconciliation_status',
  ];

  String _statusOf(Map<String, dynamic> row) {
    for (final key in _statusKeys) {
      final value = widget.section._value(row, key);
      if (value != '—' && value.trim().isNotEmpty) return value;
    }
    return '';
  }

  List<String> _statusOptions() {
    final values = widget.rows
        .map(_statusOf)
        .where((value) => value.trim().isNotEmpty)
        .map((value) => value.toLowerCase())
        .toSet()
        .toList()
      ..sort();
    return ['all', ...values.take(12)];
  }

  List<Map<String, dynamic>> _filteredRows() {
    final query = _searchCtrl.text.trim().toLowerCase();
    // Ignore a stale status selection that no longer exists in the dataset.
    final activeStatus = _statusOptions().contains(_status) ? _status : 'all';
    return widget.rows.where((row) {
      if (query.isNotEmpty &&
          !row.values.any((value) => '$value'.toLowerCase().contains(query))) {
        return false;
      }
      if (activeStatus != 'all' &&
          _statusOf(row).toLowerCase() != activeStatus) {
        return false;
      }
      final date = _rowDate(row);
      if (_from != null && (date == null || date.isBefore(_dateOnly(_from!)))) {
        return false;
      }
      if (_to != null &&
          (date == null ||
              date.isAfter(_dateOnly(_to!).add(const Duration(days: 1))))) {
        return false;
      }
      return true;
    }).toList();
  }

  DateTime? _rowDate(Map<String, dynamic> row) {
    for (final entry in row.entries) {
      final key = entry.key.toLowerCase();
      if (key.contains('date') || key.endsWith('_at') || key == 'created_at') {
        final parsed = DateTime.tryParse('${entry.value}');
        if (parsed != null) return parsed;
      }
    }
    return null;
  }

  DateTime _dateOnly(DateTime value) =>
      DateTime(value.year, value.month, value.day);

  Future<void> _pickDate({required bool isFrom}) async {
    final now = DateTime.now();
    final selected = await showDatePicker(
      context: context,
      firstDate: DateTime(now.year - 5),
      lastDate: DateTime(now.year + 1),
      initialDate: (isFrom ? _from : _to) ?? now,
    );
    if (selected == null) return;
    setState(() {
      if (isFrom) {
        _from = selected;
      } else {
        _to = selected;
      }
      _page = 0;
    });
  }

  Future<void> _exportCsv(List<Map<String, dynamic>> rows) async {
    final directory = await getDownloadsDirectory() ??
        await getApplicationDocumentsDirectory();
    final safeTitle =
        widget.section.title.replaceAll(RegExp(r'[^A-Za-z0-9._-]'), '_');
    final file = File(
        '${directory.path}/${safeTitle}_${DateTime.now().millisecondsSinceEpoch}.csv');
    final columns = widget.section.columns;
    final lines = <String>[
      columns.map(_csv).join(','),
      for (final row in rows)
        columns
            .map((column) => _csv(widget.section._value(row, column)))
            .join(','),
    ];
    await file.writeAsString(lines.join('\n'), flush: true);
    if (!mounted) return;
    AppNotifier.showSnackBar(
        context,
        SnackBar(
          content: Text('Exported ${rows.length} records to ${file.path}'),
          backgroundColor: AppColors.kSuccess,
        ));
  }

  String _csv(String value) => '"${value.replaceAll('"', '""')}"';
}

class _AuditorRowAction {
  const _AuditorRowAction({
    required this.label,
    required this.icon,
    this.endpoint = '',
    this.method = 'POST',
    this.color,
    this.requiresNotes = false,
    this.promptNotes = true,
    this.isDetail = false,
    this.isInvestigate = false,
    this.visible = _alwaysVisible,
    this.body = _emptyBody,
  });

  final String label;
  final IconData icon;
  final String endpoint;
  final String method;
  final Color? color;
  final bool requiresNotes;
  final bool promptNotes;
  final bool isDetail;
  final bool isInvestigate;
  final bool Function(Map<String, dynamic> row) visible;
  final _ActionBodyBuilder body;

  static bool _alwaysVisible(Map<String, dynamic> _) => true;
  static Map<String, dynamic> _emptyBody(Map<String, dynamic> _, String __) =>
      const {};
}

String _rowId(Map<String, dynamic> row) {
  for (final key in [
    'id',
    'requestId',
    'request_id',
    'approval_id',
    'entity_id',
    'dispatch_id',
    'stock_count_id',
    'log_id',
    'invoice_id',
    'bill_id',
    'payment_id',
    'transaction_id',
    'usage_id',
    'wastage_id',
    'variance_id',
    'credit_bill_id',
    'loan_id',
    'advance_id',
  ]) {
    final value = row[key];
    if (value != null && '$value'.trim().isNotEmpty) return '$value';
  }
  return '';
}

String _rowEntityType(Map<String, dynamic> row, {String fallback = 'record'}) {
  for (final key in [
    'entity_type',
    'reference_type',
    'type',
    'source',
    '_source',
    'request_type',
  ]) {
    final value = row[key];
    if (value != null && '$value'.trim().isNotEmpty) return '$value';
  }
  return fallback;
}

String _payrollType(Map<String, dynamic> row) {
  final raw = _rowEntityType(row, fallback: 'credit_bill')
      .toLowerCase()
      .replaceAll('-', '_')
      .replaceAll(' ', '_');
  if (raw.contains('advance')) return 'advance';
  if (raw.contains('loan')) return 'loan';
  return 'credit_bill';
}

String _creditConfirmationType(Map<String, dynamic> row) {
  final raw = _rowEntityType(row, fallback: 'employee')
      .toLowerCase()
      .replaceAll('-', '_')
      .replaceAll(' ', '_');
  if (raw.contains('guest') || raw.contains('unpaid')) return 'guest';
  return 'employee';
}

bool _isPending(Map<String, dynamic> row) {
  final status =
      '${row['status'] ?? row['auditor_status'] ?? ''}'.toLowerCase();
  return status.isEmpty ||
      status == 'pending' ||
      status == 'open' ||
      status == 'pending_audit' ||
      status == 'pending_review' ||
      status == 'pending_verification' ||
      status == 'draft' ||
      status == 'unverified' ||
      status == 'unreviewed' ||
      status == 'flagged' ||
      status == 'completed' ||
      status == 'submitted';
}

Future<void> _showInvestigationDialog(
    BuildContext context, WidgetRef ref, Map<String, dynamic> row) async {
  final id = _rowId(row);
  final type = _rowEntityType(row, fallback: _inferAuditEntityType(row));
  dynamic detail;
  Object? error;
  if (id.isNotEmpty && _canLoadAuditorDetail(type)) {
    try {
      detail = await ref
          .read(auditorRepositoryProvider)
          .getRaw('/auditor/anomalies/$id', queryParameters: {'type': type});
    } catch (err) {
      error = err;
    }
  }
  if (!context.mounted) return;
  showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      title: const Text('Investigation'),
      content: SizedBox(
        width: 640,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _investigationBanner(row),
              const SizedBox(height: 12),
              if (error != null)
                Text('Could not load detail: $error',
                    style: const TextStyle(color: AppColors.kError))
              else if (detail != null)
                _detailBlock('Backend Detail', _flattenForDetail(detail)),
              const SizedBox(height: 12),
              _detailBlock('Selected Record', row),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close')),
      ],
    ),
  );
}

Widget _investigationBanner(Map<String, dynamic> row) {
  final amount = row['amount'] ??
      row['variance'] ??
      row['variance_amount'] ??
      row['total_amount'] ??
      row['total_revenue'];
  return Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.kWarning.withValues(alpha: 0.08),
      borderRadius: BorderRadius.circular(10),
      border: Border.all(color: AppColors.kWarning.withValues(alpha: 0.25)),
    ),
    child: Row(children: [
      const Icon(Icons.manage_search, color: AppColors.kWarning),
      const SizedBox(width: 10),
      Expanded(
        child: Text(
          'Entity: ${_rowEntityType(row)}  •  Reference: ${_displayReference(row)}  •  Amount/Variance: ${amount ?? '—'}',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
      ),
    ]),
  );
}

Map<String, dynamic> _flattenForDetail(dynamic raw) {
  if (raw is Map && raw['success'] == true && raw.containsKey('data')) {
    final data = raw['data'];
    if (data is Map) return Map<String, dynamic>.from(data);
    return {'data': data};
  }
  if (raw is Map) return Map<String, dynamic>.from(raw);
  return {'data': raw};
}

Widget _detailBlock(String title, Map<String, dynamic> row) {
  return Card(
    elevation: 0,
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(10),
      side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
    ),
    child: Padding(
      padding: const EdgeInsets.all(12),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        for (final entry in _detailEntries(row))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              SizedBox(
                width: 170,
                child: Text(_detailLabel(entry.key),
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 12)),
              ),
              Expanded(
                  child: Text(_formatDetailValue(row, entry.key, entry.value),
                      style: const TextStyle(fontSize: 12))),
            ]),
          ),
      ]),
    ),
  );
}

Future<String?> _showNotesDialog(BuildContext context, _AuditorRowAction action,
    Map<String, dynamic> row) async {
  if (!action.promptNotes && !action.requiresNotes) return '';
  final controller = TextEditingController();
  final result = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      title: Text(action.label),
      content: SizedBox(
        width: 420,
        child: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 6,
          decoration: InputDecoration(
            labelText: action.requiresNotes ? 'Notes / reason' : 'Notes',
            hintText: action.requiresNotes
                ? 'Enter the reason for this action'
                : 'Optional review notes',
            border: const OutlineInputBorder(),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        ElevatedButton(
          onPressed: () => Navigator.pop(context, controller.text),
          style: ElevatedButton.styleFrom(
            backgroundColor: action.color ?? AppColors.kPrimary,
            minimumSize: const Size(96, 40),
          ),
          child: Text(action.label),
        ),
      ],
    ),
  );
  controller.dispose();
  return result;
}

void _showDetailDialog(BuildContext context, Map<String, dynamic> row) {
  final detailRow = _normalizeRow(Map<String, dynamic>.from(row));
  final title = detailRow['title'] ??
      detailRow['request_number'] ??
      detailRow['dispatch_number'] ??
      detailRow['item_name'] ??
      detailRow['branch_name'] ??
      detailRow['name'] ??
      detailRow['id'] ??
      'Record';
  openRecordDetailScreen(
    context,
    title: _format(title),
    record: detailRow,
  );
}

Future<void> _createRowException(
  BuildContext context,
  WidgetRef ref,
  Map<String, dynamic> row, {
  String fallbackType = 'record',
  VoidCallback? onDone,
}) async {
  final action = _raiseExceptionAction(fallbackType: fallbackType);
  final notes = await _showNotesDialog(context, action, row);
  if (notes == null || notes.trim().isEmpty) return;
  try {
    await ref.read(auditorRepositoryProvider).submitAction(
          action.method,
          action.endpoint,
          data: action.body(row, notes.trim()),
        );
    onDone?.call();
    if (context.mounted) {
      AppNotifier.showSnackBar(
          context,
          const SnackBar(
            content: Text('Exception created'),
            backgroundColor: AppColors.kSuccess,
          ));
    }
  } catch (error) {
    if (context.mounted) {
      AppNotifier.showSnackBar(
          context,
          SnackBar(
            content: Text('Exception failed: $error'),
            backgroundColor: AppColors.kError,
          ));
    }
  }
}

String _inferAuditEntityType(Map<String, dynamic> row) {
  final source = '${row['_source'] ?? ''}'.toLowerCase();
  if (source == 'analysis' || row.containsKey('consumption_ratio')) {
    return 'sold_item';
  }
  if (source.contains('stock') ||
      row.containsKey('count_type') ||
      row.containsKey('system_quantity')) {
    return 'stock_audit';
  }
  if (row.containsKey('dispatch_number') || source == 'deliveries') {
    return 'delivery';
  }
  if (row.containsKey('item_sku') || row.containsKey('transaction_type')) {
    return 'stock_item';
  }
  if (row.containsKey('request_number') || row.containsKey('request_no')) {
    return 'stock_request';
  }
  if (row.containsKey('exception_type') || row.containsKey('severity')) {
    return 'exception';
  }
  return 'record';
}

const Set<String> _auditorDetailEntityTypes = {
  'restaurant_order',
  'bar_order',
  'bill',
  'exception',
  'delivery',
  'stock_audit',
  'bar_stock',
  'stock_request',
  'approval',
  'stock_item',
  'sold_item',
};

const Set<String> _auditorVerificationEntityTypes = {
  'restaurant_order',
  'bar_order',
  'bill',
  'invoice',
  'exception',
  'pos_transaction',
  'payment',
  'stock_movement',
  'kitchen_usage',
  'stock_request',
  'dispatch_note',
};

String _normalizeAuditEntityType(String value) =>
    value.toLowerCase().trim().replaceAll('-', '_').replaceAll(' ', '_');

bool _canLoadAuditorDetail(String type) =>
    _auditorDetailEntityTypes.contains(_normalizeAuditEntityType(type));

bool _canVerifyAuditorEntity(String type) =>
    _auditorVerificationEntityTypes.contains(_normalizeAuditEntityType(type));

const _viewAction = _AuditorRowAction(
  label: 'View',
  icon: Icons.visibility_outlined,
  isDetail: true,
  promptNotes: false,
);

const _investigateAction = _AuditorRowAction(
  label: 'Investigate',
  icon: Icons.manage_search,
  isInvestigate: true,
  promptNotes: false,
);

_AuditorRowAction _verifyAnomalyAction({String fallbackType = 'record'}) =>
    _AuditorRowAction(
      label: 'Verify',
      icon: Icons.verified_outlined,
      endpoint: '/auditor/verify/clear',
      color: AppColors.kSuccess,
      body: (row, notes) => {
        'id': _rowId(row),
        'type': _normalizeAuditEntityType(
            _rowEntityType(row, fallback: fallbackType)),
        if (notes.isNotEmpty) 'notes': notes,
      },
      visible: (row) =>
          _isPending(row) &&
          _canVerifyAuditorEntity(_rowEntityType(row, fallback: fallbackType)),
    );

_AuditorRowAction _flagAction({String fallbackType = 'record'}) =>
    _AuditorRowAction(
      label: 'Flag',
      icon: Icons.flag_outlined,
      endpoint: '/auditor/watchlist',
      color: AppColors.kWarning,
      requiresNotes: true,
      body: (row, notes) => {
        'entity_type': _normalizeAuditEntityType(
            _rowEntityType(row, fallback: fallbackType)),
        'entity_id': _rowId(row),
        'reason': notes,
        'metadata': row,
      },
      visible: _isPending,
    );

_AuditorRowAction _raiseExceptionAction({String fallbackType = 'record'}) =>
    _AuditorRowAction(
      label: 'Exception',
      icon: Icons.report_problem_outlined,
      endpoint: '/auditor/exceptions',
      color: AppColors.kError,
      requiresNotes: true,
      body: (row, notes) {
        final entityType = _normalizeAuditEntityType(
            _rowEntityType(row, fallback: fallbackType));
        return {
          'exception_type': entityType,
          'reference_type': entityType,
          'reference_id': _rowId(row),
          'description': notes,
          'severity': 'medium',
          'status': 'open',
          'metadata': row,
          if (row['branch_id'] != null) 'branch_id': row['branch_id'],
        };
      },
    );

_AuditorRowAction _approvalAction(String label, String status, Color color) =>
    _AuditorRowAction(
      label: label,
      icon: status == 'approved' ? Icons.check_circle_outline : Icons.cancel,
      endpoint: '/auditor/approvals/handle',
      color: color,
      requiresNotes: status == 'rejected',
      body: (row, notes) => {
        'requestId': _rowId(row),
        'status': status,
        if (notes.isNotEmpty) 'notes': notes,
      },
      visible: _isPending,
    );

_AuditorRowAction _deliveryAction(String label, String action, Color color) =>
    _AuditorRowAction(
      label: label,
      icon: action == 'approve' ? Icons.check_circle_outline : Icons.flag,
      endpoint: '/dispatch/auditor/deliveries/:id/review',
      color: color,
      requiresNotes: action == 'flag',
      body: (_, notes) => {
        'action': action,
        if (notes.isNotEmpty) 'notes': notes,
      },
      visible: _isPending,
    );

_AuditorRowAction _dailyLogAction(String label, String action, Color color) =>
    _AuditorRowAction(
      label: label,
      icon: action == 'verified' ? Icons.verified_outlined : Icons.cancel,
      endpoint: '/auditor/daily-logs/:id/verify',
      color: color,
      requiresNotes: action == 'rejected',
      body: (_, notes) => {
        'action': action,
        if (notes.isNotEmpty) 'notes': notes,
      },
      visible: _isPending,
    );

_AuditorRowAction _cashierLogbookAction(
        String label, String action, Color color) =>
    _AuditorRowAction(
      label: label,
      icon: action == 'approve' ? Icons.verified_outlined : Icons.cancel,
      endpoint: '/cashier/logbook/:id/audit',
      color: color,
      requiresNotes: action == 'reject',
      body: (_, notes) => {
        'action': action,
        if (notes.isNotEmpty) 'notes': notes,
      },
      visible: _isPending,
    );

_AuditorRowAction _resolveExceptionAction() => _AuditorRowAction(
      label: 'Resolve',
      icon: Icons.task_alt,
      endpoint: '/auditor/exceptions/:id/resolve',
      method: 'PUT',
      color: AppColors.kSuccess,
      requiresNotes: true,
      body: (_, notes) => {'resolution_notes': notes},
      visible: _isPending,
    );

_AuditorRowAction _kitchenAuditAction(
        String endpoint, String label, String status, Color color) =>
    _AuditorRowAction(
      label: label,
      icon: status == 'approved' ? Icons.verified_outlined : Icons.flag,
      endpoint: endpoint,
      method: 'PUT',
      color: color,
      requiresNotes: status != 'approved',
      body: (_, notes) => {
        'audit_status': status,
        'status': status,
        if (notes.isNotEmpty) 'audit_notes': notes,
        if (notes.isNotEmpty) 'notes': notes,
      },
      visible: _isPending,
    );

_AuditorRowAction _barStockVerifyAction() => _AuditorRowAction(
      label: 'Verify',
      icon: Icons.verified_outlined,
      endpoint: '/auditor/verify/bar-stock/:id/verify',
      color: AppColors.kSuccess,
      body: (_, notes) => {if (notes.isNotEmpty) 'notes': notes},
      visible: _isPending,
    );

_AuditorRowAction _creditBillStatusAction(
        String label, String status, Color color) =>
    _AuditorRowAction(
      label: label,
      icon: status == 'approved' ? Icons.check_circle_outline : Icons.cancel,
      endpoint: '/credit/:type/:id/confirm',
      method: 'PUT',
      color: color,
      requiresNotes: false,
      body: (_, notes) => {
        'role': 'auditor',
        if (notes.isNotEmpty) 'notes': notes,
      },
      visible: _isPending,
    );

class AuditorOverviewSection extends ConsumerWidget {
  const AuditorOverviewSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logsRequest = _auditorRequest(ref, '/audit/logs');
    final exceptionsRequest = _auditorRequest(ref, '/auditor/exceptions');
    final voidsRequest = _auditorRequest(ref, '/auditor/void-bills');
    final logsAsync = ref.watch(_auditorRawProvider(logsRequest));
    final exceptionsAsync = ref.watch(_auditorRawProvider(exceptionsRequest));
    final voidsAsync = ref.watch(_auditorRawProvider(voidsRequest));

    final logs = logsAsync.maybeWhen(
      data: _overviewRows,
      orElse: () => <Map<String, dynamic>>[],
    );
    final exceptions = exceptionsAsync.maybeWhen(
      data: _overviewRows,
      orElse: () => <Map<String, dynamic>>[],
    );
    final voids = voidsAsync.maybeWhen(
      data: _overviewRows,
      orElse: () => <Map<String, dynamic>>[],
    );
    final highRisk = logs
        .where((row) => '${row['severity'] ?? ''}'.toLowerCase() == 'high')
        .length;
    final mediumRisk = logs
        .where((row) => '${row['severity'] ?? ''}'.toLowerCase() == 'medium')
        .length;
    final complianceScore = logs.isEmpty
        ? 100
        : (100 - (highRisk * 10) - (mediumRisk * 2)).clamp(60, 100);
    final pendingReviews = exceptions
        .where((row) => !{'resolved', 'closed', 'approved', 'verified'}
            .contains(
                '${row['status'] ?? row['review_status'] ?? ''}'.toLowerCase()))
        .length;
    final isLoading = logsAsync.isLoading ||
        exceptionsAsync.isLoading ||
        voidsAsync.isLoading;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(
            _auditorRawProvider(_currentAuditorRequest(ref, '/audit/logs')));
        ref.invalidate(_auditorRawProvider(
            _currentAuditorRequest(ref, '/auditor/exceptions')));
        ref.invalidate(_auditorRawProvider(
            _currentAuditorRequest(ref, '/auditor/void-bills')));
      },
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _AuditControlHeader(isLoading: isLoading),
          const SizedBox(height: 24),
          LayoutBuilder(builder: (context, constraints) {
            final columns = constraints.maxWidth < 760 ? 2 : 4;
            final width =
                (constraints.maxWidth - ((columns - 1) * 12)) / columns;
            final stats = [
              _OverviewStat(
                label: 'Compliance Score',
                value: '$complianceScore%',
                icon: PhosphorIcons.chartPie(),
                color: AppColors.kPrimary,
              ),
              _OverviewStat(
                label: 'High Risk Findings',
                value: '$highRisk',
                icon: PhosphorIcons.warning(),
                color: AppColors.kError,
              ),
              _OverviewStat(
                label: 'Pending Reviews',
                value: '$pendingReviews',
                icon: PhosphorIcons.clock(),
                color: AppColors.kWarning,
              ),
              _OverviewStat(
                label: 'Voided Orders',
                value: '${voids.length}',
                icon: PhosphorIcons.trash(),
                color: Colors.blue,
              ),
            ];
            return Wrap(
              spacing: 12,
              runSpacing: 12,
              children: [
                for (final stat in stats)
                  SizedBox(width: width, child: _OverviewStatCard(stat: stat)),
              ],
            );
          }),
          const SizedBox(height: 28),
          LayoutBuilder(builder: (context, constraints) {
            final wide = constraints.maxWidth >= 980;
            final modules = Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const _OverviewSectionHeader(
                  title: 'Audit Modules',
                  subtitle: 'System verification and oversight modules',
                ),
                const SizedBox(height: 12),
                _ModuleGrid(modules: _auditControlModules),
                const SizedBox(height: 28),
                const _OverviewSectionHeader(
                  title: 'Personnel & HR Oversight',
                  subtitle: 'Staff management and payroll auditing',
                ),
                const SizedBox(height: 12),
                _ModuleGrid(modules: _hrOversightModules),
              ],
            );
            final exceptionsCard =
                _RecentExceptionsCard(exceptions: exceptions);
            if (!wide) {
              return Column(children: [
                modules,
                const SizedBox(height: 24),
                exceptionsCard,
              ]);
            }
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(flex: 2, child: modules),
                const SizedBox(width: 24),
                Expanded(
                  child: exceptionsCard,
                ),
              ],
            );
          }),
        ]),
      ),
    );
  }
}

class _AuditControlHeader extends ConsumerWidget {
  const _AuditControlHeader({required this.isLoading});

  final bool isLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
      Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          color: AppColors.kPrimary,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.08),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Icon(PhosphorIcons.shieldCheck(), color: Colors.white, size: 24),
      ),
      const SizedBox(width: 16),
      const Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            'Audit Control',
            style: TextStyle(
              color: AppColors.kTextPrimary,
              fontSize: 28,
              fontWeight: FontWeight.w800,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'High-integrity verification and system compliance oversight',
            style: TextStyle(color: AppColors.kTextSecondary, fontSize: 13),
          ),
        ]),
      ),
      const _AuditorBranchScopeChip(),
      const SizedBox(width: 8),
      OutlinedButton.icon(
        onPressed: () {
          ref.invalidate(
              _auditorRawProvider(_currentAuditorRequest(ref, '/audit/logs')));
          ref.invalidate(_auditorRawProvider(
              _currentAuditorRequest(ref, '/auditor/exceptions')));
          ref.invalidate(_auditorRawProvider(
              _currentAuditorRequest(ref, '/auditor/void-bills')));
        },
        icon: Icon(
          PhosphorIcons.arrowsClockwise(),
          size: 16,
        ),
        label: Text(isLoading ? 'Refreshing' : 'Refresh'),
      ),
    ]);
  }
}

class _OverviewStat {
  const _OverviewStat({
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

class _OverviewStatCard extends StatelessWidget {
  const _OverviewStatCard({required this.stat});

  final _OverviewStat stat;

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: stat.color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(stat.icon, color: stat.color, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(
                stat.value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
              ),
              Text(
                stat.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.kTextSecondary,
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _OverviewSectionHeader extends StatelessWidget {
  const _OverviewSectionHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(
        title,
        style: const TextStyle(
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: AppColors.kTextPrimary,
        ),
      ),
      const SizedBox(height: 2),
      Text(
        subtitle,
        style: const TextStyle(fontSize: 12, color: AppColors.kTextSecondary),
      ),
    ]);
  }
}

class _AuditModule {
  const _AuditModule({
    required this.title,
    required this.description,
    required this.icon,
    required this.route,
    this.badge,
  });

  final String title;
  final String description;
  final IconData icon;
  final String route;
  final String? badge;
}

final _auditControlModules = <_AuditModule>[
  _AuditModule(
      title: 'Shift Verification',
      description: 'Verify reconciled shifts',
      icon: PhosphorIcons.clipboardText(),
      route: '/auditor/shift-verification',
      badge: 'New'),
  _AuditModule(
      title: 'Inventory Flow',
      description: 'Physical vs theoretical audit',
      icon: PhosphorIcons.package(),
      route: '/auditor/stock',
      badge: 'Critical'),
  _AuditModule(
      title: 'Revenue Audit',
      description: 'Transaction verification',
      icon: PhosphorIcons.currencyDollar(),
      route: '/auditor/sales',
      badge: 'Live'),
  _AuditModule(
      title: 'Banking Review',
      description: 'Approve banking transactions',
      icon: PhosphorIcons.bank(),
      route: '/auditor/banking',
      badge: 'New'),
  _AuditModule(
      title: 'Invoice Verification',
      description: 'Review & verify invoices',
      icon: PhosphorIcons.fileText(),
      route: '/auditor/invoices',
      badge: 'New'),
  _AuditModule(
      title: 'Order Tracking',
      description: 'Branch requisition audit',
      icon: PhosphorIcons.shoppingCart(),
      route: '/auditor/orders'),
  _AuditModule(
      title: 'Item Analytics',
      description: 'Volume & performance',
      icon: PhosphorIcons.chartBar(),
      route: '/auditor/sold-items'),
  _AuditModule(
      title: 'Leakage Control',
      description: 'Wastage & usage oversight',
      icon: PhosphorIcons.warning(),
      route: '/auditor/audit-reports'),
  _AuditModule(
      title: 'Kitchen Flow',
      description: 'Back-of-house requests',
      icon: PhosphorIcons.shoppingBag(),
      route: '/auditor/kitchen-requisitions'),
  _AuditModule(
      title: 'Financial Sync',
      description: 'Gateway reconciliation',
      icon: PhosphorIcons.creditCard(),
      route: '/auditor/financial-verification'),
  _AuditModule(
      title: 'Search',
      description: 'Find any record',
      icon: PhosphorIcons.magnifyingGlass(),
      route: '/auditor/search'),
];

final _hrOversightModules = <_AuditModule>[
  _AuditModule(
      title: 'HR Command',
      description: 'Personnel Dashboard',
      icon: PhosphorIcons.users(),
      route: '/auditor/hr'),
  _AuditModule(
      title: 'Employee Repo',
      description: 'Staff directory & records',
      icon: PhosphorIcons.userCheck(),
      route: '/auditor/hr/employees'),
  _AuditModule(
      title: 'Payroll Audit',
      description: 'Verify salary processing',
      icon: PhosphorIcons.currencyDollar(),
      route: '/auditor/hr/payroll'),
];

class _ModuleGrid extends StatelessWidget {
  const _ModuleGrid({required this.modules});

  final List<_AuditModule> modules;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, constraints) {
      final columns = constraints.maxWidth < 560 ? 2 : 3;
      final width = (constraints.maxWidth - ((columns - 1) * 12)) / columns;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final module in modules)
            SizedBox(width: width, child: _ModuleCard(module: module)),
        ],
      );
    });
  }
}

class _ModuleCard extends StatelessWidget {
  const _ModuleCard({required this.module});

  final _AuditModule module;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () => context.go(module.route),
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Container(
              width: 38,
              height: 38,
              decoration: BoxDecoration(
                color: AppColors.kSurface,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(module.icon, size: 19, color: AppColors.kPrimary),
            ),
            const SizedBox(height: 12),
            Text(
              module.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 2),
            Text(
              module.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 11, color: AppColors.kTextSecondary),
            ),
            if (module.badge != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.kSurface,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  module.badge!.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: AppColors.kTextSecondary,
                  ),
                ),
              ),
            ],
          ]),
        ),
      ),
    );
  }
}

class _RecentExceptionsCard extends StatelessWidget {
  const _RecentExceptionsCard({required this.exceptions});

  final List<Map<String, dynamic>> exceptions;

  @override
  Widget build(BuildContext context) {
    final visible = exceptions.take(8).toList();
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const _OverviewSectionHeader(
            title: 'Recent Exceptions',
            subtitle: 'Latest critical system flags',
          ),
          const SizedBox(height: 16),
          if (visible.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 28),
              child: Column(children: [
                Icon(Icons.verified_user_outlined,
                    color: AppColors.kTextSecondary, size: 26),
                SizedBox(height: 10),
                Text('No critical findings',
                    style: TextStyle(fontWeight: FontWeight.w800)),
                SizedBox(height: 4),
                Text(
                  'The system is currently operating within normal parameters.',
                  textAlign: TextAlign.center,
                  style:
                      TextStyle(fontSize: 12, color: AppColors.kTextSecondary),
                ),
              ]),
            )
          else
            for (final item in visible) ...[
              _ExceptionTile(item: item),
              if (item != visible.last) const Divider(height: 18),
            ],
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: () => context.go('/auditor/revenue-oversight'),
            icon: const Icon(Icons.arrow_forward, size: 16),
            label: const Text('View Audit Watchlist'),
          ),
        ]),
      ),
    );
  }
}

class _ExceptionTile extends StatelessWidget {
  const _ExceptionTile({required this.item});

  final Map<String, dynamic> item;

  @override
  Widget build(BuildContext context) {
    final severity = '${item['severity'] ?? ''}'.toUpperCase();
    final color = severity == 'HIGH' || severity == 'CRITICAL'
        ? AppColors.kError
        : severity == 'MEDIUM'
            ? AppColors.kWarning
            : AppColors.kTextSecondary;
    return InkWell(
      onTap: () {
        final id = _rowId(item);
        if (id.isNotEmpty) {
          context.go('/auditor/revenue-oversight/details/$id?type=exception');
        }
      },
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: 8,
          height: 8,
          margin: const EdgeInsets.only(top: 7),
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        const SizedBox(width: 12),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              '${item['detail'] ?? item['description'] ?? item['exception_type'] ?? 'Audit exception'}',
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 2),
            Text(
              '${_label('${item['type'] ?? item['exception_type'] ?? 'exception'}')} • ${_format(item['created_at'] ?? item['time'] ?? '')}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 11, color: AppColors.kTextSecondary),
            ),
          ]),
        ),
        Icon(PhosphorIcons.caretRight(),
            size: 16, color: AppColors.kTextSecondary),
      ]),
    );
  }
}

List<Map<String, dynamic>> _overviewRows(dynamic raw) {
  final data = raw is Map && raw['success'] == true && raw.containsKey('data')
      ? raw['data']
      : raw;
  if (data is List) {
    return data
        .whereType<Map>()
        .map((row) => _normalizeRow(Map<String, dynamic>.from(row)))
        .toList();
  }
  if (data is Map) {
    for (final key in [
      'items',
      'logs',
      'records',
      'exceptions',
      'voids',
      'bills',
      'data',
    ]) {
      final value = data[key];
      if (value is List) {
        return value
            .whereType<Map>()
            .map((row) => _normalizeRow(Map<String, dynamic>.from(row)))
            .toList();
      }
    }
  }
  return const [];
}

class AuditorFinancialVerificationSection extends StatelessWidget {
  const AuditorFinancialVerificationSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Financial Verification',
        subtitle:
            'Reconciling daily collection gateways against operational sales records',
        icon: PhosphorIcons.currencyDollar(),
        endpoint: '/cashier/logbook/pending',
        listKeys: const ['logbooks', 'records', 'data', 'items'],
        summaryKeys: const ['summary', 'stats'],
        columns: const [
          'branch_name',
          'cashier_name',
          'log_date',
          'total_sales',
          'total_cash',
          'status'
        ],
        enableExport: true,
        syncLabel: 'Sync Records',
        searchPlaceholder: 'Search logbook, cashier, branch or payment...',
        emptyTitle: 'No logbooks pending verification',
        emptySubtitle: 'All records are current',
        actions: [
          _viewAction,
          _investigateAction,
          _cashierLogbookAction('Approve', 'approve', AppColors.kSuccess),
          _cashierLogbookAction('Reject', 'reject', AppColors.kError),
          _flagAction(),
          _raiseExceptionAction(fallbackType: 'logbook'),
        ],
      );
}

class AuditorShiftVerificationSection extends StatelessWidget {
  const AuditorShiftVerificationSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Shift Verification',
        subtitle: 'Verify reconciled shifts for audit compliance',
        icon: PhosphorIcons.clockClockwise(),
        endpoint: '/finance/shift-pnl/summary',
        listKeys: const ['shifts', 'summaries', 'items'],
        summaryKeys: const ['summary', 'totals'],
        columns: const [
          'branch_name',
          'date',
          'shift_id',
          'total_revenue',
          'net_profit',
          'status'
        ],
        enableExport: true,
        searchPlaceholder: 'Search shift, cashier, branch or date...',
        emptyTitle: 'All shifts processed',
        emptySubtitle: 'Select a shift to review',
        actions: [
          _viewAction,
          _investigateAction,
          _flagAction(fallbackType: 'shift'),
          _raiseExceptionAction(fallbackType: 'shift'),
        ],
      );
}

class AuditorRevenueOversightSection extends StatelessWidget {
  const AuditorRevenueOversightSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Revenue Oversight',
        subtitle:
            'Real-time yield monitoring and departmental performance audit',
        icon: PhosphorIcons.trendUp(),
        endpoint: '/auditor/verify/revenue',
        listKeys: const ['branch_summaries', 'revenue', 'records', 'items'],
        summaryKeys: const ['summary', 'stats'],
        columns: const [
          'revenue_stream',
          'amount',
          'share',
          'total_revenue',
          'status'
        ],
        enableExport: true,
        syncLabel: 'Sync',
        searchPlaceholder: 'Search department, branch or revenue stream...',
        emptyTitle: 'No logbooks pending verification',
        emptySubtitle: 'All records are current',
        actions: [
          _viewAction,
          _investigateAction,
          _flagAction(fallbackType: 'revenue'),
          _raiseExceptionAction(fallbackType: 'revenue'),
        ],
      );
}

class AuditorSalesAuditSection extends ConsumerStatefulWidget {
  const AuditorSalesAuditSection({super.key});

  @override
  ConsumerState<AuditorSalesAuditSection> createState() =>
      _AuditorSalesAuditSectionState();
}

class _AuditorSalesAuditSectionState
    extends ConsumerState<AuditorSalesAuditSection> {
  String _activeTab = 'restaurant';

  @override
  Widget build(BuildContext context) {
    final selectedBranchId = ref.watch(adminSelectedBranchProvider);
    final request = _auditorRequest(ref, '/auditor/verify/sales');
    final value = ref.watch(_auditorRawProvider(request));
    return Column(children: [
      _salesHeader(selectedBranchId),
      Expanded(
        child: value.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _salesError(error),
          data: (raw) {
            final payload = _salesPayload(raw);
            return selectedBranchId == null
                ? _branchOverview(payload)
                : _branchDrillDown(payload, selectedBranchId);
          },
        ),
      ),
    ]);
  }

  Widget _salesHeader(String? selectedBranchId) {
    return Container(
      padding: const EdgeInsets.fromLTRB(28, 28, 28, 12),
      color: Colors.white,
      child: Row(children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: const Color(0xFF1D1917),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Icon(PhosphorIcons.receipt(), color: Colors.white, size: 24),
        ),
        const SizedBox(width: 18),
        Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              selectedBranchId == null ? 'Revenue Audit' : 'Branch Sales Audit',
              style: const TextStyle(
                fontSize: 27,
                fontWeight: FontWeight.w800,
                color: AppColors.kTextPrimary,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Transaction verification across operational sales channels',
              style: TextStyle(fontSize: 14, color: AppColors.kTextSecondary),
            ),
          ]),
        ),
        if (selectedBranchId != null) ...[
          OutlinedButton.icon(
            onPressed: () =>
                ref.read(adminSelectedBranchProvider.notifier).state = null,
            icon: const Icon(Icons.arrow_back, size: 16),
            label: const Text('All Branches'),
          ),
          const SizedBox(width: 8),
        ],
        const _AuditorBranchScopeChip(),
        const SizedBox(width: 10),
        FilledButton.icon(
          onPressed: () => ref.invalidate(_auditorRawProvider(
              _currentAuditorRequest(ref, '/auditor/verify/sales'))),
          icon: const Icon(Icons.refresh),
          label: const Text('Refresh'),
          style: FilledButton.styleFrom(
            backgroundColor: const Color(0xFF1D1917),
            foregroundColor: Colors.white,
            minimumSize: const Size(112, 44),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        const SizedBox(width: 8),
        OutlinedButton.icon(
          onPressed: () => _showSalesExceptionDialog(),
          icon: const Icon(Icons.report_problem_outlined, size: 16),
          label: const Text('Exception'),
        ),
      ]),
    );
  }

  Widget _salesError(Object error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(PhosphorIcons.warning(), color: AppColors.kError, size: 32),
          const SizedBox(height: 12),
          const Text('Failed to load Revenue Audit',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(apiErrorMessage(error),
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.kTextSecondary)),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () => ref.invalidate(_auditorRawProvider(
                _currentAuditorRequest(ref, '/auditor/verify/sales'))),
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Retry'),
          ),
        ]),
      ),
    );
  }

  Widget _branchOverview(Map<String, dynamic> payload) {
    final branches = _salesList(payload['branch_summaries']);
    final totalRevenue =
        branches.fold<num>(0, (sum, row) => sum + _branchTotal(row));
    final restaurant = branches.fold<num>(
        0, (sum, row) => sum + _nestedNum(row, 'restaurant', 'total_value'));
    final bar = branches.fold<num>(
        0, (sum, row) => sum + _nestedNum(row, 'bar', 'total_value'));
    final pool = branches.fold<num>(
        0,
        (sum, row) =>
            sum +
            (_nestedNum(row, 'pool', 'total_value') == 0
                ? _nestedNum(row, 'pool', 'total_sales')
                : _nestedNum(row, 'pool', 'total_value')));
    final voided =
        branches.fold<num>(0, (sum, row) => sum + _branchVoidCount(row));

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(_auditorRawProvider(
          _currentAuditorRequest(ref, '/auditor/verify/sales'))),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Wrap(spacing: 12, runSpacing: 12, children: [
            _salesMetric('Total Revenue', _money(totalRevenue),
                PhosphorIcons.trendUp(), const Color(0xFF1D1917)),
            _salesMetric('Restaurant', _money(restaurant),
                PhosphorIcons.forkKnife(), AppColors.kSuccess),
            _salesMetric('Bar & Lounge', _money(bar), PhosphorIcons.wine(),
                AppColors.kWarning),
            _salesMetric('Pool Table', _money(pool), Icons.sports_esports,
                const Color(0xFF4F46E5)),
            _salesMetric('Voided Orders', _wholeNumber(voided),
                PhosphorIcons.warning(), AppColors.kError),
          ]),
          const SizedBox(height: 22),
          _branchPerformanceTable(branches),
        ]),
      ),
    );
  }

  Widget _branchDrillDown(Map<String, dynamic> payload, String branchId) {
    final branchName = _selectedBranchName(branchId);
    final restaurant = _sectionSummary(payload, 'restaurant');
    final bar = _sectionSummary(payload, 'bar');
    final pos = _sectionSummary(payload, 'pos');
    final totalRevenue = _nestedNum(payload, 'data', 'total_value') +
        _num(payload['total_revenue']);
    final calculatedTotal = totalRevenue == 0
        ? _num(restaurant['total_value']) +
            _num(bar['total_value']) +
            _num(pos['total_value'])
        : totalRevenue;
    final voided = _num(restaurant['voided']) + _num(bar['voided']);
    final rows = _activeRows(payload);

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(_auditorRawProvider(
          _currentAuditorRequest(ref, '/auditor/verify/sales'))),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(
            branchName == null
                ? 'Comprehensive branch financial verification'
                : 'Comprehensive financial verification for $branchName',
            style: const TextStyle(
              color: AppColors.kTextSecondary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 18),
          Wrap(spacing: 12, runSpacing: 12, children: [
            _salesMetric('Total Revenue', _money(calculatedTotal),
                PhosphorIcons.trendUp(), const Color(0xFF1D1917)),
            _salesMetric(
                'Restaurant Orders',
                _wholeNumber(_num(restaurant['total_orders'])),
                PhosphorIcons.forkKnife(),
                AppColors.kSuccess),
            _salesMetric('Bar Orders', _wholeNumber(_num(bar['total_orders'])),
                PhosphorIcons.wine(), AppColors.kWarning),
            _salesMetric('Voids', _wholeNumber(voided), PhosphorIcons.warning(),
                voided > 0 ? AppColors.kError : AppColors.kSuccess),
          ]),
          const SizedBox(height: 22),
          _salesTabs(payload),
          const SizedBox(height: 12),
          _transactionTable(rows),
        ]),
      ),
    );
  }

  Widget _salesMetric(
      String label, String value, IconData icon, Color accentColor) {
    return SizedBox(
      width: 260,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.kDivider.withValues(alpha: 0.6)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.025),
              blurRadius: 12,
              offset: const Offset(0, 6),
            ),
          ],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: accentColor, size: 21),
          ),
          const SizedBox(height: 16),
          Text(value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  color: accentColor,
                  fontSize: 24,
                  fontWeight: FontWeight.w900)),
          const SizedBox(height: 4),
          Text(label.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 11,
                color: AppColors.kTextSecondary,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
              )),
        ]),
      ),
    );
  }

  Widget _branchPerformanceTable(List<Map<String, dynamic>> branches) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(18, 16, 18, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Branch Performance',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
              SizedBox(height: 2),
              Text('Comparative revenue analysis across operational nodes',
                  style:
                      TextStyle(color: AppColors.kTextSecondary, fontSize: 12)),
            ],
          ),
        ),
        const Divider(height: 1),
        if (branches.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 56, horizontal: 24),
            child: _auditEmptyState(
              title: 'No branch revenue records found',
              subtitle: 'Try another date range or refresh the audit feed.',
              icon: PhosphorIcons.receipt(),
            ),
          )
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
              columns: const [
                DataColumn(label: Text('Branch')),
                DataColumn(label: Text('Restaurant')),
                DataColumn(label: Text('Bar & Lounge')),
                DataColumn(label: Text('Pool Table')),
                DataColumn(label: Text('Voided')),
                DataColumn(label: Text('Gross Total')),
                DataColumn(label: Text('Action')),
              ],
              rows: [
                for (final branch in branches)
                  DataRow(
                    cells: [
                      DataCell(Text(
                          '${branch['branch_name'] ?? branch['name'] ?? 'Branch ${branch['branch_id'] ?? ''}'}')),
                      DataCell(_departmentCell(branch, 'restaurant', 'orders')),
                      DataCell(_departmentCell(branch, 'bar', 'orders')),
                      DataCell(_departmentCell(branch, 'pool', 'sales')),
                      DataCell(Text(_wholeNumber(_branchVoidCount(branch)))),
                      DataCell(Text(_money(_branchTotal(branch)))),
                      DataCell(TextButton(
                        onPressed: () {
                          final id = branch['branch_id'] ?? branch['id'];
                          if (id == null || '$id'.isEmpty) return;
                          ref.read(adminSelectedBranchProvider.notifier).state =
                              '$id';
                          setState(() => _activeTab = 'restaurant');
                        },
                        child: const Text('Open branch'),
                      )),
                    ],
                  ),
              ],
            ),
          ),
      ]),
    );
  }

  Widget _departmentCell(
      Map<String, dynamic> branch, String key, String countLabel) {
    final value = _nestedNum(branch, key, 'total_value') == 0
        ? _nestedNum(branch, key, 'total_sales')
        : _nestedNum(branch, key, 'total_value');
    final count = _nestedNum(branch, key, 'total_orders') == 0
        ? _nestedNum(branch, key, 'total_sales_count')
        : _nestedNum(branch, key, 'total_orders');
    return SizedBox(
      width: 130,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(_money(value),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontWeight: FontWeight.w800)),
          Text('${_wholeNumber(count)} $countLabel',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  fontSize: 11, color: AppColors.kTextSecondary)),
        ],
      ),
    );
  }

  Widget _salesTabs(Map<String, dynamic> payload) {
    final tabs = [
      ('restaurant', 'Restaurant', PhosphorIcons.forkKnife()),
      ('bar', 'Bar & Lounge', PhosphorIcons.wine()),
      ('pos', 'POS Transactions', Icons.smartphone),
      ('payments', 'Payments', PhosphorIcons.creditCard()),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(children: [
        for (final tab in tabs)
          Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              selected: _activeTab == tab.$1,
              avatar: Icon(tab.$3, size: 16),
              label:
                  Text('${tab.$2} (${_activeRowsFor(payload, tab.$1).length})'),
              onSelected: (_) => setState(() => _activeTab = tab.$1),
            ),
          ),
      ]),
    );
  }

  Widget _transactionTable(List<Map<String, dynamic>> rows) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 12),
          child: Text(_label(_activeTab),
              style:
                  const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
        ),
        const Divider(height: 1),
        if (rows.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 56, horizontal: 24),
            child: _auditEmptyState(
              title: 'No records found',
              subtitle: 'This branch has no records in the selected channel.',
              icon: PhosphorIcons.receipt(),
            ),
          )
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
              columns: const [
                DataColumn(label: Text('Reference')),
                DataColumn(label: Text('Guest / Description')),
                DataColumn(label: Text('Type')),
                DataColumn(label: Text('Amount')),
                DataColumn(label: Text('Status')),
                DataColumn(label: Text('Action')),
              ],
              rows: [
                for (final row in rows)
                  DataRow(cells: [
                    DataCell(Text(_salesReference(row))),
                    DataCell(Text(_salesDescription(row))),
                    DataCell(Text(_salesType(row))),
                    DataCell(Text(_money(_salesAmount(row)))),
                    DataCell(Text(_format(row['status'] ??
                        row['payment_status'] ??
                        row['order_status'] ??
                        'Recorded'))),
                    DataCell(Row(mainAxisSize: MainAxisSize.min, children: [
                      TextButton(
                        onPressed: () => _showDetailDialog(context, row),
                        child: const Text('Review'),
                      ),
                      TextButton(
                        onPressed: () => _createRowException(
                          context,
                          ref,
                          row,
                          fallbackType: _salesType(row),
                        ),
                        child: const Text('Exception'),
                      ),
                    ])),
                  ]),
              ],
            ),
          ),
      ]),
    );
  }

  Map<String, dynamic> _salesPayload(dynamic raw) {
    final payload = <String, dynamic>{};
    if (raw is Map) {
      final data = raw['data'];
      if (data is Map) payload.addAll(Map<String, dynamic>.from(data));
      raw.forEach((key, value) {
        if (key == 'success' || key == 'data') return;
        payload.putIfAbsent('$key', () => value);
      });
    } else if (raw is List) {
      payload['items'] = raw;
    }
    return payload;
  }

  List<Map<String, dynamic>> _salesList(dynamic value) => value is List
      ? value.whereType<Map>().map((e) {
          final row = Map<String, dynamic>.from(e);
          return _normalizeRow(row);
        }).toList()
      : <Map<String, dynamic>>[];

  Map<String, dynamic> _sectionSummary(
      Map<String, dynamic> payload, String key) {
    final direct = payload[key];
    if (direct is Map) return Map<String, dynamic>.from(direct);
    final data = payload['data'];
    if (data is Map && data[key] is Map) {
      return Map<String, dynamic>.from(data[key] as Map);
    }
    return {};
  }

  List<Map<String, dynamic>> _activeRows(Map<String, dynamic> payload) =>
      _activeRowsFor(payload, _activeTab);

  List<Map<String, dynamic>> _activeRowsFor(
      Map<String, dynamic> payload, String tab) {
    final orders = payload['orders'];
    final source = switch (tab) {
      'restaurant' =>
        orders is Map ? orders['restaurant'] : payload['restaurant_orders'],
      'bar' => orders is Map ? orders['bar'] : payload['bar_orders'],
      'pos' => payload['pos_transactions'] ?? payload['transactions'],
      'payments' => payload['payments'],
      _ => const [],
    };
    return _salesList(source).map((row) {
      row.putIfAbsent('type', () => tab);
      return row;
    }).toList();
  }

  num _branchTotal(Map<String, dynamic> row) {
    final direct = _num(row['total_revenue']) + _num(row['total_value']);
    if (direct != 0) return direct;
    return _nestedNum(row, 'restaurant', 'total_value') +
        _nestedNum(row, 'bar', 'total_value') +
        _nestedNum(row, 'pool', 'total_value') +
        _nestedNum(row, 'pool', 'total_sales');
  }

  num _branchVoidCount(Map<String, dynamic> row) =>
      _nestedNum(row, 'restaurant', 'voided') +
      _nestedNum(row, 'bar', 'voided');

  num _nestedNum(Map<String, dynamic> row, String objectKey, String valueKey) {
    final value = row[objectKey];
    if (value is Map) return _num(value[valueKey]);
    return 0;
  }

  num _num(dynamic value) => value is num ? value : num.tryParse('$value') ?? 0;

  num _salesAmount(Map<String, dynamic> row) => _num(
      row['total_amount'] ?? row['total'] ?? row['amount'] ?? row['value']);

  String _salesReference(Map<String, dynamic> row) =>
      _format(row['order_number'] ??
          row['transaction_id'] ??
          row['payment_reference'] ??
          row['short_code'] ??
          row['id'] ??
          '—');

  String _salesDescription(Map<String, dynamic> row) =>
      _format(row['guest_name'] ??
          row['customer_name'] ??
          row['description'] ??
          row['payment_type'] ??
          row['payment_method'] ??
          'Walk-in');

  String _salesType(Map<String, dynamic> row) => _label(
      '${row['type'] ?? row['order_type'] ?? row['payment_method'] ?? _activeTab}');

  String? _selectedBranchName(String branchId) {
    final branches = ref.read(adminBranchesProvider).valueOrNull ?? const [];
    for (final branch in branches) {
      if (branch.id == branchId) return branch.name;
    }
    return null;
  }

  Future<void> _showSalesExceptionDialog() async {
    AppNotifier.showSnackBar(
      context,
      const SnackBar(
        content: Text('Use the Exception button from any record review panel.'),
        backgroundColor: AppColors.kPrimary,
      ),
    );
  }
}

class AuditorBankingLogsSection extends StatelessWidget {
  const AuditorBankingLogsSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Banking Review',
        subtitle: 'Daily logs, deposits and banking verification',
        icon: PhosphorIcons.bank(),
        endpoint: '/auditor/daily-logs',
        columns: const [
          'branch_name',
          'log_date',
          'total_payments',
          'closing_balance',
          'status'
        ],
        actions: [
          _viewAction,
          _investigateAction,
          _dailyLogAction('Verify', 'verified', AppColors.kSuccess),
          _dailyLogAction('Reject', 'rejected', AppColors.kError),
          _raiseExceptionAction(fallbackType: 'logbook'),
        ],
      );
}

class AuditorInvoicesSection extends StatelessWidget {
  const AuditorInvoicesSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Invoice Verification',
        subtitle: 'Supplier and customer invoices pending audit review',
        icon: PhosphorIcons.receipt(),
        endpoint: '/auditor/invoice-verification',
        listKeys: const ['records', 'invoices', 'bills', 'data'],
        summaryKeys: const ['summary', 'stats'],
        columns: const [
          'invoice_number',
          'branch_name',
          'supplier_name',
          'total_amount',
          'balance',
          'status'
        ],
        enableExport: true,
        searchPlaceholder: 'Search invoice, supplier, customer or branch...',
        actions: [
          _viewAction,
          _investigateAction,
          _verifyAnomalyAction(fallbackType: 'invoice'),
          _flagAction(fallbackType: 'invoice'),
          _raiseExceptionAction(fallbackType: 'invoice'),
        ],
      );
}

class AuditorBranchOrdersSection extends ConsumerStatefulWidget {
  const AuditorBranchOrdersSection({super.key});

  @override
  ConsumerState<AuditorBranchOrdersSection> createState() =>
      _AuditorBranchOrdersSectionState();
}

class _AuditorBranchOrdersSectionState
    extends ConsumerState<AuditorBranchOrdersSection> {
  DateTime _from = DateTime.now().subtract(const Duration(days: 30));
  DateTime _to = DateTime.now();
  String _query = '';
  String _status = 'all';
  late Future<dynamic> _future;

  static const _endpoint = '/auditor/verify/branch-orders';

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<dynamic> _load() {
    return ref.read(auditorRepositoryProvider).getRaw(
      _endpoint,
      queryParameters: {
        'start_date': _date(_from),
        'end_date': _date(_to),
        if (_status != 'all') 'status': _status,
      },
    );
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    ref.listen<String?>(adminSelectedBranchProvider, (_, __) => _refresh());
    return Column(
      children: [
        _headerBar(),
        Expanded(
          child: FutureBuilder<dynamic>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Center(child: CircularProgressIndicator());
              }
              if (snapshot.hasError) {
                return _branchOrdersError(snapshot.error!);
              }
              return _body(snapshot.data);
            },
          ),
        ),
      ],
    );
  }

  Widget _headerBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.kPrimary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(PhosphorIcons.clipboardText(),
              color: AppColors.kPrimary, size: 20),
        ),
        const SizedBox(width: 14),
        const Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('Branch Orders',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.kTextPrimary)),
            Text('Verify and audit stock movement requests',
                style:
                    TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
          ]),
        ),
        const _AuditorBranchScopeChip(),
        const SizedBox(width: 8),
        IconButton(
          tooltip: 'Refresh',
          onPressed: _refresh,
          icon: const Icon(Icons.refresh),
        ),
      ]),
    );
  }

  Widget _body(dynamic raw) {
    final root = _unwrapBranchOrders(raw);
    final summary = Map<String, dynamic>.from(root['summary'] ?? {});
    final requests = _filteredRequests(_maps(root['requests']));
    final branches = _maps(summary['branch_summaries']);

    return RefreshIndicator(
      onRefresh: () async => _refresh(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _branchOrdersStats(summary),
          const SizedBox(height: 20),
          _filters(),
          const SizedBox(height: 12),
          if (branches.isNotEmpty) ...[
            _branchSummaryTable(branches),
            const SizedBox(height: 20),
          ],
          _requestsTable(requests),
        ]),
      ),
    );
  }

  Widget _branchOrdersStats(Map<String, dynamic> summary) {
    final cards = [
      (
        'Total Requests',
        summary['total_requests'] ?? 0,
        PhosphorIcons.fileText()
      ),
      ('Pending', summary['pending'] ?? 0, PhosphorIcons.clock()),
      ('Approved', summary['approved'] ?? 0, PhosphorIcons.checkCircle()),
      ('Rejected', summary['rejected'] ?? 0, PhosphorIcons.xCircle()),
    ];
    return LayoutBuilder(builder: (context, constraints) {
      final columns = constraints.maxWidth < 720 ? 2 : 4;
      final width = (constraints.maxWidth - ((columns - 1) * 12)) / columns;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final card in cards)
            SizedBox(
              width: width,
              height: 92,
              child: Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                      color: AppColors.kDivider.withValues(alpha: 0.5)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(children: [
                    Icon(card.$3, color: AppColors.kPrimary, size: 20),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('${card.$2}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 22, fontWeight: FontWeight.w800)),
                            Text(card.$1,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.kTextSecondary)),
                          ]),
                    ),
                  ]),
                ),
              ),
            ),
        ],
      );
    });
  }

  Widget _filters() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Wrap(spacing: 12, runSpacing: 12, children: [
          SizedBox(
            width: 280,
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Search request, branch or item',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (value) => setState(() => _query = value),
            ),
          ),
          SizedBox(
            width: 180,
            child: DropdownButtonFormField<String>(
              isExpanded: true,
              initialValue: _status,
              decoration: const InputDecoration(labelText: 'Status'),
              items: const [
                DropdownMenuItem(value: 'all', child: Text('All')),
                DropdownMenuItem(value: 'PENDING', child: Text('Pending')),
                DropdownMenuItem(value: 'APPROVED', child: Text('Approved')),
                DropdownMenuItem(value: 'REJECTED', child: Text('Rejected')),
                DropdownMenuItem(
                    value: 'DISPATCHED', child: Text('Dispatched')),
              ],
              onChanged: (value) {
                setState(() => _status = value ?? 'all');
                _refresh();
              },
            ),
          ),
          OutlinedButton.icon(
            onPressed: () => _pickDate(true),
            icon: const Icon(Icons.date_range, size: 16),
            label: Text(_date(_from)),
          ),
          OutlinedButton.icon(
            onPressed: () => _pickDate(false),
            icon: const Icon(Icons.event, size: 16),
            label: Text(_date(_to)),
          ),
        ]),
      ),
    );
  }

  Widget _branchSummaryTable(List<Map<String, dynamic>> branches) {
    return _simpleTable(
      title: 'Requisitions by Branch',
      count: branches.length,
      columns: const [
        'Branch Node',
        'Pending',
        'Approved',
        'Dispatched',
        'Rejected',
        'Total Items'
      ],
      rows: branches
          .map((branch) => [
                '${branch['branch_name'] ?? branch['name'] ?? '—'}',
                '${branch['pending'] ?? 0}',
                '${branch['approved'] ?? 0}',
                '${branch['dispatched'] ?? 0}',
                '${branch['rejected'] ?? 0}',
                '${branch['total_items'] ?? 0}',
              ])
          .toList(),
    );
  }

  Widget _requestsTable(List<Map<String, dynamic>> requests) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: Row(children: [
            const Expanded(
                child: Text('Stock Movement Requests',
                    style:
                        TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
            Text('${requests.length} records',
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary)),
          ]),
        ),
        const Divider(height: 1),
        if (requests.isEmpty)
          const Padding(
            padding: EdgeInsets.all(28),
            child: Center(
                child: Text('No stock movement requests found',
                    style: TextStyle(color: AppColors.kTextSecondary))),
          )
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
              columns: const [
                DataColumn(label: Text('Request Number')),
                DataColumn(label: Text('Branch')),
                DataColumn(label: Text('Department')),
                DataColumn(label: Text('Items')),
                DataColumn(label: Text('Status')),
                DataColumn(label: Text('Created')),
                DataColumn(label: Text('Actions')),
              ],
              rows: requests.map((request) {
                return DataRow(cells: [
                  DataCell(_cell(_requestNumber(request), width: 170)),
                  DataCell(_cell(_branchName(request), width: 160)),
                  DataCell(_cell('${request['department'] ?? 'General'}',
                      width: 130)),
                  DataCell(
                      _cell('${_requestItems(request).length}', width: 70)),
                  DataCell(_statusChip('${request['status'] ?? '—'}')),
                  DataCell(
                      _cell(_shortDate(request['created_at']), width: 110)),
                  DataCell(_requestActions(request)),
                ]);
              }).toList(),
            ),
          ),
      ]),
    );
  }

  Widget _simpleTable({
    required String title,
    required int count,
    required List<String> columns,
    required List<List<String>> rows,
  }) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: Row(children: [
            Expanded(
                child: Text(title,
                    style: const TextStyle(
                        fontWeight: FontWeight.w700, fontSize: 14))),
            Text('$count records',
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary)),
          ]),
        ),
        const Divider(height: 1),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
            columns: columns
                .map((column) => DataColumn(label: Text(column)))
                .toList(),
            rows: rows
                .map((row) => DataRow(
                    cells: row.map((cell) => DataCell(_cell(cell))).toList()))
                .toList(),
          ),
        ),
      ]),
    );
  }

  Widget _cell(String value, {double width = 130}) {
    return SizedBox(
      width: width,
      child: Text(value,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontSize: 12)),
    );
  }

  Widget _statusChip(String status) {
    final normalized = status.toUpperCase();
    final color =
        normalized.contains('APPROVED') || normalized.contains('READY')
            ? AppColors.kSuccess
            : normalized.contains('REJECT')
                ? AppColors.kError
                : normalized.contains('DISPATCH') ||
                        normalized.contains('DELIVER') ||
                        normalized.contains('RECEIVED')
                    ? AppColors.kPrimary
                    : AppColors.kWarning;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(status.replaceAll('_', ' '),
          style: TextStyle(
              color: color, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }

  Widget _requestActions(Map<String, dynamic> request) {
    return SizedBox(
      width: 230,
      child: Row(children: [
        TextButton(
          onPressed: () => _showRequestDetail(request),
          child: const Text('View'),
        ),
        if (_isPending(request))
          TextButton(
            onPressed: () => _verifyRequest(request),
            child: const Text('Verify'),
          ),
        TextButton(
          onPressed: () => _createRowException(
            context,
            ref,
            request,
            fallbackType: 'stock_request',
            onDone: _refresh,
          ),
          child: const Text('Exception'),
        ),
      ]),
    );
  }

  Widget _branchOrdersError(Object error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(PhosphorIcons.warning(), color: AppColors.kError, size: 32),
          const SizedBox(height: 12),
          const Text('Failed to load Branch Orders',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(apiErrorMessage(error),
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.kTextSecondary)),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _refresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Retry'),
          ),
        ]),
      ),
    );
  }

  List<Map<String, dynamic>> _filteredRequests(
      List<Map<String, dynamic>> rows) {
    final query = _query.trim().toLowerCase();
    return rows.where((row) {
      if (query.isNotEmpty &&
          ![
            _requestNumber(row),
            _branchName(row),
            row['department'],
            row['status'],
            ..._requestItems(row).map((item) => item['item_name'])
          ].any((value) => '$value'.toLowerCase().contains(query))) {
        return false;
      }
      return true;
    }).toList();
  }

  Future<void> _pickDate(bool isFrom) async {
    final selected = await showDatePicker(
      context: context,
      firstDate: DateTime(DateTime.now().year - 5),
      lastDate: DateTime(DateTime.now().year + 1),
      initialDate: isFrom ? _from : _to,
    );
    if (selected == null) return;
    setState(() {
      if (isFrom) {
        _from = selected;
      } else {
        _to = selected;
      }
    });
    _refresh();
  }

  Future<void> _verifyRequest(Map<String, dynamic> request) async {
    try {
      await ref.read(auditorRepositoryProvider).reviewStockRequest(
            _rowId(request),
            'APPROVE',
            notes: 'Verified from Branch Orders audit',
          );
      _refresh();
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            const SnackBar(
              content: Text('Stock request verified'),
              backgroundColor: AppColors.kSuccess,
            ));
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Verification failed: $error'),
              backgroundColor: AppColors.kError,
            ));
      }
    }
  }

  void _showRequestDetail(Map<String, dynamic> request) {
    openRecordDetailScreen(
      context,
      title: _requestNumber(request),
      subtitle: 'Stock Request — ${_branchName(request)}',
      record: request,
    );
  }

  Map<String, dynamic> _unwrapBranchOrders(dynamic raw) {
    final data = raw is Map && raw['success'] == true ? raw['data'] : raw;
    if (data is Map) return Map<String, dynamic>.from(data);
    return {'requests': data is List ? data : []};
  }

  List<Map<String, dynamic>> _maps(dynamic value) {
    if (value is! List) return [];
    return value.whereType<Map>().map((row) {
      final mapped = Map<String, dynamic>.from(row);
      return _normalizeRow(mapped);
    }).toList();
  }

  List<Map<String, dynamic>> _requestItems(Map<String, dynamic> request) {
    final items = request['items'];
    if (items is! List) return [];
    return items.whereType<Map>().map((item) {
      return Map<String, dynamic>.from(item);
    }).toList();
  }

  String _requestNumber(Map<String, dynamic> request) {
    return '${request['request_number'] ?? request['request_no'] ?? request['id'] ?? '—'}';
  }

  String _branchName(Map<String, dynamic> request) {
    return '${request['branch_name'] ?? _nestedName(request['requesting_branch']) ?? '—'}';
  }

  String _shortDate(dynamic value) {
    final date = DateTime.tryParse('$value');
    if (date == null) return '—';
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  String _date(DateTime value) {
    return '${value.year}-${value.month.toString().padLeft(2, '0')}-${value.day.toString().padLeft(2, '0')}';
  }
}

class AuditorStockAuditSection extends StatelessWidget {
  const AuditorStockAuditSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Inventory Flow',
        subtitle: 'Physical stock, theoretical stock and variance review',
        icon: PhosphorIcons.package(),
        endpoint: '/auditor/verify/stock-levels',
        listKeys: const ['stock_items', 'inventory'],
        summaryKeys: const ['summary'],
        columns: const [
          'item_name',
          'branch_name',
          'quantity',
          'expected_quantity',
          'variance'
        ],
        enableExport: true,
        searchPlaceholder: 'Search stock item, SKU, branch or variance...',
        actions: [
          _viewAction,
          _investigateAction,
          _flagAction(fallbackType: 'stock_item'),
          _raiseExceptionAction(fallbackType: 'stock_item'),
        ],
      );
}

class AuditorSoldItemsSection extends StatelessWidget {
  const AuditorSoldItemsSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Branch Sales Performance',
        subtitle:
            'Compare item movement and consumption efficiency across departments',
        icon: PhosphorIcons.chartBar(),
        endpoint: '/auditor/verify/sold-items',
        listKeys: const ['analysis', 'items', 'sold_items', 'records'],
        summaryKeys: const ['summary', 'totals'],
        columns: const [
          'item_details',
          'quantity_sold',
          'gross_revenue',
          'stock_requested',
          'efficiency'
        ],
        enableExport: true,
        syncLabel: 'Sync',
        searchPlaceholder: 'Search by item name...',
        emptyTitle: 'No matching items found',
        emptySubtitle: 'Adjust filters or date range',
        actions: [
          _viewAction,
          _investigateAction,
          _flagAction(fallbackType: 'sold_item'),
          _raiseExceptionAction(fallbackType: 'sold_item'),
        ],
      );
}

class AuditorBarStockSection extends StatelessWidget {
  const AuditorBarStockSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Bar Stock',
        subtitle: 'Review bar stock takes, variances and audit adjustments',
        icon: PhosphorIcons.wine(),
        endpoint: '/auditor/verify/bar-stock',
        listKeys: const ['stock_takes', 'audits', 'items'],
        summaryKeys: const ['summary', 'stats'],
        columns: const [
          'branch_name',
          'bar_name',
          'created_at',
          'variance_count',
          'status'
        ],
        actions: [
          _viewAction,
          _investigateAction,
          _barStockVerifyAction(),
          _flagAction(fallbackType: 'bar_stock'),
          _raiseExceptionAction(fallbackType: 'bar_stock'),
        ],
      );
}

class AuditorPurchasesSection extends StatelessWidget {
  const AuditorPurchasesSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Purchases',
        subtitle: 'Procurement, supplier invoices and expenditure audit',
        icon: PhosphorIcons.shoppingBag(),
        endpoint: '/auditor/verify/expenditure',
        listKeys: const ['purchase_orders', 'invoices', 'expenses', 'items'],
        summaryKeys: const ['summary', 'totals'],
        columns: const [
          'reference_number',
          'supplier_name',
          'branch_name',
          'total_amount',
          'status'
        ],
        actions: [
          _viewAction,
          _investigateAction,
          _flagAction(fallbackType: 'purchase'),
          _raiseExceptionAction(fallbackType: 'purchase'),
        ],
      );
}

class AuditorStaffAuditSection extends StatelessWidget {
  const AuditorStaffAuditSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Staff Audit',
        subtitle: 'Audit staff credit bills, advances, and loans',
        icon: PhosphorIcons.users(),
        endpoint: '/auditor/staff-audit',
        listKeys: const ['staff', 'audit_trail', 'records', 'items'],
        summaryKeys: const ['summary', 'stats'],
        columns: const [
          'date',
          'reference',
          'type',
          'amount',
          'staff_name',
          'description',
          'status',
        ],
        enableExport: true,
        searchPlaceholder: 'Search staff, reference or description...',
        emptyTitle: 'No staff audit transactions found',
        emptySubtitle: 'Try a different branch, staff member, or date range',
        actions: [
          _viewAction,
          _investigateAction,
          _flagAction(fallbackType: 'staff_audit'),
          _raiseExceptionAction(fallbackType: 'staff_audit'),
        ],
      );
}

class AuditorApprovalsSection extends StatelessWidget {
  const AuditorApprovalsSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Approvals',
        subtitle: 'Pending stock, invoice and operational approvals',
        icon: PhosphorIcons.checkCircle(),
        endpoint: '/auditor/approvals/pending',
        listKeys: const ['requests', 'approvals', 'items'],
        columns: const [
          'request_type',
          'branch_name',
          'requested_by',
          'status',
          'created_at'
        ],
        actions: [
          _viewAction,
          _investigateAction,
          _approvalAction('Approve', 'approved', AppColors.kSuccess),
          _approvalAction('Reject', 'rejected', AppColors.kError),
          _flagAction(fallbackType: 'approval'),
          _raiseExceptionAction(fallbackType: 'approval'),
        ],
      );
}

class AuditorKitchenRequisitionsSection extends StatelessWidget {
  const AuditorKitchenRequisitionsSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Kitchen Requisitions',
        subtitle: 'Kitchen requisitions and approval trail',
        icon: PhosphorIcons.chefHat(),
        endpoint: '/kitchen/requisitions',
        listKeys: const ['requisitions', 'data', 'items'],
        summaryKeys: const ['summary', 'stats'],
        columns: const [
          'requisition_number',
          'branch_name',
          'requested_by',
          'status',
          'created_at'
        ],
        searchPlaceholder: 'Search requisition, branch or requester...',
        emptyTitle: 'No kitchen requisitions found',
        emptySubtitle: 'Requisitions will appear here once submitted',
        actions: [
          _viewAction,
          _investigateAction,
          _flagAction(fallbackType: 'kitchen_requisition'),
          _raiseExceptionAction(fallbackType: 'kitchen_requisition'),
        ],
      );
}

class AuditorKitchenUsageSection extends StatelessWidget {
  const AuditorKitchenUsageSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Kitchen Usage',
        subtitle: 'Consumption variance and kitchen usage audit',
        icon: PhosphorIcons.chartBar(),
        endpoint: '/kitchen/usage',
        listKeys: const ['usage', 'entries', 'items', 'records'],
        columns: const [
          'item_name',
          'branch_name',
          'expected_usage',
          'actual_usage',
          'variance'
        ],
        actions: [
          _viewAction,
          _investigateAction,
          _kitchenAuditAction('/kitchen/usage/:id/audit', 'Audit', 'approved',
              AppColors.kSuccess),
          _kitchenAuditAction('/kitchen/usage/:id/audit', 'Reject', 'rejected',
              AppColors.kError),
          _flagAction(fallbackType: 'consumption'),
          _raiseExceptionAction(fallbackType: 'kitchen_usage'),
        ],
      );
}

class AuditorKitchenWastageSection extends StatelessWidget {
  const AuditorKitchenWastageSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Kitchen Wastage',
        subtitle: 'Inventory loss, disposal events and wastage exceptions',
        icon: PhosphorIcons.trash(),
        endpoint: '/kitchen/wastage',
        listKeys: const ['wastage', 'records', 'items'],
        columns: const [
          'item_name',
          'branch_name',
          'quantity',
          'status',
          'created_at'
        ],
        actions: [
          _viewAction,
          _investigateAction,
          _kitchenAuditAction('/kitchen/wastage/:id/audit', 'Audit', 'approved',
              AppColors.kSuccess),
          _kitchenAuditAction('/kitchen/wastage/:id/audit', 'Reject',
              'rejected', AppColors.kError),
          _flagAction(fallbackType: 'wastage'),
          _raiseExceptionAction(fallbackType: 'wastage'),
        ],
      );
}

class AuditorDeliveriesSection extends StatelessWidget {
  const AuditorDeliveriesSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Deliveries',
        subtitle: 'Dispatch deliveries and receiving audit trail',
        icon: PhosphorIcons.truck(),
        endpoint: '/dispatch/auditor/deliveries',
        columns: const [
          'dispatch_number',
          'branch_name',
          'driver_name',
          'status',
          'created_at'
        ],
        actions: [
          _viewAction,
          _investigateAction,
          _deliveryAction('Approve', 'approve', AppColors.kSuccess),
          _deliveryAction('Flag', 'flag', AppColors.kWarning),
          _raiseExceptionAction(fallbackType: 'dispatch_note'),
        ],
      );
}

class AuditorKitchenLedgerSection extends StatelessWidget {
  const AuditorKitchenLedgerSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Kitchen Ledger',
        subtitle: 'Kitchen stock ledger and item movement audit',
        icon: PhosphorIcons.bookOpen(),
        endpoint: '/kitchen/stock/ledger',
        columns: const [
          'sku',
          'item_name',
          'movement_type',
          'quantity',
          'created_at'
        ],
        enableExport: true,
        actions: [
          _viewAction,
          _investigateAction,
          _flagAction(fallbackType: 'stock_movement'),
          _raiseExceptionAction(fallbackType: 'stock_movement'),
        ],
      );
}

class AuditorPayrollApprovalsSection extends StatelessWidget {
  const AuditorPayrollApprovalsSection({super.key});
  @override
  Widget build(BuildContext context) => const _AuditorPayrollWorkspace();
}

class _AuditorPayrollWorkspace extends ConsumerStatefulWidget {
  const _AuditorPayrollWorkspace();

  @override
  ConsumerState<_AuditorPayrollWorkspace> createState() =>
      _AuditorPayrollWorkspaceState();
}

class _AuditorPayrollWorkspaceState
    extends ConsumerState<_AuditorPayrollWorkspace> {
  late int _month;
  late int _year;
  late Future<_PayrollAuditData> _future;
  bool _busy = false;

  static const _months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _month = now.month;
    _year = now.year;
    _future = _load();
  }

  Future<_PayrollAuditData> _load() async {
    final repo = ref.read(auditorRepositoryProvider);
    final results = await Future.wait([
      repo.getRaw('/payroll/draft',
          queryParameters: {'month': _month, 'year': _year}),
      repo.getRaw('/staff/simple-payroll/pending-approvals'),
    ]);
    final draft = _payloadMap(results[0]);
    return _PayrollAuditData(
      draft: draft,
      approvals: _approvalRows(
        _payloadMap(results[1]),
        payrollRecords: _list(draft['records']),
      ),
    );
  }

  void _refresh() {
    setState(() {
      _future = _load();
    });
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<String?>(adminSelectedBranchProvider, (_, __) => _refresh());
    return Column(children: [
      _sectionHeader(),
      Expanded(
        child: FutureBuilder<_PayrollAuditData>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) {
              return const Center(child: CircularProgressIndicator());
            }
            if (snapshot.hasError) {
              return Center(
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Text('Failed to load payroll approvals',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Text(apiErrorMessage(snapshot.error ?? 'Unknown error'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: AppColors.kTextSecondary)),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                      onPressed: _refresh,
                      icon: const Icon(Icons.refresh),
                      label: const Text('Retry')),
                ]),
              );
            }
            return _body(snapshot.data ?? const _PayrollAuditData());
          },
        ),
      ),
    ]);
  }

  Widget _sectionHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 20, 24, 16),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: AppColors.kDivider)),
      ),
      child: Row(children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.kPrimary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(PhosphorIcons.money(), color: AppColors.kPrimary),
        ),
        const SizedBox(width: 14),
        const Expanded(
          child:
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('FamousGate Hotels Payroll',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: AppColors.kTextPrimary)),
            Text('Universal Payroll Management System',
                style:
                    TextStyle(fontSize: 12, color: AppColors.kTextSecondary)),
          ]),
        ),
        IconButton(
            tooltip: 'Refresh',
            onPressed: _busy ? null : _refresh,
            icon: const Icon(Icons.refresh)),
        const SizedBox(width: 8),
        OutlinedButton.icon(
          onPressed: _busy ? null : _createException,
          icon: const Icon(Icons.report_problem_outlined, size: 16),
          label: const Text('Exception'),
        ),
      ]),
    );
  }

  Widget _body(_PayrollAuditData data) {
    final run = _map(data.draft['run'] ?? data.draft['summary']);
    final records = _list(data.draft['records']);
    final totals = _payrollTotals(records);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              SizedBox(
                width: 180,
                child: DropdownButtonFormField<int>(
                  isExpanded: true,
                  initialValue: _month,
                  decoration: const InputDecoration(labelText: 'Month'),
                  items: [
                    for (var i = 0; i < _months.length; i++)
                      DropdownMenuItem(value: i + 1, child: Text(_months[i])),
                  ],
                  onChanged: _busy
                      ? null
                      : (value) {
                          if (value == null) return;
                          setState(() {
                            _month = value;
                            _future = _load();
                          });
                        },
                ),
              ),
              SizedBox(
                width: 120,
                child: DropdownButtonFormField<int>(
                  isExpanded: true,
                  initialValue: _year,
                  decoration: const InputDecoration(labelText: 'Year'),
                  items: [
                    for (var year = DateTime.now().year - 2;
                        year <= DateTime.now().year + 1;
                        year++)
                      DropdownMenuItem(value: year, child: Text('$year')),
                  ],
                  onChanged: _busy
                      ? null
                      : (value) {
                          if (value == null) return;
                          setState(() {
                            _year = value;
                            _future = _load();
                          });
                        },
                ),
              ),
              const _AuditorBranchScopeChip(),
              ElevatedButton.icon(
                onPressed: _busy ? null : _generatePayroll,
                icon: const Icon(Icons.calculate, size: 16),
                label: const Text('Generate Draft'),
              ),
              if ('${run['status'] ?? 'draft'}' == 'draft')
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _approvePayroll(run),
                  icon: const Icon(Icons.check_circle_outline, size: 16),
                  label: Text('Approve ${_months[_month - 1]} Payroll'),
                ),
              if ('${run['id'] ?? ''}'.isNotEmpty) ...[
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _downloadRun(run, 'summary'),
                  icon: const Icon(Icons.picture_as_pdf, size: 16),
                  label: const Text('Summary PDF'),
                ),
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _downloadRun(run, 'zip'),
                  icon: const Icon(Icons.archive, size: 16),
                  label: const Text('Download Payslips'),
                ),
              ],
              OutlinedButton.icon(
                onPressed:
                    _busy || data.approvals.isEmpty ? null : _approveAllPending,
                icon: const Icon(Icons.done_all, size: 16),
                label: const Text('Approve Pending Items'),
              ),
            ]),
        const SizedBox(height: 18),
        LayoutBuilder(builder: (context, constraints) {
          final width = constraints.maxWidth;
          final columns = width < 560 ? 1 : (width < 980 ? 2 : 4);
          final cardWidth = (width - ((columns - 1) * 12)) / columns;
          final cards = [
            _payrollCard('Gross Pay', _money(totals['gross']), Icons.payments,
                AppColors.kPrimary),
            _payrollCard('Deductions', _money(totals['deductions']),
                Icons.warning_amber, AppColors.kError),
            _payrollCard('Net Payable', _money(totals['net']),
                Icons.check_circle, AppColors.kSuccess),
            _payrollCard('Pending Items', '${data.approvals.length}',
                Icons.verified_user, AppColors.kWarning),
          ];

          return Wrap(
            spacing: 12,
            runSpacing: 12,
            children: cards
                .map((card) => SizedBox(
                      width: cardWidth,
                      height: 104,
                      child: card,
                    ))
                .toList(),
          );
        }),
        const SizedBox(height: 18),
        _pendingApprovalsTable(data.approvals),
        const SizedBox(height: 18),
        _payrollRecordsTable(records),
      ]),
    );
  }

  Widget _payrollCard(String title, String value, IconData icon, Color color) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 21,
                        fontWeight: FontWeight.w800,
                        color: color)),
                const SizedBox(height: 4),
                Text(title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.kTextSecondary)),
              ],
            ),
          ),
        ]),
      ),
    );
  }

  Widget _pendingApprovalsTable(List<Map<String, dynamic>> rows) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: Row(children: [
            const Expanded(
                child: Text('Pending Payroll Items',
                    style:
                        TextStyle(fontWeight: FontWeight.w800, fontSize: 14))),
            Text('${rows.length} records',
                style: const TextStyle(
                    fontSize: 12, color: AppColors.kTextSecondary)),
          ]),
        ),
        const Divider(height: 1),
        if (rows.isEmpty)
          const Padding(
            padding: EdgeInsets.all(28),
            child: Center(child: Text('No pending payroll approvals')),
          )
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
              columns: const [
                DataColumn(label: Text('Staff')),
                DataColumn(label: Text('Type')),
                DataColumn(label: Text('Amount')),
                DataColumn(label: Text('Status')),
                DataColumn(label: Text('Date')),
                DataColumn(label: Text('Actions')),
              ],
              rows: rows.map((row) {
                return DataRow(cells: [
                  DataCell(SizedBox(
                      width: 190,
                      child: Text(
                          '${row['staff_name'] ?? row['employee_name'] ?? '—'}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis))),
                  DataCell(Text('${row['type'] ?? '—'}')),
                  DataCell(Text(_money(row['amount']))),
                  DataCell(Text('${row['status'] ?? 'pending'}')),
                  DataCell(Text('${row['created_at'] ?? ''}'.split('T').first)),
                  DataCell(Row(mainAxisSize: MainAxisSize.min, children: [
                    TextButton(
                        onPressed: _busy ? null : () => _approveItem(row),
                        child: const Text('Approve')),
                    TextButton(
                        onPressed: _busy ? null : () => _rejectItem(row),
                        child: const Text('Reject')),
                  ])),
                ]);
              }).toList(),
            ),
          ),
      ]),
    );
  }

  Widget _payrollRecordsTable(List<Map<String, dynamic>> records) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: Text('Payroll Draft Records',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
        ),
        const Divider(height: 1),
        if (records.isEmpty)
          const Padding(
            padding: EdgeInsets.all(28),
            child: Center(child: Text('No payroll records found')),
          )
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
              columns: const [
                DataColumn(label: Text('Staff')),
                DataColumn(label: Text('Basic Salary')),
                DataColumn(label: Text('Additions')),
                DataColumn(label: Text('Deductions')),
                DataColumn(label: Text('SHIF/NSSF')),
                DataColumn(label: Text('Gross')),
                DataColumn(label: Text('Net')),
              ],
              rows: records.map((row) {
                final name = row['employee_name'] ??
                    row['staff_name'] ??
                    row['name'] ??
                    'Staff';
                return DataRow(cells: [
                  DataCell(SizedBox(width: 190, child: Text('$name'))),
                  DataCell(Text(_money(row['basic_salary']))),
                  DataCell(Text(_money(row['additions']))),
                  DataCell(Text(
                      _money(row['total_deductions'] ?? row['deductions']))),
                  DataCell(
                      Text('${_money(row['shif'])} / ${_money(row['nssf'])}')),
                  DataCell(Text(_money(row['gross_pay'] ??
                      row['gross_salary'] ??
                      row['gross']))),
                  DataCell(Text(_money(
                      row['net_pay'] ?? row['net_salary'] ?? row['net']))),
                ]);
              }).toList(),
            ),
          ),
      ]),
    );
  }

  Future<void> _generatePayroll() async {
    final branchId =
        await ref.read(auditorRepositoryProvider).getCurrentBranchId();
    await _runAction(
        () => ref.read(auditorRepositoryProvider).submitAction(
              'POST',
              '/payroll/generate',
              data: {
                'month': _month,
                'year': _year,
                if (branchId.isNotEmpty) 'branch_id': branchId,
              },
            ),
        'Payroll draft generated');
  }

  Future<void> _approvePayroll(Map<String, dynamic> run) async {
    final id = '${run['id'] ?? ''}';
    if (id.isEmpty) return;
    await _runAction(
        () => ref.read(auditorRepositoryProvider).submitAction(
              'POST',
              '/payroll/approve',
              data: {'run_id': id},
            ),
        'Payroll approved');
  }

  Future<void> _downloadRun(Map<String, dynamic> run, String type) async {
    final id = '${run['id'] ?? ''}';
    if (id.isEmpty) return;
    setState(() => _busy = true);
    try {
      final endpoint = type == 'summary'
          ? '/payroll/run/$id/summary-pdf'
          : '/payroll/run/$id/payslips-zip';
      final file = await ref.read(auditorRepositoryProvider).downloadReport(
            endpoint,
            type == 'summary'
                ? 'Payroll_Summary_${_months[_month - 1]}_$_year.pdf'
                : 'Payslips_${_months[_month - 1]}_$_year.zip',
          );
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text('Downloaded to ${file.path}')));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _approveItem(Map<String, dynamic> row) async {
    final type = _payrollType(row);
    await _runAction(
        () => ref.read(auditorRepositoryProvider).submitAction(
              'POST',
              '/staff/simple-payroll/$type/${_rowId(row)}/approve',
            ),
        'Payroll item approved');
  }

  Future<void> _rejectItem(Map<String, dynamic> row) async {
    final notes = await _showTextPrompt('Reject Payroll Item',
        required: true, hint: 'Enter rejection reason');
    if (notes == null) return;
    final type = _payrollType(row);
    await _runAction(
        () => ref.read(auditorRepositoryProvider).submitAction(
              'POST',
              '/staff/simple-payroll/$type/${_rowId(row)}/reject',
              data: {'reason': notes},
            ),
        'Payroll item rejected');
  }

  Future<void> _approveAllPending() async {
    final branchId =
        await ref.read(auditorRepositoryProvider).getCurrentBranchId();
    await _runAction(
        () => ref.read(auditorRepositoryProvider).submitAction(
              'POST',
              '/staff/simple-payroll/approve-batch',
              data: {
                'month': _month,
                'year': _year,
                if (branchId.isNotEmpty) 'branch_id': branchId,
              },
            ),
        'Pending payroll batch approved');
  }

  Future<void> _createException() async {
    final notes = await _showTextPrompt('Create Payroll Exception',
        required: true, hint: 'Describe the payroll exception');
    if (notes == null) return;
    final branchId =
        await ref.read(auditorRepositoryProvider).getCurrentBranchId();
    await _runAction(
      () => ref.read(auditorRepositoryProvider).submitAction(
        'POST',
        '/auditor/exceptions',
        data: {
          'exception_type': 'Payroll Approvals',
          'severity': 'medium',
          'description': notes,
          'reference_type': 'payroll',
          'reference_id': '$_year-${_month.toString().padLeft(2, '0')}',
          if (branchId.isNotEmpty) 'branch_id': branchId,
        },
      ),
      'Payroll exception created',
    );
  }

  Future<void> _runAction(
      Future<dynamic> Function() action, String message) async {
    setState(() => _busy = true);
    try {
      await action();
      _refresh();
      if (mounted) {
        AppNotifier.showSnackBar(context, SnackBar(content: Text(message)));
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(
              content: Text(apiErrorMessage(error)),
              backgroundColor: AppColors.kError),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<String?> _showTextPrompt(String title,
      {bool required = false, String? hint}) async {
    final controller = TextEditingController();
    final result = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          minLines: 3,
          maxLines: 5,
          decoration: InputDecoration(
              border: const OutlineInputBorder(),
              labelText: required ? 'Reason' : 'Notes',
              hintText: hint),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(context, controller.text.trim()),
              child: const Text('Submit')),
        ],
      ),
    );
    controller.dispose();
    if (required && (result == null || result.trim().isEmpty)) return null;
    return result;
  }
}

class _PayrollAuditData {
  const _PayrollAuditData({
    this.draft = const {},
    this.approvals = const [],
  });

  final Map<String, dynamic> draft;
  final List<Map<String, dynamic>> approvals;
}

Map<String, dynamic> _payloadMap(dynamic raw) {
  if (raw is Map && raw['success'] == true && raw['data'] != null) {
    final data = raw['data'];
    if (data is Map) return Map<String, dynamic>.from(data);
    return {'items': data};
  }
  if (raw is Map) return Map<String, dynamic>.from(raw);
  return {};
}

Map<String, dynamic> _map(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : <String, dynamic>{};

List<Map<String, dynamic>> _list(dynamic value) => value is List
    ? value.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
    : <Map<String, dynamic>>[];

List<Map<String, dynamic>> _approvalRows(
  Map<String, dynamic> payload, {
  List<Map<String, dynamic>> payrollRecords = const [],
}) {
  final staffNameById = <String, String>{};
  for (final record in payrollRecords) {
    final staffId = '${record['staff_id'] ?? ''}'.trim();
    final name = _firstText([
      record['employee_name'],
      record['staff_name'],
      record['name'],
    ]);
    if (staffId.isNotEmpty && name != null) staffNameById[staffId] = name;
  }

  final rows = <Map<String, dynamic>>[];
  for (final entry in const {
    'credit_bills': 'credit_bill',
    'advances': 'advance',
    'loans': 'loan',
  }.entries) {
    for (final row in _list(payload[entry.key])) {
      final staffId = '${row['staff_id'] ?? ''}'.trim();
      final staffName = _firstText([
        row['staff_name'],
        row['employee_name'],
        _nestedName(row['staff']),
        _nestedName(row['employee']),
        staffNameById[staffId],
      ]);
      rows.add(_normalizeRow({
        ...row,
        'type': row['type'] ?? entry.value,
        'amount': row['amount'] ?? row['total_amount'],
        if (staffName != null) 'staff_name': staffName,
        if (staffName != null) 'employee_name': staffName,
      }));
    }
  }
  rows.sort((a, b) =>
      '${b['created_at'] ?? ''}'.compareTo('${a['created_at'] ?? ''}'));
  return rows;
}

String? _firstText(List<dynamic> values) {
  for (final value in values) {
    final text = value == null ? '' : '$value'.trim();
    if (text.isNotEmpty && text != '—' && text != '-') return text;
  }
  return null;
}

Map<String, num> _payrollTotals(List<Map<String, dynamic>> records) {
  num read(Map<String, dynamic> row, List<String> keys) {
    for (final key in keys) {
      final value = row[key];
      final parsed = value is num ? value : num.tryParse('$value');
      if (parsed != null) return parsed;
    }
    return 0;
  }

  return {
    'gross': records.fold<num>(0,
        (sum, row) => sum + read(row, ['gross_pay', 'gross_salary', 'gross'])),
    'deductions': records.fold<num>(
        0, (sum, row) => sum + read(row, ['total_deductions', 'deductions'])),
    'net': records.fold<num>(
        0, (sum, row) => sum + read(row, ['net_pay', 'net_salary', 'net'])),
  };
}

String _money(dynamic value) {
  final amount = value is num ? value : num.tryParse('$value') ?? 0;
  return 'KES ${_wholeNumber(amount)}';
}

String _wholeNumber(num value) {
  final rounded = value.round().toString();
  return rounded.replaceAllMapped(
    RegExp(r'\B(?=(\d{3})+(?!\d))'),
    (_) => ',',
  );
}

class AuditorDiscrepanciesSection extends StatelessWidget {
  const AuditorDiscrepanciesSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Discrepancies',
        subtitle: 'Branch finance discrepancy flags raised for resolution',
        icon: PhosphorIcons.warning(),
        endpoint: '/auditor/exceptions',
        listKeys: const [
          'data',
          'exceptions',
          'discrepancies',
          'flags',
          'items'
        ],
        summaryKeys: const ['summary', 'stats'],
        columns: const [
          'exception_type',
          'severity',
          'detected_at',
          'description',
          'status',
        ],
        enableExport: true,
        searchPlaceholder: 'Search flag type, branch or description...',
        emptyTitle: 'No discrepancy flags',
        emptySubtitle: 'All branch finance flags are resolved',
        actions: [
          _viewAction,
          _investigateAction,
          _resolveExceptionAction(),
          _verifyAnomalyAction(fallbackType: 'exception'),
          _flagAction(fallbackType: 'exception'),
          _raiseExceptionAction(fallbackType: 'exception'),
        ],
      );
}

class AuditorVoidBillsSection extends StatelessWidget {
  const AuditorVoidBillsSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Void Bills',
        subtitle: 'Migrated and voided bills requiring auditor review',
        icon: PhosphorIcons.prohibit(),
        endpoint: '/auditor/void-bills',
        listKeys: const ['bills', 'void_bills', 'items'],
        columns: const [
          'branch_name',
          'bill_number',
          'original_amount',
          'status',
          'voided_at'
        ],
        actions: [
          _viewAction,
          _investigateAction,
          _AuditorRowAction(
            label: 'Reviewed',
            icon: Icons.verified_outlined,
            endpoint: '/auditor/void-bills/:id/review',
            method: 'PUT',
            color: AppColors.kSuccess,
            body: (_, notes) => {
              if (notes.isNotEmpty) 'auditor_notes': notes,
            },
            visible: _isPending,
          ),
          _flagAction(fallbackType: 'void_bill'),
          _raiseExceptionAction(fallbackType: 'void_bill'),
        ],
      );
}

class AuditorBusinessMpesaSection extends StatelessWidget {
  const AuditorBusinessMpesaSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Business & M-Pesa',
        subtitle: 'Banking transactions and M-Pesa reconciliation',
        icon: PhosphorIcons.phone(),
        endpoint: '/banking/transactions',
        listKeys: const ['transactions', 'payments', 'items'],
        columns: const [
          'branch_name',
          'transaction_date',
          'amount',
          'reference',
          'status'
        ],
        actions: [
          _viewAction,
          _investigateAction,
          _flagAction(fallbackType: 'banking_transaction'),
          _raiseExceptionAction(fallbackType: 'banking_transaction'),
        ],
      );
}

class AuditorCreditBillsSection extends StatelessWidget {
  const AuditorCreditBillsSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Credit Bills',
        subtitle: 'Credit bills, paid bills, loans and staff advances',
        icon: PhosphorIcons.creditCard(),
        endpoint: '/credit/pending/auditor',
        listKeys: const [
          'employee_bills',
          'guest_bills',
          'credit_bills',
          'bills'
        ],
        columns: const [
          'employee_name',
          'customer_name',
          'amount',
          'status',
          'created_at'
        ],
        actions: [
          _viewAction,
          _investigateAction,
          _creditBillStatusAction('Approve', 'approved', AppColors.kSuccess),
          _creditBillStatusAction('Reject', 'rejected', AppColors.kError),
          _flagAction(fallbackType: 'credit_bill'),
          _raiseExceptionAction(fallbackType: 'credit_bill'),
        ],
      );
}

class AuditorCashierLogbooksSection extends StatelessWidget {
  const AuditorCashierLogbooksSection({super.key});
  @override
  Widget build(BuildContext context) => _AuditorDataSection(
        title: 'Cashier Logbooks',
        subtitle: 'Submitted cashier logbooks pending audit action',
        icon: PhosphorIcons.notebook(),
        endpoint: '/cashier/logbook/pending',
        listKeys: const ['logbooks', 'logs', 'items'],
        columns: const [
          'branch_name',
          'cashier_name',
          'type',
          'status',
          'created_at'
        ],
        actions: [
          _viewAction,
          _investigateAction,
          _cashierLogbookAction('Approve', 'approve', AppColors.kSuccess),
          _cashierLogbookAction('Reject', 'reject', AppColors.kError),
          _flagAction(fallbackType: 'logbook'),
          _raiseExceptionAction(fallbackType: 'logbook'),
        ],
      );
}

class AuditorReportExportsSection extends ConsumerWidget {
  const AuditorReportExportsSection({super.key});

  static const _reports = [
    ('Exception Summary', 'exception_summary'),
    ('Compliance Audit', 'compliance_audit'),
    ('Void Analytics', 'void_analytics'),
    ('Revenue Reconciliation', 'revenue_reconciliation'),
    ('Leakage Report', 'leakage_report'),
    ('Expenditure Audit', 'expenditure_audit'),
    ('Variance Report', 'variance_report'),
    ('Consumption Audit', 'consumption_audit'),
    ('GRN Audit', 'grn_audit'),
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        _header('Audit Reports', PhosphorIcons.fileSpreadsheet(),
            subtitle: 'Export auditor reports from the reporting service'),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: LayoutBuilder(
              builder: (context, constraints) {
                final columns = constraints.maxWidth < 720 ? 1 : 3;
                return GridView.builder(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: columns,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: columns == 1 ? 5 : 3.2,
                  ),
                  itemCount: _reports.length,
                  itemBuilder: (context, index) {
                    final report = _reports[index];
                    return _ReportExportTile(
                      title: report.$1,
                      reportId: report.$2,
                    );
                  },
                );
              },
            ),
          ),
        ),
      ],
    );
  }
}

class _ReportExportTile extends ConsumerStatefulWidget {
  const _ReportExportTile({required this.title, required this.reportId});

  final String title;
  final String reportId;

  @override
  ConsumerState<_ReportExportTile> createState() => _ReportExportTileState();
}

class _ReportExportTileState extends ConsumerState<_ReportExportTile> {
  bool _loading = false;

  Future<void> _export() async {
    setState(() => _loading = true);
    try {
      final date = DateTime.now().toIso8601String().split('T').first;
      final file = await ref.read(auditorRepositoryProvider).downloadReport(
            '/reports/auditor/export/${widget.reportId}',
            '${widget.reportId}_$date.xlsx',
          );
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('${widget.title} saved to ${file.path}'),
              backgroundColor: AppColors.kSuccess,
            ));
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Export failed: $error'),
              backgroundColor: AppColors.kError,
            ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Icon(PhosphorIcons.filePdf(), color: AppColors.kPrimary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(widget.title,
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
            OutlinedButton.icon(
              onPressed: _loading ? null : _export,
              icon: _loading
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.download, size: 16),
              label: const Text('Export'),
            ),
          ],
        ),
      ),
    );
  }
}

class AuditorDetailScreen extends ConsumerStatefulWidget {
  const AuditorDetailScreen._({
    required String title,
    required String subtitle,
    required IconData icon,
    required String endpoint,
    required String recordId,
    required List<String> columns,
    Map<String, dynamic> queryParameters = const {},
    List<String> listKeys = const [],
    String? exportReportId,
    _AuditorDetailKind kind = _AuditorDetailKind.readOnly,
  })  : _title = title,
        _subtitle = subtitle,
        _icon = icon,
        _endpoint = endpoint,
        _recordId = recordId,
        _columns = columns,
        _queryParameters = queryParameters,
        _listKeys = listKeys,
        _exportReportId = exportReportId,
        _kind = kind;

  factory AuditorDetailScreen.delivery({required String id}) =>
      AuditorDetailScreen._(
        title: 'Delivery Audit Detail',
        subtitle: 'Dispatch documents, items and auditor review trail',
        icon: PhosphorIcons.truck(),
        endpoint: '/dispatch/auditor/deliveries/$id',
        recordId: id,
        listKeys: const [
          'dispatch_items',
          'items',
          'dispatch_documents',
          'auditor_reviews',
          'dispatch_audit_log'
        ],
        columns: const ['item_name', 'quantity', 'status', 'created_at'],
        kind: _AuditorDetailKind.delivery,
      );

  factory AuditorDetailScreen.branchFinancial({required String branchId}) =>
      AuditorDetailScreen._(
        title: 'Branch Financial Verification',
        subtitle: 'Daily payment reconciliation and cashier transaction ledger',
        icon: PhosphorIcons.currencyDollar(),
        endpoint: '/auditor/verify/finances',
        recordId: branchId,
        queryParameters: {
          'branch_id': branchId,
          'date': DateTime.now().toIso8601String().split('T').first,
        },
        listKeys: const [
          'cashiers',
          'recent_transactions',
          'payments',
          'records'
        ],
        columns: const [
          'cashier_name',
          'payment_method',
          'amount',
          'status',
          'created_at'
        ],
        exportReportId: 'revenue_reconciliation',
      );

  factory AuditorDetailScreen.transactionLog({
    required String logId,
    Map<String, String> queryParameters = const {},
  }) =>
      AuditorDetailScreen._(
        title: 'Transaction Log Detail',
        subtitle: 'Financial verification transaction trace and source record',
        icon: PhosphorIcons.receipt(),
        endpoint: '/auditor/verify/finances',
        recordId: logId,
        queryParameters: {
          ...queryParameters,
          'limit': 'all',
          'date': queryParameters['date'] ??
              DateTime.now().toIso8601String().split('T').first,
        },
        listKeys: const ['recent_transactions', 'payments', 'orders'],
        columns: const [
          'reference_number',
          'cashier_name',
          'payment_method',
          'amount',
          'status'
        ],
        kind: _AuditorDetailKind.anomaly,
      );

  factory AuditorDetailScreen.invoice({required String id}) =>
      AuditorDetailScreen._(
        title: 'Invoice Audit Detail',
        subtitle: 'Supplier invoice totals, line items and audit state',
        icon: PhosphorIcons.fileText(),
        endpoint: '/procurement/invoices/$id',
        recordId: id,
        listKeys: const ['items', 'invoice_items'],
        columns: const [
          'description',
          'quantity',
          'unit_price',
          'vat_amount',
          'total_amount'
        ],
        kind: _AuditorDetailKind.invoice,
      );

  factory AuditorDetailScreen.revenueDetail({
    required String id,
    Map<String, String> queryParameters = const {},
  }) =>
      AuditorDetailScreen._(
        title: 'Revenue Exception Detail',
        subtitle: 'Anomaly detail, linked exceptions and audit actions',
        icon: PhosphorIcons.trendUp(),
        endpoint: '/auditor/anomalies/$id',
        recordId: id,
        queryParameters: {
          ...queryParameters,
          if (!queryParameters.containsKey('type')) 'type': 'revenue',
        },
        listKeys: const ['linked_exceptions', 'items', 'payments'],
        columns: const ['type', 'amount', 'status', 'created_at'],
        kind: _AuditorDetailKind.anomaly,
      );

  factory AuditorDetailScreen.branchSales({
    required String branchId,
    Map<String, String> queryParameters = const {},
  }) {
    final today = DateTime.now().toIso8601String().split('T').first;
    return AuditorDetailScreen._(
      title: 'Branch Sales Audit',
      subtitle: 'Restaurant, bar, POS and payment records for one branch',
      icon: PhosphorIcons.shoppingCart(),
      endpoint: '/auditor/verify/sales',
      recordId: branchId,
      queryParameters: {
        ...queryParameters,
        'branch_id': branchId,
        'start_date': queryParameters['start_date'] ?? today,
        'end_date': queryParameters['end_date'] ?? today,
      },
      listKeys: const ['restaurant', 'bar', 'pos_transactions', 'payments'],
      columns: const [
        'order_number',
        'guest_name',
        'payment_method',
        'total_amount',
        'status'
      ],
      exportReportId: 'revenue_reconciliation',
    );
  }

  final String _title;
  final String _subtitle;
  final IconData _icon;
  final String _endpoint;
  final String _recordId;
  final Map<String, dynamic> _queryParameters;
  final List<String> _columns;
  final List<String> _listKeys;
  final String? _exportReportId;
  final _AuditorDetailKind _kind;

  @override
  ConsumerState<AuditorDetailScreen> createState() =>
      _AuditorDetailScreenState();
}

enum _AuditorDetailKind { readOnly, delivery, invoice, anomaly }

class _AuditorDetailScreenState extends ConsumerState<AuditorDetailScreen> {
  late Future<dynamic> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void didUpdateWidget(covariant AuditorDetailScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget._endpoint != widget._endpoint ||
        oldWidget._queryParameters != widget._queryParameters) {
      _future = _load();
    }
  }

  Future<dynamic> _load() {
    return ref
        .read(auditorRepositoryProvider)
        .getRaw(widget._endpoint, queryParameters: widget._queryParameters);
  }

  void _refresh() => setState(() {
        _future = _load();
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.kSurface,
      appBar: AppBar(
        title: Text(widget._title),
        leading: IconButton(
          tooltip: 'Back',
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            }
          },
          icon: const Icon(Icons.arrow_back),
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
          if (widget._exportReportId != null)
            IconButton(
              tooltip: 'Export',
              onPressed: _export,
              icon: const Icon(Icons.download),
            ),
        ],
      ),
      body: FutureBuilder<dynamic>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return _error(snapshot.error!);
          }
          return _body(snapshot.data);
        },
      ),
    );
  }

  Widget _error(Object error) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(PhosphorIcons.warning(), color: AppColors.kError, size: 36),
          const SizedBox(height: 12),
          Text('Failed to load ${widget._title}',
              style:
                  const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(apiErrorMessage(error),
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.kTextSecondary)),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: _refresh,
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Retry'),
          ),
        ]),
      ),
    );
  }

  Widget _body(dynamic raw) {
    final root = _unwrapDetail(raw);
    final rows = _rows(root);
    final summary = _summary(root);
    final selected = _selectedRecord(root, rows);
    return RefreshIndicator(
      onRefresh: () async => _refresh(),
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        child:
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _detailHeader(selected),
          if (summary.isNotEmpty) ...[
            const SizedBox(height: 16),
            _summaryCards(summary),
          ],
          if (selected.isNotEmpty) ...[
            const SizedBox(height: 16),
            _detailBlock('Selected Record', selected),
          ],
          const SizedBox(height: 16),
          _recordsTable(rows),
        ]),
      ),
    );
  }

  Widget _detailHeader(Map<String, dynamic> selected) {
    final status =
        selected['status'] ?? selected['auditor_status'] ?? selected['state'];
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              color: AppColors.kPrimary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(widget._icon, color: AppColors.kPrimary),
          ),
          const SizedBox(width: 14),
          Expanded(
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(widget._title,
                  style: const TextStyle(
                      fontSize: 20, fontWeight: FontWeight.w800)),
              const SizedBox(height: 4),
              Text(widget._subtitle,
                  style: const TextStyle(color: AppColors.kTextSecondary)),
              const SizedBox(height: 8),
              Text('Reference: ${widget._recordId}',
                  style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 12,
                      color: AppColors.kTextSecondary)),
            ]),
          ),
          if (status != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: _statusColor(status).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('$status'.toUpperCase(),
                  style: TextStyle(
                      color: _statusColor(status),
                      fontWeight: FontWeight.w800,
                      fontSize: 11)),
            ),
          const SizedBox(width: 12),
          _actions(),
        ]),
      ),
    );
  }

  Widget _actions() {
    return Wrap(
        spacing: 8,
        runSpacing: 8,
        children: switch (widget._kind) {
          _AuditorDetailKind.delivery => [
              OutlinedButton.icon(
                  onPressed: () => _submitDelivery('approve'),
                  icon: const Icon(Icons.check_circle_outline, size: 16),
                  label: const Text('Approve')),
              OutlinedButton.icon(
                  onPressed: () => _submitDelivery('flag'),
                  icon: const Icon(Icons.flag_outlined, size: 16),
                  label: const Text('Flag')),
            ],
          _AuditorDetailKind.invoice => [
              OutlinedButton.icon(
                  onPressed: () => _submitInvoice('approve'),
                  icon: const Icon(Icons.check_circle_outline, size: 16),
                  label: const Text('Approve')),
              OutlinedButton.icon(
                  onPressed: () => _submitInvoice('reject'),
                  icon: const Icon(Icons.cancel_outlined, size: 16),
                  label: const Text('Reject')),
            ],
          _AuditorDetailKind.anomaly => [
              OutlinedButton.icon(
                  onPressed: _verifyAnomaly,
                  icon: const Icon(Icons.verified_outlined, size: 16),
                  label: const Text('Verify')),
              OutlinedButton.icon(
                  onPressed: _flagAnomaly,
                  icon: const Icon(Icons.report_problem_outlined, size: 16),
                  label: const Text('Flag')),
            ],
          _AuditorDetailKind.readOnly => const <Widget>[],
        });
  }

  Widget _summaryCards(Map<String, dynamic> summary) {
    final entries = summary.entries
        .where((entry) => _isRenderableSummaryValue(entry.value))
        .take(4)
        .toList();
    if (entries.isEmpty) return const SizedBox.shrink();
    return LayoutBuilder(builder: (context, constraints) {
      final compact = constraints.maxWidth < 720;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [
          for (final entry in entries)
            SizedBox(
              width: compact
                  ? constraints.maxWidth
                  : (constraints.maxWidth - 36) / 4,
              child: Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(
                      color: AppColors.kDivider.withValues(alpha: 0.5)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_label(entry.key),
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.kTextSecondary)),
                        const SizedBox(height: 6),
                        Text(_format(entry.value),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 20, fontWeight: FontWeight.w800)),
                      ]),
                ),
              ),
            ),
        ],
      );
    });
  }

  Widget _recordsTable(List<Map<String, dynamic>> rows) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
          child: Row(children: [
            const Expanded(
                child: Text('Related Records',
                    style:
                        TextStyle(fontWeight: FontWeight.w800, fontSize: 14))),
            Text('${rows.length} records',
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 12)),
          ]),
        ),
        const Divider(height: 1),
        if (rows.isEmpty)
          const Padding(
            padding: EdgeInsets.all(28),
            child: Center(
                child: Text('No related records found',
                    style: TextStyle(color: AppColors.kTextSecondary))),
          )
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowColor: WidgetStateProperty.all(AppColors.kSurface),
              columns: widget._columns
                  .map((column) => DataColumn(
                      label: Text(_label(column),
                          style: const TextStyle(
                              fontSize: 12, fontWeight: FontWeight.w800))))
                  .toList(),
              rows: rows
                  .map((row) => DataRow(
                        selected: _rowId(row) == widget._recordId,
                        cells: [
                          for (final column in widget._columns)
                            DataCell(SizedBox(
                              width: 150,
                              child: Text(_value(row, column),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(fontSize: 12)),
                            )),
                        ],
                      ))
                  .toList(),
            ),
          ),
      ]),
    );
  }

  dynamic _unwrapDetail(dynamic raw) {
    if (raw is Map && raw['success'] == true && raw.containsKey('data')) {
      return raw['data'];
    }
    return raw;
  }

  Map<String, dynamic> _summary(dynamic data) {
    if (data is! Map) return {};
    final map = Map<String, dynamic>.from(data);
    for (final key in ['summary', 'stats', 'totals', 'data']) {
      final value = map[key];
      if (value is Map) {
        return Map<String, dynamic>.from(value)
          ..removeWhere((_, value) => value is List || value is Map);
      }
    }
    return map..removeWhere((_, value) => value is List || value is Map);
  }

  List<Map<String, dynamic>> _rows(dynamic data) {
    if (data is List) return data.whereType<Map>().map(_mapRow).toList();
    if (data is! Map) return [];
    final rows = <Map<String, dynamic>>[];
    for (final key in widget._listKeys) {
      final value = data[key];
      if (value is List) {
        rows.addAll(value.whereType<Map>().map((row) {
          final mapped = _mapRow(row);
          mapped.putIfAbsent('_source', () => key);
          final type = _sourceType(key);
          if (type != null) mapped.putIfAbsent('type', () => type);
          return mapped;
        }));
      } else if (value is Map) {
        for (final nested in value.values) {
          if (nested is List) {
            rows.addAll(nested.whereType<Map>().map((row) {
              final mapped = _mapRow(row);
              mapped.putIfAbsent('_source', () => key);
              return mapped;
            }));
          }
        }
      }
    }
    if (rows.isNotEmpty) return rows;
    for (final value in data.values) {
      if (value is List) return value.whereType<Map>().map(_mapRow).toList();
    }
    return [];
  }

  Map<String, dynamic> _mapRow(Map<dynamic, dynamic> row) =>
      Map<String, dynamic>.from(row);

  Map<String, dynamic> _selectedRecord(
      dynamic root, List<Map<String, dynamic>> rows) {
    for (final row in rows) {
      if (_rowId(row) == widget._recordId) return row;
    }
    if (root is Map) return Map<String, dynamic>.from(root);
    return {};
  }

  String _value(Map<String, dynamic> row, String key) {
    final direct = row[key];
    if (direct != null && '$direct'.isNotEmpty) return _format(direct);
    final snake = key.replaceAll(' ', '_').toLowerCase();
    final value = row[snake];
    if (value != null && '$value'.isNotEmpty) return _format(value);
    final derived = _derivedValue(row, snake);
    if (derived != null && '$derived'.isNotEmpty) return _format(derived);
    return '—';
  }

  Color _statusColor(dynamic value) {
    final status = '$value'.toLowerCase();
    if (status.contains('approve') ||
        status.contains('verified') ||
        status.contains('audited') ||
        status.contains('complete')) {
      return AppColors.kSuccess;
    }
    if (status.contains('reject') ||
        status.contains('flag') ||
        status.contains('void') ||
        status.contains('cancel')) {
      return AppColors.kError;
    }
    return AppColors.kWarning;
  }

  Future<String?> _notes(String title, {bool required = false}) async {
    final controller = TextEditingController();
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Text(title),
        content: SizedBox(
          width: 420,
          child: TextField(
            controller: controller,
            minLines: 3,
            maxLines: 6,
            decoration: InputDecoration(
              labelText: required ? 'Reason / notes' : 'Notes',
              border: const OutlineInputBorder(),
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(context, controller.text),
              child: const Text('Submit')),
        ],
      ),
    );
    controller.dispose();
    if (required && (value == null || value.trim().isEmpty)) return null;
    return value?.trim() ?? '';
  }

  Future<void> _submitDelivery(String action) async {
    final notes = await _notes(
        action == 'flag' ? 'Flag Delivery' : 'Approve Delivery',
        required: action == 'flag');
    if (!mounted || notes == null) return;
    await _submit(
      'POST',
      '/dispatch/auditor/deliveries/${widget._recordId}/review',
      {'action': action, if (notes.isNotEmpty) 'notes': notes},
    );
  }

  Future<void> _submitInvoice(String action) async {
    final notes = await _notes(
        '${action[0].toUpperCase()}${action.substring(1)} Invoice',
        required: action == 'reject');
    if (!mounted || notes == null) return;
    await _submit(
      'PUT',
      '/procurement/invoices/${widget._recordId}/$action',
      {
        if (notes.isNotEmpty) 'notes': notes,
        if (notes.isNotEmpty) 'reason': notes
      },
    );
  }

  Future<void> _verifyAnomaly() async {
    final notes = await _notes('Verify Record');
    if (!mounted || notes == null) return;
    final entityType = '${widget._queryParameters['type'] ?? 'record'}';
    if (!_canVerifyAuditorEntity(entityType)) {
      AppNotifier.show(
        context,
        'This record type does not support direct verification. Flag it for review instead.',
        isError: true,
      );
      return;
    }
    await _submit('POST', '/auditor/verify/clear', {
      'id': widget._recordId,
      'type': _normalizeAuditEntityType(entityType),
      if (notes.isNotEmpty) 'notes': notes,
    });
  }

  Future<void> _flagAnomaly() async {
    final notes = await _notes('Flag Record', required: true);
    if (!mounted || notes == null) return;
    final entityType = '${widget._queryParameters['type'] ?? 'record'}';
    await _submit('POST', '/auditor/exceptions', {
      'exception_type': _normalizeAuditEntityType(entityType),
      'reference_type': _normalizeAuditEntityType(entityType),
      'reference_id': widget._recordId,
      'description': notes,
      'severity': 'medium',
      'status': 'open',
    });
  }

  Future<void> _submit(
      String method, String endpoint, Map<String, dynamic> data) async {
    try {
      await ref
          .read(auditorRepositoryProvider)
          .submitAction(method, endpoint, data: data);
      _refresh();
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            const SnackBar(
              content: Text('Audit action completed'),
              backgroundColor: AppColors.kSuccess,
            ));
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Action failed: $error'),
              backgroundColor: AppColors.kError,
            ));
      }
    }
  }

  Future<void> _export() async {
    final reportId = widget._exportReportId;
    if (reportId == null) return;
    try {
      final date = DateTime.now().toIso8601String().split('T').first;
      final file = await ref.read(auditorRepositoryProvider).downloadReport(
            '/reports/auditor/export/$reportId',
            '${reportId}_${widget._recordId}_$date.xlsx',
            queryParameters: widget._queryParameters,
          );
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Report saved to ${file.path}'),
              backgroundColor: AppColors.kSuccess,
            ));
      }
    } catch (error) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
              content: Text('Export failed: $error'),
              backgroundColor: AppColors.kError,
            ));
      }
    }
  }
}
