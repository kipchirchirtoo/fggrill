'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { staffAPI, payrollAPI, systemAPI } from '@/lib/api';
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
    Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Link from 'next/link';

interface PayrollRecord {
    id: string;
    employeeId: string;
    employeeName: string;
    position: string;
    department: string;
    payPeriodStart: string;
    payPeriodEnd: string;
    basicSalary: number;
    grossPay: number;
    totalDeductions: number;
    netPay: number;
    paymentStatus: 'pending' | 'processing' | 'completed' | 'failed';
    approvalStatus: 'draft' | 'reviewed' | 'approved' | 'paid';
}

export default function HRPayrollPage() {
    const { user } = useAuth();
    const [records, setRecords] = useState<PayrollRecord[]>([]);
    const [summary, setSummary] = useState({
        totalGross: 0,
        totalDeductions: 0,
        totalNet: 0,
        count: 0
    });
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [dateFilter, setDateFilter] = useState({
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        end: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
    });
    const [calcModalOpen, setCalcModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    const [workflowState, setWorkflowState] = useState({
        attendanceConfirmed: false,
        leaveLocked: false,
        currentStage: 'setup' // setup -> confirmed -> locked -> drafted -> reviewed -> approved -> paid
    });
    const [calcData, setCalcData] = useState({
        employeeId: '',
        absencePenalties: 0,
        customDeductions: 0,
        customAllowances: 0,
        unpaidLeaveDeductionOverride: 0,
        notes: ''
    });

    const fetchPayrollData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await payrollAPI.getSummary({
                startDate: dateFilter.start,
                endDate: dateFilter.end
            });

            if (res.success) {
                setRecords(res.data.payrollRecords || []);
                setSummary({
                    totalGross: res.data.totalGrossPay || 0,
                    totalDeductions: res.data.totalDeductions || 0,
                    totalNet: res.data.totalNetPay || 0,
                    count: res.data.totalEmployees || 0
                });
            }
        } catch (error) {
            console.error('Error fetching payroll:', error);
            toast.error('Failed to load payroll records');
        } finally {
            setIsLoading(false);
        }
    }, [dateFilter]);

    useEffect(() => {
        fetchPayrollData();
    }, [fetchPayrollData]);

    const filteredRecords = records.filter(r =>
        r.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.department.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleBulkPay = async () => {
        const pendingIds = records
            .filter(r => r.paymentStatus === 'pending')
            .map(r => r.id);

        if (pendingIds.length === 0) {
            toast.info('No pending payroll records to pay');
            return;
        }

        if (!confirm(`Are you sure you want to process payments for ${pendingIds.length} employees?`)) return;

        setIsProcessing(true);
        try {
            const res = await payrollAPI.bulkPay({
                payrollRecordIds: pendingIds,
                paymentMethod: 'mpesa' // Default
            });

            if (res.success) {
                toast.success('Bulk payment initiated successfully');
                fetchPayrollData();
            } else {
                toast.error(res.message || 'Failed to process bulk payment');
            }
        } catch (error) {
            toast.error('An error occurred during payment processing');
        } finally {
            setIsProcessing(false);
        }
    };

    const statusColors = {
        pending: 'bg-stone-100 text-stone-600',
        processing: 'bg-blue-100 text-blue-600',
        completed: 'bg-emerald-100 text-emerald-600',
        failed: 'bg-red-100 text-red-600'
    };

    const approvalStatusColors = {
        draft: 'bg-stone-100 text-stone-500',
        reviewed: 'bg-indigo-100 text-indigo-600',
        approved: 'bg-amber-100 text-amber-600',
        paid: 'bg-emerald-100 text-emerald-600'
    };

    const handleConfirmAttendance = async () => {
        setIsProcessing(true);
        try {
            const res = await staffAPI.batchConfirmAttendance({
                startDate: dateFilter.start,
                endDate: dateFilter.end
            });
            if (res.success) {
                toast.success('Attendance records confirmed for this period');
                setWorkflowState(prev => ({ ...prev, attendanceConfirmed: true }));
            }
        } catch (error) {
            toast.error('Failed to confirm attendance');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleLockLeave = async () => {
        setIsProcessing(true);
        try {
            const res = await staffAPI.batchLockLeave({
                startDate: dateFilter.start,
                endDate: dateFilter.end
            });
            if (res.success) {
                toast.success('Leave records locked for this period');
                setWorkflowState(prev => ({ ...prev, leaveLocked: true }));
            }
        } catch (error) {
            toast.error('Failed to lock leave records');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReviewAll = async () => {
        setIsProcessing(true);
        try {
            const draftRecords = records.filter(r => r.approvalStatus === 'draft');
            for (const record of draftRecords) {
                await payrollAPI.review(record.id);
            }
            toast.success('All records transitioned to Reviewed status');
            fetchPayrollData();
        } catch (error) {
            toast.error('Failed to review records');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleApproveAll = async () => {
        setIsProcessing(true);
        try {
            const reviewedRecords = records.filter(r => r.approvalStatus === 'reviewed');
            for (const record of reviewedRecords) {
                await payrollAPI.approve(record.id);
            }
            toast.success('All records Approved');
            fetchPayrollData();
        } catch (error) {
            toast.error('Failed to approve records');
        } finally {
            setIsProcessing(false);
        }
    };

    // Determine current stage based on records
    useEffect(() => {
        if (records.length > 0) {
            if (records.every(r => r.approvalStatus === 'paid')) setWorkflowState(ps => ({ ...ps, currentStage: 'paid' }));
            else if (records.every(r => r.approvalStatus === 'approved')) setWorkflowState(ps => ({ ...ps, currentStage: 'approved' }));
            else if (records.every(r => r.approvalStatus === 'reviewed')) setWorkflowState(ps => ({ ...ps, currentStage: 'reviewed' }));
            else setWorkflowState(ps => ({ ...ps, currentStage: 'drafted' }));
        } else {
            setWorkflowState(ps => ({ ...ps, currentStage: 'setup' }));
        }
    }, [records]);

    const handleCalculate = async () => {
        setIsProcessing(true);
        try {
            const res = await payrollAPI.calculate({
                startDate: dateFilter.start,
                endDate: dateFilter.end,
                ...calcData
            });
            if (res.success) {
                toast.success('Payroll calculated for period');
                setCalcModalOpen(false);
                fetchPayrollData();
            }
        } catch (error: any) {
            toast.error(error.message || 'Calculation failed');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-8 animate-ios-fade-in">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                        <div>
                            <h1 className="text-[28px] font-bold text-stone-900 tracking-tight font-sf-pro-display">Payroll Processing</h1>
                            <p className="text-stone-500 font-medium">Cycle calculation and disbursement management</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={fetchPayrollData}
                                disabled={isLoading}
                                className="px-4 py-2 rounded-full border border-stone-200 bg-white text-stone-600 text-sm font-bold hover:bg-stone-50 transition-all flex items-center gap-2 active:scale-95 shadow-sm"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Sync Ledger</span>
                            </button>
                            <button
                                onClick={() => setCalcModalOpen(true)}
                                className="px-4 py-2 rounded-full bg-stone-900 text-white text-sm font-bold hover:bg-black transition-all flex items-center gap-2 active:scale-95 shadow-lg shadow-stone-200"
                            >
                                <Play className="h-4 w-4" />
                                <span>Run Calculation</span>
                            </button>
                        </div>
                    </div>

                    {/* Workflow Stepper */}
                    <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-[14px] font-bold text-stone-900 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="h-4 w-4 text-stone-400" />
                                <span>Verification Workflow</span>
                            </h2>
                            <IOSBadge variant="outline" className="rounded-full px-4 py-1">
                                Stage: {workflowState.currentStage.toUpperCase()}
                            </IOSBadge>
                        </div>

                        <div className="relative flex justify-between">
                            {/* Lines */}
                            <div className="absolute top-5 left-0 w-full h-0.5 bg-stone-100 -z-0" />
                            <div
                                className="absolute top-5 left-0 h-0.5 bg-stone-900 transition-all duration-700 -z-0"
                                style={{
                                    width: workflowState.currentStage === 'setup' ? '0%' :
                                        workflowState.currentStage === 'drafted' ? '40%' :
                                            workflowState.currentStage === 'reviewed' ? '60%' :
                                                workflowState.currentStage === 'approved' ? '80%' :
                                                    workflowState.currentStage === 'paid' ? '100%' : '20%'
                                }}
                            />

                            {/* Steps */}
                            <div className="flex flex-col items-center gap-3 relative z-10 w-1/6">
                                <div onClick={() => !workflowState.attendanceConfirmed && handleConfirmAttendance()} className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer ${workflowState.attendanceConfirmed ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-300'}`}>
                                    {workflowState.attendanceConfirmed ? <CheckCircle2 className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-tighter text-center ${workflowState.attendanceConfirmed ? 'text-stone-900' : 'text-stone-400'}`}>Confirm<br />Attendance</span>
                            </div>

                            <div className="flex flex-col items-center gap-3 relative z-10 w-1/6">
                                <div onClick={() => workflowState.attendanceConfirmed && !workflowState.leaveLocked && handleLockLeave()} className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer ${workflowState.leaveLocked ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-300'} ${!workflowState.attendanceConfirmed && 'opacity-50 cursor-not-allowed'}`}>
                                    {workflowState.leaveLocked ? <CheckCircle2 className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-tighter text-center ${workflowState.leaveLocked ? 'text-stone-900' : 'text-stone-400'}`}>Lock<br />Leaves</span>
                            </div>

                            <div className="flex flex-col items-center gap-3 relative z-10 w-1/6">
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all ${['drafted', 'reviewed', 'approved', 'paid'].includes(workflowState.currentStage) ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-300'}`}>
                                    <Play className="h-5 w-5" />
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-tighter text-center ${['drafted', 'reviewed', 'approved', 'paid'].includes(workflowState.currentStage) ? 'text-stone-900' : 'text-stone-400'}`}>Generate<br />Payroll</span>
                            </div>

                            <div className="flex flex-col items-center gap-3 relative z-10 w-1/6">
                                <div onClick={() => workflowState.currentStage === 'drafted' && handleReviewAll()} className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer ${['reviewed', 'approved', 'paid'].includes(workflowState.currentStage) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-stone-200 text-stone-300'} ${workflowState.currentStage !== 'drafted' && workflowState.currentStage !== 'reviewed' && 'opacity-50 cursor-not-allowed'}`}>
                                    <Search className="h-5 w-5" />
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-tighter text-center ${['reviewed', 'approved', 'paid'].includes(workflowState.currentStage) ? 'text-indigo-600' : 'text-stone-400'}`}>Audit<br />Review</span>
                            </div>

                            <div className="flex flex-col items-center gap-3 relative z-10 w-1/6">
                                <div onClick={() => workflowState.currentStage === 'reviewed' && handleApproveAll()} className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer ${['approved', 'paid'].includes(workflowState.currentStage) ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-stone-200 text-stone-300'} ${workflowState.currentStage !== 'reviewed' && workflowState.currentStage !== 'approved' && 'opacity-50 cursor-not-allowed'}`}>
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-tighter text-center ${['approved', 'paid'].includes(workflowState.currentStage) ? 'text-amber-600' : 'text-stone-400'}`}>Director<br />Approval</span>
                            </div>

                            <div className="flex flex-col items-center gap-3 relative z-10 w-1/6">
                                <div onClick={() => workflowState.currentStage === 'approved' && handleBulkPay()} className={`h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all cursor-pointer ${workflowState.currentStage === 'paid' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-stone-200 text-stone-300'} ${workflowState.currentStage !== 'approved' && 'opacity-50 cursor-not-allowed'}`}>
                                    <CreditCard className="h-5 w-5" />
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-tighter text-center ${workflowState.currentStage === 'paid' ? 'text-emerald-600' : 'text-stone-400'}`}>Disburse<br />Payment</span>
                            </div>
                        </div>
                    </div>

                    {/* Summary Integration */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <div className="lg:col-span-1 space-y-4">
                            <div className="bg-white rounded-2xl border border-stone-100 p-5 shadow-sm">
                                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Calendar className="h-3 w-3" />
                                    <span>Active Window</span>
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">Start Period</label>
                                        <input
                                            type="date"
                                            value={dateFilter.start}
                                            onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                                            className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-[13px] font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">End Period</label>
                                        <input
                                            type="date"
                                            value={dateFilter.end}
                                            onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                                            className="w-full px-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-[13px] font-bold text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-400 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-emerald-600 rounded-2xl p-6 text-white shadow-xl shadow-emerald-200/50 flex flex-col justify-between min-h-[160px]">
                                <div className="flex justify-between items-start">
                                    <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest leading-none">Net Liability</p>
                                    <Activity className="h-5 w-5 text-emerald-300" />
                                </div>
                                <div>
                                    <p className="text-3xl font-bold tracking-tight">
                                        <span className="text-emerald-200 text-xl mr-1 font-medium">KES</span>
                                        {summary.totalNet.toLocaleString()}
                                    </p>
                                    <div className="mt-4 pt-4 border-t border-white/20 flex justify-between text-[11px] font-bold uppercase tracking-tighter text-emerald-100">
                                        <span>Gross: {summary.totalGross.toLocaleString()}</span>
                                        <span>{summary.count} Staff</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-3">
                            <div className="bg-white rounded-2xl border border-stone-100 overflow-hidden shadow-sm h-full flex flex-col">
                                <div className="p-4 border-b border-stone-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div className="relative w-full sm:w-auto sm:flex-1">
                                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                                        <input
                                            placeholder="Find personnel or department..."
                                            className="w-full sm:max-w-md pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-100 rounded-xl text-[13px] text-stone-800 focus:outline-none focus:ring-2 focus:ring-stone-900/5 focus:border-stone-200 transition-all placeholder:text-stone-400 font-medium"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 text-stone-400 text-[11px] font-bold uppercase tracking-widest px-3 py-1.5 bg-stone-50 rounded-lg border border-stone-100">
                                        <Filter className="h-3 w-3" />
                                        <span>{filteredRecords.length} Entries Found</span>
                                    </div>
                                </div>

                                <div className="overflow-x-auto flex-1">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-stone-50/30 border-b border-stone-100">
                                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Personnel</th>
                                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Cycle Window</th>
                                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Computed Net</th>
                                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-center">Audit Status</th>
                                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Ledger</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {isLoading ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-20 text-center">
                                                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-200 mb-2" />
                                                        <p className="text-stone-400 text-[13px] font-medium">Synchronizing ledger...</p>
                                                    </td>
                                                </tr>
                                            ) : filteredRecords.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-6 py-20 text-center">
                                                        <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-stone-100">
                                                            <Search className="h-8 w-8 text-stone-200" />
                                                        </div>
                                                        <h3 className="text-sm font-bold text-stone-900">No records discovered</h3>
                                                        <p className="text-stone-400 text-[12px] mt-1 font-medium">Adjust your criteria or period window</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredRecords.map((record) => (
                                                    <tr key={record.id} className="hover:bg-stone-50/30 transition-all group">
                                                        <td className="px-6 py-4">
                                                            <p className="text-[13px] font-bold text-stone-900 leading-none">{record.employeeName}</p>
                                                            <p className="text-[10px] text-stone-400 font-bold mt-1.5 uppercase tracking-tighter">{record.position} • {record.department}</p>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-center gap-1.5 px-3 py-1 rounded bg-stone-50 border border-stone-100 w-fit mx-auto">
                                                                <Calendar className="h-3 w-3 text-stone-400" />
                                                                <span className="text-[11px] font-bold text-stone-600 uppercase tracking-tighter">
                                                                    {new Date(record.payPeriodStart).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })} - {new Date(record.payPeriodEnd).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <p className="text-[13px] font-bold text-stone-900 leading-none">{record.netPay.toLocaleString()} <span className="text-[10px] text-stone-400 font-medium ml-0.5">KES</span></p>
                                                            <p className="text-[10px] text-stone-400 font-bold mt-1.5 uppercase tracking-tighter italic">Gross: {record.grossPay.toLocaleString()}</p>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex flex-col items-center gap-1.5">
                                                                <div className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border border-current/10 ${approvalStatusColors[record.approvalStatus || 'draft']}`}>
                                                                    {record.approvalStatus || 'draft'}
                                                                </div>
                                                                <div className={`text-[8px] font-bold uppercase tracking-tighter ${statusColors[record.paymentStatus]}`}>
                                                                    Payment: {record.paymentStatus}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <Link href={`/dashboard/hr/payroll/${record.id}`}>
                                                                <button className="h-8 w-8 flex items-center justify-center rounded-lg bg-white border border-stone-200 text-stone-400 hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all active:scale-95 ml-auto">
                                                                    <ChevronRight className="h-4 w-4" />
                                                                </button>
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions Footer */}
                    {!isLoading && records.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm border-l-4 border-l-stone-900 flex items-center justify-between group transition-all hover:border-stone-200">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-center shadow-sm text-stone-600 group-hover:scale-110 transition-transform">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h4 className="text-[14px] font-bold text-stone-900 leading-tight">Generate Audit Report</h4>
                                        <p className="text-[12px] text-stone-400 mt-1 font-medium">Export period summary as an audit-ready CSV</p>
                                    </div>
                                </div>
                                <button className="px-4 py-2 rounded-xl bg-stone-900 text-white text-[12px] font-bold hover:bg-black transition-all active:scale-95">
                                    Export CSV
                                </button>
                            </div>

                            <div className="bg-white rounded-2xl border border-stone-100 p-6 shadow-sm border-l-4 border-l-blue-600 flex items-center justify-between group transition-all hover:border-stone-200">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                                        <Activity className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h4 className="text-[14px] font-bold text-stone-900 leading-tight">Recalculate Cycle</h4>
                                        <p className="text-[12px] text-stone-400 mt-1 font-medium">Sync latest contract baseline for this window</p>
                                    </div>
                                </div>
                                <button className="px-4 py-2 rounded-xl border border-stone-200 bg-white text-stone-600 text-[12px] font-bold hover:bg-stone-50 transition-all active:scale-95">
                                    Refresh Calc
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Calculation Modal */}
                    <Dialog open={calcModalOpen} onOpenChange={setCalcModalOpen}>
                        <DialogContent className="max-w-[450px] bg-white p-0 overflow-hidden rounded-ios-3xl border-none shadow-2xl">
                            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                                <h3 className="text-lg font-bold text-stone-900">Run Payroll Engine</h3>
                                <button onClick={() => setCalcModalOpen(false)} className="text-[#007AFF] font-semibold text-sm">Close</button>
                            </div>

                            <div className="p-6 space-y-6">
                                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl">
                                    <p className="text-[11px] text-blue-600 font-bold uppercase tracking-wider mb-1">Calculation Window</p>
                                    <p className="text-sm font-bold text-blue-900">
                                        {new Date(dateFilter.start).toLocaleDateString()} - {new Date(dateFilter.end).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Absence Penalties</label>
                                        <input
                                            type="number"
                                            value={calcData.absencePenalties}
                                            onChange={(e) => setCalcData({ ...calcData, absencePenalties: Number(e.target.value) })}
                                            className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Unpaid Leave Overr.</label>
                                        <input
                                            type="number"
                                            value={calcData.unpaidLeaveDeductionOverride}
                                            onChange={(e) => setCalcData({ ...calcData, unpaidLeaveDeductionOverride: Number(e.target.value) })}
                                            className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Custom Allowances</label>
                                        <input
                                            type="number"
                                            value={calcData.customAllowances}
                                            onChange={(e) => setCalcData({ ...calcData, customAllowances: Number(e.target.value) })}
                                            className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all text-emerald-600"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Custom Deductions</label>
                                        <input
                                            type="number"
                                            value={calcData.customDeductions}
                                            onChange={(e) => setCalcData({ ...calcData, customDeductions: Number(e.target.value) })}
                                            className="w-full h-11 px-4 bg-stone-50 border border-stone-200 rounded-xl font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all text-red-600"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest ml-1">Audit Notes / Adjustments Reason</label>
                                    <textarea
                                        value={calcData.notes}
                                        onChange={(e) => setCalcData({ ...calcData, notes: e.target.value })}
                                        className="w-full p-4 bg-stone-50 border border-stone-200 rounded-2xl text-[13px] text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900/5 transition-all min-h-[80px]"
                                        placeholder="Explain any manual adjustments..."
                                    />
                                </div>

                                <button
                                    onClick={handleCalculate}
                                    disabled={isProcessing}
                                    className="w-full h-12 bg-stone-900 text-white rounded-xl font-bold text-[14px] hover:bg-black transition-all active:scale-95 shadow-xl shadow-stone-200 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isProcessing ? (
                                        <>
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                            <span>Processing Engine...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Play className="h-4 w-4" />
                                            <span>Start Period Calculation</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
