'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { cn } from '@/lib/utils';
import { financeAPI } from '@/lib/api';
import {
  Building2, Package, Users, Bed, Hotel, ChevronDown, Warehouse, BarChart3,
  DollarSign,
  ScanLine,
  Settings, ClipboardList, Truck, CalendarClock,
  Building, Wrench, Brush, CheckCircle, CheckCircle2, FileSpreadsheet, ShieldCheck,
  Home, ArrowDownUp, LifeBuoy, Calendar, Store, TrendingUp, TrendingDown, LineChart, Award,
  UserCheck, Utensils, Wine, Receipt, CreditCard, PieChart, FileText,
  BookOpen, ChefHat, ShoppingCart, Wallet, Scale, AlertCircle, UtensilsCrossed, Trash2, Clock, Shield, Menu, X,
  Apple, Beer, Pencil, Database, User, ArrowDownLeft, ArrowUpRight, RefreshCw, ArrowRight, Calculator, Search,
  SlidersHorizontal, LayoutDashboard, Plus, Brain, Target
} from 'lucide-react';

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ href, icon: Icon, label, active, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 py-2 px-3 rounded-lg text-[13px] font-medium transition-colors min-w-0",
        active
          ? "bg-amber-50 text-amber-700"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

interface NavGroupProps {
  label: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function NavGroup({ label, icon: Icon, children, defaultOpen = false }: NavGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-2 px-3 text-[13px] font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors min-w-0"
      >
        <div className="flex items-center gap-3 min-w-0 pr-2">
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">{label}</span>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 text-stone-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="ml-4 space-y-0.5 border-l border-stone-200 pl-3 py-1">
          {children}
        </div>
      )}
    </div>
  );
}

