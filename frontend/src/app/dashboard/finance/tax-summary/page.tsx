'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calculator, ArrowLeft, RefreshCw, Calendar, DollarSign, Percent, AlertCircle } from 'lucide-react';
import { financeAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';

export default function TaxSummaryPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [taxData, setTaxData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => { fetchTaxSummary(); }, [dateRange]);

  const fetchTaxSummary = async () => {
    setIsLoading(true);
    try {
      const res = await financeAPI.getTaxSummary({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate
      });
      setTaxData(res.data);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load tax summary');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number | string) => `KES ${Number(amount || 0).toLocaleString()}`;

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
                  <Calculator className="h-6 w-6 text-red-600" />
                  Tax Summary
                </h1>
                <p className="text-gray-600">VAT and corporate tax estimates (Kenya)</p>
              </div>
            </div>
            <Button onClick={fetchTaxSummary} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Disclaimer</p>
                <p className="text-sm text-amber-700">These are estimated tax calculations based on recorded transactions. Consult a qualified accountant for official tax filings.</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium">Tax Period:</span>
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
            <div className="text-center py-12 text-gray-500">Calculating taxes...</div>
          ) : taxData ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <p className="text-sm text-gray-600">Gross Income</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(taxData.grossIncome)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-gray-600">Deductible Expenses</p>
                  <p className="text-2xl font-bold text-red-600">{formatCurrency(taxData.deductibleExpenses)}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-gray-600">Taxable Income</p>
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(taxData.taxableIncome)}</p>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-blue-600" />
                    Value Added Tax (VAT)
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between p-3 bg-gray-50 rounded">
                      <span>VAT Rate</span>
                      <span className="font-bold">{taxData.taxes?.vat?.rate}%</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded">
                      <span>Taxable Sales</span>
                      <span className="font-medium">{formatCurrency(taxData.grossIncome)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-blue-50 rounded border-2 border-blue-200">
                      <span className="font-semibold">Estimated VAT Payable</span>
                      <span className="font-bold text-blue-700">{formatCurrency(taxData.taxes?.vat?.estimated)}</span>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Percent className="h-5 w-5 text-purple-600" />
                    Corporate Income Tax
                  </h3>
                  <div className="space-y-4">
                    <div className="flex justify-between p-3 bg-gray-50 rounded">
                      <span>Corporate Tax Rate</span>
                      <span className="font-bold">{taxData.taxes?.corporateTax?.rate}%</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded">
                      <span>Taxable Income</span>
                      <span className="font-medium">{formatCurrency(taxData.taxableIncome)}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-purple-50 rounded border-2 border-purple-200">
                      <span className="font-semibold">Estimated Tax Payable</span>
                      <span className="font-bold text-purple-700">{formatCurrency(taxData.taxes?.corporateTax?.estimated)}</span>
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="p-6 bg-red-50 border-red-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-red-800">Total Estimated Tax Liability</h3>
                    <p className="text-sm text-red-600">Combined VAT and Corporate Tax</p>
                  </div>
                  <p className="text-3xl font-bold text-red-700">{formatCurrency(taxData.taxes?.totalEstimated)}</p>
                </div>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">No tax data available</div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
