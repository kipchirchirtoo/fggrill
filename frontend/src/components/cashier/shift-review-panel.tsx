'use client';

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import { fetchAPI } from '@/lib/api';
import { kyogongAPI } from '@/lib/api/kyogong';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Textarea } from '@/components/ui/textarea';
import { ShiftBreakdownReport } from './shift-breakdown-report';
import {
    CheckCircle, Loader2, AlertTriangle, DollarSign, TrendingUp,
    Waves, Ticket, Users, Bed, UtensilsCrossed, Wine, Plus,
    CreditCard, Landmark, Banknote, Building
} from 'lucide-react';

interface ShiftLog {
    id: string;
    shift_number: string;
    cashier_name: string;
    shift_start: string;
    shift_end?: string;
    opening_float: number;
    closing_float?: number;
    expected_closing_float?: number;
    variance?: number;
    total_sales: number;
    total_cash_sales: number;
    total_mpesa_sales: number;
    total_card_sales: number;
    transaction_count: number;
    status: 'OPEN' | 'CLOSED' | 'reconciled' | 'verified';
    reconciliation_notes?: string;
    verification_notes?: string;
    // Revenue by source
    swimming_pool_revenue?: number;
    pool_token_revenue?: number;
    conference_revenue?: number;
    room_booking_revenue?: number;
    restaurant_revenue?: number;
    bar_revenue?: number;
    other_revenue?: number;
    // Credit & bills
    credit_bills_taken?: number;
    credit_bills_count?: number;
    unpaid_bills_value?: number;
    unpaid_bills_count?: number;
    // Cash management
    cash_at_hand?: number;
    cash_deposited?: number;
    bank_deposit_ref?: string;
    cashier?: {
        first_name: string;
        last_name: string;
    };
    // N/A flags
    pool_na?: boolean;
    conference_na?: boolean;
    rooms_na?: boolean;
}

