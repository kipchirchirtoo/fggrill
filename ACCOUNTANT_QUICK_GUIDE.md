# Accountant Quick Guide - Conference & Banking Features

## 🎯 Quick Reference for Accountants

This guide shows how to use the new Conference Invoice and Banking features.

---

## 📋 Feature 1: Conference Invoice with Variable Attendance

### Scenario
A 3-day conference with different participant counts each day:
- Day 1: 15 people
- Day 2: 30 people
- Day 3: 20 people

### Step-by-Step

**Step 1: Receptionist Records Daily Attendance**
(Done by reception staff each day)
1. Navigate to: **Dashboard → Conference → Bookings**
2. Find the conference booking
3. Click **"Record Daily Attendance"**
4. Enter:
   - Date: 2026-02-20
   - Participants: 15
   - Meals: Breakfast (KES 500), Lunch (KES 800)
5. Save
6. Repeat for each day with actual attendance

**Step 2: Generate Invoice (Accountant)**
1. Navigate to: **Dashboard → Conference → Bookings**
2. Find the conference booking
3. Click **"Generate Invoice with Attendance"**
4. System calculates:
   - Hall Rental: KES 50,000 (fixed)
   - Day 1 Meals: 15 × (500 + 800) = KES 19,500
   - Day 2 Meals: 30 × (500 + 800) = KES 39,000
   - Day 3 Meals: 20 × (500 + 800) = KES 26,000
   - Amenities: KES 5,000 (fixed)
   - **Total: KES 139,500**
5. Review breakdown
6. Generate PDF invoice
7. Send to client

### Invoice Breakdown Example

```
CONFERENCE INVOICE
Invoice #: CNF-20260220-1234

Hall Rental (3 days)                    KES 50,000
----------------------------------------
Daily Meals:
  Feb 20, 2026 (15 pax)                 KES 19,500
  Feb 21, 2026 (30 pax)                 KES 39,000
  Feb 22, 2026 (20 pax)                 KES 26,000
----------------------------------------
Subtotal Meals                          KES 84,500

Amenities (Projector, Sound System)     KES  5,000
----------------------------------------
GRAND TOTAL                             KES 139,500
```

---

## 💰 Feature 2: Banking Module

### Daily Banking Workflow

**Morning: Record Previous Day's Deposit**

1. Navigate to: **Dashboard → Banking → Transactions**
2. Click **"Record Transaction"**
3. Fill in:
   - Transaction Date: 2026-02-19
   - Type: DEPOSIT
   - Bank: Equity Bank
   - Account: 0123456789
   - Amount: KES 150,000
   - Reference: DEP-20260219-001
   - Source: Daily Cash Sales
   - Payment Method: CASH
   - Purpose: Daily cash sales deposit
4. Upload bank slip (optional)
5. Click **"Save"** (Status: PENDING)

**Afternoon: Approve Transactions**

1. Navigate to: **Dashboard → Banking → Pending Transactions**
2. Review transaction details
3. Verify bank slip
4. Click **"Approve"**
5. Balance automatically updates

**Record Withdrawal**

1. Click **"Record Transaction"**
2. Fill in:
   - Type: WITHDRAWAL
   - Bank: Equity Bank
   - Account: 0123456789
   - Amount: KES 50,000
   - Reference: WTH-20260219-001
   - Destination: Supplier Payment
   - Purpose: Payment to ABC Suppliers for inventory
3. Save and approve

### Monthly Reconciliation

**End of Month: Bank Reconciliation**

1. Navigate to: **Dashboard → Banking → Reconciliations**
2. Click **"New Reconciliation"**
3. Select bank account: Equity Bank - 0123456789
4. Enter:
   - Reconciliation Date: 2026-02-28
   - Statement Balance: KES 800,000 (from bank statement)
   - Book Balance: KES 795,000 (from system)
5. System calculates variance: KES 5,000
6. Explain variance: "Outstanding cheques: KES 5,000"
7. Save

### Banking Dashboard

**View Summary**

Navigate to: **Dashboard → Banking → Summary**

**Shows:**
- Total Balance: KES 1,800,000 (across all accounts)
- This Month Deposits: KES 500,000
- This Month Withdrawals: KES 200,000
- Pending Transactions: 5
- Approved Transactions: 45

