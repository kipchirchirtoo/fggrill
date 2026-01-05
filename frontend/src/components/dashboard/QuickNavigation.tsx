'use client';

import Link from 'next/link';
import { useAuth, UserRole } from '@/lib/auth-context';
import {
  Bed, UtensilsCrossed, Wine, Package, Users, DollarSign,
  ClipboardList, Wrench, Building2, BarChart3, Settings
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  color: string;
  roles: UserRole[];
}

const navigationItems: NavItem[] = [
  {
    href: '/dashboard/reception',
    label: 'Reception',
    icon: Bed,
    color: 'bg-blue-50 text-blue-600',
    roles: [UserRole.RECEPTIONIST, UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]
  },
  {
    href: '/dashboard/pos-kitchen',
    label: 'POS System',
    icon: UtensilsCrossed,
    color: 'bg-orange-50 text-orange-600',
    roles: [UserRole.RESTAURANT, UserRole.POS_KITCHEN, UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]
  },
  {
    href: '/dashboard/kitchen',
    label: 'Kitchen',
    icon: UtensilsCrossed,
    color: 'bg-red-50 text-red-600',
    roles: [UserRole.RESTAURANT, UserRole.POS_KITCHEN, UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]
  },
  {
    href: '/dashboard/bar',
    label: 'Bar',
    icon: Wine,
    color: 'bg-purple-50 text-purple-600',
    roles: [UserRole.BARTENDER, UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]
  },
  {
    href: '/dashboard/housekeeping',
    label: 'Housekeeping',
    icon: ClipboardList,
    color: 'bg-green-50 text-green-600',
    roles: [UserRole.HOUSEKEEPING, UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]
  },
  {
    href: '/dashboard/maintenance',
    label: 'Maintenance',
    icon: Wrench,
    color: 'bg-yellow-50 text-yellow-600',
    roles: [UserRole.MAINTENANCE, UserRole.FACILITIES_MANAGER, UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]
  },
  {
    href: '/dashboard/branch-store',
    label: 'Branch Store',
    icon: Package,
    color: 'bg-cyan-50 text-cyan-600',
    roles: [UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]
  },
  {
    href: '/dashboard/branch-operations',
    label: 'Operations',
    icon: Building2,
    color: 'bg-indigo-50 text-indigo-600',
    roles: [UserRole.BRANCH_OPERATIONS_MANAGER, UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]
  },
  {
    href: '/dashboard/branch-accounting',
    label: 'Accounting',
    icon: DollarSign,
    color: 'bg-emerald-50 text-emerald-600',
    roles: [UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]
  },
  {
    href: '/dashboard/reports',
    label: 'Reports',
    icon: BarChart3,
    color: 'bg-pink-50 text-pink-600',
    roles: [UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]
  },
  {
    href: '/dashboard/admin',
    label: 'Admin',
    icon: Settings,
    color: 'bg-stone-100 text-stone-600',
    roles: [UserRole.SUPER_ADMIN]
  },
];

interface QuickNavigationProps {
  currentPath?: string;
  maxItems?: number;
  showLabels?: boolean;
}

export function QuickNavigation({
  currentPath,
  maxItems = 6,
  showLabels = true
}: QuickNavigationProps) {
  const { user } = useAuth();

  if (!user) return null;

  // Filter items based on user role
  const accessibleItems = navigationItems.filter(item =>
    item.roles.includes(user.role as UserRole) && item.href !== currentPath
  ).slice(0, maxItems);

  if (accessibleItems.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {accessibleItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all hover:shadow-sm ${item.color}`}
        >
          <item.icon className="h-4 w-4" />
          {showLabels && <span className="text-sm font-medium">{item.label}</span>}
        </Link>
      ))}
    </div>
  );
}

export default QuickNavigation;
