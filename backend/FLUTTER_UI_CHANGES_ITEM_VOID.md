# 📱 Flutter UI Changes for Item-Level Void System

**Commit:** a1e0a2624
**Files Changed:** 2 files (+699 lines)

---

## 📋 SUMMARY

Yes, **significant Flutter UI changes** were made to support the item-level void system. The changes add:

1. ✅ **Void button on each line item** in bill detail
2. ✅ **Bottom sheet dialog** to request void with quantity selector
3. ✅ **Real-time status updates** (polls every 3 seconds)
4. ✅ **Pending void indicators** with approve/reject buttons
5. ✅ **Manager-only approval controls** (role-gated UI)

---

## 🗂️ FILES MODIFIED

### **1. outlet_pos_repository.dart** (+163 lines)
**Location:** `famous_gates_app/lib/features/pos/data/outlet_pos_repository.dart`

**New API Methods Added:**

```dart
// Request item void (Waiter)
Future<ItemVoidRequest> requestItemVoid({
  required String shiftId,
  required String orderId,
  required int itemIndex,
  required double qtyToVoid,
  required String reasonCategory,
  String? note,
})

// Get void requests for shift
Future<List<ItemVoidRequest>> getItemVoidRequestsForShift(String shiftId)

// Approve void (Manager/Accountant only)
Future<OutletShiftOrder> approveItemVoid(String requestId)

// Reject void (Manager/Accountant only)
Future<ItemVoidRequest> rejectItemVoid(
  String requestId,
  {String? rejectionReason}
)
```

**API Endpoints Called:**
- `POST /pos/voids/request` - Request void
- `GET /pos/voids/shift/:shiftId` - Get all void requests
- `PATCH /pos/voids/:id/approve` - Approve
- `PATCH /pos/voids/:id/reject` - Reject

---

### **2. outlet_pos_screen.dart** (+536 lines)
**Location:** `famous_gates_app/lib/features/pos/presentation/outlet_pos_screen.dart`

---

## 🎨 UI COMPONENTS ADDED

### **1. Void Button on Each Line Item**

**Location:** Bill detail item list

**Code:**
```dart
ListTile(
  leading: (_billEditable && pending == null && activeQty > 0 && !_actioning)
    ? IconButton(
        icon: const Icon(Icons.remove_circle_outline, size: 20),
        tooltip: 'Void item',
        onPressed: () => _openVoidItemSheet(index, raw, activeQty),
      )
    : const SizedBox(width: 40),
  // ... item details
)
```

**When Shown:**
- ✅ Bill is editable (not paid/closed)
- ✅ No pending void request for this item
- ✅ Item has active quantity > 0
- ✅ Not currently processing an action

**Visual:**
```
┌─────────────────────────────────────┐
│ ⊖  5x Tusker Lager     KES 1,000.00 │  ← Void button
│ ⊖  3x Coca Cola        KES   240.00 │
│ ⊖  2x Chips            KES   400.00 │
└─────────────────────────────────────┘
```

---

### **2. Void Item Bottom Sheet Dialog**

**Widget:** `_VoidItemSheet`

**Features:**
- ✅ Item name display
- ✅ Quantity selector (+ / - buttons)
- ✅ Reason category dropdown
- ✅ Optional note field
- ✅ "SEND FOR APPROVAL" button

**Code:**
```dart
class _VoidItemSheet extends StatefulWidget {
  const _VoidItemSheet({
    required this.itemName,
    required this.maxQty
  });

  final String itemName;
  final double maxQty;

  @override
  State<_VoidItemSheet> createState() => _VoidItemSheetState();
}
```

**Reason Categories:**
```dart
const itemVoidReasonCategories = {
  'wrong_order': 'Wrong order',
  'duplicate_entry': 'Duplicate entry',
  'customer_changed_mind': 'Customer changed mind',
  'pricing_error': 'Pricing error',
  'other': 'Other',
};
```

**Visual:**
```
┌─────────────────────────────────────┐
│ Void item                           │
│ Tusker Lager                        │
│                                     │
│ Quantity to void                    │
│                    ➖  2  ➕        │
│                                     │
│ Reason: [Wrong order ▼]            │
│                                     │
│ Note (optional)                     │
│ ┌─────────────────────────────┐   │
│ │                             │   │
│ └─────────────────────────────┘   │
│                                     │
│ [   SEND FOR APPROVAL   ]          │
└─────────────────────────────────────┘
```

