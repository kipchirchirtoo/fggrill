'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { CreditCard, Plus, Filter, Search, CheckCircle, XCircle, Clock, FileText, Download } from 'lucide-react';
import { toast } from 'sonner';
import { financeAPI, searchAPI } from '@/lib/api';

export default function BranchPaymentsPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [activeTab, setActiveTab] = useState<'search' | 'confirmed' | 'pending' | 'void'>('search');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    // Mock data for other tabs until DB is ready
    const [confirmedPayments, setConfirmedPayments] = useState<any[]>([]);
    const [pendingPayments, setPendingPayments] = useState<any[]>([]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const response = await searchAPI.universalSearch(searchQuery);
            if (response.success && response.data) {
                // Filter specifically for payment-related items (orders, bookings, bills, transactions)
                const paymentItems = response.data.filter((item: any) =>
                    ['order', 'booking', 'bill', 'receipt', 'transaction'].includes(item.type)
                ).map((item: any) => {
                    // Extract amount, ensuring we handle both string and numeric types from backend
                    let amountValue = item.metadata?.amount || 0;
                    if (typeof amountValue === 'string') {
                        amountValue = parseFloat(amountValue.replace(/[^0-9.]/g, '')) || 0;
                    }

                    return {
                        id: item.id,
                        type: item.type === 'transaction' ? 'Payment' : item.type.charAt(0).toUpperCase() + item.type.slice(1),
                        reference: item.metadata?.order_number || item.metadata?.bill_number || item.metadata?.reference || item.title,
                        amount: amountValue,
                        customer: item.metadata?.guest_name || item.metadata?.customer_name || 'Walk-in',
                        date: item.metadata?.created_at || item.metadata?.date || new Date().toISOString().split('T')[0],
                        status: item.metadata?.payment_status || item.metadata?.status || 'Pending'
                    };
                });
                setSearchResults(paymentItems);
                if (paymentItems.length === 0) {
                    toast.info('No payment records found matching your query');
                }
            } else {
                setSearchResults([]);
                toast.info('No results found');
            }
        } catch (error) {
            console.error('Search error:', error);
            toast.error('Failed to search payments');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmPayment = async (id: string) => {
        // API call to confirm payment: financeAPI.confirmPayment(id)
        toast.success('Payment confirmed and sent to Auditor');
        // Update local state for demo
        const item = searchResults.find(i => i.id === id);
        if (item) {
            setConfirmedPayments([...confirmedPayments, { ...item, status: 'Confirmed', confirmed_at: new Date().toISOString() }]);
            setSearchResults(searchResults.filter(i => i.id !== id));
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <CreditCard className="h-6 w-6 text-blue-600" />
                                Payments
                            </h1>
                            <p className="text-gray-500">Record, search, and verify branch payments to send to Auditor.</p>
                        </div>
                        {/* <IOSButton onClick={() => toast.info('New Payment Modal')} leftIcon={<Plus />}>Record Payment</IOSButton> */}
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 overflow-x-auto">
                        {[
                            { id: 'search', label: 'Search & Verify', icon: Search },
                            { id: 'confirmed', label: 'Confirmed (Sent to Auditor)', icon: CheckCircle },
                            { id: 'pending', label: 'Pending', icon: Clock },
                            { id: 'void', label: 'Void/Unconfirmed', icon: XCircle },
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <IOSCard className="p-0 min-h-[400px]">
                        {activeTab === 'search' && (
                            <div className="p-6">
                                <div className="max-w-xl mx-auto mb-8">
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                                        <input
                                            type="text"
                                            placeholder="Search by Bill #, Receipt #, Guest Name, or Order ID..."
                                            className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                        <button
                                            onClick={handleSearch}
                                            disabled={loading}
                                            className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                                        >
                                            {loading ? 'Searching...' : 'Search'}
                                        </button>
                                    </div>
                                    <p className="text-center text-gray-400 text-sm mt-2">
                                        Search for branch payments, branch orders, hotel bookings, or conference bookings.
                                    </p>
                                </div>

                                {searchResults.length > 0 ? (
                                    <div className="space-y-4">
                                        <h3 className="font-semibold text-gray-900">Search Results</h3>
                                        {searchResults.map(result => (
                                            <div key={result.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                                <div className="flex items-start gap-4">
                                                    <div className="p-2 bg-white rounded-md shadow-sm">
                                                        <FileText className="h-6 w-6 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-gray-900">{result.type} #{result.reference}</div>
                                                        <div className="text-sm text-gray-500">{result.customer} • {result.date}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <div className="font-bold text-gray-900">KES {result.amount.toLocaleString()}</div>
                                                        <div className="text-xs text-amber-600 font-medium">{result.status}</div>
                                                    </div>
                                                    <IOSButton size="sm" onClick={() => handleConfirmPayment(result.id)}>Confirm Payment</IOSButton>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : searchQuery && !loading && (
                                    <div className="text-center py-12 text-gray-500">
                                        <Search className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                                        <p>No results found for "{searchQuery}"</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'confirmed' && (
                            <div className="p-0">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3">Reference</th>
                                            <th className="px-6 py-3">Type</th>
                                            <th className="px-6 py-3">Customer</th>
                                            <th className="px-6 py-3 text-right">Amount</th>
                                            <th className="px-6 py-3">Confirmed At</th>
                                            <th className="px-6 py-3">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {confirmedPayments.length === 0 ? (
                                            <tr><td colSpan={6} className="py-12 text-center text-gray-500">No confirmed payments yet.</td></tr>
                                        ) : (
                                            confirmedPayments.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 font-medium">{item.reference}</td>
                                                    <td className="px-6 py-4">{item.type}</td>
                                                    <td className="px-6 py-4">{item.customer}</td>
                                                    <td className="px-6 py-4 text-right font-medium">KES {item.amount.toLocaleString()}</td>
                                                    <td className="px-6 py-4 text-gray-500">{new Date(item.confirmed_at).toLocaleString()}</td>
                                                    <td className="px-6 py-4"><span className="text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Sent to Auditor</span></td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {(activeTab === 'pending' || activeTab === 'void') && (
                            <div className="text-center py-20 text-gray-500">
                                <Clock className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                                <p>No {activeTab} payments found.</p>
                            </div>
                        )}
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
