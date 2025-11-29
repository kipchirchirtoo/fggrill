'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, TrendingDown, ArrowLeft, RefreshCw, Calendar, DollarSign, Percent
} from 'lucide-react';
import { financeAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ProfitLossPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [plData, setPlData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => { fetchProfitLoss(); }, [dateRange]);

  const fetchProfitLoss = async () => {
    setIsLoading(true);
    try {
      const res = await financeAPI.getProfitLoss({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      setPlData(res.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load P&L data');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `KES ${(amount || 0).toLocaleString()}`;

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
                  <TrendingUp className="h-6 w-6 text-green-600" />
                  Profit & Loss Statement
                </h1>
                <p className="text-gray-600">Income statement for the selected period</p>
              </div>
            </div>
            <Button onClick={fetchProfitLoss} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <Card className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium">Period:</span>
              <input type="date" value={dateRange.startDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm" />
              <span>to</span>
              <input type="date" value={dateRange.endDate}
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm" />
            </div>
          </Card>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading P&L data...</div>
          ) : plData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-green-50 border-green-200">
                  <p className="text-sm text-green-700">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-800">{formatCurrency(plData.revenue?.total)}</p>
                </Card>
                <Card className="p-4 bg-red-50 border-red-200">
                  <p className="text-sm text-red-700">Operating Expenses</p>
                  <p className="text-2xl font-bold text-red-800">{formatCurrency(plData.operatingExpenses)}</p>
                </Card>
                <Card className={`p-4 ${plData.netProfit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                  <p className="text-sm text-gray-700">Net Profit</p>
                  <p className={`text-2xl font-bold ${plData.netProfit >= 0 ? 'text-blue-800' : 'text-red-800'}`}>
                    {formatCurrency(plData.netProfit)}
                  </p>
                  <p className="text-sm mt-1">Margin: {plData.profitMargin}%</p>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-semibold mb-4 text-green-700 border-b pb-2">REVENUE</h3>
                  <div className="space-y-2">
                    {Object.entries(plData.revenue?.breakdown || {}).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between py-2 border-b border-dashed">
                        <span className="text-sm">{cat.replace(/_/g, ' ')}</span>
                        <span className="font-medium">{formatCurrency(amt as number)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold text-green-700">
                      <span>Total Revenue</span>
                      <span>{formatCurrency(plData.revenue?.total)}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold mb-4 text-red-700 border-b pb-2">EXPENSES</h3>
                  <div className="space-y-2">
                    {Object.entries(plData.expenses?.breakdown || {}).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between py-2 border-b border-dashed">
                        <span className="text-sm">{cat.replace(/_/g, ' ')}</span>
                        <span className="font-medium">{formatCurrency(amt as number)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between py-2 font-bold text-red-700">
                      <span>Total Expenses</span>
                      <span>{formatCurrency(plData.expenses?.total)}</span>
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="p-6 bg-gray-50">
                <div className="flex justify-between items-center text-xl">
                  <span className="font-bold">NET PROFIT / (LOSS)</span>
                  <span className={`font-bold ${plData.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(plData.netProfit)}
                  </span>
                </div>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">No P&L data available</div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
