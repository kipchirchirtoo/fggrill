# Kyogong - Role-Based Workflows

## Complete Workflow Documentation

---

## 1. SUPER_ADMIN Workflows

### 1.1 User Management Flow
```
Create User → Assign Role → Assign Branch → Activate Account
    ↓
Edit User → Update Details/Role → Save Changes
    ↓
Deactivate/Delete User → Confirm → Process
```

### 1.2 Branch Management Flow
```
View All Branches → Select Branch → View Details
    ↓
Create Branch → Fill Details → Assign Settings → Save
    ↓
Edit Branch → Modify Settings → Update
```

### 1.3 System Configuration Flow
```
System Settings → Edit Parameters → Save
    ↓
Backup Data → Schedule/Manual → Execute
    ↓
View Audit Logs → Filter by Date/Module → Export
```

---

## 2. GENERAL_MANAGER Workflows

### 2.1 Branch Performance Review
```
Dashboard → View All Branches → Compare Metrics
    ↓
Select Branch → View Detailed Performance → Generate Report
    ↓
Identify Issues → Take Action → Monitor
```

### 2.2 Stock Request Approval (High Value)
```
Receive Notification → Review Request Details
    ↓
Check Budget/Availability → Approve/Reject/Delegate
    ↓
Notify Requestor → Track Fulfillment
```

### 2.3 Staff Management
```
View All Staff → Filter by Branch/Role
    ↓
View Performance → Review Metrics → Take Action
    ↓
Approve Leave Requests → Process Transfers → Update Records
```

---

## 3. BRANCH_MANAGER Workflows

### 3.1 Daily Operations
```
Morning Check → Review Today's Tasks
    ↓
Check Arrivals → Prepare Rooms → Staff Assignments
    ↓
Monitor Operations → Handle Issues → End of Day Report
```

### 3.2 Staff Scheduling
```
View Staff List → Check Availability
    ↓
Create/Edit Schedule → Assign Shifts → Publish
    ↓
Handle Replacements → Approve Overtime → Track Attendance
```

### 3.3 Stock Oversight
```
View Branch Stock → Check Low Stock Alerts
    ↓
Review Pending Requests → Create New Requests
    ↓
Confirm Incoming Deliveries → Verify Stock Levels
```

---

## 4. CENTRAL_STOREKEEPER Workflows

### 4.1 Item Management
```
VIEW CATALOG           CREATE ITEM              UPDATE ITEM
    ↓                       ↓                       ↓
Search/Filter         Fill Details            Edit Details
    ↓                       ↓                       ↓
View Details          Generate SKU            Update Stock
    ↓                       ↓                       ↓
Check History         Set Thresholds          Adjust Prices
                            ↓
                          SAVE
```

### 4.2 Request Processing Flow
```
┌─────────────────────────────────────────────────────────────┐
│                  STOCK REQUEST FLOW                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. RECEIVE REQUEST                                          │
│     ├── View pending requests list                           │
│     ├── Check request details (items, quantities)            │
│     └── Verify branch information                            │
│                                                              │
│  2. REVIEW & VALIDATE                                        │
│     ├── Check central warehouse stock                        │
│     ├── Verify budget/approval level                         │
│     └── Assess priority                                      │
│                                                              │
│  3. DECISION                                                 │
│     ├── APPROVE → Proceed to dispatch                        │
│     ├── PARTIAL → Adjust quantities → Approve remaining      │
│     └── REJECT → Provide reason → Notify branch              │
│                                                              │
│  4. CREATE DISPATCH (if approved)                            │
│     ├── Select items from approved request                   │
│     ├── Assign vehicle and driver                            │
│     ├── Generate dispatch note                               │
│     └── Update status to IN_TRANSIT                          │
│                                                              │
│  5. TRACK DELIVERY                                           │
│     ├── Monitor dispatch status                              │
│     ├── Receive confirmation from branch                     │
│     └── Update stock records                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Dispatch Creation Flow
```
Select Items → Choose Quantities → Select Destination Branch
    ↓
Assign Vehicle → Assign Driver → Add Notes
    ↓
Generate Dispatch Note → Print/Send → Mark as Dispatched
    ↓
