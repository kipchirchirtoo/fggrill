# 🎹 KEYBOARD SHORTCUTS — PHASE 1B: PILOT IMPLEMENTATION

**Date:** 2026-04-14  
**Status:** ✅ COMPLETE  
**Modules:** Infrastructure + Ready for Cashier & POS Integration

---

## 📦 DELIVERABLES

### 1. Custom Hook (`useKeyboardShortcut`)
**File:** `frontend/src/hooks/useKeyboardShortcut.ts`

**Features:**
- ✅ Context-aware (respects input fields, modals)
- ✅ Multi-key support (`ctrl+p`, `alt+h`, `/`, `f2`, etc.)
- ✅ Alternative keys support (`['+', '=']`, `['f2', '/']`)
- ✅ Prevent default browser behavior
- ✅ Role-based access control via `enabled` option
- ✅ Special key handling (arrows, enter, escape, delete)
- ✅ Format utility for display (`formatShortcut('ctrl+p')` → `'Ctrl+P'`)

**Usage Example:**
```typescript
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

// Simple shortcut
useKeyboardShortcut('ctrl+p', handlePayment, {
  enabled: true,
  disableInInputs: true,
  modalSafe: true,
  preventDefault: true
});

// Multiple alternative keys
useKeyboardShortcut(['f2', '/'], focusSearch, {
  enabled: true
});

// Conditional based on role
useKeyboardShortcut('ctrl+a', handleApprove, {
  enabled: user?.role === 'AUDITOR'
});
```

---

### 2. Shortcut Registry (`keyboardShortcuts.ts`)
**File:** `frontend/src/config/keyboardShortcuts.ts`

**Features:**
- ✅ Single source of truth for all shortcuts
- ✅ Organized by module (global, cashier, pos, auditor, etc.)
- ✅ Priority levels (high, medium, low)
- ✅ Descriptions for help overlay
- ✅ Type-safe with TypeScript interfaces

**Structure:**
```typescript
export const SHORTCUTS = {
  global: {
    help: { keys: '?', description: 'Open shortcuts help', priority: 'high' },
    home: { keys: 'alt+h', description: 'Go to home', priority: 'medium' },
    // ...
  },
  cashier: {
    focusScan: { keys: ['f2', '/'], description: 'Focus scan input', priority: 'high' },
    processPayment: { keys: 'ctrl+p', description: 'Process payment', priority: 'high' },
    // ...
  },
  pos: {
    focusSearch: { keys: ['f2', '/'], description: 'Focus item search', priority: 'high' },
    sendToKitchen: { keys: 'ctrl+s', description: 'Send to kitchen', priority: 'high' },
    // ...
  },
  // ... other modules
};
```

**Shortcuts Defined:**
- **Global:** 4 shortcuts
- **Cashier:** 10 shortcuts
- **POS:** 14 shortcuts
- **Auditor:** 8 shortcuts
- **Branch Accountant:** 7 shortcuts
- **Central Store:** 7 shortcuts
- **Branch Store:** 6 shortcuts
- **Reception:** 7 shortcuts
- **TOTAL:** 63 shortcuts

---

### 3. Help Overlay Component (`KeyboardShortcutOverlay`)
**File:** `frontend/src/components/KeyboardShortcutOverlay.tsx`

**Features:**
- ✅ Triggered by `?` key from anywhere
- ✅ Tabbed interface (one tab per module)
- ✅ Priority color coding (high=indigo, medium=amber, low=gray)
- ✅ Keyboard navigation (Escape to close)
- ✅ Responsive design (mobile-friendly)
- ✅ Auto-focuses current module tab
- ✅ Alternative keys display (`F2 or /`)
- ✅ Formatted shortcut badges (`Ctrl+P`, `Alt+H`, `↓`, `↑`)

**Usage:**
```typescript
import { KeyboardShortcutOverlay, useKeyboardShortcutOverlay } from '@/components/KeyboardShortcutOverlay';

function MyComponent() {
  const shortcutOverlay = useKeyboardShortcutOverlay('cashier');
  
  return (
    <>
      {/* Your component */}
      <KeyboardShortcutOverlay
        isOpen={shortcutOverlay.isOpen}
        onClose={shortcutOverlay.close}
        currentModule="cashier"
      />
    </>
  );
}
```

---

## 🚀 NEXT STEPS: INTEGRATE INTO MODULES

### Step 1: Cashier Module Integration

**File to modify:** `frontend/src/app/dashboard/cashier/page.tsx`

