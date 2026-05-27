// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'menu_item.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AdminMenuItemImpl _$$AdminMenuItemImplFromJson(Map<String, dynamic> json) =>
    _$AdminMenuItemImpl(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      category: json['category'] as String? ?? '',
      branchId: json['branchId'] as String? ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      cost: (json['cost'] as num?)?.toDouble() ?? 0.0,
      description: json['description'] as String? ?? '',
      isAvailable: json['isAvailable'] as bool? ?? true,
      imageUrl: json['imageUrl'] as String? ?? '',
      menuType: json['menuType'] as String? ?? 'menu',
      reorderLevel: (json['reorderLevel'] as num?)?.toInt() ?? 0,
      stockQuantity: (json['stockQuantity'] as num?)?.toInt() ?? 0,
      isLowStock: json['isLowStock'] as bool? ?? false,
    );

Map<String, dynamic> _$$AdminMenuItemImplToJson(_$AdminMenuItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'category': instance.category,
      'branchId': instance.branchId,
      'price': instance.price,
      'cost': instance.cost,
      'description': instance.description,
      'isAvailable': instance.isAvailable,
      'imageUrl': instance.imageUrl,
      'menuType': instance.menuType,
      'reorderLevel': instance.reorderLevel,
      'stockQuantity': instance.stockQuantity,
      'isLowStock': instance.isLowStock,
    };
