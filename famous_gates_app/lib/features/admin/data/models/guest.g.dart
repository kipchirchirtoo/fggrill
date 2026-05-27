// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'guest.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AdminGuestImpl _$$AdminGuestImplFromJson(Map<String, dynamic> json) =>
    _$AdminGuestImpl(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      idType: json['idType'] as String? ?? '',
      idNumber: json['idNumber'] as String? ?? '',
      address: json['address'] as String? ?? '',
      nationality: json['nationality'] as String? ?? '',
      balance: (json['balance'] as num?)?.toDouble() ?? 0.0,
      totalVisits: (json['totalVisits'] as num?)?.toInt() ?? 0,
      createdAt:
          const DateTimeConverter().fromJson(json['createdAt'] as String?),
      profilePhoto: json['profilePhoto'] as String? ?? '',
    );

Map<String, dynamic> _$$AdminGuestImplToJson(_$AdminGuestImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'email': instance.email,
      'phone': instance.phone,
      'idType': instance.idType,
      'idNumber': instance.idNumber,
      'address': instance.address,
      'nationality': instance.nationality,
      'balance': instance.balance,
      'totalVisits': instance.totalVisits,
      'createdAt': const DateTimeConverter().toJson(instance.createdAt),
      'profilePhoto': instance.profilePhoto,
    };
