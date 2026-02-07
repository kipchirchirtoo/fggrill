'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { auditAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import {
    AlertTriangle, ArrowLeft, Calendar, User, Clock,
    FileText, CheckCircle2, XCircle, ShoppingBag,
    CreditCard, DollarSign, Wallet, Store, ShieldAlert,
    ChevronRight, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AnomalyDetailPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const id = params.id as string;
    const type = searchParams.get('type');

    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
    const [flagReason, setFlagReason] = useState('');
    const [flagSeverity, setFlagSeverity] = useState('MEDIUM');
    const [isSubmittingFlag, setIsSubmittingFlag] = useState(false);

    const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
    const [verifyNotes, setVerifyNotes] = useState('');
    const [isSubmittingVerify, setIsSubmittingVerify] = useState(false);

    const fetchData = useCallback(async () => {
        if (!id || !type) return;
        setIsLoading(true);
        try {
            const res = await auditAPI.getAnomalyDetail({ id, type });
            if (res.success) {
                setData(res.data);
            } else {
                toast.error(res.message || 'Failed to fetch details');
            }
        } catch (e) {
            console.error(e);
            toast.error('An error occurred while fetching details');
        } finally {
            setIsLoading(false);
        }
    }, [id, type]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleViewAuditTrail = () => {
        router.push(`/dashboard/auditor/financial-verification/logs?entity_id=${id}&entity_type=${type}`);
    };

    const handleFlagSubmit = async () => {
        if (!flagReason.trim()) {
            toast.error('Please provide a reason for flagging this record');
            return;
        }

        setIsSubmittingFlag(true);
        try {
            const payload = {
                exception_type: type?.toUpperCase() || 'UNKNOWN',
                reference_type: type,
                reference_id: id,
                description: flagReason,
                severity: flagSeverity,
                status: 'open'
            };

            const res = await auditAPI.createException(payload);

            if (res.success || res.ok) {
                toast.success('Record flagged for review. An Audit Exception has been created.');
                setIsFlagModalOpen(false);
                setFlagReason('');
                fetchData(); // Refresh to show linked exception or status change
            } else {
                toast.error(res.message || 'Failed to flag record');
            }
        } catch (error) {
            console.error('Error flagging record:', error);
            toast.error('Failed to submit flag request');
        } finally {
            setIsSubmittingFlag(false);
        }
    };

    const handleVerifySubmit = async () => {
        setIsSubmittingVerify(true);
        try {
            const res = await auditAPI.clearAnomaly({
                id,
                type: type || 'unknown',
                notes: verifyNotes
            });

            if (res.success) {
                toast.success('Transaction verified and cleared');
                setIsVerifyModalOpen(false);
                setVerifyNotes('');
                fetchData(); // Refresh data to show auditor info
            } else {
                toast.error(res.message || 'Failed to verify transaction');
            }
        } catch (error) {
            console.error('Error verifying transaction:', error);
            toast.error('Failed to submit verification');
        } finally {
            setIsSubmittingVerify(false);
        }
    };

    if (isLoading) {
        return (
            <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
                <DashboardLayout>
                    <div className="flex flex-col items-center justify-center min-h-[60vh]">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-900 mb-4"></div>
                        <p className="text-stone-500 font-medium">Retrieving anomaly data...</p>
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    if (!data) {
        return (
            <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
                <DashboardLayout>
                    <div className="p-8 text-center">
                        <AlertTriangle className="h-12 w-12 text-stone-300 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-stone-900">Record Not Found</h2>
                        <p className="text-stone-500 mt-2">The requested record could not be located.</p>
                        <button
                            onClick={() => router.back()}
                            className="mt-6 btn-secondary"
                        >
                            Go Back
                        </button>
                    </div>
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    const getStatusBadge = (status: string) => {
        const isVerified = data?.auditor_id || data?.audited_at || status === 'resolved' || status === 'verified' || status === 'approved';
        const hasOpenExceptions = data?.linked_exceptions?.some((e: any) => e.status !== 'resolved');

        if (isVerified) {
            return (
                <div className="bg-emerald-500 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide inline-flex items-center gap-1.5 shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Verified / Audited
                </div>
            );
        }

        if (hasOpenExceptions) {
            return (
                <div className="bg-rose-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide inline-flex items-center gap-1.5 shadow-sm">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Flagged for Review
                </div>
            );
        }

        const styles = ['completed', 'paid', 'delivered'].includes(status) ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
            ['cancelled', 'voided', 'rejected'].includes(status) ? 'bg-rose-50 text-rose-700 border-rose-100' :
                'bg-amber-50 text-amber-700 border-amber-100';

        return (
            <div className={`px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wide inline-flex items-center gap-1.5 ${styles}`}>
                <span className="w-2 h-2 rounded-full bg-current" />
                {status}
            </div>
        );
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="max-w-4xl mx-auto space-y-8 pb-12">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.back()}
                            className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-500 hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-sm"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
                                    {type?.replace('_', ' ')}
                                </span>
                                <span className="text-stone-300">•</span>
                                <span className="font-mono text-xs text-stone-400">ID: {id.substring(0, 8)}</span>
                            </div>
                            <h1 className="text-2xl font-bold text-stone-900">
                                {type === 'exception' ? 'Audit Exception Detail' :
                                    type === 'bill' ? 'Unpaid Bill Record' :
                                        'Order Transaction Detail'}
                            </h1>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 space-y-6">
                            {/* Main Content Card */}
                            <div className="card-elevated bg-white p-6 shadow-sm border border-stone-200">
                                <div className="flex items-start justify-between mb-8 border-b border-stone-100 pb-6">
                                    <div>
                                        <h2 className="text-lg font-bold text-stone-900 mb-1">
                                            {data.order_number ? `Order #${data.order_number}` :
                                                data.branch ? `${data.branch.name} Record` : 'Transaction Info'}
                                        </h2>
                                        <div className="flex flex-col gap-2">
                                            <p className="text-sm text-stone-500 flex items-center gap-2">
                                                <Clock className="h-3.5 w-3.5" />
                                                {format(new Date(data.created_at || data.detected_at || new Date()), 'PPpp')}
                                            </p>
                                            <div className="flex flex-wrap gap-x-4 gap-y-1">
                                                {data.branch && (
                                                    <span className="text-[11px] font-bold text-stone-500 uppercase flex items-center gap-1.5">
                                                        <Store className="h-3 w-3" /> {data.branch.name}
                                                    </span>
                                                )}
                                                {data.waiter && (
                                                    <span className="text-[11px] font-bold text-stone-500 uppercase flex items-center gap-1.5">
                                                        <User className="h-3 w-3" /> {data.waiter.first_name} {data.waiter.last_name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    {data.status && getStatusBadge(data.status)}
                                </div>

                                {type === 'exception' ? (
                                    <div className="space-y-4">
                                        <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
                                            <div className="flex items-start gap-3">
                                                <ShieldAlert className="h-5 w-5 text-rose-500 mt-0.5" />
                                                <div>
                                                    <h3 className="text-sm font-bold text-rose-900">Exception Description</h3>
                                                    <p className="text-sm text-rose-800 mt-1 leading-relaxed">{data.description}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-stone-50 rounded-xl">
                                                <p className="text-xs font-bold text-stone-400 uppercase mb-1">Severity</p>
                                                <p className={`font-bold ${data.severity === 'HIGH' ? 'text-rose-600' :
                                                    data.severity === 'MEDIUM' ? 'text-amber-600' : 'text-blue-600'
                                                    }`}>{data.severity}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (type === 'restaurant_order' || type === 'bar_order') ? (
                                    <div className="space-y-6">
                                        {/* Order Items */}
                                        <div>
                                            <h3 className="text-sm font-bold text-stone-900 uppercase tracking-widest mb-3">Order Items</h3>
                                            <div className="border border-stone-100 rounded-xl overflow-hidden">
                                                <table className="w-full">
                                                    <thead className="bg-stone-50">
                                                        <tr>
                                                            <th className="px-4 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Item</th>
                                                            <th className="px-4 py-3 text-center text-[11px] font-bold text-stone-500 uppercase">Qty</th>
                                                            <th className="px-4 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Price</th>
                                                            <th className="px-4 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-stone-50">
                                                        {data.items?.map((item: any, i: number) => (
                                                            <tr key={i} className="hover:bg-stone-50/50">
                                                                <td className="px-4 py-3 text-sm font-medium text-stone-900">
                                                                    {item.drink_name || item.menu_item?.name || item.stock_item?.name || item.item_name || 'Unknown Item'}
                                                                </td>
                                                                <td className="px-4 py-3 text-center text-sm font-bold text-stone-600">
                                                                    {item.quantity}
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-sm text-stone-600">
                                                                    {Number(item.price || item.unit_price || 0).toLocaleString()}
                                                                </td>
                                                                <td className="px-4 py-3 text-right text-sm font-bold text-stone-900">
                                                                    {Number((item.price || item.unit_price || 0) * item.quantity).toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                    <tfoot className="bg-stone-50 border-t border-stone-100">
                                                        <tr>
                                                            <td colSpan={3} className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Total Amount</td>
                                                            <td className="px-4 py-3 text-right text-lg font-black text-stone-900">
                                                                KES {Number(data.total_amount || data.total || 0).toLocaleString()}
                                                            </td>
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Generic / Bill View */}
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-stone-50 rounded-xl">
                                                <p className="text-xs font-bold text-stone-400 uppercase mb-1">Total Due</p>
                                                <p className="text-2xl font-black text-stone-900">KES {Number(data.total_amount).toLocaleString()}</p>
                                            </div>
                                            <div className="p-4 bg-stone-50 rounded-xl">
                                                <p className="text-xs font-bold text-stone-400 uppercase mb-1">Paid Amount</p>
                                                <p className="text-2xl font-black text-emerald-600">KES {Number(data.paid_amount || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        {Number(data.total_amount) - Number(data.paid_amount || 0) > 0 && (
                                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-center justify-between">
                                                <span className="font-bold text-amber-800">Outstanding Balance</span>
                                                <span className="font-black text-amber-900 text-lg">
                                                    KES {(Number(data.total_amount) - Number(data.paid_amount || 0)).toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Linked Exceptions (Flags) */}
                            {data.linked_exceptions && data.linked_exceptions.length > 0 && (
                                <div className="space-y-4">
                                    <h3 className="text-sm font-bold text-stone-900 uppercase tracking-widest flex items-center gap-2 px-1">
                                        <ShieldAlert className="h-4 w-4 text-rose-500" /> Audit Exceptions ({data.linked_exceptions.length})
                                    </h3>
                                    <div className="space-y-3">
                                        {data.linked_exceptions.map((exc: any, i: number) => (
                                            <div key={i} className={`p-4 rounded-xl border ${exc.status === 'open' ? 'bg-rose-50 border-rose-100' : 'bg-stone-50 border-stone-200'} transition-all`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${exc.severity === 'HIGH' ? 'bg-rose-500 text-white' : exc.severity === 'MEDIUM' ? 'bg-amber-500 text-white' : 'bg-blue-500 text-white'}`}>
                                                        {exc.severity} PRIORITY
                                                    </span>
                                                    <span className="text-[10px] text-stone-400 font-medium">
                                                        Created {format(new Date(exc.detected_at || exc.created_at), 'MMM d, HH:mm')}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-stone-800 mb-1">{exc.description}</p>
                                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-100">
                                                    <span className={`text-[10px] font-black uppercase ${exc.status === 'open' ? 'text-rose-600' : 'text-stone-400'}`}>
                                                        Status: {exc.status}
                                                    </span>
                                                    {exc.status === 'open' && (
                                                        <button
                                                            onClick={() => router.push(`/dashboard/auditor/revenue-oversight/details/${exc.id}?type=exception`)}
                                                            className="text-[11px] font-bold text-stone-900 hover:underline flex items-center gap-1"
                                                        >
                                                            Update Exception <ChevronRight className="h-3 w-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Sidebar Metadata */}
                        <div className="space-y-4">
                            <div className="bg-stone-900 rounded-xl text-white p-6 shadow-lg">
                                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Context Info</h3>

                                <div className="space-y-4">
                                    {data.branch && (
                                        <div>
                                            <div className="flex items-center gap-2 text-stone-400 mb-1">
                                                <Store className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-bold uppercase">Branch</span>
                                            </div>
                                            <p className="font-bold text-white">{data.branch.name}</p>
                                        </div>
                                    )}

                                    {data.waiter && (
                                        <div>
                                            <div className="flex items-center gap-2 text-stone-400 mb-1">
                                                <User className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-bold uppercase">Served By</span>
                                            </div>
                                            <p className="font-bold text-white">{data.waiter.first_name} {data.waiter.last_name}</p>
                                        </div>
                                    )}

                                    {data.table_number && (
                                        <div>
                                            <div className="flex items-center gap-2 text-stone-400 mb-1">
                                                <ShoppingBag className="h-3.5 w-3.5" />
                                                <span className="text-[10px] font-bold uppercase">Table / Location</span>
                                            </div>
                                            <p className="font-bold text-white">Table {data.table_number}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
                                <h3 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Audit Actions</h3>
                                <div className="space-y-2">
                                    <button
                                        onClick={handleViewAuditTrail}
                                        className="w-full btn-secondary justify-start text-xs h-9"
                                    >
                                        <FileText className="h-3.5 w-3.5 mr-2" /> View Audit Trail
                                    </button>

                                    {!data.auditor_id && data.status !== 'resolved' && (
                                        <button
                                            onClick={() => setIsVerifyModalOpen(true)}
                                            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg justify-start text-xs h-9 px-3 inline-flex items-center transition-colors px-4 py-2.5 font-medium"
                                        >
                                            <CheckCircle2 className="h-3.5 w-3.5 mr-2" /> Verify & Clear Anomaly
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setIsFlagModalOpen(true)}
                                        className="w-full btn-secondary justify-start text-xs h-9 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-100"
                                    >
                                        <ShieldAlert className="h-3.5 w-3.5 mr-2" /> Flag for Review
                                    </button>
                                </div>

                                {(data.auditor_id || data.resolved_by) && (
                                    <div className="mt-4 pt-4 border-t border-stone-100">
                                        <div className="flex items-center gap-2 text-emerald-600 mb-1">
                                            <CheckCircle2 className="h-3 w-3" />
                                            <span className="text-[9px] font-bold uppercase">Auditor Verified</span>
                                        </div>
                                        <p className="text-[11px] text-stone-600 italic">
                                            "{data.audit_notes || data.resolution_notes || 'Confirmed and cleared by auditor.'}"
                                        </p>
                                        <p className="text-[10px] text-stone-400 mt-1 font-medium">
                                            {format(new Date(data.audited_at || data.resolved_at), 'PPp')}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Flag for Review Dialog */}
                <Dialog open={isFlagModalOpen} onOpenChange={setIsFlagModalOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle>Flag for Audit Review</DialogTitle>
                            <DialogDescription>
                                Create an exception record for this transaction to alert management or require further investigation.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="severity">Severity Level</Label>
                                <Select value={flagSeverity} onValueChange={setFlagSeverity}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select severity" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LOW">Low - Minor Discrepancy</SelectItem>
                                        <SelectItem value="MEDIUM">Medium - Review Required</SelectItem>
                                        <SelectItem value="HIGH">High - Critical Issue</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="reason">Detailed Reason</Label>
                                <Textarea
                                    id="reason"
                                    placeholder="Explain why this record is being flagged..."
                                    className="col-span-3 min-h-[100px]"
                                    value={flagReason}
                                    onChange={(e) => setFlagReason(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsFlagModalOpen(false)}>Cancel</Button>
                            <Button variant="destructive" onClick={handleFlagSubmit} disabled={isSubmittingFlag}>
                                {isSubmittingFlag ? 'Submitting...' : 'Flag Record'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Audit Verification Dialog */}
                <Dialog open={isVerifyModalOpen} onOpenChange={setIsVerifyModalOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                Auditor Verification
                            </DialogTitle>
                            <DialogDescription>
                                Mark this transaction as audited and verified. This confirms that you have reviewed the details and found no issues.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="verify-notes">Verification Notes (Optional)</Label>
                                <Textarea
                                    id="verify-notes"
                                    placeholder="Add any verification comments or notes here..."
                                    className="min-h-[100px] border-stone-200 focus:ring-emerald-500 focus:border-emerald-500"
                                    value={verifyNotes}
                                    onChange={(e) => setVerifyNotes(e.target.value)}
                                />
                            </div>
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button
                                variant="outline"
                                onClick={() => setIsVerifyModalOpen(false)}
                                className="border-stone-200 hover:bg-stone-50"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleVerifySubmit}
                                disabled={isSubmittingVerify}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                {isSubmittingVerify ? 'Verifying...' : 'Confirm Verification'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
