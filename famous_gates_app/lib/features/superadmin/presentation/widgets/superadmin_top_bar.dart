import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:phosphor_flutter/phosphor_flutter.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../features/auth/domain/auth_notifier.dart';

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
    return Container(
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
          if (onMenuTap != null)
            const SizedBox(width: 16),
          
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
          
          // Actions
          _buildSearchField(),
          const SizedBox(width: 16),
          _buildNotificationButton(),
          const SizedBox(width: 16),
          _buildProfileMenu(context, ref),
        ],
      ),
    );
  }

  Future<void> _handleLogout(WidgetRef ref) async {
    await ref.read(authNotifierProvider.notifier).logout();
  }

  Widget _buildSearchField() {
    return Container(
      width: 280,
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

  Widget _buildNotificationButton() {
    return Stack(
      children: [
        IconButton(
          onPressed: () {},
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
          Navigator.of(context).pop();
          _handleLogout(ref);
        }
      },
      child: Container(
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
                'S',
                style: TextStyle(
                  color: AppColors.kPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Super Admin',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(
                  'superadmin@famousgates.com',
                  style: TextStyle(
                    fontSize: 11,
                    color: Colors.grey.shade500,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 8),
            Icon(
              Icons.expand_more,
              size: 16,
              color: Colors.grey.shade500,
            ),
          ],
        ),
      ),
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
