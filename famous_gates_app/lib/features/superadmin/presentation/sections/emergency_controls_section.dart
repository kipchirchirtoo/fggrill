import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/api_error_message.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/superadmin_providers.dart';

class EmergencyControlsSection extends ConsumerStatefulWidget {
  const EmergencyControlsSection({super.key});

  @override
  ConsumerState<EmergencyControlsSection> createState() =>
      _EmergencyControlsSectionState();
}

class _EmergencyControlsSectionState
    extends ConsumerState<EmergencyControlsSection> {
  // Card 1 — Maintenance Mode
  bool _maintenanceEnabled = false;
  final _maintenanceMsgCtrl = TextEditingController();
  final _maintenanceJustCtrl = TextEditingController();

  // Card 2 — Force Logout All
  final _logoutAllJustCtrl = TextEditingController();

  // Card 3 — Force Logout Specific User
  String? _selectedLogoutUserId;
  final _logoutUserJustCtrl = TextEditingController();

  // Card 4 — Branch Lockdown
  int? _selectedBranchId;
  final _lockdownJustCtrl = TextEditingController();

  @override
  void dispose() {
    _maintenanceMsgCtrl.dispose();
    _maintenanceJustCtrl.dispose();
    _logoutAllJustCtrl.dispose();
    _logoutUserJustCtrl.dispose();
    _lockdownJustCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final securityAsync = ref.watch(godSecurityConfigProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 24),
          securityAsync.when(
            data: (config) {
              final serverMaintenance = config['maintenance_mode'] == true;
              if (_maintenanceEnabled != serverMaintenance) {
                WidgetsBinding.instance.addPostFrameCallback((_) =>
                    setState(() => _maintenanceEnabled = serverMaintenance));
              }
              return _buildCards();
            },
            loading: () => const LoadingSkeleton(height: 200, count: 2),
            error: (e, _) => Column(
              children: [
                ErrorState(
                  message: _friendlyError(e),
                  onRetry: () => ref.invalidate(godSecurityConfigProvider),
                ),
                const SizedBox(height: 24),
                _buildCards(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(children: [
          Icon(PhosphorIcons.warning(), color: AppColors.kError, size: 30),
          const SizedBox(width: 10),
          const Text(
            'Emergency Controls',
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.bold,
              letterSpacing: -0.5,
            ),
          ),
        ]),
        const SizedBox(height: 4),
        const Text(
          'HIGH RISK — All actions are logged and irreversible',
          style: TextStyle(
            color: AppColors.kError,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
        ),
      ],
    );
  }

  Widget _buildCards() {
    return Column(
      children: [
        _buildMaintenanceModeCard(),
        const SizedBox(height: 16),
        _buildForceLogoutAllCard(),
        const SizedBox(height: 16),
        _buildForceLogoutUserCard(),
        const SizedBox(height: 16),
        _buildBranchLockdownCard(),
      ],
    );
  }

  Widget _emergencyCard({
    required String title,
    required String subtitle,
    required Widget content,
    Color borderColor = const Color(0xFFDC2626),
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border:
            Border.all(color: borderColor.withValues(alpha: 0.5), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Icon(PhosphorIcons.warning(), color: borderColor, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 16,
                            color: borderColor)),
                    Text(subtitle,
                        style: TextStyle(
                            fontSize: 12, color: Colors.grey.shade600)),
                  ],
                ),
              ),
            ]),
            const SizedBox(height: 4),
            Text(
              'All actions are irreversibly logged.',
              style: TextStyle(
                  fontSize: 11,
                  color: Colors.red.shade400,
                  fontStyle: FontStyle.italic),
            ),
            const SizedBox(height: 16),
            content,
          ],
        ),
      ),
    );
  }

  // Card 1
  Widget _buildMaintenanceModeCard() {
    return _emergencyCard(
      title: 'Maintenance Mode',
      subtitle: 'Restrict access to the system for all non-admin users',
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Text('Current Status: ',
                style: TextStyle(fontWeight: FontWeight.w600)),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
              decoration: BoxDecoration(
                color: _maintenanceEnabled
                    ? Colors.orange.shade100
                    : Colors.green.shade100,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                _maintenanceEnabled ? 'MAINTENANCE' : 'OPERATIONAL',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                  color: _maintenanceEnabled
                      ? Colors.orange.shade800
                      : Colors.green.shade800,
                ),
              ),
            ),
            const Spacer(),
            Switch(
              value: _maintenanceEnabled,
              activeThumbColor: Colors.orange,
              onChanged: (v) => setState(() => _maintenanceEnabled = v),
            ),
          ]),
          const SizedBox(height: 12),
          TextField(
            controller: _maintenanceMsgCtrl,
            decoration: const InputDecoration(
              labelText: 'Maintenance Message (optional)',
              hintText: 'System under maintenance. Try again later.',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _maintenanceJustCtrl,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Justification * (min 20 chars)',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _onMaintenanceTap,
              icon: Icon(PhosphorIcons.warning(), size: 16),
              label: Text(
                _maintenanceEnabled
                    ? 'Activate Maintenance Mode'
                    : 'Deactivate Maintenance Mode',
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor:
                    _maintenanceEnabled ? Colors.orange : Colors.green,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _onMaintenanceTap() {
    final just = _maintenanceJustCtrl.text.trim();
    if (just.length < 20) {
      AppNotifier.show(context, 'Justification must be at least 20 characters.',
          isError: true);
      return;
    }
    _showDoubleConfirmDialog(
      title: _maintenanceEnabled
          ? 'Enable Maintenance Mode'
          : 'Disable Maintenance Mode',
      warning: _maintenanceEnabled
          ? 'This will prevent all non-admin users from accessing the system.'
          : 'This will restore normal system access.',
      onConfirmed: _doToggleMaintenance,
    );
  }

  Future<void> _doToggleMaintenance() async {
    try {
      await ref.read(superadminGodRepositoryProvider).toggleMaintenanceMode(
            _maintenanceEnabled,
            message: _maintenanceMsgCtrl.text.trim().isEmpty
                ? null
                : _maintenanceMsgCtrl.text.trim(),
            justification: _maintenanceJustCtrl.text.trim(),
          );
      ref.invalidate(godSecurityConfigProvider);
      if (mounted) {
        AppNotifier.show(
          context,
          'Maintenance mode ${_maintenanceEnabled ? "enabled" : "disabled"}.',
        );
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, _friendlyError(e), isError: true);
      }
    }
  }

  // Card 2
  Widget _buildForceLogoutAllCard() {
    return _emergencyCard(
      title: 'Force Logout All Users',
      subtitle: 'Immediately invalidates ALL active sessions except SuperAdmin',
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.red.shade200),
            ),
            child: Row(children: [
              Icon(PhosphorIcons.warning(),
                  color: Colors.red.shade700, size: 16),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  'All active user sessions will be immediately terminated. '
                  'Users will need to log in again.',
                  style: TextStyle(fontSize: 12, color: Colors.red.shade800),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _logoutAllJustCtrl,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Justification * (min 20 chars)',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _onForceLogoutAllTap,
              icon: Icon(PhosphorIcons.signOut(), size: 16),
              label: const Text('Force Logout All Users'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kError,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _onForceLogoutAllTap() {
    final just = _logoutAllJustCtrl.text.trim();
    if (just.length < 20) {
      AppNotifier.show(context, 'Justification must be at least 20 characters.',
          isError: true);
      return;
    }
    _showDoubleConfirmDialog(
      title: 'Force Logout ALL Users',
      warning:
          'This will immediately terminate all active sessions system-wide. Proceed?',
      onConfirmed: _doForceLogoutAll,
    );
  }

  Future<void> _doForceLogoutAll() async {
    try {
      final count = await ref
          .read(superadminGodRepositoryProvider)
          .forceLogoutAll(_logoutAllJustCtrl.text.trim());
      if (mounted) {
        AppNotifier.show(context, '$count users have been logged out.');
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, _friendlyError(e), isError: true);
      }
    }
  }

  // Card 3
  Widget _buildForceLogoutUserCard() {
    final usersAsync = ref.watch(globalUsersProvider);
    final users = usersAsync.maybeWhen(
      data: (Map<String, dynamic> data) {
        final rawUsers = data['data'] as List<dynamic>? ?? [];
        return rawUsers.whereType<Map>().map((u) {
          return Map<String, dynamic>.from(u);
        }).toList();
      },
      orElse: () => <Map<String, dynamic>>[],
    );

    return _emergencyCard(
      title: 'Force Logout Specific User',
      subtitle: 'Terminate a single user\'s active session',
      borderColor: Colors.orange,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (usersAsync.isLoading)
            const LoadingSkeleton(height: 48, count: 1)
          else
            DropdownButtonFormField<String>(
              initialValue: _selectedLogoutUserId,
              decoration: const InputDecoration(labelText: 'Select User'),
              items: [
                const DropdownMenuItem<String>(
                    value: null, child: Text('Select a user')),
                ...users.map((u) {
                  final name =
                      '${u['first_name'] ?? ''} ${u['last_name'] ?? ''}'.trim();
                  final id = u['id']?.toString() ?? '';
                  return DropdownMenuItem<String>(
                    value: id,
                    child: Text('$name (${u['role'] ?? 'unknown'})'),
                  );
                }),
              ],
              onChanged: (v) => setState(() => _selectedLogoutUserId = v),
            ),
          const SizedBox(height: 12),
          TextField(
            controller: _logoutUserJustCtrl,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Justification * (min 20 chars)',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed:
                  _selectedLogoutUserId == null ? null : _onForceLogoutUserTap,
              icon: Icon(PhosphorIcons.userMinus(), size: 16),
              label: const Text('Force Logout User'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange.shade600,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _onForceLogoutUserTap() {
    final just = _logoutUserJustCtrl.text.trim();
    if (just.length < 20) {
      AppNotifier.show(context, 'Justification must be at least 20 characters.',
          isError: true);
      return;
    }
    _showDoubleConfirmDialog(
      title: 'Force Logout User',
      warning: 'This will immediately terminate the selected user\'s session.',
      onConfirmed: _doForceLogoutUser,
    );
  }

  Future<void> _doForceLogoutUser() async {
    final userId = _selectedLogoutUserId;
    if (userId == null) return;
    try {
      await ref
          .read(superadminGodRepositoryProvider)
          .forceLogoutUser(userId, _logoutUserJustCtrl.text.trim());
      if (mounted) {
        AppNotifier.show(context, 'User session terminated.');
        setState(() => _selectedLogoutUserId = null);
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, _friendlyError(e), isError: true);
      }
    }
  }

  // Card 4
  Widget _buildBranchLockdownCard() {
    final branchesAsync = ref.watch(allBranchesProvider);
    final branches = branchesAsync.maybeWhen(
      data: (Map<String, dynamic> data) {
        final raw = data['data'] as List<dynamic>? ?? [];
        return raw.whereType<Map>().map((b) {
          return Map<String, dynamic>.from(b);
        }).toList();
      },
      orElse: () => <Map<String, dynamic>>[],
    );

    return _emergencyCard(
      title: 'Branch Lockdown',
      subtitle: 'Set a branch to maintenance/lockdown status',
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (branchesAsync.isLoading)
            const LoadingSkeleton(height: 48, count: 1)
          else
            DropdownButtonFormField<int>(
              initialValue: _selectedBranchId,
              decoration: const InputDecoration(labelText: 'Select Branch'),
              items: [
                const DropdownMenuItem<int>(
                    value: null, child: Text('Select a branch')),
                ...branches.map((b) => DropdownMenuItem<int>(
                      value: int.tryParse('${b['id']}'),
                      child: Text('${b['name'] ?? 'Branch'}'),
                    )),
              ],
              onChanged: (v) => setState(() => _selectedBranchId = v),
            ),
          const SizedBox(height: 12),
          TextField(
            controller: _lockdownJustCtrl,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: 'Justification * (min 20 chars)',
              alignLabelWithHint: true,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed:
                  _selectedBranchId == null ? null : _onBranchLockdownTap,
              icon: Icon(PhosphorIcons.lock(), size: 16),
              label: const Text('Lock Branch'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.kError,
                foregroundColor: Colors.white,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _onBranchLockdownTap() {
    final just = _lockdownJustCtrl.text.trim();
    if (just.length < 20) {
      AppNotifier.show(context, 'Justification must be at least 20 characters.',
          isError: true);
      return;
    }
    _showDoubleConfirmDialog(
      title: 'Lock Down Branch',
      warning:
          'This will set the branch status to maintenance. All branch operations will be suspended.',
      onConfirmed: _doBranchLockdown,
    );
  }

  Future<void> _doBranchLockdown() async {
    final branchId = _selectedBranchId;
    if (branchId == null) return;
    try {
      await ref
          .read(superadminGodRepositoryProvider)
          .lockdownBranch(branchId, _lockdownJustCtrl.text.trim());
      if (mounted) {
        AppNotifier.show(context, 'Branch locked down successfully.');
        setState(() => _selectedBranchId = null);
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, _friendlyError(e), isError: true);
      }
    }
  }

  String _friendlyError(Object error) {
    if (error is SuperadminGodException) {
      return error.message;
    }
    return apiErrorMessage(error,
        fallback:
            'The SuperAdmin action failed. Check backend logs and try again.');
  }

  // Shared double-confirmation dialog
  void _showDoubleConfirmDialog({
    required String title,
    required String warning,
    required VoidCallback onConfirmed,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => _DoubleConfirmDialog(
        title: title,
        warning: warning,
        onConfirmed: onConfirmed,
      ),
    );
  }
}

/// A dedicated StatefulWidget for the double-confirmation dialog so that
/// [confirmCtrl] is properly disposed when the dialog is closed.
class _DoubleConfirmDialog extends StatefulWidget {
  const _DoubleConfirmDialog({
    required this.title,
    required this.warning,
    required this.onConfirmed,
  });

  final String title;
  final String warning;
  final VoidCallback onConfirmed;

  @override
  State<_DoubleConfirmDialog> createState() => _DoubleConfirmDialogState();
}

class _DoubleConfirmDialogState extends State<_DoubleConfirmDialog> {
  final TextEditingController _confirmCtrl = TextEditingController();

  @override
  void dispose() {
    _confirmCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(children: [
        Icon(PhosphorIcons.warning(), color: AppColors.kError, size: 22),
        const SizedBox(width: 8),
        Expanded(child: Text(widget.title)),
      ]),
      content: SizedBox(
        width: 420,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.red.shade300),
              ),
              child: Text(
                widget.warning,
                style: TextStyle(color: Colors.red.shade800),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Type CONFIRM to proceed:',
              style: TextStyle(fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            TextField(
              controller: _confirmCtrl,
              decoration: const InputDecoration(
                hintText: 'CONFIRM',
                border: OutlineInputBorder(),
              ),
              onChanged: (_) => setState(() {}),
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: _confirmCtrl.text == 'CONFIRM'
              ? () {
                  Navigator.pop(context);
                  widget.onConfirmed();
                }
              : null,
          style: ElevatedButton.styleFrom(backgroundColor: AppColors.kError),
          child: const Text('Execute'),
        ),
      ],
    );
  }
}
