// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AdminUserImpl _$$AdminUserImplFromJson(Map<String, dynamic> json) =>
    _$AdminUserImpl(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      role: json['role'] as String? ?? '',
      branchId: json['branchId'] as String? ?? '',
      branchName: json['branchName'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      department: json['department'] as String? ?? '',
      position: json['position'] as String? ?? '',
      salary: (json['salary'] as num?)?.toDouble() ?? 0.0,
      isActive: json['isActive'] as bool? ?? true,
      profilePhoto: json['profilePhoto'] as String? ?? '',
      rfidTag: json['rfidTag'] as String? ?? '',
      posPin: json['posPin'] as String? ?? '',
      createdAt:
          const DateTimeConverter().fromJson(json['createdAt'] as String?),
      permissions: (json['permissions'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$AdminUserImplToJson(_$AdminUserImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'email': instance.email,
      'role': instance.role,
      'branchId': instance.branchId,
      'branchName': instance.branchName,
      'phone': instance.phone,
      'department': instance.department,
      'position': instance.position,
      'salary': instance.salary,
      'isActive': instance.isActive,
      'profilePhoto': instance.profilePhoto,
      'rfidTag': instance.rfidTag,
      'posPin': instance.posPin,
      'createdAt': const DateTimeConverter().toJson(instance.createdAt),
      'permissions': instance.permissions,
    };
