'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { FileText, Plus, Search, Building2, User, ShoppingBag, CheckCircle, Download, Printer } from 'lucide-react';
import { toast } from 'sonner';

import { CreateInvoiceModal } from '@/components/dashboard/branch/CreateInvoiceModal';
import { api } from '@/lib/api';
import { downloadInvoicePDF, printInvoicePDF } from '@/lib/invoice-pdf';

/* 
 * Explicitly define Invoice interface 
 */
interface InvoiceData {
    id: string;
    invoice_number: string;
    customer?: {
        customer_name: string;
        email: string;
    };
    invoice_date: string;
    due_date: string;
    subtotal: number;
    vat_amount: number;
    total_amount: number;
    balance: number;
    status: string;
    items?: any[];
    notes?: string;
    reference_number?: string;
}

export default function BranchInvoicesPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [invoices, setInvoices] = useState<InvoiceData[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'CONFERENCE' | 'GUEST' | 'GENERAL'>('all');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createType, setCreateType] = useState<'conference' | 'guest' | 'general' | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchInvoices = async () => {
        setLoading(true);
        try {
            const response = await api.accounting.getInvoices();
            if (response.success) {
                const mappedData = response.data.map((inv: any) => ({
                    ...inv,
                    subtotal: inv.subtotal || inv.total_amount || 0,
                    vat_amount: inv.vat_amount || 0
                }));
                setInvoices(mappedData);
            }
        } catch (error) {
            console.error('Error fetching invoices:', error);
            toast.error('Failed to load invoices');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleCreate = (type: 'conference' | 'guest' | 'general') => {
        setCreateType(type);
        setShowCreateModal(true);
    };

    const handleSuccess = () => {
        fetchInvoices();
        toast.success("Invoice created and sent to Auditor");
    };

    const filteredInvoices = invoices.filter(invoice => {
        const matchesSearch =
            invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            invoice.customer?.customer_name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesTab = activeTab === 'all' || (invoice as any).type === activeTab;
        return matchesSearch && matchesTab;
    });

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'paid': return 'text-green-600 bg-green-50 border-green-200';
            case 'unpaid': return 'text-red-600 bg-red-50 border-red-200';
            case 'draft': return 'text-gray-600 bg-gray-50 border-gray-200';
            default: return 'text-blue-600 bg-blue-50 border-blue-200';
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <FileText className="h-6 w-6 text-blue-600" />
                                Branch Invoices (Beta)
                            </h1>
                            <p className="text-gray-500">Manage and export branch accounting invoices.</p>
                        </div>

                        <div className="flex gap-2">
                            <IOSButton onClick={() => handleCreate('conference')} leftIcon={<Building2 />}>Conference</IOSButton>
                            <IOSButton variant="secondary" onClick={() => handleCreate('guest')} leftIcon={<User />}>Guest</IOSButton>
                            <IOSButton variant="secondary" onClick={fetchInvoices} leftIcon={<CheckCircle />}>Refresh</IOSButton>
                        </div>
                    </div>

                    <IOSCard className="p-0">
                        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-50/50">
                            <div className="flex gap-4">
                                <button onClick={() => setActiveTab('all')} className={`text-sm font-medium ${activeTab === 'all' ? 'text-blue-600' : 'text-gray-500'}`}>All</button>
                                <button onClick={() => setActiveTab('CONFERENCE')} className={`text-sm font-medium ${activeTab === 'CONFERENCE' ? 'text-blue-600' : 'text-gray-500'}`}>Conference</button>
                                <button onClick={() => setActiveTab('GUEST')} className={`text-sm font-medium ${activeTab === 'GUEST' ? 'text-blue-600' : 'text-gray-500'}`}>Guest</button>
                            </div>
                            <div className="relative w-full md:w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-3 py-1.5 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-3">Invoice #</th>
                                        <th className="px-6 py-3">Customer</th>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3 text-right">Amount</th>
                                        <th className="px-6 py-3 text-center">Status</th>
                                        <th className="px-6 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {loading ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading...</td></tr>
                                    ) : filteredInvoices.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-gray-400">No invoices found.</td></tr>
                                    ) : (
                                        filteredInvoices.map((inv) => (
                                            <tr key={inv.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-blue-600">{inv.invoice_number}</td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium">{inv.customer?.customer_name || 'N/A'}</div>
                                                    <div className="text-xs text-gray-500">{inv.customer?.email}</div>
                                                </td>
                                                <td className="px-6 py-4 text-gray-500">{new Date(inv.invoice_date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-right font-medium">KES {inv.total_amount.toLocaleString()}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(inv.status)}`}>
                                                        {inv.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="flex justify-center gap-2">
                                                        <button
                                                            onClick={() => downloadInvoicePDF(inv)}
                                                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                            title="Download PDF"
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => printInvoicePDF(inv)}
                                                            className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                                                            title="Print"
                                                        >
                                                            <Printer className="h-4 w-4" />
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
                </div>
            </DashboardLayout>
            <CreateInvoiceModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                type={createType}
                onSuccess={handleSuccess}
            />
        </ProtectedRoute>
    );
}