**Add at top of component:**
```typescript
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { KeyboardShortcutOverlay, useKeyboardShortcutOverlay } from '@/components/KeyboardShortcutOverlay';
import { SHORTCUTS } from '@/config/keyboardShortcuts';

function CashierPageContent() {
  const shortcutOverlay = useKeyboardShortcutOverlay('cashier');
  
  // Focus scan input (F2 or /)
  useKeyboardShortcut(['f2', '/'], () => {
    inputRef.current?.focus();
  }, { enabled: activeTab === 'station' });
  
  // Process payment (Ctrl+P)
  useKeyboardShortcut('ctrl+p', () => {
    if (billData && !isProcessing) {
      handlePayment();
    }
  }, { enabled: activeTab === 'station' && !!billData });
  
  // Generate bill (Ctrl+Shift+P)
  useKeyboardShortcut('ctrl+shift+p', () => {
    if (cart.length > 0 && isPOSType) {
      // Generate bill logic
    }
  }, { enabled: activeTab === 'station' && isPOSType });
  
  // Clear cart (Ctrl+N)
  useKeyboardShortcut('ctrl+n', () => {
    if (isPOSType) {
      setCart([]);
    } else {
      setBillData(null);
      setScanInput('');
    }
  }, { enabled: activeTab === 'station' });
  
  // M-Pesa mode (Ctrl+M)
  useKeyboardShortcut('ctrl+m', () => {
    setPaymentMethod('mpesa');
    setPaymentFlowChoice('mpesa');
  }, { enabled: activeTab === 'station' });
  
  // Cash mode (Ctrl+1)
  useKeyboardShortcut('ctrl+1', () => {
    setPaymentMethod('cash');
    setPaymentFlowChoice('cash');
  }, { enabled: activeTab === 'station' });
  
  // M-Pesa payment (Ctrl+2)
  useKeyboardShortcut('ctrl+2', () => {
    setPaymentMethod('mpesa');
    setPaymentFlowChoice('mpesa');
  }, { enabled: activeTab === 'station' });
  
  // Card payment (Ctrl+3)
  useKeyboardShortcut('ctrl+3', () => {
    setPaymentMethod('card');
    setPaymentFlowChoice('card');
  }, { enabled: activeTab === 'station' });
  
  // View logbook (Alt+L)
  useKeyboardShortcut('alt+l', () => {
    setActiveTab('logbook');
  });
  
  // View insights (Alt+I)
  useKeyboardShortcut('alt+i', () => {
    setActiveTab('insights');
  });
  
  return (
    <>
      {/* Existing component JSX */}
      
      {/* Add help overlay */}
      <KeyboardShortcutOverlay
        isOpen={shortcutOverlay.isOpen}
        onClose={shortcutOverlay.close}
        currentModule="cashier"
      />
    </>
  );
}
```

---

### Step 2: POS Module Integration

**File to modify:** `frontend/src/app/dashboard/pos-kitchen/pos-tab.tsx`

**Add at top of component:**
```typescript
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';
import { KeyboardShortcutOverlay, useKeyboardShortcutOverlay } from '@/components/KeyboardShortcutOverlay';

export function POSTab({ onOrderCreated }: POSTabProps) {
  const shortcutOverlay = useKeyboardShortcutOverlay('pos');
  
  // Focus search (F2 or /)
  useKeyboardShortcut(['f2', '/'], () => {
    const searchInput = document.querySelector('input[placeholder*="Search menu"]') as HTMLInputElement;
    searchInput?.focus();
  });
  
  // Send to kitchen (Ctrl+S)
  useKeyboardShortcut('ctrl+s', () => {
    if (cart.length > 0 && !isSubmitting) {
      handleCreateOrder();
    }
  }, { enabled: cart.length > 0 && !isSubmitting });
  
  // Generate bill (Ctrl+P)
  useKeyboardShortcut('ctrl+p', () => {
    if (cart.length > 0) {
      // Generate bill for current cart
      const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      // ... bill generation logic
    }
  }, { enabled: cart.length > 0 });
  
  // New order / Clear cart (Ctrl+N)
  useKeyboardShortcut('ctrl+n', () => {
    clearCart();
  }, { enabled: cart.length > 0 });
  
  // Dine-in mode (Ctrl+D)
  useKeyboardShortcut('ctrl+d', () => {
    setOrderType('dine_in');
  });
  
  // Takeaway mode (Ctrl+T)
  useKeyboardShortcut('ctrl+t', () => {
    setOrderType('takeaway');
  });
  
  // Room service mode (Ctrl+R)
  useKeyboardShortcut('ctrl+r', () => {
    setOrderType('room_service');
  });
  
  // Cash payment (Ctrl+1)
  useKeyboardShortcut('ctrl+1', () => {
    setPaymentMethod('cash');
  });
  
  // M-Pesa payment (Ctrl+2)
  useKeyboardShortcut('ctrl+2', () => {
    setPaymentMethod('mpesa');
  });
  
  // Card payment (Ctrl+3)
  useKeyboardShortcut('ctrl+3', () => {
    setPaymentMethod('card');
  });
  
  return (
    <>
      {/* Existing component JSX */}
      
      {/* Add help overlay */}
      <KeyboardShortcutOverlay
        isOpen={shortcutOverlay.isOpen}
        onClose={shortcutOverlay.close}
        currentModule="pos"
      />
    </>
  );
}
```

