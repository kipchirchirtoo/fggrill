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
    final nameCtrl =
        TextEditingController(text: branch?['name'] as String? ?? '');
    final codeCtrl =
        TextEditingController(text: branch?['code'] as String? ?? '');
    final cityCtrl =
        TextEditingController(text: branch?['city'] as String? ?? '');
    final addressCtrl =
        TextEditingController(text: branch?['address'] as String? ?? '');
    String status = branch?['status'] as String? ?? 'active';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: Text(branch == null ? 'Add Branch' : 'Edit Branch'),
          content: SizedBox(
            width: 400,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(children: [
                  Expanded(
                      child: TextField(
                          controller: nameCtrl,
                          decoration:
                              const InputDecoration(labelText: 'Branch Name'))),
                  const SizedBox(width: 12),
                  Expanded(
                      child: TextField(
                          controller: codeCtrl,
                          decoration: const InputDecoration(
                              labelText: 'Code (e.g. NRB-01)'))),
                ]),
                const SizedBox(height: 12),
                TextField(
                    controller: cityCtrl,
                    decoration: const InputDecoration(labelText: 'City')),
                const SizedBox(height: 12),
                TextField(
                    controller: addressCtrl,
                    decoration: const InputDecoration(labelText: 'Address'),
                    maxLines: 2),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: status,
                  decoration: const InputDecoration(labelText: 'Status'),
                  items: ['active', 'inactive', 'suspended']
                      .map((s) => DropdownMenuItem(
                          value: s, child: Text(s.toUpperCase())))
                      .toList(),
                  onChanged: (v) => setS(() => status = v ?? status),
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
                Navigator.pop(ctx);
                try {
                  final svc = ref.read(systemServiceProvider);
                  final payload = {
                    'name': nameCtrl.text,
                    'code': codeCtrl.text,
                    'city': cityCtrl.text,
                    'address': addressCtrl.text,
                    'status': status,
                  };
                  if (branch == null) {
                    await svc.createBranch(payload);
                  } else {
                    await svc.updateBranch(branch['id'] as int, payload);
                  }
                  ref.invalidate(allBranchesProvider);
                  if (mounted) {
                    AppNotifier.showSnackBar(
                        context,
                        SnackBar(
                            content: Text(branch == null
                                ? 'Branch created'
                                : 'Branch updated')));
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
              },
              child: Text(branch == null ? 'Create' : 'Save'),
            ),
          ],
        ),
      ),
    );
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
    final branches = data['data'] as List<dynamic>? ?? [];

    return Wrap(
      spacing: 24,
      runSpacing: 24,
      children: branches
          .map((b) => _buildBranchCard(b as Map<String, dynamic>))
          .toList(),
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
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showBranchStats(branch),
                  icon: Icon(PhosphorIcons.chartBar(), size: 18),
                  label: const Text('Analytics'),
                ),
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
