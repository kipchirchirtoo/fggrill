'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { Scale, RefreshCw, Download, Building2 } from 'lucide-react';

interface BalanceSheetData {
  as_of_date: string;
  current_assets: { cash: number; accounts_receivable: number; inventory: number; prepaid_expenses: number; total: number };
  fixed_assets: { property_equipment: number; accumulated_depreciation: number; net_fixed_assets: number };
  total_assets: number;
  current_liabilities: { accounts_payable: number; accrued_expenses: number; short_term_debt: number; total: number };
  long_term_liabilities: { long_term_debt: number; total: number };
  total_liabilities: number;
  equity: { common_stock: number; retained_earnings: number; total: number };
  total_liabilities_equity: number;
}

interface Branch { id: number; name: string; }

export default function BalanceSheetPage() {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await financeAPI.getBranches();
      if (response.success && Array.isArray(response.data)) setBranches(response.data);
    } catch (error) { console.error('Error:', error); }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getBalanceSheet({ branch_id: selectedBranch || undefined });
      if (response.success && response.data) setData(response.data);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const LineItem = ({ label, amount, indent = false, bold = false }: { label: string; amount: number; indent?: boolean; bold?: boolean }) => (
    <div className={`flex justify-between py-2.5 ${indent ? 'pl-6' : ''} ${bold ? 'font-medium' : ''}`}>
      <span className="text-gray-700">{label}</span>
      <span className={`${bold ? 'font-semibold' : ''} text-gray-900`}>
        {amount < 0 ? '(' : ''}KES {Math.abs(amount || 0).toLocaleString()}{amount < 0 ? ')' : ''}
      </span>
    </div>
  );

  const SectionTotal = ({ label, amount }: { label: string; amount: number }) => (
    <div className="flex justify-between py-3 bg-gray-50 -mx-5 px-5 font-medium">
      <span className="text-gray-900">{label}</span>
      <span className="font-semibold text-gray-900">KES {(amount || 0).toLocaleString()}</span>
    </div>
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Balance Sheet</h1>
              <p className="text-sm text-gray-500 mt-1">Statement of financial position</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedBranch || ''}
                onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <button onClick={fetchData} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <Download className="h-4 w-4" /> Export
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : !data ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <Scale className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No balance sheet data available</p>
            </div>
          ) : (
            <>
              {/* Date Header */}
              <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">As of</p>
                <p className="text-lg font-semibold text-gray-900">{new Date(data.as_of_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>

              {/* Assets */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Assets</h2>
                </div>
                <div className="px-5">
                  <div className="py-3 border-b border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Current Assets</p>
                  </div>
                  <LineItem label="Cash & Cash Equivalents" amount={data.current_assets?.cash || 0} indent />
                  <LineItem label="Accounts Receivable" amount={data.current_assets?.accounts_receivable || 0} indent />
                  <LineItem label="Inventory" amount={data.current_assets?.inventory || 0} indent />
                  <LineItem label="Prepaid Expenses" amount={data.current_assets?.prepaid_expenses || 0} indent />
                  <SectionTotal label="Total Current Assets" amount={data.current_assets?.total || 0} />
                  
                  <div className="py-3 border-b border-gray-100 mt-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Fixed Assets</p>
                  </div>
                  <LineItem label="Property & Equipment" amount={data.fixed_assets?.property_equipment || 0} indent />
                  <LineItem label="Less: Accumulated Depreciation" amount={data.fixed_assets?.accumulated_depreciation || 0} indent />
                  <SectionTotal label="Net Fixed Assets" amount={data.fixed_assets?.net_fixed_assets || 0} />
                </div>
                <div className="flex justify-between py-4 px-5 bg-gray-100 font-semibold text-lg border-t border-gray-200">
                  <span>Total Assets</span>
                  <span>KES {(data.total_assets || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Liabilities & Equity */}
              <div className="bg-white border border-gray-200 rounded-lg">
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
                  <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">Liabilities & Equity</h2>
                </div>
                <div className="px-5">
                  <div className="py-3 border-b border-gray-100">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Current Liabilities</p>
                  </div>
                  <LineItem label="Accounts Payable" amount={data.current_liabilities?.accounts_payable || 0} indent />
                  <LineItem label="Accrued Expenses" amount={data.current_liabilities?.accrued_expenses || 0} indent />
                  <LineItem label="Short-term Debt" amount={data.current_liabilities?.short_term_debt || 0} indent />
                  <SectionTotal label="Total Current Liabilities" amount={data.current_liabilities?.total || 0} />
                  
                  <div className="py-3 border-b border-gray-100 mt-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Long-term Liabilities</p>
                  </div>
                  <LineItem label="Long-term Debt" amount={data.long_term_liabilities?.long_term_debt || 0} indent />
                  <SectionTotal label="Total Long-term Liabilities" amount={data.long_term_liabilities?.total || 0} />
                  
                  <div className="flex justify-between py-3 bg-gray-50 -mx-5 px-5 font-medium border-t border-gray-100">
                    <span className="text-gray-900">Total Liabilities</span>
                    <span className="font-semibold text-gray-900">KES {(data.total_liabilities || 0).toLocaleString()}</span>
                  </div>
                  
                  <div className="py-3 border-b border-gray-100 mt-2">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Shareholders' Equity</p>
                  </div>
                  <LineItem label="Common Stock" amount={data.equity?.common_stock || 0} indent />
                  <LineItem label="Retained Earnings" amount={data.equity?.retained_earnings || 0} indent />
                  <SectionTotal label="Total Equity" amount={data.equity?.total || 0} />
                </div>
                <div className="flex justify-between py-4 px-5 bg-gray-100 font-semibold text-lg border-t border-gray-200">
                  <span>Total Liabilities & Equity</span>
                  <span>KES {(data.total_liabilities_equity || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Balance Check */}
              <div className={`p-4 rounded-lg text-center ${Math.abs((data.total_assets || 0) - (data.total_liabilities_equity || 0)) < 1 ? 'bg-gray-100' : 'bg-gray-200'}`}>
                <p className="text-sm font-medium text-gray-700">
                  {Math.abs((data.total_assets || 0) - (data.total_liabilities_equity || 0)) < 1 
                    ? '✓ Balance Sheet is balanced' 
                    : '⚠ Balance Sheet has a discrepancy'}
                </p>
              </div>
            </>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
