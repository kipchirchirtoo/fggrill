'use client';

import { useState, useEffect } from 'react';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { toast } from 'sonner';
import { budgetAPI } from '@/lib/api/budget';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface BudgetVarianceReportProps {
  budgetId?: string;
  budgetName?: string;
  branchId?: number;
  fiscalYear?: string;
  category?: string | null;
}

export function BudgetVarianceReport({ 
  budgetId, 
  budgetName, 
  branchId, 
  fiscalYear, 
  category 
}: BudgetVarianceReportProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [variance, setVariance] = useState<any>(null);

  useEffect(() => {
    if (branchId) {
      fetchVarianceReport();
    }
  }, [branchId, fiscalYear, category, budgetId]);

  const fetchVarianceReport = async () => {
    setIsLoading(true);
    try {
      const response = await budgetAPI.getBudgetVariance(fiscalYear, branchId);
      
      if (response.success && response.data) {
        // If a specific category is selected, filter the data
        if (category) {
          const filteredData = {
            ...response.data,
            category_variance: response.data.category_variance.filter(
              (item: any) => item.category === category
            ),
            variance_items: response.data.variance_items.filter(
              (item: any) => item.category === category
            )
          };
          setVariance(filteredData);
        } else {
          setVariance(response.data);
        }
      } else {
        toast.error('Failed to load budget variance data');
      }
    } catch (error) {
      console.error('Error fetching budget variance:', error);
      toast.error('An error occurred while loading budget variance data');
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

  // Get variance class based on percentage
  const getVarianceClass = (percentage: number) => {
    if (percentage < -20) return 'text-red-600';
    if (percentage < -5) return 'text-yellow-600';
    if (percentage < 5) return 'text-blue-600';
    if (percentage < 20) return 'text-green-600';
    return 'text-purple-600';
  };

  // Get variance badge based on category
  const getVarianceBadge = (category: string) => {
    switch (category) {
      case 'Significant Underspending':
        return <IOSBadge className="bg-purple-100 text-purple-700">Significant Underspending</IOSBadge>;
      case 'Underspending':
        return <IOSBadge className="bg-green-100 text-green-700">Underspending</IOSBadge>;
      case 'On Target':
        return <IOSBadge className="bg-blue-100 text-blue-700">On Target</IOSBadge>;
      case 'Overspending':
        return <IOSBadge className="bg-yellow-100 text-yellow-700">Overspending</IOSBadge>;
      case 'Significant Overspending':
        return <IOSBadge className="bg-red-100 text-red-700">Significant Overspending</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{category}</IOSBadge>;
    }
  };

  if (isLoading) {
    return (
      <IOSCard className="p-6 text-center">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400 mb-2" />
        <p className="text-gray-500">Loading variance report...</p>
      </IOSCard>
    );
  }

  if (!variance) {
    return (
      <IOSCard className="p-6 text-center">
        <AlertCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500">No budget variance data available</p>
        <IOSButton
          variant="outline"
          className="mt-4"
          onClick={fetchVarianceReport}
          leftIcon={<RefreshCw className="h-4 w-4" />}
        >
          Try Again
        </IOSButton>
      </IOSCard>
    );
  }

  return (
    <div className="space-y-4">
      <IOSCard className="p-4">
        <h3 className="font-medium mb-4">
          {budgetName ? `${budgetName} - Variance Analysis` : 'Budget Variance Report'}
          {category && <span className="ml-2 text-sm font-normal text-gray-500">(Filtered by {category})</span>}
        </h3>
        
        {variance.summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-500">Total Variance</p>
              <p className={`text-xl font-bold ${variance.summary.total_variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(variance.summary.total_variance)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {variance.summary.total_variance >= 0 ? 'Under budget' : 'Over budget'}
              </p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-500">Average Variance %</p>
              <p className={`text-xl font-bold ${
                variance.summary.average_variance_percentage >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {variance.summary.average_variance_percentage >= 0 ? '+' : ''}
                {variance.summary.average_variance_percentage.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">From allocated budget</p>
            </div>
            
            <div className="p-3 bg-gray-50 rounded-md">
              <p className="text-sm text-gray-500">Report Date</p>
              <p className="text-base font-medium">
                {new Date(variance.generated_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Fiscal Year: {variance.fiscal_year || fiscalYear || new Date().getFullYear()}
              </p>
            </div>
          </div>
        )}
        
        {variance.plot && (
          <div className="mb-6">
            <img 
              src={`data:image/png;base64,${variance.plot}`} 
              alt="Budget Variance Chart" 
              className="w-full rounded-md border border-gray-200"
            />
          </div>
        )}
        
        {variance.category_variance && variance.category_variance.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium mb-3">Variance by Category</h4>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="text-xs text-gray-500 border-b">
                  <tr>
                    <th className="text-left py-2">Category</th>
                    <th className="text-right py-2">Allocated</th>
                    <th className="text-right py-2">Spent</th>
                    <th className="text-right py-2">Variance</th>
                    <th className="text-right py-2">Variance %</th>
                    <th className="text-center py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {variance.category_variance.map((category: any) => (
                    <tr key={category.category}>
                      <td className="py-3 text-sm">
                        {category.category.charAt(0).toUpperCase() + category.category.slice(1).replace('_', ' ')}
                      </td>
                      <td className="py-3 text-sm text-right">{formatCurrency(category.allocated)}</td>
                      <td className="py-3 text-sm text-right">{formatCurrency(category.spent)}</td>
                      <td className={`py-3 text-sm text-right font-medium ${getVarianceClass(category.variance_percentage)}`}>
                        {formatCurrency(category.variance)}
                      </td>
                      <td className={`py-3 text-sm text-right font-medium ${getVarianceClass(category.variance_percentage)}`}>
                        {category.variance_percentage >= 0 ? '+' : ''}
                        {category.variance_percentage.toFixed(1)}%
                      </td>
                      <td className="py-3 text-center">
                        {getVarianceBadge(category.variance_category)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {variance.variance_items && variance.variance_items.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Detailed Variance Items</h4>
            <div className="space-y-2">
              {variance.variance_items.map((item: any) => (
                <div key={item.name} className="border rounded-md p-3 bg-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {item.category.charAt(0).toUpperCase() + item.category.slice(1).replace('_', ' ')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className={`font-medium ${getVarianceClass(item.variance_percentage)}`}>
                        {item.variance_percentage >= 0 ? '+' : ''}
                        {item.variance_percentage.toFixed(1)}%
                      </div>
                      <div className="mt-1">
                        {getVarianceBadge(item.variance_category)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span className="text-gray-500">
                      Allocated: {formatCurrency(item.allocated)}
                    </span>
                    <span className="text-gray-500">
                      Spent: {formatCurrency(item.spent)}
                    </span>
                    <span className={`font-medium ${getVarianceClass(item.variance_percentage)}`}>
                      Variance: {formatCurrency(item.variance)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </IOSCard>
    </div>
  );
}
