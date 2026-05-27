import 'package:freezed_annotation/freezed_annotation.dart';
part 'guest.freezed.dart';
part 'guest.g.dart';

@freezed
class AdminGuest with _$AdminGuest {
  const factory AdminGuest({
    @Default('') String id,
    @Default('') String name,
    @Default('') String email,
    @Default('') String phone,
    @Default('') String idType,
    @Default('') String idNumber,
    @Default('') String address,
    @Default('') String nationality,
    @Default(0.0) double balance,
    @Default(0) int totalVisits,
    @DateTimeConverter() DateTime? createdAt,
    @Default('') String profilePhoto,
  }) = _AdminGuest;

  factory AdminGuest.fromJson(Map<String, dynamic> json) =>
      _$AdminGuestFromJson(json);
}

class DateTimeConverter implements JsonConverter<DateTime?, String?> {
  const DateTimeConverter();

  @override
  DateTime? fromJson(String? json) =>
      json == null ? null : DateTime.tryParse(json);

  @override
  String? toJson(DateTime? object) => object?.toIso8601String();
}
