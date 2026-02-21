# Super Admin Guide: Creating Kyogong Cashier Accounts

## 🎯 Quick Reference

This guide shows Super Admin how to create accounts and set PINs for Kyogong Branch cashiers.

---

## 📋 Available Kyogong Cashier Roles

| Role Name | Code | Sales Point | Responsibilities |
|-----------|------|-------------|------------------|
| **Kyogong SPA Cashier** | `kyogong_spa_cashier` | SPA Cashier | Massage, Waxing, Nail, Saloon, Sauna, Kinyozi |
| **Kyogong Executive Bar Cashier** | `kyogong_executive_bar_cashier` | Executive Bar | Bar + Restaurant sales, Staff management |
| **Kyogong Sports Bar Cashier** | `kyogong_sports_bar_cashier` | Sports Bar | Bar + Restaurant sales, Pool tokens |
| **Kyogong Reception Cashier** | `kyogong_reception_cashier` | Reception | All services, Petty cash, Dynamic services |

---

## 🚀 Step-by-Step: Create Cashier Account

### Step 1: Access User Management

1. Login as Super Admin
2. Navigate to: **Dashboard → Admin → User Management**
3. Click **"Create New User"** or **"Add User"**

### Step 2: Fill Basic Information

```
First Name: [Enter first name]
Last Name: [Enter last name]
Email: [Enter email - e.g., spa.cashier@kyogong.com]
Employee ID: [Optional - e.g., KYG-SPA-001]
Phone Number: [Enter phone]
```

### Step 3: Select Role

**Choose from dropdown:**
- Kyogong SPA Cashier
- Kyogong Executive Bar Cashier
- Kyogong Sports Bar Cashier
- Kyogong Reception Cashier

### Step 4: Assign Branch

**Important:** Select **Kyogong Branch** from branch dropdown

### Step 5: Set Password & PIN

```
Password: [Temporary password for first login]
POS PIN: [4-6 digit PIN for POS login]
```

**PIN Requirements:**
- 4-6 digits only
- Must be unique
- Used for shift operations
- Easy to remember for cashier

### Step 6: Additional Details (Optional)

```
Department: Finance / Cashier
Position: [Role-specific position]
Start Date: [Employment start date]
Status: Active
```

### Step 7: Save & Notify

1. Click **"Create User"** or **"Save"**
2. System creates account
3. Notify cashier of:
   - Email address
   - Temporary password
   - POS PIN
   - Instructions to change password on first login

---

## 🔢 PIN Management

### Setting a PIN

**During User Creation:**
- Enter PIN in "POS PIN" field
- 4-6 digits
- Save with user account

**After User Creation:**
1. Go to User Management
2. Find the cashier user
3. Click **"Edit"** or **"Manage"**
4. Look for **"Set PIN"** or **"POS PIN"** field
5. Enter new PIN
6. Save changes

### Resetting a PIN

**If cashier forgets PIN:**
1. User Management → Find user
2. Click **"Reset PIN"** or **"Edit PIN"**
3. Enter new PIN
4. Save and notify cashier

---

## 📝 Example: Creating SPA Cashier

### Complete Example

```
=== BASIC INFORMATION ===
First Name: Mary
Last Name: Wanjiku
Email: mary.wanjiku@kyogong.com
Employee ID: KYG-SPA-001
Phone: 0712345678

=== ROLE & ACCESS ===
Role: Kyogong SPA Cashier
Branch: Kyogong Branch
Department: Cashier
Position: SPA Cashier

=== CREDENTIALS ===
Password: TempPass123! (Change on first login)
POS PIN: 1234

=== STATUS ===
Status: Active
Start Date: 2026-02-19
```

**After Creation:**
1. ✅ Account created
2. ✅ PIN set to 1234
3. ✅ Can login at POS with PIN
4. ✅ Can open shifts for SPA sales point
5. ✅ Can process SPA service transactions

---

## 🎯 Quick Setup for All 4 Cashiers

### 1. SPA Cashier
```
Name: [Staff Name]
Email: spa.cashier@kyogong.com
Role: Kyogong SPA Cashier
PIN: [4-digit PIN]
Branch: Kyogong
```

### 2. Executive Bar Cashier
```
Name: [Staff Name]
Email: execbar.cashier@kyogong.com
Role: Kyogong Executive Bar Cashier
PIN: [4-digit PIN]
Branch: Kyogong
```

