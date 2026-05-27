// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'room.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AdminRoomImpl _$$AdminRoomImplFromJson(Map<String, dynamic> json) =>
    _$AdminRoomImpl(
      id: json['id'] as String? ?? '',
      roomNumber: json['roomNumber'] as String? ?? '',
      type: json['type'] as String? ?? '',
      branchId: json['branchId'] as String? ?? '',
      branchName: json['branchName'] as String? ?? '',
      floor: (json['floor'] as num?)?.toInt() ?? 0,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      status: json['status'] as String? ?? 'available',
      description: json['description'] as String? ?? '',
      amenities: (json['amenities'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      capacity: (json['capacity'] as num?)?.toInt() ?? 2,
      isSmoking: json['isSmoking'] as bool? ?? false,
    );

Map<String, dynamic> _$$AdminRoomImplToJson(_$AdminRoomImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'roomNumber': instance.roomNumber,
      'type': instance.type,
      'branchId': instance.branchId,
      'branchName': instance.branchName,
      'floor': instance.floor,
      'price': instance.price,
      'status': instance.status,
      'description': instance.description,
      'amenities': instance.amenities,
      'capacity': instance.capacity,
      'isSmoking': instance.isSmoking,
    };
