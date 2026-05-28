import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/widgets/loading_skeleton.dart';
import '../../../../core/widgets/error_state.dart';
import '../../data/admin_repository.dart';
import '../../domain/admin_providers.dart';
import '../widgets/admin_table.dart';

class SecuritySection extends ConsumerStatefulWidget {
  const SecuritySection({super.key});

  @override
  ConsumerState<SecuritySection> createState() => _SecuritySectionState();
}

class _SecuritySectionState extends ConsumerState<SecuritySection> {
  int _selectedTab = 0;
  final _tabs = [
    'Sessions',
    'Login Policy',
    'Suspicious Activity',
    'Behavior Intelligence'
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _buildTabBar(),
        Expanded(
          child: IndexedStack(
            index: _selectedTab,
            children: [
              _SessionsTab(),
              _LoginPolicyTab(),
              _SuspiciousActivityTab(),
              _BehaviorIntelligenceTab(),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTabBar() {
    return Container(
      color: AppColors.kCardBg,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: _tabs.asMap().entries.map((e) {
            final isSelected = e.key == _selectedTab;
            return InkWell(
              onTap: () => setState(() => _selectedTab = e.key),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
                decoration: BoxDecoration(
                  border: Border(
                    bottom: BorderSide(
                      width: 2,
                      color:
                          isSelected ? AppColors.kPrimary : Colors.transparent,
                    ),
                  ),
                ),
                child: Text(
                  e.value,
                  style: TextStyle(
                    fontWeight:
                        isSelected ? FontWeight.w600 : FontWeight.normal,
                    color: isSelected
                        ? AppColors.kPrimary
                        : AppColors.kTextSecondary,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

// ─── Sessions Tab ─────────────────────────────────────────────────────────────

class _SessionsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessionsAsync = ref.watch(adminActiveSessionsProvider);

    return sessionsAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.list),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(adminActiveSessionsProvider),
      ),
      data: (sessions) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(adminActiveSessionsProvider),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Active Sessions',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text('${sessions.length} active session(s)',
                  style: const TextStyle(color: AppColors.kTextSecondary)),
              const SizedBox(height: 20),
              if (sessions.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(48),
                    child: Text('No active sessions found',
                        style: TextStyle(color: AppColors.kTextSecondary)),
                  ),
                )
              else
                AdminTable(
                  columns: const [
                    'User',
                    'IP Address',
                    'Device',
                    'Last Active',
                    'Login Time',
                    ''
                  ],
                  rows: sessions.map((s) {
                    final isCurrent =
                        s['is_current'] ?? s['isCurrent'] ?? false;
                    final user =
                        s['user_name'] ?? s['name'] ?? s['user'] ?? 'User';
                    final email = s['email'] ?? '';
                    final ip = s['ip_address'] ?? s['ip'] ?? '—';
                    final device = s['device'] ?? s['user_agent'] ?? '—';
                    final lastActive =
                        s['last_active'] ?? s['lastActive'] ?? '—';
                    final loginTime = s['login_time'] ??
                        s['loginTime'] ??
                        s['created_at'] ??
                        '—';
                    final sessionId = s['id'] ?? s['session_id'] ?? '';
                    final userId = s['user_id'] ?? s['userId'] ?? '';

                    return [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(user.toString(),
                                  style: const TextStyle(
                                      fontWeight: FontWeight.w500)),
                              if (isCurrent == true) ...[
                                const SizedBox(width: 8),
                                const StatusBadge(
                                    status: 'Current',
                                    color: AppColors.kSuccess),
                              ],
                            ],
                          ),
                          Text(email.toString(),
                              style: const TextStyle(
                                  fontSize: 12,
                                  color: AppColors.kTextSecondary)),
                        ],
                      ),
                      Text(ip.toString(),
                          style: const TextStyle(
                              fontFamily: 'monospace', fontSize: 12)),
                      Text(device.toString(),
                          style: const TextStyle(fontSize: 12)),
                      Text(_fmtRelative(lastActive.toString()),
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.kTextSecondary)),
                      Text(_fmtDateTime(loginTime.toString()),
                          style: const TextStyle(
                              fontSize: 12, color: AppColors.kTextSecondary)),
                      if (isCurrent != true && sessionId.toString().isNotEmpty)
                        TextButton.icon(
                          onPressed: () => _terminateSession(
                              context, ref, user.toString(), userId.toString(),
                              sessionId: sessionId.toString()),
                          icon: Icon(PhosphorIcons.x(),
                              size: 16, color: AppColors.kError),
                          label: const Text('Terminate',
                              style: TextStyle(
                                  color: AppColors.kError, fontSize: 12)),
                        )
                      else
                        const Text(''),
                    ];
                  }).toList(),
                  hasActions: true,
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _fmtRelative(String s) {
    if (s.isEmpty || s == '—') return '—';
    try {
      final dt = DateTime.parse(s);
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
      if (diff.inHours < 24) return '${diff.inHours} hour(s) ago';
      return '${diff.inDays} day(s) ago';
    } catch (_) {
      return s;
    }
  }

  String _fmtDateTime(String s) {
    if (s.isEmpty || s == '—') return '—';
    try {
      final dt = DateTime.parse(s);
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return s.length > 16 ? s.substring(11, 16) : s;
    }
  }

  void _terminateSession(
    BuildContext context,
    WidgetRef ref,
    String user,
    String userId, {
    String? sessionId,
  }) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Terminate Session'),
        content: Text('Are you sure you want to terminate $user\'s session?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await ref
                    .read(adminRepositoryProvider)
                    .logoutSession(userId, sessionId: sessionId);
                ref.invalidate(adminActiveSessionsProvider);
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                    context,
                    SnackBar(content: Text('Session terminated for $user')),
                  );
                }
              } catch (e) {
                if (context.mounted) {
                  AppNotifier.showSnackBar(
                    context,
                    SnackBar(content: Text('Error: $e')),
                  );
                }
              }
            },
            child: const Text('Terminate',
                style: TextStyle(color: AppColors.kError)),
          ),
        ],
      ),
    );
  }
}