### 3. Sports Bar Cashier
```
Name: [Staff Name]
Email: sportsbar.cashier@kyogong.com
Role: Kyogong Sports Bar Cashier
PIN: [4-digit PIN]
Branch: Kyogong
```

### 4. Reception Cashier
```
Name: [Staff Name]
Email: reception.cashier@kyogong.com
Role: Kyogong Reception Cashier
PIN: [4-digit PIN]
Branch: Kyogong
```

---

## ✅ Verification Checklist

After creating each cashier account:

- [ ] User appears in User Management list
- [ ] Role is correctly assigned
- [ ] Branch is set to Kyogong
- [ ] PIN is set (4-6 digits)
- [ ] Status is Active
- [ ] Email is correct
- [ ] Cashier can login with PIN
- [ ] Cashier can access their sales point
- [ ] Cashier can open a shift
- [ ] Cashier can create transactions

---

## 🔍 Troubleshooting

### Issue: Cannot create user with Kyogong role
**Solution**: Ensure backend is updated with new roles. Restart backend server if needed.

### Issue: PIN not working
**Solution**: 
1. Verify PIN is 4-6 digits
2. Check PIN is saved in database
3. Try resetting PIN
4. Ensure user status is Active

### Issue: Cashier cannot access sales point
**Solution**:
1. Verify role is correctly assigned
2. Check branch is set to Kyogong
3. Ensure sales points are created in database
4. Verify API routes include new roles

### Issue: Role not appearing in dropdown
**Solution**:
1. Clear browser cache
2. Refresh page
3. Check frontend is updated with new roles
4. Restart frontend if needed

---

## 📊 Monitoring Cashier Activity

### View Cashier Shifts

**As Super Admin:**
1. Navigate to: **Dashboard → Kyogong → Shift Management**
2. Filter by:
   - Cashier name
   - Sales point
   - Date range
   - Status
3. View shift details:
   - Opening/closing balances
   - Total sales
   - Variances
   - Transactions

### Audit Trail

**Check cashier actions:**
1. Navigate to: **Dashboard → Audit Logs**
2. Filter by:
   - User ID (cashier)
   - Action type (OPEN, CLOSE, TRANSACTION)
   - Date range
3. Review:
   - Shift operations
   - Transaction history
   - PIN changes
   - Login attempts

---

## 🔐 Security Best Practices

### PIN Security

✅ **DO:**
- Use unique PINs for each cashier
- Change PINs regularly (every 3 months)
- Keep PINs confidential
- Reset PIN if compromised
- Log all PIN changes

❌ **DON'T:**
- Use sequential PINs (1234, 2345, etc.)
- Share PINs between cashiers
- Write PINs on paper near POS
- Use obvious PINs (birthdays, etc.)
- Reuse old PINs

### Account Security

✅ **DO:**
- Set strong temporary passwords
- Require password change on first login
- Monitor login attempts
- Deactivate accounts when staff leaves
- Review permissions regularly

❌ **DON'T:**
- Share admin credentials
- Leave accounts active for ex-staff
- Use same password for multiple users
- Skip security training

---

## 📞 Support Contacts

**For Super Admin:**
- Technical Issues: IT Support
- Role Questions: System Administrator
- Training: HR Department

**For Cashiers:**
- Login Issues: Super Admin
- PIN Reset: Super Admin
- Shift Problems: Branch Accountant
- Technical Issues: IT Support

---

## 📚 Related Documentation

- [KYOGONG_CASHIER_ROLES_ADDED.md](./KYOGONG_CASHIER_ROLES_ADDED.md) - Technical implementation details
- [KYOGONG_SHIFT_POS_SYSTEM_ANALYSIS.md](./KYOGONG_SHIFT_POS_SYSTEM_ANALYSIS.md) - Complete system specification
- [KYOGONG_PHASE1_COMPLETE.md](./KYOGONG_PHASE1_COMPLETE.md) - Implementation guide
- [KYOGONG_QUICK_START.md](./KYOGONG_QUICK_START.md) - API testing guide

---

## 🎉 Summary

**You can now:**
- ✅ Create Kyogong cashier accounts
- ✅ Assign specific roles for each sales point
- ✅ Set and manage PINs
- ✅ Monitor cashier activity
- ✅ Manage user access and permissions

**Next Steps:**
1. Create accounts for all 4 cashiers
2. Set unique PINs for each
3. Train cashiers on their POS interface
4. Monitor first few shifts
5. Adjust as needed

---

**Last Updated**: February 19, 2026  
**Version**: 1.0  
**Status**: Ready for Use ✅
