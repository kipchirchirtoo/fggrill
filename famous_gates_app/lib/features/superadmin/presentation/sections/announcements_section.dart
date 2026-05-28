import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/superadmin_providers.dart';

class AnnouncementsSection extends ConsumerStatefulWidget {
  const AnnouncementsSection({super.key});

  @override
  ConsumerState<AnnouncementsSection> createState() =>
      _AnnouncementsSectionState();
}

class _AnnouncementsSectionState extends ConsumerState<AnnouncementsSection> {
  bool _showForm = false;

  // Form controllers
  final _titleCtrl = TextEditingController();
  final _bodyCtrl = TextEditingController();
  final _targetValueCtrl = TextEditingController();
  String _targetType = 'all';
  String _priority = 'normal';
  DateTime? _expiresAt;
  bool _submitting = false;

  @override
  void dispose() {
    _titleCtrl.dispose();
    _bodyCtrl.dispose();
    _targetValueCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final announcementsAsync = ref.watch(announcementsProvider);
    final isWide = MediaQuery.of(context).size.width >= 900;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 24),
          if (isWide)
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: announcementsAsync.when(
                    data: (items) => _buildList(items),
                    loading: () => const LoadingSkeleton(height: 100, count: 4),
                    error: (e, _) => ErrorState(
                      message: e.toString(),
                      onRetry: () => ref.invalidate(announcementsProvider),
                    ),
                  ),
                ),
                const SizedBox(width: 24),
                Expanded(
                  flex: 2,
                  child: _buildFormPanel(),
                ),
              ],
            )
          else
            Column(
              children: [
                announcementsAsync.when(
                  data: (items) => _buildList(items),
                  loading: () => const LoadingSkeleton(height: 100, count: 4),
                  error: (e, _) => ErrorState(
                    message: e.toString(),
                    onRetry: () => ref.invalidate(announcementsProvider),
                  ),
                ),
                const SizedBox(height: 24),
                _buildFormPanel(),
              ],
            ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(PhosphorIcons.megaphone(),
                  color: AppColors.kPrimary, size: 28),
              const SizedBox(width: 10),
              const Text(
                'Announcements & Broadcasts',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5,
                ),
              ),
            ]),
            const SizedBox(height: 4),
            Text(
              'Send system-wide announcements to users, roles, or branches',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
            ),
          ],
        ),
        if (MediaQuery.of(context).size.width < 900)
          FloatingActionButton.extended(
            onPressed: () => setState(() => _showForm = !_showForm),
            icon: Icon(PhosphorIcons.plus()),
            label: const Text('New Announcement'),
            backgroundColor: AppColors.kPrimary,
            foregroundColor: Colors.white,
          ),
      ],
    );
  }

  Widget _buildList(List<Map<String, dynamic>> items) {
    if (items.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(40),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(
          children: [
            Icon(PhosphorIcons.megaphone(),
                color: Colors.grey.shade400, size: 40),
            const SizedBox(height: 12),
            const Text('No announcements yet',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            Text('Use the form to broadcast a message.',
                style: TextStyle(color: Colors.grey.shade500)),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Past Announcements (${items.length})',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 12),
        ...items.map((item) => _buildAnnouncementCard(item)),
      ],
    );
  }

  Widget _buildAnnouncementCard(Map<String, dynamic> item) {
    final id = item['id']?.toString() ?? '';
    final title = item['title']?.toString() ?? 'Untitled';
    final target = item['target_type']?.toString() ?? 'all';
    final priority = item['priority']?.toString() ?? 'normal';
    final createdAt = item['created_at']?.toString() ?? '';

    final priorityColor = _priorityColor(priority);

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 50,
            margin: const EdgeInsets.only(right: 12),
            decoration: BoxDecoration(
              color: priorityColor,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Expanded(
                    child: Text(title,
                        style: const TextStyle(
                            fontWeight: FontWeight.w600, fontSize: 14),
                        overflow: TextOverflow.ellipsis),
                  ),
                  const SizedBox(width: 8),
                  _buildPriorityBadge(priority, priorityColor),
                  const SizedBox(width: 6),
                  _buildTargetBadge(target),
                ]),
                const SizedBox(height: 4),
                Text(
                  createdAt.isNotEmpty
                      ? _formatDate(createdAt)
                      : 'Unknown date',
                  style:
                      TextStyle(fontSize: 11, color: Colors.grey.shade500),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          IconButton(
            icon: Icon(PhosphorIcons.trash(),
                size: 17, color: AppColors.kError),
            tooltip: 'Delete',
            onPressed: () => _confirmDelete(id, title),
          ),
        ],
      ),
    );
  }

  Widget _buildPriorityBadge(String priority, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        priority.toUpperCase(),
        style: TextStyle(
            fontSize: 9, fontWeight: FontWeight.bold, color: color),
      ),
    );
  }

  Widget _buildTargetBadge(String target) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: AppColors.kPrimary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        target.toUpperCase(),
        style: const TextStyle(
            fontSize: 9,
            fontWeight: FontWeight.bold,
            color: AppColors.kPrimary),
      ),
    );
  }

  Widget _buildFormPanel() {
    if (MediaQuery.of(context).size.width < 900 && !_showForm) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.kPrimary.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Icon(PhosphorIcons.plus(), color: AppColors.kPrimary, size: 18),
            const SizedBox(width: 8),
            const Text('New Announcement',
                style:
                    TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ]),
          const SizedBox(height: 16),
          TextField(
            controller: _titleCtrl,
            decoration: const InputDecoration(labelText: 'Title *'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _bodyCtrl,
            minLines: 4,
            maxLines: 8,
            decoration: const InputDecoration(
              labelText: 'Message *',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _targetType,
            decoration: const InputDecoration(labelText: 'Target'),
            items: const [
              DropdownMenuItem(value: 'all', child: Text('All Users')),
              DropdownMenuItem(value: 'role', child: Text('By Role')),
              DropdownMenuItem(value: 'branch', child: Text('By Branch')),
              DropdownMenuItem(value: 'user', child: Text('Specific User')),
            ],
            onChanged: (v) => setState(() => _targetType = v ?? 'all'),
          ),
          if (_targetType != 'all') ...[
            const SizedBox(height: 12),
            TextField(
              controller: _targetValueCtrl,
              decoration: InputDecoration(
                labelText: _targetType == 'role'
                    ? 'Role name'
                    : _targetType == 'branch'
                        ? 'Branch ID or name'
                        : 'User ID',
              ),
            ),
          ],
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: _priority,
            decoration: const InputDecoration(labelText: 'Priority'),
            items: const [
              DropdownMenuItem(value: 'low', child: Text('Low')),
              DropdownMenuItem(value: 'normal', child: Text('Normal')),
              DropdownMenuItem(value: 'high', child: Text('High')),
              DropdownMenuItem(value: 'critical', child: Text('Critical')),
            ],
            onChanged: (v) => setState(() => _priority = v ?? 'normal'),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  _expiresAt == null
                      ? 'No expiry set'
                      : 'Expires: ${_formatDate(_expiresAt!.toIso8601String())}',
                  style: TextStyle(
                      color: Colors.grey.shade600, fontSize: 13),
                ),
              ),
              TextButton.icon(
                onPressed: _pickExpiryDate,
                icon: Icon(PhosphorIcons.calendar(), size: 14),
                label: const Text('Set Expiry'),
              ),
              if (_expiresAt != null)
                TextButton(
                  onPressed: () => setState(() => _expiresAt = null),
                  child: const Text('Clear'),
                ),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _submitting ? null : _submitAnnouncement,
              icon: _submitting
                  ? const SizedBox(
                      width: 14,
                      height: 14,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : Icon(PhosphorIcons.paperPlaneTilt(), size: 16),
              label:
                  Text(_submitting ? 'Sending...' : 'Send Announcement'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickExpiryDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: DateTime.now().add(const Duration(days: 7)),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (date != null) setState(() => _expiresAt = date);
  }

  Future<void> _submitAnnouncement() async {
    final title = _titleCtrl.text.trim();
    final body = _bodyCtrl.text.trim();
    if (title.isEmpty || body.isEmpty) {
      AppNotifier.show(context, 'Title and message are required.',
          isError: true);
      return;
    }
    setState(() => _submitting = true);
    try {
      await ref.read(superadminGodRepositoryProvider).createAnnouncement({
        'title': title,
        'body': body,
        'target_type': _targetType,
        if (_targetType != 'all' && _targetValueCtrl.text.trim().isNotEmpty)
          'target_value': _targetValueCtrl.text.trim(),
        'priority': _priority,
        if (_expiresAt != null) 'expires_at': _expiresAt!.toIso8601String(),
      });
      ref.invalidate(announcementsProvider);
      _titleCtrl.clear();
      _bodyCtrl.clear();
      _targetValueCtrl.clear();
      setState(() {
        _targetType = 'all';
        _priority = 'normal';
        _expiresAt = null;
        _showForm = false;
      });
      if (mounted) {
        AppNotifier.show(context, 'Announcement sent successfully.');
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Failed to send announcement: $e',
            isError: true);
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _confirmDelete(String id, String title) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Announcement'),
        content: Text('Delete "$title"? This cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style:
                ElevatedButton.styleFrom(backgroundColor: AppColors.kError),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    try {
      await ref
          .read(superadminGodRepositoryProvider)
          .deleteAnnouncement(id);
      ref.invalidate(announcementsProvider);
      if (mounted) {
        AppNotifier.show(context, 'Announcement deleted.');
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Failed to delete: $e', isError: true);
      }
    }
  }

  Color _priorityColor(String priority) {
    switch (priority.toLowerCase()) {
      case 'critical':
        return Colors.red;
      case 'high':
        return Colors.orange;
      case 'low':
        return Colors.grey;
      default:
        return Colors.blue;
    }
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
}
