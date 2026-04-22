# Mobile App Missing Features - Comprehensive Analysis

## Executive Summary
The mobile app is missing **MANY critical screens and features** that exist in the web app. This document provides a complete breakdown of what needs to be implemented.

---

## 🏪 CENTRAL STORE - Missing Screens

### ✅ Currently Implemented (Mobile)
1. Dashboard
2. Requisitions (NEW)
3. Packing Station (NEW)
4. Dispatch Management (NEW)
5. Stock Intake
6. Dispatch History
7. GRN
8. Stock Take
9. Waste Log
10. Low Stock
11. Receiving

### ❌ MISSING Screens (From Web App)

#### 1. **Master Inventory Screen** (`/dashboard/central-store/inventory`)
- **Purpose**: Complete catalog management with CRUD operations
- **Features**:
  - Add/Edit/Delete items
  - Search and filter by category
  - Pagination (50 items per page)
  - Stats: Total SKU, In Stock, Low Stock, Out of Stock
  - Quick "Receive Stock" button per item
  - AI-powered attribute suggestions when creating items
  - Cost price and reorder level management
- **Status**: ❌ NOT IMPLEMENTED

#### 2. **Foodstuffs Store** (`/dashboard/central-store/foodstuffs`)
- **Purpose**: Dedicated view for food category items
- **Features**:
  - Filter items by category='food'
  - Show estimated valuation
  - Low stock alerts specific to food items
- **Status**: ❌ NOT IMPLEMENTED

#### 3. **Bar Items Store** (`/dashboard/central-store/bar-items`)
- **Purpose**: Dedicated view for beverage/bar items
- **Features**:
  - Advanced filtering for bar-related items (wines, spirits, beers, etc.)
  - Keyword matching for beverages
  - Beverage valuation tracking
- **Status**: ❌ NOT IMPLEMENTED

#### 4. **Receiving/Barcode Scanning** (`/dashboard/central-store/receiving`)
- **Purpose**: Complete goods receiving workflow with barcode scanning
- **Features**:
  - **Setup Step**: Select supplier, link to PO, invoice/delivery note
  - **Scanning Mode**: Real-time barcode scanning with sound effects
  - **Manual Mode**: Search and select items from catalog
  - **Unknown Barcode Handling**: Create new items on-the-fly
  - **Barcode Generation**: Auto-generate and print barcode labels
  - **GRN Creation**: Submit goods received note
  - **PO Integration**: Pre-populate items from purchase orders
- **Status**: ⚠️ PARTIALLY IMPLEMENTED (basic receiving exists, but missing barcode scanning, PO integration, and advanced features)

#### 5. **Suppliers Management** (`/dashboard/central-store/suppliers`)
- **Purpose**: Complete supplier/vendor management
- **Features**:
  - Add/Edit/Delete suppliers
  - Contact person, phone, email, address
  - KRA PIN and VAT registration tracking
  - Withholding VAT configuration
  - Quick "Receive Goods" button per supplier
  - Link to supplier detail page
  - Tabs: Suppliers | POs | GRN | Invoices | Payments | Reports
- **Status**: ❌ NOT IMPLEMENTED

#### 6. **Vehicles Management** (`/dashboard/central-store/vehicles`)
- **Purpose**: Fleet management for delivery vehicles
- **Features**:
  - Add/Edit/Delete vehicles
  - Registration number, make, model, capacity
  - Status tracking: available, in_use, maintenance, out_of_service
  - Vehicle assignment to dispatches
- **Status**: ❌ NOT IMPLEMENTED

#### 7. **Drivers Management** (`/dashboard/central-store/drivers`)
- **Purpose**: Driver registry and management
- **Features**:
  - Add/Edit/Delete drivers
  - License number and expiry tracking
  - Phone contact information
  - Status: active/inactive
  - Integration with staff registry
  - Driver assignment to dispatches
- **Status**: ❌ NOT IMPLEMENTED

#### 8. **Reports & Analytics** (`/dashboard/central-store/reports`)
- **Purpose**: Generate branded PDF/Excel reports
- **Features**:
  - Stock reports
  - Dispatch reports
  - Supplier reports
  - Branded PDF export with company logo
  - Excel export for data analysis
- **Status**: ❌ NOT IMPLEMENTED

#### 9. **Stationery Store** (`/dashboard/central-store/stationery`)
- **Purpose**: Office supplies and stationery management
- **Features**: Similar to Foodstuffs/Bar Items but for office category
- **Status**: ❌ NOT IMPLEMENTED

