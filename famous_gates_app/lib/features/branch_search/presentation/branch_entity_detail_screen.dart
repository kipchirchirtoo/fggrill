import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/widgets/app_notifier.dart';
import '../data/branch_search_repository.dart';

/// Full-screen deep dive into a single branch record with edit / save / delete.
class BranchEntityDetailScreen extends ConsumerStatefulWidget {
  const BranchEntityDetailScreen({
    super.key,
    required this.type,
    required this.id,
    required this.label,
  });

  final String type;
  final String id;
  final String label;

  @override
  ConsumerState<BranchEntityDetailScreen> createState() => _BranchEntityDetailScreenState();
}

class _BranchEntityDetailScreenState extends ConsumerState<BranchEntityDetailScreen> {
  bool _loading = true;
  String? _error;
  EntityDetail? _detail;

  bool _editing = false;
  bool _saving = false;

  final Map<String, TextEditingController> _controllers = {};
  final Map<String, bool> _bools = {};

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final d = await ref.read(branchSearchRepositoryProvider).getDetail(widget.type, widget.id);
      if (!mounted) return;
      _seedControllers(d);
      setState(() {
        _detail = d;
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

  void _seedControllers(EntityDetail d) {
    for (final c in _controllers.values) {
      c.dispose();
    }
    _controllers.clear();
    _bools.clear();
    for (final field in d.editableFields) {
      final value = d.record[field];
      if (value is bool) {
        _bools[field] = value;
      } else {
        _controllers[field] = TextEditingController(text: value?.toString() ?? '');
      }
    }
  }

  Future<void> _save() async {
    final d = _detail;
    if (d == null) return;
    setState(() => _saving = true);
    try {
      final payload = <String, dynamic>{};
      for (final entry in _controllers.entries) {
        payload[entry.key] = entry.value.text.trim();
      }
      for (final entry in _bools.entries) {
        payload[entry.key] = entry.value;
      }
      await ref.read(branchSearchRepositoryProvider).update(widget.type, widget.id, payload);
      if (!mounted) return;
      AppNotifier.showSnackBar(context, const SnackBar(content: Text('Saved')));
      setState(() => _editing = false);
      await _load();
    } catch (e) {
      if (!mounted) return;
      AppNotifier.showSnackBar(context, SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete record?'),
        content: Text('This permanently deletes this ${widget.label.toLowerCase()}. This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      await ref.read(branchSearchRepositoryProvider).delete(widget.type, widget.id);
      if (!mounted) return;
      AppNotifier.showSnackBar(context, const SnackBar(content: Text('Deleted')));
      Navigator.of(context).pop(true);
    } catch (e) {
      if (!mounted) return;
      AppNotifier.showSnackBar(context, SnackBar(content: Text(e.toString())));
    }
  }

  Future<void> _quickStatus(String statusField, String value) async {
    setState(() => _saving = true);
    try {
      await ref.read(branchSearchRepositoryProvider).update(widget.type, widget.id, {statusField: value});
      if (!mounted) return;
      AppNotifier.showSnackBar(context, SnackBar(content: Text('Status → $value')));
      await _load();
    } catch (e) {
      if (!mounted) return;
      AppNotifier.showSnackBar(context, SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = _detail;
    return Scaffold(
      appBar: AppBar(
        title: Text(d?.title.isNotEmpty == true ? d!.title : widget.label),
        actions: [
          if (d != null && !_editing && d.editableFields.isNotEmpty)
            IconButton(
              tooltip: 'Edit',
              icon: const Icon(Icons.edit),
              onPressed: () => setState(() => _editing = true),
            ),
          if (d != null && d.deletable)
            IconButton(
              tooltip: 'Delete',
              icon: const Icon(Icons.delete_outline),
              onPressed: _delete,
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? _errorView()
              : _content(d!),
      bottomNavigationBar: (d != null && _editing)
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _saving
                          ? null
                          : () {
                              _seedControllers(d);
                              setState(() => _editing = false);
                            },
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _saving ? null : _save,
                      child: _saving
                          ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Text('Save changes'),
                    ),
                  ),
                ]),
              ),
            )
          : null,
    );
  }

  Widget _errorView() => Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 40),
          const SizedBox(height: 8),
          Text(_error!, textAlign: TextAlign.center),
          const SizedBox(height: 8),
          FilledButton(onPressed: _load, child: const Text('Retry')),
        ]),
      );

  Widget _content(EntityDetail d) {
    final keys = d.record.keys.toList()
      ..sort((a, b) {
        final ae = d.editableFields.contains(a);
        final be = d.editableFields.contains(b);
        if (ae != be) return ae ? -1 : 1; // editable first
        return a.compareTo(b);
      });

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        _headerCard(d),
        const SizedBox(height: 8),
        if (_editing && d.statusField != null && d.editableFields.contains(d.statusField))
          _quickStatusRow(d.statusField!),
        for (final k in keys) _fieldRow(d, k),
      ],
    );
  }

  Widget _headerCard(EntityDetail d) {
    return Card(
      color: Theme.of(context).colorScheme.primaryContainer.withValues(alpha: 0.4),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(d.label, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            Text(d.group, style: TextStyle(color: Colors.grey[700], fontSize: 12)),
            if (d.editableFields.isEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Row(children: [
                  const Icon(Icons.lock_outline, size: 14, color: Colors.grey),
                  const SizedBox(width: 4),
                  Text('Read-only record', style: TextStyle(color: Colors.grey[700], fontSize: 12)),
                ]),
              ),
          ],
        ),
      ),
    );
  }

  Widget _quickStatusRow(String statusField) {
    const options = ['pending', 'approved', 'rejected', 'paid', 'cancelled', 'completed'];
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Wrap(
        spacing: 6,
        children: [
          const Padding(
            padding: EdgeInsets.only(right: 4, top: 6),
            child: Text('Quick set:', style: TextStyle(fontSize: 12, color: Colors.grey)),
          ),
          ...options.map((o) => ActionChip(
                label: Text(o),
                onPressed: _saving ? null : () => _quickStatus(statusField, o),
              )),
        ],
      ),
    );
  }

  Widget _fieldRow(EntityDetail d, String key) {
    final editable = _editing && d.editableFields.contains(key);
    final label = _humanize(key);

    if (_bools.containsKey(key)) {
      return SwitchListTile(
        title: Text(label),
        value: _bools[key]!,
        onChanged: editable ? (v) => setState(() => _bools[key] = v) : null,
        contentPadding: EdgeInsets.zero,
      );
    }

    if (editable && _controllers.containsKey(key)) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: TextField(
          controller: _controllers[key],
          decoration: InputDecoration(
            labelText: label,
            border: const OutlineInputBorder(),
            isDense: true,
          ),
        ),
      );
    }

    final value = d.record[key];
    final display = value == null || value.toString().isEmpty ? '—' : value.toString();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(fontSize: 11, color: Colors.grey[600])),
          const SizedBox(height: 2),
          SelectableText(display, style: const TextStyle(fontSize: 14)),
          const Divider(height: 12),
        ],
      ),
    );
  }

  String _humanize(String key) {
    return key
        .split('_')
        .where((w) => w.isNotEmpty)
        .map((w) => w[0].toUpperCase() + w.substring(1))
        .join(' ');
  }
}
