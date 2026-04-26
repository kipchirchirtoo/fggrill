# Food Control System - Testing Guide

## Test Environment Setup

### Prerequisites
1. Database migration completed successfully
2. Backend server running
3. Frontend development server running
4. Test user accounts with appropriate roles:
   - Manager
   - Chef
   - Storekeeper
   - Branch Accountant
   - Auditor

### Test Data Requirements
- At least 2 branches configured
- Menu items with recipes defined
- Inventory items with cost_per_unit set
- Active staff shifts

---

## Test Scenarios

### Scenario 1: Buffet Event Workflow

**Objective**: Test complete buffet lifecycle from creation to variance calculation

**Steps**:
1. **Create Buffet Event** (Manager)
   - Navigate to `/dashboard/branch-accounting/buffet`
   - Click "New Buffet Event"
   - Fill in event details:
     - Name: "Sunday Brunch Buffet"
     - Date: Tomorrow's date
     - Expected Guests: 50
     - Price per Guest: KES 1500
   - Add menu items:
     - Chicken Curry (1 portion per guest)
     - Rice (1 portion per guest)
     - Salad (0.5 portions per guest)
   - Submit form

2. **Open Buffet** (Manager/Chef)
   - Navigate to buffet detail page
   - Click "Open Buffet"
   - Verify status changes to "ACTIVE"

3. **Close Buffet** (Manager/Chef)
   - Click "Close Buffet"
   - Enter actual guest count: 48
   - Add notes: "2 guests cancelled last minute"
   - Submit

4. **Verify Variance Calculation**
   - Check variance report appears
   - Verify theoretical vs actual calculations
   - Check variance cost is calculated

**Expected Results**:
- ✅ Buffet created with auto-generated number
- ✅ Status transitions: PLANNED → ACTIVE → CLOSED
- ✅ Variance calculated based on guest difference
- ✅ Revenue calculated correctly

---

### Scenario 2: Catering Event Workflow

**Objective**: Test catering event from booking to P&L generation

**Steps**:
1. **Create Catering Event** (Manager)
   - Navigate to `/dashboard/branch-accounting/catering`
   - Click "New Catering Event"
   - Step 1 - Event Details:
     - Event Name: "Corporate Lunch"
     - Date: Next week
     - Client: "ABC Corporation"
     - Contact: "0712345678"
     - Venue: "ABC Offices, Westlands"
     - Expected Guests: 100
     - Price per Guest: KES 2000
   - Step 2 - Menu Items:
     - Add 3-4 menu items with quantities
   - Step 3 - Review and confirm

2. **Allocate Stock** (Storekeeper)
   - Navigate to event detail page
   - Click "Allocate Stock"
   - Select ingredients and quantities
   - Submit allocation

3. **Complete Event** (Manager)
   - Record actual guests: 95
   - Record stock returns (if any)
   - Click "Complete Event"

4. **Review P&L**
   - Check event P&L is generated
   - Verify revenue, cost, and profit calculations
   - Check profit margin percentage

**Expected Results**:
- ✅ Event created with auto-generated number
- ✅ Stock allocated and tracked
- ✅ P&L generated with correct calculations
- ✅ Profit margin displayed

---

### Scenario 3: Shift Close & P&L Generation

**Objective**: Test automatic shift P&L generation on shift close

**Steps**:
1. **Setup Shift**
   - Ensure active shift exists
   - Process some POS sales during shift
   - Create/close a buffet during shift (optional)

2. **Close Shift**
   - Navigate to shift management
   - Check out from shift
   - Verify shift status changes to "completed"

3. **Verify P&L Generation**
   - Navigate to `/dashboard/branch-accounting/shift-pnl`
   - Find the closed shift
   - Verify P&L was auto-generated

4. **Review P&L Details**
   - Click on shift P&L
   - Check all tabs:
     - Overview
     - POS Analysis
     - Buffet (if applicable)
     - Variance Detail
   - Verify calculations:
     - Total Revenue (POS + Buffet + Catering)
     - Theoretical COGS (from recipes)
     - Actual COGS (from stock usage)
     - Variance
     - Gross Profit
     - Food Cost %