#### 10. **Procurement Module** (`/dashboard/central-store/procurement`)
- **Purpose**: Purchase order management
- **Features**:
  - Create/Edit/Approve purchase orders
  - Link POs to suppliers
  - Track PO status
  - GRN against PO
- **Status**: ❌ NOT IMPLEMENTED

---

## 🏢 BRANCH STORE - Missing Screens

### ✅ Currently Implemented (Mobile)
1. Dashboard
2. Receive Delivery
3. OTP Entry
4. Count Items
5. Discrepancy Reporting
6. Complete Delivery
7. Branch Stock
8. Raise Requisition
9. Receipt History
10. Waste Log

### ❌ MISSING Screens (From Web App)

#### 1. **Stock Requests Management** (`/dashboard/branch-store/requests`)
- **Purpose**: Complete requisition workflow with real-time search
- **Features**:
  - **Real-time Search Dropdown**: Search catalog as you type with instant results
  - **Quick Actions**: "Add all low stock items" button
  - **Request Status Tracking**: PENDING, REVIEWED, APPROVED, REJECTED, DELIVERED
  - **Item Details**: Show central stock levels when selecting items
  - **Quantity Adjustment**: Inline quantity editing
  - **Reason Field**: Explain why items are needed
  - **Detail Modal**: View full request details with item breakdown
  - **Auditor Features**: Flag anomalies, verify requests
  - **Export Ledger**: Generate branded PDF reports
- **Status**: ⚠️ PARTIALLY IMPLEMENTED (basic requisition exists, but missing advanced search, quick actions, and auditor features)

#### 2. **Branch Stock Management** (`/dashboard/branch-store/stock`)
- **Purpose**: Complete inventory management with catalog integration
- **Features**:
  - **Dual View**: Current Stock tab + Master Catalog tab
  - **Stock Adjustment Modal**: Manual adjustments, wastage, usage, initial stock
  - **Add from Catalog**: Browse master catalog and add items to branch
  - **Category Filtering**: Filter by food, beverage, toiletries, etc.
  - **Low Stock Alerts**: Visual indicators for items below reorder level
  - **Quick Actions**: Adjust stock, request replenishment
  - **Export Ledger**: Generate comprehensive stock audit reports
  - **Stats Dashboard**: In Stock SKUs, Low Stock Items, Master Catalog count
- **Status**: ⚠️ PARTIALLY IMPLEMENTED (basic stock view exists, but missing catalog integration, adjustment modal, and advanced features)

#### 3. **Kitchen Requisitions** (`/dashboard/branch-store/kitchen-requisitions`)
- **Purpose**: Department-specific requisitions from branch store
- **Features**:
  - Kitchen staff can request items from branch store
  - Approval workflow
  - Issue tracking
- **Status**: ❌ NOT IMPLEMENTED

#### 4. **Kitchen Usage Tracking** (`/dashboard/branch-store/kitchen-usage`)
- **Purpose**: Track items issued to kitchen
- **Features**:
  - Record kitchen consumption
  - Usage reports
  - Cost tracking
- **Status**: ❌ NOT IMPLEMENTED

#### 5. **Stock Out/Issue Items** (`/dashboard/branch-store/stock-out`)
- **Purpose**: Issue items to departments
- **Features**:
  - Select items to issue
  - Specify department/recipient
  - Reduce branch stock
  - Audit trail
- **Status**: ❌ NOT IMPLEMENTED

#### 6. **Stock Takes** (`/dashboard/branch-store/stock-takes`)
- **Purpose**: Physical inventory counting
- **Features**:
  - Create stock take sessions
  - Count items
  - Compare physical vs system
  - Generate variance reports
  - Adjust stock based on count
- **Status**: ❌ NOT IMPLEMENTED

#### 7. **Suppliers (Branch Level)** (`/dashboard/branch-store/suppliers`)
- **Purpose**: Branch-specific supplier management
- **Features**: Similar to central store suppliers but branch-scoped
- **Status**: ❌ NOT IMPLEMENTED

#### 8. **Reports** (`/dashboard/branch-store/reports`)
- **Purpose**: Branch-specific reports
- **Features**:
  - Stock reports
  - Usage reports
  - Requisition history
  - Branded PDF export
- **Status**: ❌ NOT IMPLEMENTED

---

## 🚗 DRIVER - Missing Features

### ✅ Currently Implemented (Mobile)
1. Driver Dashboard
2. GPS Tracking
3. Dispatch Code Entry
4. Today's Deliveries Stats
5. Logout