---

### Step 3: Add Shortcut Badges to Buttons (Optional Enhancement)

**Example for Cashier payment button:**
```typescript
<button
  onClick={handlePayment}
  disabled={isProcessing}
  className="btn-primary"
>
  <span>Process Payment</span>
  <kbd className="ml-2 px-1.5 py-0.5 text-[10px] font-mono bg-white/20 rounded">
    Ctrl+P
  </kbd>
</button>
```

---

## 🧪 TESTING CHECKLIST

### Infrastructure Tests:
- [x] Hook compiles without errors
- [x] Registry exports correctly
- [x] Overlay component renders
- [x] Help overlay opens with `?` key
- [x] Help overlay closes with `Escape` key

### Cashier Module Tests:
- [ ] `F2` or `/` focuses scan input
- [ ] `Ctrl+P` processes payment (when bill loaded)
- [ ] `Ctrl+Shift+P` generates bill (POS mode)
- [ ] `Ctrl+N` clears cart/bill
- [ ] `Ctrl+M` switches to M-Pesa
- [ ] `Ctrl+1/2/3` switches payment methods
- [ ] `Alt+L` switches to logbook tab
- [ ] `Alt+I` switches to insights tab
- [ ] Shortcuts disabled when typing in input fields
- [ ] Shortcuts disabled when modal is open

### POS Module Tests:
- [ ] `F2` or `/` focuses item search
- [ ] `Ctrl+S` sends order to kitchen
- [ ] `Ctrl+P` generates bill
- [ ] `Ctrl+N` clears cart
- [ ] `Ctrl+D/T/R` switches order types
- [ ] `Ctrl+1/2/3` switches payment methods
- [ ] Shortcuts don't interfere with barcode scanner
- [ ] Shortcuts disabled when typing in input fields
- [ ] Shortcuts disabled when modal is open

### Cross-Module Tests:
- [ ] `?` opens help overlay from any module
- [ ] Help overlay shows correct module shortcuts
- [ ] Tab switching works in help overlay
- [ ] Priority colors display correctly
- [ ] Alternative keys display correctly (`F2 or /`)
- [ ] Formatted shortcuts display correctly (`Ctrl+P`, `Alt+H`)

---

## 🔧 TROUBLESHOOTING

### Issue: Shortcuts not working
**Solution:** Check browser console for errors, verify hook is called inside component

### Issue: Shortcuts firing in input fields
**Solution:** Ensure `disableInInputs: true` is set (default)

### Issue: Shortcuts firing when modal open
**Solution:** Ensure `modalSafe: true` is set (default)

### Issue: Barcode scanner conflicts with POS shortcuts
**Solution:** Barcode scanner already checks `e.target` — no conflict expected

### Issue: Browser shortcuts override app shortcuts
**Solution:** Use `preventDefault: true` (default) or choose different keys

---

## 📊 METRICS

### Code Added:
- **Hook:** ~250 lines
- **Registry:** ~350 lines
- **Overlay:** ~200 lines
- **Total:** ~800 lines

### Shortcuts Defined:
- **Total:** 63 shortcuts across 8 modules
- **High Priority:** 28 shortcuts
- **Medium Priority:** 25 shortcuts
- **Low Priority:** 10 shortcuts

### Integration Effort:
- **Per Module:** ~30-50 lines of code
- **Cashier:** ~10 shortcuts = ~40 lines
- **POS:** ~14 shortcuts = ~50 lines
- **Total for Phase 1B:** ~90 lines

---

## 🎯 SUCCESS CRITERIA

- [x] Custom hook created and tested
- [x] Shortcut registry created with all 7 modules
- [x] Help overlay component created
- [ ] Cashier module integrated (ready for integration)
- [ ] POS module integrated (ready for integration)
- [ ] No conflicts with existing keyboard handlers
- [ ] No browser shortcut conflicts
- [ ] Works in Tauri desktop app (web-based shortcuts)
- [ ] Help overlay accessible from all modules

---

## 🚀 DEPLOYMENT

### Development:
```bash
# No build needed - TypeScript files compile automatically
# Just import and use in components
```

### Production:
```bash
cd frontend
npm run build
# Deploy as usual
```

### Tauri Desktop App:
```bash
# Web-based shortcuts work automatically
# For global shortcuts (work when app not focused), add to src-tauri/src/main.rs:
use tauri::GlobalShortcutManager;

fn register_shortcuts(app: &tauri::App) {
  let mut shortcuts = app.global_shortcut_manager();
  shortcuts.register("Alt+H", || {
    // Navigate to home
  });
}
```

---

**Status:** Infrastructure complete, ready for module integration  
**Next:** Integrate into Cashier and POS modules, then test
