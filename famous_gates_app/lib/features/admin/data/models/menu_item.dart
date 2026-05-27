import 'package:freezed_annotation/freezed_annotation.dart';
part 'menu_item.freezed.dart';
part 'menu_item.g.dart';

@freezed
class AdminMenuItem with _$AdminMenuItem {
  const factory AdminMenuItem({
    @Default('') String id,
    @Default('') String name,
    @Default('') String category,
    @Default('') String branchId,
    @Default(0.0) double price,
    @Default(0.0) double cost,
    @Default('') String description,
    @Default(true) bool isAvailable,
    @Default('') String imageUrl,
    @Default('menu') String menuType,
    @Default(0) int reorderLevel,
    @Default(0) int stockQuantity,
    @Default(false) bool isLowStock,
  }) = _AdminMenuItem;

  factory AdminMenuItem.fromJson(Map<String, dynamic> json) =>
      _$AdminMenuItemFromJson(json);
}
