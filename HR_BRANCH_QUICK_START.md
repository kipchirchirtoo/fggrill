# HR Branch View - Quick Start

## What Changed?
HR Managers can now view and filter data by branch!

## How to Use

### 1. Login as HR Manager
- Use your HR Manager credentials
- You'll be redirected to `/dashboard/hr`

### 2. Select a Branch
- Look for the branch selector in the top-right corner
- Click it to see available branches
- Select a branch to view its data

### 3. View Branch-Specific Data
- **Total Workforce** - Staff count for selected branch
- **Monthly Payroll** - Payroll total for selected branch
- **Pending Leave** - Leave requests from selected branch
- **Active Today** - Staff present today at selected branch

### 4. Switch Between Branches
- Click the branch selector again
- Choose a different branch
- Data updates automatically

### 5. View All Branches
- Select "All Branches" from dropdown
- See combined data from all branches

## Where It Works

✅ **HR Dashboard** - Main stats and overview
✅ **Staff Attendance** - View attendance by branch

## Quick Test

1. Go to `/dashboard/hr`
2. Check if branch selector appears (top-right)
3. Select "Branch 2 (BOMET TOWN)"
4. Verify stats update
5. Go to "Attendance" → "Staff Attendance"
6. Verify staff list shows only Branch 2 staff

## Visual Guide

```
┌─────────────────────────────────────────────┐
│ HR Command                    [Branch ▼] 🔄 │
│ Personnel management                         │
│ 📍 Branch 2 (BOMET TOWN)                    │
├─────────────────────────────────────────────┤
│                                              │
│ [Total Workforce] [Monthly Payroll]         │
│ [Pending Leave]   [Active Today]            │
│                                              │
└─────────────────────────────────────────────┘
```

## Troubleshooting

**Branch selector not showing?**
- You might only have access to one branch
- This is normal - selector only shows for multi-branch access

**Data not updating?**
- Click the refresh button (🔄)
- Check your internet connection
- Try selecting the branch again

**Can't see certain branches?**
- Contact your administrator
- You might not have access to those branches

---

**Need Help?** Check `HR_BRANCH_VIEW_COMPLETE.md` for detailed documentation.
