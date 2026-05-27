import 'package:freezed_annotation/freezed_annotation.dart';
part 'audit_log.freezed.dart';
part 'audit_log.g.dart';

@freezed
class AdminAuditLog with _$AdminAuditLog {
  const factory AdminAuditLog({
    @Default('') String id,
    @Default('') String action,
    @Default('') String category,
    @Default('') String description,
    @Default('info') String severity,
    @Default('') String userName,
    @Default('') String email,
    @Default('') String branchName,
    @Default('') String ipAddress,
    @Default('') String userAgent,
    @DateTimeConverter() DateTime? createdAt,
  }) = _AdminAuditLog;

  factory AdminAuditLog.fromJson(Map<String, dynamic> json) =>
      _$AdminAuditLogFromJson(json);
}

class DateTimeConverter implements JsonConverter<DateTime?, String?> {
  const DateTimeConverter();

  @override
  DateTime? fromJson(String? json) =>
      json == null ? null : DateTime.tryParse(json);

  @override
  String? toJson(DateTime? object) => object?.toIso8601String();
}