---

### **3. Pending Void Indicator**

**Shown on items with pending void requests**

**Code:**
```dart
subtitle: pending == null
  ? null
  : Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Wrap(
        spacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          const Chip(
            label: Text('⏳ PENDING', style: TextStyle(fontSize: 11)),
            visualDensity: VisualDensity.compact,
          ),
          Text(
            '${pending.reason} • ${pending.requestedByName ?? 'Unknown'}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          // Manager-only approve/reject buttons
          if (_isReviewer) ...[
            TextButton(
              onPressed: _actioning ? null : () => _approve(pending),
              child: const Text('✓ APPROVE'),
            ),
            TextButton(
              onPressed: _actioning ? null : () => _reject(pending),
              child: const Text('✗ REJECT'),
            ),
          ],
        ],
      ),
    ),
```

**Visual (Waiter sees):**
```
┌─────────────────────────────────────┐
│    5x Tusker Lager     KES 1,000.00 │
│    ⏳ PENDING                       │
│    Wrong order • Jane Doe           │
└─────────────────────────────────────┘
```

**Visual (Manager sees):**
```
┌─────────────────────────────────────┐
│    5x Tusker Lager     KES 1,000.00 │
│    ⏳ PENDING                       │
│    Wrong order • Jane Doe           │
│    [✓ APPROVE]  [✗ REJECT]         │
└─────────────────────────────────────┘
```

---

### **4. Voided Quantity Display**

**Shows voided/active quantities on items**

**Code:**
```dart
title: Text(
  voidedQty > 0
    ? '${qty.toStringAsFixed(qty.truncateToDouble() == qty ? 0 : 1)}x $name (${voidedQty.toStringAsFixed(voidedQty.truncateToDouble() == voidedQty ? 0 : 1)} voided)'
    : '${qty.toStringAsFixed(qty.truncateToDouble() == qty ? 0 : 1)}x $name',
  style: isFullyVoided
    ? const TextStyle(decoration: TextDecoration.lineThrough)
    : null,
),
```

**Visual:**
```
┌─────────────────────────────────────┐
│    5x Tusker Lager (2 voided)       │  ← Partially voided
│    KES 600.00                        │  (3 remaining × 200)
│                                     │
│    3x Coca Cola                     │  ← Normal item
│    KES 240.00                        │
│                                     │
│    2x Chips (2 voided)              │  ← Fully voided
│    KES 0.00                          │  (strikethrough)
└─────────────────────────────────────┘
```

---

## 🔄 REAL-TIME POLLING

**Mechanism:** Timer-based polling every 3 seconds

**Code:**
```dart
@override
void initState() {
  super.initState();
  _timer = Timer.periodic(const Duration(seconds: 3), (_) => _load());
  _load();
}

Future<void> _load() async {
  final results = await Future.wait([
    repo.getShiftOrder(widget.shiftId, widget.orderId),
    repo.getItemVoidRequestsForShift(widget.shiftId),
  ]);

  final order = results[0] as OutletShiftOrder;
  final allRequests = results[1] as List<ItemVoidRequest>;

  setState(() {
    _order = order;
    _voidRequests = allRequests;
  });
}
```

**What It Does:**
1. Fetches updated bill every 3 seconds
2. Fetches all void requests for the shift
3. Updates UI to show latest status
4. Shows approve/reject buttons for managers

---

## 🔐 ROLE-BASED ACCESS CONTROL

**Manager/Accountant Roles:**
```dart
const Set<String> _itemVoidReviewRoles = {
  'manager',
  'restaurant_manager',
  'branch_manager',
  'accountant',
  'branch_accountant',
  'super_admin',
  'auditor',
  'general_manager',
  'director',
  'finance_manager',
  'night_auditor',
};
```

**Role Check:**
```dart
bool get _isReviewer => _itemVoidReviewRoles.contains(_role);
```

