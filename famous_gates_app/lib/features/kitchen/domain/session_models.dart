class KitchenShift {
  final String id;
  final String shiftNumber;
  final int branchId;
  final String shiftDate;
  final String shiftType;
  final String? subShiftType;
  final String status;
  final String openedBy;
  final String? closedAt;
  final String? department;

  KitchenShift({
    required this.id,
    required this.shiftNumber,
    required this.branchId,
    required this.shiftDate,
    required this.shiftType,
    this.subShiftType,
    required this.status,
    required this.openedBy,
    this.closedAt,
    this.department,
  });

  factory KitchenShift.fromJson(Map<String, dynamic> json) {
    return KitchenShift(
      id: json['id'] as String,
      shiftNumber: json['shift_number'] as String,
      branchId: json['branch_id'] as int,
      shiftDate: json['shift_date'] as String,
      shiftType: json['shift_type'] as String,
      subShiftType: json['sub_shift_type'] as String?,
      status: json['status'] as String,
      openedBy: json['opened_by'] as String,
      closedAt: json['closed_at'] as String?,
      department: json['department'] as String?,
    );
  }
}

class KitchenShiftItem {
  final String id;
  final String itemSku;
  final String itemName;
  final String unitOfMeasure;
  final double costPrice;
  final double openingStock;
  final double additions;
  final double soldQuantity;
  final double spoilageQuantity;

  KitchenShiftItem({
    required this.id,
    required this.itemSku,
    required this.itemName,
    required this.unitOfMeasure,
    required this.costPrice,
    required this.openingStock,
    required this.additions,
    required this.soldQuantity,
    required this.spoilageQuantity,
  });

  factory KitchenShiftItem.fromJson(Map<String, dynamic> json) {
    return KitchenShiftItem(
      id: json['id'] as String,
      itemSku: json['item_sku'] as String,
      itemName: json['item_name'] as String,
      unitOfMeasure: json['unit_of_measure'] as String,
      costPrice: (json['cost_price'] as num?)?.toDouble() ?? 0.0,
      openingStock: (json['opening_stock'] as num?)?.toDouble() ?? 0.0,
      additions: (json['additions'] as num?)?.toDouble() ?? 0.0,
      soldQuantity: (json['sold_quantity'] as num?)?.toDouble() ?? 0.0,
      spoilageQuantity: (json['spoilage_quantity'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class KitchenProductionRecipe {
  final String id;
  final String recipeName;
  final String producedItemId;
  final String rawItemId;
  final double rawQuantity;
  final String rawUnit;
  final double producedQuantity;
  final String producedUnit;

  KitchenProductionRecipe({
    required this.id,
    required this.recipeName,
    required this.producedItemId,
    required this.rawItemId,
    required this.rawQuantity,
    required this.rawUnit,
    required this.producedQuantity,
    required this.producedUnit,
  });

  factory KitchenProductionRecipe.fromJson(Map<String, dynamic> json) {
    return KitchenProductionRecipe(
      id: json['id'] as String,
      recipeName: json['recipe_name'] as String,
      producedItemId: json['produced_item_id'] as String,
      rawItemId: json['raw_item_id'] as String,
      rawQuantity: (json['raw_quantity'] as num?)?.toDouble() ?? 0.0,
      rawUnit: json['raw_unit'] as String,
      producedQuantity: (json['produced_quantity'] as num?)?.toDouble() ?? 0.0,
      producedUnit: json['produced_unit'] as String,
    );
  }
}

class KitchenShiftAddition {
  final String id;
  final String itemSku;
  final String? itemName;
  final double quantity;
  final String? unit;
  final String foodControlType;
  final String? recipeId;
  final List<String> responsibleStaffIds;
  final String addedAt;
  final String? notes;

  KitchenShiftAddition({
    required this.id,
    required this.itemSku,
    this.itemName,
    required this.quantity,
    this.unit,
    required this.foodControlType,
    this.recipeId,
    required this.responsibleStaffIds,
    required this.addedAt,
    this.notes,
  });

  factory KitchenShiftAddition.fromJson(Map<String, dynamic> json) {
    return KitchenShiftAddition(
      id: json['id'] as String,
      itemSku: json['item_sku'] as String,
      itemName: json['item_name'] as String?,
      quantity: (json['quantity'] as num?)?.toDouble() ?? 0.0,
      unit: json['unit'] as String?,
      foodControlType: json['food_control_type'] as String,
      recipeId: json['recipe_id'] as String?,
      responsibleStaffIds: (json['responsible_staff_ids'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      addedAt: json['added_at'] as String,
      notes: json['notes'] as String?,
    );
  }
}

class KitchenShiftConfig {
  final bool enabled;
  final String? shiftMode;
  final String? reason;

  KitchenShiftConfig({
    required this.enabled,
    this.shiftMode,
    this.reason,
  });

  factory KitchenShiftConfig.fromJson(Map<String, dynamic> json) {
    return KitchenShiftConfig(
      enabled: json['enabled'] as bool? ?? false,
      shiftMode: json['shift_mode'] as String?,
      reason: json['reason'] as String?,
    );
  }
}
