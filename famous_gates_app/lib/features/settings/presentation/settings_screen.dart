import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:go_router/go_router.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/api_error_message.dart';
import '../../../core/widgets/safe_avatar.dart';
import '../../auth/domain/auth_notifier.dart';
import '../../auth/domain/models.dart';
import '../../auth/domain/role_routes.dart';
import '../../auth/data/auth_repository.dart';

const _storage = FlutterSecureStorage();
const _appVersion = 'v3.9.9.75 (Famous Gates)';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Settings'),
        backgroundColor: AppColors.kPrimary,
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (user != null) _UserProfileCard(user: user),
            const SizedBox(height: 32),
            _SettingsGroup(
              title: 'Account',
              items: [
                _SettingsItem(
                  icon: PhosphorIcons.user(),
                  label: 'Profile',
                  onTap: () => _showProfile(context, ref, user),
                ),
                _SettingsItem(
                  icon: PhosphorIcons.users(),
                  label: 'Switch Role Context',
                  onTap: () => _showRoleSwitcher(context, ref, user),
                ),
                _SettingsItem(
                  icon: PhosphorIcons.lock(),
                  label: 'Change Password',
                  onTap: () => _showChangePassword(context, ref),
                ),
                _SettingsItem(
                  icon: PhosphorIcons.lockKey(),
                  label: 'Change Lock PIN',
                  onTap: () => _showChangeLockPin(context, ref),
                ),
                _SettingsItem(
                  icon: PhosphorIcons.bell(),
                  label: 'Notifications',
                  onTap: () => _showNotifications(context, ref),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _SettingsGroup(
              title: 'System',
              items: [
                _SettingsItem(
                  icon: PhosphorIcons.palette(),
                  label: 'Theme',
                  onTap: () => _showTheme(context),
                ),
                _SettingsItem(
                  icon: PhosphorIcons.globe(),
                  label: 'Language',
                  onTap: () => _showLanguage(context),
                ),
                _SettingsItem(
                  icon: PhosphorIcons.printer(),
                  label: 'Printer Configuration',
                  onTap: () => _showPrinterConfig(context),
                ),
              ],
            ),
            const SizedBox(height: 24),
            _SettingsGroup(
              title: 'About',
              items: [
                _SettingsItem(
                  icon: PhosphorIcons.info(),
                  label: 'Version',
                  trailing: const Text(
                    _appVersion,
                    style: TextStyle(color: AppColors.kTextSecondary),
                  ),
                ),
                _SettingsItem(
                  icon: PhosphorIcons.fileText(),
                  label: 'Terms of Service',
                  onTap: () => _showTerms(context),
                ),
                _SettingsItem(
                  icon: PhosphorIcons.shield(),
                  label: 'Privacy Policy',
                  onTap: () => _showPrivacyPolicy(context),
                ),
              ],
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: () => _logout(context, ref),
                icon: const Icon(Icons.logout, color: AppColors.kError),
                label: const Text('Logout',
                    style: TextStyle(color: AppColors.kError)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.kError),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _logout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Logout?'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: const Text('Cancel')),
          ElevatedButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: const Text('Logout')),
        ],
      ),
    );
    if (confirmed == true && context.mounted) {
      await ref.read(authNotifierProvider.notifier).logout();
      if (context.mounted) context.go('/terminal');
    }
  }

  void _showProfile(BuildContext context, WidgetRef ref, User? user) {
    if (user == null) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Profile'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _avatarWidget(user.avatar, user.name, radius: 40),
            const SizedBox(height: 16),
            Text(user.name,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text(user.email,
                style: const TextStyle(color: AppColors.kTextSecondary)),
            const SizedBox(height: 8),
            _profileRow('Role', user.role),
            _profileRow('Branch', user.branchName),
            _profileRow('Branch ID', user.branchId),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Close')),
        ],
      ),
    );
  }

  void _showChangePassword(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => _ChangePasswordDialog(ref: ref),
    );
  }

  void _showChangeLockPin(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => const _ChangePinDialog(),
    );
  }

  void _showNotifications(BuildContext context, WidgetRef ref) {
    bool orderUpdates = true;
    bool bookingAlerts = true;
    bool staffNotifications = false;
    bool systemUpdates = true;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: const Text('Notification Preferences'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SwitchListTile(
                title: const Text('Order Updates'),
                subtitle: const Text('Alerts for new and updated orders'),
                value: orderUpdates,
                onChanged: (v) => setS(() => orderUpdates = v),
              ),
              SwitchListTile(
                title: const Text('Booking Alerts'),
                subtitle: const Text('New reservations and check-ins'),
                value: bookingAlerts,
                onChanged: (v) => setS(() => bookingAlerts = v),
              ),
              SwitchListTile(
                title: const Text('Staff Notifications'),
                subtitle: const Text('Shift changes and HR updates'),
                value: staffNotifications,
                onChanged: (v) => setS(() => staffNotifications = v),
              ),
              SwitchListTile(
                title: const Text('System Updates'),
                subtitle: const Text('Maintenance and system alerts'),
                value: systemUpdates,
                onChanged: (v) => setS(() => systemUpdates = v),
              ),
            ],
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                Navigator.of(ctx).pop();
                try {
                  final enabled = <String>[];
                  if (orderUpdates) enabled.add('order_updates');
                  if (bookingAlerts) enabled.add('booking_alerts');
                  if (staffNotifications) enabled.add('staff_notifications');
                  if (systemUpdates) enabled.add('system_updates');
                  await ref
                      .read(dioProvider)
                      .put('/notifications/preferences', data: {
                    'types': enabled,
                  });
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                      context,
                      const SnackBar(
                        content: Text('Notification preferences saved'),
                        backgroundColor: AppColors.kSuccess,
                      ),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    AppNotifier.showSnackBar(
                      context,
                      SnackBar(
                        content: Text(
                            'Error saving preferences: ${_extractError(e)}'),
                        backgroundColor: AppColors.kError,
                      ),
                    );
                  }
                }
              },
              child: const Text('Save Preferences'),
            ),
          ],
        ),
      ),
    );
  }

  void _showTheme(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) {
        String selected = 'light';
        return StatefulBuilder(
          builder: (ctx, setS) => AlertDialog(
            title: const Text('App Theme'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.light_mode),
                  title: const Text('Light'),
                  trailing:
                      selected == 'light' ? const Icon(Icons.check) : null,
                  onTap: () => setS(() => selected = 'light'),
                ),
                ListTile(
                  leading: const Icon(Icons.dark_mode),
                  title: const Text('Dark'),
                  trailing: selected == 'dark' ? const Icon(Icons.check) : null,
                  onTap: () => setS(() => selected = 'dark'),
                ),
              ],
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Cancel')),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).pop();
                  AppNotifier.showSnackBar(
                    context,
                    const SnackBar(
                        content: Text('Theme switching coming soon')),
                  );
                },
                child: const Text('Apply'),
              ),
            ],
          ),
        );
      },
    );
  }

  void _showLanguage(BuildContext context) {
    const languages = ['English', 'Swahili', 'French'];
    String selected = 'English';

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setS) => AlertDialog(
          title: const Text('Select Language'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: languages
                .map((lang) => ListTile(
                      title: Text(lang),
                      trailing:
                          selected == lang ? const Icon(Icons.check) : null,
                      onTap: () => setS(() => selected = lang),
                    ))
                .toList(),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                AppNotifier.showSnackBar(
                  context,
                  SnackBar(
                    content: Text(
                        'Language set to $selected. Restart app to apply.'),
                    backgroundColor: AppColors.kSuccess,
                  ),
                );
              },
              child: const Text('Apply'),
            ),
          ],
        ),
      ),
    );
  }

  void _showPrinterConfig(BuildContext context) async {
    final existingIp = await _storage.read(key: 'fg_printer_ip') ?? '';
    final existingPort = await _storage.read(key: 'fg_printer_port') ?? '9100';
    final ipCtrl = TextEditingController(text: existingIp);
    final portCtrl = TextEditingController(text: existingPort);

    if (!context.mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Printer Configuration'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Configure the network printer for receipt printing.',
              style: TextStyle(color: AppColors.kTextSecondary, fontSize: 13),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: ipCtrl,
              keyboardType: TextInputType.text,
              decoration: const InputDecoration(
                labelText: 'Printer IP Address',
                hintText: 'e.g. 192.168.1.100',
                prefixIcon: Icon(Icons.print),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: portCtrl,
              keyboardType: TextInputType.number,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              decoration: const InputDecoration(
                labelText: 'Printer Port',
                hintText: '9100',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              await _storage.write(
                  key: 'fg_printer_ip', value: ipCtrl.text.trim());
              await _storage.write(
                  key: 'fg_printer_port',
                  value: portCtrl.text.trim().isEmpty
                      ? '9100'
                      : portCtrl.text.trim());
              if (ctx.mounted) Navigator.of(ctx).pop();
              if (context.mounted) {
                AppNotifier.showSnackBar(
                  context,
                  const SnackBar(
                    content: Text('Printer configuration saved'),
                    backgroundColor: AppColors.kSuccess,
                  ),
                );
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showTerms(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.8,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        expand: false,
        builder: (ctx, scrollCtrl) => Column(
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.kDivider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 24),
              child: Text(
                'Terms of Service',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
            ),
            const Divider(),
            Expanded(
              child: SingleChildScrollView(
                controller: scrollCtrl,
                padding: const EdgeInsets.all(24),
                child: const Text(
                  '''1. Acceptance of Terms

By accessing and using the Famous Gates Hotel Management System ("the System"), you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. This System is intended solely for authorized personnel of Famous Gates Hotel and its affiliated branches. Unauthorized access, disclosure, or misuse of the System constitutes a violation of these terms and may result in disciplinary action and/or legal proceedings.

2. User Responsibilities and Conduct

All registered users are responsible for maintaining the confidentiality of their login credentials and PIN codes. You agree not to share your access credentials with any unauthorized parties. Any transactions, records, or modifications made under your user account are your sole responsibility. Users must report any suspected unauthorized access or security breach to the system administrator immediately. Misuse of the System for personal gain, data theft, or unauthorized modifications is strictly prohibited and may result in termination of employment and prosecution.

3. Data Accuracy and Record Keeping

Users are obligated to ensure the accuracy and completeness of all data entered into the System, including but not limited to sales transactions, inventory records, staff information, guest details, and financial reports. Famous Gates Hotel reserves the right to audit all records maintained in the System and to take corrective measures where discrepancies are found. Deliberate falsification of records is a serious violation of these Terms and applicable Kenyan laws.

4. Limitation of Liability and Amendments

Famous Gates Hotel provides this System "as is" and makes no warranties regarding its availability or fitness for a specific purpose. The hotel shall not be liable for any data loss resulting from technical failures, provided reasonable backup procedures are in place. These Terms of Service may be amended at any time at the discretion of Famous Gates Hotel management, and continued use of the System following any amendments constitutes acceptance of the revised Terms. For inquiries regarding these Terms, contact the System Administrator or management at the registered address of Famous Gates Hotel.''',
                  style: TextStyle(
                      fontSize: 14, height: 1.6, color: AppColors.kTextPrimary),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Close'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showPrivacyPolicy(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.8,
        minChildSize: 0.4,
        maxChildSize: 0.95,
        expand: false,
        builder: (ctx, scrollCtrl) => Column(
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.kDivider,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 24),
              child: Text(
                'Privacy Policy',
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
            ),
            const Divider(),
            Expanded(
              child: SingleChildScrollView(
                controller: scrollCtrl,
                padding: const EdgeInsets.all(24),
                child: const Text(
                  '''1. Information We Collect

The Famous Gates Hotel Management System collects and processes personal information necessary for hotel operations. This includes staff personal details (name, national ID, contact information, bank details for payroll), guest information (name, contact details, identification documents, stay preferences), transaction records, attendance logs, and operational data generated through normal system use. All data collected is strictly limited to what is necessary for legitimate hotel management purposes.

2. How We Use Your Information

Information collected through this System is used exclusively for hotel operations, including but not limited to: processing payments and payroll, managing reservations and guest services, generating operational reports, maintaining accurate inventory records, and ensuring security and compliance. Staff data is used for HR management, performance tracking, and regulatory compliance with Kenyan labor laws including NHIF, NSSF, and PAYE obligations. Guest data is used to provide personalized hospitality services and to comply with legal requirements including guest registration regulations.

3. Data Storage and Security

All data is stored on secured servers with industry-standard encryption. Access to data is restricted to authorized personnel based on their assigned roles within the System. We implement technical and organizational measures to protect your information against unauthorized access, loss, or disclosure. Regular security audits are conducted to ensure the integrity and confidentiality of all data. Data is retained for the duration required by Kenyan tax and employment regulations, typically a minimum of 7 years for financial records.

4. Your Rights and Contact Information

Staff members have the right to access their personal data held in the System, request corrections to inaccurate information, and inquire about how their data is being processed. Guests may request information about the data held about them in compliance with applicable privacy regulations. To exercise these rights or for any privacy-related concerns, please contact the System Administrator or the Human Resources department. Famous Gates Hotel is committed to handling all personal information responsibly and in accordance with the Kenya Data Protection Act and any applicable regulations.''',
                  style: TextStyle(
                      fontSize: 14, height: 1.6, color: AppColors.kTextPrimary),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('Close'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _profileRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  color: AppColors.kTextSecondary, fontSize: 13)),
          Text(value,
              style:
                  const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        ],
      ),
    );
  }

  void _showRoleSwitcher(
      BuildContext context, WidgetRef ref, User? user) async {
    if (user == null) return;

    try {
      final availableRoles = await ref
          .read(authNotifierProvider.notifier)
          .fetchAvailableContexts(user.id);

      if (availableRoles.isEmpty) {
        if (context.mounted) {
          AppNotifier.showSnackBar(
            context,
            const SnackBar(content: Text('No additional roles available')),
          );
        }
        return;
      }

      if (context.mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            title: const Text('Switch Role Context'),
            content: SizedBox(
              width: 400,
              child: ListView.builder(
                shrinkWrap: true,
                itemCount: availableRoles.length,
                itemBuilder: (_, i) {
                  final role = availableRoles[i];
                  final roleName = role.roleName;
                  final isActive = user.role == role.role &&
                      user.contextType == role.contextType &&
                      user.branchId == role.branchId &&
                      user.warehouseId == role.warehouseId;
                  return ListTile(
                    leading: Icon(
                      isActive
                          ? Icons.check_circle
                          : Icons.radio_button_unchecked,
                      color: isActive
                          ? AppColors.kSuccess
                          : AppColors.kTextSecondary,
                    ),
                    title: Text(
                        roleName.toString().replaceAll('_', ' ').toUpperCase()),
                    subtitle: Text(
                      role.displayName.isNotEmpty
                          ? role.displayName
                          : (role.branchName.isNotEmpty
                              ? role.branchName
                              : role.warehouseName),
                    ),
                    onTap: isActive
                        ? null
                        : () async {
                            Navigator.pop(ctx);
                            try {
                              final switchedUser = await ref
                                  .read(authNotifierProvider.notifier)
                                  .switchContext(role);
                              if (context.mounted) {
                                AppNotifier.showSnackBar(
                                  context,
                                  SnackBar(
                                      content: Text('Switched to $roleName')),
                                );
                                final route = getUserHomeRoute(switchedUser);
                                context.go(route);
                              }
                            } catch (e) {
                              if (context.mounted) {
                                AppNotifier.showSnackBar(
                                  context,
                                  SnackBar(
                                      content:
                                          Text('Error switching role: $e')),
                                );
                              }
                            }
                          },
                  );
                },
              ),
            ),
            actions: [
              TextButton(
                  onPressed: () => Navigator.pop(ctx),
                  child: const Text('Cancel')),
            ],
          ),
        );
      }
    } catch (e) {
      if (context.mounted) {
        AppNotifier.showSnackBar(
          context,
          SnackBar(content: Text('Error fetching roles: $e')),
        );
      }
    }
  }

  String _extractError(Object e) {
    final s = e.toString();
    if (s.contains('message')) {
      final match = RegExp(r'"message"\s*:\s*"([^"]+)"').firstMatch(s);
      if (match != null) return match.group(1) ?? s;
    }
    return s.length > 80 ? '${s.substring(0, 80)}...' : s;
  }
}

class _UserProfileCard extends ConsumerWidget {
  const _UserProfileCard({required this.user});
  final User user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            _avatarWidget(user.avatar, user.name, radius: 30),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(user.name,
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 2),
                  Text(user.email,
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 12)),
                  const SizedBox(height: 2),
                  Text('${user.role}  •  ${user.branchName}',
                      style: const TextStyle(
                          color: AppColors.kTextSecondary, fontSize: 11)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Widget _avatarWidget(String? avatar, String name, {double radius = 24}) {
  return SafeAvatar(imageUrl: avatar, name: name, radius: radius);
}

class _SettingsGroup extends StatelessWidget {
  final String title;
  final List<Widget> items;
  const _SettingsGroup({required this.title, required this.items});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(title,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: AppColors.kTextSecondary,
                letterSpacing: 1,
              )),
        ),
        Card(child: Column(children: items)),
      ],
    );
  }
}

class _SettingsItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Widget? trailing;
  const _SettingsItem(
      {required this.icon, required this.label, this.onTap, this.trailing});

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Icon(icon, color: AppColors.kPrimary, size: 22),
      title: Text(label),
      trailing: trailing ??
          (onTap != null
              ? const Icon(Icons.chevron_right, color: AppColors.kTextSecondary)
              : null),
      onTap: onTap,
    );
  }
}

