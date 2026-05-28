import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/superadmin_providers.dart';

class DataOverrideSection extends ConsumerStatefulWidget {
  const DataOverrideSection({super.key});

  @override
  ConsumerState<DataOverrideSection> createState() =>
      _DataOverrideSectionState();
}

class _DataOverrideSectionState extends ConsumerState<DataOverrideSection>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  // Tab 1 — Force Approve
  String _tableName = 'staff_leaves';
  final _recordIdCtrl = TextEditingController();
  final _approveJustCtrl = TextEditingController();

  // Tab 2 — Unlock Account
  final _unlockJustCtrl = TextEditingController();

  // Tab 3 — God Audit Log
  String? _auditActionFilter;

  static const _tableOptions = [
    ('staff_leaves', 'Staff Leave'),
    ('stock_requests', 'Stock Requests'),
    ('purchase_orders', 'Purchase Orders'),
  ];

  static const _auditActionTypes = [
    'emergency',
    'impersonation',
    'data_override',
    'config_change',
    'feature_flag',
    'announcement',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _recordIdCtrl.dispose();
    _approveJustCtrl.dispose();
    _unlockJustCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 0),
          child: _buildHeader(),
        ),
        const SizedBox(height: 20),
        Container(
          color: Colors.white,
          child: TabBar(
            controller: _tabController,
            isScrollable: true,
            labelColor: AppColors.kPrimary,
            unselectedLabelColor: AppColors.kTextSecondary,
            indicatorColor: AppColors.kPrimary,
            tabs: const [
              Tab(text: 'Force Approve Records'),
              Tab(text: 'Unlock User Accounts'),
              Tab(text: 'God Audit Log'),
            ],
          ),
        ),
        Expanded(
          child: TabBarView(
            controller: _tabController,
            children: [
              _buildForceApproveTab(),
              _buildUnlockAccountsTab(),
              _buildGodAuditLogTab(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Icon(PhosphorIcons.wrench(), color: AppColors.kPrimary, size: 28),
          const SizedBox(width: 10),
          const Text(
            'Data Override Center',
            style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.5),
          ),
        ]),
        const SizedBox(height: 4),
        Text(
          'Force-approve stuck records or unlock accounts',
          style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
        ),
      ],
    );
  }

  // ─── Tab 1 ───────────────────────────────────────────────────────────────────
  Widget _buildForceApproveTab() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.amber.shade300),
            ),
            child: Row(children: [
              Icon(PhosphorIcons.warning(),
                  color: Colors.amber.shade700, size: 18),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'Force-approving bypasses the normal approval workflow. '
                  'Use only for stuck records with a valid business reason.',
                  style:
                      TextStyle(fontSize: 12, color: Colors.amber.shade900),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Force Approve a Record',
                    style:
                        TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  initialValue: _tableName,
                  decoration: const InputDecoration(labelText: 'Table / Record Type'),
                  items: _tableOptions.map((opt) {
                    return DropdownMenuItem(
                        value: opt.$1, child: Text(opt.$2));
                  }).toList(),
                  onChanged: (v) => setState(() => _tableName = v ?? _tableName),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _recordIdCtrl,
                  decoration: const InputDecoration(
                    labelText: 'Record ID *',
                    hintText: 'Enter the numeric or UUID record ID',
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _approveJustCtrl,
                  minLines: 3,
                  maxLines: 5,
                  decoration: const InputDecoration(
                    labelText: 'Justification * (min 20 chars)',
                    alignLabelWithHint: true,
                  ),
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _onForceApproveTap,
                    icon: Icon(PhosphorIcons.checkCircle(), size: 16),
                    label: const Text('Force Approve'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.amber.shade700,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _onForceApproveTap() {
    final recordId = _recordIdCtrl.text.trim();
    final just = _approveJustCtrl.text.trim();
    if (recordId.isEmpty) {
      AppNotifier.show(context, 'Record ID is required.', isError: true);
      return;
    }
    if (just.length < 20) {
      AppNotifier.show(
          context, 'Justification must be at least 20 characters.',
          isError: true);
      return;
    }

    final tableLabel = _tableOptions
        .firstWhere((o) => o.$1 == _tableName,
            orElse: () => (_tableName, _tableName))
        .$2;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(children: [
          Icon(PhosphorIcons.warning(), color: Colors.amber.shade700, size: 22),
          const SizedBox(width: 8),
          const Text('Confirm Force Approval'),
        ]),
        content: SizedBox(
          width: 420,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.amber.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.amber.shade300),
                ),
                child: Text(
                  'You are about to bypass the normal approval workflow for:\n\n'
                  'Table: $tableLabel\nRecord ID: $recordId\n\n'
                  'This action is irreversibly logged.',
                  style: TextStyle(color: Colors.amber.shade900),
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
              Navigator.pop(ctx);
              _doForceApprove(recordId, just);
            },
            style: ElevatedButton.styleFrom(
                backgroundColor: Colors.amber.shade700),
            child: const Text('Force Approve'),
          ),
        ],
      ),
    );
  }

  Future<void> _doForceApprove(String recordId, String justification) async {
    try {
      await ref
          .read(superadminGodRepositoryProvider)
          .forceApproveRecord(recordId, _tableName, justification);
      if (mounted) {
        AppNotifier.show(context, 'Record $recordId force-approved.');
        _recordIdCtrl.clear();
        _approveJustCtrl.clear();
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Failed: $e', isError: true);
      }
    }
  }

  // ─── Tab 2 ───────────────────────────────────────────────────────────────────
  Widget _buildUnlockAccountsTab() {
    final usersAsync = ref.watch(globalUsersProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Unlock User Accounts',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 4),
          Text(
            'Unlock accounts that are locked due to failed login attempts or manual suspension.',
            style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 20),
          usersAsync.when(
            data: (data) {
              final rawUsers = data['data'] as List<dynamic>? ?? [];
              final users = rawUsers.whereType<Map>().map((u) {
                return Map<String, dynamic>.from(u);
              }).where((u) {
                final status = u['status']?.toString() ?? '';
                return status == 'suspended' ||
                    status == 'locked' ||
                    status == 'inactive';
              }).toList();

              if (users.isEmpty) {
                return Container(
                  padding: const EdgeInsets.all(40),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    children: [
                      Icon(PhosphorIcons.lockOpen(),
                          color: Colors.grey.shade400, size: 40),
                      const SizedBox(height: 12),
                      const Text('No locked accounts found',
                          style: TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15)),
                      Text('All user accounts are currently active.',
                          style: TextStyle(color: Colors.grey.shade500)),
                    ],
                  ),
                );
              }

              return Column(
                children: users.map((user) => _buildLockedUserCard(user)).toList(),
              );
            },
            loading: () => const LoadingSkeleton(height: 80, count: 4),
            error: (e, _) => ErrorState(
              message: e.toString(),
              onRetry: () => ref.invalidate(globalUsersProvider),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLockedUserCard(Map<String, dynamic> user) {
    final fullName =
        '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
    final email = user['email']?.toString() ?? '';
    final role = user['role']?.toString() ?? 'Unknown';
    final status = user['status']?.toString() ?? 'inactive';
    final userId = user['id']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.red.shade200),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(8),
            ),
            child:
                Icon(PhosphorIcons.lock(), color: AppColors.kError, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(fullName,
                    style: const TextStyle(fontWeight: FontWeight.w600)),
                Text('$email • ${role.replaceAll('_', ' ')}',
                    style: TextStyle(
                        fontSize: 12, color: Colors.grey.shade600)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: Colors.red.shade100,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              status.toUpperCase(),
              style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Colors.red.shade800),
            ),
          ),
          const SizedBox(width: 10),
          ElevatedButton.icon(
            onPressed: userId.isEmpty
                ? null
                : () => _showUnlockDialog(userId, fullName),
            icon: Icon(PhosphorIcons.lockOpen(), size: 14),
            label: const Text('Unlock'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.kSuccess,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              textStyle: const TextStyle(fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  void _showUnlockDialog(String userId, String userName) {
    _unlockJustCtrl.clear();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(children: [
          Icon(PhosphorIcons.lockOpen(), color: AppColors.kSuccess, size: 22),
          const SizedBox(width: 8),
          const Text('Unlock Account'),
        ]),
        content: SizedBox(
          width: 420,
          child: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Unlocking account for: $userName'),
                const SizedBox(height: 16),
                TextFormField(
                  controller: _unlockJustCtrl,
                  minLines: 3,
                  maxLines: 5,
                  decoration: const InputDecoration(
                    labelText: 'Justification * (min 10 chars)',
                    alignLabelWithHint: true,
                  ),
                  validator: (v) => (v == null || v.trim().length < 10)
                      ? 'Justification must be at least 10 characters'
                      : null,
                ),
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
              if (!formKey.currentState!.validate()) return;
              Navigator.pop(ctx);
              await _doUnlockAccount(userId, _unlockJustCtrl.text.trim());
            },
            style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kSuccess),
            child: const Text('Unlock Account'),
          ),
        ],
      ),
    );
  }

  Future<void> _doUnlockAccount(
      String userId, String justification) async {
    try {
      await ref
          .read(superadminGodRepositoryProvider)
          .unlockUserAccount(userId, justification);
      ref.invalidate(globalUsersProvider);
      if (mounted) {
        AppNotifier.show(context, 'Account unlocked successfully.');
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Failed to unlock account: $e',
            isError: true);
      }
    }
  }

  // ─── Tab 3 ───────────────────────────────────────────────────────────────────
  Widget _buildGodAuditLogTab() {
    final auditAsync = ref.watch(godAuditLogProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('SuperAdmin Audit Log',
                  style:
                      TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              Row(children: [
                SizedBox(
                  width: 220,
                  child: DropdownButtonFormField<String?>(
                    initialValue: _auditActionFilter,
                    decoration: const InputDecoration(
                        labelText: 'Filter by Action',
                        isDense: true,
                        contentPadding:
                            EdgeInsets.symmetric(vertical: 8, horizontal: 12)),
                    items: [
                      const DropdownMenuItem<String?>(
                          value: null, child: Text('All actions')),
                      ..._auditActionTypes.map((type) => DropdownMenuItem(
                            value: type,
                            child: Text(type.replaceAll('_', ' ').toUpperCase()),
                          )),
                    ],
                    onChanged: (v) {
                      setState(() => _auditActionFilter = v);
                      ref.invalidate(godAuditLogProvider);
                    },
                  ),
                ),
                const SizedBox(width: 12),
                IconButton(
                  icon: Icon(PhosphorIcons.arrowsClockwise(), size: 18),
                  onPressed: () => ref.invalidate(godAuditLogProvider),
                  tooltip: 'Refresh',
                ),
              ]),
            ],
          ),
          const SizedBox(height: 16),
          auditAsync.when(
            data: (logs) {
              final filtered = _auditActionFilter == null
                  ? logs
                  : logs
                      .where((l) =>
                          l['action_type']?.toString() ==
                          _auditActionFilter)
                      .toList();
              if (filtered.isEmpty) {
                return Container(
                  padding: const EdgeInsets.all(40),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    children: [
                      Icon(PhosphorIcons.clipboardText(),
                          color: Colors.grey.shade400, size: 40),
                      const SizedBox(height: 12),
                      const Text('No audit entries found',
                          style: TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 15)),
                    ],
                  ),
                );
              }
              return _buildAuditTable(filtered);
            },
            loading: () => const LoadingSkeleton(height: 80, count: 5),
            error: (e, _) => ErrorState(
              message: e.toString(),
              onRetry: () => ref.invalidate(godAuditLogProvider),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAuditTable(List<Map<String, dynamic>> logs) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columnSpacing: 20,
          columns: const [
            DataColumn(label: Text('Timestamp')),
            DataColumn(label: Text('Actor')),
            DataColumn(label: Text('Action Type')),
            DataColumn(label: Text('Target')),
            DataColumn(label: Text('Justification')),
          ],
          rows: logs.map((log) {
            final actionType = log['action_type']?.toString() ?? '';
            final actionColor = _auditActionColor(actionType);
            final ts = log['created_at']?.toString() ??
                log['timestamp']?.toString() ??
                '';
            final actor = log['actor_name']?.toString() ??
                log['actor']?.toString() ??
                'System';
            final target = log['target']?.toString() ??
                log['target_id']?.toString() ??
                '—';
            final justification =
                log['justification']?.toString() ?? '—';

            return DataRow(cells: [
              DataCell(Text(_formatDate(ts),
                  style: const TextStyle(fontSize: 12))),
              DataCell(Text(actor,
                  style: const TextStyle(fontWeight: FontWeight.w500))),
              DataCell(
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: actionColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    actionType.replaceAll('_', ' ').toUpperCase(),
                    style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: actionColor),
                  ),
                ),
              ),
              DataCell(SizedBox(
                  width: 120,
                  child: Text(target,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12)))),
              DataCell(SizedBox(
                  width: 200,
                  child: Text(justification,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontSize: 12)))),
            ]);
          }).toList(),
        ),
      ),
    );
  }

  Color _auditActionColor(String actionType) {
    switch (actionType.toLowerCase()) {
      case 'emergency':
        return Colors.red;
      case 'impersonation':
        return Colors.orange;
      case 'data_override':
        return Colors.amber.shade700;
      case 'config_change':
        return Colors.blue;
      case 'feature_flag':
        return Colors.purple;
      case 'announcement':
        return Colors.teal;
      default:
        return Colors.grey;
    }
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.year}-${dt.month.toString().padLeft(2, '0')}-${dt.day.toString().padLeft(2, '0')} '
          '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return iso;
    }
  }
}
