"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { Store, ScanLine, Package, Apple, Beer, Pencil, ClipboardList, Truck, FileText, Users, Warehouse, BarChart3, ShieldCheck } from 'lucide-react';
import { NavItem, NavGroup } from './nav-components';

export function CentralStoreNav() {
  const pathname = usePathname();

  return (
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

      <NavGroup label="Purchasing & Compliance" icon={FileText} defaultOpen>
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
}
