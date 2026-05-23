"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Settings, Shield, Building2, Database, FileText, Bell, Activity, Globe, Lock } from 'lucide-react';
import { NavItem, NavGroup } from './nav-components';

export function AdminNav() {
  const pathname = usePathname();

  return (
    <>
      <NavItem
        href="/dashboard/admin"
        icon={LayoutDashboard}
        label="Admin Dashboard"
        active={pathname === '/dashboard/admin'}
      />

      <NavGroup label="User Management" icon={Users} defaultOpen>
        <NavItem
          href="/dashboard/admin/users"
          icon={Users}
          label="All Users"
          active={pathname === '/dashboard/admin/users'}
        />
        <NavItem
          href="/dashboard/admin/users/roles"
          icon={Shield}
          label="Role Management"
          active={pathname.includes('/dashboard/admin/users/roles')}
        />
        <NavItem
          href="/dashboard/admin/users/permissions"
          icon={Lock}
          label="Permissions"
          active={pathname.includes('/dashboard/admin/users/permissions')}
        />
      </NavGroup>

      <NavGroup label="System Settings" icon={Settings}>
        <NavItem
          href="/dashboard/admin/settings/general"
          icon={Settings}
          label="General Settings"
          active={pathname.includes('/dashboard/admin/settings/general')}
        />
        <NavItem
          href="/dashboard/admin/settings/branches"
          icon={Building2}
          label="Branch Configuration"
          active={pathname.includes('/dashboard/admin/settings/branches')}
        />
        <NavItem
          href="/dashboard/admin/settings/integrations"
          icon={Globe}
          label="Integrations"
          active={pathname.includes('/dashboard/admin/settings/integrations')}
        />
      </NavGroup>

      <NavGroup label="Monitoring" icon={Activity}>
        <NavItem
          href="/dashboard/admin/system-logs"
          icon={FileText}
          label="System Logs"
          active={pathname === '/dashboard/admin/system-logs'}
        />
        <NavItem
          href="/dashboard/admin/audit-trail"
          icon={Database}
          label="Audit Trail"
          active={pathname === '/dashboard/admin/audit-trail'}
        />
        <NavItem
          href="/dashboard/admin/notifications"
          icon={Bell}
          label="Notifications"
          active={pathname === '/dashboard/admin/notifications'}
        />
      </NavGroup>
    </>
  );
}