### ❌ MISSING Features

#### 1. **Active Delivery Details**
- **Purpose**: Show full details of current delivery
- **Features**:
  - Destination branch
  - Items list with quantities
  - Delivery instructions
  - Contact information
  - Navigation to maps
- **Status**: ❌ NOT IMPLEMENTED

#### 2. **Delivery History**
- **Purpose**: View past deliveries
- **Features**:
  - Completed deliveries list
  - Delivery details
  - Proof of delivery
  - Ratings/feedback
- **Status**: ❌ NOT IMPLEMENTED

#### 3. **Vehicle Inspection**
- **Purpose**: Pre-trip vehicle checks
- **Features**:
  - Checklist for vehicle condition
  - Photo upload
  - Report issues
- **Status**: ❌ NOT IMPLEMENTED

#### 4. **Delivery Confirmation**
- **Purpose**: Complete delivery workflow
- **Features**:
  - OTP verification
  - Signature capture
  - Photo proof of delivery
  - Notes/comments
- **Status**: ❌ NOT IMPLEMENTED

---

## 🔍 AUDITOR - Missing Screens

### ✅ Currently Implemented (Mobile)
1. Auditor Dashboard
2. Auditor Approvals
3. Auditor Daily Logs
4. Auditor Watchlist
5. Auditor Audit Log
6. Auditor Deliveries
7. Auditor Delivery Detail

### ❌ MISSING Screens (From Web App)

#### 1. **Stock Request Oversight** (Enhanced)
- **Purpose**: Review and audit all branch requisitions
- **Features**:
  - Stats: Total Requisitions, Pending Approval, With Rejections
  - Flag anomalies
  - Verify requests
  - Export ledger
  - Detailed item-level review
- **Status**: ⚠️ PARTIALLY IMPLEMENTED (basic approvals exist, but missing oversight features)

#### 2. **Financial Verification**
- **Purpose**: Verify financial transactions
- **Features**: Branch-level financial audits
- **Status**: ❌ NOT IMPLEMENTED

#### 3. **Kitchen Requisitions Audit**
- **Purpose**: Review kitchen requisitions
- **Status**: ❌ NOT IMPLEMENTED

#### 4. **Kitchen Usage Audit**
- **Purpose**: Audit kitchen consumption
- **Status**: ❌ NOT IMPLEMENTED

#### 5. **Kitchen Wastage Audit**
- **Purpose**: Review wastage reports
- **Status**: ❌ NOT IMPLEMENTED

#### 6. **Bar Stock Audit**
- **Purpose**: Audit bar inventory
- **Status**: ❌ NOT IMPLEMENTED

#### 7. **Branch Audit Module**
- **Purpose**: Comprehensive branch audits
- **Sub-modules**:
  - Business M-Pesa
  - Credit Bills
  - Invoices
  - Stock Take
  - Void Bills
- **Status**: ❌ NOT IMPLEMENTED

#### 8. **Shift Verification**
- **Purpose**: Verify cashier shifts
- **Status**: ❌ NOT IMPLEMENTED

#### 9. **Sold Items Audit**
- **Purpose**: Audit POS sales
- **Status**: ❌ NOT IMPLEMENTED

#### 10. **Staff Audit**
- **Purpose**: Audit staff activities
- **Status**: ❌ NOT IMPLEMENTED

---

## 📊 SUPERADMIN - Missing Screens

### ✅ Currently Implemented (Mobile)
1. Admin Dashboard
2. Live Delivery
3. Waste Report
4. Discrepancy Alerts
5. User Management
6. Audit Log
7. OTP Override

### ❌ MISSING Screens (Extensive - 20+ modules in web app)

The superadmin role in the web app has access to **ALL modules** across the entire system. The mobile app only implements a tiny fraction. Missing modules include:

- Fleet Management
- Drivers Management
- Finance & Budgets
- Guests Management
- Housekeeping
- HR & Payroll
- ID Cards
- Maintenance
- Rates Management
- Reservations
- Restaurant/POS Control
- Rooms Management
- Settings
- Suppliers
- System Configuration (Branches, Departments, Roles)
- Vehicles
- Wastage Reports
- And many more...

**Status**: ❌ MOSTLY NOT IMPLEMENTED (only 7 out of 50+ screens exist)

---

## 🎯 Priority Implementation Roadmap

### **Phase 1: Critical Missing Features (HIGH PRIORITY)**

1. **Central Store - Master Inventory Screen**
   - Full CRUD operations
   - Search, filter, pagination
   - Stats dashboard

