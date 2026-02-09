'use client';

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import { fetchAPI } from '@/lib/api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Textarea } from '@/components/ui/textarea';
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
    status: 'open' | 'closed' | 'reconciled' | 'verified';
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
        try {
            const statusFilter = role === 'accountant' ? 'closed' : 'reconciled';
            const response = await fetchAPI(`/cashier/shifts?branch_id=${activeBranchId}&status=${statusFilter}`) as any;
            if (response.success) {
                setShifts(response.data || []);
            }
        } catch (error: any) {
            console.error('Error fetching shifts:', error);
        }
    };

    useEffect(() => {
        fetchShifts();
    }, [activeBranchId, role]);

    const handleAction = async () => {
        if (!selectedShift) return;

        setIsLoading(true);
        try {
            const endpoint = role === 'accountant' ? 'reconcile' : 'verify';
            const noteField = role === 'accountant' ? 'reconciliation_notes' : 'verification_notes';

            const response = await fetchAPI(`/cashier/shifts/${selectedShift.id}/${endpoint}`, {
                method: 'PUT',
                body: JSON.stringify({ [noteField]: notes })
            }) as any;

            if (response.success) {
                toast.success(`Shift ${endpoint}d successfully`);
                setNotes('');
                setSelectedShift(null);
                fetchShifts();
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
                                    <span className="font-bold text-stone-900">{shift.shift_number}</span>
                                    <span className="text-xs text-stone-500">
                                        {new Date(shift.shift_start).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <p className="text-xs text-stone-500">Cashier</p>
                                        <p className="font-bold">
                                            {shift.cashier_name || (shift.cashier ? `${shift.cashier.first_name} ${shift.cashier.last_name}` : 'N/A')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-stone-500">Sales</p>
                                        <p className="font-bold text-emerald-600">
                                            KES {shift.total_sales.toLocaleString()}
                                        </p>
                                    </div>
                                    {shift.variance !== undefined && (
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
                            <h3 className="font-bold text-stone-900 mb-4">Shift Details</h3>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-stone-500 font-bold uppercase">Shift Number</p>
                                        <p className="font-bold text-stone-900">{selectedShift.shift_number}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-stone-500 font-bold uppercase">Cashier</p>
                                        <p className="font-bold text-stone-900">
                                            {selectedShift.cashier_name || (selectedShift.cashier ? `${selectedShift.cashier.first_name} ${selectedShift.cashier.last_name}` : 'N/A')}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-stone-500 font-bold uppercase">Start Time</p>
                                        <p className="font-bold text-stone-900">
                                            {new Date(selectedShift.shift_start).toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-stone-500 font-bold uppercase">End Time</p>
                                        <p className="font-bold text-stone-900">
                                            {selectedShift.shift_end
                                                ? new Date(selectedShift.shift_end).toLocaleString()
                                                : 'N/A'}
                                        </p>
                                    </div>
                                </div>

                                <div className="border-t pt-4">
                                    <h4 className="font-bold text-stone-900 mb-3 flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-emerald-600" />
                                        Cash Float
                                    </h4>
                                    <div className="grid grid-cols-3 gap-3 text-sm">
                                        <div className="bg-stone-50 p-3 rounded-lg">
                                            <p className="text-xs text-stone-500">Opening</p>
                                            <p className="font-bold">KES {selectedShift.opening_float.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-stone-50 p-3 rounded-lg">
                                            <p className="text-xs text-stone-500">Expected</p>
                                            <p className="font-bold">
                                                KES {selectedShift.expected_closing_float?.toLocaleString() || '0'}
                                            </p>
                                        </div>
                                        <div className="bg-stone-50 p-3 rounded-lg">
                                            <p className="text-xs text-stone-500">Actual</p>
                                            <p className="font-bold">
                                                KES {selectedShift.closing_float?.toLocaleString() || '0'}
                                            </p>
                                        </div>
                                    </div>
                                    {selectedShift.variance !== undefined && (
                                        <div className={`mt-3 p-3 rounded-lg border ${selectedShift.variance === 0
                                            ? 'bg-emerald-50 border-emerald-200'
                                            : 'bg-orange-50 border-orange-200'
                                            }`}>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold uppercase">Variance</span>
                                                <span className={`text-lg font-black ${getVarianceColor(selectedShift.variance)}`}>
                                                    {selectedShift.variance > 0 ? '+' : ''}
                                                    KES {selectedShift.variance.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="border-t pt-4">
                                    <h4 className="font-bold text-stone-900 mb-3 flex items-center gap-2">
                                        <TrendingUp className="h-4 w-4 text-blue-600" />
                                        Payment Summary
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-stone-500">Cash Sales</span>
                                            <span className="font-bold">KES {selectedShift.total_cash_sales.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-stone-500">M-Pesa Sales</span>
                                            <span className="font-bold">KES {selectedShift.total_mpesa_sales.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-stone-500">Card Sales</span>
                                            <span className="font-bold">KES {selectedShift.total_card_sales.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-sm pt-2 border-t font-bold">
                                            <span>Total Payments</span>
                                            <span className="text-emerald-600">
                                                KES {selectedShift.total_sales.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Revenue by Source */}
                                <div className="border-t pt-4">
                                    <h4 className="font-bold text-stone-900 mb-3 flex items-center gap-2">
                                        <Building className="h-4 w-4 text-orange-600" />
                                        Revenue by Source
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        {!selectedShift.pool_na && (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-stone-500 flex items-center gap-1.5">
                                                        <Waves className="h-3.5 w-3.5 text-blue-500" /> Swimming Pool
                                                    </span>
                                                    <span className="font-medium">KES {(selectedShift.swimming_pool_revenue || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-stone-500 flex items-center gap-1.5">
                                                        <Ticket className="h-3.5 w-3.5 text-cyan-500" /> Pool Tokens
                                                    </span>
                                                    <span className="font-medium">KES {(selectedShift.pool_token_revenue || 0).toLocaleString()}</span>
                                                </div>
                                            </>
                                        )}
                                        {!selectedShift.conference_na && (
                                            <div className="flex justify-between">
                                                <span className="text-stone-500 flex items-center gap-1.5">
                                                    <Users className="h-3.5 w-3.5 text-purple-500" /> Conference
                                                </span>
                                                <span className="font-medium">KES {(selectedShift.conference_revenue || 0).toLocaleString()}</span>
                                            </div>
                                        )}
                                        {!selectedShift.rooms_na && (
                                            <div className="flex justify-between">
                                                <span className="text-stone-500 flex items-center gap-1.5">
                                                    <Bed className="h-3.5 w-3.5 text-indigo-500" /> Rooms
                                                </span>
                                                <span className="font-medium">KES {(selectedShift.room_booking_revenue || 0).toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-stone-500 flex items-center gap-1.5">
                                                <UtensilsCrossed className="h-3.5 w-3.5 text-orange-500" /> Restaurant
                                            </span>
                                            <span className="font-medium">KES {(selectedShift.restaurant_revenue || 0).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-stone-500 flex items-center gap-1.5">
                                                <Wine className="h-3.5 w-3.5 text-rose-500" /> Bar
                                            </span>
                                            <span className="font-medium">KES {(selectedShift.bar_revenue || 0).toLocaleString()}</span>
                                        </div>
                                        {selectedShift.other_revenue && selectedShift.other_revenue > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-stone-500 flex items-center gap-1.5">
                                                    <Plus className="h-3.5 w-3.5 text-stone-500" /> Other
                                                </span>
                                                <span className="font-medium">KES {selectedShift.other_revenue.toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Credit & Bills */}
                                <div className="border-t pt-4">
                                    <h4 className="font-bold text-stone-900 mb-3 flex items-center gap-2">
                                        <CreditCard className="h-4 w-4 text-rose-600" />
                                        Credit & Unpaid Bills
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="p-3 bg-rose-50 rounded-lg">
                                            <p className="text-xs text-rose-600 font-bold uppercase">Credit Taken</p>
                                            <p className="font-bold">KES {(selectedShift.credit_bills_taken || 0).toLocaleString()}</p>
                                            <p className="text-[10px] text-rose-500">{selectedShift.credit_bills_count || 0} bills</p>
                                        </div>
                                        <div className="p-3 bg-amber-50 rounded-lg">
                                            <p className="text-xs text-amber-600 font-bold uppercase">Unpaid Bills</p>
                                            <p className="font-bold">KES {(selectedShift.unpaid_bills_value || 0).toLocaleString()}</p>
                                            <p className="text-[10px] text-amber-500">{selectedShift.unpaid_bills_count || 0} bills</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Banking & Cash */}
                                <div className="border-t pt-4">
                                    <h4 className="font-bold text-stone-900 mb-3 flex items-center gap-2">
                                        <Landmark className="h-4 w-4 text-blue-600" />
                                        Banking & Physical Cash
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div className="p-3 bg-emerald-50 rounded-lg">
                                            <p className="text-xs text-emerald-600 font-bold uppercase">Cash at Hand</p>
                                            <p className="font-bold">KES {(selectedShift.cash_at_hand || 0).toLocaleString()}</p>
                                        </div>
                                        <div className="p-3 bg-blue-50 rounded-lg">
                                            <p className="text-xs text-blue-600 font-bold uppercase">Cash Deposited</p>
                                            <p className="font-bold">KES {(selectedShift.cash_deposited || 0).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    {selectedShift.bank_deposit_ref && (
                                        <div className="mt-2 text-xs flex justify-between p-2 bg-stone-50 rounded border border-dashed">
                                            <span className="text-stone-500">Deposit Ref:</span>
                                            <span className="font-mono font-bold">{selectedShift.bank_deposit_ref}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
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
