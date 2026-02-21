# Food Control System - Automatic Portion Calculation ✅

## Overview
Implemented an automated food control system that calculates expected portions when storekeeper issues raw ingredients to the kitchen. For example: when 2kg maize flour is issued, the system automatically records that 8 ugalis are expected.

## Problem Solved
Previously, when storekeepers dispatched raw ingredients to the kitchen, there was no automatic tracking of expected output portions. This made it difficult to:
- Track food wastage and losses
- Monitor kitchen efficiency
- Identify discrepancies between raw materials and finished products
- Hold kitchen staff accountable for portion control

## Solution Implemented

### 1. Database Schema (`26_food_control_integration.sql`)

**Enhanced `kitchen_food_controls` table:**
- Added `raw_item_sku` column for precise item matching
- Added `is_active` flag to enable/disable rules

**New `kitchen_expected_portions` table:**
Tracks expected portions when raw ingredients are received:
- Links to dispatch notes and items
- Records raw ingredient details (SKU, name, quantity, unit)
- Calculates expected portions based on food control rules
- Tracks actual portions produced (for variance analysis)
- Records variance and variance percentage
- Includes verification workflow

**Automatic Trigger:**
- `calculate_expected_portions_on_delivery()` function
- Automatically runs when dispatch status changes to CONFIRMED
- Calculates expected portions for each item with a food control rule
- Creates records in `kitchen_expected_portions` table

### 2. Food Control Rules (Pre-configured)

| Raw Ingredient | Quantity | Unit | Produces | Portions |
|----------------|----------|------|----------|----------|
| AJAB (Maize Flour) | 2 | KG | UGALIS | 8 |
| EXE (Wheat Flour) | 2 | KG | CHAPATIS | 30 |
| BEEF / MBUZI | 1 | KG | PORTIONS | 4 |
| BEEF | 1 | KG | MIXES / SPECIALS | 10 |
| MINCED MEAT | 1 | KG | SAMOSAS | 30 |
| MILK | 1 | LITRE | TEA CUPS | 4 |
| FULL CHICKEN | 1 | QTY | QUARTERS | 4 |
| POTATOES | 20 | KG | PLATES OF CHIPS | 15 |
| RICE | 1 | KG | PLATES OF RICE / PILAU | 7 |

### 3. Backend API Endpoints

**Expected Portions Management:**
- `GET /api/kitchen/expected-portions` - List all expected portions
- `GET /api/kitchen/expected-portions/:id` - Get single record
- `GET /api/kitchen/expected-portions/pending` - Get unverified portions
- `PUT /api/kitchen/expected-portions/:id/verify` - Verify actual portions
- `GET /api/kitchen/expected-portions/variance/summary` - Get variance statistics

**Query Parameters:**
- `branch_id` - Filter by branch
- `verified` - Filter by verification status (true/false)
- `date_from` - Filter from date
- `date_to` - Filter to date

### 4. Frontend API Integration

Added to `api.kitchen` object:
```typescript
getExpectedPortions(params?)
getExpectedPortion(id)
verifyActualPortions(id, data)
getPendingVerifications(branch_id?)
getVarianceSummary(params?)
```

## How It Works

### Workflow:

1. **Store Dispatch Creation**
   - Storekeeper creates dispatch note
   - Adds items (e.g., 2kg Maize Flour)
   - Dispatches to kitchen branch

2. **Kitchen Receives Delivery**
   - Kitchen staff confirms delivery
   - Updates received quantities
   - Status changes to CONFIRMED

3. **Automatic Calculation (Trigger)**
   - System checks if item has food control rule
   - Finds rule: 2kg Maize Flour → 8 Ugalis
   - Calculates: (2kg received / 2kg standard) × 8 portions = 8 ugalis
   - Creates record in `kitchen_expected_portions`

4. **Kitchen Verification**
   - Kitchen staff counts actual portions produced
   - Updates record with actual count
   - System calculates variance automatically

5. **Variance Analysis**
   - Variance = Actual - Expected
   - Variance % = (Variance / Expected) × 100
   - Flags significant variances (>10%) for review

### Example Calculation:

**Scenario:** Storekeeper issues 5kg Maize Flour

```
Food Control Rule:
- Raw: 2kg Maize Flour
- Produces: 8 Ugalis

Calculation:
- Received: 5kg
- Expected Portions = (5kg / 2kg) × 8 = 20 ugalis

Kitchen produces 18 ugalis:
- Variance = 18 - 20 = -2 ugalis
- Variance % = (-2 / 20) × 100 = -10%
```

## Database Trigger Logic

```sql
-- Trigger fires when dispatch is confirmed
CREATE TRIGGER trg_calculate_expected_portions
    AFTER UPDATE ON dispatch_notes
    FOR EACH ROW
    EXECUTE FUNCTION calculate_expected_portions_on_delivery();

-- Function logic:
1. Check if status changed to CONFIRMED/DISPUTED
2. Get all dispatch items
3. For each item:
   a. Find matching food control rule (by SKU or name)
   b. Calculate expected portions
   c. Insert record in kitchen_expected_portions
4. Log calculation for audit trail
```