export function ConsolidatedNav() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const pathname = usePathname();


  if (!user) return null;

  // Define navigation items based on user role

  // Branch Operations Manager Navigation
  const branchOperationsNav = (
    <>
      <NavItem
        href="/dashboard/branch-operations"
        icon={Building2}
        label="Overview"
        active={pathname === '/dashboard/branch-operations'}
      />

      <NavGroup label="Inventory" icon={Package} defaultOpen>
        <NavItem
          href="/dashboard/branch-operations/inventory"
          icon={Package}
          label="Stock Levels"
          active={pathname === '/dashboard/branch-operations/inventory'}
        />
        <NavItem
          href="/dashboard/branch-operations/inventory/stock-takes"
          icon={CheckCircle}
          label="Stock Takes"
          active={pathname === '/dashboard/branch-operations/inventory/stock-takes'}
        />
      </NavGroup>

      <NavGroup label="Staff" icon={Users}>
        <NavItem
          href="/dashboard/branch-operations/staff"
          icon={Users}
          label="All Staff"
          active={pathname === '/dashboard/branch-operations/staff'}
        />
        <NavItem
          href="/dashboard/branch-operations/staff/schedule"
          icon={CalendarClock}
          label="Scheduling"
          active={pathname === '/dashboard/branch-operations/staff/schedule'}
        />
        <NavItem
          href="/dashboard/branch-operations/staff/attendance"
          icon={CheckCircle}
          label="Attendance"
          active={pathname === '/dashboard/branch-operations/staff/attendance'}
        />
      </NavGroup>

      <NavGroup label="Operations" icon={Building}>
        <NavItem
          href="/dashboard/branch-operations/operations/reservations"
          icon={Calendar}
          label="Reservations"
          active={pathname === '/dashboard/branch-operations/operations/reservations'}
        />
        <NavItem
          href="/dashboard/branch-operations/operations/rooms"
          icon={Bed}
          label="Rooms"
          active={pathname === '/dashboard/branch-operations/operations/rooms'}
        />
      </NavGroup>

      <NavGroup label="Finance" icon={DollarSign}>
        <NavItem
          href="/dashboard/branch-operations/financials/budget"
          icon={DollarSign}
          label="Budget"
          active={pathname === '/dashboard/branch-operations/financials/budget'}
        />
        <NavItem
          href="/dashboard/branch-operations/financials/expenses"
          icon={FileSpreadsheet}
          label="Expenses"
          active={pathname === '/dashboard/branch-operations/financials/expenses'}
        />
        <NavItem
          href="/dashboard/branch-operations/financials/reports"
          icon={BarChart3}
          label="Reports"
          active={pathname === '/dashboard/branch-operations/financials/reports'}
        />
      </NavGroup>

      <NavItem
        href="/dashboard/branch-operations/communications"
        icon={LifeBuoy}
        label="Communications"
        active={pathname === '/dashboard/branch-operations/communications'}
      />
    </>
  );


  // Facilities Manager Navigation
  const facilitiesNav = (
    <>
      <NavItem
        href="/dashboard/facilities"
        icon={Home}
        label="Overview"
        active={pathname === '/dashboard/facilities'}
      />

      <NavGroup label="Housekeeping" icon={Brush} defaultOpen>
        <NavItem
          href="/dashboard/facilities/housekeeping/tasks"
          icon={ClipboardList}
          label="Tasks"
          active={pathname === '/dashboard/facilities/housekeeping/tasks'}
        />
        <NavItem
          href="/dashboard/facilities/housekeeping/inspections"
          icon={CheckCircle}
          label="Inspections"
          active={pathname === '/dashboard/facilities/housekeeping/inspections'}
        />
        <NavItem
          href="/dashboard/facilities/housekeeping/lost-found"
          icon={LifeBuoy}
          label="Lost & Found"
          active={pathname === '/dashboard/facilities/housekeeping/lost-found'}
        />
      </NavGroup>

      <NavGroup label="Maintenance" icon={Wrench}>
        <NavItem
          href="/dashboard/facilities/maintenance/work-orders"
          icon={ClipboardList}
          label="Work Orders"
          active={pathname === '/dashboard/facilities/maintenance/work-orders'}
        />
        <NavItem
          href="/dashboard/facilities/maintenance/assets"
          icon={Home}
          label="Asset Management"
          active={pathname === '/dashboard/facilities/maintenance/assets'}
        />
        <NavItem
          href="/dashboard/facilities/maintenance/schedule"
          icon={Calendar}
          label="Schedule"
          active={pathname === '/dashboard/facilities/maintenance/schedule'}
        />
      </NavGroup>

      <NavItem
        href="/dashboard/facilities/rooms"
        icon={Bed}
        label="Room Status"
        active={pathname === '/dashboard/facilities/rooms'}
      />

      <NavItem
        href="/dashboard/facilities/inventory"
        icon={Package}
        label="Supplies & Inventory"
        active={pathname === '/dashboard/facilities/inventory'}
      />

      <NavItem
        href="/dashboard/facilities/staff-management"
        icon={Users}
        label="Staff Management"
        active={pathname === '/dashboard/facilities/staff-management'}
      />

      <NavItem
        href="/dashboard/facilities/quality-compliance"
        icon={ShieldCheck}
        label="Quality & Compliance"
        active={pathname === '/dashboard/facilities/quality-compliance'}
      />
    </>
  );

  // Admin Navigation
  const adminNav = (
    <>
      <NavItem
        href="/dashboard/admin"
        icon={Settings}
        label="Admin Dashboard"
        active={pathname === '/dashboard/admin'}
      />
      <NavItem
        href="/dashboard/super/admin/security"
        icon={ShieldCheck}
        label="Security Center"
        active={pathname === '/dashboard/super/admin/security' || pathname === '/dashboard/superadmin/audit-logs'}
      />
      <NavItem
        href="/dashboard/superadmin/behavior-intelligence"
        icon={Brain}
        label="AI Insights"
        active={pathname === '/dashboard/superadmin/behavior-intelligence'}
      />
      <NavItem
        href="/dashboard/admin/restaurant/menu"
        icon={Utensils}
        label="Restaurant Menu"
        active={pathname === '/dashboard/admin/restaurant/menu'}
      />
      <NavItem
        href="/dashboard/admin/bar/menu"
        icon={Beer}
        label="Bar Menu"
        active={pathname === '/dashboard/admin/bar/menu'}
      />
      <NavItem
        href="/dashboard/admin/kyogong/services"
        icon={SlidersHorizontal}
        label="Kyogong Services"
        active={pathname === '/dashboard/admin/kyogong/services'}
      />
      <NavItem
        href="/dashboard/admin/wastage"
        icon={Trash2}
        label="Wastage Analytics"
        active={pathname === '/dashboard/admin/wastage'}
      />
      <NavItem
        href="/dashboard/admin/system/roles/migration"
        icon={ArrowDownUp}
        label="Role Migration"
        active={pathname === '/dashboard/admin/system/roles/migration'}
      />
      <NavItem
        href="/dashboard/admin/id-cards"
        icon={ShieldCheck}
        label="ID Cards"
        active={pathname === '/dashboard/admin/id-cards'}
      />
      <NavItem
        href="/dashboard/cashier"
        icon={CreditCard}
        label="Cashier Station"
        active={pathname === '/dashboard/cashier'}
      />
      <NavItem
        href="/dashboard/branch-accounting/bookings"
        icon={Calendar}
        label="Bookings"
        active={pathname.includes('/dashboard/branch-accounting/bookings')}
      />
      <NavItem
        href="/dashboard/admin/staff"
        icon={Users}
        label="Personnel Registry"
        active={pathname === '/dashboard/admin/staff'}
      />
      <NavItem
        href="/dashboard/admin/docs"
        icon={BookOpen}
        label="Employee Docs"
        active={pathname === '/dashboard/admin/docs'}
      />
    </>
  );

  // Reception Navigation
  const receptionNav = (
    <>
      <NavItem
        href="/dashboard/reception"
        icon={Home}
        label="Overview"
        active={pathname === '/dashboard/reception'}
      />

      <NavGroup label="Front Desk" icon={UserCheck} defaultOpen>
        <NavItem
          href="/dashboard/reception/checkin"
          icon={UserCheck}
          label="Check-in/Check-out"
          active={pathname === '/dashboard/reception/checkin'}
        />
        <NavItem
          href="/dashboard/reception/reservations"
          icon={Calendar}
          label="Reservations"
          active={pathname === '/dashboard/reception/reservations'}
        />
        <NavItem
          href="/dashboard/reception/guests"
          icon={Users}
          label="Guests"
          active={pathname === '/dashboard/reception/guests'}
        />
      </NavGroup>

      <NavItem
        href="/dashboard/reception/rooms"
        icon={Bed}
        label="Rooms"
        active={pathname === '/dashboard/reception/rooms'}
      />

      <NavItem
        href="/dashboard/reception/housekeeping"
        icon={Brush}
        label="Housekeeping"
        active={pathname === '/dashboard/reception/housekeeping'}
      />

      <NavItem
        href="/dashboard/branch-accounting/bookings"
        icon={Calendar}
        label="Bookings"
        active={pathname.includes('/dashboard/branch-accounting/bookings')}
      />

      <NavItem
        href="/dashboard/cashier"
        icon={CreditCard}
        label="Cashier Station"
        active={pathname === '/dashboard/cashier'}
      />
    </>
  );


  // Restaurant Navigation (uses POS-Kitchen dashboard)
  const restaurantNav = (
    <>
      <NavItem
        href="/dashboard/pos-kitchen"
        icon={UtensilsCrossed}
        label="Overview"
        active={pathname === '/dashboard/pos-kitchen' && !pathname.includes('?tab=')}
      />

      <NavGroup label="Operations" icon={ChefHat} defaultOpen>
        <NavItem
          href="/dashboard/pos-kitchen?tab=restaurant"
          icon={ShoppingCart}
          label="Restaurant POS"
          active={pathname === '/dashboard/pos-kitchen' && pathname.includes('tab=restaurant')}
        />
        <NavItem
          href="/dashboard/kitchen"
          icon={ChefHat}
          label="Kitchen"
          active={pathname === '/dashboard/kitchen'}
        />
      </NavGroup>
    </>
  );

  // POS Kitchen Navigation
  const posKitchenNav = (
    <>
      <NavItem
        href="/dashboard/pos-kitchen"
        icon={UtensilsCrossed}
        label="Overview"
        active={pathname === '/dashboard/pos-kitchen' && !pathname.includes('?tab=')}
      />

      <NavGroup label="POS Operations" icon={ShoppingCart} defaultOpen>
        <NavItem
          href="/dashboard/pos-kitchen?tab=restaurant"
          icon={ShoppingCart}
          label="Take Orders"
          active={pathname === '/dashboard/pos-kitchen' && pathname.includes('tab=restaurant')}
        />
        <NavItem
          href="/dashboard/pos-kitchen?tab=recent"
          icon={Clock}
          label="Recent Orders"
          active={pathname === '/dashboard/pos-kitchen' && pathname.includes('tab=recent')}
        />
      </NavGroup>
    </>
  );

  // Kitchen Navigation
  const kitchenNav = (
    <>
      <NavItem
        href="/dashboard/kitchen"
        icon={ChefHat}
        label="Kitchen Display"
        active={pathname === '/dashboard/kitchen' && !pathname.includes('?tab=')}
      />

      <NavGroup label="Operations" icon={ChefHat} defaultOpen>
        <NavItem
          href="/dashboard/kitchen?tab=kitchen"
          icon={ChefHat}
          label="Active Orders"
          active={pathname === '/dashboard/kitchen' && pathname.includes('tab=kitchen')}
        />
        <NavItem
          href="/dashboard/kitchen?tab=wastage"
          icon={AlertCircle}
          label="Wastage Recording"
          active={pathname === '/dashboard/kitchen' && pathname.includes('tab=wastage')}
        />
      </NavGroup>
    </>
  );

  // Bar/Bartender Navigation
  const barNav = (
    <>
      <NavItem
        href="/dashboard/bar"
        icon={Wine}
        label="Overview"
        active={pathname === '/dashboard/bar'}
      />

      <NavGroup label="POS System" icon={ShoppingCart} defaultOpen>
        <NavItem
          href="/dashboard/pos-kitchen?tab=bar"
          icon={CreditCard}
          label="Unified POS"
          active={pathname === '/dashboard/pos-kitchen' && pathname.includes('tab=bar')}
        />
        <NavItem
          href="/dashboard/pos-kitchen?tab=recent"
          icon={ClipboardList}
          label="Order History"
          active={pathname === '/dashboard/pos-kitchen' && pathname.includes('tab=recent')}
        />
        <NavItem
          href="/dashboard/bar/tabs"
          icon={Receipt}
          label="Customer Tabs"
          active={pathname === '/dashboard/bar/tabs'}
        />
      </NavGroup>

      <NavGroup label="Shift & Cash" icon={BookOpen}>
        <NavItem
          href="/dashboard/bar/cashier"
          icon={BookOpen}
          label="Bar Cashier Log"
          active={pathname === '/dashboard/bar/cashier'}
        />
      </NavGroup>

      <NavGroup label="Inventory" icon={Package} defaultOpen>
        <NavItem
          href="/dashboard/bar/inventory"
          icon={ClipboardList}
          label="Bar Inventory"
          active={pathname === '/dashboard/bar/inventory'}
        />
        <NavItem
          href="/dashboard/branch-store/requests"
          icon={ShoppingCart}
          label="Beverage Requisitions"
          active={pathname === '/dashboard/branch-store/requests'}
        />
      </NavGroup>
    </>
  );

  // Procurement Navigation
  const procurementNav = (
    <>
      <NavItem
        href="/dashboard/procurement"
        icon={ShoppingCart}
        label="Procurement Overview"
        active={pathname === '/dashboard/procurement'}
      />

      <NavGroup label="Purchasing" icon={ShoppingCart} defaultOpen>
        <NavItem
          href="/dashboard/central-store/suppliers/purchase-orders"
          icon={FileText}
          label="Purchase Orders"
          active={pathname.includes('/dashboard/central-store/suppliers/purchase-orders')}
        />
        <NavItem
          href="/dashboard/central-store/procurement/grn"
          icon={ClipboardList}
          label="Goods Receipt (GRN)"
          active={pathname.includes('/dashboard/central-store/procurement/grn')}
        />
        <NavItem
          href="/dashboard/central-store/suppliers"
          icon={Users}
          label="Supplier Database"
          active={pathname.includes('/dashboard/central-store/suppliers')}
        />
      </NavGroup>

      <NavGroup label="Inventory & Logistics" icon={Package}>
        <NavItem
          href="/dashboard/central-store"
          icon={Warehouse}
          label="Central Store"
          active={pathname.includes('/dashboard/central-store')}
        />
      </NavGroup>

      <NavGroup label="Accounts Payable" icon={DollarSign} defaultOpen>
        <NavItem
          href="/dashboard/central-store/suppliers/invoices"
          icon={Receipt}
          label="Supplier Invoices"
          active={pathname.includes('/dashboard/central-store/suppliers/invoices')}
        />
        <NavItem
          href="/dashboard/central-store/suppliers/payments"
          icon={CreditCard}
          label="Payments"
          active={pathname.includes('/dashboard/central-store/suppliers/payments')}
        />
      </NavGroup>

      <NavGroup label="Central Store Ops" icon={Warehouse}>
        <NavItem
          href="/dashboard/central-store/dispatch"
          icon={Truck}
          label="Dispatch & Notes"
          active={pathname.includes('/dashboard/central-store/dispatch')}
        />
        <NavItem
          href="/dashboard/central-store/inventory"
          icon={Package}
          label="Master Inventory"
          active={pathname.includes('/dashboard/central-store/inventory')}
        />
        <NavItem
          href="/dashboard/central-store/vehicles"
          icon={Truck}
          label="Fleet Management"
          active={pathname.includes('/dashboard/central-store/vehicles')}
        />
      </NavGroup>
    </>
  );

  // Auditor Navigation
  const auditorNav = (
    <>
      <NavItem
        href="/dashboard/auditor"
        icon={Shield}
        label="Auditor Overview"
        active={pathname === '/dashboard/auditor'}
      />

      <NavItem
        href="/dashboard/auditor/search"
        icon={Search}
        label="SEARCH"
        active={pathname === '/dashboard/auditor/search'}
      />

      <NavGroup label="Daily Verification" icon={CheckCircle} defaultOpen>
        <NavItem
          href="/dashboard/auditor/financial-verification"
          icon={DollarSign}
          label="Financial Verification"
          active={pathname.includes('/dashboard/auditor/financial-verification')}
        />
        <NavItem
          href="/dashboard/auditor/shift-verification"
          icon={CheckCircle2}
          label="Shift Verification"
          active={pathname.includes('/dashboard/auditor/shift-verification')}
        />
        <NavItem
          href="/dashboard/auditor/revenue-oversight"
          icon={TrendingUp}
          label="Revenue Oversight"
          active={pathname.includes('/dashboard/auditor/revenue-oversight')}
        />
        <NavItem
          href="/dashboard/auditor/sold-items"
          icon={FileText}
          label="Sold Items Analysis"
          active={pathname === '/dashboard/auditor/sold-items'}
        />
      </NavGroup>

      <NavGroup label="Staff Audit" icon={Users}>
        <NavItem
          href="/dashboard/auditor/staff-audit"
          icon={UserCheck}
          label="Staff Financials"
          active={pathname === '/dashboard/auditor/staff-audit'}
        />
        <NavItem
          href="/dashboard/hr/performance"
          icon={Award}
          label="Performance Leaderboard"
          active={pathname === '/dashboard/hr/performance'}
        />
      </NavGroup>

      <NavGroup label="Stock & Inventory" icon={Package}>
        <NavItem
          href="/dashboard/auditor/approvals"
          icon={CheckCircle}
          label="Stock Request Approvals"
          active={pathname.includes('/dashboard/auditor/approvals')}
        />
        <NavItem
          href="/dashboard/auditor/stock"
          icon={Package}
          label="Stock Levels"
          active={pathname === '/dashboard/auditor/stock'}
        />
        <NavItem
          href="/dashboard/auditor/bar-stock"
          icon={Wine}
          label="Bar Stock Audits"
          active={pathname === '/dashboard/auditor/bar-stock'}
        />
        <NavItem
          href="/dashboard/auditor/purchases"
          icon={ShoppingCart}
          label="Purchase Audits"
          active={pathname.includes('/dashboard/auditor/purchases')}
        />
      </NavGroup>

      <NavGroup label="Reports" icon={BarChart3}>
        <NavItem
          href="/dashboard/auditor/audit-reports"
          icon={FileSpreadsheet}
          label="Audit Reports"
          active={pathname.includes('/dashboard/auditor/audit-reports')}
        />
      </NavGroup>
    </>
  );




  // Branch Accounting Navigation
  const branchAccountingNav = (
    <>
      <NavItem
        href="/dashboard/branch-accounting"
        icon={LayoutDashboard}
        label="Overview"
        active={pathname === '/dashboard/branch-accounting'}
      />

      <NavItem
        href="/dashboard/branch-accountant/financial-workspace"
        icon={Calendar}
        label="Financial Workspace"
        active={pathname === '/dashboard/branch-accountant/financial-workspace'}
      />

      <NavItem
        href="/dashboard/branch-accounting/shift-review"
        icon={BookOpen}
        label="Shift Reconciliation"
        active={pathname.includes('/dashboard/branch-accounting/shift-review')}
      />

      <NavItem
        href="/dashboard/branch-accounting/stock-take"
        icon={Package}
        label="Stock Takes"
        active={pathname.includes('/dashboard/branch-accounting/stock-take')}
      />

      <NavItem
        href="/dashboard/branch-accounting/credit-bills"
        icon={CreditCard}
        label="Credit & Paid Bills"
        active={pathname.includes('/dashboard/branch-accounting/credit-bills')}
      />

      <NavItem
        href="/dashboard/branch-accounting/credit-bills/customer"
        icon={Users}
        label="Customer Credit Bills"
        active={pathname.includes('/dashboard/branch-accounting/credit-bills/customer')}
      />

      <NavItem
        href="/dashboard/branch-accounting/payments"
        icon={CreditCard}
        label="Payments"
        active={pathname.includes('/dashboard/branch-accounting/payments')}
      />

      <NavItem
        href="/dashboard/branch-accounting/record-banking"
        icon={Plus}
        label="Record Banking"
        active={pathname.includes('/dashboard/branch-accounting/record-banking')}
      />

      <NavItem
        href="/dashboard/branch-accounting/purchases"
        icon={ShoppingCart}
        label="Purchases"
        active={pathname.includes('/dashboard/branch-accounting/purchases')}
      />

      <NavItem
        href="/dashboard/branch-accounting/food-control"
        icon={Utensils}
        label="Food Control"
        active={pathname.includes('/dashboard/branch-accounting/food-control')}
      />

      <NavItem
        href="/dashboard/branch-accounting/bookings"
        icon={Calendar}
        label="Bookings"
        active={pathname.includes('/dashboard/branch-accounting/bookings')}
      />

      <NavItem
        href="/dashboard/branch-accounting/invoices"
        icon={FileText}
        label="Guest Invoices"
        active={pathname.includes('/dashboard/branch-accounting/invoices')}
      />

      <NavItem
        href="/dashboard/branch-accountant/staff/audit"
        icon={Shield}
        label="Staff Audit Trail"
        active={pathname === '/dashboard/branch-accountant/staff/audit'}
      />
    </>
  );

  // Central Storekeeper Navigation (Legacy)
  const centralStoreNav = (
    <>
      <NavItem
        href="/dashboard/central-store"
        icon={Store}
        label="Central Store"
        active={pathname === '/dashboard/central-store'}
      />
      <NavItem
        href="/dashboard/central-store/receiving"
        icon={ScanLine}
        label="Goods Receiving"
        active={pathname === '/dashboard/central-store/receiving'}
      />
      <NavGroup label="Inventory" icon={Package} defaultOpen>
        <NavItem
          href="/dashboard/central-store/foodstuffs"
          icon={Apple}
          label="Foodstuffs"
          active={pathname === '/dashboard/central-store/foodstuffs'}
        />
        <NavItem
          href="/dashboard/central-store/bar-items"
          icon={Beer}
          label="Bar & Beverages"
          active={pathname === '/dashboard/central-store/bar-items'}
        />
        <NavItem
          href="/dashboard/central-store/stationery"
          icon={Pencil}
          label="Stationery Items"
          active={pathname === '/dashboard/central-store/stationery'}
        />
        <NavItem
          href="/dashboard/central-store/inventory"
          icon={Package}
          label="Master Inventory"
          active={pathname === '/dashboard/central-store/inventory'}
        />
      </NavGroup>

      <NavGroup label="Fulfillment" icon={ClipboardList}>
        <NavItem
          href="/dashboard/central-store/requests"
          icon={ClipboardList}
          label="Requisitions"
          active={pathname === '/dashboard/central-store/requests'}
        />
        <NavItem
          href="/dashboard/central-store/packing"
          icon={Package}
          label="Packing"
          active={pathname === '/dashboard/central-store/packing'}
        />
        <NavItem
          href="/dashboard/central-store/dispatch"
          icon={Truck}
          label="Dispatch & Notes"
          active={pathname === '/dashboard/central-store/dispatch'}
        />
      </NavGroup>

      <NavGroup label="Purchasing & Compliance" icon={ShoppingCart} defaultOpen>
        <NavItem
          href="/dashboard/central-store/suppliers/purchase-orders"
          icon={FileText}
          label="Purchase Orders"
          active={pathname.includes('/dashboard/central-store/suppliers/purchase-orders')}
        />
        <NavItem
          href="/dashboard/central-store/procurement/grn"
          icon={ClipboardList}
          label="Goods Receipt (GRN)"
          active={pathname.includes('/dashboard/central-store/procurement/grn')}
        />
        <NavItem
          href="/dashboard/central-store/suppliers"
          icon={Store}
          label="Supplier Database"
          active={pathname.includes('/dashboard/central-store/suppliers')}
        />
      </NavGroup>

      <NavGroup label="Fleet & Logistics" icon={Truck}>
        <NavItem
          href="/dashboard/central-store/vehicles"
          icon={Truck}
          label="Vehicles"
          active={pathname === '/dashboard/central-store/vehicles'}
        />
        <NavItem
          href="/dashboard/central-store/drivers"
          icon={Users}
          label="Drivers"
          active={pathname === '/dashboard/central-store/drivers'}
        />
      </NavGroup>

      <NavGroup label="Controls & Reports" icon={ShieldCheck}>

        <NavItem
          href="/dashboard/central-store/reports"
          icon={BarChart3}
          label="Central Reports"
          active={pathname === '/dashboard/central-store/reports'}
        />
      </NavGroup>
    </>
  );

  // Branch Storekeeper Navigation (Consolidated)
  const branchStoreNav = (
    <>
      <NavItem
        href="/dashboard/branch-store"
        icon={Package}
        label="Overview"
        active={pathname === '/dashboard/branch-store'}
      />

      <NavGroup label="Inventory" icon={Package} defaultOpen>
        <NavItem
          href="/dashboard/branch-store/stock"
          icon={Package}
          label="Master Inventory"
          active={pathname === '/dashboard/branch-store/stock'}
        />
        <NavItem
          href="/dashboard/branch-store/receive"
          icon={CheckCircle}
          label="Receive Goods"
          active={pathname === '/dashboard/branch-store/receive'}
        />
        <NavItem
          href="/dashboard/branch-store/suppliers"
          icon={Store}
          label="Branch Suppliers"
          active={pathname === '/dashboard/branch-store/suppliers'}
        />
        <NavItem
          href="/dashboard/branch-store/stock-takes"
          icon={ClipboardList}
          label="Stock Takes"
          active={pathname === '/dashboard/branch-store/stock-takes'}
        />
      </NavGroup>

      <NavGroup label="Procurement" icon={ShoppingCart} defaultOpen>
        <NavItem
          href="/dashboard/branch-store/purchase-orders"
          icon={FileText}
          label="Purchase Orders"
          active={pathname === '/dashboard/branch-store/purchase-orders'}
        />
        <NavItem
          href="/dashboard/branch-store/requests"
          icon={ShoppingCart}
          label="Store Requisitions"
          active={pathname === '/dashboard/branch-store/requests'}
        />
      </NavGroup>

      <NavItem
        href="/dashboard/branch-store/kitchen-usage"
        icon={Utensils}
        label="Kitchen Usage"
        active={pathname === '/dashboard/branch-store/kitchen-usage'}
      />

      <NavItem
        href="/dashboard/branch-store/stock-out"
        icon={TrendingDown}
        label="Stock Out"
        active={pathname === '/dashboard/branch-store/stock-out'}
      />
    </>
  );

  // Housekeeping Navigation (Legacy)
  const housekeepingNav = (
    <>
      <NavItem
        href="/dashboard/housekeeping"
        icon={Brush}
        label="Overview"
        active={pathname === '/dashboard/housekeeping'}
      />

      <NavGroup label="Tasks" icon={ClipboardList} defaultOpen>
        <NavItem
          href="/dashboard/housekeeping/tasks"
          icon={ClipboardList}
          label="Tasks"
          active={pathname === '/dashboard/housekeeping/tasks'}
        />
        <NavItem
          href="/dashboard/housekeeping/rooms"
          icon={Bed}
          label="Rooms"
          active={pathname === '/dashboard/housekeeping/rooms'}
        />
        <NavItem
          href="/dashboard/housekeeping/inspections"
          icon={CheckCircle}
          label="Inspections"
          active={pathname === '/dashboard/housekeeping/inspections'}
        />
      </NavGroup>

      <NavItem
        href="/dashboard/housekeeping/scheduling"
        icon={Calendar}
        label="Scheduling"
        active={pathname === '/dashboard/housekeeping/scheduling'}
      />

      <NavItem
        href="/dashboard/housekeeping/staff"
        icon={Users}
        label="Staff"
        active={pathname === '/dashboard/housekeeping/staff'}
      />

      <NavItem
        href="/dashboard/housekeeping/inventory"
        icon={Package}
        label="Inventory"
        active={pathname === '/dashboard/housekeeping/inventory'}
      />

      <NavItem
        href="/dashboard/housekeeping/lost-found"
        icon={LifeBuoy}
        label="Lost & Found"
        active={pathname === '/dashboard/housekeeping/lost-found'}
      />

      <NavItem
        href="/dashboard/housekeeping/workflows"
        icon={ArrowDownUp}
        label="Workflows"
        active={pathname === '/dashboard/housekeeping/workflows'}
      />

      <NavItem
        href="/dashboard/housekeeping/reports"
        icon={BarChart3}
        label="Reports"
        active={pathname === '/dashboard/housekeeping/reports'}
      />
    </>
  );

  // Maintenance Navigation (Legacy)
  const maintenanceNav = (
    <>
      <NavItem
        href="/dashboard/maintenance"
        icon={Wrench}
        label="Overview"
        active={pathname === '/dashboard/maintenance'}
      />

      <NavItem
        href="/dashboard/maintenance/orders"
        icon={ClipboardList}
        label="Work Orders"
        active={pathname === '/dashboard/maintenance/orders'}
      />

      <NavItem
        href="/dashboard/maintenance/assets"
        icon={Home}
        label="Assets"
        active={pathname === '/dashboard/maintenance/assets'}
      />

      <NavItem
        href="/dashboard/maintenance/schedule"
        icon={Calendar}
        label="Schedule"
        active={pathname === '/dashboard/maintenance/schedule'}
      />
    </>
  );

  // General Manager Navigation (Legacy)
  const gmNav = (
    <>
      <NavItem
        href="/dashboard/gm"
        icon={Building2}
        label="Overview"
        active={pathname === '/dashboard/gm'}
      />

      <NavGroup label="Operations" icon={Building} defaultOpen>
        <NavItem
          href="/dashboard/gm/branches"
          icon={Building2}
          label="Branches"
          active={pathname === '/dashboard/gm/branches'}
        />
        <NavItem
          href="/dashboard/gm/compare"
          icon={BarChart3}
          label="Compare Branches"
          active={pathname === '/dashboard/gm/compare'}
        />
        <NavItem
          href="/dashboard/gm/reservations"
          icon={Calendar}
          label="Reservations"
          active={pathname === '/dashboard/gm/reservations'}
        />
      </NavGroup>

      <NavGroup label="Staff" icon={Users}>
        <NavItem
          href="/dashboard/gm/staff"
          icon={Users}
          label="All Staff"
          active={pathname === '/dashboard/gm/staff'}
        />
        <NavItem
          href="/dashboard/gm/leave-requests"
          icon={Calendar}
          label="Leave Requests"
          active={pathname === '/dashboard/gm/leave-requests'}
        />
        <NavItem
          href="/dashboard/hr/performance"
          icon={Award}
          label="Performance Leaderboard"
          active={pathname === '/dashboard/hr/performance'}
        />
      </NavGroup>

      <NavItem
        href="/dashboard/gm/finance"
        icon={DollarSign}
        label="Finance"
        active={pathname === '/dashboard/gm/finance'}
      />

      <NavItem
        href="/dashboard/gm/reports"
        icon={BarChart3}
        label="Reports"
        active={pathname === '/dashboard/gm/reports'}
      />
      <NavItem
        href="/dashboard/cashier"
        icon={CreditCard}
        label="Cashier Station"
        active={pathname === '/dashboard/cashier'}
      />
    </>
  );

  // Executive Branch Manager Navigation
  const branchManagerNav = (
    <>
      <NavItem
        href="/dashboard/branch-manager"
        icon={LayoutDashboard}
        label="Executive Dashboard"
        active={pathname === '/dashboard/branch-manager'}
      />

      {/* FINANCIAL PERFORMANCE */}
      <div className="pt-3">
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Financial Performance</p>
      </div>
      <NavGroup label="Analytics & Reports" icon={TrendingUp} defaultOpen>
        <NavItem
          href="/dashboard/branch-manager/analytics"
          icon={BarChart3}
          label="Sales Analytics"
          active={pathname === '/dashboard/branch-manager/analytics'}
        />
        <NavItem
          href="/dashboard/branch-manager/cashier-clearance"
          icon={DollarSign}
          label="Cashier Clearance"
          active={pathname === '/dashboard/branch-manager/cashier-clearance'}
        />
      </NavGroup>

      {/* GUEST SERVICES */}
      <div className="pt-3">
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Guest Services</p>
      </div>
      <NavGroup label="Front Desk Operations" icon={UserCheck} defaultOpen>
        <NavItem
          href="/dashboard/branch-manager/checkin"
          icon={UserCheck}
          label="Check-in/Check-out"
          active={pathname === '/dashboard/branch-manager/checkin'}
        />
        <NavItem
          href="/dashboard/branch-manager/reservations"
          icon={Calendar}
          label="Reservations"
          active={pathname === '/dashboard/branch-manager/reservations'}
        />
        <NavItem
          href="/dashboard/branch-manager/arrivals"
          icon={ArrowDownLeft}
          label="Expected Arrivals"
          active={pathname === '/dashboard/branch-manager/arrivals'}
        />
        <NavItem
          href="/dashboard/branch-manager/departures"
          icon={ArrowUpRight}
          label="Expected Departures"
          active={pathname === '/dashboard/branch-manager/departures'}
        />
      </NavGroup>

      <NavGroup label="Guest Management" icon={Users}>
        <NavItem
          href="/dashboard/branch-manager/guests"
          icon={Users}
          label="Guest Directory"
          active={pathname === '/dashboard/branch-manager/guests'}
        />
        <NavItem
          href="/dashboard/branch-manager/rooms"
          icon={Bed}
          label="Room Status"
          active={pathname === '/dashboard/branch-manager/rooms'}
        />
      </NavGroup>

      {/* FOOD & BEVERAGE */}
      <div className="pt-3">
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Food & Beverage</p>
      </div>
      <NavGroup label="Restaurant Operations" icon={Utensils} defaultOpen>
        <NavItem
          href="/dashboard/branch-manager/restaurant"
          icon={UtensilsCrossed}
          label="Restaurant Overview"
          active={pathname === '/dashboard/branch-manager/restaurant'}
        />
        <NavItem
          href="/dashboard/branch-manager/restaurant/waiter-sales"
          icon={LineChart}
          label="Waiter Performance"
          active={pathname === '/dashboard/branch-manager/restaurant/waiter-sales'}
        />
      </NavGroup>

      {/* FACILITIES & OPERATIONS */}
      <div className="pt-3">
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Facilities & Operations</p>
      </div>
      <NavGroup label="Facility Management" icon={Building}>
        <NavItem
          href="/dashboard/branch-manager/housekeeping"
          icon={Brush}
          label="Housekeeping"
          active={pathname === '/dashboard/branch-manager/housekeeping'}
        />
        <NavItem
          href="/dashboard/branch-manager/maintenance"
          icon={Wrench}
          label="Maintenance"
          active={pathname === '/dashboard/branch-manager/maintenance'}
        />
      </NavGroup>

      {/* INVENTORY CONTROL */}
      <div className="pt-3">
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Inventory Control</p>
      </div>
      <NavGroup label="Stock Management" icon={Package} defaultOpen>
        <NavItem
          href="/dashboard/branch-manager/stock"
          icon={Package}
          label="Stock Overview"
          active={pathname === '/dashboard/branch-manager/stock'}
        />
        <NavItem
          href="/dashboard/branch-manager/stock/analytics"
          icon={PieChart}
          label="Stock Analytics"
          active={pathname === '/dashboard/branch-manager/stock/analytics'}
        />
        <NavItem
          href="/dashboard/branch-manager/stock-out"
          icon={TrendingDown}
          label="Stock Issuance"
          active={pathname === '/dashboard/branch-manager/stock-out'}
        />
        <NavItem
          href="/dashboard/branch-manager/wastage"
          icon={Trash2}
          label="Wastage Tracking"
          active={pathname === '/dashboard/branch-manager/wastage'}
        />
      </NavGroup>

      {/* HUMAN RESOURCES */}
      <div className="pt-3">
        <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Human Resources</p>
      </div>
      <NavGroup label="Staff Management" icon={Users} defaultOpen>
        <NavItem
          href="/dashboard/branch-manager/staff"
          icon={Users}
          label="Staff Directory"
          active={pathname === '/dashboard/branch-manager/staff'}
        />
        <NavItem
          href="/dashboard/branch-manager/attendance"
          icon={CheckCircle}
          label="Attendance"
          active={pathname === '/dashboard/branch-manager/attendance'}
        />
        <NavItem
          href="/dashboard/branch-manager/leave"
          icon={CalendarClock}
          label="Leave Requests"
          active={pathname === '/dashboard/branch-manager/leave'}
        />
        <NavItem
          href="/dashboard/branch-manager/staff/performance"
          icon={Award}
          label="Performance"
          active={pathname === '/dashboard/branch-manager/staff/performance'}
        />
      </NavGroup>
    </>
  );


  // HR Manager Navigation
  const hrNav = (
    <>
      <NavItem
        href="/dashboard/hr"
        icon={Home}
        label="HR Dashboard"
        active={pathname === '/dashboard/hr'}
      />

      <NavGroup label="Employees" icon={Users} defaultOpen>
        <NavItem
          href="/dashboard/hr/employees"
          icon={Users}
          label="All Employees"
          active={pathname === '/dashboard/hr/employees'}
        />
        <NavItem
          href="/dashboard/hr/staff-attendance"
          icon={CheckCircle}
          label="Staff Attendance"
          active={pathname.includes('/dashboard/hr/staff-attendance')}
        />
        <NavItem
          href="/dashboard/hr/attendance"
          icon={CalendarClock}
          label="Attendance Logs"
          active={pathname === '/dashboard/hr/attendance'}
        />
        <NavItem
          href="/dashboard/hr/leave"
          icon={FileText}
          label="Leave Requests"
          active={pathname === '/dashboard/hr/leave'}
        />
        <NavItem
          href="/dashboard/hr/performance"
          icon={Award}
          label="Performance Leaderboard"
          active={pathname === '/dashboard/hr/performance'}
        />
      </NavGroup>

      <NavGroup label="Payroll" icon={DollarSign}>
        <NavItem
          href="/dashboard/hr/salaries"
          icon={CreditCard}
          label="Salaries"
          active={pathname === '/dashboard/hr/salaries'}
        />
        <NavItem
          href="/dashboard/hr/payroll"
          icon={DollarSign}
          label="Payroll Processing"
          active={pathname === '/dashboard/hr/payroll'}
        />
        <NavItem
          href="/dashboard/hr/adjustments"
          icon={ArrowDownUp}
          label="Adjustments"
          active={pathname === '/dashboard/hr/adjustments'}
        />
      </NavGroup>
    </>
  );

  // Kitchen Operations Navigation
  const kitchenOperationsNav = (
    <>
      <NavItem
        href="/dashboard/kitchen-operations"
        icon={ChefHat}
        label="Overview"
        active={pathname === '/dashboard/kitchen-operations'}
      />

      <NavGroup label="Inventory" icon={Package} defaultOpen>
        <NavItem
          href="/dashboard/kitchen-operations/stock"
          icon={BookOpen}
          label="Stock Ledger"
          active={pathname === '/dashboard/kitchen-operations/stock'}
        />
        <NavItem
          href="/dashboard/kitchen-operations/requisitions"
          icon={ShoppingCart}
          label="Request Stock"
          active={pathname === '/dashboard/kitchen-operations/requisitions'}
        />
      </NavGroup>

      <NavGroup label="Production" icon={UtensilsCrossed} defaultOpen>
        <NavItem
          href="/dashboard/kitchen-operations/recipes"
          icon={ChefHat}
          label="Recipes & BOM"
          active={pathname === '/dashboard/kitchen-operations/recipes'}
        />
      </NavGroup>

      <NavGroup label="Tracking" icon={ClipboardList} defaultOpen>
        <NavItem
          href="/dashboard/kitchen-operations/usage"
          icon={ClipboardList}
          label="Usage Tracking"
          active={pathname === '/dashboard/kitchen-operations/usage'}
        />
        <NavItem
          href="/dashboard/kitchen-operations/wastage"
          icon={Trash2}
          label="Record Wastage"
          active={pathname === '/dashboard/kitchen-operations/wastage'}
        />
      </NavGroup>
    </>
  );

  // Director Navigation
  const directorNav = (
    <>
      <NavItem
        href="/dashboard/director"
        icon={LayoutDashboard}
        label="Global Financial Overview"
        active={pathname === '/dashboard/director'}
      />

      <NavGroup label="Financial Intelligence" icon={TrendingUp} defaultOpen>
        <NavItem
          href="/dashboard/director/payments"
          icon={CreditCard}
          label="Payment Intelligence"
          active={pathname === '/dashboard/director/payments'}
        />
        <NavItem
          href="/dashboard/director/banking"
          icon={Building}
          label="Banking Control"
          active={pathname === '/dashboard/director/banking'}
        />
      </NavGroup>

      <NavItem
        href="/dashboard/director/discrepancies"
        icon={AlertCircle}
        label="Discrepancy Control"
        active={pathname === '/dashboard/director/discrepancies'}
      />

      <NavItem
        href="/dashboard/director/drill-down"
        icon={Target}
        label="Deep Drill-Down"
        active={pathname === '/dashboard/director/drill-down'}
      />

      <NavItem
        href="/dashboard/director/tasks"
        icon={ClipboardList}
        label="Review Tasks"
        active={pathname === '/dashboard/director/tasks'}
      />

      <hr className="my-4 border-stone-100" />
      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Audit & HR Oversight</p>
      {auditorNav}
      <hr className="my-4 border-stone-100" />
      {hrNav}
    </>
  );

  // Kyogong POS Navigation
  const kyogongNav = (posLabel: string, posPath: string) => (
    <>
      <NavItem
        href={posPath}
        icon={ShoppingCart}
        label={posLabel}
        active={pathname === posPath}
      />
      <NavItem
        href="/dashboard/cashier"
        icon={CreditCard}
        label="Cashier Station"
        active={pathname === '/dashboard/cashier'}
      />
    </>
  );

  // Determine which navigation to render based on user role
  const renderNavigation = () => {
    if (user.role === UserRole.SUPER_ADMIN) {
      return (
        <>
          {adminNav}
          <hr className="my-4 border-stone-100" />
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Oversight & Audit</p>
          {auditorNav}
          <hr className="my-4 border-stone-100" />
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Inventory & Logistics</p>
          {centralStoreNav}
          <hr className="my-4 border-stone-100" />
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Corporate Functions</p>
          {procurementNav}
          <hr className="my-4 border-stone-100" />
          {hrNav}
          <hr className="my-4 border-stone-100" />
          {branchOperationsNav}
          <hr className="my-4 border-stone-100" />
          {facilitiesNav}
          <hr className="my-4 border-stone-100" />
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Branch Store Ops</p>
          {branchStoreNav}
          <hr className="my-4 border-stone-100" />
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Kitchen Ops</p>
          {kitchenOperationsNav}
        </>
      );
    }


    // Director Navigation
    if (user.role === UserRole.DIRECTOR) {
      return directorNav;
    }

    // General Manager Navigation
    if (user.role === UserRole.GENERAL_MANAGER) {
      return (
        <>
          {gmNav}
          <hr className="my-4 border-stone-100" />
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Inventory & Logistics</p>
          {centralStoreNav}
          <hr className="my-4 border-stone-100" />
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Corporate Functions</p>
          {procurementNav}
          <hr className="my-4 border-stone-100" />
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Kitchen Ops</p>
          {kitchenOperationsNav}
        </>
      );
    }

    // Central Store Management
    if (user.role === UserRole.CENTRAL_STOREKEEPER || user.role === UserRole.CENTRAL_OPERATIONS_MANAGER) {
      return centralStoreNav;
    }

    // Branch Store & Stock Management
    if (user.role === UserRole.BRANCH_STOREKEEPER || user.role === UserRole.STOREKEEPER) {
      return branchStoreNav;
    }

    // Procurement & Purchasing
    if (user.role === UserRole.PROCUREMENT || user.role === UserRole.PURCHASING_MANAGER) {
      return procurementNav;
    }

    // Accounting & Finance
    if (user.role === UserRole.BRANCH_ACCOUNTANT || user.role === UserRole.ACCOUNTANT) {
      return branchAccountingNav;
    }



    // Branch Operations
    if (user.role === UserRole.BRANCH_OPERATIONS_MANAGER) {
      return branchOperationsNav;
    }

    // Branch Management
    if (user.role === UserRole.BRANCH_MANAGER) {
      return (
        <>
          {branchManagerNav}
          <hr className="my-4 border-stone-100" />
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Kitchen Ops</p>
          {kitchenOperationsNav}
        </>
      );
    }

    // Facilities & Maintenance
    if (user.role === UserRole.FACILITIES_MANAGER) {
      return facilitiesNav;
    }
    if (user.role === UserRole.HOUSEKEEPING || user.role === UserRole.HOUSEKEEPING_SUPERVISOR) {
      return housekeepingNav;
    }
    if (user.role === UserRole.MAINTENANCE) {
      return maintenanceNav;
    }

    // Food & Beverage
    if (user.role === UserRole.RESTAURANT) {
      return restaurantNav;
    }
    if (user.role === UserRole.POS_KITCHEN) {
      return posKitchenNav;
    }
    if (user.role === UserRole.KITCHEN) {
      return (
        <NavItem
          href="/dashboard/kitchen"
          icon={ChefHat}
          label="KDS / Active Orders"
          active={pathname === '/dashboard/kitchen'}
        />
      );
    }
    if (user.role === UserRole.KITCHEN_OPERATIONS) {
      return (
        <>
          <NavItem
            href="/dashboard/kitchen"
            icon={ChefHat}
            label="KDS / Active Orders"
            active={pathname === '/dashboard/kitchen'}
          />
          <hr className="my-4 border-stone-100" />
          {kitchenOperationsNav}
        </>
      );
    }
    if (user.role === UserRole.BARTENDER) {
      return barNav;
    }

    // Support & Oversight
    if (user.role === UserRole.AUDITOR) {
      return (
        <>
          {auditorNav}
          <hr className="my-4 border-stone-100" />
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest px-3 mb-2">Personnel Oversight</p>
          {hrNav}
        </>
      );
    }
    if (user.role === UserRole.RECEPTIONIST) {
      return receptionNav;
    }
    if (user.role === UserRole.CASHIER) {
      return (
        <NavItem
          href="/dashboard/cashier"
          icon={CreditCard}
          label="Cashier Station"
          active={pathname === '/dashboard/cashier'}
        />
      );
    }
    if (user.role === UserRole.HR_MANAGER) {
      return hrNav;
    }

    // Kyogong Cashier Roles
    if (user.role === UserRole.KYOGONG_SPA_CASHIER) {
      return kyogongNav('Spa POS', '/dashboard/kyogong/spa');
    }
    if (user.role === UserRole.KYOGONG_SPORTS_BAR_CASHIER) {
      return kyogongNav('Sports Bar POS', '/dashboard/kyogong/sports-bar');
    }
    if (user.role === UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER) {
      return kyogongNav('Exec Bar POS', '/dashboard/kyogong/executive-bar');
    }
    if (user.role === UserRole.KYOGONG_RECEPTION_CASHIER) {
      return kyogongNav('Reception POS', '/dashboard/kyogong/reception');
    }

    return null;
  };

  return (
    <div className="space-y-1">
      {renderNavigation()}
    </div>
  );
}
