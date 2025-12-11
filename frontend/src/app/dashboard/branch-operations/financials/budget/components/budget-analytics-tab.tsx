'use client';

import { useState, useEffect } from 'react';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { IOSButton } from '@/components/ui/ios-button';
import { toast } from 'sonner';
import { budgetAPI } from '@/lib/api/budget';
import { RefreshCw, BarChart2, PieChart, Download, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react';
import { BudgetVarianceReport } from './budget-variance-report';

// Extended BudgetPerformance interface with additional properties
interface ExtendedBudgetPerformance {
  overall: {
    allocated: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: string;
  };
  categories: {
    category: string;
    allocated: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: string;
  }[];
  monthly: {
    month: string;
    allocated: number;
    spent: number;
    percentage: number;
  }[];
  fiscal_year?: string;
}

interface BudgetAnalyticsTabProps {
  branchId?: number;
  fiscalYear: string;
}

export function BudgetAnalyticsTab({ branchId, fiscalYear }: BudgetAnalyticsTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [performance, setPerformance] = useState<ExtendedBudgetPerformance | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    if (branchId) {
      fetchBudgetPerformance();
    }
  }, [branchId, fiscalYear]);

  const fetchBudgetPerformance = async () => {
    setIsLoading(true);
    try {
      const response = await budgetAPI.getBudgetPerformance(fiscalYear, branchId);
      
      if (response.success && response.data) {
        setPerformance(response.data);
      } else {
        toast.error('Failed to load budget performance data');
      }
    } catch (error) {
      console.error('Error fetching budget performance:', error);
      toast.error('An error occurred while loading budget performance data');
    } finally {
      setIsLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return (
      <IOSCard className="p-8 text-center">
        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-2" />
        <p className="text-gray-500">Loading budget analytics...</p>
      </IOSCard>
    );
  }

  if (!performance) {
    return (
      <IOSCard className="p-8 text-center">
        <BarChart2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">No budget performance data available</p>
        <IOSButton
          variant="outline"
          className="mt-4"
          onClick={fetchBudgetPerformance}
          leftIcon={<RefreshCw className="h-4 w-4" />}
        >
          Refresh Data
        </IOSButton>
      </IOSCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <IOSCard className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">Total Budget</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(performance.overall.allocated)}</p>
            </div>
            <PieChart className="h-5 w-5 text-[#007AFF]" />
          </div>
        </IOSCard>
        
        <IOSCard className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">Total Spent</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(performance.overall.spent)}</p>
            </div>
            {(
              <TrendingDown className="h-5 w-5 text-[#5856D6]" />
            )}
          </div>
          <div className="mt-2">
            <div className="text-xs text-gray-500 flex justify-between mb-1">
              <span>Usage</span>
              <span className={performance.overall.percentage > 100 ? 'text-[#FF3B30]' : 'text-gray-500'}>
                {performance.overall.percentage.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full ${
                  performance.overall.percentage > 100 ? 'bg-[#FF3B30]' : 
                  performance.overall.percentage > 90 ? 'bg-[#FF9500]' : 
                  'bg-[#34C759]'
                }`}
                style={{ width: `${Math.min(performance.overall.percentage, 100)}%` }}
              ></div>
            </div>
          </div>
        </IOSCard>
        
        <IOSCard className="p-4">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-gray-500">Remaining</p>
              <p className={`text-xl font-bold mt-1 ${performance.overall.remaining < 0 ? 'text-[#FF3B30]' : ''}`}>
                {formatCurrency(performance.overall.remaining)}
              </p>
            </div>
            <TrendingUp className={`h-5 w-5 ${performance.overall.remaining < 0 ? 'text-[#FF3B30]' : 'text-[#34C759]'}`} />
          </div>
          <div className="mt-2">
            <div className="text-xs text-gray-500 flex justify-between mb-1">
              <span>Budget Status</span>
              <IOSBadge className={`
                ${performance.overall.percentage > 100 ? 'bg-red-100 text-red-700' : 
                  performance.overall.percentage > 90 ? 'bg-yellow-100 text-yellow-700' : 
                  'bg-green-100 text-green-700'}
              `}>
                {performance.overall.status === 'over_budget' ? 'Over Budget' : 
                  performance.overall.status === 'warning' ? 'Warning' : 
                  'On Track'}
              </IOSBadge>
            </div>
          </div>
        </IOSCard>
        
        <IOSCard className="p-4">
          <div className="flex flex-col h-full justify-between">
            <div>
              <p className="text-sm text-gray-500">Download Report</p>
              <p className="text-sm mt-1">Export budget analysis</p>
            </div>
            <IOSButton 
              size="sm" 
              className="mt-4 w-full"
              leftIcon={<Download className="h-4 w-4" />}
            >
              Export
            </IOSButton>
          </div>
        </IOSCard>
      </div>
      
      {/* Category Breakdown */}
      <IOSCard className="p-4">
        <div className="flex justify-between mb-4">
          <h3 className="font-medium">Budget by Category</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Fiscal Year:</span>
            <IOSBadge className="bg-blue-100 text-blue-700">{fiscalYear}</IOSBadge>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {performance.categories.map((category) => {
            const percentage = category.percentage;
            const remaining = category.allocated - category.spent;
            
            return (
              <div 
                key={category.category} 
                className={`p-4 rounded-md border ${
                  selectedCategory === category.category ? 'border-[#007AFF] bg-blue-50' : 'border-gray-200'
                } cursor-pointer`}
                onClick={() => setSelectedCategory(
                  selectedCategory === category.category ? null : category.category
                )}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {category.category.charAt(0).toUpperCase() + category.category.slice(1).replace('_', ' ')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(category.spent)} / {formatCurrency(category.allocated)}
                    </p>
                  </div>
                  <IOSBadge className={`
                    ${category.percentage > 100 ? 'bg-red-100 text-red-700' : 
                      category.percentage > 90 ? 'bg-yellow-100 text-yellow-700' : 
                      'bg-green-100 text-green-700'}
                  `}>
                    {category.percentage.toFixed(1)}%
                  </IOSBadge>
                </div>
                
                <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      percentage > 100 ? 'bg-red-600' : 
                      percentage > 90 ? 'bg-yellow-600' : 
                      percentage > 70 ? 'bg-blue-600' :
                      'bg-green-600'
                    }`}
                    style={{ width: `${Math.min(100, percentage)}%` }}
                  ></div>
                </div>
                
                <div className="mt-3 flex justify-between text-xs">
                  <span className="text-gray-500">Remaining</span>
                  <span className={remaining < 0 ? 'text-red-600 font-medium' : ''}>
                    {formatCurrency(remaining)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </IOSCard>
      
      {/* Monthly Trend */}
      {performance.monthly && performance.monthly.length > 0 && (
        <IOSCard className="p-4">
          <h3 className="font-medium mb-4">Monthly Budget Trend</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead className="text-xs text-gray-500 border-b">
                <tr>
                  <th className="text-left py-2">Month</th>
                  <th className="text-right py-2">Allocated</th>
                  <th className="text-right py-2">Spent</th>
                  <th className="text-right py-2">Usage</th>
                  <th className="text-center py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {performance.monthly.map((month, index) => (
                  <tr key={month.month || index}>
                    <td className="py-3 text-sm">{month.month}</td>
                    <td className="py-3 text-sm text-right">{formatCurrency(month.allocated)}</td>
                    <td className="py-3 text-sm text-right">{formatCurrency(month.spent)}</td>
                    <td className="py-3 text-sm text-right">{month.percentage.toFixed(1)}%</td>
                    <td className="py-3 text-center">
                      <IOSBadge className={`
                        ${month.percentage > 100 ? 'bg-red-100 text-red-700' : 
                          month.percentage > 90 ? 'bg-yellow-100 text-yellow-700' : 
                          'bg-green-100 text-green-700'}
                      `}>
                        {month.percentage > 100 ? 'Over Budget' : 
                          month.percentage > 90 ? 'Near Limit' : 
                          'On Track'}
                      </IOSBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </IOSCard>
      )}
      
      {/* Budget Variance Report */}
      <BudgetVarianceReport
        branchId={branchId}
        fiscalYear={fiscalYear}
        category={selectedCategory}
      />
    </div>
  );
}
