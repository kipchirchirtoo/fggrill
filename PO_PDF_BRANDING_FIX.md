# Purchase Order PDF Branding & Data Fix ✅

## Issues Fixed

### 1. Wrong Branding
- **Before**: "Kyogong GRILL & LOUNGE"
- **After**: "FamousGate Hotels"
- **Email Before**: kyogongsbm1@gmail.com  
- **Email After**: famousgatesbmt@gmail.com
- **Phone**: 0706782828

### 2. Wrong Item Data
- **Issue**: PDF was showing "Smokies" with quantity 0 and price Ksh 0.00
- **Root Cause**: PDF wasn't reading the correct fields from the database response
- **Fix**: Updated to read `quantity_ordered` and `total_price` from `store_po_items` table

### 3. Footer Branding
- **Before**: "Kyogong Grill & Lounge - Procurement System"
- **After**: "FamousGate Hotels - Procurement System"

## Changes Made

### File: `frontend/src/lib/purchase-order-pdf.ts`

#### 1. Updated Company Info Section
```typescript
// Changed default branding
doc.text(po.branch?.name || 'FamousGate Hotels', 190, cursorY, { align: 'right' });
doc.text(po.branch?.email || 'famousgatesbmt@gmail.com', 190, cursorY, { align: 'right' });
```

#### 2. Fixed Item Data Mapping
```typescript
const tableData = (po.items || []).map(item => {
    // Handle both quantity_ordered (from DB) and quantity (from form)
    const qty = Number(item.quantity_ordered || item.quantity) || 0;
    const price = Number(item.unit_price) || 0;
    // Use total_price from DB if available, otherwise calculate
    const total = Number(item.total_price) || (qty * price);

    // Get item name from nested item object or fallback
    const itemName = item.item?.name || item_name || `Item #${item.item_id}`;

    return [itemName, qty, price, total];
});
```

#### 3. Updated Interface
```typescript
interface POItem {
    item?: { name: string };
    item_id?: number | string;
    item_name?: string;
    quantity?: number;
    quantity_ordered?: number;  // Added
    unit_price: number;
    total?: number;
    total_price?: number;  // Added
}
```

#### 4. Updated Footer
```typescript
doc.text('FamousGate Hotels - Procurement System', 105, 285, { align: 'center' });
```

## Correct Branding Information

- **Hotel Name**: FamousGate Hotels
- **Phone**: 0706782828
- **Email**: famousgatesbmt@gmail.com
- **Location**: Bomet, Kenya

## Data Flow

### Backend Response Structure
```json
{
  "po_number": "PO-202603-0005",
  "supplier": {
    "name": "Unilever Kenya"
  },
  "items": [
    {
      "item_id": "uuid-here",
      "quantity_ordered": 10,
      "unit_price": 69.00,
      "total_price": 690.00,
      "item": {
        "name": "Smokies"
      }
    }
  ],
  "subtotal": 897.00,
  "tax_amount": 143.52,
  "total_amount": 1040.52
}
```

### PDF Generation
1. Fetches PO data from backend (includes full item details)
2. Maps items using `quantity_ordered` and `total_price` from database
3. Falls back to calculated values if DB fields are missing
4. Uses branch info if available, otherwise uses default "FamousGate Hotels" branding

## Testing

To test the fix:
1. Go to Branch Accounting → Purchases
2. Find any purchase order
3. Click "Download PDF" button
4. Verify:
   - ✅ Header shows "FamousGate Hotels"
   - ✅ Email shows famousgatesbmt@gmail.com
   - ✅ Phone shows 0706782828
   - ✅ Items show correct quantities and amounts
   - ✅ Footer shows "FamousGate Hotels - Procurement System"

## Notes

- The PDF now correctly reads data from the `store_po_items` table
- Backend already returns the correct data structure with nested item details
- The fix handles both database fields (`quantity_ordered`, `total_price`) and form fields (`quantity`, `total`)
- Branding is consistent with correct hotel name: FamousGate Hotels