**Account List:**
- Equity Bank (Current): KES 800,000
- KCB Bank (Savings): KES 1,000,000

---

## 🔍 Common Tasks

### Task 1: Daily Cash Deposit

**Frequency:** Daily  
**Time:** 10:00 AM

1. Collect cash from cashier
2. Go to bank
3. Get deposit slip
4. Return to office
5. Record in system:
   - Banking → Record Transaction
   - Type: DEPOSIT
   - Upload slip photo
   - Save
6. Approve transaction
7. File physical slip

### Task 2: Supplier Payment

**Frequency:** As needed  
**Process:**

1. Receive approved payment request
2. Prepare cheque/bank transfer
3. Record in system:
   - Banking → Record Transaction
   - Type: WITHDRAWAL
   - Purpose: Supplier Payment
   - Reference: Cheque number or transfer ref
4. Get approval from manager
5. Process payment
6. Update status to APPROVED

### Task 3: Month-End Reconciliation

**Frequency:** Monthly  
**Time:** First week of new month

1. Download bank statements
2. Compare with system records
3. Identify differences:
   - Outstanding cheques
   - Deposits in transit
   - Bank charges
4. Record reconciliation in system
5. Explain variances
6. Get manager approval

### Task 4: Conference Invoice Generation

**Frequency:** After conference ends  
**Process:**

1. Verify all daily attendance recorded
2. Generate invoice with attendance
3. Review calculations
4. Send to client
5. Record payment when received

---

## 📊 Reports Available

### Banking Reports

**1. Transaction History**
- Path: Banking → Transactions
- Filters: Date range, Type, Status, Bank
- Export: Excel, PDF

**2. Account Balances**
- Path: Banking → Accounts
- Shows: Current balance, Opening balance, Activity

**3. Reconciliation History**
- Path: Banking → Reconciliations
- Shows: All reconciliations, Variances, Status

### Conference Reports

**1. Invoice with Attendance**
- Path: Conference → Bookings → Invoice
- Shows: Daily breakdown, Total calculations

**2. Attendance Summary**
- Path: Conference → Bookings → Attendance
- Shows: Daily participant counts, Meal costs

---

## ⚠️ Important Notes

### Banking

✅ **DO:**
- Record transactions daily
- Upload bank slips
- Approve transactions promptly
- Reconcile monthly
- Explain variances

❌ **DON'T:**
- Approve without verification
- Skip reconciliations
- Delete approved transactions
- Share bank account details

### Conference Invoicing

✅ **DO:**
- Verify attendance records before invoicing
- Review calculations
- Keep daily attendance records
- Generate invoice after conference ends

❌ **DON'T:**
- Generate invoice before conference ends
- Skip daily attendance recording
- Modify attendance after invoicing

---

## 🔐 Security

### Access Levels

**Accountant Can:**
- View all banking transactions
- Record transactions
- Approve transactions (if authorized)
- View reconciliations
- Generate conference invoices

**Branch Accountant Can:**
- View branch banking transactions
- Record branch transactions
- View branch reconciliations
- Generate branch conference invoices

**Auditor Can:**
- View all transactions (read-only)
- View all reconciliations (read-only)
- Export reports

---

## 📞 Support

### Common Issues

**Issue:** Cannot approve transaction  
**Solution:** Check if you have approval permissions. Contact manager.

**Issue:** Balance not updating  
**Solution:** Ensure transaction is APPROVED. Refresh page.

**Issue:** Variance in reconciliation  
**Solution:** Check for outstanding cheques, deposits in transit, bank charges.

**Issue:** Conference invoice total incorrect  
**Solution:** Verify all daily attendance records. Check meal prices.

### Contact

**Technical Support:** IT Department  
**Banking Questions:** Finance Manager  
**Conference Billing:** Reception Manager

---

## 🎯 Quick Tips

1. **Record transactions daily** - Don't let them pile up
2. **Upload bank slips** - Makes verification easier
3. **Reconcile monthly** - Don't skip this step
4. **Verify attendance** - Before generating conference invoices
5. **Keep notes** - Document unusual transactions
6. **Review pending** - Check pending transactions daily
7. **Monitor balances** - Watch account balances regularly
8. **Backup slips** - Keep physical copies of bank slips

---

**Last Updated:** February 19, 2026  
**Version:** 1.0  
**Status:** Ready for Use ✅