// ─── Login Policy Tab ─────────────────────────────────────────────────────────

class _LoginPolicyTab extends ConsumerStatefulWidget {
  @override
  ConsumerState<_LoginPolicyTab> createState() => _LoginPolicyTabState();
}

class _LoginPolicyTabState extends ConsumerState<_LoginPolicyTab> {
  bool _twoFa = true;
  bool _failedLockout = true;
  bool _sessionTimeout = true;
  bool _ipWhitelisting = false;
  bool _passwordExpiry = true;
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Login Policy Configuration',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 24),
          Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side:
                  BorderSide(color: AppColors.kDivider.withValues(alpha: 0.5)),
            ),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  _policySwitch(
                      'Two-Factor Authentication',
                      _twoFa,
                      'Require 2FA for admin users',
                      (v) => setState(() => _twoFa = v)),
                  const Divider(height: 32),
                  _policySwitch(
                      'Failed Login Lockout',
                      _failedLockout,
                      'Lock account after 5 failed attempts',
                      (v) => setState(() => _failedLockout = v)),
                  const Divider(height: 32),
                  _policySwitch(
                      'Session Timeout',
                      _sessionTimeout,
                      'Auto logout after 30 minutes of inactivity',
                      (v) => setState(() => _sessionTimeout = v)),
                  const Divider(height: 32),
                  _policySwitch(
                      'IP Whitelisting',
                      _ipWhitelisting,
                      'Restrict access to specific IP ranges',
                      (v) => setState(() => _ipWhitelisting = v)),
                  const Divider(height: 32),
                  _policySwitch(
                      'Password Expiry',
                      _passwordExpiry,
                      'Force password change every 90 days',
                      (v) => setState(() => _passwordExpiry = v)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              const Spacer(),
              OutlinedButton(
                onPressed: () => setState(() {
                  _twoFa = true;
                  _failedLockout = true;
                  _sessionTimeout = true;
                  _ipWhitelisting = false;
                  _passwordExpiry = true;
                }),
                child: const Text('Reset'),
              ),
              const SizedBox(width: 12),
              ElevatedButton(
                onPressed: _saving ? null : _savePolicy,
                child: _saving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Save Policy'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _policySwitch(
      String title, bool value, String subtitle, ValueChanged<bool> onChanged) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(fontWeight: FontWeight.w500)),
              Text(subtitle,
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.kTextSecondary)),
            ],
          ),
        ),
        Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: AppColors.kPrimary),
      ],
    );
  }

  Future<void> _savePolicy() async {
    setState(() => _saving = true);
    try {
      await ref.read(adminRepositoryProvider).updateSystemConfig({
        'security': {
          'two_fa_required': _twoFa,
          'lockout_enabled': _failedLockout,
          'session_timeout_enabled': _sessionTimeout,
          'ip_whitelisting': _ipWhitelisting,
          'password_expiry': _passwordExpiry,
        }
      });
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          const SnackBar(content: Text('Security policy saved')),
        );
      }
    } catch (e) {
      if (mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text('Error saving policy: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

// ─── Suspicious Activity Tab ──────────────────────────────────────────────────

class _SuspiciousActivityTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logsAsync = ref.watch(adminSecurityLogsProvider);

    return logsAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.list),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(adminSecurityLogsProvider),
      ),
      data: (logs) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(adminSecurityLogsProvider),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Suspicious Activity Monitor',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              Text('${logs.length} security event(s)',
                  style: const TextStyle(color: AppColors.kTextSecondary)),
              const SizedBox(height: 20),
              if (logs.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(48),
                    child: Text('No suspicious activity detected',
                        style: TextStyle(color: AppColors.kTextSecondary)),
                  ),
                )
              else
                ...logs.map((log) => _ActivityCard(log: log)),
            ],
          ),
        ),
      ),
    );
  }
}

