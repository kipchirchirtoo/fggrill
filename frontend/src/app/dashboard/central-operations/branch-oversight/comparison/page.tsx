'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { centralOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { 
  BarChart3, RefreshCw, TrendingUp, TrendingDown, 
  Building2, DollarSign, Users, Percent,
  FileText, ChevronDown, X, FileSpreadsheet
} from 'lucide-react';
import { ExportDropdown } from '@/components/export-dropdown';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';

// Branch comparison type
interface BranchComparison {
  id: number;
  name: string;
  revenue: number;
  occupancy: number;
  staff_count: number;
}

function BranchComparisonContent() {
  const { user } = useAuth();
  const [branches, setBranches] = useState<BranchComparison[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metric, setMetric] = useState<'revenue' | 'occupancy' | 'staff_count'>('revenue');
  const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [isExporting, setIsExporting] = useState(false);
  
  const PYTHON_SERVICE = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:5001';

  // Fetch comparison data on mount and when filters change
  useEffect(() => {
    fetchComparisonData();
  }, [metric, period]);

  const fetchComparisonData = async () => {
    setIsLoading(true);
    try {
      const response = await centralOperationsAPI.getBranchComparison(metric, period);
      
      if (response.success) {
        setBranches(response.data || []);
      } else {
        setBranches([]);
        toast.error(response.message || 'Failed to fetch comparison data');
      }
    } catch (error) {
      console.error('Error fetching branch comparison:', error);
      toast.error('Failed to load comparison data');
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Get max value for scaling
  const maxValue = branches.length > 0 
    ? Math.max(...branches.map(branch => branch[metric as keyof BranchComparison] as number)) 
    : 0;

  // Format value based on metric
  const formatValue = (value: number) => {
    switch (metric) {
      case 'revenue':
        return `KES ${(value / 1000).toFixed(0)}K`;
      case 'occupancy':
        return `${value}%`;
      case 'staff_count':
        return value;
      default:
        return value;
    }
  };

  // Get title based on metric and period
  const getTitle = () => {
    const metricLabel = {
      'revenue': 'Revenue',
      'occupancy': 'Occupancy Rate',
      'staff_count': 'Staff Count'
    }[metric];
    
    const periodLabel = {
      'week': 'Weekly',
      'month': 'Monthly',
      'quarter': 'Quarterly',
      'year': 'Yearly'
    }[period];
    
    return `${periodLabel} ${metricLabel} Comparison`;
  };

  // Icon based on metric
  const getMetricIcon = () => {
    switch (metric) {
      case 'revenue':
        return <DollarSign className="h-5 w-5" />;
      case 'occupancy':
        return <Percent className="h-5 w-5" />;
      case 'staff_count':
        return <Users className="h-5 w-5" />;
      default:
        return <BarChart3 className="h-5 w-5" />;
    }
  };

  // Export report
  const exportReport = async (format: 'pdf' | 'excel') => {
    setIsExporting(true);
    try {
      const exportEndpoint = format === 'pdf' 
        ? `${PYTHON_SERVICE}/api/reports/generate/branded-pdf` 
        : `${PYTHON_SERVICE}/api/reports/generate/excel`;
      
      // Prepare data for export
      const exportData = {
        reportType: 'branch_comparison',
        useRealData: false,
        data: {
          title: getTitle(),
          period,
          metric,
          branches
        },
        filters: {
          period,
          metric
        }
      };
      
      // Use the browser to trigger file download
      const response = await fetch(exportEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(exportData)
      });
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `Branch_Comparison_${metric}_${period}_${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} report generated successfully`);
    } catch (error) {
      console.error(`Error exporting ${format}:`, error);
      toast.error(`Failed to generate ${format.toUpperCase()} report`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.CENTRAL_OPERATIONS_MANAGER
    ]}>
      <BranchAwareDashboardLayout
        title="Branch Comparison"
        subtitle="Compare performance metrics across branches"
        requireBranchContext={false}
        actionButton={
          <div className="flex space-x-2">
            <IOSButton 
              variant="secondary" 
              onClick={fetchComparisonData} 
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </IOSButton>
            <ExportDropdown
              reportType="branch_comparison"
              onExport={exportReport}
              isExporting={isExporting}
              buttonVariant="primary"
              buttonSize="sm"
            />
          </div>
        }
      >
        <div className="space-y-6">
          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <div className="flex-1">
                <label className="block text-sm text-gray-500 mb-1">Metric</label>
                <div className="relative">
                  <select
                    value={metric}
                    onChange={(e) => setMetric(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-ios-lg text-sm appearance-none bg-white"
                  >
                    <option value="revenue">Revenue</option>
                    <option value="occupancy">Occupancy Rate</option>
                    <option value="staff_count">Staff Count</option>
                  </select>
                </div>
              </div>
              
              <div className="flex-1">
                <label className="block text-sm text-gray-500 mb-1">Period</label>
                <div className="relative">
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value as any)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-ios-lg text-sm appearance-none bg-white"
                  >
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                    <option value="quarter">Quarterly</option>
                    <option value="year">Yearly</option>
                  </select>
                </div>
              </div>
            </div>
          </IOSCard>

          {/* Comparison Chart */}
          <IOSCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center">
                {getMetricIcon()}
                <span className="ml-2">{getTitle()}</span>
              </h2>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center items-center py-16">
                <RefreshCw className="h-6 w-6 text-gray-400 animate-spin" />
                <span className="ml-2 text-gray-500">Loading comparison data...</span>
              </div>
            ) : branches.length === 0 ? (
              <div className="text-center py-16">
                <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No comparison data available</p>
              </div>
            ) : (
              <div className="space-y-6">
                {branches.map((branch, index) => (
                  <div key={branch.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center mr-3">
                          <Building2 className="h-5 w-5 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium">{branch.name}</p>
                          <div className="flex items-center space-x-2">
                            <IOSBadge color={index === 0 ? 'success' : index === branches.length - 1 ? 'danger' : 'primary'}>
                              {index === 0 ? '#1' : `#${index + 1}`}
                            </IOSBadge>
                            {index === 0 && (
                              <span className="flex items-center text-xs text-gray-600">
                                <TrendingUp className="h-3 w-3 mr-1" /> Top performer
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="font-bold">{formatValue(branch[metric as keyof BranchComparison] as number)}</p>
                    </div>
                    
                    <div className="relative h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`absolute top-0 left-0 h-full ${
                          index === 0 ? 'bg-gray-600' : index === branches.length - 1 ? 'bg-gray-400' : 'bg-gray-500'
                        }`}
                        style={{ 
                          width: `${Math.max((branch[metric as keyof BranchComparison] as number) / maxValue * 100, 5)}%` 
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </IOSCard>

          {/* Branch Details Table */}
          <IOSCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Rank</th>
                    <th className="text-left p-4 text-sm font-medium text-gray-600">Branch</th>
                    <th className="text-right p-4 text-sm font-medium text-gray-600">Revenue</th>
                    <th className="text-right p-4 text-sm font-medium text-gray-600">Occupancy</th>
                    <th className="text-right p-4 text-sm font-medium text-gray-600">Staff Count</th>
                    <th className="text-center p-4 text-sm font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center">
                        <div className="flex justify-center items-center py-8">
                          <RefreshCw className="h-5 w-5 text-gray-400 animate-spin" />
                          <span className="ml-2 text-gray-500">Loading data...</span>
                        </div>
                      </td>
                    </tr>
                  ) : branches.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-4 text-center">
                        <div className="py-8">
                          <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500">No branch data available</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    branches.map((branch, index) => (
                      <tr key={branch.id} className="border-b hover:bg-gray-50">
                        <td className="p-4 text-sm font-medium">
                          <IOSBadge color={index === 0 ? 'success' : index === branches.length - 1 ? 'danger' : 'primary'}>
                            {index === 0 ? '#1' : `#${index + 1}`}
                          </IOSBadge>
                        </td>
                        <td className="p-4 text-sm font-medium">{branch.name}</td>
                        <td className="p-4 text-sm text-right">KES {(branch.revenue / 1000).toFixed(0)}K</td>
                        <td className="p-4 text-sm text-right">{branch.occupancy}%</td>
                        <td className="p-4 text-sm text-right">{branch.staff_count}</td>
                        <td className="p-4 text-center">
                          {index === 0 ? (
                            <div className="flex items-center justify-center space-x-1">
                              <TrendingUp className="h-3.5 w-3.5 text-gray-600" />
                              <span className="text-xs text-gray-600">Top</span>
                            </div>
                          ) : index === branches.length - 1 ? (
                            <div className="flex items-center justify-center space-x-1">
                              <TrendingDown className="h-3.5 w-3.5 text-gray-600" />
                              <span className="text-xs text-gray-600">Lowest</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">Average</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </IOSCard>
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

// Wrap with BranchPageWrapper to prevent hydration errors
export default function BranchComparisonPage() {
  return (
    <BranchPageWrapper>
      <BranchComparisonContent />
    </BranchPageWrapper>
  );
}
