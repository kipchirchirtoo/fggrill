'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { financeAPI, api } from '@/lib/api';
import {
    CreditCard, Wallet, Calendar, User, Search,
    Plus, Filter, Download, ChevronRight, CheckCircle,
    XCircle, Clock, AlertTriangle, FileText
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
        } catch (error) {
            console.error('Verification error', error);
            toast.error('An error occurred during verification');
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
        } catch (error) {
            console.error('Verification error', error);
            toast.error('An error occurred during verification');
        } finally {
            setVerifyingId(null);
        }
    };

    const handleTriggerMigration = async () => {
        if (!confirm('Are you sure you want to trigger a manual migration of pending bills older than 8 hours? This will convert pending orders to credit bills and notify waiters.')) {
            return;
        }

        setIsMigrating(true);
        try {
            // Safety check for simplePayroll API
            const payrollApi = api.staff?.simplePayroll;
            if (!payrollApi || typeof payrollApi.triggerPendingBillsMigration !== 'function') {
                toast.error('Migration feature is currently unavailable');
                return;
            }

            const res = await payrollApi.triggerPendingBillsMigration();
            if (res.success) {
                toast.success('Migration completed successfully');
                loadData();
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
        loadData();
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
                    {!isAuditor && activeTab === 'staff_credit' && (
                        <button
                            className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors flex items-center shadow-sm disabled:opacity-50"
                            onClick={handleTriggerMigration}
                            disabled={isMigrating}
                        >
                            <Clock className={`h-4 w-4 mr-2 ${isMigrating ? 'animate-spin' : ''}`} />
                            {isMigrating ? 'Migrating...' : 'Trigger Migration'}
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
                    <div className="p-8 text-center">
                        <FileText className="h-12 w-12 mx-auto text-stone-300 mb-4" />
                        <h3 className="text-lg font-medium text-stone-900">Customer Credit Management</h3>
                        <p className="text-stone-500 mb-6">Manage unpaid bills for walk-in and corporate customers.</p>
                        <button
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
                            onClick={() => router.push(isAuditor ? `/dashboard/auditor/branch-audit/credit-bills/customer` : '/dashboard/branch-accounting/credit-bills/customer')}
                        >
                            {isAuditor ? 'Audit Customer Credits' : 'Go to Customer Credit Module'}
                        </button>
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
                                                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${bill.is_paid
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : (bill.balance < bill.amount && bill.balance > 0)
                                                        ? 'bg-blue-100 text-blue-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {bill.is_paid
                                                        ? 'Settled'
                                                        : (bill.balance < bill.amount && bill.balance > 0)
                                                            ? 'Partial'
                                                            : 'Pending'}
                                                </span>
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