class _ActivityCard extends ConsumerWidget {
  final dynamic log;
  const _ActivityCard({required this.log});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final severity =
        (log.severity ?? log.action ?? 'info').toString().toLowerCase();
    Color severityColor;
    IconData icon;
    switch (severity) {
      case 'critical':
      case 'error':
      case 'failed':
        severityColor = AppColors.kError;
        icon = PhosphorIcons.warning();
        break;
      case 'high':
      case 'warning':
        severityColor = AppColors.kWarning;
        icon = PhosphorIcons.warning();
        break;
      default:
        severityColor = AppColors.kPrimary;
        icon = PhosphorIcons.info();
    }

    final title = log.action ?? log.message ?? 'Security Event';
    final description = log.details ?? log.description ?? '';
    final ip = log.ipAddress ?? log.ip ?? '—';
    final time = log.createdAt?.toString() ?? '';

    return Card(
      elevation: 0,
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: severityColor.withValues(alpha: 0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: severityColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: severityColor, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(title.toString(),
                          style: TextStyle(
                              fontWeight: FontWeight.w600,
                              color: severityColor)),
                      const SizedBox(width: 12),
                      StatusBadge(
                        status:
                            severity[0].toUpperCase() + severity.substring(1),
                        color: severityColor,
                      ),
                    ],
                  ),
                  if (description.toString().isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(description.toString(),
                        style:
                            const TextStyle(color: AppColors.kTextSecondary)),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      if (time.isNotEmpty)
                        Text(_fmtRelative(time),
                            style: const TextStyle(
                                fontSize: 12, color: AppColors.kTextSecondary)),
                      if (ip.toString() != '—') ...[
                        const SizedBox(width: 16),
                        Text('IP: ${ip.toString()}',
                            style: const TextStyle(
                                fontSize: 12,
                                fontFamily: 'monospace',
                                color: AppColors.kTextSecondary)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            IconButton(
              icon: Icon(PhosphorIcons.magnifyingGlass(),
                  size: 18, color: AppColors.kTextSecondary),
              onPressed: () => AppNotifier.showSnackBar(
                  context,
                  const SnackBar(
                      content:
                          Text('Investigation started — check audit logs'))),
              tooltip: 'Investigate',
            ),
          ],
        ),
      ),
    );
  }

  String _fmtRelative(String s) {
    try {
      final dt = DateTime.parse(s);
      final diff = DateTime.now().difference(dt);
      if (diff.inMinutes < 1) return 'Just now';
      if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
      if (diff.inHours < 24) return '${diff.inHours} hr ago';
      return '${diff.inDays}d ago';
    } catch (_) {
      return s.length > 10 ? s.substring(0, 10) : s;
    }
  }
}

