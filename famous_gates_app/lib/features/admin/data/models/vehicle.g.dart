// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'vehicle.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AdminVehicleImpl _$$AdminVehicleImplFromJson(Map<String, dynamic> json) =>
    _$AdminVehicleImpl(
      id: json['id'] as String? ?? '',
      registration: json['registration'] as String? ?? '',
      model: json['model'] as String? ?? '',
      make: json['make'] as String? ?? '',
      color: json['color'] as String? ?? '',
      status: json['status'] as String? ?? 'Available',
      driverName: json['driverName'] as String? ?? '',
      driverPhone: json['driverPhone'] as String? ?? '',
      insuranceProvider: json['insuranceProvider'] as String? ?? '',
      insuranceExpiry: const DateTimeConverter()
          .fromJson(json['insuranceExpiry'] as String?),
      lastService:
          const DateTimeConverter().fromJson(json['lastService'] as String?),
      nextService:
          const DateTimeConverter().fromJson(json['nextService'] as String?),
    );

Map<String, dynamic> _$$AdminVehicleImplToJson(_$AdminVehicleImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'registration': instance.registration,
      'model': instance.model,
      'make': instance.make,
      'color': instance.color,
      'status': instance.status,
      'driverName': instance.driverName,
      'driverPhone': instance.driverPhone,
      'insuranceProvider': instance.insuranceProvider,
      'insuranceExpiry':
          const DateTimeConverter().toJson(instance.insuranceExpiry),
      'lastService': const DateTimeConverter().toJson(instance.lastService),
      'nextService': const DateTimeConverter().toJson(instance.nextService),
    };
