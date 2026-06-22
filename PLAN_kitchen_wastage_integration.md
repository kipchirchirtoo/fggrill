# Kitchen Wastage Control Integration Plan

## Objective
Connect **Kitchen Sessions**, **Food Control**, **Stock Out**, **Outlet Production**, and **POS Outlet** into a single closed-loop system where every gram of raw material is tracked from store issue → kitchen production → POS sale → variance detection → staff penalization.

---

## Current Architecture (What Already Exists)

### 1. Kitchen Shifts (`kitchen_shifts` + `kitchen_shift_items`)
- Storekeeper opens a shift with **opening stock** (raw materials)
- Tracks: `opening_stock`, `additions` (more stock issued), `sold_quantity` (raw consumed by production), `spoilage_quantity`
- At shift close: physical count entered → `variance = physical - (opening + additions - sold - spoilage)`
- Variance goes through approval workflow: closed → pending_chef_confirmation → pending_accountant_review → approved/rejected

### 2. Kitchen Production (`kitchen_shift_production`)
- Chef records: "I used 2kg flour and produced 27 chapatis"
- Links to `kitchen_production_recipes` / `kitchen_food_controls` for yield ratios
- Produced items are pushed to `pos_outlet_items` (POS can now sell them)
- **Already has shortfall penalty**: if actual yield < expected yield, creates a staff credit bill for the variance cost

### 3. Kitchen Production Sessions (`kitchen_production_sessions`)
- Parallel older system with `kitchen_session_issues`, `kitchen_production_entries`
- Has penalty/credit bill generation for variance
- **Not connected** to the newer `kitchen_shifts` system

### 4. Food Control (`kitchen_food_controls` + `kitchen_production_recipes`)
- Defines yield rules: e.g. `1.5kg beef + 0.3kg sukuma → 12 portions Beef Special`
- Has variance controller (`foodControlVariance`) with explain/flag/approve workflow

### 5. Stock Out / Requisitions (`kitchen_requisitions`)
- Chef creates requisition → Storekeeper approves → Stock issued with GRN
- Links to recipes for yield conversion when issuing

### 6. POS Outlet (`pos_outlet_items` + `pos_shift_orders`)
- Sells produced items (Beef Special, Chapati, etc.)
- Tracks `sold_quantity` per POS shift
- **No link back** to which kitchen shift produced the item

### 7. Wastage Tracking (`wastage_records` + `kitchen_spoilage_categories`)
- Spoilage recorded with reason category (burnt, expired, etc.)
- Linked to shift but **not attributed to individual chef**

---

## Critical Gaps Identified

| Gap | Impact |
|-----|--------|
| **POS sales don't consume from kitchen shift** | When POS sells "Beef Special", kitchen shift doesn't know how much raw beef was consumed. Variance calculation at shift close is blind to actual sales. |
| **Two parallel kitchen systems** | `kitchen_shifts` and `kitchen_production_sessions` both exist but don't share data. Chef could be working in one while storekeeper sees the other. |
| **Food Control recipes not enforced at production** | Chef can record using 3kg flour for 27 chapatis even though recipe says 2kg. No real-time alert. |
| **Wastage not attributed to responsible staff** | Spoilage is recorded but nobody is held accountable unless accountant manually creates credit bill. |
| **No real-time wastage alerts** | Variance only computed at shift close. By then, the food is already wasted. |
| **No link between POS sales and raw material consumption** | Can't answer: "We sold 50 Beef Specials, recipe says 1.5kg beef each = 75kg. Did we actually use 75kg?" |

---

## Integration Plan

### PHASE 1: Unify Kitchen Shift Systems
**Goal**: Merge `kitchen_shifts` and `kitchen_production_sessions` into one system.

**Database:**
```sql
-- Add migration to link kitchen_production_sessions to kitchen_shifts
ALTER TABLE kitchen_production_sessions
  ADD COLUMN IF NOT EXISTS kitchen_shift_id UUID REFERENCES kitchen_shifts(id);

-- Sync existing sessions to shifts (if any)
-- Or: deprecate kitchen_production_sessions in favor of kitchen_shifts
```