// ─── Behavior Intelligence Tab ────────────────────────────────────────────────

class _BehaviorIntelligenceTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final anomaliesAsync = ref.watch(adminAnomaliesProvider);

    return anomaliesAsync.when(
      loading: () => const LoadingSkeleton(type: SkeletonType.list),
      error: (err, _) => ErrorState(
        message: '$err',
        onRetry: () => ref.invalidate(adminAnomaliesProvider),
      ),
      data: (anomalies) => RefreshIndicator(
        onRefresh: () async => ref.invalidate(adminAnomaliesProvider),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('AI Behavior Intelligence',
                  style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 8),
              const Text('AI-powered anomaly detection and behavior analysis',
                  style: TextStyle(color: AppColors.kTextSecondary)),
              const SizedBox(height: 24),
              if (anomalies.isEmpty)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(48),
                    child: Text('No anomalies detected — normal operations',
                        style: TextStyle(color: AppColors.kTextSecondary)),
                  ),
                )
              else
                LayoutBuilder(
                  builder: (context, constraints) {
                    final crossAxisCount = constraints.maxWidth < 768 ? 1 : 2;
                    return GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: crossAxisCount,
                        crossAxisSpacing: 16,
                        mainAxisSpacing: 16,
                        childAspectRatio: 2.0,
                      ),
                      itemCount: anomalies.length,
                      itemBuilder: (_, i) =>
                          _AnomalyCard(anomaly: anomalies[i]),
                    );
                  },
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AnomalyCard extends StatelessWidget {
  final Map<String, dynamic> anomaly;
  const _AnomalyCard({required this.anomaly});

  @override
  Widget build(BuildContext context) {
    final type = (anomaly['severity'] ?? anomaly['type'] ?? 'info')
        .toString()
        .toLowerCase();
    Color color;
    IconData icon;
    switch (type) {
      case 'critical':
      case 'error':
      case 'high':
        color = AppColors.kError;
        icon = PhosphorIcons.warning();
        break;
      case 'warning':
      case 'medium':
        color = AppColors.kWarning;
        icon = PhosphorIcons.warning();
        break;
      case 'success':
        color = AppColors.kSuccess;
        icon = PhosphorIcons.checkCircle();
        break;
      default:
        color = AppColors.kPrimary;
        icon = PhosphorIcons.info();
    }

    final title = anomaly['title'] ?? anomaly['name'] ?? 'Anomaly';
    final description = anomaly['description'] ?? anomaly['message'] ?? '';
    final confidence = (anomaly['confidence'] ?? anomaly['score'] ?? 0) as num;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color.withValues(alpha: 0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title.toString(),
                      style:
                          TextStyle(fontWeight: FontWeight.w600, color: color)),
                  const SizedBox(height: 4),
                  Expanded(
                    child: Text(
                      description.toString(),
                      style: const TextStyle(
                          fontSize: 12, color: AppColors.kTextSecondary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (confidence > 0)
                    Row(
                      children: [
                        Text(
                          '${confidence.toStringAsFixed(0)}% confidence',
                          style: const TextStyle(
                              fontSize: 11, color: AppColors.kTextSecondary),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 60,
                          child: LinearProgressIndicator(
                            value: confidence / 100,
                            color: color,
                            backgroundColor: color.withValues(alpha: 0.1),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
