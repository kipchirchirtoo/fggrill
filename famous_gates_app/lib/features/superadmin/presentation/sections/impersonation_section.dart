import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../domain/superadmin_providers.dart';

class ImpersonationSection extends ConsumerStatefulWidget {
  const ImpersonationSection({super.key});

  @override
  ConsumerState<ImpersonationSection> createState() =>
      _ImpersonationSectionState();
}

class _ImpersonationSectionState extends ConsumerState<ImpersonationSection> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final usersAsync = ref.watch(globalUsersProvider);
    final session = ref.watch(impersonationSessionProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 16),
          if (session != null) _buildActiveSessionBanner(session),
          if (session != null) const SizedBox(height: 16),
          _buildSearchField(),
          const SizedBox(height: 20),
          usersAsync.when(
            data: (data) => _buildUsersTable(data),
            loading: () => const LoadingSkeleton(height: 400),
            error: (e, _) => ErrorState(
              message: e.toString(),
              onRetry: () => ref.invalidate(globalUsersProvider),
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
        Row(
          children: [
            Icon(PhosphorIcons.userGear(),
                color: Colors.orange.shade700, size: 28),
            const SizedBox(width: 10),
            const Text(
              'User Impersonation',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          'Shadow a user session for debugging. All actions are logged.',
          style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
        ),
      ],
    );
  }

  Widget _buildActiveSessionBanner(Map<String, dynamic> session) {
    final userName = session['user_name'] ?? session['target_user'] ?? 'Unknown';
    final sessionId = session['session_id']?.toString() ?? '';

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.orange.shade600,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: Colors.orange.withValues(alpha: 0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          Icon(PhosphorIcons.eye(), color: Colors.white, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'ACTIVE IMPERSONATION SESSION',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Currently impersonating: $userName',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w600),
                ),
              ],
            ),
          ),
          ElevatedButton.icon(
            onPressed: () => _endSession(sessionId),
            icon: Icon(PhosphorIcons.signOut(), size: 16),
            label: const Text('End Session'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.white,
              foregroundColor: Colors.orange.shade700,
              padding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchField() {
    return SizedBox(
      width: 320,
      child: TextField(
        decoration: InputDecoration(
          prefixIcon: Icon(PhosphorIcons.magnifyingGlass()),
          labelText: 'Search users',
          hintText: 'Name, email, role...',
        ),
        onChanged: (v) => setState(() => _search = v),
      ),
    );
  }

  Widget _buildUsersTable(Map<String, dynamic> data) {
    final rawUsers = data['data'] as List<dynamic>? ?? [];
    final users = rawUsers.whereType<Map>().map((u) {
      return Map<String, dynamic>.from(u);
    }).where((user) {
      if (_search.isEmpty) return true;
      final haystack =
          '${user['first_name'] ?? ''} ${user['last_name'] ?? ''} ${user['email'] ?? ''} ${user['role'] ?? ''}'
              .toLowerCase();
      return haystack.contains(_search.toLowerCase());
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
            Icon(PhosphorIcons.users(), color: Colors.grey.shade400, size: 40),
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
            DataColumn(label: Text('Name')),
            DataColumn(label: Text('Email')),
            DataColumn(label: Text('Role')),
            DataColumn(label: Text('Branch')),
            DataColumn(label: Text('Action')),
          ],
          rows: users.map((user) {
            final fullName =
                '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
            final role = user['role']?.toString() ?? 'Unknown';
            final branch = user['branch_name']?.toString() ?? 'Central';
            final userId = user['id']?.toString() ?? '';

            return DataRow(cells: [
              DataCell(
                Row(children: [
                  CircleAvatar(
                    radius: 15,
                    backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                    child: Text(
                      fullName.isNotEmpty ? fullName[0].toUpperCase() : '?',
                      style: const TextStyle(
                          color: AppColors.kPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 11),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(fullName,
                      style: const TextStyle(fontWeight: FontWeight.w500)),
                ]),
              ),
              DataCell(Text(user['email']?.toString() ?? 'N/A')),
              DataCell(
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: AppColors.kPrimary.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    role.replaceAll('_', ' ').toUpperCase(),
                    style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: AppColors.kPrimary),
                  ),
                ),
              ),
              DataCell(Text(branch)),
              DataCell(
                ElevatedButton.icon(
                  onPressed:
                      userId.isEmpty ? null : () => _showImpersonateDialog(user),
                  icon: Icon(PhosphorIcons.userGear(), size: 14),
                  label: const Text('Impersonate'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.orange.shade600,
                    foregroundColor: Colors.white,
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    textStyle: const TextStyle(fontSize: 12),
                  ),
                ),
              ),
            ]);
          }).toList(),
        ),
      ),
    );
  }

  void _showImpersonateDialog(Map<String, dynamic> user) {
    final fullName =
        '${user['first_name'] ?? ''} ${user['last_name'] ?? ''}'.trim();
    final userId = user['id']?.toString() ?? '';

    showDialog(
      context: context,
      builder: (ctx) => _ImpersonateDialog(
        user: user,
        fullName: fullName,
        userId: userId,
        onConfirmed: (justification) =>
            _startImpersonation(userId, fullName, justification),
      ),
    );
  }

  Future<void> _startImpersonation(
      String userId, String userName, String justification) async {
    if (!mounted) return;
    try {
      final result = await ref
          .read(superadminGodRepositoryProvider)
          .startImpersonation(userId, justification);
      if (!mounted) return;
      ref.read(impersonationSessionProvider.notifier).state = {
        ...result,
        'user_name': userName,
      };
      if (mounted) {
        AppNotifier.show(
          context,
          'Impersonating: $userName. Shadow token ready.',
        );
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Failed to start impersonation: $e',
            isError: true);
      }
    }
  }

  Future<void> _endSession(String sessionId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('End Impersonation Session'),
        content:
            const Text('Are you sure you want to end the current impersonation session?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style:
                ElevatedButton.styleFrom(backgroundColor: Colors.orange.shade600),
            child: const Text('End Session'),
          ),
        ],
      ),
    );
    if (confirm != true || !mounted) return;
    try {
      await ref
          .read(superadminGodRepositoryProvider)
          .endImpersonation(sessionId);
      ref.read(impersonationSessionProvider.notifier).state = null;
      if (mounted) {
        AppNotifier.show(context, 'Impersonation session ended.');
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.show(context, 'Failed to end session: $e', isError: true);
      }
    }
  }
}

