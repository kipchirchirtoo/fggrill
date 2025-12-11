'use client';

import { useState, useEffect } from 'react';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { budgetAPI, ApiResponse, Budget } from '@/lib/api/budget';
import { RefreshCw, TrendingUp, AlertCircle, Download } from 'lucide-react';

interface BudgetForecastTabProps {
  branchId?: number;
}

export function BudgetForecastTab({ branchId }: BudgetForecastTabProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [forecast, setForecast] = useState<any>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [periods, setPeriods] = useState<number>(3);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    if (branchId) {
      fetchBudgetCategories();
      fetchForecast();
    }
  }, [branchId]);

  const fetchBudgetCategories = async () => {
    try {
      // Fetch budgets to get available categories
      const response = await budgetAPI.getBudgets({}, branchId);
      
      if ('success' in response && response.success && Array.isArray(response.data)) {
        const uniqueCategories = Array.from(new Set(response.data.map((budget: Budget) => budget.category)));
        setCategories(uniqueCategories);
      }
    } catch (error) {
      console.error('Error fetching budget categories:', error);
    }
  };

  const fetchForecast = async () => {
    setIsLoading(true);
    try {
      const response = await budgetAPI.getBudgetForecast({
        category: categoryFilter || undefined,
        periods
      }, branchId);
      
      if (response.success && response.data) {
        setForecast(response.data);
      } else {
        toast.error('Failed to load budget forecast data');
      }
    } catch (error) {
      console.error('Error fetching budget forecast:', error);
      toast.error('An error occurred while loading budget forecast data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyFilters = () => {
    fetchForecast();
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
        <p className="text-gray-500">Loading budget forecast data...</p>
      </IOSCard>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <IOSCard className="p-4">
        <h3 className="font-medium mb-4">Forecast Options</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-500 mb-2">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm text-gray-500 mb-2">Forecast Periods</label>
            <select
              value={periods.toString()}
              onChange={(e) => setPeriods(parseInt(e.target.value))}
              className="w-full h-10 px-3 rounded-ios-lg border border-gray-200"
            >
              <option value="1">1 Period</option>
              <option value="3">3 Periods</option>
              <option value="6">6 Periods</option>
              <option value="12">12 Periods</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <IOSButton 
              onClick={handleApplyFilters}
              leftIcon={<RefreshCw className="h-4 w-4" />}
              className="w-full"
            >
              Generate Forecast
            </IOSButton>
          </div>
        </div>
      </IOSCard>
      
      {/* Forecast Data */}
      {forecast ? (
        <div className="space-y-6">
          {/* Summary Card */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
              <div>
                <h3 className="font-medium">Budget Forecast</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {forecast.category === 'all' ? 'All Categories' : `Category: ${forecast.category}`}
                </p>
              </div>
              
              <div className="mt-2 md:mt-0 flex items-center">
                <IOSBadge className="bg-blue-100 text-blue-700 mr-2">
                  Method: {forecast.forecasts?.method || 'Statistical Analysis'}
                </IOSBadge>
                <IOSBadge className="bg-purple-100 text-purple-700">
                  Generated: {new Date(forecast.forecast_generated_at).toLocaleDateString()}
                </IOSBadge>
              </div>
            </div>
            
            <div className="mt-6">
              {forecast.plots?.time_series && (
                <img 
                  src={`data:image/png;base64,${forecast.plots.time_series}`} 
                  alt="Forecast Time Series" 
                  className="w-full rounded-md border border-gray-200"
                />
              )}
            </div>
          </IOSCard>
          
          {/* Forecast Table */}
          {forecast.forecasts?.forecast && forecast.forecasts.forecast.length > 0 && (
            <IOSCard className="p-4">
              <h3 className="font-medium mb-4">Forecast Projections</h3>
              
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="text-xs text-gray-500 border-b">
                    <tr>
                      <th className="text-left py-2">Period</th>
                      <th className="text-right py-2">Forecasted Amount</th>
                      <th className="text-right py-2">Lower Bound</th>
                      <th className="text-right py-2">Upper Bound</th>
                      <th className="text-center py-2">Range</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {forecast.forecasts.forecast.map((period: any, index: number) => {
                      const range = period.upper_bound - period.lower_bound;
                      const rangePct = period.amount > 0 ? (range / period.amount) * 100 : 0;
                      
                      return (
                        <tr key={period.period || index}>
                          <td className="py-3 text-sm font-medium">
                            {period.period}
                          </td>
                          <td className="py-3 text-sm text-right font-medium">
                            {formatCurrency(period.amount)}
                          </td>
                          <td className="py-3 text-sm text-right text-gray-500">
                            {formatCurrency(period.lower_bound)}
                          </td>
                          <td className="py-3 text-sm text-right text-gray-500">
                            {formatCurrency(period.upper_bound)}
                          </td>
                          <td className="py-3 text-center">
                            <IOSBadge className={`
                              ${rangePct > 30 ? 'bg-yellow-100 text-yellow-700' : 
                                rangePct > 15 ? 'bg-blue-100 text-blue-700' : 
                                'bg-green-100 text-green-700'}
                            `}>
                              ±{Math.round(rangePct)}%
                            </IOSBadge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex justify-end">
                <IOSButton 
                  variant="outline" 
                  leftIcon={<Download className="h-4 w-4" />}
                >
                  Export Forecast
                </IOSButton>
              </div>
            </IOSCard>
          )}
          
          {/* Recommendations */}
          <IOSCard className="p-4">
            <h3 className="font-medium mb-4">Budget Recommendations</h3>
            
            <div className="space-y-4">
              <div className="p-4 border border-blue-100 bg-blue-50 rounded-md">
                <div className="flex items-start">
                  <TrendingUp className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">Forecast Insights</h4>
                    <p className="text-sm text-blue-800 mt-1">
                      Based on historical spending patterns, we project the following budget needs:
                    </p>
                    
                    <div className="mt-3">
                      {forecast.forecasts?.forecast && forecast.forecasts.forecast.length > 0 && (
                        <ul className="list-disc pl-5 space-y-1 text-sm text-blue-800">
                          <li>
                            Next period forecast: {formatCurrency(forecast.forecasts.forecast[0].amount)}
                            {' '}(±{Math.round((forecast.forecasts.forecast[0].upper_bound - forecast.forecasts.forecast[0].lower_bound) / forecast.forecasts.forecast[0].amount * 100)}% confidence interval)
                          </li>
                          
                          {forecast.forecasts.forecast.length > 1 && (
                            <li>
                              Average for next {forecast.forecasts.forecast.length} periods: {formatCurrency(
                                forecast.forecasts.forecast.reduce((sum: number, f: any) => sum + f.amount, 0) / 
                                forecast.forecasts.forecast.length
                              )}
                            </li>
                          )}
                          
                          {forecast.category !== 'all' && (
                            <li>
                              Recommended budget allocation for {forecast.category}: {formatCurrency(
                                forecast.forecasts.forecast[0].amount * 1.1
                              )} (10% buffer added)
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-green-100 bg-green-50 rounded-md">
                  <h4 className="font-medium text-green-800">Actions for Cost Optimization</h4>
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-green-800">
                    <li>Review spending patterns for opportunities to consolidate purchases</li>
                    <li>Identify categories with consistent underspending for potential reallocation</li>
                    <li>Consider implementing progressive budgeting for seasonal categories</li>
                  </ul>
                </div>
                
                <div className="p-4 border border-purple-100 bg-purple-50 rounded-md">
                  <h4 className="font-medium text-purple-800">Planning Ahead</h4>
                  <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-purple-800">
                    <li>Create budget allocations based on forecast data</li>
                    <li>Set up alerts for categories trending toward overspending</li>
                    <li>Review forecasts quarterly and adjust for seasonal variations</li>
                  </ul>
                </div>
              </div>
            </div>
          </IOSCard>
        </div>
      ) : (
        <IOSCard className="p-8 text-center">
          <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No forecast data available</p>
          <p className="text-sm text-gray-400 mt-2">
            Generate a forecast using the options above
          </p>
        </IOSCard>
      )}
    </div>
  );
}
