import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../../../core/services/services.dart';
import '../../domain/superadmin_providers.dart';

class GlobalUsersSection extends ConsumerStatefulWidget {
  const GlobalUsersSection({super.key});

  @override
  ConsumerState<GlobalUsersSection> createState() => _GlobalUsersSectionState();
}

class _GlobalUsersSectionState extends ConsumerState<GlobalUsersSection> {
  String _search = '';
  String _roleFilter = 'all';
  String _statusFilter = 'all';

  @override
  Widget build(BuildContext context) {
    final usersAsync = ref.watch(globalUsersProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 16),
          _buildFilters(),
          const SizedBox(height: 24),
          usersAsync.when(
            data: (data) => _buildUsersTable(data),
            loading: () => const LoadingSkeleton(height: 400),
            error: (e, _) => ErrorState(
                message: e.toString(),
                onRetry: () => ref.invalidate(globalUsersProvider)),
          ),
        ],
      ),
    );
  }

  Widget _buildFilters() {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        SizedBox(
          width: 280,
          child: TextField(
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              labelText: 'Search users',
            ),
            onChanged: (value) => setState(() => _search = value),
          ),
        ),
        SizedBox(
          width: 220,
          child: DropdownButtonFormField<String>(
            initialValue: _roleFilter,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Role'),
            items: const [
              DropdownMenuItem(
                  value: 'all',
                  child: Text('All roles', overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'super_admin',
                  child: Text('Super Admin', overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'general_manager',
                  child:
                      Text('General Manager', overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'branch_manager',
                  child:
                      Text('Branch Manager', overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'central_storekeeper',
                  child: Text('Central Storekeeper',
                      overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'auditor',
                  child: Text('Auditor', overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'receptionist',
                  child: Text('Receptionist', overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'cashier',
                  child: Text('Cashier', overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'restaurant_cashier',
                  child: Text('Restaurant Cashier',
                      overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'main_bar_cashier',
                  child: Text('Main Bar Cashier',
                      overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'executive_bar_cashier',
                  child: Text('Executive Bar Cashier',
                      overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'non_consumables_cashier',
                  child: Text('Non-consumables Cashier',
                      overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'housekeeping',
                  child: Text('Housekeeping', overflow: TextOverflow.ellipsis)),
              DropdownMenuItem(
                  value: 'maintenance',
                  child: Text('Maintenance', overflow: TextOverflow.ellipsis)),
            ],
            onChanged: (value) => setState(() => _roleFilter = value ?? 'all'),
          ),
        ),
        SizedBox(
          width: 180,
          child: DropdownButtonFormField<String>(
            initialValue: _statusFilter,
            decoration: const InputDecoration(labelText: 'Status'),
            items: const [
              DropdownMenuItem(value: 'all', child: Text('All statuses')),
              DropdownMenuItem(value: 'active', child: Text('Active')),
              DropdownMenuItem(value: 'inactive', child: Text('Inactive')),
              DropdownMenuItem(value: 'suspended', child: Text('Suspended')),
            ],
            onChanged: (value) =>
                setState(() => _statusFilter = value ?? 'all'),
          ),
        ),
      ],
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
              'Global User Management',
              style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  letterSpacing: -0.5),
            ),
            const SizedBox(height: 4),
            Text('Manage all users across all branches',
                style: TextStyle(fontSize: 14, color: Colors.grey.shade500)),
          ],
        ),
        ElevatedButton.icon(
          onPressed: () => _showUserDialog(),
          icon: Icon(PhosphorIcons.plus()),
          label: const Text('Add User'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.kPrimary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          ),
        ),
      ],
    );
  }

  Future<void> _showUserDialog({Map<String, dynamic>? user}) async {
    final branches = await _loadBranchesForDialog();
    final staffRows = user == null ? await _loadStaffForUserDialog() : <Map<String, dynamic>>[];
    if (!mounted) return;

    final firstNameCtrl =
        TextEditingController(text: user?['first_name'] as String? ?? '');
    final lastNameCtrl =
        TextEditingController(text: user?['last_name'] as String? ?? '');
    final emailCtrl =
        TextEditingController(text: user?['email'] as String? ?? '');
    final passwordCtrl = TextEditingController();
    final phoneCtrl =
        TextEditingController(text: user?['phone_number'] as String? ?? '');
    final employeeCtrl =
        TextEditingController(text: user?['employee_id'] as String? ?? '');
    final departmentCtrl =
        TextEditingController(text: user?['department'] as String? ?? '');
    final pinCtrl =
        TextEditingController(text: user?['pos_pin'] as String? ?? '');
    int? selectedBranch =
        int.tryParse('${user?['branch_id'] ?? user?['branchId'] ?? ''}');
    String selectedStatus = user?['status'] as String? ?? 'active';
    String selectedRole = user?['role'] as String? ?? 'receptionist';
    String? selectedStaffProfileId;
    final roles = [
      'super_admin',
      'general_manager',
      'director',
      'central_storekeeper',
      'auditor',
      'accountant',
      'branch_accountant',
      'hr_manager',
      'branch_manager',
      'branch_storekeeper',
      'storekeeper',
      'receptionist',
      'cashier',
      'restaurant_cashier',
      'main_bar_cashier',
      'executive_bar_cashier',
      'non_consumables_cashier',
      'restaurant',
      'pos_kitchen',
      'waiter',
      'waitress',
      'head_waiter',
      'bartender',
      'barman',
      'barmaid',
      'bar_manager',
      'kitchen',
      'kitchen_operations',
      'chef',
      'head_chef',
      'housekeeping',
      'housekeeping_supervisor',
      'maintenance',
      'procurement',
      'purchasing_manager',
      'kyogong_spa_cashier',
      'kyogong_executive_bar_cashier',
      'kyogong_sports_bar_cashier',
      'kyogong_reception_cashier',
      'employee'
    ];
    if (!roles.contains(selectedRole)) selectedRole = 'employee';
    const statuses = ['active', 'inactive', 'suspended'];
    if (!statuses.contains(selectedStatus)) selectedStatus = 'active';
    final branchRequiredRoles = {
      'branch_manager',
      'branch_accountant',
      'branch_storekeeper',
      'storekeeper',
      'housekeeping',
      'housekeeping_supervisor',
      'maintenance',
      'receptionist',
      'restaurant',
      'pos_kitchen',
      'waiter',
      'waitress',
      'head_waiter',
      'bartender',
      'barman',
      'barmaid',
      'bar_manager',
      'kitchen',
      'kitchen_operations',
      'chef',
      'head_chef',
      'cashier',
      'restaurant_cashier',
      'main_bar_cashier',
      'executive_bar_cashier',
      'non_consumables_cashier',
      'procurement',
      'purchasing_manager',
      'kyogong_spa_cashier',
      'kyogong_executive_bar_cashier',
      'kyogong_sports_bar_cashier',
      'kyogong_reception_cashier',
      'employee',
    };
    final branchIds = branches
        .map((branch) => int.tryParse('${branch['id']}'))
        .whereType<int>()
        .toSet();
    if (selectedBranch != null && !branchIds.contains(selectedBranch)) {
      selectedBranch = null;
    }

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: Text(user == null ? 'Add User' : 'Edit User'),
          content: SizedBox(
            width: 560,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (user == null) ...[
                    DropdownButtonFormField<String>(
                      initialValue: selectedStaffProfileId,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        labelText: 'Staff profile *',
                        helperText:
                            'Users are login accounts created from existing staff profiles.',
                      ),
                      items: staffRows.map((staff) {
                        return DropdownMenuItem<String>(
                          value: '${staff['id']}',
                          child: Text(
                            _staffLabel(staff),
                            overflow: TextOverflow.ellipsis,
                          ),
                        );
                      }).toList(),
                      onChanged: (value) {
                        final staff = staffRows.firstWhere(
                          (row) => '${row['id']}' == '$value',
                          orElse: () => const {},
                        );
                        setS(() {
                          selectedStaffProfileId = value;
                          firstNameCtrl.text = '${staff['first_name'] ?? ''}';
                          lastNameCtrl.text = '${staff['last_name'] ?? ''}';
                          emailCtrl.text = '${staff['email'] ?? ''}';
                          phoneCtrl.text =
                              '${staff['phone'] ?? staff['phone_number'] ?? ''}';
                          employeeCtrl.text =
                              '${staff['employee_number'] ?? staff['employee_id'] ?? ''}';
                          departmentCtrl.text = '${staff['department'] ?? ''}';
                          final staffRole = '${staff['role'] ?? ''}';
                          if (roles.contains(staffRole)) {
                            selectedRole = staffRole;
                          }
                          selectedBranch =
                              int.tryParse('${staff['branch_id'] ?? ''}');
                        });
                      },
                    ),
                    const SizedBox(height: 12),
                  ],
                  Row(children: [
                    Expanded(
                        child: TextField(
                            controller: firstNameCtrl,
                            decoration: const InputDecoration(
                                labelText: 'First Name'))),
                    const SizedBox(width: 12),
                    Expanded(
                        child: TextField(
                            controller: lastNameCtrl,
                            decoration:
                                const InputDecoration(labelText: 'Last Name'))),
                  ]),
                  const SizedBox(height: 12),
                  TextField(
                      controller: emailCtrl,
                      decoration: const InputDecoration(labelText: 'Email'),
                      keyboardType: TextInputType.emailAddress),
                  if (user == null) ...[
                    const SizedBox(height: 12),
                    TextField(
                        controller: passwordCtrl,
                        decoration:
                            const InputDecoration(labelText: 'Password'),
                        obscureText: true),
                  ],
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: selectedRole,
                    isExpanded: true,
                    decoration: const InputDecoration(labelText: 'Role'),
                    items: roles
                        .map((r) => DropdownMenuItem(
                            value: r,
                            child: Text(
                              r.replaceAll('_', ' ').toUpperCase(),
                              overflow: TextOverflow.ellipsis,
                            )))
                        .toList(),
                    onChanged: (v) => setS(() {
                      selectedRole = v ?? selectedRole;
                      if (!branchRequiredRoles.contains(selectedRole)) {
                        selectedBranch = null;
                      }
                    }),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int?>(
                    initialValue: selectedBranch,
                    decoration: InputDecoration(
                      labelText: branchRequiredRoles.contains(selectedRole)
                          ? 'Branch *'
                          : 'Branch',
                    ),
                    items: [
                      const DropdownMenuItem<int?>(
                          value: null, child: Text('Central / No branch')),
                      ...branches.map((branch) => DropdownMenuItem<int?>(
                            value: int.tryParse('${branch['id']}'),
                            child: Text(_branchLabel(branch)),
                          )),
                    ],
                    onChanged: branchRequiredRoles.contains(selectedRole)
                        ? (v) => setS(() => selectedBranch = v)
                        : null,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: selectedStatus,
                    decoration: const InputDecoration(labelText: 'Status'),
                    items: const [
                      DropdownMenuItem(value: 'active', child: Text('Active')),
                      DropdownMenuItem(
                          value: 'inactive', child: Text('Inactive')),
                      DropdownMenuItem(
                          value: 'suspended', child: Text('Suspended')),
                    ],
                    onChanged: (v) =>
                        setS(() => selectedStatus = v ?? selectedStatus),
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                        child: TextField(
                            controller: phoneCtrl,
                            decoration:
                                const InputDecoration(labelText: 'Phone'))),
                    const SizedBox(width: 12),
                    Expanded(
                        child: TextField(
                            controller: employeeCtrl,
                            decoration: const InputDecoration(
                                labelText: 'Employee ID'))),
                  ]),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                        child: TextField(
                            controller: departmentCtrl,
                            decoration: const InputDecoration(
                                labelText: 'Department'))),
                    const SizedBox(width: 12),
                    Expanded(
                        child: TextField(
                            controller: pinCtrl,
                            decoration: const InputDecoration(
                                labelText: 'POS PIN',
                                helperText:
                                    'R1234, M1234, E1234, N1234 or C1234'))),
                  ]),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                final email = emailCtrl.text.trim();
                if (!email.contains('@')) {
                  AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content: Text('Enter a valid email address'),
                          backgroundColor: AppColors.kError));
                  return;
                }
                if (user == null && selectedStaffProfileId == null) {
                  AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content: Text('Select the staff profile first'),
                          backgroundColor: AppColors.kError));
                  return;
                }
                if (firstNameCtrl.text.trim().length < 2 ||
                    lastNameCtrl.text.trim().length < 2) {
                  AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content: Text('First and last name are required'),
                          backgroundColor: AppColors.kError));
                  return;
                }
                if (user == null && passwordCtrl.text.length < 6) {
                  AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content:
                              Text('Password must be at least 6 characters'),
                          backgroundColor: AppColors.kError));
                  return;
                }
                if (branchRequiredRoles.contains(selectedRole) &&
                    selectedBranch == null) {
                  AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content: Text('This role requires a branch'),
                          backgroundColor: AppColors.kError));
                  return;
                }
                if (pinCtrl.text.isNotEmpty &&
                    !RegExp(r'^[RMENC]\d{4}$')
                        .hasMatch(pinCtrl.text.trim().toUpperCase())) {
                  AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                          content:
                              Text('POS PIN must start with R, M, E, N or C'),
                          backgroundColor: AppColors.kError));
                  return;
                }
                Navigator.pop(ctx);
                try {
                  final svc = ref.read(userServiceProvider);
                  final payload = {
                    'first_name': firstNameCtrl.text,
                    'last_name': lastNameCtrl.text,
                    'email': email,
                    'role': selectedRole,
                    'status': selectedStatus,
                    'branch_id': selectedBranch,
                    'phone_number': phoneCtrl.text.trim(),
                    'employee_id': employeeCtrl.text.trim(),
                    'department': departmentCtrl.text.trim(),
                    'pos_pin': pinCtrl.text.trim().isEmpty
                        ? null
                        : pinCtrl.text.trim().toUpperCase(),
                    if (user == null) 'password': passwordCtrl.text,
                    if (user == null)
                      'staff_profile_id': selectedStaffProfileId,
                  };
                  if (user == null) {
                    await svc.createUser(payload);
                  } else {
                    await svc.updateUser('${user['id']}', payload);
                  }
                  ref.invalidate(globalUsersProvider);
                  if (mounted) {
                    AppNotifier.showSnackBar(
                        context,
                        SnackBar(
                            content: Text(user == null
                                ? 'User created'
                                : 'User updated')));
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
              child: Text(user == null ? 'Create' : 'Save'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _resetPassword(Map<String, dynamic> user) async {
    final passwordCtrl = TextEditingController();
    final confirmCtrl = TextEditingController();
    var obscurePassword = true;
    var obscureConfirm = true;

    final newPassword = await showDialog<String>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: const Text('Reset Password'),
          content: SizedBox(
            width: 420,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Set a new password for ${user['first_name'] ?? ''} ${user['last_name'] ?? ''}.',
                  style: TextStyle(color: Colors.grey.shade700),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: passwordCtrl,
                  obscureText: obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'New password',
                    helperText: 'Minimum 6 characters',
                    suffixIcon: IconButton(
                      tooltip:
                          obscurePassword ? 'Show password' : 'Hide password',
                      icon: Icon(obscurePassword
                          ? PhosphorIcons.eye()
                          : PhosphorIcons.eyeSlash()),
                      onPressed: () =>
                          setS(() => obscurePassword = !obscurePassword),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: confirmCtrl,
                  obscureText: obscureConfirm,
                  decoration: InputDecoration(
                    labelText: 'Confirm password',
                    suffixIcon: IconButton(
                      tooltip: obscureConfirm
                          ? 'Show confirmation'
                          : 'Hide confirmation',
                      icon: Icon(obscureConfirm
                          ? PhosphorIcons.eye()
                          : PhosphorIcons.eyeSlash()),
                      onPressed: () =>
                          setS(() => obscureConfirm = !obscureConfirm),
                    ),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel')),
            ElevatedButton(
                onPressed: () {
                  final password = passwordCtrl.text;
                  final confirmation = confirmCtrl.text;
                  if (password.length < 6) {
                    AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                        content: Text('Password must be at least 6 characters'),
                        backgroundColor: AppColors.kError,
                      ),
                    );
                    return;
                  }
                  if (password != confirmation) {
                    AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                        content: Text('Passwords do not match'),
                        backgroundColor: AppColors.kError,
                      ),
                    );
                    return;
                  }
                  Navigator.pop(ctx, password);
                },
                child: const Text('Reset')),
          ],
        ),
      ),
    );

    passwordCtrl.dispose();
    confirmCtrl.dispose();

    if (newPassword == null || !mounted) return;
    try {
      await ref
          .read(userServiceProvider)
          .resetUserPassword('${user['id']}', newPassword);
      if (mounted) {
        AppNotifier.showSnackBar(context,
            const SnackBar(content: Text('Password reset successfully')));
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
                content: Text('Error: $e'), backgroundColor: AppColors.kError));
      }
    }
  }

  Widget _buildUsersTable(Map<String, dynamic> data) {
    final rawUsers = data['data'] as List<dynamic>? ?? [];
    final users = rawUsers.whereType<Map>().map((row) {
      return Map<String, dynamic>.from(row);
    }).where((user) {
      final haystack =
          '${user['first_name'] ?? ''} ${user['last_name'] ?? ''} ${user['email'] ?? ''} ${user['employee_id'] ?? ''}'
              .toLowerCase();
      final matchesSearch =
          _search.isEmpty || haystack.contains(_search.toLowerCase());
      final matchesRole =
          _roleFilter == 'all' || user['role']?.toString() == _roleFilter;
      final matchesStatus = _statusFilter == 'all' ||
          (user['status']?.toString() ?? 'inactive') == _statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    }).toList();

    if (users.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(48),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.grey.shade200),
        ),
        child: Column(
          children: [
            Icon(PhosphorIcons.users(), color: Colors.grey.shade400, size: 42),
            const SizedBox(height: 12),
            const Text('No users found',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
          ],
        ),
      );
    }

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columns: const [
            DataColumn(label: Text('User')),
            DataColumn(label: Text('Email')),
            DataColumn(label: Text('Role')),
            DataColumn(label: Text('Branch')),
            DataColumn(label: Text('Status')),
            DataColumn(label: Text('Last Login')),
            DataColumn(label: Text('Actions')),
          ],
          rows: users.map((user) {
            return DataRow(
              cells: [
                DataCell(
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 16,
                        backgroundColor:
                            AppColors.kPrimary.withValues(alpha: 0.1),
                        child: Text(
                          (user['first_name']?.toString() ?? '').isNotEmpty
                              ? user['first_name'].toString()[0].toUpperCase()
                              : '?',
                          style: const TextStyle(
                              color: AppColors.kPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 12),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(
                          '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}',
                          style: const TextStyle(fontWeight: FontWeight.w500)),
                    ],
                  ),
                ),
                DataCell(Text(user['email']?.toString() ?? 'N/A')),
                DataCell(
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _getRoleColor(user['role']?.toString() ?? '')
                          .withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      (user['role']?.toString() ?? 'Unknown')
                          .replaceAll('_', ' ')
                          .toUpperCase(),
                      style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: _getRoleColor(user['role']?.toString() ?? '')),
                    ),
                  ),
                ),
                DataCell(Text(user['branch_name']?.toString() ?? 'Central')),
                DataCell(
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: user['status']?.toString() == 'active'
                          ? const Color(0xFFd1fae5)
                          : const Color(0xFFfee2e2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      (user['status']?.toString() ?? 'inactive').toUpperCase(),
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: user['status']?.toString() == 'active'
                            ? const Color(0xFF059669)
                            : const Color(0xFFdc2626),
                      ),
                    ),
                  ),
                ),
                DataCell(Text(user['last_login_at']?.toString() ?? 'Never')),
                DataCell(
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: Icon(PhosphorIcons.pencilLine(), size: 18),
                        onPressed: () => _showUserDialog(user: user),
                        tooltip: 'Edit',
                      ),
                      IconButton(
                        icon: Icon(PhosphorIcons.lock(), size: 18),
                        onPressed: () => _resetPassword(user),
                        tooltip: 'Reset Password',
                      ),
                      IconButton(
                        icon: Icon(PhosphorIcons.trash(),
                            size: 18, color: AppColors.kError),
                        onPressed: () => _deleteUser(user),
                        tooltip: 'Delete',
                      ),
                    ],
                  ),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }

  Future<void> _deleteUser(Map<String, dynamic> user) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete User'),
        content: Text(
            'Delete ${user['first_name'] ?? ''} ${user['last_name'] ?? ''}? This matches the frontend delete confirmation flow.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style:
                  ElevatedButton.styleFrom(backgroundColor: AppColors.kError),
              child: const Text('Delete')),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    try {
      await ref.read(userServiceProvider).deleteUser('${user['id']}');
      ref.invalidate(globalUsersProvider);
      if (mounted) {
        AppNotifier.showSnackBar(
            context, const SnackBar(content: Text('User deleted')));
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
            context,
            SnackBar(
                content: Text('Error: $e'), backgroundColor: AppColors.kError));
      }
    }
  }

  Color _getRoleColor(String role) {
    switch (role.toLowerCase()) {
      case 'super_admin':
        return const Color(0xFF7c3aed);
      case 'general_manager':
        return const Color(0xFF2563eb);
      case 'branch_manager':
        return const Color(0xFF059669);
      case 'director':
        return const Color(0xFFdc2626);
      default:
        return Colors.grey;
    }
  }

  List<Map<String, dynamic>> _uniqueBranches(List<dynamic> rawBranches) {
    final byId = <int, Map<String, dynamic>>{};
    for (final row in rawBranches.whereType<Map>()) {
      final branch = Map<String, dynamic>.from(row);
      final id = int.tryParse('${branch['id']}');
      if (id == null) continue;
      branch['name'] = _branchLabel(branch);
      byId[id] = branch;
    }
    return byId.values.toList()
      ..sort((a, b) => '${a['name'] ?? ''}'.compareTo('${b['name'] ?? ''}'));
  }

  Future<List<Map<String, dynamic>>> _loadBranchesForDialog() async {
    try {
      final response = await ref.read(allBranchesProvider.future);
      final branches = _uniqueBranches(_extractBranchRows(response));
      if (branches.isNotEmpty) return branches;

      // Force a fresh request if the cached provider held an empty/loading value.
      ref.invalidate(allBranchesProvider);
      final refreshed = await ref.read(allBranchesProvider.future);
      return _uniqueBranches(_extractBranchRows(refreshed));
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(
            content: Text('Could not load branches: $e'),
            backgroundColor: AppColors.kError,
          ),
        );
      }
      return const [];
    }
  }

  Future<List<Map<String, dynamic>>> _loadStaffForUserDialog() async {
    try {
      final response = await ref
          .read(staffServiceProvider)
          .getStaff(status: 'active', limit: 500);
      final rows = _extractStaffRows(response)
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .where((staff) {
        final userId = '${staff['user_id'] ?? ''}'.trim();
        return userId.isEmpty || userId == 'null';
      }).toList();
      rows.sort((a, b) => _staffLabel(a).compareTo(_staffLabel(b)));
      return rows;
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(
            content: Text('Could not load staff profiles: $e'),
            backgroundColor: AppColors.kError,
          ),
        );
      }
      return const [];
    }
  }

  List<dynamic> _extractStaffRows(Map<String, dynamic> response) {
    final data = response['data'];
    if (data is List) return data;
    if (data is Map) {
      for (final key in const ['staff', 'employees', 'items', 'rows', 'data']) {
        final value = data[key];
        if (value is List) return value;
      }
    }
    return const [];
  }

  String _staffLabel(Map<String, dynamic> staff) {
    final first = '${staff['first_name'] ?? ''}'.trim();
    final last = '${staff['last_name'] ?? ''}'.trim();
    final name = '$first $last'.trim();
    final employeeNo =
        '${staff['employee_number'] ?? staff['employee_id'] ?? ''}'.trim();
    final role = '${staff['role'] ?? staff['position'] ?? ''}'.trim();
    final branchData = staff['branch'];
    final branchName =
        branchData is Map ? '${branchData['name'] ?? ''}'.trim() : '';
    final branch = '${staff['branch_name'] ?? branchName}'.trim();
    final parts = [
      if (employeeNo.isNotEmpty) employeeNo,
      if (role.isNotEmpty) role.replaceAll('_', ' '),
      if (branch.isNotEmpty) branch,
    ];
    return '${name.isEmpty ? 'Unnamed staff' : name}${parts.isEmpty ? '' : ' - ${parts.join(' / ')}'}';
  }

  List<dynamic> _extractBranchRows(Map<String, dynamic> response) {
    final data = response['data'];
    if (data is List) return data;
    if (data is Map) {
      for (final key in const ['branches', 'items', 'rows', 'data']) {
        final value = data[key];
        if (value is List) return value;
      }
    }
    final branches = response['branches'];
    return branches is List ? branches : const [];
  }

  String _branchLabel(Map<String, dynamic> branch) {
    final name = '${branch['name'] ?? branch['branch_name'] ?? ''}'.trim();
    if (name.isNotEmpty && name != 'null') return name;
    final code = '${branch['code'] ?? ''}'.trim();
    if (code.isNotEmpty && code != 'null') return code;
    return 'Branch ${branch['id']}';
  }
}
