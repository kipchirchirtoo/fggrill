import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../data/models/branch.dart';
import '../../domain/admin_providers.dart';
import '../widgets/admin_table.dart';
import '../widgets/admin_dialogs.dart';
import 'package:famous_gates_app/features/admin/data/admin_repository.dart';

class BranchesSection extends ConsumerStatefulWidget {
  const BranchesSection({super.key});

  @override
  ConsumerState<BranchesSection> createState() => _BranchesSectionState();
}

class _BranchesSectionState extends ConsumerState<BranchesSection> {
  final _searchController = TextEditingController();
  String? _selectedBranchId;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final branchesAsync = ref.watch(adminBranchesProvider);

    return branchesAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.table),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(adminBranchesProvider),
      ),
      data: (branches) {
        final filtered = _searchController.text.isEmpty
            ? branches
            : branches
                .where((b) =>
                    b.name
                        .toLowerCase()
                        .contains(_searchController.text.toLowerCase()) ||
                    b.code
                        .toLowerCase()
                        .contains(_searchController.text.toLowerCase()))
                .toList();

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(adminBranchesProvider),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Branches',
                  style: Theme.of(context).textTheme.displaySmall,
                ),
                const SizedBox(height: 20),
                _buildFilterRow(context),
                const SizedBox(height: 20),
                if (filtered.isEmpty)
                  EmptyState(
                      message: 'No branches found',
                      icon: PhosphorIcons.buildings())
                else
                  _buildBranchTable(filtered),
                const SizedBox(height: 20),
                if (_selectedBranchId != null)
                  _buildBranchDetail(
                    branches.firstWhere((b) => b.id == _selectedBranchId,
                        orElse: () => branches.first),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFilterRow(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search branches...',
              prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 20),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            ),
            onChanged: (_) => setState(() {}),
          ),
        ),
        const SizedBox(width: 16),
        ElevatedButton.icon(
          onPressed: () => showBranchDialog(context),
          icon: Icon(PhosphorIcons.plus(), size: 20),
          label: const Text('Add Branch'),
        ),
      ],
    );
  }

  Widget _buildBranchTable(List<AdminBranch> branches) {
    return AdminTable(
      columns: const [
        'Name',
        'Code',
        'Location',
        'Status',
        'Staff',
        'Rooms',
        ''
      ],
      rows: branches.map<List<Widget>>((b) {
        return [
          GestureDetector(
            onTap: () => setState(() {
              _selectedBranchId = _selectedBranchId == b.id ? null : b.id;
            }),
            child: Text(b.name,
                style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: AppColors.kPrimary,
                    decoration: TextDecoration.underline,
                    decorationColor: AppColors.kPrimary)),
          ),
          Text(b.code),
          Text('${b.city}, ${b.address}' ''),
          StatusBadge(status: b.status),
          Text('${b.staffCount}'),
          Text('${b.roomCount}'),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                onPressed: () => showBranchDialog(context, branch: b),
                tooltip: 'Edit',
              ),
              IconButton(
                icon: Icon(PhosphorIcons.prohibit(),
                    size: 18, color: AppColors.kError),
                onPressed: () => _confirmDelete(context, b),
                tooltip: 'Delete',
              ),
            ],
          ),
        ];
      }).toList(),
      hasActions: true,
    );
  }

  Widget _buildBranchDetail(AdminBranch branch) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(PhosphorIcons.buildings(), color: AppColors.kPrimary),
                const SizedBox(width: 8),
                Text(branch.name,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.w600)),
                const Spacer(),
                IconButton(
                  icon: Icon(PhosphorIcons.x(), size: 18),
                  onPressed: () => setState(() => _selectedBranchId = null),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Icon(PhosphorIcons.globe(),
                    size: 16, color: AppColors.kTextSecondary),
                const SizedBox(width: 6),
                Text('${branch.address}, ${branch.city}',
                    style: const TextStyle(color: AppColors.kTextSecondary)),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(PhosphorIcons.phone(),
                    size: 16, color: AppColors.kTextSecondary),
                const SizedBox(width: 6),
                Text(branch.phone,
                    style: const TextStyle(color: AppColors.kTextSecondary)),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                    child: _quickStat('Rooms', '${branch.roomCount}',
                        PhosphorIcons.building(), AppColors.kPrimary)),
                const SizedBox(width: 12),
                Expanded(
                    child: _quickStat('Staff', '${branch.staffCount}',
                        PhosphorIcons.users(), AppColors.kSuccess)),
                const SizedBox(width: 12),
                Expanded(
                    child: _quickStat(
                        'Revenue',
                        '\$${branch.monthlyRevenue.toStringAsFixed(0)}',
                        PhosphorIcons.trendUp(),
                        AppColors.kAccent)),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _quickStat(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 4),
          Text(value,
              style: TextStyle(fontWeight: FontWeight.bold, color: color)),
          Text(label,
              style: const TextStyle(
                  fontSize: 12, color: AppColors.kTextSecondary)),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context, AdminBranch branch) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Branch'),
        content: Text('Are you sure you want to delete "${branch.name}"?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(adminRepositoryProvider).deleteBranch(branch.id);
              ref.invalidate(adminBranchesProvider);
            },
            child:
                const Text('Delete', style: TextStyle(color: AppColors.kError)),
          ),
        ],
      ),
    );
  }
}
