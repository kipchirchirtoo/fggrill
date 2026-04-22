'use client';

import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { 
  ShoppingCart, Users, DollarSign, FileText, 
  Package, BarChart3, Calendar, CheckCircle 
} from 'lucide-react';
import Link from 'next/link';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  href: string;
  color: string;
  description: string;
}

const quickActions: QuickAction[] = [
  {
    id: 'stock-request',
    label: 'Request Stock',
    icon: ShoppingCart,
    href: '/dashboard/branch-store/requests',
    color: 'bg-blue-500',
    description: 'Create new stock requisition'
  },
  {
    id: 'staff-performance',
    label: 'Staff Performance',
    icon: Users,
    href: '/dashboard/branch-manager/staff/performance',
    color: 'bg-green-500',
    description: 'View team KPIs'
  },
  {
    id: 'cashier-clearance',
    label: 'Cashier Clearance',
    icon: DollarSign,
    href: '/dashboard/branch-manager/cashier-clearance',
    color: 'bg-purple-500',
    description: 'Review daily clearances'
  },
  {
    id: 'stock-analytics',
    label: 'Stock Analytics',
    icon: BarChart3,
    href: '/dashboard/branch-manager/stock/analytics',
    color: 'bg-indigo-500',
    description: 'Consumption trends'
  },
  {
    id: 'attendance',
    label: 'Attendance',
    icon: CheckCircle,
    href: '/dashboard/branch-manager/attendance',
    color: 'bg-pink-500',
    description: 'Staff attendance logs'
  }
];

export function QuickActionsWidget() {
  return (
    <IOSCard className="p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.id} href={action.href}>
              <div className="group p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all cursor-pointer border border-transparent hover:border-[#007AFF]">
                <div className={`${action.color} w-10 h-10 rounded-lg flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <Icon className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm font-semibold text-gray-900 mb-1">{action.label}</p>
                <p className="text-xs text-gray-500">{action.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </IOSCard>
  );
}