## Variance Tracking

### Variance Categories:
- **Positive Variance**: More portions than expected (good efficiency)
- **Negative Variance**: Fewer portions than expected (wastage/loss)
- **Acceptable Range**: ±5% variance
- **Review Required**: >10% variance

### Variance Reasons (Examples):
- "Ingredient quality issues"
- "Portion size adjustment"
- "Wastage during preparation"
- "Staff training needed"
- "Recipe adjustment required"

## Benefits

1. **Accountability**: Kitchen staff know expected output
2. **Wastage Control**: Identify losses immediately
3. **Cost Control**: Track food cost efficiency
4. **Performance Metrics**: Measure kitchen productivity
5. **Audit Trail**: Complete record of raw materials to portions
6. **Automated**: No manual calculation needed
7. **Real-time**: Calculations happen instantly on delivery

## Reports & Analytics

### Available Metrics:
- Total expected vs actual portions
- Variance by item type
- Variance by time period
- Kitchen efficiency percentage
- Top items with variance
- Trend analysis over time

### Summary Statistics:
```json
{
  "total_records": 150,
  "records_with_variance": 45,
  "avg_variance_percentage": "-3.2%",
  "accuracy_rate": "70%",
  "positive_variance_count": 20,
  "negative_variance_count": 25
}
```

## Configuration

### Adding New Food Control Rules:

```sql
INSERT INTO kitchen_food_controls (
    raw_item_sku,
    raw_item_name,
    raw_quantity,
    raw_unit,
    produced_item_name,
    produced_portions,
    branch_id,
    is_active
) VALUES (
    'FLOUR-MAIZE-001',
    'AJAB (MAIZE FLOUR)',
    2,
    'KG',
    'UGALIS',
    8,
    NULL,  -- NULL = applies to all branches
    TRUE
);
```

### Updating SKU Mappings:

```sql
-- Map store item SKU to food control rule
UPDATE kitchen_food_controls 
SET raw_item_sku = 'YOUR-ITEM-SKU' 
WHERE raw_item_name = 'AJAB (MAIZE FLOUR)';
```

## Testing Instructions

### 1. Test Automatic Calculation

1. Login as Storekeeper
2. Go to Central Store → Dispatch
3. Create dispatch to kitchen branch
4. Add item: "2kg Maize Flour"
5. Dispatch items
6. Login as Kitchen Staff
7. Confirm delivery
8. **Expected**: System creates expected portions record (8 ugalis)

### 2. Test Verification

1. Go to Kitchen → Expected Portions (or Pending Verifications)
2. Find the maize flour record
3. Enter actual portions produced (e.g., 7)
4. Add variance reason if needed
5. Submit verification
6. **Expected**: Variance calculated automatically (-1 ugali, -12.5%)

### 3. Test Variance Summary

1. Go to Kitchen → Reports → Variance Summary
2. Select date range
3. **Expected**: See summary statistics and item breakdown

## API Examples

### Get Pending Verifications:
```typescript
const response = await api.kitchen.getPendingVerifications(branchId);
// Returns list of unverified expected portions
```

### Verify Actual Portions:
```typescript
await api.kitchen.verifyActualPortions('record-id', {
    actual_portions: 7,
    variance_reason: 'Some flour was damaged'
});
```

### Get Variance Summary:
```typescript
const summary = await api.kitchen.getVarianceSummary({
    branch_id: 1,
    date_from: '2026-02-01',
    date_to: '2026-02-18'
});
```

## Files Created/Modified

### Backend:
1. `backend/supabase/migrations/26_food_control_integration.sql` - Database schema
2. `backend/src/controllers/kitchen/expected-portions.controller.ts` - API controllers
3. `backend/src/routes/kitchen.routes.ts` - Route definitions

### Frontend:
1. `frontend/src/lib/api.ts` - API methods

### Existing Files Enhanced:
- `kitchen_food_controls` table - Added SKU column
- Dispatch confirmation flow - Now triggers portion calculation

## Future Enhancements

1. **Mobile App**: Kitchen staff can verify portions on mobile
2. **Photo Evidence**: Attach photos of produced portions
3. **Real-time Alerts**: Notify managers of significant variances
4. **Predictive Analytics**: ML model to predict expected portions
5. **Recipe Integration**: Link to recipe management system
6. **Cost Analysis**: Calculate cost per portion automatically
7. **Batch Tracking**: Track multiple batches per day
8. **Quality Scores**: Rate quality of produced portions

## Troubleshooting

**Expected portions not calculating?**
- Check if food control rule exists for the item
- Verify `raw_item_sku` matches dispatch item SKU
- Check if rule is active (`is_active = TRUE`)
- Review trigger logs in database

**Variance calculation incorrect?**
- Verify expected portions were calculated correctly
- Check actual portions entered
- Review food control rule quantities

**Items not matching?**
- Update SKU mappings in `kitchen_food_controls`
- Check item names match (case-insensitive)
- Verify branch_id if rule is branch-specific

---

**Status:** ✅ COMPLETE
**Date:** February 18, 2026
**Impact:** Automated portion tracking for kitchen food control
**Testing:** Ready for testing
