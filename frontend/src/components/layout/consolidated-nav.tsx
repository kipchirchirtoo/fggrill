'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { cn } from '@/lib/utils';
import {
  Building2, Package, Users, Bed, ChevronDown, Warehouse, BarChart3,
  DollarSign, Settings, ClipboardList, Truck, CalendarClock,
  Building, Wrench, Brush, CheckCircle, FileSpreadsheet, ShieldCheck,
  Home, ArrowDownUp, LifeBuoy, Calendar, Store, TrendingUp, LineChart, Award,
  UserCheck, Utensils, Wine, Receipt, CreditCard, PieChart, FileText,
  BookOpen, ChefHat, ShoppingCart, Wallet, Scale, AlertCircle, UtensilsCrossed, Trash2, Clock, Shield, Menu, X
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
        "flex items-center gap-3 py-2 px-3 rounded-lg text-[13px] font-medium transition-colors",
        active
          ? "bg-amber-50 text-amber-700"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      )}
    >
      <Icon className="h-4 w-4 flex-shrink-0" />
      <span>{label}</span>
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
        className="flex w-full items-center justify-between py-2 px-3 text-[13px] font-medium text-stone-600 hover:bg-stone-100 hover:text-stone-900 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="h-4 w-4 flex-shrink-0" />
          <span>{label}</span>
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
  const { activeBranchId } = useBranch();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!user) return null;

  // Close mobile menu when route changes
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

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

  // Central Operations Manager Navigation
  const centralOperationsNav = (
    <>
      <NavItem
        href="/dashboard/central-operations"
        icon={Building2}
        label="Overview"
        active={pathname === '/dashboard/central-operations'}
      />

      <NavGroup label="Warehouse" icon={Warehouse} defaultOpen>
        <NavItem
          href="/dashboard/central-operations/warehouse/inventory"
          icon={Package}
          label="Master Inventory"
          active={pathname === '/dashboard/central-operations/warehouse/inventory'}
        />
        <NavItem
          href="/dashboard/central-operations/warehouse/dispatches"
          icon={Truck}
          label="Dispatches"
          active={pathname === '/dashboard/central-operations/warehouse/dispatches'}
        />
        <NavItem
          href="/dashboard/central-operations/warehouse/transfers"
          icon={ArrowDownUp}
          label="Transfers"
          active={pathname === '/dashboard/central-operations/warehouse/transfers'}
        />
        <NavItem
          href="/dashboard/central-operations/warehouse/suppliers"
          icon={Store}
          label="Suppliers"
          active={pathname === '/dashboard/central-operations/warehouse/suppliers'}
        />
        <NavItem
          href="/dashboard/central-operations/warehouse/vendor-performance"
          icon={Award}
          label="Vendor Performance"
          active={pathname === '/dashboard/central-operations/warehouse/vendor-performance'}
        />
      </NavGroup>

      <NavGroup label="Branch Oversight" icon={Building}>
        <NavItem
          href="/dashboard/central-operations/branch-oversight/comparison"
          icon={BarChart3}
          label="Branch Comparison"
          active={pathname === '/dashboard/central-operations/branch-oversight/comparison'}
        />
        <NavItem
          href="/dashboard/central-operations/branch-oversight/performance"
          icon={BarChart3}
          label="Performance"
          active={pathname === '/dashboard/central-operations/branch-oversight/performance'}
        />
        <NavItem
          href="/dashboard/central-operations/branch-oversight/staff"
          icon={Users}
          label="Staff Overview"
          active={pathname === '/dashboard/central-operations/branch-oversight/staff'}
        />
        <NavItem
          href="/dashboard/central-operations/branch-oversight/compliance"
          icon={ShieldCheck}
          label="Compliance"
          active={pathname === '/dashboard/central-operations/branch-oversight/compliance'}
        />
      </NavGroup>

      <NavGroup label="Strategic Planning" icon={BarChart3}>
        <NavItem
          href="/dashboard/central-operations/strategic-planning/budgets"
          icon={DollarSign}
          label="Budgets"
          active={pathname === '/dashboard/central-operations/strategic-planning/budgets'}
        />
        <NavItem
          href="/dashboard/central-operations/strategic-planning/forecasting"
          icon={BarChart3}
          label="Forecasting"
          active={pathname === '/dashboard/central-operations/strategic-planning/forecasting'}
        />
        <NavItem
          href="/dashboard/central-operations/strategic-planning/ml-forecasting"
          icon={LineChart}
          label="ML Forecasting"
          active={pathname === '/dashboard/central-operations/strategic-planning/ml-forecasting'}
        />
        <NavItem
          href="/dashboard/central-operations/strategic-planning/procurement"
          icon={Package}
          label="Procurement"
          active={pathname === '/dashboard/central-operations/strategic-planning/procurement'}
        />
      </NavGroup>

      <NavGroup label="Analytics" icon={BarChart3}>
        <NavItem
          href="/dashboard/central-operations/analytics/reports"
          icon={FileSpreadsheet}
          label="Reports"
          active={pathname === '/dashboard/central-operations/analytics/reports'}
        />
        <NavItem
          href="/dashboard/central-operations/analytics/trends"
          icon={BarChart3}
          label="Trends"
          active={pathname === '/dashboard/central-operations/analytics/trends'}
        />
        <NavItem
          href="/dashboard/central-operations/analytics/executive"
          icon={BarChart3}
          label="Executive Dashboard"
          active={pathname === '/dashboard/central-operations/analytics/executive'}
        />
        <NavItem
          href="/dashboard/central-operations/wastage"
          icon={Trash2}
          label="Wastage Overview"
          active={pathname === '/dashboard/central-operations/wastage'}
        />
      </NavGroup>
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
        href="/dashboard/cashier"
        icon={CreditCard}
        label="Cashier Station"
        active={pathname === '/dashboard/cashier'}
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
          href="/dashboard/pos-kitchen?tab=pos"
          icon={ShoppingCart}
          label="POS System"
          active={pathname === '/dashboard/pos-kitchen' && pathname.includes('tab=pos')}
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
          href="/dashboard/pos-kitchen?tab=pos"
          icon={ShoppingCart}
          label="Take Orders"
          active={pathname === '/dashboard/pos-kitchen' && pathname.includes('tab=pos')}
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

      <NavGroup label="Orders" icon={ShoppingCart} defaultOpen>
        <NavItem
          href="/dashboard/bar/pos"
          icon={CreditCard}
          label="New Order (POS)"
          active={pathname === '/dashboard/bar/pos'}
        />
        <NavItem
          href="/dashboard/bar/orders"
          icon={ClipboardList}
          label="All Orders"
          active={pathname === '/dashboard/bar/orders'}
        />
        <NavItem
          href="/dashboard/bar/tabs"
          icon={Receipt}
          label="Customer Tabs"
          active={pathname === '/dashboard/bar/tabs'}
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

      <NavGroup label="Monitoring" icon={ClipboardList} defaultOpen>
        <NavItem
          href="/dashboard/auditor/orders"
          icon={CheckCircle}
          label="Orders & Payments"
          active={pathname === '/dashboard/auditor/orders'}
        />
        {/* Placeholder for future logs if needed */}
      </NavGroup>

      <NavGroup label="Audits" icon={Scale} defaultOpen>
        <NavItem
          href="/dashboard/auditor/sales"
          icon={DollarSign}
          label="Financial Audit"
          active={pathname === '/dashboard/auditor/sales'}
        />
        <NavItem
          href="/dashboard/auditor/stock"
          icon={Package}
          label="Inventory Audit"
          active={pathname === '/dashboard/auditor/stock'}
        />
        <NavItem
          href="/dashboard/auditor/sold-items"
          icon={BarChart3}
          label="Sold Items Analytics"
          active={pathname === '/dashboard/auditor/sold-items'}
        />
        <NavItem
          href="/dashboard/auditor/reports"
          icon={FileText}
          label="Audit Reports"
          active={pathname === '/dashboard/auditor/reports'}
        />
      </NavGroup>
    </>
  );

  // Branch Accounting Navigation
  const branchAccountingNav = (
    <>
      <NavItem
        href="/dashboard/branch-accounting"
        icon={BarChart3}
        label="Accounting Overview"
        active={pathname === '/dashboard/branch-accounting' && !pathname.includes('?tab=')}
      />

      <NavGroup label="Operations" icon={Package} defaultOpen>
        <NavItem
          href="/dashboard/branch-accounting?tab=inventory"
          icon={CheckCircle}
          label="Stock Taking"
          active={pathname === '/dashboard/branch-accounting' && pathname.includes('tab=inventory')}
        />
        <NavItem
          href="/dashboard/branch-accounting?tab=billing"
          icon={FileText}
          label="Billing & Credit"
          active={pathname === '/dashboard/branch-accounting' && pathname.includes('tab=billing')}
        />
        <NavItem
          href="/dashboard/branch-accounting?tab=payments"
          icon={CreditCard}
          label="Payment Verification"
          active={pathname === '/dashboard/branch-accounting' && pathname.includes('tab=payments')}
        />
      </NavGroup>

      <NavGroup label="Financials" icon={DollarSign}>
        <NavItem
          href="/dashboard/branch-accounting/revenue"
          icon={TrendingUp}
          label="Branch Revenue"
          active={pathname === '/dashboard/branch-accounting/revenue'}
        />
        <NavItem
          href="/dashboard/branch-accounting/expenses"
          icon={Receipt}
          label="Expenses"
          active={pathname === '/dashboard/branch-accounting/expenses'}
        />
      </NavGroup>

      <NavGroup label="Documents" icon={FileText}>
        <NavItem
          href="/dashboard/branch-accounting/invoices"
          icon={FileText}
          label="Invoices"
          active={pathname === '/dashboard/branch-accounting/invoices'}
        />
        <NavItem
          href="/dashboard/branch-accounting/reports"
          icon={FileSpreadsheet}
          label="Daily Reports"
          active={pathname === '/dashboard/branch-accounting/reports'}
        />
      </NavGroup>
    </>
  );

  // Central Storekeeper Navigation (Legacy)
  const centralStoreNav = (
    <>
      <NavItem
        href="/dashboard/central-store"
        icon={Warehouse}
        label="Overview"
        active={pathname === '/dashboard/central-store'}
      />

      <NavGroup label="Inventory" icon={Package} defaultOpen>
        <NavItem
          href="/dashboard/central-store/inventory"
          icon={Package}
          label="Inventory"
          active={pathname === '/dashboard/central-store/inventory'}
        />
        <NavItem
          href="/dashboard/central-store/stock-takes"
          icon={CheckCircle}
          label="Stock Takes"
          active={pathname === '/dashboard/central-store/stock-takes'}
        />
      </NavGroup>

      <NavGroup label="Requests" icon={ClipboardList}>
        <NavItem
          href="/dashboard/central-store/dispatch"
          icon={Truck}
          label="Dispatch"
          active={pathname === '/dashboard/central-store/dispatch'}
        />
      </NavGroup>

      <NavItem
        href="/dashboard/central-store/suppliers"
        icon={Store}
        label="Suppliers"
        active={pathname === '/dashboard/central-store/suppliers'}
      />

      <NavGroup label="Fleet" icon={Truck}>
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

      <NavItem
        href="/dashboard/central-store/reports"
        icon={BarChart3}
        label="Reports"
        active={pathname === '/dashboard/central-store/reports'}
      />
    </>
  );

  // Branch Storekeeper Navigation (Consolidated)
  const branchStoreNav = (
    <>
      <NavItem
        href="/dashboard/storekeeping/branch"
        icon={Package}
        label="Overview"
        active={pathname === '/dashboard/storekeeping/branch' && !pathname.includes('tab=')}
      />

      <NavGroup label="Inventory" icon={Package} defaultOpen>
        <NavItem
          href="/dashboard/storekeeping/branch?tab=stock"
          icon={Package}
          label="Morning Stock Count"
          active={pathname === '/dashboard/storekeeping/branch' && pathname.includes('tab=stock')}
        />
        <NavItem
          href="/dashboard/storekeeping/branch?tab=receive"
          icon={CheckCircle}
          label="Receive Goods"
          active={pathname === '/dashboard/storekeeping/branch' && pathname.includes('tab=receive')}
        />
        <NavItem
          href="/dashboard/storekeeping/branch?tab=requests"
          icon={ClipboardList}
          label="Stock Requests"
          active={pathname === '/dashboard/storekeeping/branch' && pathname.includes('tab=requests')}
        />
      </NavGroup>

      <NavItem
        href="/dashboard/storekeeping/branch?tab=usage"
        icon={Utensils}
        label="Kitchen Usage"
        active={pathname === '/dashboard/storekeeping/branch' && pathname.includes('tab=usage')}
      />

      <NavItem
        href="/dashboard/storekeeping/branch?tab=history"
        icon={Clock}
        label="Movement History"
        active={pathname === '/dashboard/storekeeping/branch' && pathname.includes('tab=history')}
      />

      <NavItem
        href="/dashboard/storekeeping/branch?tab=reports"
        icon={BarChart3}
        label="Reports"
        active={pathname === '/dashboard/storekeeping/branch' && pathname.includes('tab=reports')}
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

  // Branch Manager Navigation (Legacy)
  const branchManagerNav = (
    <>
      <NavItem
        href="/dashboard/branch-manager"
        icon={Building2}
        label="Overview"
        active={pathname === '/dashboard/branch-manager'}
      />

      <NavGroup label="Front Desk" icon={UserCheck} defaultOpen>
        <NavItem
          href="/dashboard/branch-manager/reservations"
          icon={Calendar}
          label="Reservations"
          active={pathname === '/dashboard/branch-manager/reservations'}
        />
        <NavItem
          href="/dashboard/branch-manager/checkin"
          icon={UserCheck}
          label="Check-in"
          active={pathname === '/dashboard/branch-manager/checkin'}
        />
        <NavItem
          href="/dashboard/branch-manager/arrivals"
          icon={ArrowDownUp}
          label="Arrivals"
          active={pathname === '/dashboard/branch-manager/arrivals'}
        />
        <NavItem
          href="/dashboard/branch-manager/departures"
          icon={ArrowDownUp}
          label="Departures"
          active={pathname === '/dashboard/branch-manager/departures'}
        />
        <NavItem
          href="/dashboard/branch-manager/guests"
          icon={Users}
          label="Guests"
          active={pathname === '/dashboard/branch-manager/guests'}
        />
      </NavGroup>

      <NavItem
        href="/dashboard/branch-manager/rooms"
        icon={Bed}
        label="Rooms"
        active={pathname === '/dashboard/branch-manager/rooms'}
      />

      <NavGroup label="Operations" icon={Building}>
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
        <NavItem
          href="/dashboard/branch-manager/restaurant"
          icon={Utensils}
          label="Restaurant"
          active={pathname === '/dashboard/branch-manager/restaurant'}
        />
      </NavGroup>

      <NavGroup label="Staff" icon={Users}>
        <NavItem
          href="/dashboard/branch-manager/staff"
          icon={Users}
          label="Staff"
          active={pathname === '/dashboard/branch-manager/staff'}
        />
        <NavItem
          href="/dashboard/branch-manager/attendance"
          icon={CheckCircle}
          label="Attendance"
          active={pathname === '/dashboard/branch-manager/attendance'}
        />
      </NavGroup>

      {(user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER) && (
        <NavItem
          href="/dashboard/branch-manager/wastage"
          icon={Trash2}
          label="Wastage Reports"
          active={pathname === '/dashboard/branch-manager/wastage'}
        />
      )}
    </>
  );

  // Determine which navigation to render based on user role
  const renderNavigation = () => {
    if (user.role === UserRole.SUPER_ADMIN) {
      return (
        <>
          {adminNav}
          <hr className="my-4" />
          {centralOperationsNav}
          <hr className="my-4" />
          {branchOperationsNav}
          <hr className="my-4" />
          {facilitiesNav}
        </>
      );
    }

    // Central Operations Manager Navigation
    if (user.role === UserRole.CENTRAL_OPERATIONS_MANAGER) {
      return centralOperationsNav;
    }

    // Central Storekeeper Navigation (Legacy - has own dashboard)
    if (user.role === UserRole.CENTRAL_STOREKEEPER) {
      return centralStoreNav;
    }

    // General Manager Navigation (Legacy - has own dashboard)
    if (user.role === UserRole.GENERAL_MANAGER) {
      return gmNav;
    }

    // Branch Operations Manager Navigation
    if (user.role === UserRole.BRANCH_OPERATIONS_MANAGER) {
      return branchOperationsNav;
    }

    // Branch Storekeeper Navigation (Legacy - has own dashboard)
    if (user.role === UserRole.BRANCH_STOREKEEPER) {
      return branchStoreNav;
    }

    // Branch Manager Navigation (Legacy - has own dashboard)
    if (user.role === UserRole.BRANCH_MANAGER) {
      return branchManagerNav;
    }

    // Facilities Manager Navigation
    if (user.role === UserRole.FACILITIES_MANAGER) {
      return facilitiesNav;
    }

    // Housekeeping Navigation (Legacy - has own dashboard)
    if (user.role === UserRole.HOUSEKEEPING || user.role === UserRole.HOUSEKEEPING_SUPERVISOR) {
      return housekeepingNav;
    }

    // Maintenance Navigation (Legacy - has own dashboard)
    if (user.role === UserRole.MAINTENANCE) {
      return maintenanceNav;
    }

    // Receptionist Navigation
    if (user.role === UserRole.RECEPTIONIST) {
      return receptionNav;
    }

    // Restaurant Navigation
    if (user.role === UserRole.RESTAURANT) {
      return restaurantNav;
    }

    // POS Kitchen Navigation
    if (user.role === UserRole.POS_KITCHEN) {
      return posKitchenNav;
    }

    // Kitchen Navigation
    if (user.role === UserRole.KITCHEN) {
      return kitchenNav;
    }

    // Bartender Navigation
    if (user.role === UserRole.BARTENDER) {
      return barNav;
    }

    // Auditor Navigation
    if (user.role === UserRole.AUDITOR) {
      return auditorNav;
    }

    // Branch Accounting Navigation

    // Cashier Navigation
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

    // Default navigation for roles without specific nav - redirect to role-specific dashboard
    return null;
  };

  return (
    <>
      {/* Mobile Menu Button - Only visible on small screens */}
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-stone-200 hover:bg-stone-50 transition-colors"
        aria-label="Toggle menu"
      >
        {isMobileMenuOpen ? (
          <X className="h-5 w-5 text-stone-700" />
        ) : (
          <Menu className="h-5 w-5 text-stone-700" />
        )}
      </button>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Navigation Drawer */}
      <div
        className={cn(
          "fixed lg:relative inset-y-0 left-0 z-40 w-64 bg-white border-r border-stone-200 transform transition-transform duration-300 ease-in-out overflow-y-auto",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="p-4 space-y-1">
          {renderNavigation()}
        </div>
      </div>
    </>
  );
}