export function ShiftReviewPanel({ role }: { role: 'accountant' | 'auditor' }) {
    const { activeBranchId } = useBranch();
    const [shifts, setShifts] = useState<ShiftLog[]>([]);
    const [selectedShift, setSelectedShift] = useState<ShiftLog | null>(null);
    const [notes, setNotes] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const fetchShifts = async () => {
        if (!activeBranchId) return;
        try {
            const statusFilter = role === 'accountant' ? 'closed' : 'reconciled';
            
            // Fetch from both systems
            const [stdRes, kyoRes] = await Promise.all([
                fetchAPI(`/cashier/shifts?branch_id=${activeBranchId}&status=${statusFilter}`),
                kyogongAPI.getShifts({ branch_id: activeBranchId, status: statusFilter.toUpperCase() })
            ]);

            let allShifts: any[] = [];

            if (stdRes.success) {
                allShifts = [...allShifts, ...(stdRes.data || []).map((s: any) => ({ ...s, module: 'standard' }))];
            }
            if (kyoRes.success) {
                allShifts = [...allShifts, ...(kyoRes.data || []).map((s: any) => ({ ...s, module: 'kyogong' }))];
            }

            // Standardize models
            const mapped = allShifts.map((s: any) => ({
                ...s,
                status: (s.status || '').toLowerCase() as any,
                shift_start: s.shift_start || s.start_time || s.opened_at,
                total_sales: s.total_sales || s.total_revenue || 0,
                cashier_name: s.cashier_name || (s.cashier ? `${s.cashier.first_name} ${s.cashier.last_name}`.trim() : 'N/A')
            }));

            // Sort by date desc
            mapped.sort((a, b) => new Date(b.shift_start).getTime() - new Date(a.shift_start).getTime());

            setShifts(mapped);
        } catch (error: any) {
            toast.error(error.message || 'Failed to load shifts');
        }
    };

    useEffect(() => {
        fetchShifts();
    }, [activeBranchId, role]);

    const handleAction = async () => {
        if (!selectedShift) return;

        setIsLoading(true);
        try {
            const isKyogong = (selectedShift as any).module === 'kyogong';
            const endpoint = role === 'accountant' ? 'reconcile' : 'verify';
            const noteField = role === 'accountant' ? 'reconciliation_notes' : 'verification_notes';

            let response: any;
            if (isKyogong) {
                if (role === 'accountant') {
                    response = await kyogongAPI.reconcileShift(selectedShift.id, { review_notes: notes });
                } else {
                    response = await kyogongAPI.approveShift(selectedShift.id, { review_notes: notes });
                }
            } else {
                response = await fetchAPI(`/cashier/shifts/${selectedShift.id}/${endpoint}`, {
                    method: 'PUT',
                    body: JSON.stringify({ [noteField]: notes })
                });
            }

            if (response.success) {
                toast.success(`Shift ${endpoint}d successfully`);
                setNotes('');
                setSelectedShift(null);
                fetchShifts();
            } else {
                toast.error(response.message || `Failed to ${endpoint} shift`);
            }
        } catch (error: any) {
            toast.error(error.message || `Failed to ${role === 'accountant' ? 'reconcile' : 'verify'} shift`);
        } finally {
            setIsLoading(false);
        }
    };

    const getVarianceColor = (variance?: number) => {
        if (variance === undefined || variance === null) return 'text-stone-500';
        if (variance === 0) return 'text-emerald-600';
        if (Math.abs(variance) < 100) return 'text-orange-600';
        return 'text-rose-600';
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-stone-900">
                    {role === 'accountant' ? 'Shift Reconciliation' : 'Shift Verification'}
                </h2>
                <p className="text-sm text-stone-500">
                    {role === 'accountant'
                        ? 'Review and reconcile cashier shifts'
                        : 'Verify reconciled shifts for audit compliance'}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Shift List */}
                <div className="space-y-3">
                    <h3 className="font-bold text-stone-900">
                        Pending {role === 'accountant' ? 'Reconciliation' : 'Verification'}
                    </h3>
                    {shifts.length === 0 ? (
                        <IOSCard className="p-8 text-center">
                            <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                            <p className="text-stone-500">All shifts processed</p>
                        </IOSCard>
                    ) : (
                        shifts.map((shift) => (
                            <IOSCard
                                key={shift.id}
                                className={`p-4 cursor-pointer transition-all ${selectedShift?.id === shift.id
                                    ? 'ring-2 ring-orange-500 shadow-lg'
                                    : 'hover:shadow-md'
                                    }`}
                                onClick={() => setSelectedShift(shift)}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-stone-900">{shift.shift_number}</span>
                                        <span className={`px-2 py-0.5 text-[9px] font-black rounded-full border ${(shift as any).module === 'kyogong' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                                            {(shift as any).module === 'kyogong' ? 'KYOGONG' : 'FAMOUS GATE'}
                                        </span>
                                    </div>
                                    <span className="text-xs text-stone-500">
                                        {new Date(shift.shift_start).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-xs text-stone-500">Cashier</p>
                                        <p className="font-bold">
                                            {shift.cashier_name || (shift.cashier ? `${shift.cashier.first_name} ${shift.cashier.last_name}`.trim() : 'N/A')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-stone-500">Sales</p>
                                        <p className="font-bold text-emerald-600">
                                            KES {(shift.total_sales || 0).toLocaleString()}
                                        </p>
                                    </div>
                                    {shift.variance !== undefined && shift.variance !== null && (
                                        <div>
                                            <p className="text-xs text-stone-500">Variance</p>
                                            <p className={`font-bold ${getVarianceColor(shift.variance)}`}>
                                                {shift.variance > 0 ? '+' : ''}
                                                {shift.variance.toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </IOSCard>
                        ))
                    )}
                </div>

                {/* Shift Details & Action */}
                {selectedShift ? (
                    <div className="space-y-4">
                        <IOSCard className="p-6">
                            <h3 className="font-bold text-stone-900 mb-4">Shift Details — {selectedShift.shift_number}</h3>
                            <ShiftBreakdownReport shift={selectedShift} />
                        </IOSCard>

                        <IOSCard className="p-6">
                            <h3 className="font-bold text-stone-900 mb-3">
                                {role === 'accountant' ? 'Reconciliation' : 'Verification'} Notes
                            </h3>
                            <Textarea
                                placeholder="Add notes or comments..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="mb-4"
                                rows={4}
                            />
                            <IOSButton
                                onClick={handleAction}
                                disabled={isLoading}
                                className={`w-full h-12 ${role === 'accountant' ? 'bg-blue-600' : 'bg-purple-600'
                                    }`}
                            >
                                {isLoading ? (
                                    <Loader2 className="animate-spin mr-2" />
                                ) : (
                                    <CheckCircle className="mr-2" />
                                )}
                                {role === 'accountant' ? 'Reconcile Shift' : 'Verify Shift'}
                            </IOSButton>
                        </IOSCard>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full">
                        <div className="text-center text-stone-400">
                            <AlertTriangle className="h-12 w-12 mx-auto mb-3" />
                            <p>Select a shift to review</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
