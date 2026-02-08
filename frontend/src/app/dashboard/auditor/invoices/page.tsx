'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { FileText, Search, Filter, Download, ArrowUpRight, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { accountingAPI, auditAPI } from '@/lib/api';
import { downloadInvoicePDF, printInvoicePDF } from '@/lib/invoice-pdf';
import { Printer, Flag, ShieldCheck, ShieldAlert, XCircle } from 'lucide-react';

interface Invoice {
    id: string;
    invoice_number: string;
    customer: {
        customer_name: string;
        email: string;
    };
    invoice_date: string;
    due_date: string;
    total_amount: number;
    balance: number;
    status: 'draft' | 'unpaid' | 'partially_paid' | 'paid' | 'void' | 'posted_to_audit' | 'verified';
    is_flagged?: boolean;
    auditor_id?: string;
    audited_at?: string;
    audit_notes?: string;
}

export default function AuditorInvoicesPage() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [flagModalOpen, setFlagModalOpen] = useState(false);
    const [flagReason, setFlagReason] = useState('');
    const [auditNotes, setAuditNotes] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const response = await accountingAPI.getInvoices();
            if (response.success) {
                setInvoices(response.data);
            } else {
                toast.error(response.message || 'Failed to fetch invoices');
            }
        } catch (error: any) {
            console.error('Error fetching invoices:', error);
            toast.error('Failed to load invoices');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action: 'verify' | 'flag' | 'clear', invoice: Invoice) => {
        setIsSubmitting(true);
        try {
            if (action === 'verify') {
                const res = await auditAPI.verifyAnomaly({
                    id: invoice.id,
                    type: 'invoice',
                    notes: auditNotes || 'Verified by Auditor'
                });
                if (res.success) {
                    toast.success('Invoice verified successfully');
                    setSelectedInvoice(null);
                    setAuditNotes('');
                    fetchInvoices();
                } else {
                    toast.error(res.message || 'Failed to verify invoice');
                }
            } else if (action === 'flag') {
                const res = await auditAPI.flagItem({
                    entity_type: 'invoice',
                    entity_id: invoice.id,
                    reason: flagReason,
                    metadata: { invoice_number: invoice.invoice_number }
                });
                if (res.success) {
                    toast.success('Invoice flagged for watchlist');
                    setFlagModalOpen(false);
                    setFlagReason('');
                    setSelectedInvoice(null);
                    fetchInvoices();
                } else {
                    toast.error(res.message || 'Failed to flag invoice');
                }
            } else if (action === 'clear') {
                // Clear could be dismiss flag or unverify
                // Assuming it means clear from flag
                const res = await auditAPI.verifyAnomaly({
                    id: invoice.id,
                    type: 'invoice',
                    notes: 'Cleared/Audited'
                });
                if (res.success) {
                    toast.success('Invoice cleared successfully');
                    fetchInvoices();
                }
            }
        } catch (error: any) {
            console.error(`Error performing ${action}:`, error);
            toast.error('An error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'text-green-600 bg-green-50 border-green-200';
            case 'partially_paid': return 'text-amber-600 bg-amber-50 border-amber-200';
            case 'unpaid': return 'text-red-600 bg-red-50 border-red-200';
            case 'draft': return 'text-gray-600 bg-gray-50 border-gray-200';
            case 'posted_to_audit': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'verified': return 'text-purple-600 bg-purple-50 border-purple-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    const filteredInvoices = invoices.filter(invoice => {
        const matchesSearch =
            invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            invoice.customer?.customer_name.toLowerCase().includes(searchQuery.toLowerCase());

        if (filterStatus === 'all') return matchesSearch;
        return matchesSearch && invoice.status === filterStatus;
    });

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <FileText className="h-6 w-6 text-blue-600" />
                                Invoice Audit
                            </h1>
                            <p className="text-gray-500">Review and audit all generated invoices.</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchInvoices} leftIcon={<ArrowUpRight />}>
                                Refresh
                            </IOSButton>
                        </div>
                    </div>

                    <IOSCard className="p-0 overflow-hidden">
                        {/* Filters and Search */}
                        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/50">
                            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                                <button
                                    onClick={() => setFilterStatus('all')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${filterStatus === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                                >
                                    All Invoices
                                </button>
                                <button
                                    onClick={() => setFilterStatus('unpaid')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${filterStatus === 'unpaid' ? 'bg-red-100 text-red-700' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                                >
                                    Unpaid
                                </button>
                                <button
                                    onClick={() => setFilterStatus('paid')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${filterStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                                >
                                    Paid
                                </button>
                                <button
                                    onClick={() => setFilterStatus('posted_to_audit')}
                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${filterStatus === 'posted_to_audit' ? 'bg-blue-100 text-blue-700' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
                                >
                                    For Audit
                                </button>
                            </div>

                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search invoice # or customer..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                />
                            </div>
                        </div>

                        {/* Invoice Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-3 font-medium">Invoice #</th>
                                        <th className="px-6 py-3 font-medium">Customer</th>
                                        <th className="px-6 py-3 font-medium">Date</th>
                                        <th className="px-6 py-3 font-medium">Due Date</th>
                                        <th className="px-6 py-3 font-medium text-right">Amount</th>
                                        <th className="px-6 py-3 font-medium text-right">Balance</th>
                                        <th className="px-6 py-3 font-medium text-center">Status</th>
                                        <th className="px-6 py-3 font-medium text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex flex-col items-center justify-center">
                                                    <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                                    Loading invoices...
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filteredInvoices.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex flex-col items-center justify-center">
                                                    <FileText className="h-10 w-10 text-gray-300 mb-2" />
                                                    <p>No invoices found matching current filters.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredInvoices.map((invoice) => (
                                            <tr key={invoice.id} className="hover:bg-gray-50/50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-blue-600">
                                                    {invoice.invoice_number}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium text-gray-900">{invoice.customer?.customer_name || 'Unknown Customer'}</div>
                                                    <div className="text-xs text-gray-500">{invoice.customer?.email}</div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                                                    {new Date(invoice.invoice_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                                                    {new Date(invoice.due_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-gray-900">
                                                    {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(invoice.total_amount)}
                                                </td>
                                                <td className="px-6 py-4 text-right text-gray-600">
                                                    {new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(invoice.balance)}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(invoice.status)} capitalize`}>
                                                            {invoice.status.replace(/_/g, ' ')}
                                                        </span>
                                                        {invoice.is_flagged && (
                                                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 uppercase">
                                                                <Flag className="h-3 w-3 fill-red-600" /> Flagged
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => setSelectedInvoice(invoice)}
                                                            className="text-blue-600 hover:text-blue-800 transition-colors p-1"
                                                            title="View Details"
                                                        >
                                                            <ArrowUpRight className="h-4 w-4" />
                                                        </button>
                                                        {invoice.status === 'verified' ? (
                                                            <CheckCircle className="h-4 w-4 text-green-500" />
                                                        ) : (
                                                            <button
                                                                onClick={() => handleAction('verify', invoice)}
                                                                className="text-green-600 hover:text-green-800 transition-colors p-1"
                                                                title="Quick Verify"
                                                            >
                                                                <ShieldCheck className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => {
                                                                setSelectedInvoice(invoice);
                                                                setFlagModalOpen(true);
                                                            }}
                                                            className={`${invoice.is_flagged ? 'text-red-600 hover:text-red-800' : 'text-gray-400 hover:text-gray-600'} transition-colors p-1`}
                                                            title="Flag for Watchlist"
                                                        >
                                                            <Flag className={`h-4 w-4 ${invoice.is_flagged ? 'fill-red-600' : ''}`} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>

                    {/* View Details Modal */}
                    {selectedInvoice && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                                <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Invoice {selectedInvoice.invoice_number}</h2>
                                        <p className="text-sm text-gray-500">{new Date(selectedInvoice.invoice_date).toLocaleDateString()}</p>
                                    </div>
                                    <button onClick={() => setSelectedInvoice(null)} className="text-gray-400 hover:text-gray-600">
                                        <span className="sr-only">Close</span>
                                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                <div className="p-6 space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Customer</h3>
                                            <p className="font-medium text-gray-900">{selectedInvoice.customer?.customer_name || 'N/A'}</p>
                                            <p className="text-sm text-gray-500">{selectedInvoice.customer?.email}</p>
                                        </div>
                                        <div className="text-right">
                                            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</h3>
                                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(selectedInvoice.status)} capitalize`}>
                                                {selectedInvoice.status.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Items</h3>
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <div className="flex justify-between items-center py-2 border-b border-gray-200">
                                                <span className="font-medium">Total Amount</span>
                                                <span className="font-bold text-lg">{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(selectedInvoice.total_amount)}</span>
                                            </div>
                                            <div className="flex justify-between items-center py-2 text-gray-600">
                                                <span>Balance Due</span>
                                                <span>{new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(selectedInvoice.balance)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Auditor Actions</h3>
                                        <div className="flex flex-wrap gap-2">
                                            <IOSButton
                                                variant="secondary"
                                                onClick={() => handleAction('verify', selectedInvoice)}
                                                disabled={isSubmitting || selectedInvoice.status === 'verified'}
                                                className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                                                leftIcon={<ShieldCheck className="h-4 w-4" />}
                                            >
                                                {selectedInvoice.status === 'verified' ? 'Verified' : 'Verify & Clear'}
                                            </IOSButton>

                                            <IOSButton
                                                variant="secondary"
                                                onClick={() => setFlagModalOpen(true)}
                                                disabled={isSubmitting}
                                                className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                                leftIcon={<Flag className="h-4 w-4" />}
                                            >
                                                Flag for Watchlist
                                            </IOSButton>

                                            {selectedInvoice.is_flagged && (
                                                <IOSButton
                                                    variant="secondary"
                                                    onClick={() => handleAction('clear', selectedInvoice)}
                                                    disabled={isSubmitting}
                                                    className="bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                                                    leftIcon={<CheckCircle className="h-4 w-4" />}
                                                >
                                                    Dismiss Flag
                                                </IOSButton>
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-gray-500 uppercase">Audit Notes</label>
                                            <textarea
                                                value={auditNotes}
                                                onChange={(e) => setAuditNotes(e.target.value)}
                                                placeholder="Enter verification notes..."
                                                className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 min-h-[60px]"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                        <IOSButton variant="secondary" onClick={() => setSelectedInvoice(null)}>Close</IOSButton>
                                        <button
                                            onClick={() => printInvoicePDF(selectedInvoice! as any)}
                                            className="px-4 py-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-2 font-semibold"
                                        >
                                            <Printer className="h-4 w-4" />
                                            Print
                                        </button>
                                        <IOSButton onClick={() => downloadInvoicePDF(selectedInvoice! as any)} leftIcon={<Download />}>
                                            Download PDF
                                        </IOSButton>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Flag Modal */}
                    {flagModalOpen && selectedInvoice && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                                <div className="p-6 border-b border-gray-100 bg-amber-50 flex items-center gap-3">
                                    <div className="p-2 bg-amber-100 rounded-full">
                                        <ShieldAlert className="h-6 w-6 text-amber-600" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-gray-900">Flag for Watchlist</h2>
                                        <p className="text-xs text-amber-700">Invoice {selectedInvoice.invoice_number}</p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Reason for Flagging</label>
                                        <select
                                            value={flagReason}
                                            onChange={(e) => setFlagReason(e.target.value)}
                                            className="w-full p-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500"
                                        >
                                            <option value="">Select a reason...</option>
                                            <option value="Duplicate Invoice">Duplicate Invoice</option>
                                            <option value="Incorrect Amount">Incorrect Amount</option>
                                            <option value="Unusual Activity">Unusual Activity</option>
                                            <option value="Missing Documentation">Missing Documentation</option>
                                            <option value="Audit Conflict">Audit Conflict</option>
                                            <option value="Other">Other (specify below)</option>
                                        </select>
                                    </div>

                                    {flagReason === 'Other' && (
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Specific Details</label>
                                            <textarea
                                                placeholder="Enter detailed reason..."
                                                className="w-full p-3 border border-gray-200 rounded-lg text-sm min-h-[100px] focus:ring-2 focus:ring-amber-500"
                                            />
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-2">
                                        <IOSButton
                                            variant="secondary"
                                            className="flex-1"
                                            onClick={() => setFlagModalOpen(false)}
                                        >
                                            Cancel
                                        </IOSButton>
                                        <IOSButton
                                            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                                            onClick={() => handleAction('flag', selectedInvoice)}
                                            disabled={!flagReason || isSubmitting}
                                        >
                                            Submit Flag
                                        </IOSButton>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
