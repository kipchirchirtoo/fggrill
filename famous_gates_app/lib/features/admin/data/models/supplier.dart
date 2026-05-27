import 'package:freezed_annotation/freezed_annotation.dart';
part 'supplier.freezed.dart';
part 'supplier.g.dart';

@freezed
class AdminSupplier with _$AdminSupplier {
  const factory AdminSupplier({
    @Default('') String id,
    @Default('') String name,
    @Default('') String contactPerson,
    @Default('') String phone,
    @Default('') String email,
    @Default('') String address,
    @Default('') String paymentTerms,
    @Default('') String bankName,
    @Default('') String bankAccount,
    @Default('') String bankCode,
    @Default(0.0) double balance,
    @Default(0) int itemCount,
    @Default('active') String status,
  }) = _AdminSupplier;

  factory AdminSupplier.fromJson(Map<String, dynamic> json) =>
      _$AdminSupplierFromJson(json);
}
