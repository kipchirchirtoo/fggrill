'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  BarChart3, TrendingUp, TrendingDown, ArrowLeft, RefreshCw, 
  DollarSign, Percent, Target, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { financeAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

export default function FinancialKPIsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [kpiData, setKpiData] = useState<any>(null);
  const [period, setPeriod] = useState('month');

  useEffect(() => { fetchKPIs(); }, [period]);

  const fetchKPIs = async () => {
    setIsLoading(true);
    try {
      const res = await financeAPI.getKPIs(period);
      setKpiData(res.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load KPIs');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `KES ${(amount || 0).toLocaleString()}`;
  const formatPercent = (value: number) => `${value || 0}%`;

  const KPICard = ({ title, value, icon: Icon, color, trend, trendLabel }: any) => (
    <Card className={`p-6 border-l-4 ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {trend !== undefined && (
            <div className={`flex items-center mt-2 text-sm ${Number(trend) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Number(trend) >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              <span>{Math.abs(Number(trend))}% {trendLabel}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${color.replace('border-', 'bg-').replace('-500', '-100')}`}>
          <Icon className={`h-6 w-6 ${color.replace('border-', 'text-')}`} />
        </div>
      </div>
    </Card>
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/finance">
                <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <BarChart3 className="h-6 w-6 text-cyan-600" />
                  Financial KPIs
                </h1>
                <p className="text-gray-600">Key performance indicators and metrics</p>
              </div>
            </div>
            <Button onClick={fetchKPIs} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <Card className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Period:</span>
              <select value={period} onChange={(e) => setPeriod(e.target.value)} className="border rounded-lg px-3 py-2">
                <option value="week">Last Week</option>
                <option value="month">Last Month</option>
                <option value="quarter">Last Quarter</option>
                <option value="year">Last Year</option>
              </select>
            </div>
          </Card>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading KPIs...</div>
          ) : kpiData?.kpis ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="Total Revenue"
                  value={formatCurrency(kpiData.kpis.totalRevenue)}
                  icon={DollarSign}
                  color="border-green-500"
                  trend={kpiData.kpis.revenueGrowth}
                  trendLabel="vs previous"
                />
                <KPICard
                  title="Total Expenses"
                  value={formatCurrency(kpiData.kpis.totalExpenses)}
                  icon={TrendingDown}
                  color="border-red-500"
                  trend={kpiData.kpis.expenseGrowth}
                  trendLabel="vs previous"
                />
                <KPICard
                  title="Net Income"
                  value={formatCurrency(kpiData.kpis.netIncome)}
                  icon={TrendingUp}
                  color={kpiData.kpis.netIncome >= 0 ? "border-blue-500" : "border-red-500"}
                />
                <KPICard
                  title="Profit Margin"
                  value={formatPercent(kpiData.kpis.profitMargin)}
                  icon={Percent}
                  color="border-purple-500"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Current Period Performance</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>Revenue</span>
                      <span className="font-bold text-green-600">{formatCurrency(kpiData.kpis.totalRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>Expenses</span>
                      <span className="font-bold text-red-600">{formatCurrency(kpiData.kpis.totalExpenses)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                      <span>Net Income</span>
                      <span className={`font-bold ${kpiData.kpis.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(kpiData.kpis.netIncome)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                      <span>Expense Ratio</span>
                      <span className="font-bold">{formatPercent(kpiData.kpis.expenseRatio)}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold mb-4">Previous Period Comparison</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>Previous Revenue</span>
                      <span className="font-medium">{formatCurrency(kpiData.comparison?.prevRevenue)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>Previous Expenses</span>
                      <span className="font-medium">{formatCurrency(kpiData.comparison?.prevExpenses)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <span>Previous Net Income</span>
                      <span className="font-medium">{formatCurrency(kpiData.comparison?.prevNetIncome)}</span>
                    </div>
                    <div className="p-3 bg-blue-50 rounded">
                      <div className="flex justify-between mb-2">
                        <span>Revenue Growth</span>
                        <span className={`font-bold ${Number(kpiData.kpis.revenueGrowth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {kpiData.kpis.revenueGrowth}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Expense Growth</span>
                        <span className={`font-bold ${Number(kpiData.kpis.expenseGrowth) <= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {kpiData.kpis.expenseGrowth}%
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">No KPI data available</div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