**Expected Results**:
- ✅ P&L auto-generated on shift close
- ✅ All revenue streams included
- ✅ Variance calculated correctly
- ✅ Food cost % within threshold (or flagged if not)

---

### Scenario 4: Variance Explanation Workflow

**Objective**: Test variance identification and explanation process

**Steps**:
1. **Identify Variances**
   - Navigate to `/dashboard/branch-accounting/variance`
   - Review list of unexplained variances
   - Check variance severity badges

2. **Explain Variance** (Chef/Manager)
   - Click "Explain" on a variance
   - Enter explanation: "Portion sizes increased due to customer feedback"
   - Submit

3. **Flag Variance** (Manager)
   - For high-value variances, click "Flag"
   - Verify variance is flagged for audit

4. **Verify in P&L**
   - Navigate back to shift P&L
   - Check variance detail tab
   - Verify explanation appears

**Expected Results**:
- ✅ Variances listed with severity levels
- ✅ Explanations saved and displayed
- ✅ Flagged variances marked appropriately
- ✅ Unexplained count decreases

---

### Scenario 5: Accountant Review Workflow

**Objective**: Test accountant P&L review and approval

**Steps**:
1. **Review Pending P&Ls** (Branch Accountant)
   - Navigate to `/dashboard/branch-accounting/shift-pnl`
   - Filter by "PENDING_REVIEW"
   - Review summary cards

2. **Drill Down into P&L**
   - Click on a shift P&L
   - Review all tabs thoroughly
   - Check for high variances
   - Verify all variances are explained

3. **Approve P&L**
   - Click "Approve"
   - Add notes: "Reviewed and approved. Food cost within acceptable range."
   - Submit

4. **Flag P&L** (if issues found)
   - Click "Flag for Audit"
   - Add notes: "Food cost exceeds 35%. Requires investigation."
   - Submit

**Expected Results**:
- ✅ P&L status changes to "REVIEWED" or "FLAGGED"
- ✅ Notes saved and visible
- ✅ Notification sent to relevant parties
- ✅ P&L appears in appropriate filter

---

### Scenario 6: Recipe Locking

**Objective**: Test recipe lock/unlock functionality

**Steps**:
1. **Lock Recipe** (Manager)
   - Navigate to `/dashboard/kitchen-operations/recipes`
   - Select a recipe
   - Click "Lock Recipe"
   - Verify lock icon appears

2. **Attempt to Edit Locked Recipe** (Chef)
   - Try to edit the locked recipe
   - Verify edit is blocked

3. **View Recipe History**
   - Click "View History"
   - Verify lock event is logged

4. **Unlock Recipe** (Manager)
   - Click "Unlock Recipe"
   - Verify recipe can be edited again

**Expected Results**:
- ✅ Recipe locked successfully
- ✅ Edits blocked when locked
- ✅ Lock/unlock events logged
- ✅ Only managers can lock/unlock

---

### Scenario 7: Branch Configuration

**Objective**: Test branch-specific configuration

**Steps**:
1. **Access Settings** (Admin)
   - Navigate to `/dashboard/admin/settings/food-control`
   - Select a branch

2. **Configure Thresholds**
   - Set variance threshold: KES 200
   - Set variance threshold: 10%
   - Set food cost alert: 35%

3. **Configure Waste Management**
   - Enable/disable waste reason codes
   - Toggle "Require Manager Approval for Theft"

4. **Configure Workflows**
   - Toggle "Auto-Submit to Accountant on Shift Close"
   - Save configuration

5. **Test Configuration**
   - Close a shift
   - Verify auto-submit works (if enabled)
   - Create variance above threshold
   - Verify alert is triggered

**Expected Results**:
- ✅ Configuration saved per branch
- ✅ Thresholds enforced correctly
- ✅ Auto-submit works as configured
- ✅ Alerts triggered appropriately

---

## Performance Testing

### Load Test: Shift Close with Large Dataset

**Objective**: Verify system handles shift close with many transactions

**Setup**:
- Create shift with 100+ POS orders
- Each order has 5+ menu items
- Include 2 buffets and 1 catering event

**Test**:
1. Close the shift
2. Measure time to:
   - Calculate variance
   - Generate P&L
   - Complete shift close

