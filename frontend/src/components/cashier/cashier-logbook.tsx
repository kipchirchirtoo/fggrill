'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { fetchAPI } from '@/lib/api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Input } from '@/components/ui/input';
import { CloseShiftModal, CloseShiftData } from './close-shift-modal';
import { ShiftBreakdownReport } from './shift-breakdown-report';
import {
    Clock, DollarSign, TrendingUp, CheckCircle,
    AlertTriangle, Loader2, PlayCircle, StopCircle, ChevronDown, ChevronUp
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
}

export function CashierLogbook({ type }: { type?: string }) {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [shifts, setShifts] = useState<ShiftLog[]>([]);
    const [currentShift, setCurrentShift] = useState<ShiftLog | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [openingFloat, setOpeningFloat] = useState('');
    const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false);
    const [modalShiftData, setModalShiftData] = useState<any>(null);
    const [isLoadingShift, setIsLoadingShift] = useState(false);
    const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);

    const openCloseModal = async () => {
        if (!currentShift?.id) return;
        setIsLoadingShift(true);
        try {
            const res = await fetchAPI(`/cashier/shifts/${currentShift.id}`) as any;
            setModalShiftData(res.success && res.data ? res.data : currentShift);
        } catch {
            setModalShiftData(currentShift);
        } finally {
            setIsLoadingShift(false);
            setCloseShiftModalOpen(true);
        }
    };

    const fetchShifts = async () => {
        try {
            const response = await fetchAPI(`/cashier/shifts?branch_id=${activeBranchId || user?.branch_id}`) as any;
            if (response.success) {
                setShifts(response.data || []);
                const open = response.data?.find((s: ShiftLog) => s.status === 'open');
                setCurrentShift(open || null);
            } else if (response.message) {
                toast.error(response.message);
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to load shifts');
        }
    };

    useEffect(() => {
        fetchShifts();
    }, [activeBranchId, user?.branch_id]);

    const handleStartShift = async () => {
        if (!openingFloat) {
            toast.error('Please enter opening float');
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetchAPI('/cashier/shifts/start', {
                method: 'POST',
                body: JSON.stringify({
                    opening_float: parseFloat(openingFloat)
                })
            }) as any;

            if (response.success) {
                toast.success('Shift started successfully');
                setOpeningFloat('');
                fetchShifts();
            } else {
                toast.error(response.message || 'Failed to start shift');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to start shift');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseShift = async (data: CloseShiftData) => {
        if (!currentShift) return;

        setIsLoading(true);
        try {
            const response = await fetchAPI(`/cashier/shifts/${currentShift.id}/close`, {
                method: 'PUT',
                body: JSON.stringify(data)
            }) as any;

            if (response.success) {
                toast.success('Shift closed successfully');
                setCloseShiftModalOpen(false);
                fetchShifts();
            } else {
                toast.error(response.message || 'Failed to close shift');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to close shift');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'closed': return 'bg-orange-50 text-orange-700 border-orange-200';
            case 'reconciled': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'verified': return 'bg-purple-50 text-purple-700 border-purple-200';
            default: return 'bg-stone-50 text-stone-700 border-stone-200';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-stone-900">Shift Logbook</h2>
                    <p className="text-sm text-stone-500">Track your cashier shifts and reconciliation</p>
                </div>
            </div>

            {/* Current Shift */}
            {currentShift ? (
                <IOSCard className="p-6 bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                                <Clock className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-stone-900">Current Shift</h3>
                                <p className="text-sm text-stone-500">{currentShift.shift_number}</p>
                            </div>
                        </div>
                        <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full animate-pulse">
                            ACTIVE
                        </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        <div>
                            <p className="text-xs text-stone-500 font-bold uppercase">Cashier</p>
                            <p className="font-bold text-stone-900">{currentShift.cashier_name || (user ? `${user.firstName} ${user.lastName}` : 'Unknown')}</p>
                        </div>
                        <div>
                            <p className="text-xs text-stone-500 font-bold uppercase">Started</p>
                            <p className="font-bold text-stone-900">{new Date(currentShift.shift_start).toLocaleTimeString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-stone-500 font-bold uppercase">Opening Float</p>
                            <p className="font-bold text-stone-900">KES {currentShift.opening_float.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-stone-500 font-bold uppercase">Sales</p>
                            <p className="font-bold text-emerald-600">KES {currentShift.total_sales.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-xs text-stone-500 font-bold uppercase">Transactions</p>
                            <p className="font-bold text-stone-900">{currentShift.transaction_count}</p>
                        </div>
                    </div>

                    <IOSButton
                        onClick={openCloseModal}
                        disabled={isLoading || isLoadingShift}
                        className="w-full bg-stone-900 h-12"
                    >
                        {isLoadingShift ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <StopCircle className="mr-2" />}
                        Close Shift
                    </IOSButton>
                </IOSCard>
            ) : (
                <IOSCard className="p-6">
                    <div className="text-center py-8">
                        <PlayCircle className="h-16 w-16 text-stone-300 mx-auto mb-4" />
                        <h3 className="font-bold text-stone-900 mb-2">No Active Shift</h3>
                        <p className="text-sm text-stone-500 mb-6">Start a new shift to begin processing transactions</p>

                        <div className="max-w-sm mx-auto space-y-3">
                            <Input
                                type="number"
                                placeholder="Opening float amount (KES)"
                                value={openingFloat}
                                onChange={(e) => setOpeningFloat(e.target.value)}
                                className="h-12 text-lg font-bold"
                            />
                            <IOSButton
                                onClick={handleStartShift}
                                disabled={isLoading || !openingFloat}
                                className="w-full bg-emerald-600 h-12"
                            >
                                {isLoading ? <Loader2 className="animate-spin mr-2" /> : <PlayCircle className="mr-2" />}
                                Start New Shift
                            </IOSButton>
                        </div>
                    </div>
                </IOSCard>
            )}

            {/* Shift History */}
            <div>
                <h3 className="font-bold text-stone-900 mb-4">Recent Shifts</h3>
                <div className="space-y-3">
                    {shifts.filter(s => s.status !== 'open').slice(0, 10).map((shift) => {
                        const isExpanded = expandedShiftId === shift.id;
                        const variance = shift.variance ?? 0;
                        return (
                            <IOSCard key={shift.id} className="overflow-hidden transition-shadow hover:shadow-md">
                                {/* Summary row — click to expand */}
                                <button
                                    className="w-full text-left p-4"
                                    onClick={() => setExpandedShiftId(isExpanded ? null : shift.id)}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="font-bold text-stone-900">{shift.shift_number}</span>
                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${getStatusColor(shift.status)}`}>
                                                    {shift.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                                                <div>
                                                    <p className="text-xs text-stone-500">Cashier</p>
                                                    <p className="font-bold">{shift.cashier_name || 'Unknown'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-stone-500">Date</p>
                                                    <p className="font-bold">{new Date(shift.shift_start).toLocaleDateString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-stone-500">Sales</p>
                                                    <p className="font-bold text-emerald-600">KES {shift.total_sales.toLocaleString()}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-stone-500">Transactions</p>
                                                    <p className="font-bold">{shift.transaction_count}</p>
                                                </div>
                                                {shift.variance !== undefined && (
                                                    <div>
                                                        <p className="text-xs text-stone-500">Variance</p>
                                                        <p className={`font-bold ${variance === 0 ? 'text-emerald-600' : variance > 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                                            {variance > 0 ? '+' : ''}{variance.toLocaleString()}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="ml-4 text-stone-400">
                                            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                        </div>
                                    </div>
                                </button>

                                {/* Expanded breakdown */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 border-t border-stone-100 pt-4">
                                        <ShiftBreakdownReport shift={shift} />
                                    </div>
                                )}
                            </IOSCard>
                        );
                    })}
                </div>
            </div>

            {/* Close Shift Modal */}
            <CloseShiftModal
                isOpen={closeShiftModalOpen}
                onClose={() => setCloseShiftModalOpen(false)}
                onSubmit={handleCloseShift}
                currentShift={modalShiftData || currentShift}
                isLoading={isLoading}
            />
        </div>
    );
}