/// A dedicated StatefulWidget for the impersonation confirmation dialog so
/// that [justificationCtrl] is properly disposed when the dialog is closed.
class _ImpersonateDialog extends StatefulWidget {
  const _ImpersonateDialog({
    required this.user,
    required this.fullName,
    required this.userId,
    required this.onConfirmed,
  });

  final Map<String, dynamic> user;
  final String fullName;
  final String userId;
  final void Function(String justification) onConfirmed;

  @override
  State<_ImpersonateDialog> createState() => _ImpersonateDialogState();
}

class _ImpersonateDialogState extends State<_ImpersonateDialog> {
  final TextEditingController _justificationCtrl = TextEditingController();
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _justificationCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Row(children: [
        Icon(PhosphorIcons.warning(), color: Colors.orange, size: 22),
        const SizedBox(width: 8),
        const Text('Confirm Impersonation'),
      ]),
      content: SizedBox(
        width: 460,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.orange.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.orange.shade200),
                ),
                child: Text(
                  'You are about to impersonate ${widget.fullName} (${widget.user['role'] ?? 'Unknown role'}). '
                  'This action is fully logged and audited.',
                  style: TextStyle(color: Colors.orange.shade800),
                ),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _justificationCtrl,
                minLines: 3,
                maxLines: 5,
                decoration: const InputDecoration(
                  labelText: 'Justification *',
                  hintText: 'Provide a reason for impersonation...',
                  alignLabelWithHint: true,
                ),
                validator: (v) {
                  if (v == null || v.trim().length < 10) {
                    return 'Justification must be at least 10 characters';
                  }
                  return null;
                },
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: () {
            if (!_formKey.currentState!.validate()) return;
            final justification = _justificationCtrl.text.trim();
            Navigator.pop(context);
            widget.onConfirmed(justification);
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.orange.shade600,
          ),
          child: const Text('Impersonate'),
        ),
      ],
    );
  }
}
