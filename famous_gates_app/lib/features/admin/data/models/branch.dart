import 'package:freezed_annotation/freezed_annotation.dart';
part 'branch.freezed.dart';
part 'branch.g.dart';

@freezed
class AdminBranch with _$AdminBranch {
  const factory AdminBranch({
    @Default('') String id,
    @Default('') String name,
    @Default('') String code,
    @Default('') String address,
    @Default('') String city,
    @Default('active') String status,
    @Default('') String phone,
    @Default('') String email,
    @Default(0) int roomCount,
    @Default(0) int staffCount,
    @Default(0) double monthlyRevenue,
    @DateTimeConverter() DateTime? createdAt,
  }) = _AdminBranch;

  factory AdminBranch.fromJson(Map<String, dynamic> json) =>
      _$AdminBranchFromJson(json);
}

class DateTimeConverter implements JsonConverter<DateTime?, String?> {
  const DateTimeConverter();

  @override
  DateTime? fromJson(String? json) =>
      json == null ? null : DateTime.tryParse(json);

  @override
  String? toJson(DateTime? object) => object?.toIso8601String();
}
