import 'package:freezed_annotation/freezed_annotation.dart';
part 'system_user.freezed.dart';
part 'system_user.g.dart';

@freezed
class AdminUser with _$AdminUser {
  const factory AdminUser({
    @Default('') String id,
    @Default('') String name,
    @Default('') String email,
    @Default('') String role,
    @Default('') String branchId,
    @Default('') String branchName,
    @Default('') String phone,
    @Default('') String department,
    @Default('') String position,
    @Default(0.0) double salary,
    @Default(true) bool isActive,
    @Default('') String profilePhoto,
    @Default('') String rfidTag,
    @Default('') String posPin,
    @DateTimeConverter() DateTime? createdAt,
    @Default([]) List<String> permissions,
  }) = _AdminUser;

  factory AdminUser.fromJson(Map<String, dynamic> json) =>
      _$AdminUserFromJson(json);
}

class DateTimeConverter implements JsonConverter<DateTime?, String?> {
  const DateTimeConverter();

  @override
  DateTime? fromJson(String? json) =>
      json == null ? null : DateTime.tryParse(json);

  @override
  String? toJson(DateTime? object) => object?.toIso8601String();
}
