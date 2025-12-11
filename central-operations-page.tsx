'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { Card } from '@/components/ui/minimal/card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { centralOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import Link from 'next/link';
import { 
  Building2, DollarSign, Users, TrendingUp, ChevronRight,
  RefreshCw, Package, ClipboardList, ArrowDownUp, BarChart3,
  Map, Truck, Warehouse, AlertTriangle, Boxes, Store
} from 'lucide-react';

// Main dashboard content component
function CentralOperationsDashboardContent() {
  const { user } = useAuth();
  const { branches } = useBranch();
  const [stats, setStats] = useState({
    totalBranches: 0,
    activeBranches: 0,
    revenue: {
      today: 0,
      month: 0,
      growth: 0
    },
    inventory: {
      totalItems: 0,
      lowStockItems: 0,
      totalValue: 0
    },
    requests: {
      pending: 0,
      approved: 0,
      total: 0
    },
    dispatches: {
      inTransit: 0,
      delivered: 0,
      pending: 0
    }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [branchPerformance, setBranchPerformance] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      // Fetch main dashboard data
      const response = await centralOperationsAPI.getDashboard();
      
      if (response.success) {
        setStats(response.data?.stats || stats);
      }
      
      // Fetch branch performance data
      const performanceResponse = await centralOperationsAPI.getBranchComparison('revenue', 'week');
      
      if (performanceResponse.success) {
        setBranchPerformance(performanceResponse.data || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
      
      // Set some default stats using branch data from context
      setStats({
        ...stats,
        totalBranches: branches.length,
        activeBranches: branches.filter(b => b.status === 'active').length
      });
    } finally {
      setIsLoading(false);
    }
  };

  const quickLinks = [
    { href: '/dashboard/central-operations/warehouse/inventory', icon: Package, label: 'Master Inventory', color: 'bg-blue-50 text-blue-600' },
    { href: '/dashboard/central-operations/warehouse/requests', icon: ClipboardList, label: 'Requests', color: 'bg-yellow-50 text-yellow-600' },
    { href: '/dashboard/central-operations/warehouse/dispatches', icon: Truck, label: 'Dispatches', color: 'bg-purple-50 text-purple-600' },
    { href: '/dashboard/central-operations/branch-oversight/comparison', icon: BarChart3, label: 'Branch Comparison', color: 'bg-green-50 text-green-600' },
    { href: '/dashboard/central-operations/strategic-planning/budgets', icon: DollarSign, label: 'Budgets', color: 'bg-indigo-50 text-indigo-600' },
    { href: '/dashboard/central-operations/branch-oversight/staff', icon: Users, label: 'Staff Overview', color: 'bg-pink-50 text-pink-600' },
    { href: '/dashboard/central-operations/warehouse/transfers', icon: ArrowDownUp, label: 'Transfers', color: 'bg-amber-50 text-amber-600' },
    { href: '/dashboard/central-operations/analytics/reports', icon: TrendingUp, label: 'Reports', color: 'bg-cyan-50 text-cyan-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.CENTRAL_OPERATIONS_MANAGER,
      UserRole.GENERAL_MANAGER,
      UserRole.CENTRAL_STOREKEEPER,
      UserRole.SUPER_ADMIN
    ]}>
      <BranchAwareDashboardLayout
        title="Central Operations"
        subtitle="Multi-branch management and central warehouse control"
        requireBranchContext={false}
        actionButton={
          <IOSButton variant="secondary" onClick={fetchDashboardData} leftIcon={<RefreshCw />}>
            Refresh
          </IOSButton>
        }
      >
        <div className="space-y-6">
          {/* Branch Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <Building2 className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm text-gray-500">Total Branches</p>
              <p className="text-lg font-bold">{stats.totalBranches}</p>
            </IOSCard>
            
            <IOSCard className="p-4">
              <Store className="h-5 w-5 text-green-600 mb-2" />
              <p className="text-sm text-gray-500">Active Branches</p>
              <p className="text-lg font-bold text-green-600">{stats.activeBranches}</p>
            </IOSCard>
            
            <IOSCard className="p-4">
              <Warehouse className="h-5 w-5 text-purple-600 mb-2" />
              <p className="text-sm text-gray-500">Master Items</p>
              <p className="text-lg font-bold">
                {stats.inventory.totalItems}
              </p>
            </IOSCard>
            
            <IOSCard className="p-4">
              <DollarSign className="h-5 w-5 text-amber-600 mb-2" />
              <p className="text-sm text-gray-500">Total Revenue</p>
              <p className="text-lg font-bold">KES {(stats.revenue.month / 1000).toFixed(0)}K</p>
              <p className="text-xs text-green-600">
                {stats.revenue.growth > 0 ? '+' : ''}{stats.revenue.growth}% from last month
              </p>
            </IOSCard>
          </div>

          {/* Inventory & Request Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Warehouse Status</h3>
                <Link href="/dashboard/central-operations/warehouse/inventory">
                  <IOSButton variant="ghost" size="sm">View</IOSButton>
                </Link>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="font-bold">{stats.inventory.totalItems}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Low Stock Items</p>
                  <p className="font-bold text-yellow-600">{stats.inventory.lowStockItems}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Stock Value</p>
                  <p className="font-bold">KES {(stats.inventory.totalValue / 1000).toFixed(0)}K</p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Stock Requests</h3>
                <Link href="/dashboard/central-operations/warehouse/requests">
                  <IOSButton variant="ghost" size="sm">View</IOSButton>
                </Link>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Pending Review</p>
                  <p className="font-bold text-yellow-600">{stats.requests.pending}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Approved</p>
                  <p className="font-bold text-blue-600">{stats.requests.approved}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Total Requests</p>
                  <p className="font-bold">{stats.requests.total}</p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Dispatches</h3>
                <Link href="/dashboard/central-operations/warehouse/dispatches">
                  <IOSButton variant="ghost" size="sm">View</IOSButton>
                </Link>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">In Transit</p>
                  <p className="font-bold text-blue-600">{stats.dispatches.inTransit}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Pending</p>
                  <p className="font-bold text-yellow-600">{stats.dispatches.pending}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Delivered</p>
                  <p className="font-bold text-green-600">{stats.dispatches.delivered}</p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Quick Links */}
          <IOSCard className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold font-sf-pro-display">Quick Access</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-none transition cursor-pointer text-center ${link.color.split(' ')[0]}`}>
                    <link.icon className={`h-6 w-6 mx-auto mb-2 ${link.color.split(' ')[1]}`} />
                    <p className="text-sm font-medium">{link.label}</p>
                  </IOSCard>
                </Link>
              ))}
            </div>
          </IOSCard>

          {/* Branch Performance */}
          <IOSCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold font-sf-pro-display">Branch Performance</h3>
              <Link href="/dashboard/central-operations/branch-oversight/comparison">
                <IOSButton variant="ghost" size="sm">
                  Full Comparison <ChevronRight className="h-4 w-4 ml-1" />
                </IOSButton>
              </Link>
            </div>
            
            {isLoading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-8 bg-gray-100 rounded-lg"></div>
                <div className="h-8 bg-gray-100 rounded-lg"></div>
                <div className="h-8 bg-gray-100 rounded-lg"></div>
                <div className="h-8 bg-gray-100 rounded-lg"></div>
              </div>
            ) : branchPerformance.length === 0 ? (
              <div className="text-center py-8">
                <Map className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500">No branch performance data available</p>
              </div>
            ) : (
              <div className="space-y-4">
                {branchPerformance.slice(0, 5).map((branch, index) => (
                  <div key={branch.id || index} className="flex items-center">
                    <div className="w-10 h-10 rounded-ios-lg bg-blue-100 flex items-center justify-center mr-3">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <p className="font-medium">{branch.name}</p>
                        <p className="font-bold">KES {(branch.revenue / 1000).toFixed(0)}K</p>
                      </div>
                      <div className="relative mt-2 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-blue-600"
                          style={{ 
                            width: `${Math.min(
                              (branch.revenue / (branchPerformance[0]?.revenue || 1)) * 100, 
                              100
                            )}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </IOSCard>

          {/* Alerts & Notifications */}
          <IOSCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold font-sf-pro-display">Alerts & Notifications</h3>
              <IOSButton variant="ghost" size="sm">
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </IOSButton>
            </div>
            
            <div className="space-y-3">
              <div className="p-3 border border-yellow-200 rounded-ios-lg bg-yellow-50 flex">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-medium text-yellow-800">Low Stock Alert</p>
                  <p className="text-sm text-yellow-700">15 items below reorder level in Central Warehouse</p>
                </div>
              </div>
              
              <div className="p-3 border border-blue-200 rounded-ios-lg bg-blue-50 flex">
                <Truck className="h-5 w-5 text-blue-600 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-800">Dispatch Update</p>
                  <p className="text-sm text-blue-700">Dispatch #D-2025120002 to Famous Gate Kericho is in transit</p>
                </div>
              </div>
              
              <div className="p-3 border border-green-200 rounded-ios-lg bg-green-50 flex">
                <Boxes className="h-5 w-5 text-green-600 mr-3 flex-shrink-0" />
                <div>
                  <p className="font-medium text-green-800">Delivery Confirmed</p>
                  <p className="text-sm text-green-700">Famous Gate Bomet has confirmed receipt of Dispatch #D-2025120001</p>
                </div>
              </div>
            </div>
          </IOSCard>
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

// Export wrapped dashboard to prevent hydration errors
export default function CentralOperationsDashboard() {
  return (
    <BranchPageWrapper>
      <CentralOperationsDashboardContent />
    </BranchPageWrapper>
  );
}
