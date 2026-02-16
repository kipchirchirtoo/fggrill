'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffAPI } from '@/lib/api';
import {
    DollarSign,
    RefreshCw,
    Search,
    Calendar,
    ChevronRight,
    ArrowUpRight,
    CheckCircle2,
    AlertCircle,
    Play,
    Filter,
    CreditCard,
    FileText,
    TrendingDown,
    Activity,
    MinusCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function HRPayrollPage() {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Filters
    const [selectedMonth, setSelectedMonth] = useState<string>(String(new Date().getMonth() + 1));
    const [selectedYear, setSelectedYear] = useState<string>(String(new Date().getFullYear()));
    const [searchQuery, setSearchQuery] = useState('');

    const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
    const [summary, setSummary] = useState({
        count: 0,
        totalBasic: 0,
        totalDeductions: 0,
        totalNet: 0
    });

    const fetchPayrollData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await staffAPI.simplePayroll.getPayrollRecords({
                month: Number(selectedMonth),
                year: Number(selectedYear)
            });

            if (res.success) {
                const records = res.data || [];
                setPayrollRecords(records);

                // Calculate summary
                const totalBasic = records.reduce((sum: number, r: any) => sum + Number(r.basic_salary), 0);
                const totalDeductions = records.reduce((sum: number, r: any) => sum + Number(r.total_deductions), 0);
                const totalNet = records.reduce((sum: number, r: any) => sum + Number(r.net_pay), 0);

                setSummary({
                    count: records.length,
                    totalBasic,
                    totalDeductions,
                    totalNet
                });
            }
        } catch (error) {
            console.error('Error fetching payroll:', error);
            toast.error('Failed to load payroll records');
        } finally {
            setIsLoading(false);
        }
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        fetchPayrollData();
    }, [fetchPayrollData]);

    const handleRunPayroll = async () => {
        if (!confirm(`Are you sure you want to process payroll for ${selectedMonth}/${selectedYear}? This will calculate deductions and net pay for all active staff.`)) {
            return;
        }

        setIsProcessing(true);
        try {
            const res = await staffAPI.simplePayroll.generatePayroll({
                month: Number(selectedMonth),
                year: Number(selectedYear)
            });

            if (res.success) {
                toast.success(`Payroll processed successfully!`, {
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
        const staffName = `${r.staff?.first_name} ${r.staff?.last_name}`.toLowerCase();
        return staffName.includes(searchQuery.toLowerCase());
    });

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-6 animate-ios-fade-in p-2">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Payroll Processing</h1>
                            <p className="text-stone-500 text-sm">Simplified Payroll System</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Month/Year Selectors */}
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

                            <button
                                onClick={handleRunPayroll}
                                disabled={isProcessing}
                                className="px-5 py-2 rounded-full bg-stone-900 text-white text-sm font-bold hover:bg-black transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-stone-200 disabled:opacity-50"
                            >
                                {isProcessing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                <span>Process Payroll</span>
                            </button>

                            <button
                                onClick={async () => {
                                    if (!confirm(`Generate and download payslips ZIP for ${selectedMonth}/${selectedYear}?`)) return;
                                    toast.info('Generating ZIP...');
                                    const res = await staffAPI.simplePayroll.downloadPayslipsZip({ month: Number(selectedMonth), year: Number(selectedYear) });
                                    if (res.success) toast.success('Download started');
                                    else toast.error(res.message || 'Download failed');
                                }}
                                className="px-5 py-2 rounded-full bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-blue-200"
                            >
                                <ArrowUpRight className="h-4 w-4" />
                                <span>Download Zip</span>
                            </button>

                            <button
                                onClick={async () => {
                                    if (!confirm(`Email payslips to ALL staff for ${selectedMonth}/${selectedYear}?`)) return;
                                    toast.info('Sending emails...');
                                    const res = await staffAPI.simplePayroll.emailPayslips({ month: Number(selectedMonth), year: Number(selectedYear) });
                                    if (res.success) toast.success('Emails sent successfully');
                                    else toast.error(res.message || 'Email sending failed');
                                }}
                                className="px-5 py-2 rounded-full bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-emerald-200"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                <span>Email Payslips</span>
                            </button>
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
                            <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Total Basic Salary</p>
                            <p className="text-2xl font-bold text-stone-900">KES {summary.totalBasic.toLocaleString()}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl border border-stone-100 shadow-sm">
                            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <MinusCircle className="h-3 w-3" />
                                Total Deductions
                            </p>
                            <p className="text-2xl font-bold text-red-600">KES {summary.totalDeductions.toLocaleString()}</p>
                            <p className="text-[10px] text-stone-400 mt-1">Includes Credits, Advances, Loans</p>
                        </div>
                        <div className="bg-emerald-600 p-6 rounded-2xl shadow-xl shadow-emerald-200/50 text-white">
                            <p className="text-xs font-bold text-emerald-200 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <Activity className="h-3 w-3" />
                                Net Pay
                            </p>
                            <p className="text-3xl font-bold">KES {summary.totalNet.toLocaleString()}</p>
                            <p className="text-[11px] text-emerald-100 mt-1 font-medium bg-emerald-700/30 px-2 py-0.5 rounded inline-block">
                                count: {summary.count} staff
                            </p>
                        </div>
                    </div>

                    {/* Filters & Search */}
                    <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm flex flex-col min-h-[500px]">
                        <div className="p-4 border-b border-stone-50 flex items-center justify-between gap-4">
                            <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                                <input
                                    placeholder="Search staff..."
                                    className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-100 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <button onClick={fetchPayrollData} className="p-2.5 bg-stone-50 rounded-xl border border-stone-100 hover:bg-stone-100 transition-colors">
                                <RefreshCw className={`h-4 w-4 text-stone-600 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-stone-50/50 border-b border-stone-100">
                                    <tr>
                                        <th className="px-6 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider">Staff Member</th>
                                        <th className="px-6 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">Basic Salary</th>
                                        <th className="px-6 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">Credit Bills</th>
                                        <th className="px-6 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">Advances</th>
                                        <th className="px-6 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-right">Loans</th>
                                        <th className="px-6 py-4 font-bold text-emerald-600 text-xs uppercase tracking-wider text-right">Net Pay</th>
                                        <th className="px-6 py-4 font-bold text-stone-400 text-xs uppercase tracking-wider text-center">Status</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        <tr><td colSpan={8} className="p-8 text-center text-stone-400">Loading payroll data...</td></tr>
                                    ) : filteredRecords.length === 0 ? (
                                        <tr><td colSpan={8} className="p-8 text-center text-stone-400">No payroll records found for this period.</td></tr>
                                    ) : (
                                        filteredRecords.map((item) => (
                                            <tr key={item.id} className="hover:bg-stone-50/50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-stone-900">{item.staff?.first_name} {item.staff?.last_name}</p>
                                                    <p className="text-xs text-stone-500 uppercase tracking-tight">{item.staff?.role}</p>
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-stone-600">
                                                    {Number(item.basic_salary).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-red-500">
                                                    {Number(item.total_credit_bills) > 0 && '-'}
                                                    {Number(item.total_credit_bills).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-red-500">
                                                    {Number(item.total_advances) > 0 && '-'}
                                                    {Number(item.total_advances).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-red-500">
                                                    {Number(item.total_loan_deduction) > 0 && '-'}
                                                    {Number(item.total_loan_deduction).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-emerald-600 text-lg">
                                                    {Number(item.net_pay).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${item.status === 'paid' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                                                        'bg-amber-50 border-amber-100 text-amber-600'
                                                        }`}>
                                                        {item.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-stone-300 hover:text-stone-900 transition-colors">
                                                        <ChevronRight className="h-5 w-5" />
                                                    </button>
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