**Decision:** Keep `kitchen_shifts` as the master. `kitchen_production_sessions` becomes a view/report layer on top of `kitchen_shifts` data. This avoids data migration pain.

**Backend:**
- `kitchen-shift.controller.ts`: Add `getProductionSessionView()` that queries `kitchen_shifts` + `kitchen_shift_items` + `kitchen_shift_production` and returns data in the shape expected by the old `kitchen_production_sessions` API.
- Update `kitchen-production.controller.ts` to write to `kitchen_shifts` tables instead of `kitchen_production_sessions`.

**Flutter:**
- Point "Kitchen Sessions" screen to `GET /api/kitchen/shifts` instead of `GET /api/kitchen/production-sessions`.

---

### PHASE 2: Link POS Sales to Kitchen Shift Consumption
**Goal**: When POS sells a produced item, automatically deduct raw materials from the active kitchen shift.

**New Table:**
```sql
CREATE TABLE kitchen_shift_pos_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES kitchen_shifts(id),
  pos_shift_id UUID REFERENCES pos_outlet_shifts(id),
  pos_order_id UUID REFERENCES pos_shift_orders(id),
  pos_outlet_item_id UUID REFERENCES pos_outlet_items(id),
  produced_item_sku VARCHAR(100),
  produced_item_name VARCHAR(255),
  portions_sold NUMERIC(14,3) NOT NULL DEFAULT 0,
  -- Raw material breakdown (denormalized for fast reporting)
  raw_item_sku VARCHAR(100),
  raw_item_name VARCHAR(255),
  raw_quantity_consumed NUMERIC(14,3) NOT NULL DEFAULT 0,
  raw_unit VARCHAR(50),
  cost_price NUMERIC(14,2) DEFAULT 0,
  sold_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Backend Logic (`outlet-pos.controller.ts` — when order is placed):**
```typescript
async function recordKitchenConsumption(orderItems: any[], branchId: number, posShiftId: string) {
  // Find active kitchen shift for this branch
  const { data: shift } = await supabase
    .from('kitchen_shifts')
    .select('id')
    .eq('branch_id', branchId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!shift) return; // No active kitchen shift — restaurant may not use kitchen module

  for (const item of orderItems) {
    // Lookup recipe for this pos_outlet_item
    const { data: recipe } = await supabase
      .from('kitchen_production_recipes')
      .select('*')
      .eq('pos_outlet_item_id', item.outlet_item_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!recipe) continue; // No recipe = no raw material tracking needed

    const portionsSold = item.qty;
    const rawQtyConsumed = (recipe.raw_quantity / recipe.produced_quantity) * portionsSold;

    // Record consumption
    await supabase.from('kitchen_shift_pos_consumption').insert({
      shift_id: shift.id,
      pos_shift_id: posShiftId,
      pos_outlet_item_id: item.outlet_item_id,
      produced_item_sku: recipe.produced_item_sku,
      produced_item_name: recipe.produced_item_name,
      portions_sold: portionsSold,
      raw_item_sku: recipe.raw_item_sku,
      raw_item_name: recipe.raw_item_name,
      raw_quantity_consumed: rawQtyConsumed,
      raw_unit: recipe.raw_unit,
      cost_price: recipe.cost_per_output || 0,
    });

    // Also update kitchen_shift_items.sold_quantity (raw consumed)
    const { data: shiftItem } = await supabase
      .from('kitchen_shift_items')
      .select('id, sold_quantity')
      .eq('shift_id', shift.id)
      .eq('item_sku', recipe.raw_item_sku)
      .maybeSingle();

    if (shiftItem) {
      await supabase
        .from('kitchen_shift_items')
        .update({ sold_quantity: shiftItem.sold_quantity + rawQtyConsumed })
        .eq('id', shiftItem.id);
    }
  }
}
```

**Key Point**: This links every POS sale back to raw material consumption. Now the variance formula becomes:
```
variance = physical_count - (opening_stock + additions - recipe_based_consumption - spoilage)
```

---

### PHASE 3: Enforce Food Control Recipes at Production Time
**Goal**: Alert chef in real-time when they use more raw material than the recipe allows.

**Backend (`kitchen-shift.controller.ts` — `recordProduction`):**
```typescript
// Before recording production, check recipe
const { data: recipe } = await supabase
  .from('kitchen_production_recipes')
  .select('*')
  .eq('id', p.recipe_id)
  .single();

