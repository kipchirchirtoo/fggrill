import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../features/auth/domain/auth_notifier.dart';
import '../config/permissions.dart';
import '../config/user_roles.dart';

/// Widget that conditionally shows its child based on user permissions
class PermissionGuard extends ConsumerWidget {
  final Permission permission;
  final Widget child;
  final Widget? fallback;

  const PermissionGuard({
    super.key,
    required this.permission,
    required this.child,
    this.fallback,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    if (user == null) return const SizedBox.shrink();

    final userRole = UserRole.fromString(user.role);
    final hasPermission = RolePermissions.hasPermission(userRole, permission);
    return hasPermission ? child : (fallback ?? const SizedBox.shrink());
  }
}

/// Widget that conditionally shows its child based on ANY of the required permissions
class AnyPermissionGuard extends ConsumerWidget {
  final Set<Permission> permissions;
  final Widget child;
  final Widget? fallback;

  const AnyPermissionGuard({
    super.key,
    required this.permissions,
    required this.child,
    this.fallback,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    if (user == null) return const SizedBox.shrink();

    final userRole = UserRole.fromString(user.role);
    final hasPermission =
        RolePermissions.hasAnyPermission(userRole, permissions);
    return hasPermission ? child : (fallback ?? const SizedBox.shrink());
  }
}

/// Widget that conditionally shows its child based on ALL required permissions
class AllPermissionsGuard extends ConsumerWidget {
  final Set<Permission> permissions;
  final Widget child;
  final Widget? fallback;

  const AllPermissionsGuard({
    super.key,
    required this.permissions,
    required this.child,
    this.fallback,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authNotifierProvider).valueOrNull;
    if (user == null) return const SizedBox.shrink();

    final userRole = UserRole.fromString(user.role);
    final hasPermission =
        RolePermissions.hasAllPermissions(userRole, permissions);
    return hasPermission ? child : (fallback ?? const SizedBox.shrink());
  }
}

/// Helper extension to check permissions in build methods
extension PermissionContext on WidgetRef {
  bool hasPermission(Permission permission) {
    final user = read(authNotifierProvider).valueOrNull;
    if (user == null) return false;
    final userRole = UserRole.fromString(user.role);
    return RolePermissions.hasPermission(userRole, permission);
  }

  bool hasAnyPermission(Set<Permission> permissions) {
    final user = read(authNotifierProvider).valueOrNull;
    if (user == null) return false;
    final userRole = UserRole.fromString(user.role);
    return RolePermissions.hasAnyPermission(userRole, permissions);
  }

  bool hasAllPermissions(Set<Permission> permissions) {
    final user = read(authNotifierProvider).valueOrNull;
    if (user == null) return false;
    final userRole = UserRole.fromString(user.role);
    return RolePermissions.hasAllPermissions(userRole, permissions);
  }
}
