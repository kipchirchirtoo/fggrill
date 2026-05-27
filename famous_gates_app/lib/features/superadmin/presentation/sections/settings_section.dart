import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';

// Valid phosphor icons
final _cloudArrowUpIcon = PhosphorIcons.fileText();
final _codeIcon = PhosphorIcons.treeStructure();
const _caretRightIcon = Icons.chevron_right;

class SuperAdminSettingsSection extends ConsumerWidget {
  const SuperAdminSettingsSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
      },
      {
        'title': 'Payment Gateways',
        'description': 'Stripe, Paystack, and M-Pesa integration settings',
        'icon': PhosphorIcons.creditCard(),
        'color': const Color(0xFF10b981),
      },
      {
        'title': 'Security Policies',
        'description': 'Password strength, session timeout, and MFA settings',
        'icon': PhosphorIcons.shield(),
        'color': const Color(0xFFef4444),
      },
      {
        'title': 'Backup & Restore',
        'description': 'Automated backup schedules and data recovery options',
        'icon': _cloudArrowUpIcon,
        'color': const Color(0xFF8b5cf6),
      },
      {
        'title': 'API Configuration',
        'description': 'API keys, rate limits, and webhook settings',
        'icon': _codeIcon,
        'color': const Color(0xFFf59e0b),
      },
      {
        'title': 'System Maintenance',
        'description': 'Maintenance mode, cache clearing, and system updates',
        'icon': PhosphorIcons.treeStructure(),
        'color': const Color(0xFF6b7280),
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
          onTap: () => _showSettingsDetails(
            context,
            title: setting['title'] as String,
            description: setting['description'] as String,
          ),
        );
      }).toList(),
    );
  }

  void _showSettingsDetails(
    BuildContext context, {
    required String title,
    required String description,
  }) {
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(
          '$description\n\nThese settings are controlled by backend environment variables and protected administration endpoints. Update the deployed configuration or use the dedicated security/API panels where available.',
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
