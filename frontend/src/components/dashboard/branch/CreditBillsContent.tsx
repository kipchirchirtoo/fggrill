'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { financeAPI, api } from '@/lib/api';
import {
    CreditCard, Wallet, Calendar, User, Search,
    Plus, Filter, Download, ChevronRight, CheckCircle,
    XCircle, Clock, AlertTriangle, FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface CreditBillsContentProps {
    branchId: number | null;
    isAuditor?: boolean;
}

export function CreditBillsContent({ branchId, isAuditor = false }: CreditBillsContentProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'staff_credit');

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [staffList, setStaffList] = useState<any[]>([]);

    useEffect(() => {
        if (showModal) {
            loadStaff();
        }
    }, [showModal]);

    const loadStaff = async () => {
        try {
            const branchQuery = branchId ? `&branch_id=${branchId}` : '';
            const res = await api.get(`/staff?status=active${branchQuery}`) as any;

            if (res.success || Array.isArray(res)) {
                setStaffList(res.data || res);
            }
        } catch (error) {
            console.error('Failed to load staff', error);
        }
    };

    // State for lists
    const [creditBills, setCreditBills] = useState<any[]>([]);
    const [loans, setLoans] = useState<any[]>([]);
    const [advances, setAdvances] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const loadData = async () => {
        if (!branchId) return;
        setIsLoading(true);
        try {
            // Mock data for now until API endpoints are fully connected
            // ideally: api.get(`/finance/staff-credit-bills?branch_id=${branchId}`)

            // Simulating API response structure based on schema
            setCreditBills([]);
            setLoans([]);
            setAdvances([]);

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
                                        <th className="px-4 py-3 font-medium">Staff Member</th>
                                        <th className="px-4 py-3 font-medium">Description/Reason</th>
                                        <th className="px-4 py-3 font-medium text-right">Amount</th>
                                        <th className="px-4 py-3 font-medium text-center">Status</th>
                                        <th className="px-4 py-3 font-medium text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {/* Empty State */}
                                    {(!creditBills.length && activeTab === 'staff_credit') ||
                                        (!loans.length && activeTab === 'loans') ||
                                        (!advances.length && activeTab === 'advances') ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-12 text-center">
                                                <div className="mx-auto h-12 w-12 rounded-full bg-stone-100 flex items-center justify-center mb-3">
                                                    <Search className="h-6 w-6 text-stone-400" />
                                                </div>
                                                <p className="text-stone-900 font-medium">No records found</p>
                                                <p className="text-stone-500 text-xs mt-1">
                                                    No {activeTab.replace('_', ' ')} records found for this branch.
                                                </p>
                                            </td>
                                        </tr>
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-4 text-center text-stone-500">
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
                    staffList={staffList}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        setShowModal(false);
                        loadData();
                    }}
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

function NewRecordModal({ type, staffList, onClose, onSuccess }: any) {
    const [formData, setFormData] = useState({
        staff_id: '',
        amount: '',
        description: '', // used for reason/notes
        repayment_period: '1', // months, for loans
        deduction_month: new Date().toISOString().slice(0, 7), // YYYY-MM for advances
    });
    const [loading, setLoading] = useState(false);

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

            // Call API
            const res = await api.post(endpoint, payload);

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
                        <select
                            className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 max-h-40 overflow-y-auto"
                            value={formData.staff_id}
                            onChange={(e) => setFormData({ ...formData, staff_id: e.target.value })}
                        >
                            <option value="">Select Staff...</option>
                            {staffList.map((staff: any) => (
                                <option key={staff.id} value={staff.id}>
                                    {staff.first_name} {staff.last_name} ({staff.staff_number || 'No ID'})
                                </option>
                            ))}
                        </select>
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
