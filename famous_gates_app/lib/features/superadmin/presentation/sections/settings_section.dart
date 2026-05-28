import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../domain/superadmin_providers.dart';

// Valid phosphor icons
final _cloudArrowUpIcon = PhosphorIcons.fileText();
final _codeIcon = PhosphorIcons.treeStructure();
const _caretRightIcon = Icons.chevron_right;

class SuperAdminSettingsSection extends ConsumerStatefulWidget {
  const SuperAdminSettingsSection({super.key});

  @override
  ConsumerState<SuperAdminSettingsSection> createState() =>
      _SuperAdminSettingsSectionState();
}

class _SuperAdminSettingsSectionState
    extends ConsumerState<SuperAdminSettingsSection> {
  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 24),
          _buildSettingsGrid(context),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'SuperAdmin Settings',
          style: TextStyle(
            fontSize: 28,
            fontWeight: FontWeight.bold,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Configure system-wide settings and security policies',
          style: TextStyle(
            fontSize: 14,
            color: Colors.grey.shade500,
          ),
        ),
      ],
    );
  }

  Widget _buildSettingsGrid(BuildContext context) {
    final settings = [
      {
        'title': 'Email Configuration',
        'description':
            'SMTP settings, email templates, and notification preferences',
        'icon': PhosphorIcons.paperPlaneTilt(),
        'color': const Color(0xFF3b82f6),
        'onTap': () => _showEnvManagedDialog(context, 'Email Configuration'),
      },
      {
        'title': 'Payment Gateways',
        'description': 'Stripe, Paystack, and M-Pesa integration settings',
        'icon': PhosphorIcons.creditCard(),
        'color': const Color(0xFF10b981),
        'onTap': () => _showEnvManagedDialog(context, 'Payment Gateways'),
      },
      {
        'title': 'Security Policies',
        'description': 'Password strength, session timeout, and MFA settings',
        'icon': PhosphorIcons.shield(),
        'color': const Color(0xFFef4444),
        'onTap': () => _showSecurityPoliciesDialog(context),
      },
      {
        'title': 'Backup & Restore',
        'description': 'Automated backup schedules and data recovery options',
        'icon': _cloudArrowUpIcon,
        'color': const Color(0xFF8b5cf6),
        'onTap': () => _showEnvManagedDialog(context, 'Backup & Restore'),
      },
      {
        'title': 'API Configuration',
        'description': 'API keys, rate limits, and webhook settings',
        'icon': _codeIcon,
        'color': const Color(0xFFf59e0b),
        'onTap': () => _showEnvManagedDialog(context, 'API Configuration'),
      },
      {
        'title': 'System Maintenance',
        'description': 'Maintenance mode, cache clearing, and system updates',
        'icon': PhosphorIcons.treeStructure(),
        'color': const Color(0xFF6b7280),
        'onTap': () => _showMaintenanceDialog(context),
      },
    ];

    return Wrap(
      spacing: 24,
      runSpacing: 24,
      children: settings.map((setting) {
        return _buildSettingsCard(
          title: setting['title'] as String,
          description: setting['description'] as String,
          icon: setting['icon'] as IconData,
          color: setting['color'] as Color,
          onTap: setting['onTap'] as VoidCallback,
        );
      }).toList(),
    );
  }

  // ── Env-managed dialog for Email, Payment, Backup, API ──────────────────────

  void _showEnvManagedDialog(BuildContext context, String title) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(PhosphorIcons.info(),
                    color: Colors.blue.shade600, size: 20),
                const SizedBox(width: 8),
                const Expanded(
                  child: Text(
                    'Configuration managed via Environment Variables.',
                    style: TextStyle(fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text(
              'Contact DevOps to update.',
              style: TextStyle(fontSize: 14, color: Colors.black87),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  // ── Security Policies dialog ─────────────────────────────────────────────────

  void _showSecurityPoliciesDialog(BuildContext context) {
    final configAsync = ref.read(godSecurityConfigProvider.future);

    showDialog<void>(
      context: context,
      builder: (ctx) => _SecurityPoliciesDialog(
        configFuture: configAsync,
        onSave: (fields) async {
          await ref
              .read(superadminGodRepositoryProvider)
              .updateSecurityConfig(fields);
        },
      ),
    );
  }

  // ── System Maintenance dialog ────────────────────────────────────────────────

  void _showMaintenanceDialog(BuildContext context) {
    showDialog<void>(
      context: context,
      builder: (ctx) => _MaintenanceDialog(
        onSave: (enabled, message, justification) async {
          await ref
              .read(superadminGodRepositoryProvider)
              .toggleMaintenanceMode(enabled,
                  message: message, justification: justification);
        },
      ),
    );
  }

  Widget _buildSettingsCard({
    required String title,
    required String description,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return SizedBox(
      width: 400,
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: color, size: 28),
                ),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        description,
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey.shade500,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  _caretRightIcon,
                  color: Colors.grey.shade400,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Security Policies Dialog ───────────────────────────────────────────────────

class _SecurityPoliciesDialog extends StatefulWidget {
  final Future<Map<String, dynamic>> configFuture;
  final Future<void> Function(Map<String, dynamic> fields) onSave;

  const _SecurityPoliciesDialog({
    required this.configFuture,
    required this.onSave,
  });

  @override
  State<_SecurityPoliciesDialog> createState() =>
      _SecurityPoliciesDialogState();
}

class _SecurityPoliciesDialogState extends State<_SecurityPoliciesDialog> {
  final _formKey = GlobalKey<FormState>();
  final _sessionTimeoutCtrl = TextEditingController();
  final _maxFailedAttemptsCtrl = TextEditingController();
  final _lockoutDurationCtrl = TextEditingController();
  final _justificationCtrl = TextEditingController();
  bool _require2fa = false;
  bool _loading = true;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    widget.configFuture.then((config) {
      if (!mounted) return;
      setState(() {
        _sessionTimeoutCtrl.text =
            (config['session_timeout_minutes'] ?? 60).toString();
        _maxFailedAttemptsCtrl.text =
            (config['max_failed_attempts'] ?? 5).toString();
        _lockoutDurationCtrl.text =
            (config['lockout_duration_minutes'] ?? 30).toString();
        _require2fa = config['require_2fa_for_admin'] == true;
        _loading = false;
      });
    }).catchError((e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    });
  }

  @override
  void dispose() {
    _sessionTimeoutCtrl.dispose();
    _maxFailedAttemptsCtrl.dispose();
    _lockoutDurationCtrl.dispose();
    _justificationCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await widget.onSave({
        'session_timeout_minutes':
            int.parse(_sessionTimeoutCtrl.text.trim()),
        'max_failed_attempts': int.parse(_maxFailedAttemptsCtrl.text.trim()),
        'lockout_duration_minutes':
            int.parse(_lockoutDurationCtrl.text.trim()),
        'require_2fa_for_admin': _require2fa,
        'justification': _justificationCtrl.text.trim(),
      });
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Security policies updated successfully.'),
          backgroundColor: Color(0xFF10b981),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: const Color(0xFFef4444),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Security Policies'),
      content: SizedBox(
        width: 460,
        child: _loading
            ? const SizedBox(
                height: 120,
                child: Center(child: CircularProgressIndicator()),
              )
            : _error != null
                ? Text('Failed to load config: $_error')
                : Form(
                    key: _formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _intField(
                          controller: _sessionTimeoutCtrl,
                          label: 'Session Timeout (minutes)',
                        ),
                        const SizedBox(height: 16),
                        _intField(
                          controller: _maxFailedAttemptsCtrl,
                          label: 'Max Failed Login Attempts',
                        ),
                        const SizedBox(height: 16),
                        _intField(
                          controller: _lockoutDurationCtrl,
                          label: 'Lockout Duration (minutes)',
                        ),
                        const SizedBox(height: 16),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: const Text('Require 2FA for Admin'),
                          value: _require2fa,
                          onChanged: (v) => setState(() => _require2fa = v),
                        ),
                        const SizedBox(height: 16),
                        TextFormField(
                          controller: _justificationCtrl,
                          decoration: const InputDecoration(
                            labelText: 'Justification (required)',
                            border: OutlineInputBorder(),
                          ),
                          maxLines: 2,
                          validator: (v) =>
                              (v == null || v.trim().isEmpty)
                                  ? 'Justification is required'
                                  : null,
                        ),
                      ],
                    ),
                  ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        if (!_loading && _error == null)
          FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Save'),
          ),
      ],
    );
  }

  Widget _intField({
    required TextEditingController controller,
    required String label,
  }) {
    return TextFormField(
      controller: controller,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      keyboardType: TextInputType.number,
      validator: (v) {
        if (v == null || v.trim().isEmpty) return 'Required';
        if (int.tryParse(v.trim()) == null) return 'Must be a whole number';
        return null;
      },
    );
  }
}

