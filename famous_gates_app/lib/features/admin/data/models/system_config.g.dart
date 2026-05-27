// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_config.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemConfigImpl _$$SystemConfigImplFromJson(Map<String, dynamic> json) =>
    _$SystemConfigImpl(
      vatRate: (json['vatRate'] as num?)?.toDouble() ?? 16.0,
      currency: json['currency'] as String? ?? 'KES',
      timezone: json['timezone'] as String? ?? 'Africa/Nairobi',
      logoUrl: json['logoUrl'] as String? ?? '',
      hotelName: json['hotelName'] as String? ?? '',
      address: json['address'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String? ?? '',
      isLicenseValid: json['isLicenseValid'] as bool? ?? false,
      licenseExpiry:
          const DateTimeConverter().fromJson(json['licenseExpiry'] as String?),
      licenseKey: json['licenseKey'] as String? ?? '',
      appVersion: json['appVersion'] as String? ?? '',
    );

Map<String, dynamic> _$$SystemConfigImplToJson(_$SystemConfigImpl instance) =>
    <String, dynamic>{
      'vatRate': instance.vatRate,
      'currency': instance.currency,
      'timezone': instance.timezone,
      'logoUrl': instance.logoUrl,
      'hotelName': instance.hotelName,
      'address': instance.address,
      'phone': instance.phone,
      'email': instance.email,
      'isLicenseValid': instance.isLicenseValid,
      'licenseExpiry': const DateTimeConverter().toJson(instance.licenseExpiry),
      'licenseKey': instance.licenseKey,
      'appVersion': instance.appVersion,
    };
