import 'package:freezed_annotation/freezed_annotation.dart';
part 'vehicle.freezed.dart';
part 'vehicle.g.dart';

@freezed
class AdminVehicle with _$AdminVehicle {
  const factory AdminVehicle({
    @Default('') String id,
    @Default('') String registration,
    @Default('') String model,
    @Default('') String make,
    @Default('') String color,
    @Default('Available') String status,
    @Default('') String driverName,
    @Default('') String driverPhone,
    @Default('') String insuranceProvider,
    @DateTimeConverter() DateTime? insuranceExpiry,
    @DateTimeConverter() DateTime? lastService,
    @DateTimeConverter() DateTime? nextService,
  }) = _AdminVehicle;

  factory AdminVehicle.fromJson(Map<String, dynamic> json) =>
      _$AdminVehicleFromJson(json);
}

class DateTimeConverter implements JsonConverter<DateTime?, String?> {
  const DateTimeConverter();

  @override
  DateTime? fromJson(String? json) =>
      json == null ? null : DateTime.tryParse(json);

  @override
  String? toJson(DateTime? object) => object?.toIso8601String();
}