2. **Central Store - Suppliers Management**
   - Complete supplier CRUD
   - VAT/PIN tracking
   - Quick receive goods

3. **Central Store - Vehicles & Drivers**
   - Fleet management
   - Driver registry
   - Assignment to dispatches

4. **Branch Store - Enhanced Stock Management**
   - Stock adjustment modal
   - Catalog integration
   - Add items from master catalog

5. **Branch Store - Enhanced Requisitions**
   - Real-time search dropdown
   - Quick actions
   - Auditor features

### **Phase 2: Important Features (MEDIUM PRIORITY)**

6. **Central Store - Foodstuffs & Bar Items**
   - Category-specific views
   - Valuation tracking

7. **Central Store - Enhanced Receiving**
   - Barcode scanning
   - PO integration
   - Auto-generate barcodes

8. **Branch Store - Kitchen Modules**
   - Kitchen requisitions
   - Kitchen usage
   - Stock out/issue

9. **Branch Store - Stock Takes**
   - Physical counting
   - Variance reports
   - Stock adjustments

10. **Driver - Enhanced Features**
    - Active delivery details
    - Delivery history
    - Delivery confirmation

### **Phase 3: Advanced Features (LOW PRIORITY)**

11. **Reports & Analytics**
    - Branded PDF export
    - Excel export
    - Custom report builder

12. **Procurement Module**
    - Purchase orders
    - GRN against PO
    - Supplier invoices

13. **Auditor - Extended Modules**
    - Financial verification
    - Kitchen audits
    - Branch audit suite

14. **Superadmin - Additional Modules**
    - Gradually add more admin features
    - System configuration
    - Advanced settings

---

## 📝 Implementation Notes

### Design Consistency
- All new screens must follow the existing mobile app design patterns
- Use React Native Paper components
- Follow the color scheme from `theme.ts`
- Maintain consistent spacing and shadows

### API Integration
- Verify all backend APIs exist before implementing screens
- Use existing API clients (`dispatch.api.ts`, `inventory.api.ts`, etc.)
- Add new API methods as needed

### Navigation
- Register all new screens in `RootNavigator.tsx`
- Update dashboard screens with new navigation buttons
- Ensure proper role-based access control

### Testing
- Test each screen with real backend data
- Verify workflow end-to-end
- Test on both Android and iOS
- Test with different user roles

---

## 🎨 UI/UX Improvements Needed

### Current Issues
1. **Inconsistent Card Styles**: Some screens use different card components
2. **Missing Loading States**: Not all screens show proper loading indicators
3. **Poor Error Handling**: Some screens don't handle errors gracefully
4. **No Empty States**: Missing "no data" illustrations
5. **Inconsistent Button Styles**: Mix of different button components

### Recommendations
1. Create reusable component library
2. Standardize loading/error/empty states
3. Add animations and transitions
4. Improve form validation feedback
5. Add pull-to-refresh everywhere
6. Implement skeleton loaders

---

## 📱 Mobile-Specific Features to Add

### Features that make sense on mobile but don't exist in web:

1. **Offline Mode**
   - Cache data locally
   - Sync when online
   - Queue actions

2. **Push Notifications**
   - New dispatch assigned
   - Requisition approved
   - Low stock alerts
   - Delivery updates

3. **Camera Integration**
   - Barcode scanning
   - Photo proof of delivery
   - Damage documentation
   - Receipt scanning

4. **Biometric Authentication**
   - Fingerprint login
   - Face ID support

5. **Voice Commands**
   - Voice-to-text for notes
   - Voice search

6. **Geofencing**
   - Auto-check-in at branch
   - Delivery zone alerts

---

## 🔧 Technical Debt to Address

1. **Remove Obsolete Files**: Already deleted ApprovedRequestsScreen and CreateDispatchScreen
2. **Consolidate API Clients**: Some methods are duplicated across files
3. **Type Safety**: Add proper TypeScript types for all API responses
4. **Error Boundaries**: Add React error boundaries
5. **Performance**: Optimize list rendering with FlatList
6. **Code Splitting**: Lazy load screens
7. **State Management**: Consider Redux/Zustand for complex state

---

## ✅ Summary

**Total Web App Screens**: ~150+
**Mobile App Screens**: ~40
**Missing Screens**: ~110+

**Completion Rate**: ~27%

The mobile app needs **significant work** to match the web app's functionality. Focus on Phase 1 critical features first, then gradually add Phase 2 and Phase 3 features based on user feedback and priorities.
