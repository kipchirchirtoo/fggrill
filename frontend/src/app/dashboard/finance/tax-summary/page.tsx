'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { Receipt, RefreshCw, Download } from 'lucide-react';
import { BranchSelector } from '@/components/finance/BranchSelector';
import { DateRangeSelector, DateRangePreset } from '@/components/finance/DateRangeSelector';

interface TaxData { vatCollected: number; vatPaid: number; netVat: number; withholdingTax: number; payeTax: number; totalTaxLiability: number; }

const defaultTaxData: TaxData = { vatCollected: 0, vatPaid: 0, netVat: 0, withholdingTax: 0, payeTax: 0, totalTaxLiability: 0 };

export default function TaxSummaryPage() {
  const [data, setData] = useState<TaxData>(defaultTaxData);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('month');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getTaxSummary({
        branch_id: selectedBranch || undefined,
        startDate,
        endDate
      });
      if (response?.success && response.data) {
        setData({ ...defaultTaxData, ...response.data });
      } else if (response && !response.success) {
        setData({ ...defaultTaxData, ...response });
      } else {
        setData(defaultTaxData);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Tax Summary</h1>
              <p className="text-sm text-gray-500 mt-1">Tax obligations overview</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <BranchSelector
                selectedBranch={selectedBranch}
                onBranchChange={setSelectedBranch}
              />
              <DateRangeSelector
                startDate={startDate}
                endDate={endDate}
                onRangeChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
                preset={datePreset}
                onPresetChange={setDatePreset}
              />
              <button onClick={fetchData} disabled={isLoading} className="p-2.5 text-stone-500 bg-white border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <Download className="h-4 w-4" />
                Export
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : (
            <>
              {/* Total */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total Tax Liability</p>
                <p className="text-3xl font-semibold text-gray-900 mt-2">KES {(data.totalTaxLiability || 0).toLocaleString()}</p>
              </div>

              {/* Details */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="text-sm font-medium text-gray-900">VAT Summary</h2>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">VAT Collected (Output)</span>
                      <span className="font-semibold text-gray-900">KES {(data.vatCollected || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">VAT Paid (Input)</span>
                      <span className="font-semibold text-gray-900">KES {(data.vatPaid || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-100 rounded-lg">
                      <span className="font-medium text-gray-900">{(data.netVat || 0) >= 0 ? 'VAT Payable' : 'VAT Refund'}</span>
                      <span className="font-semibold text-gray-900">KES {Math.abs(data.netVat || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h2 className="text-sm font-medium text-gray-900">Other Taxes</h2>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">Withholding Tax</span>
                      <span className="font-semibold text-gray-900">KES {(data.withholdingTax || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-gray-600">PAYE Tax</span>
                      <span className="font-semibold text-gray-900">KES {(data.payeTax || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