if (recipe) {
  const maxRawAllowed = (p.produced_quantity / recipe.produced_quantity) * recipe.raw_quantity;
  const variancePct = ((p.raw_quantity_used - maxRawAllowed) / maxRawAllowed) * 100;

  if (variancePct > recipe.allowed_variance_pct) {
    // Flag for override — chef must explain why
    return res.status(400).json({
      success: false,
      code: 'RECIPE_VARIANCE_EXCEEDED',
      message: `Recipe allows ${maxRawAllowed}${recipe.raw_unit} for ${p.produced_quantity} portions. You used ${p.raw_quantity_used}${p.raw_unit} (${variancePct.toFixed(1)}% over). Please explain the variance.`,
      data: { recipe, maxRawAllowed, actualUsed: p.raw_quantity_used, variancePct }
    });
  }
}
```

**Flutter:**
- Production dialog shows expected vs actual usage.
- If variance exceeded, show "Explain Variance" text field before allowing save.
- Store explanation in `kitchen_shift_production.variance_reason`.

---

### PHASE 4: Real-Time Wastage Alerts
**Goal**: Notify storekeeper/chef immediately when wastage thresholds are breached.

**New Table:**
```sql
CREATE TABLE kitchen_wastage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES kitchen_shifts(id),
  alert_type VARCHAR(50) CHECK (alert_type IN ('recipe_variance', 'spoilage_spike', 'unexplained_shortage', 'production_shortfall')),
  severity VARCHAR(20) CHECK (severity IN ('warning', 'critical')),
  item_sku VARCHAR(100),
  item_name VARCHAR(255),
  expected_value NUMERIC(14,3),
  actual_value NUMERIC(14,3),
  variance_value NUMERIC(14,3),
  variance_cost NUMERIC(14,2),
  message TEXT,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Triggers:**
- After production record insert → if recipe variance > threshold → insert alert
- After spoilage record insert → if spoilage > 5% of total available → insert alert
- After shift close → if unexplained shortage > KES 500 → insert alert

**Flutter:**
- Badge on "Kitchen Sessions" nav item shows unacknowledged alert count.
- Alert modal when opening shift if any unacknowledged alerts exist.

---

### PHASE 5: Automatic Penalization (Credit Bill Creation)
**Goal**: When accountant approves a shift with variance, automatically create staff credit bills for attributable wastage.

**Current State:** `accountantReviewShift` already supports `liability_action`:
- `write_off` — just records the loss
- `staff_liability` — needs to be implemented

**New Logic in `accountantReviewShift`:**
```typescript
if (approved && action === 'staff_liability' && varianceCost > 0) {
  for (const allocation of normalizedAllocations) {
    const staffProfileId = await resolveStaffProfileId(allocation.staff_id);
    if (!staffProfileId) continue;

    // Create credit bill for this staff member's share of wastage
    const { data: creditBill } = await supabase.from('staff_credit_bills').insert({
      staff_id: staffProfileId,
      branch_id: shift.branch_id,
      bill_number: await generateCreditBillNumber(shift.branch_id),
      description: `Kitchen shift ${shift.shift_number} wastage liability — ${allocation.reason || 'Unexplained variance'}`,
      amount: allocation.amount,
      amount_paid: 0,
      balance: allocation.amount,
      status: 'pending',
      source_kitchen_shift_id: shift_id,
      liability_type: 'kitchen_wastage'
    }).select('id').single();

    creditBills.push(creditBill);
  }
}
```

**Flutter:**
- Accountant review screen shows variance breakdown by item.
- Auto-allocate variance to chef(s) on duty (from `assigned_chef_ids` or `kitchen_shift_production.produced_by`).
- Allow accountant to adjust allocations before approving.

---

### PHASE 6: Wastage Dashboard & Reports
**Goal**: Give branch manager/accountant visibility into wastage trends.

**New API Endpoints:**
```
GET /api/kitchen/wastage-report?branch_id=X&from=YYYY-MM-DD&to=YYYY-MM-DD
```
Returns:
- Total wastage cost by category (recipe variance, spoilage, unexplained shortage)
- Top 10 wastage items
- Wastage by chef (bar chart)
- Wastage trend over time (line chart)
- Comparison: expected raw usage vs actual raw usage vs POS sales consumption

