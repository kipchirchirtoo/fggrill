import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/widgets/safe_avatar.dart';
import '../../data/models/system_user.dart';
import '../../domain/admin_providers.dart';
import '../widgets/admin_table.dart';
import '../widgets/admin_dialogs.dart';
import 'package:famous_gates_app/features/admin/data/models/branch.dart';
import 'package:famous_gates_app/features/admin/data/admin_repository.dart';

class UsersSection extends ConsumerStatefulWidget {
  const UsersSection({super.key});

  @override
  ConsumerState<UsersSection> createState() => _UsersSectionState();
}

class _UsersSectionState extends ConsumerState<UsersSection> {
  final _searchController = TextEditingController();
  String? _selectedBranchId;
  String? _selectedRole;

  final _roles = [
    'All',
    'super_admin',
    'director',
    'general_manager',
    'branch_manager',
    'receptionist',
    'cashier',
    'housekeeper',
    'maintenance',
    'auditor',
    'hr_manager',
    'central_storekeeper',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final usersAsync = ref.watch(adminUsersProvider);
    final branchesAsync = ref.watch(adminBranchesProvider);
    final branches = branchesAsync.valueOrNull ?? [];

    return usersAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.table),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(adminUsersProvider),
      ),
      data: (users) {
        var filtered = List<AdminUser>.from(users);

        if (_searchController.text.isNotEmpty) {
          final q = _searchController.text.toLowerCase();
          filtered = filtered
              .where((u) =>
                  u.name.toLowerCase().contains(q) ||
                  u.email.toLowerCase().contains(q))
              .toList();
        }
        if (_selectedBranchId != null) {
          filtered =
              filtered.where((u) => u.branchId == _selectedBranchId).toList();
        }
        if (_selectedRole != null && _selectedRole != 'All') {
          filtered = filtered.where((u) => u.role == _selectedRole).toList();
        }

        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(adminUsersProvider),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'System Users',
                  style: Theme.of(context).textTheme.displaySmall,
                ),
                const SizedBox(height: 20),
                _buildFilterBar(branches),
                const SizedBox(height: 20),
                if (filtered.isEmpty)
                  EmptyState(
                      message: 'No users found', icon: PhosphorIcons.users())
                else
                  _buildUserTable(filtered),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildFilterBar(List<AdminBranch> branches) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            SizedBox(
              width: 220,
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: 'Search users...',
                  prefixIcon: Icon(PhosphorIcons.magnifyingGlass(), size: 20),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
            SizedBox(
              width: 180,
              child: DropdownButtonFormField<String>(
                initialValue: _selectedBranchId,
                decoration: const InputDecoration(
                  labelText: 'Branch',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: [
                  const DropdownMenuItem(
                      value: null, child: Text('All Branches')),
                  ...branches.map((b) =>
                      DropdownMenuItem(value: b.id, child: Text(b.name))),
                ],
                onChanged: (v) => setState(() => _selectedBranchId = v),
              ),
            ),
            SizedBox(
              width: 180,
              child: DropdownButtonFormField<String>(
                initialValue: _selectedRole,
                decoration: const InputDecoration(
                  labelText: 'Role',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                ),
                items: _roles
                    .map((r) => DropdownMenuItem(
                          value: r == 'All' ? null : r,
                          child: Text(r[0].toUpperCase() +
                              r.substring(1).replaceAll('_', ' ')),
                        ))
                    .toList(),
                onChanged: (v) => setState(() => _selectedRole = v),
              ),
            ),
            const SizedBox.shrink(),
            ElevatedButton.icon(
              onPressed: () => showUserDialog(context),
              icon: Icon(PhosphorIcons.plus(), size: 20),
              label: const Text('Add User'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUserTable(List<AdminUser> users) {
    return AdminTable(
      columns: const [
        'Name',
        'Email',
        'Role',
        'Branch',
        'Status',
        'Created',
        ''
      ],
      rows: users.map((u) {
        return [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              SafeAvatar(
                imageUrl: u.profilePhoto,
                name: u.name,
                radius: 14,
                backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                foregroundColor: AppColors.kPrimary,
              ),
              const SizedBox(width: 8),
              Text(u.name, style: const TextStyle(fontWeight: FontWeight.w500)),
            ],
          ),
          Text(u.email, style: const TextStyle(fontSize: 13)),
          Text(
              u.role[0].toUpperCase() +
                  u.role.substring(1).replaceAll('_', ' '),
              style: const TextStyle(fontSize: 13)),
          Text(u.branchName, style: const TextStyle(fontSize: 13)),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: u.isActive ? AppColors.kSuccess : AppColors.kError,
                ),
              ),
              const SizedBox(width: 6),
              Text(u.isActive ? 'Active' : 'Inactive',
                  style: const TextStyle(fontSize: 13)),
            ],
          ),
          Text(
            u.createdAt != null
                ? '${u.createdAt!.year}-${u.createdAt!.month.toString().padLeft(2, '0')}-${u.createdAt!.day.toString().padLeft(2, '0')}'
                : '-',
            style: const TextStyle(fontSize: 13),
          ),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                onPressed: () => showUserDialog(context, user: u),
                tooltip: 'Edit',
              ),
              IconButton(
                icon: Icon(PhosphorIcons.lock(), size: 18),
                onPressed: () => _resetPassword(u),
                tooltip: 'Reset Password',
              ),
              IconButton(
                icon: Icon(PhosphorIcons.prohibit(),
                    size: 18, color: AppColors.kError),
                onPressed: () => _confirmDelete(context, u),
                tooltip: 'Delete',
              ),
            ],
          ),
        ];
      }).toList(),
      hasActions: true,
    );
  }

  void _resetPassword(AdminUser user) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Reset Password'),
        content: Text('Send password reset link to ${user.email}?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(adminRepositoryProvider).resetUserPassword(user.id);
              AppNotifier.showSnackBar(
                context,
                SnackBar(
                    content: Text('Password reset link sent to ${user.email}')),
              );
            },
            child: const Text('Send Reset Link'),
          ),
        ],
      ),
    );
  }

  void _confirmDelete(BuildContext context, AdminUser user) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete User'),
        content: Text('Are you sure you want to delete "${user.name}"?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () {
              Navigator.pop(ctx);
              ref.read(adminRepositoryProvider).deleteUser(user.id);
              ref.invalidate(adminUsersProvider);
            },
            child:
                const Text('Delete', style: TextStyle(color: AppColors.kError)),
          ),
        ],
      ),
    );
  }
}
