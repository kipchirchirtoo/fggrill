import 'package:freezed_annotation/freezed_annotation.dart';
part 'notification.freezed.dart';
part 'notification.g.dart';

@freezed
class AdminNotification with _$AdminNotification {
  const factory AdminNotification({
    @Default('') String id,
    @Default('') String title,
    @Default('') String message,
    @Default('info') String type,
    @Default(false) bool isRead,
    @Default('') String link,
    @DateTimeConverter() DateTime? createdAt,
  }) = _AdminNotification;

  factory AdminNotification.fromJson(Map<String, dynamic> json) =>
      _$AdminNotificationFromJson(json);
}

class DateTimeConverter implements JsonConverter<DateTime?, String?> {
  const DateTimeConverter();

  @override
  DateTime? fromJson(String? json) =>
      json == null ? null : DateTime.tryParse(json);

  @override
  String? toJson(DateTime? object) => object?.toIso8601String();
}
