'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { fetchAPI, buildQuery } from '@/lib/api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { Input } from '@/components/ui/input';
import { CloseShiftModal, CloseShiftData } from './close-shift-modal';
import { ShiftBreakdownReport } from './shift-breakdown-report';
import {
    Clock, DollarSign, TrendingUp, CheckCircle,
    AlertTriangle, Loader2, PlayCircle, StopCircle, ChevronDown, ChevronUp,
    Store
} from 'lucide-react';
import { kyogongAPI } from '@/lib/api/kyogong';
import { UserRole } from '@/lib/user-roles';

interface ShiftLog {
    id: string;
    shift_number: string;
    cashier_id?: string | number;
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
}

export function CashierLogbook({ type, source, pointCode }: { type?: string; source?: string; pointCode?: string }) {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [shifts, setShifts] = useState<ShiftLog[]>([]);
    const [currentShift, setCurrentShift] = useState<ShiftLog | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [openingFloat, setOpeningFloat] = useState('');
    const [openingPettyCash, setOpeningPettyCash] = useState('');
    const [salesPoints, setSalesPoints] = useState<any[]>([]);
    const [selectedPointId, setSelectedPointId] = useState<string>('');
    const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false);
    const [modalShiftData, setModalShiftData] = useState<any>(null);
    const [isLoadingShift, setIsLoadingShift] = useState(false);
    const [expandedShiftId, setExpandedShiftId] = useState<string | null>(null);

    const isKyogong = source === 'kyogong' || [
        UserRole.KYOGONG_SPA_CASHIER,
        UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
        UserRole.KYOGONG_SPORTS_BAR_CASHIER,
        UserRole.KYOGONG_RECEPTION_CASHIER
    ].includes(user?.role as any);

    const openCloseModal = async () => {
        if (!currentShift?.id) return;
        setIsLoadingShift(true);
        try {
            const res = isKyogong 
                ? await kyogongAPI.getShiftDetails(currentShift.id)
                : await fetchAPI(`/cashier/shifts/${currentShift.id}`) as any;
            setModalShiftData(res.success && res.data ? res.data : currentShift);
        } catch {
            setModalShiftData(currentShift);
        } finally {
            setIsLoadingShift(false);
            setCloseShiftModalOpen(true);
        }
    };

    const fetchSalesPoints = async () => {
        if (!isKyogong) return;
        try {
            const res = await kyogongAPI.getSalesPoints({ is_active: true });
            if (res.success && res.data) {
                setSalesPoints(res.data);
                
                // Auto-selection based on role or pointCode
                let targetCode = pointCode;
                if (!targetCode) {
                    if (user?.role === UserRole.KYOGONG_SPA_CASHIER) targetCode = 'SPA';
                    else if (user?.role === UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER) targetCode = 'EXEC_BAR';
                    else if (user?.role === UserRole.KYOGONG_SPORTS_BAR_CASHIER) targetCode = 'SPORTS_BAR';
                    else if (user?.role === UserRole.KYOGONG_RECEPTION_CASHIER) targetCode = 'RECEPTION';
                }

                if (targetCode) {
                    const p = res.data.find((x: any) => x.code === targetCode);
                    if (p) setSelectedPointId(p.id.toString());
                } else if (res.data.length === 1) {
                    setSelectedPointId(res.data[0].id.toString());
                }
            }
        } catch (e) { console.error(e); }
    };

    const fetchShifts = async () => {
        try {
            const isOnlyCashier = [
                UserRole.CASHIER,
                UserRole.KYOGONG_SPA_CASHIER,
                UserRole.KYOGONG_EXECUTIVE_BAR_CASHIER,
                UserRole.KYOGONG_SPORTS_BAR_CASHIER,
                UserRole.KYOGONG_RECEPTION_CASHIER
            ].includes(user?.role as any);

            const params: any = { branch_id: activeBranchId || user?.branch_id };
            if (isOnlyCashier && user?.id) {
                params.cashier_id = user.id;
            }

            // Fetch from both systems
            const [stdRes, kyoRes] = await Promise.all([
                fetchAPI(`/cashier/shifts${buildQuery(params)}`),
                kyogongAPI.getShifts(params)
            ]);
            
            let allShifts: any[] = [];

            if (stdRes.success) {
                allShifts = [...allShifts, ...(stdRes.data || []).map((s: any) => ({ ...s, module: 'standard' }))];
            }
            if (kyoRes.success) {
                allShifts = [...allShifts, ...(kyoRes.data || []).map((s: any) => ({ ...s, module: 'kyogong' }))];
            }

            const mappedShifts: ShiftLog[] = allShifts.map((s: any) => ({
                ...s,
                cashier_id: s.cashier_id || s.user_id || s.staff_id,
                shift_start: s.shift_start || s.start_time || s.opened_at,
                shift_end: s.shift_end || s.end_time || s.closed_at,
                opening_float: s.opening_float || s.opening_cash_float || 0,
                total_sales: s.total_sales || s.total_revenue || 0,
                total_cash_sales: s.total_cash_sales || s.total_cash_in || 0,
                total_mpesa_sales: s.total_mpesa_sales || s.total_mpesa_in || 0,
                total_card_sales: s.total_card_sales || s.total_card_in || 0,
                transaction_count: s.transaction_count || s.total_transactions || 0,
                status: (s.status || '').toLowerCase() as any,
                module: s.module
            }));

            // Sort by date desc
            mappedShifts.sort((a, b) => new Date(b.shift_start).getTime() - new Date(a.shift_start).getTime());

            setShifts(mappedShifts);
            
            // Find active shift for the CURRENT module
            const open = mappedShifts.find((s: any) => 
                s.status === 'open' && 
                (isKyogong ? s.module === 'kyogong' : s.module === 'standard')
            );
            setCurrentShift(open || null);
        } catch (error: any) {
            toast.error(error.message || 'Failed to load shifts');
        }
    };

    useEffect(() => {
        fetchShifts();
        if (isKyogong) fetchSalesPoints();
    }, [activeBranchId, user?.branch_id, isKyogong]);

    const handleStartShift = async () => {
        if (!openingFloat) {
            toast.error('Please enter opening float');
            return;
        }

        setIsLoading(true);
        try {
            let response;
            if (isKyogong) {
                if (!selectedPointId) {
                    toast.error('Please select a sales point');
                    setIsLoading(false);
                    return;
                }
                response = await kyogongAPI.openShift({
                    sales_point_id: parseInt(selectedPointId),
                    opening_cash_float: parseFloat(openingFloat),
                    opening_petty_cash: openingPettyCash ? parseFloat(openingPettyCash) : 0
                });
            } else {
                response = await fetchAPI('/cashier/shifts/start', {
                    method: 'POST',
                    body: JSON.stringify({
                        opening_float: parseFloat(openingFloat)
                    })
                }) as any;
            }

            if (response.success) {
                toast.success('Shift started successfully');
                setOpeningFloat('');
                setOpeningPettyCash('');
                fetchShifts();
            } else {
                toast.error(response.message || response.error || 'Failed to start shift');
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
            const response = isKyogong
                ? await kyogongAPI.closeShift(currentShift.id, {
                    closing_cash_counted: data.closing_float,
                    closing_petty_cash: 0,
                    variance_reason: data.notes
                })
                : await fetchAPI(`/cashier/shifts/${currentShift.id}/close`, {
                    method: 'PUT',
                    body: JSON.stringify(data)
                }) as any;

            if (response.success) {
                toast.success('Shift closed successfully');
                setCloseShiftModalOpen(false);
                fetchShifts();
            } else {
                toast.error(response.message || response.error || 'Failed to close shift');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to close shift');
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        const s = (status || '').toLowerCase();
        switch (s) {
            case 'open': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'closed': return 'bg-orange-50 text-orange-700 border-orange-200';
            case 'reconciled': return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'verified': 
            case 'approved': return 'bg-purple-50 text-purple-700 border-purple-200';
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
                            {isKyogong && salesPoints.length > 0 && (
                                <div className="text-left mb-4">
                                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1 ml-1">Sales Point</label>
                                    <select
                                        value={selectedPointId}
                                        onChange={(e) => setSelectedPointId(e.target.value)}
                                        className="w-full h-12 px-4 rounded-xl border border-stone-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white text-sm font-bold"
                                    >
                                        <option value="">Select Point...</option>
                                        {salesPoints.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} {p.is_occupied ? `(OCCUPIED by ${p.current_shift?.cashier_id === user?.id ? 'YOU' : 'Another Cashier'})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            
                            <div className="text-left">
                                <label className="block text-xs font-bold text-stone-500 uppercase mb-1 ml-1">Opening Float (Cash)</label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={openingFloat}
                                    onChange={(e) => setOpeningFloat(e.target.value)}
                                    className="h-12 text-lg font-bold"
                                />
                            </div>

                            {isKyogong && (
                                <div className="text-left">
                                    <label className="block text-xs font-bold text-stone-500 uppercase mb-1 ml-1">Opening Petty Cash</label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={openingPettyCash}
                                        onChange={(e) => setOpeningPettyCash(e.target.value)}
                                        className="h-12 text-lg font-bold"
                                    />
                                </div>
                            )}

                            <IOSButton
                                onClick={handleStartShift}
                                disabled={isLoading || !openingFloat || (isKyogong && !selectedPointId)}
                                className="w-full bg-emerald-600 h-12 mt-2"
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
                    {shifts.filter(s => s.status !== 'OPEN').slice(0, 10).map((shift) => {
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
                                                <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border ${shift.module === 'kyogong' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
                                                    {shift.module === 'kyogong' ? 'KYOGONG' : 'FAMOUS GATE'}
                                                </span>
                                                <span className={`px-2 py-0.5 text-xs font-bold rounded-full border ${getStatusColor(shift.status)}`}>
                                                    {shift.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                                                <div>
                                                    <p className="text-xs text-stone-500">Cashier</p>
                                                    <p className="font-bold">
                                                        {shift.cashier_name || 
                                                         (shift.cashier_id?.toString() === user?.id?.toString() ? `${user?.firstName} ${user?.lastName}` : 'Unknown')}
                                                    </p>
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
