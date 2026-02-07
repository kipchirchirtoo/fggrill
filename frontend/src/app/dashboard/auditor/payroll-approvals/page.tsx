'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Clock, DollarSign, User, Calendar, FileText } from 'lucide-react';

type PayrollItemType = 'credit_bill' | 'advance' | 'loan';

interface PayrollItem {
    id: string;
    staff_id: string;
    amount: number;
    reason?: string;
    description?: string;
    status: string;
    created_at: string;
    accountant_confirmed_at?: string;
    auditor_confirmed_at?: string;
    staff?: {
        first_name: string;
        last_name: string;
        employee_id: string;
    };
    // Loan specific
    total_amount?: number;
    monthly_installment?: number;
    remaining_balance?: number;
    // Advance specific
    request_date?: string;
}

export default function PayrollApprovalsPage() {
    const [activeTab, setActiveTab] = useState<PayrollItemType>('credit_bill');
    const [statusFilter, setStatusFilter] = useState<string>('pending_auditor');
    const [creditBills, setCreditBills] = useState<PayrollItem[]>([]);
    const [advances, setAdvances] = useState<PayrollItem[]>([]);
    const [loans, setLoans] = useState<PayrollItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState<PayrollItem | null>(null);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    useEffect(() => {
        loadPendingApprovals();
    }, [statusFilter]);

    const loadPendingApprovals = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/staff/simple-payroll/pending-approvals?status=${statusFilter}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to load');

            const res = await response.json();

            if (res.success && res.data) {
                setCreditBills(res.data.credit_bills || []);
                setAdvances(res.data.advances || []);
                setLoans(res.data.loans || []);
            }
        } catch (error) {
            console.error('Failed to load pending approvals', error);
            toast.error('Failed to load pending approvals');
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (type: PayrollItemType, id: string) => {
        try {
            setActionLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/staff/simple-payroll/${type}/${id}/approve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) throw new Error('Failed to approve');

            const res = await response.json();

            if (res.success) {
                toast.success(`${type.replace('_', ' ')} approved successfully`);
                await loadPendingApprovals();
            }
        } catch (error) {
            console.error('Failed to approve', error);
            toast.error('Failed to approve item');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReject = async () => {
        if (!selectedItem || !rejectReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }

        try {
            setActionLoading(true);
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/staff/simple-payroll/${activeTab}/${selectedItem.id}/reject`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ reason: rejectReason })
            });

            if (!response.ok) throw new Error('Failed to reject');

            const res = await response.json();

            if (res.success) {
                toast.success(`${activeTab.replace('_', ' ')} rejected successfully`);
                setShowRejectModal(false);
                setSelectedItem(null);
                setRejectReason('');
                await loadPendingApprovals();
            }
        } catch (error) {
            console.error('Failed to reject', error);
            toast.error('Failed to reject item');
        } finally {
            setActionLoading(false);
        }
    };

    const getCurrentItems = () => {
        if (activeTab === 'credit_bill') return creditBills;
        if (activeTab === 'advance') return advances;
        return loans;
    };

    const getStatusBadge = (item: PayrollItem) => {
        if (item.auditor_confirmed_at) {
            return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">Approved</span>;
        }
        if (item.accountant_confirmed_at) {
            return <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">Pending Auditor</span>;
        }
        if (item.status === 'rejected') {
            return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">Rejected</span>;
        }
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">Pending Accountant</span>;
    };

    const currentItems = getCurrentItems();

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Payroll Approvals</h1>
                <p className="text-gray-600 mt-1">Review and approve credit bills, loans, and advances</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('credit_bill')}
                    className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'credit_bill'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Credit Bills ({creditBills.length})
                </button>
                <button
                    onClick={() => setActiveTab('advance')}
                    className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'advance'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Advances ({advances.length})
                </button>
                <button
                    onClick={() => setActiveTab('loan')}
                    className={`pb-3 px-4 font-medium transition-colors ${activeTab === 'loan'
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-600 hover:text-gray-900'
                        }`}
                >
                    Loans ({loans.length})
                </button>
            </div>

            {/* Status Filter */}
            <div className="mb-6 flex gap-3">
                <button
                    onClick={() => setStatusFilter('pending_auditor')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${statusFilter === 'pending_auditor'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Pending Auditor
                </button>
                <button
                    onClick={() => setStatusFilter('pending_accountant')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${statusFilter === 'pending_accountant'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Pending Accountant
                </button>
                <button
                    onClick={() => setStatusFilter('approved')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${statusFilter === 'approved'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    Approved
                </button>
            </div>

            {/* Items Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-gray-500">Loading...</div>
                ) : currentItems.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                        No {activeTab.replace('_', ' ')}s found for this filter
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {currentItems.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <User className="w-4 h-4 text-gray-400" />
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {item.staff?.first_name} {item.staff?.last_name}
                                                </div>
                                                <div className="text-sm text-gray-500">{item.staff?.employee_id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 font-medium text-gray-900">
                                            <DollarSign className="w-4 h-4" />
                                            {(item.amount || item.total_amount || 0).toLocaleString()}
                                        </div>
                                        {activeTab === 'loan' && item.monthly_installment && (
                                            <div className="text-xs text-gray-500">
                                                Installment: {item.monthly_installment.toLocaleString()}/mo
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 max-w-xs">
                                        <div className="text-sm text-gray-900 truncate">
                                            {item.description || item.reason || 'N/A'}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-1 text-sm text-gray-600">
                                            <Calendar className="w-4 h-4" />
                                            {new Date(item.created_at || item.request_date || '').toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">{getStatusBadge(item)}</td>
                                    <td className="px-6 py-4">
                                        {!item.auditor_confirmed_at && item.accountant_confirmed_at && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleApprove(activeTab, item.id)}
                                                    disabled={actionLoading}
                                                    className="px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1 text-sm"
                                                >
                                                    <CheckCircle className="w-4 h-4" />
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedItem(item);
                                                        setShowRejectModal(true);
                                                    }}
                                                    disabled={actionLoading}
                                                    className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-1 text-sm"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Reject Modal */}
            {showRejectModal && selectedItem && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Reject {activeTab.replace('_', ' ')}</h3>
                        <p className="text-gray-600 mb-4">
                            Please provide a reason for rejecting this request from{' '}
                            <strong>
                                {selectedItem.staff?.first_name} {selectedItem.staff?.last_name}
                            </strong>
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Enter rejection reason..."
                            className="w-full border border-gray-300 rounded-lg p-3 mb-4 h-24 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setSelectedItem(null);
                                    setRejectReason('');
                                }}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={actionLoading || !rejectReason.trim()}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                            >
                                {actionLoading ? 'Rejecting...' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
