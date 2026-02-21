# Kitchen Usage Tracking - No Approval Required

## Status Workflow (Information Only)

The kitchen usage tracking system uses status fields for **tracking purposes only**, not for approval workflows.

### Status Values

1. **PENDING** - Items just issued to kitchen, no usage recorded yet
2. **PARTIAL** - Some items used, some remaining (auto-updated by triggers)
3. **COMPLETED** - All items accounted for (consumed/spoilt/lost/etc.)
4. **CLOSED** - Manually closed by storekeeper when done tracking

### Role Permissions

- **Branch Storekeeper**: Issue items to kitchen, record usage, close records
- **Kitchen Staff**: View their assigned items
- **Auditor**: VIEW ONLY - Can audit records but CANNOT approve/reject
- **Branch Manager**: View all records for their branch

### No Approval Process

✅ Items are immediately issued to kitchen when storekeeper creates record
✅ Usage entries are recorded in real-time
✅ Stock is automatically deducted from branch inventory
✅ Auditor can only view and audit the records

❌ No approval required from auditor
❌ No approval required from manager
❌ No pending approval status

## How It Works

1. Storekeeper issues items to kitchen → Status: PENDING
2. Kitchen staff uses items → Storekeeper records usage entries
3. System auto-updates quantities via triggers → Status: PARTIAL (if some remaining)
4. When all items accounted for → Status: COMPLETED
5. Storekeeper manually closes record → Status: CLOSED

## Auditor Role

The auditor can:
- View all kitchen usage records
- See usage entries and staff accountability
- Generate reports on wastage, losses, etc.
- Audit the accuracy of records

The auditor CANNOT:
- Approve or reject records
- Block or prevent usage recording
- Change status of records
