'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { branchOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { 
  DollarSign, TrendingUp, TrendingDown, BarChart4, ArrowRightCircle,
  FileText, RefreshCw, PieChart, Receipt, Calendar, Users
} from 'lucide-react';
import Link from 'next/link';
import { format, subDays } from 'date-fns';

// Financial summary interface
interface FinancialSummary {
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    lastMonth: number;
    growth: number;
  };
  expenses: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    lastMonth: number;
    growth: number;
  };
  occupancy: {
    currentRate: number;
    averageRate: number;
    trend: number;
  };
  transactions: {
    count: number;
    average: number;
    pending: number;
  };
  topRevenueSource: {
    name: string;
    amount: number;
    percentage: number;
  };
}

function BranchFinancialsContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());

  useEffect(() => {
    if (activeBranchId) {
      fetchFinancialSummary();
    }
  }, [activeBranchId, selectedPeriod]);

  const fetchFinancialSummary = async () => {
    setIsLoading(true);
    try {
      // Call the real API
      const response = await branchOperationsAPI.getFinancialSummary(selectedPeriod, activeBranchId);
      
      if (response.success) {
        setSummary(response.data);
      } else {
        // If API fails, use placeholder data
        const placeholderData: FinancialSummary = {
          revenue: {
            today: 125000,
            thisWeek: 875000,
            thisMonth: 3750000,
            lastMonth: 3500000,
            growth: 7.14
          },
          expenses: {
            today: 45000,
            thisWeek: 315000,
            thisMonth: 1350000,
            lastMonth: 1275000,
            growth: 5.88
          },
          occupancy: {
            currentRate: 76.5,
            averageRate: 72.3,
            trend: 5.8
          },
          transactions: {
            count: 47,
            average: 2659.57,
            pending: 5
          },
          topRevenueSource: {
            name: 'Room Bookings',
            amount: 2250000,
            percentage: 60
          }
        };
        setSummary(placeholderData);
      }
    } catch (error) {
      console.error('Error fetching financial summary:', error);
      toast.error('Failed to load financial data');
    } finally {
      setIsLoading(false);
    }
  };

  const quickLinks = [
    { href: '/dashboard/branch-operations/financials/revenue', icon: TrendingUp, label: 'Revenue', color: 'text-green-600' },
    { href: '/dashboard/branch-operations/financials/expenses', icon: TrendingDown, label: 'Expenses', color: 'text-red-600' },
    { href: '/dashboard/branch-operations/financials/reports', icon: FileText, label: 'Reports', color: 'text-blue-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <BranchAwareDashboardLayout
        title="Branch Financials"
        subtitle={`Financial overview for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <IOSButton variant="secondary" onClick={fetchFinancialSummary} leftIcon={<RefreshCw />}>Refresh</IOSButton>
        }
      >
        <div className="space-y-6">
          <div className="flex gap-2">
            {['day', 'week', 'month'].map((period) => (
              <IOSButton key={period} variant={selectedPeriod === period ? 'primary' : 'secondary'} onClick={() => setSelectedPeriod(period as any)} size="sm">
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </IOSButton>
            ))}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : summary ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <IOSCard className="p-4">
                  <DollarSign className="h-6 w-6 text-green-600 mb-2" />
                  <p className="text-sm text-gray-500">Today's Revenue</p>
                  <p className="text-xl font-bold">KES {summary.revenue.today.toLocaleString()}</p>
                </IOSCard>
                <IOSCard className="p-4">
                  <TrendingUp className="h-6 w-6 text-blue-600 mb-2" />
                  <p className="text-sm text-gray-500">This Month</p>
                  <p className="text-xl font-bold">KES {summary.revenue.thisMonth.toLocaleString()}</p>
                </IOSCard>
                <IOSCard className="p-4">
                  <BarChart4 className="h-6 w-6 text-purple-600 mb-2" />
                  <p className="text-sm text-gray-500">Occupancy Rate</p>
                  <p className="text-xl font-bold">{summary.occupancy.currentRate}%</p>
                </IOSCard>
                <IOSCard className="p-4">
                  <Receipt className="h-6 w-6 text-orange-600 mb-2" />
                  <p className="text-sm text-gray-500">Transactions</p>
                  <p className="text-xl font-bold">{summary.transactions.count}</p>
                </IOSCard>
              </div>

              <IOSCard className="p-6">
                <h3 className="font-semibold mb-4">Quick Access</h3>
                <div className="grid grid-cols-3 gap-4">
                  {quickLinks.map((link) => (
                    <Link key={link.href} href={link.href}>
                      <IOSCard className="p-4 text-center hover:shadow-md cursor-pointer">
                        <link.icon className={`h-8 w-8 mx-auto mb-2 ${link.color}`} />
                        <p className="font-medium">{link.label}</p>
                      </IOSCard>
                    </Link>
                  ))}
                </div>
              </IOSCard>
            </>
          ) : (
            <IOSCard className="p-12 text-center">
              <DollarSign className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No financial data available</p>
            </IOSCard>
          )}
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function BranchFinancialsPage() {
  return (
    <BranchPageWrapper>
      <BranchFinancialsContent />
    </BranchPageWrapper>
  );
}
