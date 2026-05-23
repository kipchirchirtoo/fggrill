"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Calculator, Receipt, DollarSign, FileText, BarChart3, Landmark, CreditCard, Wallet } from 'lucide-react';
import { NavItem, NavGroup } from './nav-components';

export function AccountingNav() {
  const pathname = usePathname();

  return (
    <>
      <NavItem
        href="/dashboard/accountant"
        icon={LayoutDashboard}
        label="Accounting Dashboard"
        active={pathname === '/dashboard/accountant'}
      />

      <NavGroup label="Daily Operations" icon={Calculator} defaultOpen>
        <NavItem
          href="/dashboard/accountant/daily-sales"
          icon={DollarSign}
          label="Daily Sales"
          active={pathname === '/dashboard/accountant/daily-sales'}
        />
        <NavItem
          href="/dashboard/accountant/expenses"
          icon={Receipt}
          label="Expense Recording"
          active={pathname === '/dashboard/accountant/expenses'}
        />
        <NavItem
          href="/dashboard/accountant/reconciliation"
          icon={FileText}
          label="Daily Reconciliation"
          active={pathname === '/dashboard/accountant/reconciliation'}
        />
      </NavGroup>

      <NavGroup label="Banking & Payments" icon={Landmark}>
        <NavItem
          href="/dashboard/accountant/banking"
          icon={Landmark}
          label="Bank Deposits"
          active={pathname === '/dashboard/accountant/banking'}
        />
        <NavItem
          href="/dashboard/accountant/mpesa"
          icon={CreditCard}
          label="M-Pesa Reconciliation"
          active={pathname === '/dashboard/accountant/mpesa'}
        />
        <NavItem
          href="/dashboard/accountant/petty-cash"
          icon={Wallet}
          label="Petty Cash"
          active={pathname === '/dashboard/accountant/petty-cash'}
        />
      </NavGroup>

      <NavGroup label="Reports" icon={BarChart3}>
        <NavItem
          href="/dashboard/accountant/reports"
          icon={BarChart3}
          label="Financial Reports"
          active={pathname === '/dashboard/accountant/reports'}
        />
        <NavItem
          href="/dashboard/accountant/payroll"
          icon={FileText}
          label="Payroll Reports"
          active={pathname === '/dashboard/accountant/payroll'}
        />
      </NavGroup>
    </>
  );
}
