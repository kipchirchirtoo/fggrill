'use client';

import { useState, useEffect } from 'react';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { financeAPI, staffAPI } from '@/lib/api';
import { stockAnalyticsAPI } from '@/lib/api/branch-manager';
import { 
  TrendingUp, TrendingDown, DollarSign, Users, 
  Package, Target, ArrowUpRight, ArrowDownRight 
} from 'lucide-react';

interface PerformanceMetric {
  label: string;
  value: string | number;
  change: number;
  trend: 'up' | 'down';
  icon: React.ElementType;
  color: string;
}

interface PerformanceSummaryWidgetProps {
  branchId: string;
}

export function PerformanceSummaryWidget({ branchId }: PerformanceSummaryWidgetProps) {
  const [metrics, setMetrics] = useState<PerformanceMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
  }, [branchId]);

  const fetchMetrics = async () => {
    if (!branchId) return;

    setIsLoading(true);
    try {
      // Fetch revenue data
      const today = new Date().toISOString().split('T')[0];
      
      const [revenueResponse, staffResponse, stockResponse] = await Promise.all([
        financeAPI.getRevenueOverview({
          branch_id: branchId,
          date: today
        }).catch(err => {
          console.error('Revenue API error:', err);
          return { success: false, data: {} };
        }),
        
        staffAPI.getPerformance({
          branch_id: branchId,
          period: '7'
        }).catch(err => {
          console.error('Staff API error:', err);
          return { success: false, data: [] };
        }),
        
        stockAnalyticsAPI.getConsumptionTrends({
          branch_id: branchId,
          period: '7'
        }).catch(err => {
          console.error('Stock API error:', err);
          return { success: false, data: {} };
        })
      ]);

      const revenueData = revenueResponse.data || {};
      const staffData = Array.isArray(staffResponse.data) ? staffResponse.data : [];
      const stockData = stockResponse.data || {};

      // Calculate staff performance average
      const avgPerformance = staffData.length > 0
        ? staffData.reduce((sum: number, s: any) => sum + (s.performance_score || 0), 0) / staffData.length
        : 0;

      // Calculate performance change (compare with previous period if available)
      const performanceChange = 0; // TODO: Implement historical comparison

      const calculatedMetrics: PerformanceMetric[] = [
        {
          label: 'Daily Revenue',
          value: `KSh ${(revenueData.total_revenue || 0).toLocaleString()}`,
          change: revenueData.growth_rate || 0,
          trend: (revenueData.growth_rate || 0) >= 0 ? 'up' : 'down',
          icon: DollarSign,
          color: 'text-green-600'
        },
        {
          label: 'Target Achievement',
          value: `${(revenueData.achievement_percentage || 0).toFixed(1)}%`,
          change: revenueData.achievement_percentage || 0,
          trend: (revenueData.achievement_percentage || 0) >= 100 ? 'up' : 'down',
          icon: Target,
          color: 'text-blue-600'
        },
        {
          label: 'Staff Performance',
          value: `${avgPerformance.toFixed(1)}%`,
          change: performanceChange,
          trend: performanceChange >= 0 ? 'up' : 'down',
          icon: Users,
          color: 'text-purple-600'
        },
        {
          label: 'Stock Items',
          value: stockData.summary?.total_items || 0,
          change: stockData.summary?.increasing_trend || 0,
          trend: 'up',
          icon: Package,
          color: 'text-orange-600'
        }
      ];

      setMetrics(calculatedMetrics);
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <IOSCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Performance Summary</h3>
        <IOSBadge variant="light" color="success">Today</IOSBadge>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-24 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            const TrendIcon = metric.trend === 'up' ? ArrowUpRight : ArrowDownRight;
            
            return (
              <div
                key={index}
                className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${
                    metric.trend === 'up' ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    <Icon className={`h-4 w-4 ${metric.color}`} />
                  </div>
                  <div className={`flex items-center gap-1 text-xs font-semibold ${
                    metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  }`}>
                    <TrendIcon className="h-3 w-3" />
                    {Math.abs(metric.change).toFixed(1)}%
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-1">{metric.label}</p>
                <p className="text-lg font-bold text-gray-900">{metric.value}</p>
              </div>
            );
          })}
        </div>
      )}
    </IOSCard>
  );
}
