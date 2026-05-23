"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Building2, Users, Utensils, Store, Calendar, ClipboardList, BarChart3, Settings } from 'lucide-react';
import { NavItem, NavGroup } from './nav-components';

export function BranchOperationsNav() {
  const pathname = usePathname();

  return (
    <>
      <NavItem
        href="/dashboard/branch-operations"
        icon={LayoutDashboard}
        label="Branch Operations"
        active={pathname === '/dashboard/branch-operations'}
      />

      <NavGroup label="Staff Management" icon={Users} defaultOpen>
        <NavItem
          href="/dashboard/branch-operations/staff"
          icon={Users}
          label="Staff Overview"
          active={pathname === '/dashboard/branch-operations/staff'}
        />
        <NavItem
          href="/dashboard/branch-operations/attendance"
          icon={Calendar}
          label="Attendance"
          active={pathname === '/dashboard/branch-operations/attendance'}
        />
        <NavItem
          href="/dashboard/branch-operations/shifts"
          icon={ClipboardList}
          label="Shift Scheduling"
          active={pathname === '/dashboard/branch-operations/shifts'}
        />
      </NavGroup>

      <NavGroup label="Kitchen & Service" icon={Utensils}>
        <NavItem
          href="/dashboard/branch-operations/kitchen"
          icon={Utensils}
          label="Kitchen Operations"
          active={pathname === '/dashboard/branch-operations/kitchen'}
        />
        <NavItem
          href="/dashboard/branch-operations/service"
          icon={Building2}
          label="Service Quality"
          active={pathname === '/dashboard/branch-operations/service'}
        />
      </NavGroup>

      <NavGroup label="Store Management" icon={Store}>
        <NavItem
          href="/dashboard/branch-store"
          icon={Store}
          label="Branch Store"
          active={pathname === '/dashboard/branch-store'}
        />
        <NavItem
          href="/dashboard/branch-operations/inventory"
          icon={ClipboardList}
          label="Inventory Requests"
          active={pathname === '/dashboard/branch-operations/inventory'}
        />
      </NavGroup>

      <NavGroup label="Reports" icon={BarChart3}>
        <NavItem
          href="/dashboard/branch-operations/reports"
          icon={BarChart3}
          label="Branch Reports"
          active={pathname === '/dashboard/branch-operations/reports'}
        />
        <NavItem
          href="/dashboard/branch-operations/settings"
          icon={Settings}
          label="Branch Settings"
          active={pathname === '/dashboard/branch-operations/settings'}
        />
      </NavGroup>
    </>
  );
}
