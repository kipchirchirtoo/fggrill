# Comprehensive System Enhancements & Fixes - Specification

## 📋 Overview

This document outlines all requested enhancements and bug fixes across multiple modules.

---

## 🐛 CRITICAL BUGS TO FIX

### 1. Notifications Modal 404 Error
**Issue:** Clicking on notifications in notification modals across all modules returns 404 error  
**Impact:** High - Affects all modules  
**Root Cause:** Missing notification detail routes or incorrect routing  
**Fix Required:**
- Create notification detail pages
- Fix routing in notification modals
- Ensure notification links point to valid routes

### 2. Draft Stock Count 404 Error
**Issue:** Clicking on draft stock count in branch storekeeper dashboard returns 404  
**Impact:** Medium - Affects branch storekeepers  
**Root Cause:** Missing stock count detail/edit page  
**Fix Required:**
- Create stock count detail/edit page
- Fix routing from draft stock count list
- Ensure proper navigation

---

## 🚀 ENHANCEMENTS BY MODULE

### Module 1: Branch Storekeeper Dashboard

#### Enhancement 1.1: Supplier Management
**Requirements:**
- Add supplier database table
- Create supplier CRUD interface
- Link suppliers to purchase orders
- Track supplier performance
- Manage supplier contacts and terms

**Database Schema:**
```sql
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    supplier_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    contact_person TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    payment_terms TEXT,
    credit_limit DECIMAL(12,2),
    tax_id TEXT,
    bank_details JSONB,
    category TEXT,
    status TEXT DEFAULT 'active',
    rating DECIMAL(3,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE supplier_products (
    id SERIAL PRIMARY KEY,
    supplier_id INTEGER REFERENCES suppliers(id),
    product_name TEXT NOT NULL,
    product_code TEXT,
    unit_price DECIMAL(10,2),
    minimum_order_quantity INTEGER,
    lead_time_days INTEGER,
    is_active BOOLEAN DEFAULT TRUE
);
```

**UI Components:**
- Supplier list page with search/filter
- Add/Edit supplier form
- Supplier detail view with:
  - Contact information
  - Purchase order history
  - Performance metrics
  - Product catalog
- Supplier selection in purchase orders

---

### Module 2: Branch Manager - Shift Management

#### Enhancement 2.1: Staff Shift Management
**Requirements:**
- Create shift templates (Morning, Evening, Night)
- Assign staff to shifts
- View shift calendar
- Track shift attendance
- Swap/modify shifts
- Generate shift reports

**Database Schema:**
```sql
CREATE TABLE shift_templates (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE staff_shifts (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    staff_id UUID REFERENCES users(id),
    shift_template_id INTEGER REFERENCES shift_templates(id),
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status TEXT DEFAULT 'scheduled',
    check_in_time TIMESTAMP,
    check_out_time TIMESTAMP,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(staff_id, shift_date, start_time)
);

CREATE TABLE shift_swaps (
    id SERIAL PRIMARY KEY,
    original_shift_id INTEGER REFERENCES staff_shifts(id),
    requesting_staff_id UUID REFERENCES users(id),
    target_staff_id UUID REFERENCES users(id),
    status TEXT DEFAULT 'pending',
    reason TEXT,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP
);
```

**UI Components:**
- Shift calendar view (weekly/monthly)
- Create shift assignment interface
- Staff availability view
- Shift swap requests
- Shift reports and analytics

---

### Module 3: HR Dashboard - Enhanced Payroll

#### Enhancement 3.1: Comprehensive Payroll Deductions
**Requirements:**
- Add SHA (Social Health Authority) deduction
- Add NSSF (National Social Security Fund) deduction
- Add Uniform deduction
- Add Contributions deduction
- Add Absent days deduction
- Calculate net salary automatically
- Generate payslips with all deductions

**Database Schema:**
```sql
-- Add columns to payroll table
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS sha_deduction DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS nssf_deduction DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS uniform_deduction DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS contributions_deduction DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS absent_days INTEGER DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS absent_days_deduction DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS total_deductions DECIMAL(10,2) DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS net_salary DECIMAL(10,2) DEFAULT 0;

-- Create deduction rates table
CREATE TABLE payroll_deduction_rates (
    id SERIAL PRIMARY KEY,
    deduction_type TEXT NOT NULL,
    rate_type TEXT, -- 'percentage' or 'fixed'
    rate_value DECIMAL(10,4),
    min_amount DECIMAL(10,2),
    max_amount DECIMAL(10,2),
    effective_from DATE,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Insert default rates
INSERT INTO payroll_deduction_rates (deduction_type, rate_type, rate_value, is_active) VALUES
('SHA', 'percentage', 2.75, TRUE),
('NSSF', 'percentage', 6.00, TRUE);
```

