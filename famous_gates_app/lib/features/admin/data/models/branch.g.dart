// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'branch.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AdminBranchImpl _$$AdminBranchImplFromJson(Map<String, dynamic> json) =>
    _$AdminBranchImpl(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      code: json['code'] as String? ?? '',
      address: json['address'] as String? ?? '',
      city: json['city'] as String? ?? '',
      status: json['status'] as String? ?? 'active',
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String? ?? '',
      roomCount: (json['roomCount'] as num?)?.toInt() ?? 0,
      staffCount: (json['staffCount'] as num?)?.toInt() ?? 0,
      monthlyRevenue: (json['monthlyRevenue'] as num?)?.toDouble() ?? 0,
      createdAt:
          const DateTimeConverter().fromJson(json['createdAt'] as String?),
    );

Map<String, dynamic> _$$AdminBranchImplToJson(_$AdminBranchImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'code': instance.code,
      'address': instance.address,
      'city': instance.city,
      'status': instance.status,
      'phone': instance.phone,
      'email': instance.email,
      'roomCount': instance.roomCount,
      'staffCount': instance.staffCount,
      'monthlyRevenue': instance.monthlyRevenue,
      'createdAt': const DateTimeConverter().toJson(instance.createdAt),
    };