**Flutter Screen:**
- New "Wastage Report" tab in Branch Storekeeper dashboard
- Filters: Date range, Shift type, Chef
- Export to PDF

---

## Data Flow Diagram (After Integration)

```
BRANCH STORE                    KITCHEN                         POS                          ACCOUNTANT
    │                            │                              │                              │
    │ 1. Issue Stock             │                              │                              │
    │──────────────▶│  kitchen_shift_items.additions            │                              │
    │                            │                              │                              │
    │ 2. Chef produces           │                              │                              │
    │    (enforced by recipe)    │                              │                              │
    │                            │────▶ kitchen_shift_production │                              │
    │                            │      (raw consumed)          │                              │
    │                            │                              │                              │
    │                            │────▶ pos_outlet_items        │                              │
    │                            │      (produced items ready)  │                              │
    │                            │                              │                              │
    │                            │                              │ 3. POS sells                 │
    │                            │                              │────▶ kitchen_shift_pos_      │
    │                            │                              │      consumption (auto)      │
    │                            │                              │                              │
    │                            │ 4. Record spoilage           │                              │
    │                            │────▶ wastage_records         │                              │
    │                            │                              │                              │
    │                            │ 5. Close shift               │                              │
    │                            │────▶ kitchen_shift_stock_take│                              │
    │                            │      (variance computed)     │                              │
    │                            │                              │                              │
    │                            │                              │                              │ 6. Review & approve
    │                            │                              │                              │◀──── variance + alerts
    │                            │                              │                              │
    │                            │                              │                              │ 7. Auto-create
    │                            │                              │                              │      credit bills
    │                            │                              │                              │────▶ staff_credit_bills
```

---

## Implementation Order (Recommended)

1. **Week 1**: Phase 1 — Unify kitchen shifts (merge the two systems)
2. **Week 2**: Phase 2 — Link POS sales to kitchen consumption (the critical missing link)
3. **Week 3**: Phase 3 — Enforce recipes at production time
4. **Week 4**: Phase 4 — Real-time wastage alerts
5. **Week 5**: Phase 5 — Automatic penalization (credit bills)
6. **Week 6**: Phase 6 — Wastage dashboard

---

## Key Decisions Needed from You

1. **Should we deprecate `kitchen_production_sessions` entirely?** Or keep both and sync them?
2. **What variance threshold triggers an alert?** (e.g. 5% over recipe = warning, 15% = critical)
3. **How do we attribute spoilage to staff?** By who logged it? By who was chef on duty? By shift assignment?
4. **Should wastage credit bills require accountant approval?** Or auto-create on shift approval?
5. **Do all branches use the same recipe standards?** Or branch-specific recipes?

---

## Files That Will Change

| File | Change |
|------|--------|
| `backend/src/controllers/kitchen-shift.controller.ts` | Add POS consumption sync, recipe enforcement, alert generation |
| `backend/src/controllers/outlet-pos.controller.ts` | Call `recordKitchenConsumption()` on order placement |
| `backend/src/controllers/kitchen/food-control.controller.ts` | Add `allowed_variance_pct` to recipe validation |
| `backend/src/controllers/kitchen/kitchen-production.controller.ts` | Redirect writes to `kitchen_shifts` tables |
| `database/migrations/20260621_kitchen_wastage_integration.sql` | New tables: `kitchen_shift_pos_consumption`, `kitchen_wastage_alerts` |
| `famous_gates_app/.../branch_accountant_dashboard.dart` | Add wastage report tab, alert badges |
| `famous_gates_app/.../branch_storekeeper_dashboard.dart` | Kitchen sessions use unified API |

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Raw material tracking accuracy | ~60% (estimated) | 95%+ |
| Time to detect wastage | End of day (shift close) | Real-time (at production) |
| Staff accountability | Manual (accountant creates bills) | Automatic (system generates on approval) |
| Recipe compliance | No enforcement | Enforced with override + explanation |
| Wastage visibility | Spread across 3 screens | Single dashboard |
