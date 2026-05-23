"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Package, ArrowUpFromLine, History, BarChart3, ClipboardList, Box } from 'lucide-react';
import { NavItem, NavGroup } from './nav-components';

export function BranchStoreNav() {
  const pathname = usePathname();

  return (
    <>
      <NavItem
        href="/dashboard/branch-store"
        icon={LayoutDashboard}
        label="Branch Store Dashboard"
        active={pathname === '/dashboard/branch-store'}
      />

      <NavGroup label="Stock Management" icon={Package} defaultOpen>
        <NavItem
          href="/dashboard/branch-store/inventory"
          icon={Box}
          label="Current Stock"
          active={pathname === '/dashboard/branch-store/inventory'}
        />
        <NavItem
          href="/dashboard/branch-store/receiving"
          icon={ArrowUpFromLine}
          label="Goods Receiving"
          active={pathname === '/dashboard/branch-store/receiving'}
        />
        <NavItem
          href="/dashboard/branch-store/requests"
          icon={ClipboardList}
          label="Stock Requests"
          active={pathname === '/dashboard/branch-store/requests'}
        />
      </NavGroup>

      <NavGroup label="History & Reports" icon={History}>
        <NavItem
          href="/dashboard/branch-store/movements"
          icon={History}
          label="Stock Movements"
          active={pathname === '/dashboard/branch-store/movements'}
        />
        <NavItem
          href="/dashboard/branch-store/reports"
          icon={BarChart3}
          label="Branch Reports"
          active={pathname === '/dashboard/branch-store/reports'}
        />
      </NavGroup>
    </>
  );
}