class _ChangePasswordDialog extends StatefulWidget {
  final WidgetRef ref;
  const _ChangePasswordDialog({required this.ref});

  @override
  State<_ChangePasswordDialog> createState() => _ChangePasswordDialogState();
}

class _ChangePasswordDialogState extends State<_ChangePasswordDialog> {
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  String? _errorMsg;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _errorMsg = null; });
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.ref.read(dioProvider).put('/auth/updatepassword', data: {
        'currentPassword': _currentCtrl.text,
        'newPassword': _newCtrl.text,
      });
      if (mounted) Navigator.of(context).pop();
      messenger.showSnackBar(const SnackBar(
        content: Text('Password changed successfully'),
        backgroundColor: AppColors.kSuccess,
      ));
    } catch (e) {
      final msg = e.toString();
      String display = 'Failed to change password';
      final match = RegExp(r'"message"\s*:\s*"([^"]+)"').firstMatch(msg);
      if (match != null) display = match.group(1) ?? display;
      if (mounted) setState(() => _errorMsg = display);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Change Password'),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_errorMsg != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.kError.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(_errorMsg!,
                    style: const TextStyle(color: AppColors.kError, fontSize: 13)),
              ),
              const SizedBox(height: 12),
            ],
            TextFormField(
              controller: _currentCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Current Password'),
              validator: (v) => (v == null || v.isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _newCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'New Password'),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Required';
                if (v.length < 8) return 'Minimum 8 characters';
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _confirmCtrl,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Confirm New Password'),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Required';
                if (v != _newCtrl.text) return 'Passwords do not match';
                return null;
              },
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _loading ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _loading ? null : _submit,
          child: _loading
              ? const SizedBox(width: 18, height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : const Text('Update Password'),
        ),
      ],
    );
  }
}