**UI Behavior:**
| User Role | Can Request Void | Can See Pending | Can Approve/Reject |
|-----------|------------------|-----------------|-------------------|
| Waiter | ✅ (own bills) | ✅ | ❌ |
| Manager | ✅ | ✅ | ✅ |
| Accountant | ✅ | ✅ | ✅ |

---

## 🔄 WORKFLOW IN UI

### **Step 1: Waiter Requests Void**

1. Waiter opens bill detail
2. Sees void button (⊖) on each item
3. Clicks void button
4. Bottom sheet opens
5. Selects quantity (1-5)
6. Selects reason ("Wrong order")
7. Adds optional note
8. Clicks "SEND FOR APPROVAL"

**Code Flow:**
```dart
Future<void> _openVoidItemSheet(int index, Map<String, dynamic> item, double activeQty) async {
  final result = await showModalBottomSheet<Map<String, dynamic>?>(
    context: context,
    builder: (context) => _VoidItemSheet(
      itemName: item['name'] ?? '',
      maxQty: activeQty,
    ),
  );

  if (result != null) {
    await ref.read(outletPosRepositoryProvider).requestItemVoid(
      shiftId: widget.shiftId,
      orderId: widget.orderId,
      itemIndex: index,
      qtyToVoid: result['qty'] as double,
      reasonCategory: result['reasonCategory'] as String,
      note: result['note'] as String?,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Void request sent for approval')),
    );

    await _load(); // Refresh to show pending status
  }
}
```

---

### **Step 2: Status Shows as Pending**

**After requesting, item shows:**
```
┌─────────────────────────────────────┐
│    5x Tusker Lager     KES 1,000.00 │
│    ⏳ PENDING                       │
│    Wrong order • Jane Doe           │
└─────────────────────────────────────┘
```

**Void button is hidden** while pending.

---

### **Step 3: Manager Approves/Rejects**

**Manager opens same bill:**
```
┌─────────────────────────────────────┐
│    5x Tusker Lager     KES 1,000.00 │
│    ⏳ PENDING                       │
│    Wrong order • Jane Doe           │
│    [✓ APPROVE]  [✗ REJECT]         │
└─────────────────────────────────────┘
```

**Approve Code:**
```dart
Future<void> _approve(ItemVoidRequest request) async {
  setState(() => _actioning = true);
  try {
    await ref.read(outletPosRepositoryProvider).approveItemVoid(request.id);

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Item void approved'),
        backgroundColor: Colors.green,
      ),
    );

    await _load(); // Refresh to show updated bill
  } catch (error) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Failed: $error')),
    );
  } finally {
    setState(() => _actioning = false);
  }
}
```

**Reject Code:**
```dart
Future<void> _reject(ItemVoidRequest request) async {
  final reason = await showDialog<String?>(
    context: context,
    builder: (context) => const _ReasonDialog(
      title: 'Reject void request',
    ),
  );

  if (reason == null || reason.trim().isEmpty) return;

  setState(() => _actioning = true);
  try {
    await ref.read(outletPosRepositoryProvider).rejectItemVoid(
      request.id,
      rejectionReason: reason,
    );

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Item void rejected'),
        backgroundColor: Colors.orange,
      ),
    );

    await _load();
  } catch (error) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Failed: $error')),
    );
  } finally {
    setState(() => _actioning = false);
  }
}
```

---

### **Step 4: Bill Updates**

**After approval, item shows:**
```
┌─────────────────────────────────────┐
│ ⊖  5x Tusker Lager (2 voided)       │  ← Void button back
│    KES 600.00                        │  (3 remaining)
└─────────────────────────────────────┘
```

**Bill total automatically reduced:**
```
SUBTOTAL:  KES 1,240.00  →  KES 840.00
```

---

## 🎯 KEY UI FEATURES

### **1. Visual Feedback States**

| State | Visual Indicator |
|-------|-----------------|
| Normal item | Void button (⊖) visible |
| Pending void | ⏳ PENDING chip + reason + requester name |
| Partially voided | "5x Item (2 voided)" in title |
| Fully voided | Strikethrough text + KES 0.00 |

### **2. Quantity Selector**

```
Quantity to void
                  ➖  2  ➕
```

- ➖ button: Decrease (disabled at 1)
- ➕ button: Increase (disabled at max qty)
- Shows whole numbers only

