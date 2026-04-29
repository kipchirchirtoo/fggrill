'use client';

import React, { useState, useEffect } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/user-roles';
import { financeAPI } from '@/lib/api/finance';
import { 
  Building, Landmark, AlertCircle, CheckCircle2, 
  Search, RefreshCw, ArrowRight, DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';

export default function BankingControlPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [bankingData, setBankingData] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd')
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await financeAPI.director.getBanking(dateRange);
      if (res.success) {
        setBankingData(res.data || []);
      } else {
        toast.error(res.message || 'Failed to fetch banking data');
      }
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Failed to fetch banking data';
      
      if (message.includes('403') || message.includes('Forbidden')) {
        toast.error('Access Denied: You need director role');
      } else {
        toast.error(message);
      }
      
      console.error('Banking Control Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  return (
    <ProtectedRoute roles={[UserRole.DIRECTOR, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="p-6 space-y-8">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 tracking-tight">Banking Control Panel</h1>
              <p className="text-stone-500 mt-1">Cross-branch cash-to-bank verification</p>
            </div>
            <div className="flex items-center gap-3">
               <div className="flex bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
                <input 
                  type="date" 
                  value={dateRange.startDate}
                  onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                  className="px-3 py-2 text-sm border-r border-stone-200 outline-none" 
                />
                <input 
                  type="date" 
                  value={dateRange.endDate}
                  onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                  className="px-3 py-2 text-sm outline-none" 
                />
              </div>
              <button 
                onClick={fetchData}
                className="p-2.5 bg-[#007AFF] text-white rounded-xl hover:bg-[#0056b3] transition-colors shadow-sm"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Branch Grid */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007AFF]"></div>
              <p className="text-stone-500 text-sm">Loading banking data...</p>
            </div>
          ) : bankingData.length === 0 ? (
            <div className="bg-stone-50 border border-dashed border-stone-200 rounded-2xl p-12 text-center">
              <Landmark className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-stone-800 mb-2">No Banking Data</h3>
              <p className="text-stone-500">No banking records found for the selected date range.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {bankingData.map((branch) => (
              <BranchBankingCard key={branch.id} branch={branch} />
            ))}
          </div>

          {/* Detailed Table */}
          <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
              <h3 className="font-bold text-stone-800">Branch Reconciliation Summary</h3>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input 
                  placeholder="Filter branches..." 
                  className="pl-9 pr-4 py-1.5 text-sm bg-white border border-stone-200 rounded-lg outline-none focus:ring-1 focus:ring-[#007AFF]"
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-semibold text-stone-500 uppercase tracking-wider bg-stone-50/50">
                    <th className="px-6 py-4">Branch Name</th>
                    <th className="px-6 py-4">Cash Collected</th>
                    <th className="px-6 py-4">Amount Banked</th>
                    <th className="px-6 py-4">Variance</th>
                    <th className="px-6 py-4">Flags</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {bankingData.map((branch) => {
                    const variance = branch.totalUnbanked;
                    const isHighVariance = variance > 5000;
                    
                    return (
                      <tr key={branch.id} className="hover:bg-stone-50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-500 group-hover:bg-[#007AFF]/10 group-hover:text-[#007AFF] transition-colors">
                              <Building className="w-4 h-4" />
                            </div>
                            <span className="font-medium text-stone-900">{branch.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm">KES {branch.totalExpected.toLocaleString()}</td>
                        <td className="px-6 py-4 font-mono text-sm">KES {branch.totalBanked.toLocaleString()}</td>
                        <td className={`px-6 py-4 font-mono text-sm font-bold ${variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          KES {variance.toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          {branch.flagCount > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                              <AlertCircle className="w-3 h-3" />
                              {branch.flagCount} Flags
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 border border-emerald-100">
                              <CheckCircle2 className="w-3 h-3" />
                              Clean
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button className="p-2 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-900 transition-colors">
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </div>
            </>
          )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function BranchBankingCard({ branch }: any) {
  const variance = branch.totalUnbanked;
  const isFlagged = variance > 1000;

  return (
    <div className={`bg-white p-6 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md ${
      isFlagged ? 'border-rose-200 ring-4 ring-rose-50' : 'border-stone-200'
    }`}>
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isFlagged ? 'bg-rose-100 text-rose-600' : 'bg-[#007AFF]/10 text-[#007AFF]'
          }`}>
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-stone-900">{branch.name}</h4>
            <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">Branch Overview</p>
          </div>
        </div>
        {isFlagged && (
          <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter bg-rose-600 text-white px-2 py-0.5 rounded shadow-sm">
            FLAGGED
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-stone-500">Collected Cash:</span>
          <span className="font-mono font-bold text-stone-800">KES {branch.totalExpected.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-stone-500">Banked Amount:</span>
          <span className="font-mono font-bold text-emerald-600">KES {branch.totalBanked.toLocaleString()}</span>
        </div>
        <div className="pt-4 border-t border-stone-100 flex justify-between items-center">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Variance</span>
          <span className={`text-xl font-black font-mono ${variance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
            KES {variance.toLocaleString()}
          </span>
        </div>
      </div>

      <button className="w-full mt-6 py-2.5 rounded-xl border border-stone-200 text-sm font-bold text-stone-600 hover:bg-stone-50 transition-colors flex items-center justify-center gap-2">
        Drill Down
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}
