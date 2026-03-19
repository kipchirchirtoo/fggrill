'use client';

import React, { useState } from 'react';
import { FileText, Download, RefreshCw, AlertTriangle, BarChart2, TrendingDown, DollarSign, Package, ClipboardList, ShieldCheck } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { MultiBranchSelector } from '@/components/dashboard/MultiBranchSelector';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { API_URL } from '@/lib/config';

const reports = [
  { id: 'exception_summary',      name: 'Audit Exception Summary',    category: 'Compliance',  icon: AlertTriangle,  color: 'text-red-600',    bg: 'bg-red-50',    desc: 'All open & resolved audit exceptions with severity breakdown' },
  { id: 'compliance_audit',       name: 'SOP Compliance Audit',       category: 'Compliance',  icon: ShieldCheck,    color: 'text-blue-600',   bg: 'bg-blue-50',   desc: 'Branch compliance scores based on exceptions, voids & approvals' },
  { id: 'void_analytics',         name: 'Voided Transaction Analysis', category: 'Compliance',  icon: ClipboardList,  color: 'text-orange-600', bg: 'bg-orange-50', desc: 'All cancelled restaurant & bar orders with staff attribution' },
  { id: 'revenue_reconciliation', name: 'Revenue Reconciliation',     category: 'Financial',   icon: BarChart2,      color: 'text-green-600',  bg: 'bg-green-50',  desc: 'Revenue streams vs payment methods reconciliation' },
  { id: 'leakage_report',         name: 'Leakage Analysis',           category: 'Financial',   icon: TrendingDown,   color: 'text-red-700',    bg: 'bg-red-50',    desc: 'Exceptions, voids & wastage combined leakage report' },
  { id: 'expenditure_audit',      name: 'Expenditure Audit',          category: 'Financial',   icon: DollarSign,     color: 'text-purple-600', bg: 'bg-purple-50', desc: 'All expenses & petty cash with approval status' },
  { id: 'variance_report',        name: 'Stock Variance Report',      category: 'Inventory',   icon: Package,        color: 'text-yellow-700', bg: 'bg-yellow-50', desc: 'Stock in/out/wastage variance with cost impact per item' },
  { id: 'consumption_audit',      name: 'Consumption Analytics',      category: 'Inventory',   icon: BarChart2,      color: 'text-teal-600',   bg: 'bg-teal-50',   desc: 'Requested vs consumed vs wasted with efficiency scores' },
  { id: 'grn_audit',              name: 'GRN Audit',                  category: 'Inventory',   icon: ClipboardList,  color: 'text-indigo-600', bg: 'bg-indigo-50', desc: 'Goods received notes with line items, costs & approvals' },
];

const categoryOrder = ['Compliance', 'Financial', 'Inventory'];

export default function AuditReporting() {
  const { userBranches } = useBranch();
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);
  const [isExporting, setIsExporting] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  const handleExport = async (reportId: string) => {
    setIsExporting(reportId);
    const toastId = toast.loading('Generating report...');
    try {
      const params = new URLSearchParams();
      if (selectedBranchIds.length > 0) params.append('branch_ids', selectedBranchIds.join(','));
      params.append('start_date', dateRange.startDate);
      params.append('end_date', dateRange.endDate);

      let branchName = 'All Branches';
      if (selectedBranchIds.length === 1) branchName = userBranches.find(b => b.id === selectedBranchIds[0])?.name || 'Selected Branch';
      else if (selectedBranchIds.length > 1) branchName = `${selectedBranchIds.length} Branches`;
      params.append('branch_name', branchName);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/reports/auditor/export/${reportId}?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || `Request failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportId}_${dateRange.startDate}_${dateRange.endDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success('Report downloaded', { id: toastId });
    } catch (e: any) {
      console.error('Export failed:', e);
      toast.error(e.message || 'Failed to generate report', { id: toastId });
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Audit Reports</h1>
            <p className="text-gray-500 text-sm mt-1">Generate Excel reports from live data across all modules</p>
          </div>

          {/* Filters */}
          <IOSCard className="p-4 overflow-visible relative z-20">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Branch</label>
                <MultiBranchSelector selectedIds={selectedBranchIds} onChange={setSelectedBranchIds} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Date Range</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={e => setDateRange(p => ({ ...p, startDate: e.target.value }))}
                    className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm"
                  />
                  <span className="text-gray-400 text-sm">to</span>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={e => setDateRange(p => ({ ...p, endDate: e.target.value }))}
                    className="flex-1 bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          </IOSCard>

          {/* Reports by category */}
          {categoryOrder.map(category => (
            <div key={category}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">{category}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reports.filter(r => r.category === category).map(report => {
                  const Icon = report.icon;
                  const busy = isExporting === report.id;
                  return (
                    <IOSCard key={report.id} className="p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-lg ${report.bg} flex items-center justify-center flex-shrink-0`}>
                          <Icon className={`h-5 w-5 ${report.color}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 text-sm leading-tight">{report.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 leading-snug">{report.desc}</p>
                        </div>
                      </div>
                      <IOSButton
                        onClick={() => handleExport(report.id)}
                        disabled={!!isExporting}
                        className="w-full"
                        leftIcon={busy ? <RefreshCw className="animate-spin h-4 w-4" /> : <Download className="h-4 w-4" />}
                      >
                        {busy ? 'Generating...' : 'Export Excel'}
                      </IOSButton>
                    </IOSCard>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