// ── System Maintenance Dialog ──────────────────────────────────────────────────

class _MaintenanceDialog extends StatefulWidget {
  final Future<void> Function(
      bool enabled, String? message, String justification) onSave;

  const _MaintenanceDialog({required this.onSave});

  @override
  State<_MaintenanceDialog> createState() => _MaintenanceDialogState();
}

class _MaintenanceDialogState extends State<_MaintenanceDialog> {
  final _formKey = GlobalKey<FormState>();
  final _messageCtrl = TextEditingController();
  final _justificationCtrl = TextEditingController();
  bool _maintenanceEnabled = false;
  bool _saving = false;

  @override
  void dispose() {
    _messageCtrl.dispose();
    _justificationCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final message = _messageCtrl.text.trim();
      await widget.onSave(
        _maintenanceEnabled,
        message.isEmpty ? null : message,
        _justificationCtrl.text.trim(),
      );
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            _maintenanceEnabled
                ? 'Maintenance mode enabled.'
                : 'Maintenance mode disabled.',
          ),
          backgroundColor: const Color(0xFF10b981),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: $e'),
          backgroundColor: const Color(0xFFef4444),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('System Maintenance'),
      content: SizedBox(
        width: 460,
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Enable Maintenance Mode'),
                subtitle: Text(
                  _maintenanceEnabled
                      ? 'System will be inaccessible to regular users.'
                      : 'System is running normally.',
                  style: TextStyle(
                    fontSize: 12,
                    color: _maintenanceEnabled
                        ? Colors.orange.shade700
                        : Colors.grey.shade500,
                  ),
                ),
                value: _maintenanceEnabled,
                onChanged: (v) => setState(() => _maintenanceEnabled = v),
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _messageCtrl,
                decoration: const InputDecoration(
                  labelText: 'Maintenance Message (optional)',
                  hintText: 'e.g. System upgrade in progress. Back at 3 PM.',
                  border: OutlineInputBorder(),
                ),
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _justificationCtrl,
                decoration: const InputDecoration(
                  labelText: 'Justification (required)',
                  border: OutlineInputBorder(),
                ),
                maxLines: 2,
                validator: (v) =>
                    (v == null || v.trim().isEmpty)
                        ? 'Justification is required'
                        : null,
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: _saving ? null : () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _saving ? null : _save,
          style: _maintenanceEnabled
              ? FilledButton.styleFrom(
                  backgroundColor: Colors.orange.shade700)
              : null,
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : Text(_maintenanceEnabled
                  ? 'Enable Maintenance'
                  : 'Disable Maintenance'),
        ),
      ],
    );
  }
}
