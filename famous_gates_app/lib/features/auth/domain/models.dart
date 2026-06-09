class User {
  const User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.branchId,
    required this.branchName,
    this.roles = const [],
    this.avatar,
    this.outletId,
    this.outletType,
    this.outletPrefix,
    this.activeShiftId,
  });

  final String id;
  final String name;
  final String email;
  final String role;
  final String branchId;
  final String branchName;

  /// All roles this account holds (e.g. a staff member who is both a cashier
  /// and a restaurant waiter). Always includes [role]. Used for routing so the
  /// user can reach any dashboard they're entitled to.
  final List<String> roles;

  final String? avatar;
  final String? outletId;
  final String? outletType;
  final String? outletPrefix;
  final String? activeShiftId;

  factory User.fromJson(Map<String, dynamic> json) {
    final firstName = '${json['first_name'] ?? ''}'.trim();
    final lastName = '${json['last_name'] ?? ''}'.trim();
    final fullName = '$firstName $lastName'.trim();
    final branch = json['branches'] ?? json['branch'];
    final rawBranchId = json['branch_id'] ?? json['branchId'];
    final branchId = rawBranchId == null ? '' : '$rawBranchId'.trim();
    final branchIdLower = branchId.toLowerCase();
    final outlet = json['outlet'];
    final outletMap = outlet is Map ? outlet : const <String, dynamic>{};
    final rawOutletId =
        json['active_outlet_id'] ?? json['outlet_id'] ?? outletMap['id'];
    final rawOutletType = json['active_outlet_type'] ??
        json['outlet_type'] ??
        outletMap['outlet_type'];
    final rawOutletPrefix = json['active_outlet_prefix'] ??
        json['outlet_prefix'] ??
        outletMap['pin_prefix'];
    final rawActiveShiftId = json['active_shift_id'] ?? json['activeShiftId'];
    final primaryRole = '${json['role'] ?? ''}';
    return User(
      id: '${json['id']}',
      name: '${json['name'] ?? json['full_name'] ?? fullName}',
      email: '${json['email'] ?? ''}',
      role: primaryRole,
      roles: _parseRoles(json['all_roles'] ?? json['roles'], primaryRole),
      branchId:
          branchIdLower == 'null' || branchIdLower == 'nan' ? '' : branchId,
      branchName:
          '${json['branch_name'] ?? json['branchName'] ?? (branch is Map ? branch['name'] : '')}',
      avatar: json['avatar'] as String?,
      outletId: _nullableString(rawOutletId),
      outletType: _nullableString(rawOutletType),
      outletPrefix: _nullableString(rawOutletPrefix),
      activeShiftId: _nullableString(rawActiveShiftId),
    );
  }

  static String? _nullableString(Object? value) {
    final text = '${value ?? ''}'.trim();
    if (text.isEmpty || text.toLowerCase() == 'null') return null;
    return text;
  }

  /// Parse the backend `all_roles` array (list of {role, branch_id, ...}) or a
  /// plain CSV/list of role strings, always including [primaryRole].
  static List<String> _parseRoles(Object? raw, String primaryRole) {
    final result = <String>{};
    if (primaryRole.trim().isNotEmpty) result.add(primaryRole.trim());
    if (raw is List) {
      for (final entry in raw) {
        if (entry is Map) {
          final r = '${entry['role'] ?? ''}'.trim();
          if (r.isNotEmpty && r.toLowerCase() != 'null') result.add(r);
        } else {
          final r = '$entry'.trim();
          if (r.isNotEmpty && r.toLowerCase() != 'null') result.add(r);
        }
      }
    } else if (raw is String && raw.trim().isNotEmpty) {
      for (final r in raw.split(',')) {
        final t = r.trim();
        if (t.isNotEmpty && t.toLowerCase() != 'null') result.add(t);
      }
    }
    return result.toList();
  }

  bool hasRole(String role) => roles.contains(role) || this.role == role;
}

class AuthTokens {
  const AuthTokens({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;
}

class LicenseInfo {
  const LicenseInfo({
    required this.branchName,
    required this.branchId,
    required this.expiryDate,
    required this.isValid,
  });

  final String branchName;
  final String branchId;
  final String expiryDate;
  final bool isValid;

  factory LicenseInfo.fromJson(Map<String, dynamic> json) {
    final branchId = '${json['branch_id'] ?? json['branchId'] ?? ''}'.trim();
    final branchIdLower = branchId.toLowerCase();
    return LicenseInfo(
      branchName: '${json['branch_name'] ?? json['branchName'] ?? ''}',
      branchId:
          branchIdLower == 'null' || branchIdLower == 'nan' ? '' : branchId,
      expiryDate: '${json['expiry_date'] ?? json['expiryDate'] ?? ''}',
      isValid: json['is_valid'] == true || json['isValid'] == true,
    );
  }
}