**Calculation Logic:**
```
Gross Salary = Basic Salary + Allowances + Overtime
Total Deductions = SHA + NSSF + Uniform + Contributions + Absent Days + Tax
Net Salary = Gross Salary - Total Deductions

SHA = Gross Salary × 2.75%
NSSF = Gross Salary × 6% (capped at max)
Absent Days Deduction = (Basic Salary / Working Days) × Absent Days
```

**UI Components:**
- Enhanced payroll processing form with all deduction fields
- Automatic calculation of deductions
- Deduction breakdown display
- Payslip generation with detailed breakdown
- Deduction rates configuration page

---

### Module 4: Manager & Receptionist - Booking System

#### Enhancement 4.1: Unified Booking Interface
**Requirements:**
- Conference room booking
- Hotel room booking
- Outside catering booking
- Calendar view for all bookings
- Availability checking
- Booking management

**Database Schema:**
```sql
-- Already exists: conference_hall_bookings, bookings (hotel rooms)

CREATE TABLE catering_bookings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id),
    booking_number TEXT UNIQUE NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    event_type TEXT,
    event_date DATE NOT NULL,
    event_time TIME,
    venue_address TEXT NOT NULL,
    num_guests INTEGER NOT NULL,
    menu_details JSONB,
    special_requirements TEXT,
    total_amount DECIMAL(10,2),
    amount_paid DECIMAL(10,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'pending',
    booking_status TEXT DEFAULT 'confirmed',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**UI Components:**
- Unified booking dashboard
- Calendar view showing all booking types
- Quick booking forms for each type
- Booking detail view
- Availability checker
- Booking reports

---

## 📅 IMPLEMENTATION PLAN

### Phase 1: Critical Bug Fixes (Week 1)
**Priority: CRITICAL**
1. Fix notifications modal 404 error
2. Fix draft stock count 404 error
3. Test all navigation flows

### Phase 2: Supplier Management (Week 1-2)
**Priority: HIGH**
1. Create supplier database tables
2. Build supplier CRUD API
3. Create supplier management UI
4. Integrate with purchase orders
5. Test supplier workflows

### Phase 3: Shift Management (Week 2-3)
**Priority: HIGH**
1. Create shift database tables
2. Build shift management API
3. Create shift calendar UI
4. Build shift assignment interface
5. Test shift workflows

### Phase 4: Enhanced Payroll (Week 3-4)
**Priority: HIGH**
1. Update payroll database schema
2. Implement deduction calculations
3. Update payroll processing UI
4. Add all deduction fields
5. Test payroll calculations
6. Generate enhanced payslips

### Phase 5: Unified Booking System (Week 4-5)
**Priority: MEDIUM**
1. Create catering bookings table
2. Build booking APIs
3. Create unified booking dashboard
4. Implement calendar view
5. Test booking workflows

---

## 🔧 TECHNICAL REQUIREMENTS

### Backend
- Node.js/Express controllers
- Supabase/PostgreSQL database
- API endpoints for all features
- Data validation
- Error handling

### Frontend
- Next.js/React components
- Form validation
- Calendar component integration
- Responsive design
- Loading states

### Database
- Migration scripts
- Indexes for performance
- Foreign key constraints
- Triggers for calculations

---

## ✅ ACCEPTANCE CRITERIA

### Bug Fixes
- [ ] Notifications modal opens correct detail pages
- [ ] Draft stock count navigates to edit page
- [ ] No 404 errors in navigation

### Supplier Management
- [ ] Can create/edit/delete suppliers
- [ ] Can view supplier list with search
- [ ] Can link suppliers to purchase orders
- [ ] Can view supplier performance

### Shift Management
- [ ] Can create shift templates
- [ ] Can assign staff to shifts
- [ ] Can view shift calendar
- [ ] Can swap shifts
- [ ] Can generate shift reports

### Enhanced Payroll
- [ ] All deduction fields visible in UI
- [ ] Automatic calculation of deductions
- [ ] Net salary calculated correctly
- [ ] Payslip shows all deductions
- [ ] Can configure deduction rates

### Booking System
- [ ] Can book conferences
- [ ] Can book hotel rooms
- [ ] Can book catering
- [ ] Calendar shows all bookings
- [ ] Can check availability

---

## 📊 ESTIMATED EFFORT

| Module | Effort (Days) | Priority |
|--------|--------------|----------|
| Bug Fixes | 2 | CRITICAL |
| Supplier Management | 5 | HIGH |
| Shift Management | 7 | HIGH |
| Enhanced Payroll | 6 | HIGH |
| Booking System | 5 | MEDIUM |
| **TOTAL** | **25 days** | |

---

## 🚀 NEXT STEPS

1. Review and approve this specification
2. Prioritize features if needed
3. Begin Phase 1 implementation
4. Regular progress updates
5. Testing and QA
6. Deployment

---

**Document Status:** DRAFT - Awaiting Approval  
**Created:** February 19, 2026  
**Last Updated:** February 19, 2026
