'use client';

import React, { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { API_URL } from '@/lib/config';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { AddAdjustmentDialog } from '@/components/hr/add-adjustment-dialog';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  Users,
  Building,
  DollarSign,
  ShieldCheck,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────
interface Adjustment {
  type: string;
  category: string;
  amount: number;
  description?: string;
  timestamp: string;
}

interface StaffPayrollItem {
  id: string;
  category: string;
  amount: number;
  description?: string;
  source_record_id?: string;
  source_record_type?: string;
  audited_by_name?: string;
  accountant_name?: string;
}

interface PayrollRecord {
  id: string;
  staff_id: string;
  branch_id: number;
  employee_name: string;
  employee_code: string;
  national_id: string;
  basic_salary: number;
  additions: Adjustment[];
  deductions: Adjustment[];
  items?: StaffPayrollItem[]; // Traceability items
  total_additions: number;
  total_deductions: number;
  gross_pay: number;
  net_pay: number;
  nssf: number;
  shif: number;
}

interface PayrollRun {
  id?: string;
  month: number;
  year: number;
  status: 'draft' | 'approved' | 'downloaded';
  total_basic_salary: number;
  total_gross_pay: number;
  total_deductions: number;
  total_net_pay: number;
  approved_at?: string;
  approver?: { first_name: string; last_name: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const KES = (v: number) => `KES ${(v || 0).toLocaleString('en-KE', { minimumFractionDigits: 2 })}`;
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const TYPE_LABELS: Record<string, string> = {
  shif: 'SHIF/SHA', nssf: 'NSSF',
  credit_bills: 'Credit Bills', absenteeism: 'Absenteeism', loan: 'Loan',
  advance: 'Advance', uniform: 'Uniform', 
  commission: 'Commission', bonus: 'Bonus', allowance: 'Allowance', other: 'Other',
};

// ─── StatusBadge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    draft:      { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa' },
    approved:   { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' },
    downloaded: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  };
  const s = map[status] || map.draft;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 4, padding: '2px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>
      {status}
    </span>
  );
};

// ─── Adjustments inline summary (for table cells) ────────────────────────────
const ALLOWED_DEDUCTIONS = ['credit_bills', 'absenteeism', 'loan', 'loans', 'advance', 'advances', 'uniform', 'other'];

const AdjSummary = ({ items, isAddition, recordItems }: { items: Adjustment[]; isAddition: boolean; recordItems?: StaffPayrollItem[] }) => {
  if (!items || items.length === 0) return <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>;
  
  // Try to find matching traceability items to show audit info
  const getAuditInfo = (category: string) => {
    if (!recordItems) return null;
    return recordItems.find(it => it.category.toLowerCase() === category.toLowerCase());
  };

  const displayItems = isAddition 
    ? (items || []) 
    : (items || []).filter(a => a.category && ['credit_bills', 'absenteeism', 'loan', 'loans', 'advance', 'advances', 'uniform', 'other'].includes(a.category.toLowerCase()));

  if (displayItems.length === 0) return <span style={{ color: '#9ca3af', fontSize: 11 }}>—</span>;

  const color = isAddition ? '#15803d' : '#b91c1c';
  const prefix = isAddition ? '+' : '-';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {displayItems.map((a, i) => {
        const audit = getAuditInfo(a.category || '');
        const auditName = audit?.audited_by_name || audit?.accountant_name;
        
        return (
          <div key={i} title={auditName ? `Audited by: ${auditName}` : undefined} style={{ fontSize: 11, color, display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, whiteSpace: 'nowrap' }}>
              <span style={{ color: '#64748b', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                {(a.category && TYPE_LABELS[a.category.toLowerCase()]) || a.category || 'Other'}
                {auditName && <ShieldCheck className="w-3 h-3 text-blue-500" />}
              </span>
              <span style={{ fontWeight: 700 }}>{prefix}{KES(a.amount)}</span>
            </div>
            {auditName && (
              <span style={{ fontSize: 8, color: '#94a3b8', fontStyle: 'italic', marginTop: -1 }}>
                Audited by {auditName}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Page Component ─────────────────────────────────────────────────────
export default function PayrollPage() {
  const { activeBranchId, activeBranch } = useBranch();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [summary, setSummary] = useState<PayrollRun | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState(false);

  // Computed branch totals from records
  const branchTotals = records.reduce((acc, r) => ({
    basic:      acc.basic      + (r.basic_salary    || 0),
    gross:      acc.gross      + (r.gross_pay       || 0),
    deductions: acc.deductions + (r.total_deductions|| 0),
    net:        acc.net        + (r.net_pay         || 0),
    shif:       acc.shif       + (r.shif            || 0),
    nssf:       acc.nssf       + (r.nssf            || 0),
  }), { basic: 0, gross: 0, deductions: 0, net: 0, shif: 0, nssf: 0 });

  const fetchPayroll = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await api.payroll.getDraft({ 
        month, 
        year, 
        branch_id: (activeBranchId && activeBranchId > 0) ? activeBranchId : undefined 
      });

      if (res.success) {
        setRecords(res.data?.records || []);
        setSummary(res.data?.run || res.data?.summary || null);
      } else {
        toast.error(res.message || 'Failed to fetch payroll');
        setRecords([]);
        setSummary(null);
      }
    } catch (error: any) {
      console.error('Error fetching payroll:', error);
      toast.error('Network error occurred');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [month, year, activeBranchId]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  const handleApprove = async () => {
    if (!summary || summary.status !== 'draft') return;
    
    if (!confirm(`Are you sure you want to approve the payroll for ${MONTHS[month-1]} ${year}? This will lock the records.`)) {
      return;
    }

    setIsApproving(true);
    try {
      const res = await api.payroll.approveDraft({
        month,
        year,
        branch_id: (activeBranchId && activeBranchId > 0) ? activeBranchId : undefined
      });

      if (res.success) {
        toast.success('Payroll approved successfully');
        fetchPayroll();
      } else {
        toast.error(res.message || 'Approval failed');
      }
    } catch (e) {
      toast.error('Error approving payroll');
    } finally {
      setIsApproving(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!summary?.id) { toast.error('No payroll run found'); return; }
    setIsDownloading(true);
    const toastId = toast.loading('Generating summary PDF...');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      const branchPart = (activeBranchId && activeBranchId > 0) ? `&branch_id=${activeBranchId}` : '';
      const url = `${API_URL}/api/payroll/run/${summary.id}/summary-pdf?token=${token}${branchPart}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Payroll_Summary_${MONTHS[month-1]}_${year}.pdf`;
      link.click();
      toast.success('Summary PDF downloaded!', { id: toastId });
    } catch (e: any) {
      toast.error('Failed to download PDF', { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadZip = async () => {
    if (!summary?.id) { toast.error('No payroll run found'); return; }
    setIsDownloading(true);
    const toastId = toast.loading('Generating payslips zip (may take a minute)...');
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
      const branchPart = (activeBranchId && activeBranchId > 0) ? `&branch_id=${activeBranchId}` : '';
      const url = `${API_URL}/api/payroll/run/${summary.id}/payslips-zip?token=${token}${branchPart}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const blob = await res.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Payslips_${MONTHS[month-1]}_${year}.zip`;
      link.click();
      toast.success('Payslips downloaded!', { id: toastId });
    } catch (e: any) {
      toast.error('Failed to download payslips', { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleGenerate = () => {
    fetchPayroll(true);
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
              <Building className="w-6 h-6 text-stone-500" />
              FamousGate Hotels Payroll
            </h1>
            <p className="text-stone-500 text-sm font-medium">
              Universal Payroll Management System
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <BranchSelector showAllOption allOptionLabel="All Branches" />
            <div className="flex items-center bg-white border border-stone-200 rounded-xl p-1 shadow-sm">
              <button 
                onClick={() => setMonth(m => m === 1 ? 12 : m - 1)}
                className="p-1.5 hover:bg-stone-50 rounded-lg text-stone-500 transition-colors"
                disabled={isLoading}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 min-w-[140px] text-center">
                <span className="text-sm font-bold text-stone-800 tracking-tight">
                  {MONTHS[month - 1]} {year}
                </span>
              </div>
              <button 
                onClick={() => setMonth(m => m === 12 ? 1 : m + 1)}
                className="p-1.5 hover:bg-stone-50 rounded-lg text-stone-500 transition-colors"
                disabled={isLoading}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <IOSButton 
              onClick={() => window.location.href = '/dashboard/hr/policies'}
              className="bg-white text-stone-900 border border-stone-200 shadow-sm hover:bg-stone-50"
            >
              <Settings className="w-4 h-4 mr-2" />
              Manage Policies
            </IOSButton>

            <IOSButton 
              onClick={() => setIsAdjustmentDialogOpen(true)}
              className="bg-white text-stone-900 border border-stone-200 shadow-sm hover:bg-stone-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add adjustment
            </IOSButton>

            <IOSButton 
              onClick={() => fetchPayroll(true)}
              disabled={isRefreshing || isLoading}
              className="bg-white text-stone-900 border border-stone-200 shadow-sm hover:bg-stone-50"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isRefreshing && "animate-spin")} />
              Refresh
            </IOSButton>

            {summary?.status === 'draft' && (
              <IOSButton 
                onClick={handleApprove}
                disabled={isApproving}
                className="bg-[#007AFF] text-white shadow-lg shadow-blue-100 border-none"
              >
                {isApproving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Approve {MONTHS[month-1]} Payroll
              </IOSButton>
            )}

            {summary && (
              <>
                <IOSButton 
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                  className="bg-white text-stone-900 border border-stone-200 shadow-sm hover:bg-stone-50"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Summary PDF
                </IOSButton>
                <IOSButton 
                  onClick={handleDownloadZip}
                  disabled={isDownloading}
                  className="bg-[#34C759] text-white shadow-lg shadow-green-100 border-none"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Payslips
                </IOSButton>
              </>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-[24px] border border-stone-200/60 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Gross Pay</p>
                <p className="text-xl font-black text-stone-900 leading-none mt-0.5">{KES(summary?.total_gross_pay || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[24px] border border-stone-200/60 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Total Deductions</p>
                <p className="text-xl font-black text-stone-900 leading-none mt-0.5">{KES(summary?.total_deductions || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[24px] border border-stone-200/60 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Net Payable</p>
                <p className="text-xl font-black text-stone-900 leading-none mt-0.5">{KES(summary?.total_net_pay || 0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[24px] border border-stone-200/60 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-stone-600" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Run Status</p>
                <div className="mt-1 flex items-center gap-2">
                   <StatusBadge status={summary?.status || 'draft'} />
                   {summary?.approved_at && (
                     <span className="text-[10px] text-stone-400 font-medium italic">
                       Approved by {summary.approver?.first_name}
                     </span>
                   )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Records Table */}
        <div className="bg-white rounded-[28px] border border-stone-200/60 shadow-soft-xl overflow-hidden min-h-[400px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <RefreshCw className="w-10 h-10 text-stone-200 animate-spin" />
              <p className="text-stone-400 font-bold uppercase tracking-widest text-xs">Computing Payroll Records...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-6">
              <div className="w-20 h-20 rounded-full bg-stone-50 flex items-center justify-center mb-6">
                <Users className="w-10 h-10 text-stone-200" />
              </div>
              <h3 className="text-xl font-bold text-stone-900 mb-2 tracking-tight">No Payroll Records Found</h3>
              <p className="text-stone-500 max-w-md mx-auto leading-relaxed mb-6">
                We couldn't find any staff records for the selected branch and period. Click below to generate the payroll draft.
              </p>
              <IOSButton 
                onClick={handleGenerate}
                className="bg-[#007AFF] text-white shadow-lg shadow-blue-100 border-none px-8"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Generate Payroll Run
              </IOSButton>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-stone-50/50 border-b border-stone-200/60">
                    <th className="px-5 py-4 text-left text-[11px] font-black text-stone-400 uppercase tracking-widest">Staff Detail</th>
                    <th className="px-4 py-4 text-right text-[11px] font-black text-stone-400 uppercase tracking-widest whitespace-nowrap">Basic Salary</th>
                    <th className="px-4 py-4 text-left text-[11px] font-black text-stone-400 uppercase tracking-widest">Additions</th>
                    <th className="px-4 py-4 text-left text-[11px] font-black text-stone-400 uppercase tracking-widest">Deductions</th>
                    <th className="px-4 py-4 text-left text-[11px] font-black text-stone-400 uppercase tracking-widest whitespace-nowrap">Statutory (SHIF/NSSF)</th>
                    <th className="px-4 py-4 text-right text-[11px] font-black text-stone-400 uppercase tracking-widest whitespace-nowrap">Gross Pay</th>
                    <th className="px-5 py-4 text-right text-[11px] font-black text-stone-400 uppercase tracking-widest whitespace-nowrap bg-stone-100/30">Net Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-stone-50/50 transition-colors group">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center group-hover:bg-white transition-colors">
                            <span className="text-[13px] font-bold text-stone-600">
                              {r.employee_name.split(' ').map(n => n[0]).join('')}
                            </span>
                          </div>
                          <div>
                            <p className="text-[14px] font-bold text-stone-900 tracking-tight">{r.employee_name}</p>
                            <p className="text-[11px] text-stone-400 font-bold uppercase tracking-wider">{r.employee_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-medium text-stone-600 text-[13px]">
                        {KES(r.basic_salary)}
                      </td>
                      <td className="px-4 py-4 min-w-[180px]">
                        <AdjSummary items={r.additions} isAddition={true} recordItems={r.items} />
                      </td>
                      <td className="px-4 py-4 min-w-[180px]">
                        <AdjSummary items={r.deductions} isAddition={false} recordItems={r.items} />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-tight">
                            <span className="text-stone-400">SHIF:</span>
                            <span className={r.shif > 0 ? 'text-red-700' : 'text-stone-300'}>{KES(r.shif)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-tight">
                            <span className="text-stone-400">NSSF:</span>
                            <span className={r.nssf > 0 ? 'text-red-700' : 'text-stone-300'}>{KES(r.nssf)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-bold text-stone-900 text-[13px]">
                        {KES(r.gross_pay)}
                      </td>
                      <td className="px-5 py-4 text-right bg-stone-50/30 group-hover:bg-white transition-colors">
                        <span className="text-[14px] font-black text-blue-600 tracking-tight">
                          {KES(r.net_pay)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Branch Totals Footer */}
                {records.length > 0 && (
                  <tfoot>
                    <tr className="bg-stone-900 text-white">
                      <td className="px-5 py-3.5 text-[11px] font-black uppercase tracking-widest" colSpan={1}>
                        {activeBranchId && activeBranchId > 0 ? 'Branch Total' : 'Grand Total'} ({records.length} staff)
                      </td>
                      <td className="px-4 py-3.5 text-right text-[12px] font-black text-white/80">
                        {KES(branchTotals.basic)}
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-white/60 italic">—</td>
                      <td className="px-4 py-3.5 text-[11px] text-white/60 italic">—</td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">SHIF: {KES(branchTotals.shif)}</span>
                          <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">NSSF: {KES(branchTotals.nssf)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right text-[12px] font-black text-white">
                        {KES(branchTotals.gross)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-[14px] font-black text-[#34C759]">
                        {KES(branchTotals.net)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>
      </div>

      <AddAdjustmentDialog 
        open={isAdjustmentDialogOpen} 
        onOpenChange={setIsAdjustmentDialogOpen}
        onSuccess={fetchPayroll}
      />
    </DashboardLayout>
  );
}