class _ChangePinDialog extends ConsumerStatefulWidget {
  const _ChangePinDialog();

  @override
  ConsumerState<_ChangePinDialog> createState() => _ChangePinDialogState();
}

class _ChangePinDialogState extends ConsumerState<_ChangePinDialog> {
  final _currentPinCtrl = TextEditingController();
  final _newPinCtrl = TextEditingController();
  final _confirmPinCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _loading = false;
  String? _errorMsg;

  @override
  void dispose() {
    _currentPinCtrl.dispose();
    _newPinCtrl.dispose();
    _confirmPinCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _loading = true;
      _errorMsg = null;
    });
    try {
      final stored = await _storage.read(key: 'fg_lock_pin') ?? '';
      final currentPinNormalized = _currentPinCtrl.text.trim().toUpperCase();
      final newPinNormalized = _newPinCtrl.text.trim().toUpperCase();

      if (stored.isNotEmpty && stored.trim().toUpperCase() != currentPinNormalized) {
        if (mounted) setState(() => _errorMsg = 'Current PIN is incorrect');
        return;
      }
      
      // Update PIN on backend
      await ref.read(authRepositoryProvider).updatePosPin(currentPinNormalized, newPinNormalized);
      
      // Update locally
      await _storage.write(key: 'fg_lock_pin', value: newPinNormalized);
      if (mounted) {
        Navigator.of(context).pop();
        AppNotifier.showSnackBar(
          context,
          const SnackBar(
            content: Text('Screen lock PIN updated successfully'),
            backgroundColor: AppColors.kSuccess,
          ),
        );
      }
    } catch (e) {
      // Surface the backend message cleanly — e.g. "POS PIN is already assigned
      // to another user" when the chosen PIN is taken — so the staff member
      // picks a different one instead of seeing a raw exception dump.
      if (mounted) {
        setState(() =>
            _errorMsg = apiErrorMessage(e, fallback: 'Failed to update PIN'));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Change Lock PIN'),
      content: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_errorMsg != null) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.kError.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _errorMsg!,
                  style: const TextStyle(color: AppColors.kError, fontSize: 13),
                ),
              ),
              const SizedBox(height: 12),
            ],
            TextFormField(
              controller: _currentPinCtrl,
              obscureText: true,
              keyboardType: TextInputType.text,
              maxLength: 5,
              decoration: const InputDecoration(
                labelText: 'Current PIN *',
                counterText: '',
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Required';
                final upper = v.trim().toUpperCase();
                if (upper.length != 5 || !RegExp(r'^[RMNCE]\d{4}$').hasMatch(upper)) {
                  return 'Must start with R, M, N, C, or E followed by 4 digits';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _newPinCtrl,
              obscureText: true,
              keyboardType: TextInputType.text,
              maxLength: 5,
              decoration: const InputDecoration(
                labelText: 'New PIN *',
                counterText: '',
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Required';
                final upper = v.trim().toUpperCase();
                if (upper.length != 5 || !RegExp(r'^[RMNCE]\d{4}$').hasMatch(upper)) {
                  return 'Must start with R, M, N, C, or E followed by 4 digits';
                }
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _confirmPinCtrl,
              obscureText: true,
              keyboardType: TextInputType.text,
              maxLength: 5,
              decoration: const InputDecoration(
                labelText: 'Confirm New PIN *',
                counterText: '',
              ),
              validator: (v) {
                if (v == null || v.isEmpty) return 'Required';
                if (v.trim().toUpperCase() != _newPinCtrl.text.trim().toUpperCase()) {
                  return 'PINs do not match';
                }
                return null;
              },
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _loading ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _loading ? null : _submit,
          child: _loading
              ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white),
                )
              : const Text('Update PIN'),
        ),
      ],
    );
  }
}
