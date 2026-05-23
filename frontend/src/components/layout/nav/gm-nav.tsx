"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BarChart3, Building2, Users, Utensils, Store, Package, ShoppingCart, ClipboardList, Wallet, TrendingUp, Truck } from 'lucide-react';
import { NavItem, NavGroup } from './nav-components';

export function GMNav() {
  const pathname = usePathname();

  return (
    <>
      <NavItem
        href="/dashboard/gm"
        icon={LayoutDashboard}
        label="GM Dashboard"
        active={pathname === '/dashboard/gm'}
      />

      <NavGroup label="Branch Operations" icon={Building2} defaultOpen>
        <NavItem
          href="/dashboard/gm/performance"
          icon={TrendingUp}
          label="Branch Performance"
          active={pathname.includes('/dashboard/gm/performance')}
        />
        <NavItem
          href="/dashboard/gm/staff"
          icon={Users}
          label="Staff Overview"
          active={pathname.includes('/dashboard/gm/staff')}
        />
        <NavItem
          href="/dashboard/gm/revenue"
          icon={BarChart3}
          label="Revenue Analysis"
          active={pathname.includes('/dashboard/gm/revenue')}
        />
      </NavGroup>

      <NavGroup label="Kitchen Operations" icon={Utensils}>
        <NavItem
          href="/dashboard/kitchen/orders"
          icon={ClipboardList}
          label="Kitchen Orders"
          active={pathname.includes('/dashboard/kitchen/orders')}
        />
        <NavItem
          href="/dashboard/kitchen/menu"
          icon={Utensils}
          label="Menu Management"
          active={pathname.includes('/dashboard/kitchen/menu')}
        />
        <NavItem
          href="/dashboard/kitchen/inventory"
          icon={Package}
          label="Kitchen Inventory"
          active={pathname.includes('/dashboard/kitchen/inventory')}
        />
      </NavGroup>

      <NavGroup label="Store & Procurement" icon={Store}>
        <NavItem
          href="/dashboard/central-store"
          icon={Package}
          label="Central Store"
          active={pathname === '/dashboard/central-store'}
        />
        <NavItem
          href="/dashboard/procurement"
          icon={ShoppingCart}
          label="Procurement"
          active={pathname === '/dashboard/procurement'}
        />
        <NavItem
          href="/dashboard/central-store/dispatch"
          icon={Truck}
          label="Dispatch"
          active={pathname.includes('/dashboard/central-store/dispatch')}
        />
      </NavGroup>

      <NavGroup label="Financial Control" icon={Wallet}>
        <NavItem
          href="/dashboard/gm/expenses"
          icon={Wallet}
          label="Expense Overview"
          active={pathname.includes('/dashboard/gm/expenses')}
        />
        <NavItem
          href="/dashboard/gm/budget"
          icon={BarChart3}
          label="Budget vs Actual"
          active={pathname.includes('/dashboard/gm/budget')}
        />
      </NavGroup>
    </>
  );
}
