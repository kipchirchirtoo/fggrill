'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams, useParams } from 'next/navigation';
import {
    ArrowLeft, Search, Filter, Calendar,
    RefreshCw, Download, ChevronRight,
    Wallet, Smartphone, CreditCard, Building2,
    CheckCircle2, AlertCircle, Clock, FileText,
    User, ShoppingBag, Receipt
} from 'lucide-react';
import { auditAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function TransactionLogDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const logId = params.logId as string;

    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [transaction, setTransaction] = useState<any>(null);
    const [details, setDetails] = useState<any>(null);

    const dateParam = searchParams.get('date');
    const [selectedDate, setSelectedDate] = useState(dateParam || new Date().toISOString().split('T')[0]);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.verifyFinances({
                date: selectedDate,
                limit: 'all'
            });

            if (res.success) {
                setData(res); // Store full response

                // Find in recent transactions
                const tx = res.data?.recent_transactions?.find((t: any) => String(t.id) === String(logId));
                setTransaction(tx);

                if (tx) {
                    // Enrich with deep details
                    if (tx.is_pool_token) {
                        const poolTx = res.orders?.pool_tokens?.find((p: any) => String(p.id) === String(logId));
                        setDetails({ type: 'pool', data: poolTx });
                    } else {
                        const originalPayment = res.payments?.find((p: any) => String(p.id) === String(logId));
                        if (originalPayment) {
                            let linkedOrder = null;
                            let linkedType = 'generic';

                            if (originalPayment.restaurant_order_id) {
                                linkedOrder = res.orders?.restaurant?.find((o: any) => String(o.id) === String(originalPayment.restaurant_order_id));
                                linkedType = 'restaurant';
                            } else if (originalPayment.bar_order_id) {
                                linkedOrder = res.orders?.bar?.find((o: any) => String(o.id) === String(originalPayment.bar_order_id));
                                linkedType = 'bar';
                            } else if (originalPayment.pos_transaction_id) {
                                linkedOrder = res.pos_transactions?.find((p: any) => String(p.id) === String(originalPayment.pos_transaction_id));
                                linkedType = 'pos';
                            }

                            setDetails({ type: linkedType, data: originalPayment, order: linkedOrder });
                        }
                    }
                }
            } else {
                toast.error(res.message || 'Failed to fetch log details');
            }
        } catch (e) {
            console.error("Log detail fetch failed:", e);
            toast.error('An error occurred while fetching log details');
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate, logId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getStatusBadge = (status: string) => {
        const styles = status === 'completed' || status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
            status === 'cancelled' || status === 'voided' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                'bg-amber-50 text-amber-700 border-amber-100';
        const icon = status === 'completed' || status === 'paid' ? <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> : <AlertCircle className="h-3.5 w-3.5 mr-1" />;

        return (
            <div className={`inline-flex items-center px-3 py-1 rounded-full border ${styles}`}>
                {icon}
                <span className="text-xs font-bold uppercase tracking-wide">{status}</span>
            </div>
        );
    };

    if (isLoading) {
        return (
            <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
                <DashboardLayout>
                    <div className="flex flex-col items-center justify-center min-h-[60vh]">
                        <RefreshCw className="h-10 w-10 animate-spin text-stone-300 mb-4" />
                        <p className="font-medium text-stone-500">Retrieving detailed audit trail...</p>
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    if (!transaction) {
        return (
            <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
                <DashboardLayout>
                    <div className="max-w-3xl mx-auto py-12 text-center">
                        <AlertCircle className="h-12 w-12 text-stone-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-stone-900">Transaction Not Found</h2>
                        <p className="text-stone-500 mt-2 mb-6">Could not locate transaction ID {logId} in the records for {selectedDate}.</p>
                        <button onClick={() => router.back()} className="btn-primary">Return to List</button>
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="max-w-4xl mx-auto space-y-6 pb-20">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5 text-stone-500" />
                        </button>
                        <div>
                            <h1 className="page-title text-xl md:text-2xl">Transaction Details</h1>
                            <p className="text-sm text-stone-400 font-mono mt-1">REF: {transaction.reference_number || logId}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Main Info Card */}
                        <div className="md:col-span-2 space-y-6">
                            <div className="card-elevated bg-white p-6 shadow-sm border border-stone-200">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Total Amount</p>
                                        <p className="text-3xl font-black text-stone-900">KES {Number(transaction.amount).toLocaleString()}</p>
                                    </div>
                                    {getStatusBadge(transaction.status)}
                                </div>

                                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-stone-100">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Building2 className="h-4 w-4 text-stone-400" />
                                            <span className="text-xs font-bold text-stone-500 uppercase">Branch</span>
                                        </div>
                                        <p className="font-bold text-stone-900">{transaction.branch_name}</p>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <User className="h-4 w-4 text-stone-400" />
                                            <span className="text-xs font-bold text-stone-500 uppercase">Cashier</span>
                                        </div>
                                        <p className="font-bold text-stone-900">{transaction.cashier_name}</p>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Clock className="h-4 w-4 text-stone-400" />
                                            <span className="text-xs font-bold text-stone-500 uppercase">Timestamp</span>
                                        </div>
                                        <p className="font-bold text-stone-900">{format(new Date(transaction.created_at), 'MMM d, yyyy HH:mm:ss')}</p>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Wallet className="h-4 w-4 text-stone-400" />
                                            <span className="text-xs font-bold text-stone-500 uppercase">Method</span>
                                        </div>
                                        <p className="font-bold text-stone-900 capitalize">{transaction.payment_method?.replace('_', ' ')}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Deep Detail View */}
                            {details && details.order && (
                                <div className="card-elevated bg-stone-50 p-6 shadow-sm border border-stone-200">
                                    <h3 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2">
                                        <ShoppingBag className="h-4 w-4 text-stone-400" />
                                        Linked Order Information
                                    </h3>

                                    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
                                        <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex justify-between">
                                            <span className="font-mono text-xs font-bold text-stone-500">
                                                {details.type === 'restaurant' ? 'RESTAURANT ORDER' : 'BAR ORDER'}
                                            </span>
                                            {details.order.order_number && (
                                                <span className="font-mono text-xs font-bold text-stone-900">#{details.order.order_number}</span>
                                            )}
                                        </div>
                                        <div className="p-4">
                                            {details.order.items && details.order.items.length > 0 ? (
                                                <div className="space-y-3">
                                                    {details.order.items.map((item: any, i: number) => (
                                                        <div key={i} className="flex justify-between items-center text-sm">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-stone-400 w-6 text-center">{item.quantity}x</span>
                                                                <span className="font-medium text-stone-700">
                                                                    {item.menu_item?.name || item.stock_item?.item_name || 'Item'}
                                                                </span>
                                                            </div>
                                                            <span className="font-bold text-stone-900">
                                                                {Number(item.price || item.unit_price || 0).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    ))}
                                                    <div className="border-t border-dashed border-stone-200 mt-3 pt-3 flex justify-between">
                                                        <span className="font-bold text-stone-900">Total</span>
                                                        <span className="font-black text-stone-900">KES {Number(details.order.total_amount || details.order.total).toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-stone-400 italic text-sm">Item details not available</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {details && details.type === 'pool' && (
                                <div className="card-elevated bg-amber-50/50 p-6 shadow-sm border border-amber-100">
                                    <h3 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                                        <Receipt className="h-4 w-4" />
                                        Pool Token Sale
                                    </h3>
                                    <p className="text-sm text-amber-800">
                                        Sold <strong>{details.data?.quantity || 1}</strong> token(s) at <strong>KES {details.data?.amount_per_token}</strong> each.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Sidebar / Metadata */}
                        <div className="space-y-4">
                            <div className="card-elevated bg-white p-5 shadow-sm border border-stone-200">
                                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Metadata</h3>
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-[10px] uppercase text-stone-400 font-bold">Transaction ID</span>
                                        <p className="font-mono text-xs text-stone-700 break-all bg-stone-50 p-1.5 rounded mt-1">{logId}</p>
                                    </div>
                                    {details && details.data && (
                                        <div>
                                            <span className="text-[10px] uppercase text-stone-400 font-bold">Raw Payment Ref</span>
                                            <p className="font-mono text-xs text-stone-700 break-all bg-stone-50 p-1.5 rounded mt-1">{details.data.reference || details.data.id}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <FileText className="h-5 w-5 text-blue-500 mt-0.5" />
                                    <div>
                                        <h4 className="text-sm font-bold text-blue-900">Audit Verification</h4>
                                        <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                                            This transaction has been successfully logged and verified against the daily financial reconciliation record.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}