Track Delivery → Receive Confirmation → Close Dispatch
```

### 4.4 Stock Take Flow
```
Initiate Stock Take → Select Type (Full/Partial/Spot)
    ↓
Generate Count Sheet → Count Physical Stock
    ↓
Enter Counts → Calculate Variance → Review Discrepancies
    ↓
Approve Adjustments → Update Records → Generate Report
```

---

## 5. BRANCH_STOREKEEPER Workflows

### 5.1 Stock Request Flow
```
┌─────────────────────────────────────────────────────────────┐
│                  BRANCH REQUEST FLOW                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. IDENTIFY NEED                                            │
│     ├── Check current stock levels                           │
│     ├── Review low stock alerts                              │
│     └── Check upcoming requirements                          │
│                                                              │
│  2. CREATE REQUEST                                           │
│     ├── Select items from catalog                            │
│     ├── Enter required quantities                            │
│     ├── Set priority level                                   │
│     └── Add notes/justification                              │
│                                                              │
│  3. SUBMIT & TRACK                                           │
│     ├── Submit request                                       │
│     ├── Monitor status (PENDING → APPROVED/REJECTED)         │
│     └── Receive notifications                                │
│                                                              │
│  4. RECEIVE DELIVERY                                         │
│     ├── View incoming dispatches                             │
│     ├── Verify items and quantities                          │
│     ├── Note any discrepancies                               │
│     └── Confirm receipt                                      │
│                                                              │
│  5. UPDATE STOCK                                             │
│     ├── Stock automatically updated                          │
│     └── Generate receipt report                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Stock Out (Usage) Flow
```
Select Item → Enter Quantity Used → Select Reason
    ↓
Add Notes → Submit → Stock Automatically Decreased
    ↓
Record in Movement History → Generate Usage Report
```

### 5.3 Delivery Confirmation Flow
```
View Incoming Dispatches → Select Dispatch
    ↓
Verify Items Received → Note Discrepancies (if any)
    ↓
Confirm Receipt → Stock Updated → Notify Central
```

---

## 6. RECEPTIONIST Workflows

### 6.1 Guest Check-In Flow
```
┌─────────────────────────────────────────────────────────────┐
│                    CHECK-IN FLOW                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. LOCATE RESERVATION                                       │
│     ├── Search by guest name/booking ID                      │
│     ├── Verify reservation details                           │
│     └── Check payment status                                 │
│                                                              │
│  2. GUEST VERIFICATION                                       │
│     ├── Request ID document                                  │
│     ├── Verify guest identity                                │
│     └── Collect signature                                    │
│                                                              │
│  3. ROOM ASSIGNMENT                                          │
│     ├── Check room readiness                                 │
│     ├── Assign room (or change if needed)                    │
│     └── Generate room key                                    │
│                                                              │
│  4. COMPLETE CHECK-IN                                        │
│     ├── Update booking status                                │
│     ├── Provide room information                             │
│     ├── Note special requests                                │
│     └── Welcome guest                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Guest Check-Out Flow
```
Locate Guest/Room → Verify Identity
    ↓
Generate Final Bill → Calculate Charges (Room + Services)
    ↓
Process Payment → Print Receipt → Collect Key
    ↓
Update Room Status → Notify Housekeeping → Complete
```

### 6.3 Reservation Flow
```
Check Availability → Select Room Type → Select Dates
    ↓
Enter Guest Details → Add Special Requests
    ↓
Calculate Total → Confirm Booking → Send Confirmation
```

---

## 7. HOUSEKEEPING Workflows

### 7.1 Daily Task Flow
```
Start Shift → View Assigned Rooms
    ↓
For Each Room:
├── Check Room Status
├── Perform Cleaning (based on type)
├── Restock Supplies
├── Report Issues
└── Mark as Complete
    ↓
