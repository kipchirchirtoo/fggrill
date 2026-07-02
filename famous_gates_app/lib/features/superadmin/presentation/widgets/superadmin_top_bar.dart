import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import 'package:famous_gates_app/core/widgets/app_notifier.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../features/auth/domain/auth_notifier.dart';
import '../../domain/superadmin_providers.dart';

// Valid phosphor icons for this file
final _menuIcon = PhosphorIcons.listBullets();
final _userIcon = PhosphorIcons.user();
final _settingsIcon = PhosphorIcons.treeStructure();
final _logoutIcon = PhosphorIcons.signOut();

class SuperAdminTopBar extends ConsumerWidget {
  final VoidCallback? onMenuTap;

  const SuperAdminTopBar({
    super.key,
    this.onMenuTap,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final impersonationSession = ref.watch(impersonationSessionProvider);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (impersonationSession != null)
          Container(
            width: double.infinity,
            color: Colors.orange.shade700,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
            child: Row(
              children: [
                const Icon(Icons.warning_amber_rounded,
                    color: Colors.white, size: 16),
                const SizedBox(width: 8),
                Text(
                  'IMPERSONATING: ${impersonationSession['impersonated_user']?['email'] ?? 'Unknown User'} (${impersonationSession['impersonated_user']?['role'] ?? ''})',
                  style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 13),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () async {
                    final session = ref.read(impersonationSessionProvider);
                    final sessionId = session?['session_id']?.toString();
                    if (sessionId != null) {
                      await ref
                          .read(superadminGodRepositoryProvider)
                          .endImpersonation(sessionId);
                    }
                    ref.read(impersonationSessionProvider.notifier).state =
                        null;
                  },
                  child: const Text('End Session',
                      style: TextStyle(
                          color: Colors.white, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border(
              bottom: BorderSide(color: Colors.grey.shade200),
            ),
          ),
          child: Row(
            children: [
              if (onMenuTap != null)
                IconButton(
                  onPressed: onMenuTap,
                  icon: Icon(_menuIcon, color: Colors.grey.shade700),
                ),
              if (onMenuTap != null) const SizedBox(width: 16),

              // Breadcrumb
              Row(
                children: [
                  Text(
                    'SuperAdmin',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey.shade500,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Icon(
                      Icons.chevron_right,
                      size: 14,
                      color: Colors.grey.shade400,
                    ),
                  ),
                  Text(
                    'Dashboard',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.grey.shade700,
                    ),
                  ),
                ],
              ),

              const Spacer(),

              // Actions — wrap search in Flexible so it shrinks before overflowing
              Flexible(
                child: ConstrainedBox(
                  constraints:
                      const BoxConstraints(maxWidth: 280, minWidth: 80),
                  child: _buildSearchField(),
                ),
              ),
              const SizedBox(width: 16),
              _buildNotificationButton(context),
              const SizedBox(width: 16),
              _buildProfileMenu(context, ref),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _handleLogout(WidgetRef ref) async {
    await ref.read(authNotifierProvider.notifier).logout();
  }

  Widget _buildSearchField() {
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: TextField(
        decoration: InputDecoration(
          hintText: 'Search...',
          hintStyle: TextStyle(
            fontSize: 14,
            color: Colors.grey.shade400,
          ),
          prefixIcon: Icon(
            PhosphorIcons.magnifyingGlass(),
            size: 18,
            color: Colors.grey.shade400,
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 12,
          ),
        ),
      ),
    );
  }

  Widget _buildNotificationButton(BuildContext context) {
    return Stack(
      children: [
        IconButton(
          onPressed: () => AppNotifier.showSnackBar(
              context, const SnackBar(content: Text('No new notifications'))),
          icon: Icon(
            PhosphorIcons.bell(),
            color: Colors.grey.shade700,
          ),
        ),
        Positioned(
          right: 8,
          top: 8,
          child: Container(
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: Color(0xFFef4444),
              shape: BoxShape.circle,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProfileMenu(BuildContext context, WidgetRef ref) {
    return PopupMenuButton<String>(
      offset: const Offset(0, 40),
      onSelected: (value) {
        if (value == 'logout') {
          _handleLogout(ref);
        } else if (value == 'profile') {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Profile settings coming soon')),
          );
        } else if (value == 'settings') {
          ref.read(superAdminSectionProvider.notifier).state =
              SuperAdminSection.settings;
        }
      },
      child: Builder(builder: (context) {
        final user = ref.watch(authNotifierProvider).valueOrNull;
        final displayName = user?.name ?? 'Super Admin';
        final displayEmail = user?.email ?? '';
        final initials =
            displayName.isNotEmpty ? displayName[0].toUpperCase() : 'S';
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade200),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: AppColors.kPrimary.withValues(alpha: 0.1),
                child: Text(
                  initials,
                  style: const TextStyle(
                    color: AppColors.kPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 130),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      displayName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      displayEmail,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey.shade500,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(
                Icons.expand_more,
                size: 16,
                color: Colors.grey.shade500,
              ),
            ],
          ),
        );
      }),
      itemBuilder: (context) => [
        PopupMenuItem(
          value: 'profile',
          child: Row(
            children: [
              Icon(_userIcon),
              const SizedBox(width: 12),
              const Text('Profile'),
            ],
          ),
        ),
        PopupMenuItem(
          value: 'settings',
          child: Row(
            children: [
              Icon(_settingsIcon),
              const SizedBox(width: 12),
              const Text('Settings'),
            ],
          ),
        ),
        const PopupMenuDivider(),
        PopupMenuItem(
          value: 'logout',
          child: Row(
            children: [
              Icon(_logoutIcon, color: const Color(0xFFef4444)),
              const SizedBox(width: 12),
              const Text('Logout', style: TextStyle(color: Color(0xFFef4444))),
            ],
          ),
        ),
      ],
    );
  }
}
