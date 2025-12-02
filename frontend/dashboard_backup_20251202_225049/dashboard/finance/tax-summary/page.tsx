'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { financeAPI } from '@/lib/api';
import { Receipt, RefreshCw, Download, Calendar, DollarSign } from 'lucide-react';

interface TaxData { vatCollected: number; vatPaid: number; netVat: number; withholdingTax: number; payeTax: number; totalTaxLiability: number; }

export default function TaxSummaryPage() {
  const { user } = useAuth();
  const [data, setData] = useState<TaxData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getTaxSummary();
      if (response.success) setData(response.data);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Tax Summary</h1><p className="text-gray-500">Tax obligations overview</p></div>
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
            <IOSCard className="p-12 text-center"><Receipt className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No tax data</p></IOSCard>
          ) : (
            <>
              <IOSCard className="p-6 bg-gradient-to-r from-blue-500 to-indigo-600 text-white">
                <p className="text-blue-100">Total Tax Liability</p>
                <p className="text-4xl font-bold mt-2">KES {data.totalTaxLiability.toLocaleString()}</p>
              </IOSCard>

              <div className="grid md:grid-cols-2 gap-6">
                <IOSCard className="p-6">
                  <h2 className="text-lg font-semibold font-sf-pro-display mb-4">VAT Summary</h2>
                  <div className="space-y-4">
                    <div className="flex justify-between p-3 bg-gray-50 rounded-ios-lg">
                      <span>VAT Collected (Output)</span>
                      <span className="font-bold">KES {data.vatCollected.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded-ios-lg">
                      <span>VAT Paid (Input)</span>
                      <span className="font-bold">KES {data.vatPaid.toLocaleString()}</span>
                    </div>
                    <div className={`flex justify-between p-3 rounded-ios-lg ${data.netVat >= 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                      <span className="font-medium">{data.netVat >= 0 ? 'VAT Payable' : 'VAT Refund'}</span>
                      <span className={`font-bold ${data.netVat >= 0 ? 'text-red-600' : 'text-green-600'}`}>KES {Math.abs(data.netVat).toLocaleString()}</span>
                    </div>
                  </div>
                </IOSCard>

                <IOSCard className="p-6">
                  <h2 className="text-lg font-semibold font-sf-pro-display mb-4">Other Taxes</h2>
                  <div className="space-y-4">
                    <div className="flex justify-between p-3 bg-gray-50 rounded-ios-lg">
                      <span>Withholding Tax</span>
                      <span className="font-bold">KES {data.withholdingTax.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded-ios-lg">
                      <span>PAYE Tax</span>
                      <span className="font-bold">KES {data.payeTax.toLocaleString()}</span>
                    </div>
                  </div>
                </IOSCard>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
