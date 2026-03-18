'use client';

import { useState, useEffect, useCallback } from 'react';
import { API_URL } from '@/lib/config';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useBranch } from '@/lib/branch-context';
import { staffAPI } from '@/lib/api';
import {
    DollarSign, RefreshCw, Search, ChevronRight, ArrowUpRight,
    CheckCircle2, Play, FileText, TrendingDown, Activity,
    MinusCircle, ArrowDownUp, Info, Building2
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function HRPayrollPage() {
    const { user } = useAuth();
    const { branches } = useBranch();
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Filters
    const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
    const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
    const [pendingDeductions, setPendingDeductions] = useState<{
        creditBills: any[]; advances: any[]; loans: any[];
    }>({ creditBills: [], advances: [], loans: [] });
    const [summary, setSummary] = useState({ count: 0, totalBasic: 0, totalDeductions: 0, totalNet: 0 });

    const selectedBranchName = selectedBranchId === 'all'
        ? 'All Branches'
        : branches.find(b => String(b.id) === selectedBranchId)?.name || 'Branch';

    const fetchPendingDeductions = useCallback(async () => {
        try {
            const [billsRes, advancesRes, loansRes] = await Promise.all([
                staffAPI.simplePayroll.getCreditBills({ status: 'pending' }),
                staffAPI.simplePayroll.getAdvances({ status: 'approved' }),
                staffAPI.simplePayroll.getLoans({ status: 'active' }),
            ]);
            setPendingDeductions({
                creditBills: billsRes?.data || [],
                advances: advancesRes?.data || [],
                loans: loansRes?.data || [],
            });
        } catch (e) { /* non-critical */ }
    }, []);

    const fetchPayrollData = useCallback(async () => {
        setIsLoading(true);
        try {
            const params: any = { month: Number(selectedMonth), year: Number(selectedYear) };
            if (selectedBranchId !== 'all') params.branch_id = Number(selectedBranchId);

            const res = await staffAPI.simplePayroll.getPayrollRecords(params);
            if (res.success) {
                const records = res.data || [];
                setPayrollRecords(records);
                setSummary({
                    count: records.length,
                    totalBasic: records.reduce((s: number, r: any) => s + Number(r.basic_salary), 0),
                    totalDeductions: records.reduce((s: number, r: any) => s + Number(r.total_deductions), 0),
                    totalNet: records.reduce((s: number, r: any) => s + Number(r.net_pay), 0),
                });
            }
        } catch (error) {
            console.error('Error fetching payroll:', error);
            toast.error('Failed to load payroll records');
        } finally {
            setIsLoading(false);
        }
    }, [selectedMonth, selectedYear, selectedBranchId]);

    useEffect(() => {
        fetchPayrollData();
        fetchPendingDeductions();
    }, [fetchPayrollData, fetchPendingDeductions]);

    const handleRunPayroll = async () => {
        const branchLabel = selectedBranchId === 'all' ? 'ALL branches' : selectedBranchName;
        if (!confirm(`Process payroll for ${branchLabel} — ${selectedMonth}/${selectedYear}?`)) return;
        setIsProcessing(true);
        try {
            const params: any = { month: Number(selectedMonth), year: Number(selectedYear) };
            if (selectedBranchId !== 'all') params.branch_id = Number(selectedBranchId);
            const res = await staffAPI.simplePayroll.generatePayroll(params);
            if (res.success) {
                toast.success('Payroll processed!', {
                    description: `Processed: ${res.data.processed_count}, Errors: ${res.data.error_count}`
                });
                fetchPayrollData();
            } else {
                toast.error('Failed to process payroll');
            }
        } catch (error: any) {
            toast.error(error.message || 'Processing failed');
        } finally {
            setIsProcessing(false);
        }
    };

    const filteredRecords = payrollRecords.filter(r => {
        const name = `${r.staff?.first_name} ${r.staff?.last_name}`.toLowerCase();
        return name.includes(searchQuery.toLowerCase());
    });

    const handleExportCSV = () => {
        if (filteredRecords.length === 0) { toast.error('No records to export'); return; }

        const monthName = new Date(0, Number(selectedMonth) - 1).toLocaleString('default', { month: 'long' });
        const totalBasicCSV    = filteredRecords.reduce((s, r) => s + Number(r.basic_salary), 0);
        const totalDedCSV      = filteredRecords.reduce((s, r) => s + Number(r.total_deductions || 0), 0);
        const totalNetCSV      = filteredRecords.reduce((s, r) => s + Number(r.net_pay), 0);
        const totalNssfCSV     = filteredRecords.reduce((s, r) => s + Number(r.nssf_deduction || r.nssf || 0), 0);
        const totalShifCSV     = filteredRecords.reduce((s, r) => s + Number(r.shif_deduction || 0), 0);
        const totalHousingCSV  = filteredRecords.reduce((s, r) => s + Number(r.housing_levy_deduction || r.housing_levy || 0), 0);
        const totalPayeCSV     = filteredRecords.reduce((s, r) => s + Number(r.paye || 0), 0);
        const totalCreditsCSV  = filteredRecords.reduce((s, r) => s + Number(r.total_credit_bills || 0), 0);
        const totalAdvancesCSV = filteredRecords.reduce((s, r) => s + Number(r.total_advances || 0), 0);
        const totalLoansCSV    = filteredRecords.reduce((s, r) => s + Number(r.loan_deduction || 0), 0);

        // Use tab-separated so Excel auto-sizes columns (no ###### truncation)
        const T = '\t';
        const kes = (v: number) => v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const row = (...cells: string[]) => cells.join(T);

        const COLS = 16; // total columns in data table
        const blank = row(...Array(COLS).fill(''));

        const lines: string[] = [
            // ── Branded header ──
            row('FAMOUSGATE HOTELS'),
            row('Bomet, Kenya'),
            row('Email: famousgateshotelsbmt@gmail.com', '', 'Tel: 0706 782 828'),
            blank,
            row('PAYROLL REPORT'),
            row(`Period:${T}${monthName} ${selectedYear}`),
            row(`Branch:${T}${selectedBranchName}`),
            row(`Generated:${T}${new Date().toLocaleString('en-KE')}`),
            blank,
            // ── Summary block ──
            row('SUMMARY'),
            row('Total Staff', String(filteredRecords.length)),
            row('Total Basic Salary (KES)', kes(totalBasicCSV)),
            row('Total Deductions (KES)', kes(totalDedCSV)),
            row('Total Net Pay (KES)', kes(totalNetCSV)),
            blank,
            blank,
            // ── Column headers ──
            row('#', 'Emp ID', 'Staff Name', 'Role', 'Branch',
                'Basic Salary (KES)', 'NSSF (KES)', 'SHIF (KES)', 'Housing Levy (KES)', 'PAYE (KES)',
                'Credit Bills (KES)', 'Advances (KES)', 'Loans (KES)',
                'Total Deductions (KES)', 'Net Pay (KES)', 'Status'),
            // ── Data rows ──
            ...filteredRecords.map((r, i) => row(
                String(i + 1),
                r.employee_id || r.staff?.employee_id || '—',
                `${r.staff?.first_name || ''} ${r.staff?.last_name || ''}`.trim(),
                r.staff?.role || '',
                r.branch_name || '',
                kes(Number(r.basic_salary)),
                kes(Number(r.nssf_deduction || r.nssf || 0)),
                kes(Number(r.shif_deduction || 0)),
                kes(Number(r.housing_levy_deduction || r.housing_levy || 0)),
                kes(Number(r.paye || 0)),
                kes(Number(r.total_credit_bills || 0)),
                kes(Number(r.total_advances || 0)),
                kes(Number(r.loan_deduction || 0)),
                kes(Number(r.total_deductions || 0)),
                kes(Number(r.net_pay)),
                (r.status || 'draft').toUpperCase(),
            )),
            // ── Totals row ──
            row('', '', 'TOTALS', '', '',
                kes(totalBasicCSV), kes(totalNssfCSV), kes(totalShifCSV),
                kes(totalHousingCSV), kes(totalPayeCSV), kes(totalCreditsCSV),
                kes(totalAdvancesCSV), kes(totalLoansCSV),
                kes(totalDedCSV), kes(totalNetCSV), ''),
            blank,
            blank,
            // ── Signature lines ──
            row('Prepared by:', '___________________________', '', '', '', '', '', '',
                'Approved by:', '___________________________'),
            row('Date:', new Date().toLocaleDateString('en-KE')),
        ];

        const bom = '\uFEFF'; // UTF-8 BOM so Excel opens correctly
        const tsv = lines.join('\r\n');
        const blob = new Blob([bom + tsv], { type: 'text/tab-separated-values;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const branchSuffix = selectedBranchId === 'all' ? 'All_Branches' : selectedBranchName.replace(/\s+/g, '_');
        a.href = url; a.download = `FG_Payroll_${branchSuffix}_${monthName}_${selectedYear}.tsv`;
        a.click(); URL.revokeObjectURL(url);
        toast.success('Export downloaded — open in Excel');
    };

    // Build the Python-ready employees array from already-loaded filteredRecords
    const buildEmployeesPayload = () => filteredRecords.map((r, i) => ({
        no:           i + 1,
        emp_id:       r.employee_id || r.staff?.employee_id || '—',
        name:         `${r.staff?.first_name || ''} ${r.staff?.last_name || ''}`.trim() || 'Unknown',
        phone:        r.staff?.phone_number || r.staff?.phone || '',
        role:         r.staff?.role || '—',
        branch:       r.branch_name || '—',
        basic_salary: Number(r.basic_salary || 0),
        nssf:         Number(r.nssf_deduction || r.nssf || 0),
        shif:         Number(r.shif_deduction || 0),
        housing_levy: Number(r.housing_levy_deduction || r.housing_levy || 0),
        paye:         Number(r.paye || 0),
        credit_bills: Number(r.total_credit_bills || 0),
        advances:     Number(r.total_advances || 0),
        loans:        Number(r.loan_deduction || 0),
    }));

    const handleExportPDF = async () => {
        if (filteredRecords.length === 0) { toast.error('No records to export'); return; }
        toast.info('Generating PDF...');
        try {
            const token = localStorage.getItem('token');
            const monthName = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1)
                .toLocaleString('en-US', { month: 'long', year: 'numeric' });

            const payload = {
                reportType: 'payroll',
                format: 'pdf',
                employees: buildEmployeesPayload(),
                period: monthName,
                branch: selectedBranchName,
                generated: new Date().toLocaleString('en-KE'),
                status: 'DRAFT',
                company_name: 'FAMOUSGATE HOTELS',
                company_address: 'Bomet, Kenya',
                company_email: 'famousgateshotelsbmt@gmail.com',
                company_phone: '0706 782 828',
            };

            const res = await fetch(`${API_URL}/api/reports/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const branchSuffix = selectedBranchId === 'all' ? 'All' : selectedBranchName.replace(/\s+/g, '_');
            a.href = url; a.download = `FG_Payroll_${branchSuffix}_${selectedMonth}_${selectedYear}.pdf`;
            a.click(); URL.revokeObjectURL(url);
            toast.success('PDF downloaded');
        } catch (e: any) {
            toast.error(e.message || 'PDF export failed');
        }
    };

    const handleExportXLSX = async () => {
        if (filteredRecords.length === 0) { toast.error('No records to export'); return; }
        toast.info('Generating Excel file...');
        try {
            const token = localStorage.getItem('token');
            const monthName = new Date(Number(selectedYear), Number(selectedMonth) - 1, 1)
                .toLocaleString('en-US', { month: 'long', year: 'numeric' });

            const payload = {
                reportType: 'payroll',
                format: 'xlsx',
                employees: buildEmployeesPayload(),
                period: monthName,
                branch: selectedBranchName,
                generated: new Date().toLocaleString('en-KE'),
                status: 'DRAFT',
                company_name: 'FAMOUSGATE HOTELS',
                company_address: 'Bomet, Kenya',
                company_email: 'famousgateshotelsbmt@gmail.com',
                company_phone: '0706 782 828',
            };

            const res = await fetch(`${API_URL}/api/reports/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const branchSuffix = selectedBranchId === 'all' ? 'All' : selectedBranchName.replace(/\s+/g, '_');
            a.href = url; a.download = `FG_Payroll_${branchSuffix}_${monthName.replace(' ', '_')}.xlsx`;
            a.click(); URL.revokeObjectURL(url);
            toast.success('Excel file downloaded');
        } catch (e: any) {
            toast.error(e.message || 'Excel export failed');
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-6 animate-ios-fade-in p-2">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Payroll Processing</h1>
                            <p className="text-stone-500 text-sm">
                                {selectedBranchId === 'all' ? 'All Branches' : selectedBranchName} — {new Date(0, Number(selectedMonth) - 1).toLocaleString('default', { month: 'long' })} {selectedYear}
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Branch Filter */}
                            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                                <SelectTrigger className="w-[160px] bg-white border-stone-200">
                                    <Building2 className="h-3.5 w-3.5 text-stone-400 mr-1 shrink-0" />
                                    <SelectValue placeholder="Branch" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Branches</SelectItem>
                                    {branches.map(b => (
                                        <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Month */}
                            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                                <SelectTrigger className="w-[120px] bg-white border-stone-200">
                                    <SelectValue placeholder="Month" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                        <SelectItem key={m} value={String(m)}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {/* Year */}
                            <Select value={selectedYear} onValueChange={setSelectedYear}>
                                <SelectTrigger className="w-[100px] bg-white border-stone-200">
                                    <SelectValue placeholder="Year" />
                                </SelectTrigger>
                                <SelectContent>
                                    {[2024, 2025, 2026, 2027].map(y => (
                                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <button onClick={handleRunPayroll} disabled={isProcessing}
                                className="px-4 py-2 rounded-full bg-stone-900 text-white text-sm font-bold hover:bg-black transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-stone-200 disabled:opacity-50">
                                {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                <span>Process Payroll</span>
                            </button>

                            <Link href="/dashboard/hr/adjustments"
                                className="px-4 py-2 rounded-full bg-stone-100 text-stone-600 text-sm font-bold hover:bg-stone-200 transition-all flex items-center gap-2 active:scale-95">
                                <ArrowDownUp className="h-4 w-4" />
                                <span>Adjustments</span>
                            </Link>

                            <button onClick={async () => {
                                if (!confirm(`Download payslips ZIP for ${selectedBranchName} — ${selectedMonth}/${selectedYear}?`)) return;
                                toast.info('Generating ZIP...');
                                const params: any = { month: Number(selectedMonth), year: Number(selectedYear) };
                                if (selectedBranchId !== 'all') params.branch_id = Number(selectedBranchId);
                                const res = await staffAPI.simplePayroll.downloadPayslipsZip(params);
                                if (res.success) toast.success('Download started');
                                else toast.error(res.message || 'Download failed');
                            }} className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-blue-200">
                                <ArrowUpRight className="h-4 w-4" />
                                <span>ZIP</span>
                            </button>

                            <button onClick={handleExportXLSX}
                                className="px-4 py-2 rounded-full bg-emerald-700 text-white text-sm font-bold hover:bg-emerald-800 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-emerald-200">
                                <FileText className="h-4 w-4" />
                                <span>Excel</span>
                            </button>

                            <button onClick={handleExportCSV}
                                className="px-4 py-2 rounded-full bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-teal-200">
                                <FileText className="h-4 w-4" />
                                <span>CSV</span>
                            </button>

                            <button onClick={handleExportPDF}
                                className="px-4 py-2 rounded-full bg-rose-600 text-white text-sm font-bold hover:bg-rose-700 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-rose-200">
                                <TrendingDown className="h-4 w-4" />
                                <span>PDF</span>
                            </button>

                            <button onClick={async () => {
                                if (!confirm(`Email payslips to staff in ${selectedBranchName} for ${selectedMonth}/${selectedYear}?`)) return;
                                toast.info('Sending emails...');
                                const params: any = { month: Number(selectedMonth), year: Number(selectedYear) };
                                if (selectedBranchId !== 'all') params.branch_id = Number(selectedBranchId);
                                const res = await staffAPI.simplePayroll.emailPayslips(params);
                                if (res.success) toast.success('Emails sent');
                                else toast.error(res.message || 'Email sending failed');
                            }} className="px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-emerald-200">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Email</span>
                            </button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
                            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Total Basic Salary</p>
                            <p className="text-2xl font-bold text-stone-900">KES {summary.totalBasic.toLocaleString()}</p>
                            <p className="text-[10px] text-stone-400 mt-1">{selectedBranchName}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <MinusCircle className="h-3 w-3" /> Total Deductions
                            </p>
                            <p className="text-2xl font-bold text-red-600">KES {summary.totalDeductions.toLocaleString()}</p>
                            <p className="text-[10px] text-stone-400 mt-1">NSSF, SHIF, Housing, PAYE, Credits, Loans</p>
                        </div>
                        <div className="bg-emerald-600 p-6 rounded-2xl shadow-xl shadow-emerald-200/50 text-white">
                            <p className="text-xs font-bold text-emerald-200 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Activity className="h-3 w-3" /> Net Pay
                            </p>
                            <p className="text-3xl font-bold">KES {summary.totalNet.toLocaleString()}</p>
                            <p className="text-[11px] text-emerald-100 mt-1 font-medium bg-emerald-700/30 px-2 py-0.5 rounded inline-block">
                                {summary.count} staff · {selectedBranchName}
                            </p>
                        </div>
                    </div>

                    {/* Pending Deductions */}
                    {(pendingDeductions.creditBills.length > 0 || pendingDeductions.advances.length > 0 || pendingDeductions.loans.length > 0) && (
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Info className="h-4 w-4 text-amber-600" />
                                <p className="text-sm font-bold text-amber-800">Pending Deductions — will be applied on next payroll run</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {pendingDeductions.creditBills.length > 0 && (
                                    <div className="bg-white rounded-xl p-3 border border-amber-100">
                                        <p className="text-xs font-bold text-stone-500 uppercase mb-2">Credit Bills ({pendingDeductions.creditBills.length})</p>
                                        {pendingDeductions.creditBills.slice(0, 5).map((b: any) => (
                                            <div key={b.id} className="flex justify-between text-xs py-1 border-b border-stone-50 last:border-0">
                                                <span className="text-stone-600 truncate max-w-[140px]">{b.staff?.first_name} {b.staff?.last_name} — {b.description?.slice(0, 20)}</span>
                                                <span className="font-bold text-red-500 ml-2">KES {Number(b.balance || b.amount).toLocaleString()}</span>
                                            </div>
                                        ))}
                                        {pendingDeductions.creditBills.length > 5 && <p className="text-xs text-stone-400 mt-1">+{pendingDeductions.creditBills.length - 5} more</p>}
                                    </div>
                                )}
                                {pendingDeductions.advances.length > 0 && (
                                    <div className="bg-white rounded-xl p-3 border border-amber-100">
                                        <p className="text-xs font-bold text-stone-500 uppercase mb-2">Approved Advances ({pendingDeductions.advances.length})</p>
                                        {pendingDeductions.advances.slice(0, 5).map((a: any) => (
                                            <div key={a.id} className="flex justify-between text-xs py-1 border-b border-stone-50 last:border-0">
                                                <span className="text-stone-600">{a.staff?.first_name} {a.staff?.last_name}</span>
                                                <span className="font-bold text-red-500">KES {Number(a.amount).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {pendingDeductions.loans.length > 0 && (
                                    <div className="bg-white rounded-xl p-3 border border-amber-100">
                                        <p className="text-xs font-bold text-stone-500 uppercase mb-2">Active Loans ({pendingDeductions.loans.length})</p>
                                        {pendingDeductions.loans.slice(0, 5).map((l: any) => (
                                            <div key={l.id} className="flex justify-between text-xs py-1 border-b border-stone-50 last:border-0">
                                                <span className="text-stone-600">{l.staff?.first_name} {l.staff?.last_name}</span>
                                                <span className="font-bold text-red-500">KES {Number(l.monthly_installment).toLocaleString()}/mo</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {pendingDeductions.creditBills.length === 0 && pendingDeductions.advances.length === 0 && pendingDeductions.loans.length === 0 && (
                        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 flex items-center gap-3">
                            <Info className="h-4 w-4 text-stone-400 shrink-0" />
                            <p className="text-sm text-stone-500">No pending deductions. Credit bills, advances, and loans will appear here before payroll is run.</p>
                            <Link href="/dashboard/branch-accounting/credit-bills" className="text-xs font-bold text-blue-600 hover:underline shrink-0">Add Credit Bill →</Link>
                        </div>
                    )}

                    {/* Table */}
                    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm flex flex-col min-h-[500px]">
                        <div className="p-4 border-b border-stone-50 flex items-center justify-between gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                                <input placeholder="Search staff..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
                                    value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            <div className="flex items-center gap-2 text-xs text-stone-400">
                                <Building2 className="h-3.5 w-3.5" />
                                <span>{selectedBranchName}</span>
                            </div>
                            <button onClick={fetchPayrollData} className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 hover:bg-stone-100 transition-colors">
                                <RefreshCw className={`h-4 w-4 text-stone-600 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-stone-50/50 border-b border-stone-100">
                                    <tr>
                                        <th className="px-4 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider">Staff Member</th>
                                        <th className="px-3 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider">Branch</th>
                                        <th className="px-3 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">Basic</th>
                                        <th className="px-3 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">NSSF</th>
                                        <th className="px-3 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">SHIF</th>
                                        <th className="px-3 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">Housing</th>
                                        <th className="px-3 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">PAYE</th>
                                        <th className="px-3 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">Credits</th>
                                        <th className="px-3 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">Advances</th>
                                        <th className="px-3 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">Loans</th>
                                        <th className="px-3 py-4 font-bold text-orange-500 text-xs uppercase tracking-wider text-right">Total Ded.</th>
                                        <th className="px-3 py-4 font-bold text-emerald-600 text-xs uppercase tracking-wider text-right">Net Pay</th>
                                        <th className="px-3 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr><td colSpan={13} className="p-8 text-center text-stone-400">Loading payroll data...</td></tr>
                                    ) : filteredRecords.length === 0 ? (
                                        <tr><td colSpan={13} className="p-8 text-center text-stone-400">No payroll records found for this period.</td></tr>
                                    ) : (
                                        filteredRecords.map((item) => (
                                            <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                                                <td className="px-4 py-4">
                                                    <p className="font-bold text-stone-900">{item.staff?.first_name} {item.staff?.last_name}</p>
                                                    <p className="text-xs text-stone-500 uppercase tracking-tight">{item.staff?.role}</p>
                                                </td>
                                                <td className="px-3 py-4">
                                                    <span className="text-xs text-stone-500 bg-stone-50 px-2 py-0.5 rounded-full border border-stone-100">{item.branch_name || '—'}</span>
                                                </td>
                                                <td className="px-3 py-4 text-right font-medium text-stone-600">{Number(item.basic_salary).toLocaleString()}</td>
                                                <td className="px-3 py-4 text-right font-medium text-red-500">{Number(item.nssf_deduction || item.nssf || 0).toLocaleString()}</td>
                                                <td className="px-3 py-4 text-right font-medium text-red-500">{Number(item.shif_deduction || 0).toLocaleString()}</td>
                                                <td className="px-3 py-4 text-right font-medium text-red-500">{Number(item.housing_levy_deduction || item.housing_levy || 0).toLocaleString()}</td>
                                                <td className="px-3 py-4 text-right font-medium text-red-500">{Number(item.paye || 0).toLocaleString()}</td>
                                                <td className="px-3 py-4 text-right font-medium text-red-500">{Number(item.total_credit_bills || 0).toLocaleString()}</td>
                                                <td className="px-3 py-4 text-right font-medium text-red-500">{Number(item.total_advances || 0).toLocaleString()}</td>
                                                <td className="px-3 py-4 text-right font-medium text-red-500">{Number(item.loan_deduction || 0).toLocaleString()}</td>
                                                <td className="px-3 py-4 text-right font-bold text-orange-500">{Number(item.total_deductions || 0).toLocaleString()}</td>
                                                <td className="px-3 py-4 text-right font-bold text-emerald-600 text-lg">{Number(item.net_pay).toLocaleString()}</td>
                                                <td className="px-3 py-4 text-center">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                                                        item.status === 'paid' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'
                                                    }`}>{item.status}</span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
