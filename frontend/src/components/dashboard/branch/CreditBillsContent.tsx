'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { financeAPI, api, cashierAPI } from '@/lib/api';
import {
    CreditCard, Wallet, Calendar, User, Search,
    Plus, Filter, Download, ChevronRight, CheckCircle,
    XCircle, Clock, AlertTriangle, FileText, RefreshCw,
    DollarSign, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { BillDetailsModal } from './BillDetailsModal';
import { StaffDropdownModal } from '@/components/common/StaffDropdownModal';
import { StaffMember } from '@/lib/api/types';

interface CreditBillsContentProps {
    branchId: number | null;
    isAuditor?: boolean;
}

export function CreditBillsContent({ branchId, isAuditor = false }: CreditBillsContentProps) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('staff_credit');

    // Modal State
    const [showModal, setShowModal] = useState(false);

    // Lists state

    // State for lists
    const [creditBills, setCreditBills] = useState<any[]>([]);
    const [loans, setLoans] = useState<any[]>([]);
    const [advances, setAdvances] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isMigrating, setIsMigrating] = useState(false);

    // Customer Unpaid Bills state
    const [unpaidBills, setUnpaidBills] = useState<any[]>([]);
    const [waiterOrders, setWaiterOrders] = useState<any[]>([]);
    const [unpaidLoading, setUnpaidLoading] = useState(false);
    const [unpaidSearch, setUnpaidSearch] = useState('');
    const [payingBillId, setPayingBillId] = useState<string | null>(null);
    const [payingOrderId, setPayingOrderId] = useState<string | null>(null);

    // Bill Details Modal State
    const [selectedBill, setSelectedBill] = useState<any>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [verifyingId, setVerifyingId] = useState<string | null>(null);

    const handleVerifyAdvance = async (advance: any) => {
        if (!confirm(`Are you sure you want to approve this advance of KES ${advance.amount.toLocaleString()} for ${advance.staff?.first_name} ${advance.staff?.last_name}?`)) {
            return;
        }

        setVerifyingId(advance.id);
        try {
            // Safety check for simplePayroll API
            const payrollApi = api.staff?.simplePayroll;
            if (!payrollApi || typeof payrollApi.approveAdvance !== 'function') {
                toast.error('Approval feature is currently unavailable');
                return;
            }

            const res = await payrollApi.approveAdvance(advance.id);
            if (res.success) {
                toast.success('Advance approved successfully');
                loadData();
            } else {
                toast.error(res.message || 'Failed to approve advance');
            }
        } catch (error: any) {
            console.error('Advance verification error:', error);
            toast.error(error?.message || 'An error occurred during verification');
        } finally {
            setVerifyingId(null);
        }
    };

    const handleVerifyLoan = async (loan: any) => {
        if (!confirm(`Are you sure you want to approve this loan of KES ${loan.total_amount.toLocaleString()} for ${loan.staff?.first_name} ${loan.staff?.last_name}?`)) {
            return;
        }

        setVerifyingId(loan.id);
        try {
            // Safety check for simplePayroll API
            const payrollApi = api.staff?.simplePayroll;
            if (!payrollApi || typeof payrollApi.approveLoan !== 'function') {
                toast.error('Approval feature is currently unavailable');
                return;
            }

            const res = await payrollApi.approveLoan(loan.id);
            if (res.success) {
                toast.success('Loan approved successfully');
                loadData();
            } else {
                toast.error(res.message || 'Failed to approve loan');
            }
        } catch (error: any) {
            console.error('Loan verification error:', error);
            toast.error(error?.message || 'An error occurred during verification');
        } finally {
            setVerifyingId(null);
        }
    };

    const loadUnpaidBills = async () => {
        if (!branchId) return;
        setUnpaidLoading(true);
        try {
            const [billsRes, ordersRes] = await Promise.all([
                cashierAPI.getUnpaidBills({ branch_id: branchId }),
                cashierAPI.getUnpaidWaiterOrders({ branch_id: branchId })
            ]);

            if (billsRes?.success && Array.isArray(billsRes.data)) {
                setUnpaidBills((billsRes.data as any[]).filter(
                    (b: any) => !b.is_kyogong && !b.is_hotel && !b.is_invoice && b.source_type !== 'KYOGONG'
                ));
            } else {
                setUnpaidBills([]);
            }

            if (ordersRes?.success && Array.isArray(ordersRes.data)) {
                setWaiterOrders(ordersRes.data);
            } else {
                setWaiterOrders([]);
            }
        } catch (err) {
            console.error('Failed to load unpaid bills/orders', err);
            setUnpaidBills([]);
            setWaiterOrders([]);
        } finally {
            setUnpaidLoading(false);
        }
    };

    const handleMarkPaid = async (bill: any) => {
        const balance = Number(bill.balance_amount ?? bill.total_amount ?? 0);
        if (balance <= 0) {
            toast.info('This bill is already fully paid.');
            return;
        }
        if (!confirm(`Mark KES ${balance.toLocaleString()} from "${bill.customer_name || 'Customer'}" as paid?`)) return;
        setPayingBillId(bill.id);
        try {
            const res = await cashierAPI.recordBillPayment(bill.id, {
                payment_amount: balance,
                payment_method: 'cash'
            });
            if (res?.success) {
                toast.success('Bill marked as paid and removed from list.');
                setUnpaidBills(prev => prev.filter(b => b.id !== bill.id));
            } else {
                toast.error(res?.message || 'Failed to mark bill as paid');
            }
        } catch (err: any) {
            toast.error(err?.message || 'Failed to mark bill as paid');
        } finally {
            setPayingBillId(null);
        }
    };

    const handleMarkOrderPaid = async (order: any) => {
        if (!confirm(`Mark order ${order.order_number} (KES ${order.total_amount.toLocaleString()}) as paid?`)) return;
        setPayingOrderId(order.id);
        try {
            const res = await cashierAPI.markWaiterOrderPaid(order.source as 'restaurant' | 'bar', order.id);
            if (res?.success) {
                toast.success(`Order ${order.order_number} marked as paid.`);
                setWaiterOrders(prev => prev.filter(o => o.id !== order.id));
            } else {
                toast.error(res?.message || 'Failed to mark order as paid');
            }
        } catch (err: any) {
            toast.error(err?.message || 'Failed to mark order as paid');
        } finally {
            setPayingOrderId(null);
        }
    };

    const handleTriggerMigration = async () => {
        if (!confirm('Trigger migration of pending orders older than 8 hours to staff credit bills? Waiters will be notified.')) {
            return;
        }

        setIsMigrating(true);
        try {
            const payrollApi = api.staff?.simplePayroll;
            if (!payrollApi || typeof payrollApi.triggerPendingBillsMigration !== 'function') {
                toast.error('Migration feature is currently unavailable');
                return;
            }

            const res = await payrollApi.triggerPendingBillsMigration(branchId ?? undefined);
            if (res.success) {
                toast.success('Migration completed — staff credit bills updated.');
                loadData();
                loadUnpaidBills();
            } else {
                toast.error(res.message || 'Migration failed');
            }
        } catch (error) {
            console.error('Migration error', error);
            toast.error('An error occurred during migration');
        } finally {
            setIsMigrating(false);
        }
    };

    const handleDetailsClick = (bill: any) => {
        setSelectedBill(bill);
        setShowDetailsModal(true);
    };

    const loadData = async () => {
        if (!branchId) return;
        setIsLoading(true);

        // Safety check for API availability
        const payrollApi = api.staff?.simplePayroll;

        try {
            // Helper function to fetch data safely based on active tab
            const fetchData = async (tab: string) => {
                if (!payrollApi) {
                    console.warn(`Simple Payroll API namespace missing for tab: ${tab}`);
                    return { success: true, data: [] };
                }

                switch (tab) {
                    case 'staff_credit':
                        return typeof payrollApi.getCreditBills === 'function'
                            ? await payrollApi.getCreditBills()
                            : { success: false, message: 'getCreditBills method missing' };
                    case 'loans':
                        return typeof payrollApi.getLoans === 'function'
                            ? await payrollApi.getLoans()
                            : { success: false, message: 'getLoans method missing' };
                    case 'advances':
                        return typeof payrollApi.getAdvances === 'function'
                            ? await payrollApi.getAdvances()
                            : { success: false, message: 'getAdvances method missing' };
                    default:
                        return { success: true, data: [] };
                }
            };

            const res = await fetchData(activeTab);

            if (res && res.success && Array.isArray(res.data)) {
                // Filter by branch locally since API doesn't support branch_id filtering yet for these endpoints
                const filtered = res.data.filter((item: any) =>
                    !item.staff || item.staff.branch_id === branchId || !item.staff.branch_id
                );

                if (activeTab === 'staff_credit') setCreditBills(filtered);
                else if (activeTab === 'loans') setLoans(filtered);
                else if (activeTab === 'advances') setAdvances(filtered);
            } else if (res && !res.success) {
                console.error(`API Error for ${activeTab}:`, res.message);
                // Clear active list on failure to ensure UI consistency
                if (activeTab === 'staff_credit') setCreditBills([]);
                else if (activeTab === 'loans') setLoans([]);
                else if (activeTab === 'advances') setAdvances([]);
            }
        } catch (error) {
            console.error('Error loading data', error);
            toast.error('Failed to load records');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'customer_credit') {
            loadUnpaidBills();
        } else {
            loadData();
        }
    }, [activeTab, branchId]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
                        <Wallet className="h-6 w-6 text-blue-600" />
                        {isAuditor ? 'Audit Credit & Bills' : 'Credit & Paid Bills'}
                    </h1>
                    <p className="text-stone-500">
                        {isAuditor ? 'Review and audit staff credits, loans, and advances' : 'Manage staff credits, loans, and salary advances'}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors flex items-center shadow-sm" onClick={loadData}>
                        <Clock className="h-4 w-4 mr-2" /> Refresh
                    </button>
                    {!isAuditor && (activeTab === 'staff_credit' || activeTab === 'customer_credit') && (
                        <button
                            className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors flex items-center shadow-sm disabled:opacity-50"
                            onClick={handleTriggerMigration}
                            disabled={isMigrating}
                        >
                            <Clock className={`h-4 w-4 mr-2 ${isMigrating ? 'animate-spin' : ''}`} />
                            {isMigrating ? 'Migrating...' : 'Trigger Migration (8h)'}
                        </button>
                    )}
                    {/* Global Action Button based on tab - Only show for Branch Accountant or if Auditor needs to create */}
                    {!isAuditor && (
                        <button
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center shadow-sm"
                            onClick={() => setShowModal(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            New {activeTab === 'staff_credit' ? 'Credit Bill' :
                                activeTab === 'loans' ? 'Loan Request' :
                                    activeTab === 'advances' ? 'Advance Request' : 'Record'}
                        </button>
                    )}
                </div>
            </div>

            <Tabs
                tabs={[
                    { id: 'staff_credit', label: 'Staff Credit Bills' },
                    { id: 'loans', label: 'Staff Loans' },
                    { id: 'advances', label: 'Salary Advances' },
                    { id: 'customer_credit', label: 'Customer Unpaid Bills' }
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            {/* Content Area */}
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm min-h-[400px]">
                {activeTab === 'customer_credit' && (
                    <div>
                        {/* Header bar */}
                        <div className="p-4 border-b border-stone-200 bg-stone-50 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Search customer name or bill #..."
                                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={unpaidSearch}
                                    onChange={e => setUnpaidSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2 text-sm text-stone-500">
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                <span>{unpaidBills.length} outstanding bill{unpaidBills.length !== 1 ? 's' : ''}</span>
                                <button onClick={loadUnpaidBills} className="ml-2 p-1.5 hover:bg-stone-200 rounded transition-colors" title="Refresh">
                                    <RefreshCw className={`h-4 w-4 ${unpaidLoading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-stone-500 uppercase bg-stone-50/50">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Date</th>
                                        <th className="px-4 py-3 font-medium">Bill #</th>
                                        <th className="px-4 py-3 font-medium">Customer</th>
                                        <th className="px-4 py-3 font-medium">Type</th>
                                        <th className="px-4 py-3 font-medium text-right">Total</th>
                                        <th className="px-4 py-3 font-medium text-right">Balance</th>
                                        <th className="px-4 py-3 font-medium text-center">Status</th>
                                        <th className="px-4 py-3 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {unpaidLoading && (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-12 text-center text-stone-500">
                                                <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                                                Loading unpaid bills...
                                            </td>
                                        </tr>
                                    )}

                                    {!unpaidLoading && (() => {
                                        const term = unpaidSearch.trim().toLowerCase();
                                        const visible = unpaidBills.filter(b =>
                                            !term ||
                                            (b.customer_name || '').toLowerCase().includes(term) ||
                                            (b.bill_number || '').toLowerCase().includes(term)
                                        );

                                        if (visible.length === 0) {
                                            return (
                                                <tr>
                                                    <td colSpan={8} className="px-4 py-12 text-center">
                                                        <CheckCircle className="h-10 w-10 mx-auto text-emerald-400 mb-3" />
                                                        <p className="text-stone-900 font-medium">No outstanding customer bills</p>
                                                        <p className="text-stone-500 text-xs mt-1">All customer bills have been settled or none recorded.</p>
                                                    </td>
                                                </tr>
                                            );
                                        }

                                        return visible.map((bill: any) => {
                                            const balance = Number(bill.balance_amount ?? bill.total_amount ?? 0);
                                            const dateStr = bill.bill_date
                                                ? new Date(bill.bill_date).toLocaleDateString()
                                                : '—';
                                            const isPaying = payingBillId === bill.id;

                                            return (
                                                <tr key={bill.id} className="hover:bg-stone-50 transition-colors">
                                                    <td className="px-4 py-3 text-stone-500 text-xs">{dateStr}</td>
                                                    <td className="px-4 py-3 text-stone-700 font-mono text-xs">{bill.bill_number || bill.id?.slice(0, 8)}</td>
                                                    <td className="px-4 py-3">
                                                        <p className="font-medium text-stone-900">{bill.customer_name || 'Unknown'}</p>
                                                        {bill.customer_phone && (
                                                            <p className="text-xs text-stone-400">{bill.customer_phone}</p>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 uppercase">
                                                            {(bill.bill_type || bill.reference_type || 'manual').replace(/_/g, ' ')}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-medium text-stone-600">
                                                        {Number(bill.total_amount || 0).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                                                        {balance.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                            bill.status === 'paid'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : 'bg-red-100 text-red-700'
                                                        }`}>
                                                            {bill.status || 'unpaid'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {!isAuditor && bill.status !== 'paid' && (
                                                            <button
                                                                type="button"
                                                                disabled={isPaying}
                                                                onClick={() => handleMarkPaid(bill)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                                                            >
                                                                {isPaying
                                                                    ? <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                    : <DollarSign className="h-3 w-3" />}
                                                                {isPaying ? 'Paying...' : 'Mark Paid'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>

                        {/* ─── Pending Waiter Orders section ─── */}
                        <div className="border-t-4 border-amber-200 mt-1">
                            <div className="px-4 py-3 bg-amber-50 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                                    <span className="text-sm font-semibold text-amber-800">
                                        Pending Waiter Orders
                                    </span>
                                    <span className="text-xs text-amber-600 ml-1">
                                        ({waiterOrders.length} open — customers not yet collected)
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-stone-500 uppercase bg-amber-50/40">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">Time</th>
                                            <th className="px-4 py-3 font-medium">Order #</th>
                                            <th className="px-4 py-3 font-medium">Source</th>
                                            <th className="px-4 py-3 font-medium">Location</th>
                                            <th className="px-4 py-3 font-medium">Customer</th>
                                            <th className="px-4 py-3 font-medium">Waiter</th>
                                            <th className="px-4 py-3 font-medium text-right">Amount</th>
                                            <th className="px-4 py-3 font-medium text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {unpaidLoading && (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center text-stone-400 text-xs">
                                                    Loading orders...
                                                </td>
                                            </tr>
                                        )}
                                        {!unpaidLoading && waiterOrders.length === 0 && (
                                            <tr>
                                                <td colSpan={8} className="px-4 py-8 text-center">
                                                    <p className="text-stone-500 text-xs">No pending orders — all collected.</p>
                                                </td>
                                            </tr>
                                        )}
                                        {!unpaidLoading && waiterOrders.map((order: any) => {
                                            const isPaying = payingOrderId === order.id;
                                            const timeStr = order.created_at
                                                ? new Date(order.created_at).toLocaleString()
                                                : '—';
                                            const waiterName = order.waiter
                                                ? `${order.waiter.first_name || ''} ${order.waiter.last_name || ''}`.trim()
                                                : '—';

                                            return (
                                                <tr key={order.id} className="hover:bg-amber-50/30 transition-colors">
                                                    <td className="px-4 py-3 text-stone-400 text-xs">{timeStr}</td>
                                                    <td className="px-4 py-3 font-mono text-xs text-stone-700">{order.order_number}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                                            order.source === 'restaurant'
                                                                ? 'bg-green-100 text-green-700'
                                                                : 'bg-purple-100 text-purple-700'
                                                        }`}>
                                                            {order.source}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-stone-600 text-xs">{order.location}</td>
                                                    <td className="px-4 py-3 font-medium text-stone-900 text-xs">{order.guest_name}</td>
                                                    <td className="px-4 py-3 text-stone-500 text-xs">{waiterName}</td>
                                                    <td className="px-4 py-3 text-right font-semibold text-amber-700">
                                                        {order.total_amount.toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {!isAuditor && (
                                                            <button
                                                                type="button"
                                                                disabled={isPaying}
                                                                onClick={() => handleMarkOrderPaid(order)}
                                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-50"
                                                            >
                                                                {isPaying
                                                                    ? <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                                    : <DollarSign className="h-3 w-3" />}
                                                                {isPaying ? 'Paying...' : 'Collect'}
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Footer: go to full customer credit module */}
                        <div className="px-4 py-3 border-t border-stone-100 bg-stone-50 flex justify-end">
                            <button
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                onClick={() => router.push(isAuditor ? '/dashboard/auditor/branch-audit/credit-bills/customer' : '/dashboard/branch-accounting/credit-bills/customer')}
                            >
                                <ChevronRight className="h-3 w-3" />
                                Full Customer Credit Module
                            </button>
                        </div>
                    </div>
                )}

                {activeTab !== 'customer_credit' && (
                    <div className="p-0">
                        {/* Search & Filter Bar */}
                        <div className="p-4 border-b border-stone-200 bg-stone-50 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Search staff name..."
                                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <button className="px-3 py-2 bg-white border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-50">
                                <Filter className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-stone-500 uppercase bg-stone-50/50">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Date</th>
                                        {activeTab === 'staff_credit' && <th className="px-4 py-3 font-medium text-center">Source</th>}
                                        <th className="px-4 py-3 font-medium">Staff Member</th>
                                        <th className="px-4 py-3 font-medium">Description/Reason</th>
                                        <th className="px-4 py-3 font-medium text-right">Amount</th>
                                        <th className="px-4 py-3 font-medium text-right">Balance</th>
                                        <th className="px-4 py-3 font-medium text-center">Status</th>
                                        <th className="px-4 py-3 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {/* Data Rows */}
                                    {activeTab === 'staff_credit' && creditBills.map((bill) => (
                                        <tr key={bill.id} className="hover:bg-stone-50 transition-colors">
                                            <td className="px-4 py-3 text-stone-600">{bill.date}</td>
                                            <td className="px-4 py-3 text-center">
                                                {bill.migrated_from_order ? (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 border border-purple-200">
                                                        POS ORDER
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                                                        MANUAL
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-medium text-stone-900">
                                                {bill.staff?.first_name} {bill.staff?.last_name}
                                            </td>
                                            <td className="px-4 py-3 text-stone-600">{bill.description}</td>
                                            <td className="px-4 py-3 text-right font-medium text-stone-600">
                                                {bill.amount.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-blue-600">
                                                {(bill.balance ?? bill.amount).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {(() => {
                                                    // Restored Settled Logic: Check is_paid boolean primary, status enum fallback
                                                    const isSettled = bill.is_paid || 
                                                                    bill.status === 'paid' || 
                                                                    bill.status === 'paid_cash' || 
                                                                    bill.status === 'deducted';
                                                    
                                                    const isPartial = !isSettled && 
                                                                    ((bill.balance < bill.amount && bill.balance > 0) || (bill.paid_amount > 0 && !isSettled));
                                                    
                                                    return (
                                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${isSettled 
                                                            ? 'bg-emerald-100 text-emerald-700' 
                                                            : isPartial 
                                                                ? 'bg-blue-100 text-blue-700' 
                                                                : 'bg-amber-100 text-amber-700'
                                                        }`}>
                                                            {isSettled ? 'Settled' : isPartial ? 'Partial' : 'Pending'}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDetailsClick(bill);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-700 text-xs font-medium cursor-pointer"
                                                >
                                                    Details
                                                </button>
                                            </td>
                                        </tr>
                                    ))}

                                    {activeTab === 'loans' && loans.map((loan) => (
                                        <tr key={loan.id} className="hover:bg-stone-50 transition-colors">
                                            <td className="px-4 py-3 text-stone-600">{loan.start_date}</td>
                                            <td className="px-4 py-3 font-medium text-stone-900">
                                                {loan.staff?.first_name} {loan.staff?.last_name}
                                            </td>
                                            <td className="px-4 py-3 text-stone-600">{loan.reason}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-stone-900">
                                                {loan.total_amount.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-blue-600">
                                                {loan.remaining_balance.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${loan.status === 'active'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : loan.status === 'completed'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : loan.status === 'pending'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-stone-100 text-stone-700'
                                                    }`}>
                                                    {loan.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    {loan.status === 'pending' && (
                                                        <button
                                                            type="button"
                                                            disabled={verifyingId === loan.id}
                                                            onClick={() => handleVerifyLoan(loan)}
                                                            className="text-blue-600 hover:text-blue-700 text-xs font-semibold cursor-pointer flex items-center disabled:opacity-50"
                                                        >
                                                            {verifyingId === loan.id ? (
                                                                <div className="h-3 w-3 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="h-3 w-3 mr-1" /> Approve
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDetailsClick(loan)}
                                                        className="text-stone-500 hover:text-stone-700 text-xs font-medium cursor-pointer"
                                                    >
                                                        Details
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {activeTab === 'advances' && advances.map((advance) => (
                                        <tr key={advance.id} className="hover:bg-stone-50 transition-colors">
                                            <td className="px-4 py-3 text-stone-600">{advance.request_date}</td>
                                            <td className="px-4 py-3 font-medium text-stone-900">
                                                {advance.staff?.first_name} {advance.staff?.last_name}
                                            </td>
                                            <td className="px-4 py-3 text-stone-600">{advance.reason}</td>
                                            <td className="px-4 py-3 text-right font-medium text-stone-900">
                                                {advance.amount.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-blue-600">
                                                {advance.amount.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${advance.status === 'deducted'
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : advance.status === 'approved'
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : advance.status === 'pending'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : advance.status === 'rejected'
                                                                ? 'bg-red-100 text-red-700'
                                                                : 'bg-stone-100 text-stone-700'
                                                    }`}>
                                                    {advance.status === 'deducted' ? 'Settled' : advance.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    {advance.status === 'pending' && (
                                                        <button
                                                            type="button"
                                                            disabled={verifyingId === advance.id}
                                                            onClick={() => handleVerifyAdvance(advance)}
                                                            className="text-blue-600 hover:text-blue-700 text-xs font-semibold cursor-pointer flex items-center disabled:opacity-50"
                                                        >
                                                            {verifyingId === advance.id ? (
                                                                <div className="h-3 w-3 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <CheckCircle className="h-3 w-3 mr-1" /> Approve
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDetailsClick(advance)}
                                                        className="text-stone-500 hover:text-stone-700 text-xs font-medium cursor-pointer"
                                                    >
                                                        Details
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Empty State */}
                                    {((!creditBills.length && activeTab === 'staff_credit' && !isLoading) ||
                                        (!loans.length && activeTab === 'loans' && !isLoading) ||
                                        (!advances.length && activeTab === 'advances' && !isLoading)) && (
                                            <tr>
                                                <td colSpan={7} className="px-4 py-12 text-center">
                                                    <div className="mx-auto h-12 w-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
                                                        <Search className="h-6 w-6 text-stone-400" />
                                                    </div>
                                                    <p className="text-stone-900 font-medium">No records found</p>
                                                    <p className="text-stone-500 text-xs mt-1">
                                                        No {activeTab.replace('_', ' ')} records found for this branch.
                                                    </p>
                                                </td>
                                            </tr>
                                        )}

                                    {isLoading && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-12 text-center text-stone-500">
                                                <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
                                                Loading records...
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* New Record Modal */}
            {showModal && (
                <NewRecordModal
                    type={activeTab}
                    branchId={branchId}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        setShowModal(false);
                        loadData();
                    }}
                />
            )}
            {showDetailsModal && selectedBill && (
                <BillDetailsModal
                    bill={selectedBill}
                    onClose={() => setShowDetailsModal(false)}
                    onUpdate={loadData}
                    isAuditor={isAuditor}
                />
            )}
        </div>
    );
}

// Simple Tabs Component
function Tabs({ tabs, activeTab, onChange }: any) {
    return (
        <div className="flex border-b border-stone-200 mb-6 overflow-x-auto">
            {tabs.map((tab: any) => (
                <button
                    key={tab.id}
                    onClick={() => onChange(tab.id)}
                    className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300'
                        }`}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}

function NewRecordModal({ type, branchId, onClose, onSuccess }: any) {
    const [formData, setFormData] = useState({
        staff_id: '',
        staff_name: '',
        amount: '',
        description: '', // used for reason/notes
        repayment_period: '1', // months, for loans
        deduction_month: new Date().toISOString().slice(0, 7), // YYYY-MM for advances
    });
    const [loading, setLoading] = useState(false);
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

    const handleSubmit = async () => {
        try {
            if (!formData.staff_id || !formData.amount) {
                toast.error('Please fill in all required fields');
                return;
            }

            setLoading(true);

            // Prepare payload based on type
            let payload: any = {
                staff_id: formData.staff_id,
                amount: parseFloat(formData.amount),
                notes: formData.description
            };

            let endpoint = '';

            if (type === 'staff_credit') {
                endpoint = '/finance/staff-credit-bills';
                payload.bill_type = 'credit_bill';
            } else if (type === 'loans') {
                endpoint = '/finance/staff-loans';
                payload.repayment_period = parseInt(formData.repayment_period);
            } else if (type === 'advances') {
                endpoint = '/finance/salary-advances';
                payload.deduction_month = formData.deduction_month;
            }

            // Call API with safety checks
            let res;
            const payrollApi = api.staff?.simplePayroll;

            if (!payrollApi) {
                toast.error('Payroll requested feature is currently unavailable');
                setLoading(false);
                return;
            }

            if (type === 'staff_credit') {
                if (typeof payrollApi.createCreditBill !== 'function') {
                    toast.error('Credit bill recording is unavailable');
                    setLoading(false);
                    return;
                }
                res = await payrollApi.createCreditBill({
                    staff_id: formData.staff_id,
                    amount: parseFloat(formData.amount),
                    description: formData.description || 'Staff credit bill',
                    date: new Date().toISOString().split('T')[0]
                });
            } else if (type === 'loans') {
                if (typeof payrollApi.createLoan !== 'function') {
                    toast.error('Loan recording is unavailable');
                    setLoading(false);
                    return;
                }
                const total = parseFloat(formData.amount);
                const months = parseInt(formData.repayment_period) || 1;
                const [deductYear, deductMonth] = formData.deduction_month.split('-').map(Number);
                res = await payrollApi.createLoan({
                    staff_id: formData.staff_id,
                    total_amount: total,
                    installment_amount: parseFloat((total / months).toFixed(2)),
                    reason: formData.description || 'Staff loan',
                    loan_date: new Date().toISOString().split('T')[0],
                    start_deduction_month: deductMonth,
                    start_deduction_year: deductYear
                });
            } else if (type === 'advances') {
                if (typeof payrollApi.createAdvance !== 'function') {
                    toast.error('Advance recording is unavailable');
                    setLoading(false);
                    return;
                }
                const [deductYear, deductMonth] = formData.deduction_month.split('-').map(Number);
                res = await payrollApi.createAdvance({
                    staff_id: formData.staff_id,
                    amount: parseFloat(formData.amount),
                    reason: formData.description || 'Salary advance',
                    advance_date: new Date().toISOString().split('T')[0],
                    month_to_deduct: deductMonth,
                    year_to_deduct: deductYear
                });
            } else {
                toast.error('Invalid request type');
                setLoading(false);
                return;
            }

            if (res.success) {
                toast.success('Record created successfully');
                onSuccess();
            } else {
                toast.error(res.message || 'Failed to create record');
            }
        } catch (error) {
            console.error('Submission error', error);
            toast.error('Failed to submit request');
        } finally {
            setLoading(false);
        }
    };

    const getTitle = () => {
        switch (type) {
            case 'staff_credit': return 'Record Staff Credit Bill';
            case 'loans': return 'New Staff Loan Request';
            case 'advances': return 'New Salary Advance';
            default: return 'New Record';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
                    <h3 className="font-semibold text-stone-900">{getTitle()}</h3>
                    <button onClick={onClose} className="text-stone-400 hover:text-stone-600">
                        <XCircle className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Staff Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-700">Staff Member <span className="text-red-500">*</span></label>
                        <button
                            type="button"
                            onClick={() => setIsStaffModalOpen(true)}
                            className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-white flex items-center justify-between group hover:border-blue-500 transition-all shadow-sm"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${formData.staff_id ? 'bg-blue-600 text-white' : 'bg-stone-100 text-stone-400 group-hover:bg-blue-50 group-hover:text-blue-600'}`}>
                                    <User className="h-4 w-4" />
                                </div>
                                <span className={`text-sm truncate ${formData.staff_id ? 'text-stone-900 font-semibold' : 'text-stone-400'}`}>
                                    {formData.staff_name || 'Select staff member...'}
                                </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-stone-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                        </button>
                        
                        <StaffDropdownModal
                            isOpen={isStaffModalOpen}
                            onClose={() => setIsStaffModalOpen(false)}
                            activeBranchId={branchId}
                            onSelect={(staff: any) => {
                                setFormData({ 
                                    ...formData, 
                                    staff_id: staff.id,
                                    staff_name: `${staff.first_name} ${staff.last_name}`
                                });
                            }}
                            title={`Assign To Personnel`}
                        />
                    </div>

                    {/* Amount */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-700">Amount (KES) <span className="text-red-500">*</span></label>
                        <input
                            type="number"
                            className="w-full h-10 px-3 rounded-lg border border-stone-200 focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                            value={formData.amount}
                            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        />
                    </div>

                    {/* Type Specific Fields */}
                    {type === 'loans' && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-stone-700">Repayment Period (Months)</label>
                                <select
                                    className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white"
                                    value={formData.repayment_period}
                                    onChange={(e) => setFormData({ ...formData, repayment_period: e.target.value })}
                                >
                                    {[1, 2, 3, 4, 5, 6, 9, 12].map(m => (
                                        <option key={m} value={m}>{m} Month{m > 1 ? 's' : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-stone-700">Start Deduction Month</label>
                                <input
                                    type="month"
                                    className="w-full h-10 px-3 rounded-lg border border-stone-200"
                                    value={formData.deduction_month}
                                    onChange={(e) => setFormData({ ...formData, deduction_month: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {type === 'advances' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-stone-700">Deduction Month</label>
                            <input
                                type="month"
                                className="w-full h-10 px-3 rounded-lg border border-stone-200"
                                value={formData.deduction_month}
                                onChange={(e) => setFormData({ ...formData, deduction_month: e.target.value })}
                            />
                        </div>
                    )}

                    {/* Description/Reason */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-stone-700">
                            {type === 'staff_credit' ? 'Items/Service Description' : 'Reason for Request'}
                        </label>
                        <textarea
                            className="w-full h-24 px-3 py-2 rounded-lg border border-stone-200 resize-none focus:ring-2 focus:ring-blue-500"
                            placeholder={type === 'staff_credit' ? "e.g., Lunch + Drink" : "Brief explanation..."}
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-stone-100 bg-stone-50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading && <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />}
                        Submit Record
                    </button>
                </div>
            </div>
        </div>
    );
}
