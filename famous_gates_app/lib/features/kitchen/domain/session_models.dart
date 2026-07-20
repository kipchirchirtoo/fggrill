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
  final List<String> assignedChefIds;
  final List<String> assignedDispenseIds;

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
    this.assignedChefIds = const [],
    this.assignedDispenseIds = const [],
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
      assignedChefIds: (json['assigned_chef_ids'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      assignedDispenseIds: (json['assigned_dispense_ids'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
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
  final String purposeChannel;
  final String? referenceId;
  final String? wastageReason;

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
    required this.purposeChannel,
    this.referenceId,
    this.wastageReason,
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
      purposeChannel: json['purpose_channel'] as String? ?? 'pos_restaurant',
      referenceId: json['reference_id'] as String?,
      wastageReason: json['wastage_reason'] as String?,
    );
  }
}

class KitchenShiftConfig {
  final bool enabled;
  final String? shiftMode;
  final String? reason;
  final bool openingStocktakeRequired;
  final bool openingStocktakeReady;
  final String? openingStocktakeShift;
  final String? openingStocktakeStatus;
  final String? openingStocktakeMessage;

  KitchenShiftConfig({
    required this.enabled,
    this.shiftMode,
    this.reason,
    this.openingStocktakeRequired = false,
    this.openingStocktakeReady = false,
    this.openingStocktakeShift,
    this.openingStocktakeStatus,
    this.openingStocktakeMessage,
  });

  static bool _readBool(dynamic value) {
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) {
      final normalized = value.trim().toLowerCase();
      return normalized == 'true' ||
          normalized == '1' ||
          normalized == 'yes' ||
          normalized == 'y';
    }
    return false;
  }

  factory KitchenShiftConfig.fromJson(Map<String, dynamic> json) {
    return KitchenShiftConfig(
      enabled: _readBool(json['enabled']),
      shiftMode: json['shift_mode'] as String?,
      reason: json['reason'] as String?,
      openingStocktakeRequired: _readBool(json['opening_stocktake_required']),
      openingStocktakeReady: _readBool(json['opening_stocktake_ready']),
      openingStocktakeShift: json['opening_stocktake_shift'] as String?,
      openingStocktakeStatus: json['opening_stocktake_status'] as String?,
      openingStocktakeMessage: json['opening_stocktake_message'] as String?,
    );
  }
}

class KitchenPrepBatch {
  final String id;
  final String shiftId;
  final String recipeId;
  final String rawItemSku;
  final String rawItemName;
  final double rawQuantitySent;
  final String rawUnit;
  final String producedItemName;
  final String? producedItemSku;
  final String? producedInventoryItemId;
  final String producedUnit;
  final double? returnedQuantity;
  final String? returnedUnit;
  final double? processLossQuantity;
  final String? processLossUnit;
  final double? wastageQuantity;
  final String? wastageUnit;
  final String? wastageReason;
  final double? unexplainedVarianceQuantity;
  final String? unexplainedVarianceUnit;
  final String status;
  final List<String> assignedStaffIds;
  final String? sentNotes;
  final String? returnNotes;
  final String sentAt;
  final String? returnedAt;

  KitchenPrepBatch({
    required this.id,
    required this.shiftId,
    required this.recipeId,
    required this.rawItemSku,
    required this.rawItemName,
    required this.rawQuantitySent,
    required this.rawUnit,
    required this.producedItemName,
    this.producedItemSku,
    this.producedInventoryItemId,
    required this.producedUnit,
    this.returnedQuantity,
    this.returnedUnit,
    this.processLossQuantity,
    this.processLossUnit,
    this.wastageQuantity,
    this.wastageUnit,
    this.wastageReason,
    this.unexplainedVarianceQuantity,
    this.unexplainedVarianceUnit,
    required this.status,
    this.assignedStaffIds = const [],
    this.sentNotes,
    this.returnNotes,
    required this.sentAt,
    this.returnedAt,
  });

  factory KitchenPrepBatch.fromJson(Map<String, dynamic> json) {
    return KitchenPrepBatch(
      id: json['id'] as String,
      shiftId: json['shift_id'] as String,
      recipeId: json['recipe_id'] as String,
      rawItemSku: json['raw_item_sku'] as String? ?? '',
      rawItemName: json['raw_item_name'] as String? ?? '',
      rawQuantitySent: (json['raw_quantity_sent'] as num?)?.toDouble() ?? 0.0,
      rawUnit: json['raw_unit'] as String? ?? '',
      producedItemName: json['produced_item_name'] as String? ?? '',
      producedItemSku: json['produced_item_sku'] as String?,
      producedInventoryItemId: json['produced_inventory_item_id'] as String?,
      producedUnit: json['produced_unit'] as String? ?? '',
      returnedQuantity: (json['returned_quantity'] as num?)?.toDouble(),
      returnedUnit: json['returned_unit'] as String?,
      processLossQuantity: (json['process_loss_quantity'] as num?)?.toDouble(),
      processLossUnit: json['process_loss_unit'] as String?,
      wastageQuantity: (json['wastage_quantity'] as num?)?.toDouble(),
      wastageUnit: json['wastage_unit'] as String?,
      wastageReason: json['wastage_reason'] as String?,
      unexplainedVarianceQuantity:
          (json['unexplained_variance_quantity'] as num?)?.toDouble(),
      unexplainedVarianceUnit: json['unexplained_variance_unit'] as String?,
      status: json['status'] as String? ?? 'sent',
      assignedStaffIds: (json['assigned_staff_ids'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          const [],
      sentNotes: json['sent_notes'] as String?,
      returnNotes: json['return_notes'] as String?,
      sentAt: json['sent_at'] as String? ?? '',
      returnedAt: json['returned_at'] as String?,
    );
  }
}