### **3. Reason Dropdown**

```
Reason: [Wrong order ▼]
```

**Options:**
- Wrong order
- Duplicate entry
- Customer changed mind
- Pricing error
- Other

### **4. Optional Note Field**

```
┌─────────────────────────────────┐
│ Note (optional)                 │
│ ┌─────────────────────────────┐ │
│ │ Customer wanted wine instead│ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

**Multiline text field** for additional context.

---

## 📊 DATA MODELS USED

**ItemVoidRequest:**
```dart
class ItemVoidRequest {
  final String id;
  final String shiftId;
  final String orderId;
  final int itemIndex;
  final String itemName;
  final double qtyToVoid;
  final String reason;
  final String reasonCategory;
  final String? note;
  final String? requestedByName;
  final String status; // 'pending', 'approved', 'rejected'
  final DateTime createdAt;
}
```

**OutletShiftOrder (updated):**
```dart
class OutletShiftOrder {
  // ... existing fields

  final List<Map<String, dynamic>> items; // Now contains void tracking

  // Each item can now have:
  // {
  //   "name": "Tusker",
  //   "quantity": 5,
  //   "voided_qty": 2,      // NEW
  //   "active_qty": 3,      // NEW
  //   "is_fully_voided": false, // NEW
  //   "active_total": 600   // NEW
  // }
}
```

---

## 🚀 BENEFITS OF THIS UI

✅ **Intuitive** - Void button right on each item
✅ **Guided** - Dropdown for reasons (consistency)
✅ **Flexible** - Partial voids supported
✅ **Real-time** - Polls every 3s for updates
✅ **Role-aware** - Shows controls based on permissions
✅ **Clear feedback** - Pending/voided states visible
✅ **Accountability** - Shows who requested, when
✅ **Manager-friendly** - One-click approve/reject

---

## ⚠️ IMPORTANT UI BEHAVIORS

1. **Void button hidden when:**
   - Bill is paid/closed/voided
   - Item already has pending void request
   - Item has 0 active quantity
   - Currently processing an action

2. **Polling stops when:**
   - Widget disposed
   - User navigates away from bill detail

3. **Manager buttons only show:**
   - If user role is in `_itemVoidReviewRoles`
   - If item has pending void request
   - Not disabled during processing

4. **Strikethrough text:**
   - Only when `is_fully_voided = true`
   - Item still visible (not removed from list)

---

## 🎨 VISUAL EXAMPLES

### **Before Void:**
```
┌─────────────────────────────────────┐
│ ⊖  5x Tusker Lager     KES 1,000.00 │
│ ⊖  3x Coca Cola        KES   240.00 │
│                                     │
│ TOTAL                  KES 1,240.00 │
└─────────────────────────────────────┘
```

### **After Requesting Void (2 Tuskers):**
```
┌─────────────────────────────────────┐
│    5x Tusker Lager     KES 1,000.00 │
│    ⏳ PENDING                       │
│    Wrong order • Jane Doe           │
│    [✓ APPROVE]  [✗ REJECT]  ← Manager only
│                                     │
│ ⊖  3x Coca Cola        KES   240.00 │
│                                     │
│ TOTAL                  KES 1,240.00 │
└─────────────────────────────────────┘
```

### **After Approval:**
```
┌─────────────────────────────────────┐
│ ⊖  5x Tusker Lager (2 voided)       │
│    KES   600.00                      │ ← Reduced
│                                     │
│ ⊖  3x Coca Cola        KES   240.00 │
│                                     │
│ TOTAL                  KES   840.00 │ ← Reduced
└─────────────────────────────────────┘
```

---

## 🏁 CONCLUSION

The Flutter UI provides a **complete, production-ready interface** for item-level voids with:

- ✅ **Clear visual indicators** for all states
- ✅ **Guided workflow** with dropdowns and validation
- ✅ **Real-time updates** via polling
- ✅ **Role-based access** for approval
- ✅ **Comprehensive feedback** via snackbars
- ✅ **Clean, intuitive design** aligned with existing POS UI

The UI seamlessly integrates with the backend void system while maintaining a simple, user-friendly experience for both waiters and managers.
