"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, BarChart3, DollarSign, Users, Building2, ShieldCheck, FileText, TrendingUp, Wallet, CreditCard, Landmark, Search, ClipboardCheck, CheckCircle, AlertCircle } from 'lucide-react';
import { NavItem, NavGroup } from './nav-components';

export function DirectorNav() {
  const pathname = usePathname();

  return (
    <>
      <NavItem
        href="/dashboard/director"
        icon={LayoutDashboard}
        label="Executive Dashboard"
        active={pathname === '/dashboard/director'}
      />

      <NavGroup label="Global Financial Overview" icon={BarChart3} defaultOpen>
        <NavItem
          href="/dashboard/director/financial-overview"
          icon={TrendingUp}
          label="Financial Intelligence"
          active={pathname.includes('/dashboard/director/financial-overview')}
        />
        <NavItem
          href="/dashboard/director/payment-intelligence"
          icon={CreditCard}
          label="Payment Intelligence"
          active={pathname.includes('/dashboard/director/payment-intelligence')}
        />
        <NavItem
          href="/dashboard/director/banking-control"
          icon={Landmark}
          label="Banking Control"
          active={pathname.includes('/dashboard/director/banking-control')}
        />
      </NavGroup>

      <NavGroup label="Discrepancy Control" icon={AlertCircle}>
        <NavItem
          href="/dashboard/director/discrepancy-control"
          icon={AlertCircle}
          label="Deep Drill-Down"
          active={pathname.includes('/dashboard/director/discrepancy-control')}
        />
        <NavItem
          href="/dashboard/director/review-tasks"
          icon={ClipboardCheck}
          label="Review Tasks"
          active={pathname.includes('/dashboard/director/review-tasks')}
        />
      </NavGroup>

      <NavGroup label="Audit & HR Oversight" icon={ShieldCheck}>
        <NavItem
          href="/dashboard/auditor"
          icon={Search}
          label="Auditor Overview"
          active={pathname === '/dashboard/auditor'}
        />
        <NavItem
          href="/dashboard/daily-verification"
          icon={CheckCircle}
          label="Daily Verification"
          active={pathname.includes('/dashboard/daily-verification')}
        />
        <NavItem
          href="/dashboard/financial-verification"
          icon={FileText}
          label="Financial Verification"
          active={pathname.includes('/dashboard/financial-verification')}
        />
        <NavItem
          href="/dashboard/shift-verification"
          icon={Users}
          label="Shift Verification"
          active={pathname.includes('/dashboard/shift-verification')}
        />
      </NavGroup>

      <NavGroup label="Corporate Management" icon={Building2}>
        <NavItem
          href="/dashboard/director/communications"
          icon={FileText}
          label="Communications"
          active={pathname.includes('/dashboard/director/communications')}
        />
        <NavItem
          href="/dashboard/staff"
          icon={Users}
          label="Staff Management"
          active={pathname === '/dashboard/staff'}
        />
      </NavGroup>
    </>
  );
}
