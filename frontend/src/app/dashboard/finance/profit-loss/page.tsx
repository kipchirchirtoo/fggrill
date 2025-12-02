'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { financeAPI } from '@/lib/api';
import { BarChart3, RefreshCw, TrendingUp, TrendingDown, DollarSign, Download } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface PLData { revenue: number; costOfGoods: number; grossProfit: number; operatingExpenses: number; operatingIncome: number; otherIncome: number; otherExpenses: number; netProfit: number; margin: number; }

export default function ProfitLossPage() {
  const { user } = useAuth();
  const [data, setData] = useState<PLData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getProfitLoss();
      if (response.success && response.data) {
        setData({
          revenue: response.data.revenue || 0,
          costOfGoods: response.data.costOfGoods || 0,
          grossProfit: response.data.grossProfit || 0,
          operatingExpenses: response.data.operatingExpenses || 0,
          operatingIncome: response.data.operatingIncome || 0,
          otherIncome: response.data.otherIncome || 0,
          otherExpenses: response.data.otherExpenses || 0,
          netProfit: response.data.netProfit || 0,
          margin: response.data.margin || 0,
        });
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const LineItem = ({ label, amount, indent = false, bold = false, highlight = false }: { label: string; amount: number; indent?: boolean; bold?: boolean; highlight?: boolean }) => (
    <div className={`flex justify-between py-2 ${indent ? 'pl-4' : ''} ${bold ? 'font-bold' : ''} ${highlight ? 'bg-gray-50 -mx-4 px-4' : ''}`}>
      <span>{label}</span>
      <span className={amount < 0 ? 'text-[#FF3B30]' : ''}>{amount < 0 ? '(' : ''}KES {Math.abs(amount).toLocaleString()}{amount < 0 ? ')' : ''}</span>
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Profit & Loss Statement</h1><p className="text-gray-500">Income statement overview</p></div>
            <div className="flex gap-2">
              {(['month', 'quarter', 'year'] as const).map((p) => (
                <IOSButton key={p} variant={period === p ? 'primary' : 'secondary'} size="sm" onClick={() => setPeriod(p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </IOSButton>
              ))}
              <IOSButton variant="secondary"><Download className="h-4 w-4 mr-2" /> Export</IOSButton>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : !data ? (
            <IOSCard className="p-12 text-center"><BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No data available</p></IOSCard>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-4">
                <IOSCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-ios-lg"><DollarSign className="h-5 w-5 text-[#34C759]" /></div>
                    <div><p className="text-sm text-gray-500">Revenue</p><p className="text-xl font-bold">KES {data.revenue.toLocaleString()}</p></div>
                  </div>
                </IOSCard>
                <IOSCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-ios-lg ${data.netProfit >= 0 ? 'bg-blue-100' : 'bg-red-100'}`}>
                      {data.netProfit >= 0 ? <TrendingUp className="h-5 w-5 text-[#007AFF]" /> : <TrendingDown className="h-5 w-5 text-[#FF3B30]" />}
                    </div>
                    <div><p className="text-sm text-gray-500">Net Profit</p><p className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'}`}>KES {data.netProfit.toLocaleString()}</p></div>
                  </div>
                </IOSCard>
                <IOSCard className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-ios-lg"><BarChart3 className="h-5 w-5 text-purple-600" /></div>
                    <div><p className="text-sm text-gray-500">Profit Margin</p><p className="text-xl font-bold">{data.margin.toFixed(1)}%</p></div>
                  </div>
                </IOSCard>
              </div>

              <IOSCard className="p-6">
                <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Statement Details</h2>
                <div className="divide-y">
                  <LineItem label="Revenue" amount={data.revenue} bold />
                  <LineItem label="Cost of Goods Sold" amount={-data.costOfGoods} indent />
                  <LineItem label="Gross Profit" amount={data.grossProfit} bold highlight />
                  <LineItem label="Operating Expenses" amount={-data.operatingExpenses} indent />
                  <LineItem label="Operating Income" amount={data.operatingIncome} bold highlight />
                  <LineItem label="Other Income" amount={data.otherIncome} indent />
                  <LineItem label="Other Expenses" amount={-data.otherExpenses} indent />
                  <div className={`flex justify-between py-3 font-bold text-lg ${data.netProfit >= 0 ? 'text-[#34C759]' : 'text-[#FF3B30]'} bg-gray-100 -mx-6 px-6 mt-2`}>
                    <span>Net Profit</span>
                    <span>KES {data.netProfit.toLocaleString()}</span>
                  </div>
                </div>
              </IOSCard>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
