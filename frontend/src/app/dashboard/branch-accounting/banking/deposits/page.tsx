'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { accountingAPI } from '@/lib/api';
import { NewDepositModal } from '@/components/accounting/NewDepositModal';
import {
    Landmark, Plus, Search, Filter,
    ArrowLeft, Calendar, FileText, CheckCircle2
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function BankDepositsPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [deposits, setDeposits] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isNewDepositOpen, setIsNewDepositOpen] = useState(false);

    const currentBranchId = activeBranchId || user?.branch_id;

    const fetchDeposits = useCallback(async () => {
        if (!currentBranchId) return;
        setIsLoading(true);
        try {
            const res = await accountingAPI.getBankDeposits(currentBranchId);
            if (res.success) {
                setDeposits(res.data || []);
            }
        } catch (error) {
            console.error('Error fetching deposits:', error);
            toast.error('Failed to load bank deposits');
        } finally {
            setIsLoading(false);
        }
    }, [currentBranchId]);

    useEffect(() => {
        fetchDeposits();
    }, [fetchDeposits]);

    const filteredDeposits = deposits.filter(deposit =>
        deposit.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deposit.bank_account?.account_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/branch-accounting" className="h-9 w-9 rounded-full bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition-colors">
                                <ArrowLeft className="h-4 w-4 text-stone-600" />
                            </Link>
                            <div>
                                <h1 className="text-[24px] font-semibold text-stone-900 tracking-tight">Bank Deposits</h1>
                                <p className="text-stone-500 text-sm">Monitor and record bank transactions</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsNewDepositOpen(true)}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            <span>New Deposit</span>
                        </button>
                    </div>

                    <NewDepositModal
                        isOpen={isNewDepositOpen}
                        onClose={() => setIsNewDepositOpen(false)}
                        onSuccess={fetchDeposits}
                        branchId={Number(currentBranchId) || 0}
                    />

                    {/* Filters */}
                    <div className="card-elevated p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Search by reference or bank..."
                                    className="input-field pl-10 w-full"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <button className="btn-secondary flex items-center gap-2">
                                <Filter className="h-4 w-4" />
                                <span>Advanced Filters</span>
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="card-elevated overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-stone-50 border-b border-stone-200">
                                        <th className="px-6 py-4 text-[12px] font-bold text-stone-500 uppercase tracking-wider">Date</th>
                                        <th className="px-6 py-4 text-[12px] font-bold text-stone-500 uppercase tracking-wider">Reference</th>
                                        <th className="px-6 py-4 text-[12px] font-bold text-stone-500 uppercase tracking-wider">Bank Account</th>
                                        <th className="px-6 py-4 text-[12px] font-bold text-stone-500 uppercase tracking-wider">Amount</th>
                                        <th className="px-6 py-4 text-[12px] font-bold text-stone-500 uppercase tracking-wider text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-10 text-center text-stone-500">Loading deposits...</td>
                                        </tr>
                                    ) : filteredDeposits.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-10 text-center">
                                                <Landmark className="h-10 w-10 text-stone-200 mx-auto mb-2" />
                                                <p className="text-stone-500">No bank deposits found</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredDeposits.map((deposit) => (
                                            <tr key={deposit.id} className="hover:bg-stone-50/50 transition-colors cursor-pointer">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Calendar className="h-4 w-4 text-stone-400" />
                                                        <span className="text-[13px] text-stone-600">{format(new Date(deposit.deposit_date), 'MMM dd, yyyy')}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-stone-900 text-[13px]">{deposit.reference}</td>
                                                <td className="px-6 py-4 text-[13px] text-stone-600">
                                                    {deposit.bank_account?.account_name}
                                                    <p className="text-[11px] text-stone-400 capitalize">{deposit.bank_account?.account_type}</p>
                                                </td>
                                                <td className="px-6 py-4 font-bold text-stone-900 text-[13px]">
                                                    KES {deposit.amount.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-100/50">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        Completed
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