End of Shift → Submit Report
```

### 7.2 Room Cleaning Flow
```
┌─────────────────────────────────────────────────────────────┐
│                  CLEANING WORKFLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  CHECKOUT CLEAN (Deep)           STAY-OVER (Light)          │
│  ──────────────────              ──────────────────          │
│  Strip bedding                   Make bed                    │
│  Clean bathroom fully            Refresh towels              │
│  Vacuum/mop floors               Empty trash                 │
│  Dust all surfaces               Restock supplies            │
│  Restock all amenities           Light dusting               │
│  Inspect room                    Quick inspection            │
│  Mark ready                      Mark ready                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Issue Reporting Flow
```
Identify Issue (maintenance, damage, missing items)
    ↓
Document with Details → Take Photo (optional)
    ↓
Submit Report → Notify Maintenance/Manager
    ↓
Track Resolution
```

---

## 8. MAINTENANCE Workflows

### 8.1 Work Order Processing
```
┌─────────────────────────────────────────────────────────────┐
│                  MAINTENANCE WORKFLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. RECEIVE WORK ORDER                                       │
│     ├── View new tickets                                     │
│     ├── Assess priority                                      │
│     └── Accept/assign                                        │
│                                                              │
│  2. DIAGNOSE                                                 │
│     ├── Visit location                                       │
│     ├── Identify problem                                     │
│     └── Determine requirements (parts/tools)                 │
│                                                              │
│  3. EXECUTE REPAIR                                           │
│     ├── Request parts if needed                              │
│     ├── Perform repair                                       │
│     └── Test functionality                                   │
│                                                              │
│  4. COMPLETE                                                 │
│     ├── Document work done                                   │
│     ├── Update status                                        │
│     └── Notify requester                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Preventive Maintenance Flow
```
View Schedule → Check Due Items
    ↓
Perform Inspection → Document Findings
    ↓
Execute Maintenance → Update Records → Schedule Next
```

---

## 9. RESTAURANT Workflows

### 9.1 Order Processing Flow
```
┌─────────────────────────────────────────────────────────────┐
│                    ORDER FLOW                                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  RECEIVE ORDER                                               │
│      ↓                                                       │
│  Order appears in kitchen display                            │
│      ↓                                                       │
│  Mark as PREPARING                                           │
│      ↓                                                       │
│  Prepare each item                                           │
│      ↓                                                       │
│  Mark as READY                                               │
│      ↓                                                       │
│  Notify server/guest                                         │
│      ↓                                                       │
│  Deliver to table/room                                       │
│      ↓                                                       │
│  Mark as SERVED                                              │
│      ↓                                                       │
│  Close order                                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 9.2 Inventory Request Flow
```
Check Stock Levels → Identify Low Items
    ↓
Create Request to Store → Submit
    ↓
Receive Items → Update Kitchen Inventory
```

---

## 10. ACCOUNTANT Workflows

### 10.1 Transaction Recording
```
Receive Transaction Info → Categorize (Income/Expense)
    ↓
Enter Details → Attach Documents → Save
    ↓
Reconcile → Generate Reports
```

### 10.2 Invoice Processing
```
Create Invoice → Add Line Items → Calculate Total
    ↓
Send to Customer → Track Payment Status
    ↓
Record Payment → Update Accounts → Close Invoice
```

### 10.3 Payroll Processing
```
Get Attendance Data → Calculate Hours
    ↓
Apply Rates/Deductions → Generate Payslips
    ↓
Review → Approve → Process Payments
    ↓
Update Records → Send Payslips
```

---

## 11. EMPLOYEE Self-Service Workflows

### 11.1 Leave Request Flow
```
Check Leave Balance → Select Leave Type
    ↓
Choose Dates → Add Reason → Submit Request
    ↓
Manager Reviews → Approve/Reject
    ↓
Receive Notification → Update Calendar
```

### 11.2 Profile Update Flow
```
View Profile → Edit Personal Info
    ↓
Update Contact/Emergency Info → Submit
    ↓
HR Reviews (if needed) → Update Approved
```

---

## WORKFLOW STATUS CODES

| Status | Meaning |
|--------|---------|
| PENDING | Awaiting action |
| IN_PROGRESS | Being processed |
| APPROVED | Approved and proceeding |
| REJECTED | Declined with reason |
| COMPLETED | Successfully finished |
| CANCELLED | Cancelled by user |

## API ENDPOINTS REFERENCE

See `/lib/api.ts` for complete API documentation.
