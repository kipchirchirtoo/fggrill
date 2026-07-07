import 'package:flutter_test/flutter_test.dart';
import 'package:famous_gates_app/features/kitchen/domain/session_models.dart';

void main() {
  group('Kitchen Sessions Unit Tests', () {
    test('KitchenShiftItem model serialization and parsing', () {
      final json = {
        'id': 'test-id-123',
        'item_sku': 'SKU-001',
        'item_name': 'Test Item',
        'unit_of_measure': 'kg',
        'cost_price': 150.0,
        'opening_stock': 10.0,
        'additions': 5.0,
        'sold_quantity': 2.0,
        'spoilage_quantity': 1.0,
      };

      final item = KitchenShiftItem.fromJson(json);

      expect(item.id, 'test-id-123');
      expect(item.itemSku, 'SKU-001');
      expect(item.itemName, 'Test Item');
      expect(item.unitOfMeasure, 'kg');
      expect(item.costPrice, 150.0);
      expect(item.openingStock, 10.0);
      expect(item.additions, 5.0);
      expect(item.soldQuantity, 2.0);
      expect(item.spoilageQuantity, 1.0);
    });

    test('KitchenShift model serialization and parsing', () {
      final json = {
        'id': 'shift-uuid',
        'shift_number': 'KS-001',
        'branch_id': 1,
        'shift_date': '2026-07-06',
        'shift_type': 'shift_a',
        'sub_shift_type': 'A',
        'status': 'open',
        'opened_by': 'user-uuid',
        'department': 'KITCHEN',
      };

      final shift = KitchenShift.fromJson(json);

      expect(shift.id, 'shift-uuid');
      expect(shift.shiftNumber, 'KS-001');
      expect(shift.branchId, 1);
      expect(shift.shiftDate, '2026-07-06');
      expect(shift.shiftType, 'shift_a');
      expect(shift.subShiftType, 'A');
      expect(shift.status, 'open');
      expect(shift.openedBy, 'user-uuid');
      expect(shift.department, 'KITCHEN');
    });

    test('KitchenProductionRecipe model parsing', () {
      final json = {
        'id': 'recipe-uuid',
        'recipe_name': 'Recipe 01',
        'produced_item_id': 'prod-uuid',
        'raw_item_id': 'raw-uuid',
        'raw_quantity': 2.5,
        'raw_unit': 'kg',
        'produced_quantity': 5.0,
        'produced_unit': 'portion',
      };

      final recipe = KitchenProductionRecipe.fromJson(json);

      expect(recipe.id, 'recipe-uuid');
      expect(recipe.recipeName, 'Recipe 01');
      expect(recipe.producedItemId, 'prod-uuid');
      expect(recipe.rawItemId, 'raw-uuid');
      expect(recipe.rawQuantity, 2.5);
      expect(recipe.rawUnit, 'kg');
      expect(recipe.producedQuantity, 5.0);
      expect(recipe.producedUnit, 'portion');
    });
  });
}
