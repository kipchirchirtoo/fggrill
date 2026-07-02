import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/services/services.dart';
import '../../domain/superadmin_providers.dart';

class BranchesSection extends ConsumerStatefulWidget {
  const BranchesSection({super.key});

  @override
  ConsumerState<BranchesSection> createState() => _BranchesSectionState();
}

class _BranchesSectionState extends ConsumerState<BranchesSection> {
  @override
  Widget build(BuildContext context) {
    final branchesAsync = ref.watch(allBranchesProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 24),
          branchesAsync.when(
            data: (data) => _buildBranchesGrid(data),
            loading: () => const LoadingSkeleton(height: 400, count: 3),
            error: (e, _) => ErrorState(
                message: e.toString(),
                onRetry: () => ref.invalidate(allBranchesProvider)),
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
            const Text(
              'Branch Management',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5),
            ),
            const SizedBox(height: 4),
            Text('Manage all hotel branches and their configurations',
                style: TextStyle(fontSize: 14, color: Colors.grey.shade500)),
          ],
        ),
        ElevatedButton.icon(
          onPressed: () => _showBranchDialog(),
          icon: Icon(PhosphorIcons.plus()),
          label: const Text('Add Branch'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.kPrimary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          ),
        ),
      ],
    );
  }

  void _showBranchDialog({Map<String, dynamic>? branch}) {
    showDialog(
      context: context,
      builder: (ctx) => _BranchDialog(
        branch: branch,
        onSave: (payload) async {
          final svc = ref.read(systemServiceProvider);
          if (branch == null) {
            await svc.createBranch(payload);
          } else {
            // Parse the id safely — the API may return it as int or String.
            final id = int.parse('${branch['id']}');
            await svc.updateBranch(id, payload);
          }
          ref.invalidate(allBranchesProvider);
          if (mounted) {
            AppNotifier.showSnackBar(
                context,
                SnackBar(
                    content: Text(
                        branch == null ? 'Branch created' : 'Branch updated')));
          }
        },
        onError: (e) {
          if (mounted) {
            AppNotifier.showSnackBar(
                context,
                SnackBar(
                    content: Text('Error: $e'),
                    backgroundColor: AppColors.kError));
          }
        },
      ),
    );
  }

  Future<void> _deleteBranch(Map<String, dynamic> branch) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Branch'),
        content: Text(
            'Are you sure you want to delete "${branch['name'] ?? 'this branch'}"? '
            'This action cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.kError),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      final id = int.parse('${branch['id']}');
      await ref.read(systemServiceProvider).deleteBranch(id);
      ref.invalidate(allBranchesProvider);
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('Branch deleted')));
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
                content: Text('Error: $e'),
                backgroundColor: AppColors.kError));
      }
    }
  }

  void _showBranchStats(Map<String, dynamic> branch) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('${branch['name']} — Analytics'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _statRow('Staff Count', '${branch['staff_count'] ?? 0}'),
            _statRow('Room Count', '${branch['room_count'] ?? 0}'),
            _statRow('Occupancy Rate', '${branch['occupancy_rate'] ?? 0}%'),
            _statRow('Status',
                (branch['status']?.toString() ?? 'unknown').toUpperCase()),
            _statRow('Code', branch['code']?.toString() ?? '—'),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Close'))
        ],
      ),
    );
  }

  Widget _statRow(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label,
                style: const TextStyle(
                    color: AppColors.kTextSecondary, fontSize: 13)),
            Text(value,
                style:
                    const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
          ],
        ),
      );

  Widget _buildBranchesGrid(Map<String, dynamic> data) {
    final branches = (data['data'] as List<dynamic>? ?? [])
        .whereType<Map>()
        .map((b) => Map<String, dynamic>.from(b))
        .toList();

    return Wrap(
      spacing: 24,
      runSpacing: 24,
      children: branches.map((b) => _buildBranchCard(b)).toList(),
    );
  }

  Widget _buildBranchCard(Map<String, dynamic> branch) {
    final isActive = branch['status']?.toString().toLowerCase() == 'active';

    return Container(
      width: 350,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.03),
              blurRadius: 20,
              offset: const Offset(0, 8))
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                    color: AppColors.kPrimary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12)),
                child: Icon(PhosphorIcons.buildings(),
                    color: AppColors.kPrimary, size: 24),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: isActive
                      ? const Color(0xFFd1fae5)
                      : const Color(0xFFfee2e2),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  (branch['status']?.toString() ?? 'inactive').toUpperCase(),
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: isActive
                          ? const Color(0xFF059669)
                          : const Color(0xFFdc2626)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Text(branch['name']?.toString() ?? 'Unknown Branch',
              style:
                  const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(branch['code']?.toString() ?? 'N/A',
              style: TextStyle(fontSize: 14, color: Colors.grey.shade500)),
          const SizedBox(height: 20),
          const Divider(),
          const SizedBox(height: 16),
          Row(
            children: [
              _buildStatItem(PhosphorIcons.users(),
                  '${branch['staff_count'] ?? 0}', 'Staff'),
              _buildStatItem(
                  PhosphorIcons.bed(), '${branch['room_count'] ?? 0}', 'Rooms'),
              _buildStatItem(
                  PhosphorIcons.chartLine(),
                  '${branch['occupancy_rate']?.toString() ?? '0'}%',
                  'Occupancy'),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showBranchDialog(branch: branch),
                  icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                  label: const Text('Settings'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showBranchStats(branch),
                  icon: Icon(PhosphorIcons.chartBar(), size: 18),
                  label: const Text('Analytics'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                tooltip: 'Delete branch',
                onPressed: () => _deleteBranch(branch),
                icon: Icon(PhosphorIcons.trash(),
                    size: 20, color: AppColors.kError),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(IconData icon, String value, String label) {
    return Expanded(
      child: Column(
        children: [
          Icon(icon, size: 20, color: Colors.grey.shade400),
          const SizedBox(height: 8),
          Text(value,
              style:
                  const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(label,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Dedicated StatefulWidget for the branch create/edit dialog so controllers
// are properly disposed via dispose().
// ---------------------------------------------------------------------------
class _BranchDialog extends StatefulWidget {
  const _BranchDialog({
    required this.onSave,
    required this.onError,
    this.branch,
  });

  final Map<String, dynamic>? branch;
  final Future<void> Function(Map<String, dynamic> payload) onSave;
  final void Function(Object error) onError;

  @override
  State<_BranchDialog> createState() => _BranchDialogState();
}

class _BranchDialogState extends State<_BranchDialog> {
  late final TextEditingController _nameCtrl;
  late final TextEditingController _codeCtrl;
  late final TextEditingController _cityCtrl;
  late final TextEditingController _addressCtrl;
  late String _status;
  late String _branchType;

  static const _branchTypes = [
    'hotel',
    'restaurant',
    'bar',
    'mixed',
    'spa',
    'other',
  ];

  @override
  void initState() {
    super.initState();
    final b = widget.branch;
    _nameCtrl = TextEditingController(text: b?['name'] as String? ?? '');
    _codeCtrl = TextEditingController(text: b?['code'] as String? ?? '');
    _cityCtrl = TextEditingController(text: b?['city'] as String? ?? '');
    _addressCtrl = TextEditingController(text: b?['address'] as String? ?? '');
    _status = b?['status'] as String? ?? 'active';
    final rawType =
        (b?['branch_type'] ?? b?['type'])?.toString() ?? 'hotel';
    _branchType = _branchTypes.contains(rawType) ? rawType : 'hotel';
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _codeCtrl.dispose();
    _cityCtrl.dispose();
    _addressCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StatefulBuilder(
      builder: (ctx, setS) => AlertDialog(
        title:
            Text(widget.branch == null ? 'Add Branch' : 'Edit Branch'),
        content: SizedBox(
          width: 400,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(children: [
                Expanded(
                    child: TextField(
                        controller: _nameCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Branch Name'))),
                const SizedBox(width: 12),
                Expanded(
                    child: TextField(
                        controller: _codeCtrl,
                        decoration: const InputDecoration(
                            labelText: 'Code (e.g. NRB-01)'))),
              ]),
              const SizedBox(height: 12),
              TextField(
                  controller: _cityCtrl,
                  decoration: const InputDecoration(labelText: 'City')),
              const SizedBox(height: 12),
              TextField(
                  controller: _addressCtrl,
                  decoration: const InputDecoration(labelText: 'Address'),
                  maxLines: 2),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _branchType,
                decoration: const InputDecoration(labelText: 'Branch Type'),
                items: _branchTypes
                    .map((t) => DropdownMenuItem(
                        value: t, child: Text(t.toUpperCase())))
                    .toList(),
                onChanged: (v) => setS(() => _branchType = v ?? _branchType),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _status,
                decoration: const InputDecoration(labelText: 'Status'),
                items: ['active', 'inactive', 'suspended']
                    .map((s) => DropdownMenuItem(
                        value: s, child: Text(s.toUpperCase())))
                    .toList(),
                onChanged: (v) => setS(() => _status = v ?? _status),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              // Bug fix 2: validate required fields before calling the API.
              final name = _nameCtrl.text.trim();
              final code = _codeCtrl.text.trim();
              if (name.isEmpty || code.isEmpty) {
                ScaffoldMessenger.of(ctx).showSnackBar(const SnackBar(
                    content:
                        Text('Branch Name and Code are required')));
                return;
              }
              Navigator.pop(ctx);
              try {
                await widget.onSave({
                  'name': name,
                  'code': code,
                  'city': _cityCtrl.text.trim(),
                  'address': _addressCtrl.text.trim(),
                  'branch_type': _branchType,
                  'status': _status,
                });
              } catch (e) {
                widget.onError(e);
              }
            },
            child: Text(widget.branch == null ? 'Create' : 'Save'),
          ),
        ],
      ),
    );
  }
}
