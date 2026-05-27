import 'package:freezed_annotation/freezed_annotation.dart';
part 'system_config.freezed.dart';
part 'system_config.g.dart';

@freezed
class SystemConfig with _$SystemConfig {
  const factory SystemConfig({
    @Default(16.0) double vatRate,
    @Default('KES') String currency,
    @Default('Africa/Nairobi') String timezone,
    @Default('') String logoUrl,
    @Default('') String hotelName,
    @Default('') String address,
    @Default('') String phone,
    @Default('') String email,
    @Default(false) bool isLicenseValid,
    @DateTimeConverter() DateTime? licenseExpiry,
    @Default('') String licenseKey,
    @Default('') String appVersion,
  }) = _SystemConfig;

  factory SystemConfig.fromJson(Map<String, dynamic> json) =>
      _$SystemConfigFromJson(json);
}

class DateTimeConverter implements JsonConverter<DateTime?, String?> {
  const DateTimeConverter();

  @override
  DateTime? fromJson(String? json) =>
      json == null ? null : DateTime.tryParse(json);

  @override
  String? toJson(DateTime? object) => object?.toIso8601String();
}
