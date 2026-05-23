"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingCart, Users, FileText, ClipboardList, Package, Truck, Receipt } from 'lucide-react';
import { NavItem, NavGroup } from './nav-components';

export function ProcurementNav() {
  const pathname = usePathname();

  return (
    <>
      <NavItem
        href="/dashboard/procurement"
        icon={LayoutDashboard}
        label="Procurement Dashboard"
        active={pathname === '/dashboard/procurement'}
      />

      <NavGroup label="Purchasing" icon={ShoppingCart} defaultOpen>
        <NavItem
          href="/dashboard/procurement/purchase-orders"
          icon={FileText}
          label="Purchase Orders"
          active={pathname === '/dashboard/procurement/purchase-orders'}
        />
        <NavItem
          href="/dashboard/procurement/grn"
          icon={ClipboardList}
          label="Goods Receipt (GRN)"
          active={pathname === '/dashboard/procurement/grn'}
        />
        <NavItem
          href="/dashboard/central-store/procurement/grn"
          icon={ClipboardList}
          label="Central Store GRN"
          active={pathname === '/dashboard/central-store/procurement/grn'}
        />
      </NavGroup>

      <NavGroup label="Suppliers" icon={Users}>
        <NavItem
          href="/dashboard/central-store/suppliers"
          icon={Users}
          label="Supplier Database"
          active={pathname === '/dashboard/central-store/suppliers'}
        />
        <NavItem
          href="/dashboard/central-store/suppliers/invoices"
          icon={Receipt}
          label="Supplier Invoices"
          active={pathname.includes('/dashboard/central-store/suppliers/invoices')}
        />
        <NavItem
          href="/dashboard/central-store/suppliers/payments"
          icon={FileText}
          label="Payments"
          active={pathname.includes('/dashboard/central-store/suppliers/payments')}
        />
      </NavGroup>

      <NavGroup label="Logistics" icon={Truck}>
        <NavItem
          href="/dashboard/central-store/dispatch"
          icon={Truck}
          label="Dispatch & Notes"
          active={pathname === '/dashboard/central-store/dispatch'}
        />
        <NavItem
          href="/dashboard/central-store/inventory"
          icon={Package}
          label="Central Store Inventory"
          active={pathname === '/dashboard/central-store/inventory'}
        />
      </NavGroup>
    </>
  );
}
