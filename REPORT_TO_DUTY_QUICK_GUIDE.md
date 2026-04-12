# 🚀 Report to Duty - Quick Start Guide

## 📍 What is Report to Duty?

A feature that allows managers to confirm when employees have actually returned to work after approved leave. This ensures accurate tracking and helps identify employees who haven't returned on schedule.

---

## ⚡ Quick Setup (3 Steps)

### Step 1: Apply Database Migration
```bash
APPLY_REPORT_TO_DUTY_MIGRATION.bat
```

### Step 2: Restart Services
```bash
# Backend
cd backend
pm2 restart backend

# Frontend  
cd frontend
pm2 restart frontend
```

### Step 3: Test
1. Login as Branch Manager
2. Go to Leave Management
3. Find an approved leave
4. Click "Report to Duty"

---

## 📋 How to Use

### For Approved Leave (Employee Not Yet Returned)

1. **Find the Leave Request**
   - Go to: Branch Manager → Staff → Leave Management
   - Look for approved leave without "RETURNED" badge

2. **Open Details**
   - Click the eye icon (👁️) on the request
   - Details modal opens

3. **Report to Duty**
   - Click green "Report to Duty" button
   - Modal opens with:
     - Employee information
     - Leave period
     - Return date field (defaults to today)
     - Optional notes field

4. **Confirm Return**
   - Adjust return date if needed
   - Add notes (optional):
     - "Returned on schedule"
     - "Returned early - emergency resolved"
     - "Extended leave by 2 days - medical certificate"
   - Click "Confirm Return to Duty"

5. **Verify**
   - ✅ "RETURNED" badge appears in table
   - ✅ Green confirmation banner in details
   - ✅ Employee is now tracked as returned

---

## 🎯 Common Scenarios

### Scenario 1: On-Time Return
```
Leave: May 1-5, 2026
Employee returns: May 6, 2026 (as scheduled)
Action: Report to duty with today's date
Notes: "Returned on schedule"
```

### Scenario 2: Early Return
```
Leave: May 1-10, 2026
Employee returns: May 7, 2026 (3 days early)
Action: Report to duty with May 7
Notes: "Returned early - family emergency resolved"
```

### Scenario 3: Late Return
```
Leave: May 1-5, 2026
Employee returns: May 8, 2026 (2 days late)
Action: Report to duty with May 8
Notes: "Extended leave - medical certificate provided"
```

### Scenario 4: No-Show
```
Leave: May 1-5, 2026
Expected return: May 6, 2026
Today: May 8, 2026
Status: Not reported to duty
Action: Follow up with employee
```

---

## 🔍 Visual Indicators

### In Table View
- **No Badge** = Pending/Rejected leave
- **APPROVED Badge** = Approved, not yet returned
- **APPROVED + RETURNED Badges** = Approved and returned ✅

### In Details Modal
- **Green "Report to Duty" Button** = Ready to confirm return
- **Green Banner** = Already reported, shows return date

---

## 📊 Benefits

### For Managers
- ✅ Know exactly when employees return
- ✅ Identify overdue returns quickly
- ✅ Document early returns or extensions
- ✅ Maintain accurate records

### For HR/Auditors
- ✅ Generate leave completion reports
- ✅ Audit leave usage
- ✅ Track patterns and trends

### For Payroll
- ✅ Accurate leave day calculations
- ✅ Proper deductions for extensions
- ✅ Credits for early returns

---

## 🆘 Troubleshooting

### "Can only report to duty for approved leave requests"
**Solution**: Leave must be approved first. Approve the leave, then report to duty.

### "Employee has already reported to duty"
**Solution**: Return was already confirmed. View details to see when they returned.

### Return date validation error
**Solution**: Return date cannot be before leave start date. Check the dates.

### Button not showing
**Solution**: 
- Ensure leave is approved
- Ensure employee hasn't already reported
- Refresh the page

---

## 💡 Pro Tips

1. **Report Promptly** - Confirm returns on the day employees come back
2. **Use Notes** - Document any deviations from schedule
3. **Check Overdue** - Review unreported returns regularly
4. **Early Returns** - Always document why employee returned early
5. **Extensions** - Note if medical certificate or approval was provided

---

## 📁 Database Fields Added

| Field | Description |
|-------|-------------|
| `actual_return_date` | Date employee actually returned |
| `reported_to_duty` | TRUE if confirmed, FALSE if not |
| `reported_at` | Timestamp of confirmation |
| `reported_by` | Manager who confirmed |
| `report_notes` | Optional notes about return |

---

## ✅ Checklist

Before using:
- [ ] Migration applied
- [ ] Backend restarted
- [ ] Frontend restarted
- [ ] Tested with sample leave request

During use:
- [ ] Verify leave is approved
- [ ] Check return date is correct
- [ ] Add notes if applicable
- [ ] Confirm submission successful
- [ ] Verify "RETURNED" badge appears

---

## 📞 Need Help?

Contact your system administrator or IT support team.

---

**Quick Access**: Branch Manager → Staff → Leave Management → Eye Icon → Report to Duty

**Status**: ✅ Ready to Use After Migration
