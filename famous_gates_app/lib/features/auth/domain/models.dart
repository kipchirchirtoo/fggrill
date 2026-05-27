class User {
  const User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.branchId,
    required this.branchName,
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
    return User(
      id: '${json['id']}',
      name: '${json['name'] ?? json['full_name'] ?? fullName}',
      email: '${json['email'] ?? ''}',
      role: '${json['role'] ?? ''}',
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
