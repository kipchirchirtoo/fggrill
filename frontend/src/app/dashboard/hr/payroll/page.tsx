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
    FileText
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

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

    return (
        <ProtectedRoute allowedRoles={[UserRole.HR_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Payroll Processing</h1>
                            <p className="text-stone-500 mt-0.5">Calculate and process employee salaries</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchPayrollData} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                                Refresh
                            </IOSButton>
                            <IOSButton
                                onClick={handleBulkPay}
                                disabled={isProcessing || isLoading || records.every(r => r.paymentStatus !== 'pending')}
                                leftIcon={<CreditCard />}
                            >
                                {isProcessing ? 'Processing...' : 'Bulk Payment'}
                            </IOSButton>
                        </div>
                    </div>

                    {/* Filters & Summary */}
                    <div className="grid lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-1 space-y-4">
                            <IOSCard className="p-4">
                                <h3 className="text-[12px] font-bold text-stone-400 uppercase tracking-widest mb-4">Pay Period</h3>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-xs text-stone-500 mb-1 block">Start Date</label>
                                        <Input
                                            type="date"
                                            value={dateFilter.start}
                                            onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                                            className="h-10 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-stone-500 mb-1 block">End Date</label>
                                        <Input
                                            type="date"
                                            value={dateFilter.end}
                                            onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                                            className="h-10 text-sm"
                                        />
                                    </div>
                                </div>
                            </IOSCard>

                            <IOSCard className="p-4 bg-emerald-600 text-white border-none shadow-emerald-200">
                                <div className="flex items-center gap-2 opacity-80 mb-1">
                                    <DollarSign className="h-4 w-4" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Net Pay</span>
                                </div>
                                <p className="text-2xl font-bold tracking-tight">
                                    KES {summary.totalNet.toLocaleString()}
                                </p>
                                <div className="mt-3 pt-3 border-t border-white/20 flex justify-between text-[11px] font-medium opacity-80">
                                    <span>Gross: KES {summary.totalGross.toLocaleString()}</span>
                                    <span>{summary.count} Staff</span>
                                </div>
                            </IOSCard>
                        </div>

                        <div className="lg:col-span-3">
                            <IOSCard className="h-full">
                                <div className="p-4 border-b border-stone-100 flex items-center justify-between gap-4">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                        <Input
                                            placeholder="Search employees or departments..."
                                            className="pl-9 h-11 bg-stone-50 border-stone-100"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 text-stone-400 text-sm font-medium">
                                        <Filter className="h-4 w-4" />
                                        <span>{filteredRecords.length} Records</span>
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-stone-50/50">
                                                <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Employee</th>
                                                <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Period</th>
                                                <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider text-right">Gross Pay</th>
                                                <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider text-right">Net Pay</th>
                                                <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">Status</th>
                                                <th className="px-5 py-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-50">
                                            {isLoading ? (
                                                <tr>
                                                    <td colSpan={6} className="px-5 py-20 text-center">
                                                        <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-200 mb-2" />
                                                        <p className="text-stone-400 text-sm">Loading payroll data...</p>
                                                    </td>
                                                </tr>
                                            ) : filteredRecords.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-5 py-20 text-center">
                                                        <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-stone-100">
                                                            <Search className="h-8 w-8 text-stone-300" />
                                                        </div>
                                                        <h3 className="text-lg font-medium text-stone-900">No records found</h3>
                                                        <p className="text-stone-500 mt-1">Try another search or date range</p>
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredRecords.map((record) => (
                                                    <tr key={record.id} className="hover:bg-stone-50/50 transition-colors group">
                                                        <td className="px-5 py-4">
                                                            <p className="text-sm font-bold text-stone-900">{record.employeeName}</p>
                                                            <p className="text-[11px] text-stone-500 font-medium uppercase tracking-tight">{record.position} • {record.department}</p>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <div className="flex items-center gap-1.5 text-stone-600">
                                                                <Calendar className="h-3.5 w-3.5" />
                                                                <span className="text-[12px] font-medium">
                                                                    {new Date(record.payPeriodStart).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })} - {new Date(record.payPeriodEnd).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-4 text-right">
                                                            <p className="text-sm font-medium text-stone-500">KES {record.grossPay.toLocaleString()}</p>
                                                        </td>
                                                        <td className="px-5 py-4 text-right">
                                                            <p className="text-sm font-bold text-stone-900">KES {record.netPay.toLocaleString()}</p>
                                                        </td>
                                                        <td className="px-5 py-4">
                                                            <IOSBadge className={statusColors[record.paymentStatus]}>
                                                                {record.paymentStatus}
                                                            </IOSBadge>
                                                        </td>
                                                        <td className="px-5 py-4 text-right">
                                                            <Link href={`/dashboard/hr/payroll/${record.id}`}>
                                                                <button className="p-2 rounded-lg hover:bg-white border border-transparent hover:border-stone-100 transition-all text-stone-400 hover:text-stone-900">
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
                            </IOSCard>
                        </div>
                    </div>

                    {/* Quick Actions Footer */}
                    {!isLoading && records.length > 0 && (
                        <div className="flex flex-wrap gap-4">
                            <IOSCard className="flex-1 min-w-[300px] p-5 border-l-4 border-l-stone-900 bg-stone-50">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-stone-100">
                                        <FileText className="h-5 w-5 text-stone-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-[14px] font-bold text-stone-900 leading-tight">Generate Payroll Report</h4>
                                        <p className="text-[12px] text-stone-500 mt-0.5">Download a detailed CSV summary for this period</p>
                                    </div>
                                    <IOSButton size="sm" variant="secondary">Export CSV</IOSButton>
                                </div>
                            </IOSCard>

                            <IOSCard className="flex-1 min-w-[300px] p-5 border-l-4 border-l-blue-600 bg-blue-50/30">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-stone-100">
                                        <ArrowUpRight className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-[14px] font-bold text-stone-900 leading-tight">Recalculate All</h4>
                                        <p className="text-[12px] text-stone-500 mt-0.5">Freshly calculate all salaries for the active period</p>
                                    </div>
                                    <IOSButton size="sm" variant="secondary">Recalculate</IOSButton>
                                </div>
                            </IOSCard>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
