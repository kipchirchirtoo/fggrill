class UserContextAssignment {
  const UserContextAssignment({
    required this.role,
    required this.roleName,
    required this.contextType,
    required this.branchId,
    required this.branchName,
    required this.branchCode,
    required this.warehouseId,
    required this.warehouseName,
    required this.warehouseCode,
    required this.operatingBranchId,
    required this.operatingBranchName,
    required this.isDefault,
    required this.displayName,
  });

  final String role;
  final String roleName;
  final String contextType;
  final String branchId;
  final String branchName;
  final String branchCode;
  final String warehouseId;
  final String warehouseName;
  final String warehouseCode;
  final String operatingBranchId;
  final String operatingBranchName;
  final bool isDefault;
  final String displayName;

  factory UserContextAssignment.fromJson(Map<String, dynamic> json) {
    String clean(Object? value) {
      final text = '${value ?? ''}'.trim();
      return text.toLowerCase() == 'null' ? '' : text;
    }

    return UserContextAssignment(
      role: clean(json['role']),
      roleName: clean(json['role_name']).isNotEmpty
          ? clean(json['role_name'])
          : clean(json['role']),
      contextType: clean(json['context_type']).isNotEmpty
          ? clean(json['context_type'])
          : 'branch',
      branchId: clean(json['branch_id']),
      branchName: clean(json['branch_name']),
      branchCode: clean(json['branch_code']),
      warehouseId: clean(json['warehouse_id']),
      warehouseName: clean(json['warehouse_name']),
      warehouseCode: clean(json['warehouse_code']),
      operatingBranchId: clean(json['operating_branch_id']),
      operatingBranchName: clean(json['operating_branch_name']),
      isDefault: json['is_default'] == true,
      displayName: clean(json['display_name']),
    );
  }

  bool get isWarehouse => contextType == 'warehouse';
}

class User {
  const User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.primaryRole = '',
    required this.branchId,
    required this.branchName,
    this.roles = const [],
    this.contextType = 'branch',
    this.warehouseId = '',
    this.warehouseName = '',
    this.availableContexts = const [],
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
  final String primaryRole;
  final String branchId;
  final String branchName;

  /// All roles this account holds (e.g. a staff member who is both a cashier
  /// and a restaurant waiter). Always includes [role]. Used for routing so the
  /// user can reach any dashboard they're entitled to.
  final List<String> roles;
  final String contextType;
  final String warehouseId;
  final String warehouseName;
  final List<UserContextAssignment> availableContexts;

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
    final activeContext = json['active_context'] is Map
        ? Map<String, dynamic>.from(json['active_context'] as Map)
        : const <String, dynamic>{};
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
    final effectiveRole =
        '${activeContext['role'] ?? json['active_role'] ?? primaryRole}';
    final availableContexts =
        (json['available_contexts'] is List
                ? json['available_contexts'] as List
                : <dynamic>[])
            .whereType<Map>()
            .map<UserContextAssignment>((item) =>
                UserContextAssignment.fromJson(Map<String, dynamic>.from(item)))
            .toList();
    return User(
      id: '${json['id']}',
      name: '${json['name'] ?? json['full_name'] ?? fullName}',
      email: '${json['email'] ?? ''}',
      role: effectiveRole,
      primaryRole: '${json['primary_role'] ?? primaryRole}',
      roles: _parseRoles(json['all_roles'] ?? json['roles'], primaryRole),
      branchId:
          branchIdLower == 'null' || branchIdLower == 'nan' ? '' : branchId,
      branchName:
          '${json['branch_name'] ?? json['branchName'] ?? (branch is Map ? branch['name'] : '')}',
      contextType:
          '${activeContext['context_type'] ?? json['active_context_type'] ?? 'branch'}',
      warehouseId:
          _nullableString(activeContext['warehouse_id'] ?? json['warehouse_id']) ??
              '',
      warehouseName: _nullableString(
              activeContext['warehouse_name'] ?? json['warehouse_name']) ??
          '',
      availableContexts: availableContexts,
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

  bool get hasMultipleContexts => availableContexts.length > 1;
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
