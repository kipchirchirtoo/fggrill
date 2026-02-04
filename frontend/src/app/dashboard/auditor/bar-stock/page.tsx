'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { auditAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { BranchSelector, useBranch } from '@/lib/branch-context';
import {
    AlertTriangle, Package, Filter, Download,
    ArrowLeft, Check, X, RefreshCw, Eye,
    Building2, Activity, ShieldCheck, ChevronRight,
    Search, Boxes, Calculator, TrendingDown, FileDown, DollarSign,
    ClipboardCheck, Save, Loader2, User, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';

export default function BarStockAuditPage() {
    const { activeBranchId, activeBranch } = useBranch();
    const [audits, setAudits] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedAudit, setSelectedAudit] = useState<any>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationNotes, setVerificationNotes] = useState('');

    const fetchAudits = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.getBarStockAudits({
                branch_id: activeBranchId || undefined
            });

            if (res.success) {
                setAudits(res.data || []);
            }
        } catch (error) {
            console.error('Error fetching bar stock audits:', error);
            toast.error('Failed to load bar stock audits');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        fetchAudits();
    }, [fetchAudits]);

    const handleVerify = async () => {
        if (!selectedAudit) return;
        setIsVerifying(true);
        try {
            const res = await auditAPI.verifyBarStockTake(selectedAudit.id, {
                notes: verificationNotes
            });

            if (res.success) {
                toast.success('Stock take verified and inventory updated');
                setSelectedAudit(null);
                setVerificationNotes('');
                fetchAudits();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to verify stock take');
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Bar Stock Auditing</h1>
                            <p className="text-stone-500 text-sm mt-0.5">Review physical stock takes submitted by bartenders</p>
                        </div>
                        <div className="flex gap-2">
                            <BranchSelector />
                            <button
                                onClick={fetchAudits}
                                disabled={isLoading}
                                className="btn-secondary h-[44px] px-4 flex items-center justify-center gap-2"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                        </div>
                    </div>

                    {/* Audit List */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-1 space-y-4">
                            <h2 className="text-sm font-bold text-stone-400 uppercase tracking-widest px-2">Recent Submissions</h2>
                            {isLoading ? (
                                <div className="p-12 text-center">
                                    <Loader2 className="h-8 w-8 animate-spin mx-auto text-stone-300" />
                                </div>
                            ) : audits.length === 0 ? (
                                <IOSCard className="p-8 text-center text-stone-400">
                                    <ClipboardCheck className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                    <p>No stock takes found</p>
                                </IOSCard>
                            ) : (
                                audits.map((audit) => (
                                    <div
                                        key={audit.id}
                                        onClick={() => setSelectedAudit(audit)}
                                        className={`cursor-pointer transition-all ${selectedAudit?.id === audit.id ? 'scale-[1.02]' : 'hover:bg-stone-50'}`}
                                    >
                                        <IOSCard className={`p-4 border-l-4 ${selectedAudit?.id === audit.id ? 'border-l-stone-900 bg-stone-50' : 'border-l-transparent'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <IOSBadge size="sm" className={audit.status === 'verified' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}>
                                                    {audit.status === 'verified' ? 'Verified' : 'Pending Review'}
                                                </IOSBadge>
                                                <span className="text-[10px] text-stone-400 font-mono">
                                                    {new Date(audit.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="font-bold text-stone-900">{audit.branch?.name || 'Branch'}</p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-stone-500">
                                                <User className="h-3 w-3" />
                                                <span>{audit.user?.first_name} {audit.user?.last_name}</span>
                                            </div>
                                        </IOSCard>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="lg:col-span-2">
                            {selectedAudit ? (
                                <div className="space-y-6 animate-in fade-in duration-300">
                                    <IOSCard className="overflow-hidden">
                                        <div className="bg-stone-50 p-6 border-b border-stone-100 flex justify-between items-center">
                                            <div>
                                                <h2 className="text-xl font-bold text-stone-900">Stock Take Details</h2>
                                                <p className="text-sm text-stone-500">Submitted on {new Date(selectedAudit.created_at).toLocaleString()}</p>
                                            </div>
                                            {selectedAudit.status !== 'verified' && (
                                                <IOSButton
                                                    onClick={handleVerify}
                                                    disabled={isVerifying}
                                                    className="bg-stone-900 text-white"
                                                >
                                                    {isVerifying ? <Loader2 className="animate-spin h-4 w-4" /> : <><ShieldCheck className="h-4 w-4 mr-2" /> Verify & Sync Inventory</>}
                                                </IOSButton>
                                            )}
                                        </div>

                                        <div className="p-6">
                                            {selectedAudit.notes && (
                                                <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 text-blue-800 text-sm">
                                                    <p className="font-bold mb-1">Bartender Notes:</p>
                                                    <p>{selectedAudit.notes}</p>
                                                </div>
                                            )}

                                            {selectedAudit.status !== 'verified' && (
                                                <div className="mb-6">
                                                    <label className="text-xs font-bold text-stone-400 uppercase mb-2 block">Verification Remarks</label>
                                                    <textarea
                                                        value={verificationNotes}
                                                        onChange={(e) => setVerificationNotes(e.target.value)}
                                                        placeholder="Add any audit findings or clarification notes..."
                                                        className="w-full p-4 rounded-xl border border-stone-200 text-sm focus:ring-2 focus:ring-stone-900/5 outline-none min-h-[80px]"
                                                    />
                                                </div>
                                            )}

                                            <table className="w-full text-left">
                                                <thead>
                                                    <tr className="text-[10px] font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100">
                                                        <th className="py-3 px-2">Drink Item</th>
                                                        <th className="py-3 text-center">System</th>
                                                        <th className="py-3 text-center">Physical</th>
                                                        <th className="py-3 text-right">Variance</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-50">
                                                    {selectedAudit.items?.map((item: any) => {
                                                        const variance = item.physical_quantity - item.system_quantity;
                                                        return (
                                                            <tr key={item.id} className="hover:bg-stone-50/50">
                                                                <td className="py-4 px-2">
                                                                    <p className="font-bold text-stone-900 text-sm">{item.name || 'Unknown'}</p>
                                                                </td>
                                                                <td className="py-4 text-center text-stone-500 font-mono text-sm">
                                                                    {item.system_quantity}
                                                                </td>
                                                                <td className="py-4 text-center font-bold text-stone-900 text-sm">
                                                                    {item.physical_quantity}
                                                                </td>
                                                                <td className="py-4 text-right">
                                                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${variance === 0 ? 'bg-stone-100 text-stone-400' : variance > 0 ? 'bg-green-50 text-green-600' : 'bg-rose-50 text-rose-600'}`}>
                                                                        {variance > 0 ? '+' : ''}{variance}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </IOSCard>
                                </div>
                            ) : (
                                <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-stone-100 rounded-[32px] text-stone-300">
                                    <Eye className="h-16 w-16 mb-4 opacity-10" />
                                    <p className="font-medium">Select a stock take to review details</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
