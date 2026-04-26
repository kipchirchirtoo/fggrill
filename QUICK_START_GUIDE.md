# Food Control System - Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Step 1: Run Database Migration (1 minute)

```bash
# Set environment variables
export SUPABASE_URL="your_supabase_url"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key"

# Run migration
cd backend
node run-food-control-migration.js
```

**Expected Output**: ✅ Migration completed successfully

---

### Step 2: Configure Your Branch (2 minutes)

1. Login as **Admin** or **Manager**
2. Navigate to: `/dashboard/admin/settings/food-control`
3. Select your branch
4. Set thresholds:
   - Variance Threshold: **KES 200**
   - Variance Threshold: **10%**
   - Food Cost Alert: **35%**
5. Enable: **Auto-Submit to Accountant on Shift Close**
6. Click **Save Configuration**

---

### Step 3: Create Your First Buffet (2 minutes)

1. Login as **Manager**
2. Navigate to: `/dashboard/branch-accounting/buffet`
3. Click **New Buffet Event**
4. Fill in details:
   - Name: "Sunday Brunch"
   - Date: Tomorrow
   - Expected Guests: 50
   - Price per Guest: KES 1500
5. Add menu items (e.g., Chicken Curry, Rice, Salad)
6. Click **Create Buffet Event**

---

## 📱 Quick Access URLs

### For Managers
- **Buffet Management**: `/dashboard/branch-accounting/buffet`
- **Catering Management**: `/dashboard/branch-accounting/catering`
- **Variance Review**: `/dashboard/branch-accounting/variance`
- **Settings**: `/dashboard/admin/settings/food-control`

### For Accountants
- **Shift P&L Review**: `/dashboard/branch-accounting/shift-pnl`
- **Variance Reports**: `/dashboard/branch-accounting/variance`

### For Chefs
- **Recipe Management**: `/dashboard/kitchen-operations/recipes`
- **Variance Explanation**: `/dashboard/branch-accounting/variance`

---

## 🎯 Common Tasks

### Create a Buffet Event
```
1. Go to Buffet Management
2. Click "New Buffet Event"
3. Fill event details
4. Add menu items with portions per guest
5. Submit
```

### Close a Buffet
```
1. Open buffet detail page
2. Click "Close Buffet"
3. Enter actual guest count
4. Add notes (optional)
5. Submit
→ Variance automatically calculated
```

### Create a Catering Event
```
1. Go to Catering Management
2. Click "New Catering Event"
3. Step 1: Event details (client, venue, guests)
4. Step 2: Menu items with quantities
5. Step 3: Review and confirm
6. Submit
```

### Explain a Variance
```
1. Go to Variance Management
2. Find unexplained variance
3. Click "Explain"
4. Enter explanation
5. Submit
→ Variance marked as explained
```

### Review Shift P&L
```
1. Go to Shift P&L Review
2. Click on pending shift
3. Review all tabs (Overview, POS, Buffet, Variance)
4. Click "Approve" or "Flag for Audit"
5. Add notes
6. Submit
```

---

## 🔑 Key Features

### Automatic Processes
- ✅ **Auto-deduction** of ingredients from POS sales
- ✅ **Auto-generation** of shift P&L on shift close
- ✅ **Auto-calculation** of variance (theoretical vs actual)
- ✅ **Auto-numbering** of buffets and catering events
- ✅ **Auto-submit** to accountant (if configured)

### Manual Processes
- 📝 Buffet/catering event creation
- 📝 Variance explanation
- 📝 P&L review and approval
- 📝 Recipe locking/unlocking
- 📝 Branch configuration

---

## 📊 Understanding the Dashboard

### Summary Cards
- **Total Revenue**: POS + Buffet + Catering
- **Gross Profit**: Revenue - Actual COGS
- **Food Cost %**: (Actual COGS / Revenue) × 100
- **Variance Cost**: Actual COGS - Theoretical COGS

