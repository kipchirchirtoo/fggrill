'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { toast } from 'sonner';
import {
  BarChart3, LineChart, Loader2, RefreshCw,
  DollarSign, Box, CalendarDays, Building2,
  Users, TrendingUp, TrendingDown, Percent
} from 'lucide-react';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBranch } from '@/lib/branch-context';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import mlForecastingAPI from '@/lib/ml-forecasting-api';

// Mock data for chart visualization
import {
  LineChart as Chart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area,
  BarChart, Bar, Cell
} from 'recharts';

// Types
interface ForecastPoint {
  date: string;
  value: number;
  lower_bound?: number;
  upper_bound?: number;
}

interface ForecastResponse {
  success: boolean;
  data: {
    forecast: ForecastPoint[];
    confidence_level: number;
    metrics: {
      mape?: number;
      accuracy?: number;
      expected_occupancy_rate?: number;
    };
    methodology: string;
  };
}

function MLForecastingContent() {
  const { user } = useAuth();
  const { activeBranch, branches } = useBranch();
  const [activeTab, setActiveTab] = useState('sales');
  const [forecastDays, setForecastDays] = useState(30);
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [methodology, setMethodology] = useState('');
  const [confidenceLevel, setConfidenceLevel] = useState(0);
  const [metrics, setMetrics] = useState<{
    mape?: number;
    accuracy?: number;
    expected_occupancy_rate?: number;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<number | undefined>(
    activeBranch?.id ? Number(activeBranch.id) : undefined
  );
  const [selectedCategory, setSelectedCategory] = useState<string | number | undefined>(undefined);

  // Category options for inventory forecast
  const categories = [
    { id: 'Food & Beverage', name: 'Food & Beverage' },
    { id: 'Housekeeping', name: 'Housekeeping' },
    { id: 'Kitchen Supplies', name: 'Kitchen Supplies' }
  ];

  // Department options for budget forecast
  const departments = [
    { id: 1, name: 'Kitchen' },
    { id: 2, name: 'Front Desk' },
    { id: 3, name: 'Housekeeping' },
    { id: 4, name: 'Maintenance' },
    { id: 5, name: 'Administration' }
  ];

  const fetchForecastData = useCallback(async () => {
    setIsLoading(true);
    setForecastData([]);

    try {
      let response;

      switch (activeTab) {
        case 'sales':
          response = await mlForecastingAPI.getSalesForecast(selectedBranchId, forecastDays);
          break;
        case 'inventory':
          response = await mlForecastingAPI.getInventoryForecast(selectedCategory as string, forecastDays);
          break;
        case 'occupancy':
          response = await mlForecastingAPI.getOccupancyForecast(selectedBranchId, forecastDays);
          break;
        case 'budget':
          // Convert days to months for budget forecast
          const forecastMonths = Math.max(1, Math.ceil(forecastDays / 30));
          response = await mlForecastingAPI.getBudgetForecast(
            selectedCategory as number, // Using category state for department selection
            forecastMonths
          );
          break;
        default:
          throw new Error('Invalid forecast type');
      }

      if (response.success && response.data) {
        setForecastData(response.data.forecast || []);
        setConfidenceLevel(response.data.confidence_level || 0);
        setMetrics(response.data.metrics || {});
        setMethodology(response.data.methodology || '');

        toast.success(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} forecast generated successfully`);
      } else {
        toast.error(response.message || 'Failed to generate forecast');
      }
    } catch (error) {
      console.error('Error fetching forecast:', error);
      toast.error('Failed to generate forecast');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, selectedBranchId, selectedCategory, forecastDays]);

  // When tab changes, reset form and data
  useEffect(() => {
    setForecastData([]);
    setMethodology('');
    setConfidenceLevel(0);
    setMetrics({});
  }, [activeTab]);

  // Get tab icon
  const getTabIcon = (tab: string) => {
    switch (tab) {
      case 'sales':
        return <DollarSign className="h-4 w-4" />;
      case 'inventory':
        return <Box className="h-4 w-4" />;
      case 'occupancy':
        return <Building2 className="h-4 w-4" />;
      case 'budget':
        return <CalendarDays className="h-4 w-4" />;
      default:
        return <BarChart3 className="h-4 w-4" />;
    }
  };

  // Format value based on tab
  const formatValue = (value: number) => {
    switch (activeTab) {
      case 'sales':
        return `KES ${value.toLocaleString()}`;
      case 'inventory':
        return value.toLocaleString();
      case 'occupancy':
        return `${value}%`;
      case 'budget':
        return `KES ${value.toLocaleString()}`;
      default:
        return value.toLocaleString();
    }
  };

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.CENTRAL_OPERATIONS_MANAGER,
      UserRole.ACCOUNTANT
    ]}>
      <BranchAwareDashboardLayout
        title="ML-Powered Forecasting"
        subtitle="Advanced forecasting using machine learning algorithms"
        requireBranchContext={false}
        actionButton={
          <div className="flex space-x-2">
            <IOSButton
              variant="secondary"
              onClick={fetchForecastData}
              disabled={isLoading}
              leftIcon={isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            >
              {isLoading ? 'Generating...' : 'Generate Forecast'}
            </IOSButton>
          </div>
        }
      >
        <div className="space-y-6">
          <IOSCard className="overflow-hidden">
            <Tabs defaultValue="sales" value={activeTab} onValueChange={setActiveTab}>
              <div className="border-b px-6 py-3">
                <TabsList className="grid grid-cols-4">
                  <TabsTrigger value="sales" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Sales
                  </TabsTrigger>
                  <TabsTrigger value="inventory" className="flex items-center gap-2">
                    <Box className="h-4 w-4" /> Inventory
                  </TabsTrigger>
                  <TabsTrigger value="occupancy" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" /> Occupancy
                  </TabsTrigger>
                  <TabsTrigger value="budget" className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" /> Budget
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column - Filters */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Forecast Settings</h3>

                    {/* Time Range */}
                    <div>
                      <Label>Time Range</Label>
                      <Select
                        value={forecastDays.toString()}
                        onValueChange={(value) => setForecastDays(Number(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select time range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                          <SelectItem value="30">30 days</SelectItem>
                          <SelectItem value="60">60 days</SelectItem>
                          <SelectItem value="90">90 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Branch Selection - Show only for branch-specific forecasts */}
                    {(activeTab === 'sales' || activeTab === 'occupancy') && (
                      <div>
                        <Label>Branch</Label>
                        <Select
                          value={selectedBranchId?.toString() || 'ALL'}
                          onValueChange={(value) => setSelectedBranchId(value === 'ALL' ? undefined : Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All Branches</SelectItem>
                            {Array.isArray(branches) && branches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id.toString()}>
                                {branch.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Category Selection - Show only for inventory forecast */}
                    {activeTab === 'inventory' && (
                      <div>
                        <Label>Category</Label>
                        <Select
                          value={selectedCategory?.toString() || 'ALL'}
                          onValueChange={(value) => setSelectedCategory(value === 'ALL' ? undefined : value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All Categories</SelectItem>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Department Selection - Show only for budget forecast */}
                    {activeTab === 'budget' && (
                      <div>
                        <Label>Department</Label>
                        <Select
                          value={selectedCategory?.toString() || 'ALL'}
                          onValueChange={(value) => setSelectedCategory(value === 'ALL' ? undefined : Number(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ALL">All Departments</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id.toString()}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="mt-8">
                      {forecastData.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-500">Confidence Level</span>
                            <span className="text-sm font-medium">{confidenceLevel}%</span>
                          </div>

                          <div className="h-2 bg-gray-100 rounded-full">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{ width: `${confidenceLevel}%` }}
                            ></div>
                          </div>

                          {metrics.mape !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">Error Rate (MAPE)</span>
                              <span className="text-sm font-medium">{metrics.mape * 100}%</span>
                            </div>
                          )}

                          {metrics.accuracy !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">Model Accuracy</span>
                              <span className="text-sm font-medium">{(metrics.accuracy * 100).toFixed(1)}%</span>
                            </div>
                          )}

                          {metrics.expected_occupancy_rate !== undefined && (
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-500">Expected Occupancy</span>
                              <span className="text-sm font-medium">{metrics.expected_occupancy_rate.toFixed(1)}%</span>
                            </div>
                          )}

                          <div className="pt-3 text-xs text-gray-500">
                            <p>Methodology: {methodology}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column - Chart and Data */}
                  <div className="md:col-span-2 space-y-4">
                    {forecastData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-80 border border-dashed border-gray-200 rounded-lg bg-gray-50">
                        <div className="text-center p-8">
                          <LineChart className="mx-auto h-12 w-12 text-gray-400" />
                          <h3 className="mt-4 text-lg font-medium text-gray-900">No forecast data</h3>
                          <p className="mt-2 text-sm text-gray-500 max-w-md">
                            Select your forecast parameters and click the "Generate Forecast" button to create a machine learning based forecast.
                          </p>
                          <IOSButton
                            className="mt-6"
                            onClick={fetchForecastData}
                            disabled={isLoading}
                            leftIcon={isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          >
                            {isLoading ? 'Generating...' : 'Generate Forecast'}
                          </IOSButton>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        <div className="border rounded-lg overflow-hidden">
                          <div className="p-4 bg-white">
                            <h3 className="font-medium">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Forecast</h3>
                            <p className="text-sm text-gray-500">
                              {forecastDays}-day forecast with {confidenceLevel}% confidence level
                            </p>
                          </div>

                          {/* Chart */}
                          <div className="p-4 h-80">
                            <ResponsiveContainer width="100%" height="100%">
                              {activeTab === 'budget' ? (
                                <BarChart data={forecastData}>
                                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                  <XAxis
                                    dataKey="month"
                                    tick={{ fontSize: 12 }}
                                  />
                                  <YAxis tick={{ fontSize: 12 }} />
                                  <Tooltip
                                    formatter={(value) => [`${formatValue(Number(value))}`, 'Forecast']}
                                  />
                                  <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                  <Bar dataKey="trend" fill="#d1d5db" radius={[4, 4, 0, 0]} />
                                </BarChart>
                              ) : (
                                <AreaChart data={forecastData}>
                                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                                  <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                  />
                                  <YAxis tick={{ fontSize: 12 }} />
                                  <Tooltip
                                    formatter={(value) => [`${formatValue(Number(value))}`, 'Forecast']}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                  />
                                  <Area type="monotone" dataKey="value" stroke="#3b82f6" fill="#dbeafe" />
                                  {forecastData[0]?.upper_bound && (
                                    <Area type="monotone" dataKey="upper_bound" stroke="#ddd" fill="#f3f4f6" fillOpacity={0.3} />
                                  )}
                                  {forecastData[0]?.lower_bound && (
                                    <Area type="monotone" dataKey="lower_bound" stroke="#ddd" fill="#f3f4f6" fillOpacity={0.1} />
                                  )}
                                </AreaChart>
                              )}
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Key Insights */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {activeTab === 'sales' && (
                            <>
                              <IOSCard className="p-4">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="text-sm text-gray-500">Projected Revenue</p>
                                    <p className="text-2xl font-bold">
                                      {formatValue(forecastData.reduce((sum, point) => sum + point.value, 0))}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-green-50 rounded-full h-fit">
                                    <TrendingUp className="h-5 w-5 text-green-500" />
                                  </div>
                                </div>
                              </IOSCard>

                              <IOSCard className="p-4">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="text-sm text-gray-500">Average Daily Revenue</p>
                                    <p className="text-2xl font-bold">
                                      {formatValue(forecastData.reduce((sum, point) => sum + point.value, 0) / forecastData.length)}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-blue-50 rounded-full h-fit">
                                    <DollarSign className="h-5 w-5 text-blue-500" />
                                  </div>
                                </div>
                              </IOSCard>

                              <IOSCard className="p-4">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="text-sm text-gray-500">Peak Day Revenue</p>
                                    <p className="text-2xl font-bold">
                                      {formatValue(Math.max(...forecastData.map(d => d.value)))}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-yellow-50 rounded-full h-fit">
                                    <TrendingUp className="h-5 w-5 text-yellow-500" />
                                  </div>
                                </div>
                              </IOSCard>
                            </>
                          )}

                          {activeTab === 'occupancy' && (
                            <>
                              <IOSCard className="p-4">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="text-sm text-gray-500">Average Occupancy</p>
                                    <p className="text-2xl font-bold">
                                      {formatValue(forecastData.reduce((sum, point) => sum + point.value, 0) / forecastData.length)}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-blue-50 rounded-full h-fit">
                                    <Percent className="h-5 w-5 text-blue-500" />
                                  </div>
                                </div>
                              </IOSCard>

                              <IOSCard className="p-4">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="text-sm text-gray-500">Peak Occupancy</p>
                                    <p className="text-2xl font-bold">
                                      {formatValue(Math.max(...forecastData.map(d => d.value)))}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-green-50 rounded-full h-fit">
                                    <TrendingUp className="h-5 w-5 text-green-500" />
                                  </div>
                                </div>
                              </IOSCard>

                              <IOSCard className="p-4">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="text-sm text-gray-500">Low Occupancy</p>
                                    <p className="text-2xl font-bold">
                                      {formatValue(Math.min(...forecastData.map(d => d.value)))}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-red-50 rounded-full h-fit">
                                    <TrendingDown className="h-5 w-5 text-red-500" />
                                  </div>
                                </div>
                              </IOSCard>
                            </>
                          )}

                          {activeTab === 'inventory' && (
                            <>
                              <IOSCard className="p-4">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="text-sm text-gray-500">Total Demand</p>
                                    <p className="text-2xl font-bold">
                                      {formatValue(forecastData.reduce((sum, point) => sum + point.value, 0))}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-blue-50 rounded-full h-fit">
                                    <Box className="h-5 w-5 text-blue-500" />
                                  </div>
                                </div>
                              </IOSCard>

                              <IOSCard className="p-4">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="text-sm text-gray-500">Peak Day Demand</p>
                                    <p className="text-2xl font-bold">
                                      {formatValue(Math.max(...forecastData.map(d => d.value)))}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-yellow-50 rounded-full h-fit">
                                    <TrendingUp className="h-5 w-5 text-yellow-500" />
                                  </div>
                                </div>
                              </IOSCard>

                              <IOSCard className="p-4">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="text-sm text-gray-500">Average Daily Demand</p>
                                    <p className="text-2xl font-bold">
                                      {formatValue(forecastData.reduce((sum, point) => sum + point.value, 0) / forecastData.length)}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-green-50 rounded-full h-fit">
                                    <Box className="h-5 w-5 text-green-500" />
                                  </div>
                                </div>
                              </IOSCard>
                            </>
                          )}

                          {activeTab === 'budget' && (
                            <>
                              <IOSCard className="p-4">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="text-sm text-gray-500">Total Budget</p>
                                    <p className="text-2xl font-bold">
                                      {formatValue(forecastData.reduce((sum, point) => sum + point.value, 0))}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-blue-50 rounded-full h-fit">
                                    <DollarSign className="h-5 w-5 text-blue-500" />
                                  </div>
                                </div>
                              </IOSCard>

                              <IOSCard className="p-4">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="text-sm text-gray-500">Monthly Average</p>
                                    <p className="text-2xl font-bold">
                                      {formatValue(forecastData.reduce((sum, point) => sum + point.value, 0) / forecastData.length)}
                                    </p>
                                  </div>
                                  <div className="p-2 bg-green-50 rounded-full h-fit">
                                    <CalendarDays className="h-5 w-5 text-green-500" />
                                  </div>
                                </div>
                              </IOSCard>

                              <IOSCard className="p-4">
                                <div className="flex justify-between">
                                  <div>
                                    <p className="text-sm text-gray-500">Projected Growth</p>
                                    <p className="text-2xl font-bold">
                                      {forecastData.length > 1
                                        ? `${((forecastData[forecastData.length - 1].value / forecastData[0].value - 1) * 100).toFixed(1)}%`
                                        : 'N/A'
                                      }
                                    </p>
                                  </div>
                                  <div className="p-2 bg-yellow-50 rounded-full h-fit">
                                    <TrendingUp className="h-5 w-5 text-yellow-500" />
                                  </div>
                                </div>
                              </IOSCard>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Tabs>
          </IOSCard>

          {/* Help Card */}
          <Alert>
            <AlertTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              About ML-Powered Forecasting
            </AlertTitle>
            <AlertDescription>
              <p className="mt-2 text-sm">
                This forecasting tool uses machine learning algorithms to analyze historical data and generate predictions.
                The system uses time series analysis with seasonal adjustments to provide accurate forecasts for sales,
                inventory demand, occupancy rates, and budget planning.
              </p>
              <p className="mt-2 text-sm">
                Confidence levels indicate the statistical reliability of the forecast, while error rates (MAPE)
                show the average percentage difference between predictions and actual values from historical data.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

export default function MLForecastingPage() {
  return (
    <BranchPageWrapper>
      <MLForecastingContent />
    </BranchPageWrapper>
  );
}
