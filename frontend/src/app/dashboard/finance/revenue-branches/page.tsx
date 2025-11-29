'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, ArrowLeft, RefreshCw, Calendar, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { financeAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

export default function RevenueBranchesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [branchData, setBranchData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => { fetchBranchRevenue(); }, [dateRange]);

  const fetchBranchRevenue = async () => {
    setIsLoading(true);
    try {
      const res = await financeAPI.getRevenueByBranch({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      setBranchData(res.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load branch revenue');
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
                  <Building2 className="h-6 w-6 text-purple-600" />
                  Revenue by Branch
                </h1>
                <p className="text-gray-600">Financial performance across all branches</p>
              </div>
            </div>
            <Button onClick={fetchBranchRevenue} variant="outline" disabled={isLoading}>
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
            <div className="text-center py-12 text-gray-500">Loading branch data...</div>
          ) : branchData ? (
            <>
              {/* Totals */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 bg-green-50 border-green-200">
                  <p className="text-sm text-green-700">Total Income (All Branches)</p>
                  <p className="text-2xl font-bold text-green-800">{formatCurrency(branchData.totals?.income)}</p>
                </Card>
                <Card className="p-4 bg-red-50 border-red-200">
                  <p className="text-sm text-red-700">Total Expenses (All Branches)</p>
                  <p className="text-2xl font-bold text-red-800">{formatCurrency(branchData.totals?.expenses)}</p>
                </Card>
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <p className="text-sm text-blue-700">Net Profit (All Branches)</p>
                  <p className={`text-2xl font-bold ${branchData.totals?.net >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                    {formatCurrency(branchData.totals?.net)}
                  </p>
                </Card>
              </div>

              {/* Branch Table */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4">Branch Performance</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Branch</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Code</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Income</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Expenses</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Net</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">% of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(branchData.branches || []).map((branch: any, idx: number) => {
                        const pctOfTotal = branchData.totals?.income > 0 
                          ? ((branch.income / branchData.totals.income) * 100).toFixed(1) 
                          : '0';
                        return (
                          <tr key={branch.branch_id || idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{branch.name || 'Unknown'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{branch.code || '-'}</td>
                            <td className="px-4 py-3 text-right text-green-600 font-medium">{formatCurrency(branch.income)}</td>
                            <td className="px-4 py-3 text-right text-red-600 font-medium">{formatCurrency(branch.expenses)}</td>
                            <td className={`px-4 py-3 text-right font-bold ${branch.net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                              {formatCurrency(branch.net)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-gray-200 rounded-full h-2">
                                  <div 
                                    className="bg-purple-600 h-2 rounded-full" 
                                    style={{ width: `${Math.min(Number(pctOfTotal), 100)}%` }}
                                  />
                                </div>
                                <span className="text-sm">{pctOfTotal}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100 font-bold">
                      <tr>
                        <td className="px-4 py-3" colSpan={2}>TOTAL</td>
                        <td className="px-4 py-3 text-right text-green-700">{formatCurrency(branchData.totals?.income)}</td>
                        <td className="px-4 py-3 text-right text-red-700">{formatCurrency(branchData.totals?.expenses)}</td>
                        <td className={`px-4 py-3 text-right ${branchData.totals?.net >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                          {formatCurrency(branchData.totals?.net)}
                        </td>
                        <td className="px-4 py-3 text-right">100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>

              {/* Top Performing Branch */}
              {branchData.branches?.length > 0 && (
                <Card className="p-6 bg-purple-50 border-purple-200">
                  <h3 className="font-semibold mb-2 text-purple-800">Top Performing Branch</h3>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-full">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-purple-900">{branchData.branches[0]?.name}</p>
                      <p className="text-sm text-purple-700">
                        Income: {formatCurrency(branchData.branches[0]?.income)} | Net: {formatCurrency(branchData.branches[0]?.net)}
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">No branch revenue data available</div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
