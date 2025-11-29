'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Receipt, ArrowLeft, RefreshCw, ArrowUpRight, ArrowDownRight, Clock, AlertTriangle } from 'lucide-react';
import { financeAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ARAPPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [arapData, setArapData] = useState<any>(null);

  useEffect(() => { fetchARAP(); }, []);

  const fetchARAP = async () => {
    setIsLoading(true);
    try {
      const res = await financeAPI.getArAp();
      setArapData(res.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load AR/AP data');
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
                  <Receipt className="h-6 w-6 text-teal-600" />
                  Accounts Receivable / Payable
                </h1>
                <p className="text-gray-600">Outstanding invoices and pending payments</p>
              </div>
            </div>
            <Button onClick={fetchARAP} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading AR/AP data...</div>
          ) : arapData ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6 bg-green-50 border-green-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-green-700">Accounts Receivable</p>
                      <p className="text-2xl font-bold text-green-800">{formatCurrency(arapData.accountsReceivable?.total)}</p>
                      <p className="text-xs text-green-600 mt-1">{arapData.accountsReceivable?.count} unpaid invoices</p>
                    </div>
                    <ArrowUpRight className="h-8 w-8 text-green-600" />
                  </div>
                </Card>

                <Card className="p-6 bg-red-50 border-red-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-700">Accounts Payable</p>
                      <p className="text-2xl font-bold text-red-800">{formatCurrency(arapData.accountsPayable?.total)}</p>
                      <p className="text-xs text-red-600 mt-1">{arapData.accountsPayable?.count} pending payments</p>
                    </div>
                    <ArrowDownRight className="h-8 w-8 text-red-600" />
                  </div>
                </Card>

                <Card className={`p-6 ${arapData.netPosition >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700">Net Position</p>
                      <p className={`text-2xl font-bold ${arapData.netPosition >= 0 ? 'text-blue-800' : 'text-amber-800'}`}>
                        {formatCurrency(arapData.netPosition)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">AR - AP</p>
                    </div>
                    <Receipt className={`h-8 w-8 ${arapData.netPosition >= 0 ? 'text-blue-600' : 'text-amber-600'}`} />
                  </div>
                </Card>
              </div>

              {/* Aging Analysis */}
              <Card className="p-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-gray-600" />
                  Accounts Receivable Aging
                </h3>
                <div className="grid grid-cols-5 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">Current</p>
                    <p className="text-lg font-bold text-green-700">{formatCurrency(arapData.accountsReceivable?.aging?.current)}</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">1-30 Days</p>
                    <p className="text-lg font-bold text-yellow-700">{formatCurrency(arapData.accountsReceivable?.aging?.days30)}</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">31-60 Days</p>
                    <p className="text-lg font-bold text-orange-700">{formatCurrency(arapData.accountsReceivable?.aging?.days60)}</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <p className="text-xs text-gray-600 mb-1">61-90 Days</p>
                    <p className="text-lg font-bold text-red-700">{formatCurrency(arapData.accountsReceivable?.aging?.days90)}</p>
                  </div>
                  <div className="text-center p-4 bg-red-100 rounded-lg border-2 border-red-300">
                    <p className="text-xs text-gray-600 mb-1">Over 90 Days</p>
                    <p className="text-lg font-bold text-red-800">{formatCurrency(arapData.accountsReceivable?.aging?.over90)}</p>
                    {arapData.accountsReceivable?.aging?.over90 > 0 && (
                      <AlertTriangle className="h-4 w-4 text-red-600 mx-auto mt-1" />
                    )}
                  </div>
                </div>
              </Card>

              {/* Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6 bg-green-50">
                  <h3 className="font-semibold mb-4 text-green-800">Money Coming In</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Receivables</span>
                      <span className="font-bold">{formatCurrency(arapData.accountsReceivable?.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Number of Invoices</span>
                      <span>{arapData.accountsReceivable?.count}</span>
                    </div>
                    <div className="pt-2 border-t mt-2">
                      <p className="text-sm text-green-700">Follow up on overdue invoices to improve cash flow.</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 bg-red-50">
                  <h3 className="font-semibold mb-4 text-red-800">Money Going Out</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Total Payables</span>
                      <span className="font-bold">{formatCurrency(arapData.accountsPayable?.total)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Pending Payments</span>
                      <span>{arapData.accountsPayable?.count}</span>
                    </div>
                    <div className="pt-2 border-t mt-2">
                      <p className="text-sm text-red-700">Manage payables to maintain good supplier relationships.</p>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">No AR/AP data available</div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