**Acceptance Criteria**:
- ✅ Shift close completes within 30 seconds
- ✅ No database timeouts
- ✅ All calculations accurate

---

## Integration Testing

### Test: POS Sale → Auto-Deduction → Variance

**Objective**: Verify end-to-end flow from POS to variance

**Steps**:
1. Record opening stock levels
2. Process POS sale with recipe-linked items
3. Verify ingredients auto-deducted
4. Close shift
5. Verify variance calculated
6. Check theoretical matches recipe quantities

**Expected Results**:
- ✅ Auto-deduction works
- ✅ Ledger entries created
- ✅ Variance calculated correctly
- ✅ Theoretical matches recipes

---

## Security Testing

### Test: RBAC Enforcement

**Objective**: Verify role-based access control

**Test Cases**:
1. **Chef Access**
   - ✅ Can view recipes
   - ✅ Can explain variances
   - ✅ Can close buffets
   - ❌ Cannot lock recipes
   - ❌ Cannot approve P&Ls

2. **Accountant Access**
   - ✅ Can view all P&Ls
   - ✅ Can approve P&Ls
   - ✅ Can view variances
   - ❌ Cannot create buffets
   - ❌ Cannot lock recipes

3. **Manager Access**
   - ✅ Can create buffets/catering
   - ✅ Can lock/unlock recipes
   - ✅ Can approve P&Ls
   - ✅ Can configure settings

4. **Auditor Access**
   - ✅ Can view all branches
   - ✅ Can flag P&Ls
   - ✅ Can view all variances
   - ❌ Cannot create events

---

## Error Handling Testing

### Test: Invalid Data Handling

**Test Cases**:
1. **Negative Guest Count**
   - Try to enter -5 guests
   - ✅ Validation error shown

2. **Missing Required Fields**
   - Submit form without required fields
   - ✅ Error messages displayed

3. **Duplicate Buffet Number**
   - Database should auto-generate unique numbers
   - ✅ No duplicates possible

4. **Network Failure**
   - Simulate network error during save
   - ✅ Error message shown
   - ✅ Data not lost

---

## Regression Testing

### Test: Existing Functionality Not Broken

**Verify**:
- ✅ POS sales still work
- ✅ Kitchen requisitions still work
- ✅ Recipe management still works
- ✅ Stock movements still work
- ✅ Shift management still works
- ✅ Existing reports still work

---

## User Acceptance Testing

### Test: Real User Workflows

**Participants**:
- Branch Manager
- Chef
- Storekeeper
- Branch Accountant
- Auditor

**Tasks**:
1. Create and manage a buffet event
2. Create and manage a catering event
3. Review and explain variances
4. Review and approve shift P&Ls
5. Configure branch settings

**Feedback Areas**:
- UI/UX intuitiveness
- Workflow efficiency
- Missing features
- Bug reports
- Performance issues

---

## Test Checklist

### Pre-Deployment Checklist

- [ ] All database migrations run successfully
- [ ] All API endpoints tested and working
- [ ] All frontend pages load without errors
- [ ] RBAC enforced correctly
- [ ] Calculations verified accurate
- [ ] Performance acceptable under load
- [ ] Error handling works correctly
- [ ] Existing functionality not broken
- [ ] User documentation created
- [ ] Training materials prepared
- [ ] Rollback plan documented

---

## Bug Reporting Template

```
**Bug Title**: [Short description]

**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Result**:

**Actual Result**:

**Screenshots**: [Attach if applicable]

**Environment**:
- Browser: 
- User Role: 
- Branch: 

**Additional Notes**:
```

---

## Test Results Log

| Test Scenario | Date | Tester | Status | Notes |
|--------------|------|--------|--------|-------|
| Buffet Workflow | | | | |
| Catering Workflow | | | | |
| Shift Close | | | | |
| Variance Explanation | | | | |
| Accountant Review | | | | |
| Recipe Locking | | | | |
| Branch Configuration | | | | |
| Performance Test | | | | |
| Integration Test | | | | |
| Security Test | | | | |
| Error Handling | | | | |
| Regression Test | | | | |
| UAT | | | | |

---

**Testing Status**: Ready to Begin  
**Last Updated**: 2026-04-25
