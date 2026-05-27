import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/api_error_message.dart';
import '../../../core/widgets/widgets.dart';

class CrudModuleScreen extends ConsumerStatefulWidget {
  const CrudModuleScreen({
    super.key,
    required this.title,
    required this.endpoint,
    this.createLabel,
    this.fields = const ['name', 'description'],
    this.createEnabled = true,
    this.updateEnabled = true,
    this.deleteEnabled = true,
  });

  final String title;
  final String endpoint;
  final String? createLabel;
  final List<String> fields;
  final bool createEnabled;
  final bool updateEnabled;
  final bool deleteEnabled;

  @override
  ConsumerState<CrudModuleScreen> createState() => _CrudModuleScreenState();
}

class _CrudModuleScreenState extends ConsumerState<CrudModuleScreen> {
  late Future<List<Map<String, dynamic>>> _future;

  Dio get _dio => ref.read(dioProvider);

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<Map<String, dynamic>>> _load() async {
    final response = await _dio.get(widget.endpoint);
    final data = response.data;
    final payload = data is List
        ? data
        : data is Map
            ? (data['data'] ??
                data['items'] ??
                data['rows'] ??
                data['results'] ??
                data)
            : [];
    final list = payload is List ? payload : <dynamic>[payload];
    return list
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return DashboardShell(
      title: widget.title,
      actions: [
        IconButton(
          tooltip: 'Refresh',
          onPressed: _refresh,
          icon: const Icon(Icons.refresh),
        ),
        if (widget.createEnabled)
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: ElevatedButton.icon(
              style: ElevatedButton.styleFrom(minimumSize: const Size(132, 40)),
              onPressed: () => _showForm(),
              icon: const Icon(Icons.add, size: 16),
              label: Text(widget.createLabel ?? 'New'),
            ),
          ),
      ],
      tabs: [
        DashboardTab(
          label: widget.title,
          content: FutureBuilder<List<Map<String, dynamic>>>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState == ConnectionState.waiting) {
                return const Padding(
                  padding: EdgeInsets.all(24),
                  child: LoadingSkeleton(type: SkeletonType.list),
                );
              }
              if (snapshot.hasError) {
                return ErrorState(
                    message: apiErrorMessage(snapshot.error!),
                    onRetry: _refresh);
              }
              final rows = snapshot.data ?? const <Map<String, dynamic>>[];
              return _ModuleList(
                title: widget.title,
                rows: rows,
                onEdit: widget.updateEnabled ? _showForm : null,
                onDelete: widget.deleteEnabled ? _delete : null,
              );
            },
          ),
        ),
      ],
    );
  }

  Future<void> _showForm([Map<String, dynamic>? row]) async {
    final controllers = {
      for (final field in widget.fields)
        field: TextEditingController(
            text: row == null ? '' : '${row[field] ?? ''}'),
    };
    final result = await showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(row == null
            ? (widget.createLabel ?? 'New ${widget.title}')
            : 'Edit ${widget.title}'),
        content: SizedBox(
          width: 440,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: controllers.entries
                  .map(
                    (entry) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: TextField(
                        controller: entry.value,
                        decoration:
                            InputDecoration(labelText: _label(entry.key)),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(minimumSize: const Size(96, 40)),
            onPressed: () => Navigator.pop(ctx, {
              for (final entry in controllers.entries)
                entry.key: entry.value.text.trim(),
            }),
            child: const Text('Save'),
          ),
        ],
      ),
    );
    for (final controller in controllers.values) {
      controller.dispose();
    }
    if (result == null) return;
    try {
      if (row == null) {
        await _dio.post(widget.endpoint, data: result);
      } else {
        await _dio.put('${widget.endpoint}/${row['id']}', data: result);
      }
      _refresh();
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Saved')));
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text(apiErrorMessage(e))));
      }
    }
  }

  Future<void> _delete(Map<String, dynamic> row) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete record?'),
        content: Text(
            'This will delete ${row['name'] ?? row['title'] ?? row['id'] ?? 'this record'}.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kError,
                minimumSize: const Size(96, 40)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await _dio.delete('${widget.endpoint}/${row['id']}');
      _refresh();
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Deleted')));
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context, SnackBar(content: Text(apiErrorMessage(e))));
      }
    }
  }

  String _label(String field) =>
      field.replaceAll('_', ' ').split(' ').map((part) {
        if (part.isEmpty) return part;
        return part[0].toUpperCase() + part.substring(1);
      }).join(' ');
}

class _ModuleList extends StatelessWidget {
  const _ModuleList({
    required this.title,
    required this.rows,
    this.onEdit,
    this.onDelete,
  });

  final String title;
  final List<Map<String, dynamic>> rows;
  final ValueChanged<Map<String, dynamic>>? onEdit;
  final ValueChanged<Map<String, dynamic>>? onDelete;

  @override
  Widget build(BuildContext context) {
    if (rows.isEmpty) {
      return EmptyState(message: 'No $title records found');
    }
    return ListView.separated(
      padding: const EdgeInsets.all(24),
      itemCount: rows.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (_, index) {
        final row = rows[index];
        return Card(
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
              child: const Icon(Icons.dataset_outlined,
                  color: AppColors.kPrimary, size: 18),
            ),
            title: Text(_primary(row)),
            subtitle: Text(_secondary(row),
                maxLines: 2, overflow: TextOverflow.ellipsis),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (onEdit != null)
                  IconButton(
                    tooltip: 'Edit',
                    icon: const Icon(Icons.edit_outlined, size: 18),
                    onPressed: () => onEdit!(row),
                  ),
                if (onDelete != null)
                  IconButton(
                    tooltip: 'Delete',
                    icon: const Icon(Icons.delete_outline,
                        size: 18, color: AppColors.kError),
                    onPressed: () => onDelete!(row),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _primary(Map<String, dynamic> row) {
    for (final key in const [
      'name',
      'title',
      'number',
      'reference',
      'booking_number',
      'po_number',
      'invoice_number',
      'id'
    ]) {
      final value = row[key];
      if (value != null && '$value'.isNotEmpty) return '$value';
    }
    return 'Record';
  }

  String _secondary(Map<String, dynamic> row) {
    final parts = <String>[];
    for (final key in const [
      'status',
      'description',
      'type',
      'category',
      'amount',
      'created_at',
      'date'
    ]) {
      final value = row[key];
      if (value != null && '$value'.isNotEmpty) {
        parts.add('${_label(key)}: $value');
      }
    }
    return parts.isEmpty
        ? 'Tap edit to manage this record'
        : parts.join('  •  ');
  }

  String _label(String key) => key.replaceAll('_', ' ');
}
