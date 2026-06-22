import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/mobile_shell.dart';
import '../../data/mobile_repository.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final _systemHealthProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(superAdminMobileRepositoryProvider).getSystemHealth();
});

final _systemStatsProvider =
    FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  return ref.read(superAdminMobileRepositoryProvider).getSystemStats();
});

final _superUsersProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(superAdminMobileRepositoryProvider).getUsers();
});

final _auditLogsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(superAdminMobileRepositoryProvider).getAuditLogs();
});

final _superBranchesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  return ref.read(superAdminMobileRepositoryProvider).getBranches();
});

// ---------------------------------------------------------------------------
// Root screen
// ---------------------------------------------------------------------------

class MobileSuperAdminScreen extends ConsumerWidget {
  const MobileSuperAdminScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MobileShell(
      title: 'Super Admin',
      backgroundColor: const Color(0xFFF0F4F8),
      tabs: const [
        MobileTab(
          label: 'System',
          icon: Icons.monitor_heart_outlined,
          activeIcon: Icons.monitor_heart,
          body: _SystemTab(),
        ),
        MobileTab(
          label: 'Users',
          icon: Icons.people_outline,
          activeIcon: Icons.people,
          body: _UsersTab(),
        ),
        MobileTab(
          label: 'Audit Logs',
          icon: Icons.history_edu,
          activeIcon: Icons.history_edu,
          body: _AuditLogsTab(),
        ),
        MobileTab(
          label: 'Branches',
          icon: Icons.business_outlined,
          activeIcon: Icons.business,
          body: _SuperBranchesTab(),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 1 — System Overview
// ---------------------------------------------------------------------------

class _SystemTab extends ConsumerWidget {
  const _SystemTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final healthAsync = ref.watch(_systemHealthProvider);
    final statsAsync = ref.watch(_systemStatsProvider);

    return MobileTabBody(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Health status
          healthAsync.when(
            loading: () => const _LoadingCard(message: 'Checking system…'),
            error: (e, _) => _ErrorCard(
              message: e.toString(),
              onRetry: () => ref.invalidate(_systemHealthProvider),
            ),
            data: (health) {
              final status =
                  (health['status'] ?? 'unknown').toString().toUpperCase();
              final isOk = status == 'OK' || status == 'HEALTHY' || status == 'UP';
              final services =
                  health['services'] as Map? ?? {};

              return Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: (isOk ? AppColors.kSuccess : AppColors.kError)
                      .withOpacity(0.08),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: (isOk ? AppColors.kSuccess : AppColors.kError)
                        .withOpacity(0.3),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Icon(
                          isOk
                              ? Icons.check_circle
                              : Icons.error,
                          color: isOk
                              ? AppColors.kSuccess
                              : AppColors.kError,
                          size: 20,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          isOk ? 'System Online' : 'System Issues',
                          style: TextStyle(
                            color: isOk
                                ? AppColors.kSuccess
                                : AppColors.kError,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            fontFamily: 'SF Pro Display',
                          ),
                        ),
                      ],
                    ),
                    if (services.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      ...services.entries.map((entry) {
                        final svcOk = entry.value.toString().toUpperCase() ==
                                'OK' ||
                            entry.value.toString().toUpperCase() == 'UP' ||
                            entry.value == true;
                        return Row(
                          children: [
                            Icon(
                              svcOk
                                  ? Icons.circle
                                  : Icons.cancel,
                              size: 8,
                              color: svcOk
                                  ? AppColors.kSuccess
                                  : AppColors.kError,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '${entry.key}: ${entry.value}',
                              style: const TextStyle(
                                color: AppColors.kTextSecondary,
                                fontSize: 12,
                                fontFamily: 'SF Pro Display',
                              ),
                            ),
                          ],
                        );
                      }),
                    ],
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 16),

          // Stats
          statsAsync.when(
            loading: () => const _LoadingCard(message: 'Loading stats…'),
            error: (e, _) => _ErrorCard(
              message: e.toString(),
              onRetry: () => ref.invalidate(_systemStatsProvider),
            ),
            data: (stats) {
              final totalUsers =
                  stats['total_users'] ?? stats['users_count'] ?? 0;
              final totalBranches =
                  stats['total_branches'] ?? stats['branches_count'] ?? 0;
              final totalRoles =
                  stats['total_roles'] ?? stats['roles_count'] ?? 0;
              final todayTx = stats['today_transactions'] ??
                  stats['transactions_today'] ??
                  0;

              return GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                childAspectRatio: 1.3,
                children: [
                  MobileStatCard(
                    label: 'Total Users',
                    value: '$totalUsers',
                    icon: Icons.people,
                    color: AppColors.kPrimary,
                  ),
                  MobileStatCard(
                    label: 'Branches',
                    value: '$totalBranches',
                    icon: Icons.business,
                    color: AppColors.kAccent,
                  ),
                  MobileStatCard(
                    label: 'Roles',
                    value: '$totalRoles',
                    icon: Icons.manage_accounts,
                    color: const Color(0xFF7C3AED),
                  ),
                  MobileStatCard(
                    label: "Today's Tx",
                    value: '$todayTx',
                    icon: Icons.receipt_long,
                    color: AppColors.kSuccess,
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _LoadingCard extends StatelessWidget {
  const _LoadingCard({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppColors.kPrimary,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            message,
            style: const TextStyle(
              color: AppColors.kTextSecondary,
              fontFamily: 'SF Pro Display',
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.kError.withOpacity(0.06),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline,
              color: AppColors.kError, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color: AppColors.kError,
                fontSize: 12,
                fontFamily: 'SF Pro Display',
              ),
              overflow: TextOverflow.ellipsis,
              maxLines: 2,
            ),
          ),
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(
                foregroundColor: AppColors.kPrimary,
                textStyle: const TextStyle(fontSize: 12)),
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 2 — Users
// ---------------------------------------------------------------------------

class _UsersTab extends ConsumerStatefulWidget {
  const _UsersTab();

  @override
  ConsumerState<_UsersTab> createState() => _UsersTabState();
}

class _UsersTabState extends ConsumerState<_UsersTab> {
  final _searchController = TextEditingController();
  String _search = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_superUsersProvider);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: TextField(
            controller: _searchController,
            decoration: InputDecoration(
              hintText: 'Search users…',
              prefixIcon: const Icon(Icons.search, size: 20),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
              ),
              contentPadding: const EdgeInsets.symmetric(
                  horizontal: 12, vertical: 10),
            ),
            onChanged: (v) => setState(() => _search = v.toLowerCase()),
          ),
        ),
        Expanded(
          child: async.when(
            loading: () =>
                const MobileLoadingView(message: 'Loading users…'),
            error: (e, _) => MobileEmptyState(
              icon: Icons.error_outline,
              title: 'Could not load users',
              subtitle: e.toString(),
              action: TextButton(
                onPressed: () =>
                    ref.invalidate(_superUsersProvider),
                child: const Text('Retry'),
              ),
            ),
            data: (users) {
              final filtered = _search.isEmpty
                  ? users
                  : users.where((u) {
                      final name =
                          '${u['name'] ?? u['first_name'] ?? ''} ${u['last_name'] ?? ''}'
                              .toLowerCase();
                      final role =
                          (u['role'] ?? '').toString().toLowerCase();
                      return name.contains(_search) ||
                          role.contains(_search);
                    }).toList();

              if (filtered.isEmpty) {
                return const MobileEmptyState(
                  icon: Icons.people_outline,
                  title: 'No users found',
                  subtitle: 'No users match your search.',
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: filtered.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: 8),
                itemBuilder: (context, i) =>
                    _UserTile(user: filtered[i]),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _UserTile extends StatelessWidget {
  const _UserTile({required this.user});

  final Map<String, dynamic> user;

  @override
  Widget build(BuildContext context) {
    final name = '${user['first_name'] ?? user['name'] ?? '—'} ${user['last_name'] ?? ''}'.trim();
    final role = user['role'] ?? user['user_role'] ?? '—';
    final branch = user['branch_name'] ?? user['branch'] ?? '';
    final lastLogin = user['last_login'] ?? user['last_seen'] ?? '';

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.kPrimary.withOpacity(0.15),
            child: Text(
              name.isNotEmpty ? name[0].toUpperCase() : '?',
              style: const TextStyle(
                color: AppColors.kPrimary,
                fontWeight: FontWeight.w700,
                fontFamily: 'SF Pro Display',
              ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.kPrimary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        role.toString(),
                        style: const TextStyle(
                          color: AppColors.kPrimary,
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          fontFamily: 'SF Pro Display',
                        ),
                      ),
                    ),
                    if (branch.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Text(
                        branch.toString(),
                        style: const TextStyle(
                          color: AppColors.kTextSecondary,
                          fontSize: 11,
                          fontFamily: 'SF Pro Display',
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          if (lastLogin.isNotEmpty)
            Text(
              _shortDate(lastLogin.toString()),
              style: const TextStyle(
                color: AppColors.kTextSecondary,
                fontSize: 10,
                fontFamily: 'SF Pro Display',
              ),
            ),
        ],
      ),
    );
  }

  String _shortDate(String iso) {
    try {
      final dt = DateTime.parse(iso);
      return '${dt.day}/${dt.month}';
    } catch (_) {
      return iso;
    }
  }
}

// ---------------------------------------------------------------------------
// Tab 3 — Audit Logs
// ---------------------------------------------------------------------------

class _AuditLogsTab extends ConsumerStatefulWidget {
  const _AuditLogsTab();

  @override
  ConsumerState<_AuditLogsTab> createState() => _AuditLogsTabState();
}

class _AuditLogsTabState extends ConsumerState<_AuditLogsTab> {
  String _severity = '';

  static const _severities = ['', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(_auditLogsProvider);
    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: Row(
            children: _severities.map((s) {
              final selected = _severity == s;
              final label = s.isEmpty ? 'All' : s;
              final color = s == 'ERROR' || s == 'CRITICAL'
                  ? AppColors.kError
                  : s == 'WARNING'
                      ? AppColors.kWarning
                      : s == 'INFO'
                          ? AppColors.kSuccess
                          : AppColors.kPrimary;
              return GestureDetector(
                onTap: () => setState(() => _severity = s),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(
                      horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: selected
                        ? color
                        : color.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    label,
                    style: TextStyle(
                      color: selected ? Colors.white : color,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'SF Pro Display',
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
        ),
        Expanded(
          child: async.when(
            loading: () =>
                const MobileLoadingView(message: 'Loading audit logs…'),
            error: (e, _) => MobileEmptyState(
              icon: Icons.error_outline,
              title: 'Could not load audit logs',
              subtitle: e.toString(),
              action: TextButton(
                onPressed: () =>
                    ref.invalidate(_auditLogsProvider),
                child: const Text('Retry'),
              ),
            ),
            data: (logs) {
              final filtered = _severity.isEmpty
                  ? logs
                  : logs
                      .where((l) =>
                          (l['severity'] ?? l['level'] ?? '')
                              .toString()
                              .toUpperCase() ==
                          _severity)
                      .toList();

              if (filtered.isEmpty) {
                return const MobileEmptyState(
                  icon: Icons.history_edu,
                  title: 'No audit logs',
                  subtitle: 'No logs found for this filter.',
                );
              }
              return ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: filtered.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(height: 6),
                itemBuilder: (context, i) =>
                    _AuditLogTile(log: filtered[i]),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _AuditLogTile extends StatelessWidget {
  const _AuditLogTile({required this.log});

  final Map<String, dynamic> log;

  static const _severityColors = {
    'INFO': AppColors.kSuccess,
    'WARNING': AppColors.kWarning,
    'ERROR': AppColors.kError,
    'CRITICAL': Color(0xFF7F0000),
  };

  @override
  Widget build(BuildContext context) {
    final action = log['action'] ?? log['event'] ?? log['message'] ?? '—';
    final user = log['user'] ??
        log['performed_by'] ??
        log['actor'] ??
        '';
    final timestamp = log['created_at'] ?? log['timestamp'] ?? '';
    final severity =
        (log['severity'] ?? log['level'] ?? 'INFO')
            .toString()
            .toUpperCase();
    final ip = log['ip_address'] ?? log['ip'] ?? '';

    final severityColor =
        _severityColors[severity] ?? AppColors.kTextSecondary;

    String timeDisplay = '';
    if (timestamp.isNotEmpty) {
      try {
        final dt = DateTime.parse(timestamp.toString());
        timeDisplay =
            '${dt.day}/${dt.month} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
      } catch (_) {
        timeDisplay = timestamp.toString();
      }
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
            color: severityColor.withOpacity(0.15)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 2),
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              color: severityColor,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  action.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 12,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    if (user.isNotEmpty) ...[
                      Text(
                        user.toString(),
                        style: const TextStyle(
                          color: AppColors.kTextSecondary,
                          fontSize: 10,
                          fontFamily: 'SF Pro Display',
                        ),
                      ),
                      const SizedBox(width: 8),
                    ],
                    if (ip.isNotEmpty)
                      Text(
                        ip.toString(),
                        style: const TextStyle(
                          color: AppColors.kTextSecondary,
                          fontSize: 10,
                          fontFamily: 'SF Pro Display',
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                severity,
                style: TextStyle(
                  color: severityColor,
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                  fontFamily: 'SF Pro Display',
                ),
              ),
              Text(
                timeDisplay,
                style: const TextStyle(
                  color: AppColors.kTextSecondary,
                  fontSize: 10,
                  fontFamily: 'SF Pro Display',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Tab 4 — Branches
// ---------------------------------------------------------------------------

class _SuperBranchesTab extends ConsumerWidget {
  const _SuperBranchesTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_superBranchesProvider);
    return async.when(
      loading: () =>
          const MobileLoadingView(message: 'Loading branches…'),
      error: (e, _) => MobileEmptyState(
        icon: Icons.error_outline,
        title: 'Could not load',
        subtitle: e.toString(),
        action: TextButton(
          onPressed: () => ref.invalidate(_superBranchesProvider),
          child: const Text('Retry'),
        ),
      ),
      data: (branches) {
        if (branches.isEmpty) {
          return const MobileEmptyState(
            icon: Icons.business_outlined,
            title: 'No branches found',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.all(16),
          itemCount: branches.length,
          separatorBuilder: (_, __) => const SizedBox(height: 10),
          itemBuilder: (context, i) =>
              _SuperBranchTile(branch: branches[i]),
        );
      },
    );
  }
}

class _SuperBranchTile extends StatelessWidget {
  const _SuperBranchTile({required this.branch});

  final Map<String, dynamic> branch;

  @override
  Widget build(BuildContext context) {
    final name = branch['name'] ?? branch['branch_name'] ?? '—';
    final location = branch['location'] ?? branch['address'] ?? '';
    final status =
        (branch['status'] ?? 'ACTIVE').toString().toUpperCase();
    final isActive = status == 'ACTIVE' || status == 'OPEN';
    final staffCount = branch['staff_count'] ?? branch['staff'] ?? '';
    final type = branch['branch_type'] ?? branch['type'] ?? '';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.kCardBg,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.kPrimary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.business,
                color: AppColors.kPrimary, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name.toString(),
                  style: const TextStyle(
                    color: AppColors.kTextPrimary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
                Text(
                  [
                    if (location.isNotEmpty) location.toString(),
                    if (type.isNotEmpty) type.toString(),
                    if (staffCount.toString().isNotEmpty)
                      '$staffCount staff',
                  ].join(' • '),
                  style: const TextStyle(
                    color: AppColors.kTextSecondary,
                    fontSize: 11,
                    fontFamily: 'SF Pro Display',
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: (isActive
                      ? AppColors.kSuccess
                      : AppColors.kError)
                  .withOpacity(0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              status,
              style: TextStyle(
                color: isActive
                    ? AppColors.kSuccess
                    : AppColors.kError,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                fontFamily: 'SF Pro Display',
              ),
            ),
          ),
        ],
      ),
    );
  }
}