### Status Badges
- **PLANNED** (Blue): Event scheduled
- **ACTIVE** (Green): Event in progress
- **CLOSED** (Gray): Event completed
- **PENDING_REVIEW** (Yellow): Awaiting accountant
- **APPROVED** (Green): Approved by accountant
- **FLAGGED** (Red): Requires audit attention

### Variance Severity
- **LOW** (Blue): <10% variance
- **MEDIUM** (Yellow): 10-20% variance
- **HIGH** (Red): >20% variance

---

## 🎓 Training Videos (To Be Created)

1. **For Managers** (10 min)
   - Creating buffet events
   - Creating catering events
   - Configuring settings

2. **For Chefs** (5 min)
   - Closing buffets
   - Explaining variances

3. **For Accountants** (15 min)
   - Reviewing shift P&Ls
   - Understanding variance reports
   - Approval workflow

4. **For Storekeepers** (5 min)
   - Allocating stock to catering
   - Tracking returns

---

## 🆘 Troubleshooting

### Migration Fails
**Problem**: "Missing Supabase credentials"  
**Solution**: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables

### Can't Create Buffet
**Problem**: "Failed to create buffet"  
**Solution**: Check that menu items exist and have recipes defined

### Variance Not Calculated
**Problem**: Variance shows as 0 or null  
**Solution**: Ensure recipes are linked to menu items and cost_per_unit is set for inventory items

### P&L Not Generated
**Problem**: No P&L after shift close  
**Solution**: Check that shift close hook is integrated in shifts.controller.ts

### Can't Access Page
**Problem**: "Access denied" or 403 error  
**Solution**: Check user role has appropriate permissions

---

## 📞 Getting Help

### Documentation
- **Full Analysis**: `FOOD_CONTROL_SYSTEM_ANALYSIS.md`
- **Implementation Status**: `FOOD_CONTROL_IMPLEMENTATION_STATUS.md`
- **Migration Instructions**: `FOOD_CONTROL_MIGRATION_INSTRUCTIONS.md`
- **Testing Guide**: `FOOD_CONTROL_TESTING_GUIDE.md`
- **Complete Summary**: `FOOD_CONTROL_COMPLETE_SUMMARY.md`

### Support Channels
- **Technical Issues**: Contact Development Team
- **User Training**: Contact Training Department
- **Feature Requests**: Contact Product Manager
- **Bug Reports**: Contact QA Team

---

## ✅ Daily Checklist

### For Managers (Morning)
- [ ] Review yesterday's shift P&Ls
- [ ] Check pending variances
- [ ] Review today's buffet/catering events

### For Chefs (During Shift)
- [ ] Monitor buffet service
- [ ] Log any wastage immediately
- [ ] Close buffets with accurate guest counts

### For Accountants (Daily)
- [ ] Review pending shift P&Ls
- [ ] Approve or flag P&Ls
- [ ] Check unexplained variances
- [ ] Review food cost trends

### For Storekeepers (As Needed)
- [ ] Allocate stock for catering events
- [ ] Track stock returns
- [ ] Update cost_per_unit for new items

---

## 🎯 Success Tips

1. **Be Accurate**: Enter actual guest counts precisely
2. **Be Timely**: Explain variances within 24 hours
3. **Be Detailed**: Provide specific explanations
4. **Be Consistent**: Follow workflows every time
5. **Be Proactive**: Review reports daily

---

## 📈 Measuring Success

### Week 1 Goals
- [ ] All staff trained
- [ ] 5+ buffets created and closed
- [ ] 2+ catering events completed
- [ ] 90%+ variances explained
- [ ] All shift P&Ls reviewed

### Month 1 Goals
- [ ] Food cost reduced by 1-2%
- [ ] 95%+ variance explanation rate
- [ ] <24 hour P&L approval time
- [ ] 80%+ user adoption

---

## 🚀 You're Ready!

The Food Control System is now ready to use. Start with creating a buffet event or reviewing a shift P&L. The system will guide you through each step.

**Remember**: The system is designed to help you, not complicate your work. If something seems confusing, refer to this guide or contact support.

---

**Happy Food Cost Controlling! 🍽️📊**
