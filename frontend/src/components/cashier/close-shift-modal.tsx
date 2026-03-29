'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    DollarSign, Waves, Ticket, Users, Bed,
    UtensilsCrossed, Wine, Plus, CreditCard,
    Banknote, Building, AlertCircle, CheckCircle2, Clock,
    Trash2, User, X, ChevronRight
} from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { fetchAPI } from '@/lib/api';
import { useEffect } from 'react';
import { StaffDropdownModal } from '@/components/common/StaffDropdownModal';

interface CloseShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: CloseShiftData) => void;
    currentShift: any;
    isLoading: boolean;
}

export interface CloseShiftData {
    closing_float: number;
    // Revenue by source
    swimming_pool_revenue?: number;
    pool_token_revenue?: number;
    conference_revenue?: number;
    room_booking_revenue?: number;
    restaurant_revenue?: number;
    bar_revenue?: number;
    other_revenue?: number;
    // Kyogong services revenue
    catering_revenue?: number;
    spa_revenue?: number;
    sports_bar_revenue?: number;
    executive_bar_revenue?: number;
    car_wash_revenue?: number;
    cashier_station_revenue?: number;
    // Credit & bills
    credit_bills_taken?: number;
    credit_bills_count?: number;
    credit_bills_details?: any[];
    unpaid_bills_value?: number; // Kept for backward compatibility but hidden
    unpaid_bills_count?: number; // Kept for backward compatibility but hidden
    paid_bills_value?: number;
    paid_bills_count?: number;
    paid_bills_details?: any[];
    // Cash management
    cash_at_hand?: number;
    cash_deposited?: number;
    bank_deposit_ref?: string;
    // N/A flags
    pool_na?: boolean;
    pool_tokens_na?: boolean;
    conference_na?: boolean;
    rooms_na?: boolean;
    catering_na?: boolean;
    spa_na?: boolean;
    sports_bar_na?: boolean;
    executive_bar_na?: boolean;
    car_wash_na?: boolean;
    cashier_station_na?: boolean;
    // Notes
    notes?: string;
}

export function CloseShiftModal({ isOpen, onClose, onSubmit, currentShift, isLoading }: CloseShiftModalProps) {
    const [formData, setFormData] = useState<CloseShiftData>({
        closing_float: 0,
        swimming_pool_revenue: 0,
        pool_token_revenue: 0,
        conference_revenue: 0,
        room_booking_revenue: 0,
        restaurant_revenue: 0,
        bar_revenue: 0,
        other_revenue: 0,
        catering_revenue: 0,
        spa_revenue: 0,
        sports_bar_revenue: 0,
        executive_bar_revenue: 0,
        car_wash_revenue: 0,
        cashier_station_revenue: 0,
        credit_bills_taken: 0,
        credit_bills_count: 0,
        credit_bills_details: [],
        unpaid_bills_value: 0,
        unpaid_bills_count: 0,
        paid_bills_value: 0,
        paid_bills_count: 0,
        paid_bills_details: [],
        cash_at_hand: 0,
        cash_deposited: 0,
        bank_deposit_ref: '',
        pool_na: false,
        pool_tokens_na: false,
        conference_na: false,
        rooms_na: false,
        catering_na: false,
        spa_na: false,
        sports_bar_na: false,
        executive_bar_na: false,
        car_wash_na: false,
        cashier_station_na: false,
        notes: ''
    });

    const [isCreditStaffModalOpen, setIsCreditStaffModalOpen] = useState(false);
    const [isPaidStaffModalOpen, setIsPaidStaffModalOpen] = useState(false);
    const [newCreditBill, setNewCreditBill] = useState({ staffId: '', amount: '', name: '' });
    const [newPaidBill, setNewPaidBill] = useState({ staffId: '', amount: '', name: '' });

    const loadStaff = async () => {
        // Redundant - fetch handled by StaffDropdownModal
    };

    const addCreditBill = () => {
        if (!newCreditBill.staffId || !newCreditBill.amount) return;

        const amount = parseFloat(newCreditBill.amount);
        if (isNaN(amount) || amount <= 0) return;

        const bill = {
            id: Date.now().toString(),
            staff_id: newCreditBill.staffId,
            name: newCreditBill.name || 'Unknown Staff',
            amount: amount,
            timestamp: new Date().toISOString()
        };

        const updatedList = [...(formData.credit_bills_details || []), bill];

        setFormData(prev => ({
            ...prev,
            credit_bills_details: updatedList,
            credit_bills_taken: updatedList.reduce((sum, item) => sum + item.amount, 0),
            credit_bills_count: updatedList.length
        }));

        setNewCreditBill({ staffId: '', amount: '', name: '' });
    };

    const removeCreditBill = (id: string) => {
        const updatedList = (formData.credit_bills_details || []).filter(item => item.id !== id);

        setFormData(prev => ({
            ...prev,
            credit_bills_details: updatedList,
            credit_bills_taken: updatedList.reduce((sum, item) => sum + item.amount, 0),
            credit_bills_count: updatedList.length
        }));
    };

    const addPaidBill = () => {
        if (!newPaidBill.staffId || !newPaidBill.amount) return;

        const amount = parseFloat(newPaidBill.amount);
        if (isNaN(amount) || amount <= 0) return;

        const bill = {
            id: Date.now().toString(),
            staff_id: newPaidBill.staffId,
            name: newPaidBill.name || 'Unknown Staff',
            amount: amount,
            timestamp: new Date().toISOString()
        };

        const updatedList = [...(formData.paid_bills_details || []), bill];

        setFormData(prev => ({
            ...prev,
            paid_bills_details: updatedList,
            paid_bills_value: updatedList.reduce((sum, item) => sum + item.amount, 0),
            paid_bills_count: updatedList.length
        }));

        setNewPaidBill({ staffId: '', amount: '', name: '' });
    };

    const removePaidBill = (id: string) => {
        const updatedList = (formData.paid_bills_details || []).filter(item => item.id !== id);

        setFormData(prev => ({
            ...prev,
            paid_bills_details: updatedList,
            paid_bills_value: updatedList.reduce((sum, item) => sum + item.amount, 0),
            paid_bills_count: updatedList.length
        }));
    };

    const updateField = (field: keyof CloseShiftData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const calculateTotalRevenue = () => {
        const revenue = [
            formData.pool_na ? 0 : (formData.swimming_pool_revenue || 0),
            formData.pool_tokens_na ? 0 : (formData.pool_token_revenue || 0),
            formData.conference_na ? 0 : (formData.conference_revenue || 0),
            formData.rooms_na ? 0 : (formData.room_booking_revenue || 0),
            formData.restaurant_revenue || 0,
            formData.bar_revenue || 0,
            formData.other_revenue || 0,
            formData.catering_na ? 0 : (formData.catering_revenue || 0),
            formData.spa_na ? 0 : (formData.spa_revenue || 0),
            formData.sports_bar_na ? 0 : (formData.sports_bar_revenue || 0),
            formData.executive_bar_na ? 0 : (formData.executive_bar_revenue || 0),
            formData.car_wash_na ? 0 : (formData.car_wash_revenue || 0),
            formData.cashier_station_na ? 0 : (formData.cashier_station_revenue || 0)
        ];
        return revenue.reduce((sum, val) => sum + val, 0);
    };

    const totalRevenue = calculateTotalRevenue();

    // ── Strict accounting formula (matches backend exactly) ──────────────────
    // Expected = Opening Float + Cash Sales only + Cash received for credit payments
    // NOTE: M-Pesa and Card do NOT affect the cash drawer
    const cashSales = currentShift?.total_cash_sales || 0;
    const expectedClosing = (currentShift?.opening_float || 0) + cashSales + (formData.paid_bills_value || 0);
    const variance = (formData.closing_float || 0) - expectedClosing;

    // Credit bills outstanding
    const outstandingCredit = Math.max(0, (formData.credit_bills_taken || 0) - (formData.paid_bills_value || 0));

    // Variance label & colour
    const varianceLabel = variance === 0 ? 'Fully Reconciled' : variance > 0 ? 'Surplus' : 'Shortage';
    const varianceColor = variance === 0 ? 'text-emerald-600' : variance > 0 ? 'text-blue-600' : 'text-rose-600';
    const varianceBg    = variance === 0 ? 'bg-emerald-50 border-emerald-200' : variance > 0 ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200';

    const handleSubmit = () => {
        onSubmit(formData);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[92vw] w-[92vw] h-[92vh] flex p-0 overflow-hidden bg-white border border-slate-200 rounded-xl shadow-2xl focus:outline-none focus:ring-0">
                
                {/* ── Absolute Close Button ── */}
                <button 
                    onClick={onClose}
                    className="absolute top-6 right-6 z-50 p-3 bg-white/80 backdrop-blur-md border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-white hover:border-slate-400 transition-all rounded-none"
                >
                    <X className="h-6 w-6" />
                </button>

                {/* ── Left Sidebar: Shift Summary + Live Breakdown ── */}
                <div className="w-72 bg-slate-50/50 flex flex-col p-5 shrink-0 border-r border-slate-200/60 overflow-y-auto rounded-none"
                     style={{ minWidth: '280px', maxWidth: '288px' }}>
                    <div className="mb-6">
                        <div className="p-2 bg-slate-50 rounded-lg w-fit mb-3 shadow-sm border border-slate-100">
                            <Clock className="h-5 w-5 text-slate-400" />
                        </div>
                        <DialogTitle className="text-lg font-black text-slate-900 tracking-tight mb-1">Shift {currentShift?.shift_number}</DialogTitle>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 opacity-60">
                            {currentShift?.shift_start && new Date(currentShift.shift_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>

                    {/* ── Shift Breakdown Panel ── */}
                    <div className="flex-1 space-y-3 text-xs">

                        {/* Cash Reconciliation */}
                        <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-sm space-y-1.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Cash Reconciliation</p>
                            {[
                                { label: 'Opening Float', value: currentShift?.opening_float || 0 },
                                { label: 'Cash Sales', value: cashSales },
                                { label: 'Credit Paid', value: formData.paid_bills_value || 0 },
                            ].map(row => (
                                <div key={row.label} className="flex justify-between items-center">
                                    <span className="text-slate-500">{row.label}</span>
                                    <span className="font-black text-slate-800 tabular-nums">KES {row.value.toLocaleString()}</span>
                                </div>
                            ))}
                            <div className="border-t border-slate-100 pt-1.5 flex justify-between items-center">
                                <span className="text-slate-600 font-black text-[9px] uppercase tracking-wider">Expected</span>
                                <span className="font-black text-slate-900 tabular-nums">KES {expectedClosing.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-600 font-black text-[9px] uppercase tracking-wider">Actual</span>
                                <span className="font-black text-slate-900 tabular-nums">KES {(formData.closing_float || 0).toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Sales by Payment Method */}
                        <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-sm space-y-1.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">By Payment Method</p>
                            {[
                                { label: 'Cash', value: currentShift?.total_cash_sales || 0 },
                                { label: 'M-Pesa', value: currentShift?.total_mpesa_sales || 0 },
                                { label: 'Card', value: currentShift?.total_card_sales || 0 },
                            ].map(row => (
                                <div key={row.label} className="flex justify-between items-center">
                                    <span className="text-slate-500">{row.label}</span>
                                    <span className="font-black text-slate-800 tabular-nums">{row.value > 0 ? `KES ${row.value.toLocaleString()}` : '—'}</span>
                                </div>
                            ))}
                            <div className="border-t border-slate-100 pt-1.5 flex justify-between items-center">
                                <span className="text-slate-600 font-black text-[9px] uppercase tracking-wider">Total Sales</span>
                                <span className="font-black text-slate-900 tabular-nums">KES {(currentShift?.total_sales || 0).toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Revenue by Stream */}
                        <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-sm space-y-1.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Revenue by Stream</p>
                            {[
                                { label: 'Restaurant', value: formData.restaurant_revenue || 0 },
                                { label: 'Bar', value: formData.bar_revenue || 0 },
                                { label: 'Rooms', na: formData.rooms_na, value: formData.room_booking_revenue || 0 },
                                { label: 'Conference', na: formData.conference_na, value: formData.conference_revenue || 0 },
                                { label: 'Pool', na: formData.pool_na, value: formData.swimming_pool_revenue || 0 },
                                { label: 'Other', value: formData.other_revenue || 0 },
                            ].map(row => (
                                <div key={row.label} className="flex justify-between items-center">
                                    <span className="text-slate-500">{row.label}</span>
                                    <span className="font-black text-slate-800 tabular-nums">
                                        {row.na ? <span className="text-slate-300 text-[9px]">N/A</span> : row.value > 0 ? `KES ${row.value.toLocaleString()}` : '—'}
                                    </span>
                                </div>
                            ))}
                            <div className="border-t border-slate-100 pt-1.5 flex justify-between items-center">
                                <span className="text-slate-600 font-black text-[9px] uppercase tracking-wider">Subtotal</span>
                                <span className="font-black text-slate-900 tabular-nums">KES {totalRevenue.toLocaleString()}</span>
                            </div>
                        </div>

                        {/* Credit & Bills */}
                        <div className="p-3 bg-white rounded-lg border border-slate-100 shadow-sm space-y-1.5">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Credit & Bills</p>
                            {[
                                { label: 'Created', value: formData.credit_bills_taken || 0, color: 'text-orange-600' },
                                { label: 'Paid', value: formData.paid_bills_value || 0, color: 'text-emerald-600' },
                                { label: 'Outstanding', value: outstandingCredit, color: outstandingCredit > 0 ? 'text-rose-600' : 'text-slate-800' },
                            ].map(row => (
                                <div key={row.label} className="flex justify-between items-center">
                                    <span className="text-slate-500">{row.label}</span>
                                    <span className={`font-black tabular-nums ${row.color}`}>{row.value > 0 ? `KES ${row.value.toLocaleString()}` : '—'}</span>
                                </div>
                            ))}
                        </div>

                        {/* Variance */}
                        <div className={`p-3 rounded-lg border transition-all duration-300 ${varianceBg}`}>
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Variance</p>
                            <p className="text-[9px] text-slate-400 mb-2 leading-relaxed">
                                {(currentShift?.opening_float || 0).toLocaleString()} + {cashSales.toLocaleString()} + {(formData.paid_bills_value || 0).toLocaleString()} = {expectedClosing.toLocaleString()}
                            </p>
                            <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-black uppercase tracking-wider ${varianceColor}`}>{varianceLabel}</span>
                                <span className={`text-xl font-black tabular-nums ${varianceColor}`}>
                                    {formData.closing_float ? (variance >= 0 ? `+${variance.toLocaleString()}` : variance.toLocaleString()) : '—'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 mt-4">
                        <IOSButton
                            onClick={onClose}
                            variant="secondary"
                            className="w-full h-12 bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-900 text-xs font-black rounded-xl border border-slate-100 transition-all active:scale-95 uppercase tracking-widest shadow-sm"
                        >
                            Cancel and Return
                        </IOSButton>
                    </div>
                </div>

                {/* ── Main Content Area (Minimal Light Theme) ── */}
                <div className="flex-1 overflow-y-auto px-16 py-20 custom-scrollbar bg-white">
                    <div className="max-w-[1300px] mx-auto space-y-24 pb-32">

                        {/* ── Section 1: Cash Reconciliation ── */}
                        <section className="space-y-10">
                            <div className="flex items-center gap-6 border-b border-slate-100 pb-8">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/50">
                                    <Banknote className="h-6 w-6 text-slate-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">I. Cash Reconciliation</h3>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Verify physical cash drawer totals</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="p-8 bg-slate-50/50 rounded-none border border-slate-100 shadow-sm relative overflow-hidden group">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-3">Opening Float</p>
                                        <p className="text-3xl font-black text-slate-900 tabular-nums">
                                            <span className="text-xs font-bold text-slate-300 mr-2 uppercase">KES</span>
                                            {currentShift?.opening_float?.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="p-8 bg-slate-50/50 rounded-none border border-slate-100 shadow-sm relative overflow-hidden group">
                                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-3">Cash Sales</p>
                                        <p className="text-3xl font-black text-slate-900 tabular-nums">
                                            <span className="text-xs font-bold text-slate-300 mr-2 uppercase">KES</span>
                                            {(currentShift?.total_cash_sales || 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="p-8 bg-white rounded-none border-2 border-slate-900 shadow-2xl shadow-slate-900/5 relative overflow-hidden transition-all">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <Label className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em]">Actual Cash Count</Label>
                                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xl">KES</span>
                                        <Input
                                            type="number"
                                            value={formData.closing_float || ''}
                                            onChange={(e) => updateField('closing_float', parseFloat(e.target.value) || 0)}
                                            placeholder="0.00"
                                            className="h-20 text-6xl font-black bg-transparent border-none focus:ring-0 p-0 pl-16 tabular-nums placeholder:text-slate-100 rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ── Section 2: Revenue Sources ── */}
                        <section className="space-y-10">
                            <div className="flex items-center justify-between border-b border-slate-100 pb-8">
                                <div className="flex items-center gap-6">
                                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/50">
                                        <UtensilsCrossed className="h-6 w-6 text-slate-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">II. Revenue Sources</h3>
                                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Departmental revenue declarations</p>
                                    </div>
                                </div>
                                <div className="px-6 py-3 bg-slate-900 rounded-xl shadow-lg shadow-slate-900/20">
                                    <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Total Revenue</p>
                                    <p className="text-xl font-black text-white tabular-nums">KES {totalRevenue.toLocaleString()}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                                {[
                                    { label: 'Swimming Pool', id: 'swimming_pool_revenue', icon: Waves, na: 'pool_na' },
                                    { label: 'Pool Tokens', id: 'pool_token_revenue', icon: Ticket, na: 'pool_tokens_na' },
                                    { label: 'Conference', id: 'conference_revenue', icon: Users, na: 'conference_na' },
                                    { label: 'Rooms', id: 'room_booking_revenue', icon: Bed, na: 'rooms_na' },
                                    { label: 'Restaurant', id: 'restaurant_revenue', icon: UtensilsCrossed },
                                    { label: 'Bar', id: 'bar_revenue', icon: Wine },
                                    { label: 'Catering', id: 'catering_revenue', icon: UtensilsCrossed, na: 'catering_na' },
                                    { label: 'Spa & Wellness', id: 'spa_revenue', icon: Waves, na: 'spa_na' },
                                    { label: 'Sports Bar', id: 'sports_bar_revenue', icon: Wine, na: 'sports_bar_na' },
                                    { label: 'Executive Bar', id: 'executive_bar_revenue', icon: Wine, na: 'executive_bar_na' },
                                    { label: 'Car Wash', id: 'car_wash_revenue', icon: Waves, na: 'car_wash_na' },
                                    { label: 'Cashier Station', id: 'cashier_station_revenue', icon: CreditCard, na: 'cashier_station_na' },
                                ].map((item) => (
                                    <div key={item.id} className={`p-6 bg-slate-50/50 rounded-none border border-slate-100 shadow-sm transition-all hover:bg-white hover:shadow-xl hover:-translate-y-0.5 group ${formData[item.na as keyof CloseShiftData] ? 'opacity-30 grayscale' : ''}`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <Label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                                <item.icon className={`h-4 w-4 text-slate-400`} /> {item.label}
                                            </Label>
                                            {item.na && (
                                                <Checkbox
                                                    checked={!!formData[item.na as keyof CloseShiftData]}
                                                    onCheckedChange={(checked) => updateField(item.na as keyof CloseShiftData, checked)}
                                                    className="h-3 w-3 rounded-full border-slate-300"
                                                />
                                            )}
                                        </div>
                                        <div className="relative">
                                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300">KES</span>
                                            <Input
                                                type="number"
                                                disabled={!!formData[item.na as keyof CloseShiftData]}
                                                value={(formData[item.na as keyof CloseShiftData] ? '' : (formData[item.id as keyof CloseShiftData] ?? '')) as string | number}
                                                onChange={(e) => updateField(item.id as keyof CloseShiftData, parseFloat(e.target.value) || 0)}
                                                className="h-10 text-xl font-black bg-transparent border-none focus:ring-0 p-0 pl-8 tabular-nums placeholder:text-slate-200 rounded-xl"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        {/* ── Section 3: Credit & Bills ── */}
                        <section className="space-y-10">
                            <div className="flex items-center gap-6 border-b border-slate-100 pb-8">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/50">
                                    <CreditCard className="h-6 w-6 text-slate-400" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">III. Credit & Bills</h3>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Reconcile staff credit and debt clearance</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                <div className="p-8 bg-slate-50/50 rounded-none border border-slate-100">
                                    <div className="flex items-center justify-between mb-8">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <User className="h-4 w-4" /> Staff Credit Issues
                                        </p>
                                        <p className="text-2xl font-black text-slate-900 tabular-nums">KES {formData.credit_bills_taken?.toLocaleString()}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-8">
                                        <button
                                            type="button"
                                            onClick={() => setIsCreditStaffModalOpen(true)}
                                            className="h-12 bg-white border border-slate-200 rounded-xl px-4 flex items-center justify-between group hover:border-slate-900 transition-all shadow-sm"
                                        >
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${newCreditBill.staffId ? 'text-slate-900' : 'text-slate-400'}`}>
                                                {newCreditBill.name || 'Select Staff'}
                                            </span>
                                            <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-slate-900" />
                                        </button>
                                        
                                        <StaffDropdownModal
                                            isOpen={isCreditStaffModalOpen}
                                            onClose={() => setIsCreditStaffModalOpen(false)}
                                            activeBranchId={currentShift?.branch_id}
                                            onSelect={(staff: any) => {
                                                setNewCreditBill({
                                                    ...newCreditBill,
                                                    staffId: staff.id,
                                                    name: `${staff.first_name} ${staff.last_name}`
                                                });
                                            }}
                                            title="Assign Credit Issue"
                                        />
                                        <div className="flex gap-2">
                                            <Input
                                                type="number"
                                                placeholder="Amount"
                                                value={newCreditBill.amount}
                                                onChange={(e) => setNewCreditBill({ ...newCreditBill, amount: e.target.value })}
                                                className="h-12 bg-white border-slate-100 rounded-xl px-4 text-xs font-bold"
                                            />
                                            <IOSButton onClick={addCreditBill} className="bg-slate-900 hover:bg-black text-white h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-slate-200" disabled={!newCreditBill.staffId || !newCreditBill.amount}>
                                                <Plus className="h-5 w-5" />
                                            </IOSButton>
                                        </div>
                                    </div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {(formData.credit_bills_details || []).map((bill: any) => (
                                            <div key={bill.id} className="flex items-center justify-between p-4 bg-white rounded-none border border-slate-50 shadow-sm group">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">
                                                        {bill.name.substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-900">{bill.name}</p>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{new Date(bill.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-sm font-black text-slate-600 tabular-nums">{bill.amount.toLocaleString()}</span>
                                                    <button onClick={() => removeCreditBill(bill.id)} className="p-2 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-8 bg-slate-50/50 rounded-none border border-slate-100">
                                    <div className="flex items-center justify-between mb-8">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                            <CheckCircle2 className="h-4 w-4" /> Debt Receipts
                                        </p>
                                        <p className="text-2xl font-black text-slate-900 tabular-nums">KES {formData.paid_bills_value?.toLocaleString()}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mb-8">
                                        <button
                                            type="button"
                                            onClick={() => setIsPaidStaffModalOpen(true)}
                                            className="h-12 bg-white border border-slate-200 rounded-xl px-4 flex items-center justify-between group hover:border-slate-900 transition-all shadow-sm"
                                        >
                                            <span className={`text-[10px] font-black uppercase tracking-widest ${newPaidBill.staffId ? 'text-slate-900' : 'text-slate-400'}`}>
                                                {newPaidBill.name || 'Select Payer'}
                                            </span>
                                            <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-slate-900" />
                                        </button>

                                        <StaffDropdownModal
                                            isOpen={isPaidStaffModalOpen}
                                            onClose={() => setIsPaidStaffModalOpen(false)}
                                            activeBranchId={currentShift?.branch_id}
                                            onSelect={(staff: any) => {
                                                setNewPaidBill({
                                                    ...newPaidBill,
                                                    staffId: staff.id,
                                                    name: `${staff.first_name} ${staff.last_name}`
                                                });
                                            }}
                                            title="Record Debt Clearance"
                                        />
                                        <div className="flex gap-2">
                                            <Input
                                                type="number"
                                                placeholder="Amount"
                                                value={newPaidBill.amount}
                                                onChange={(e) => setNewPaidBill({ ...newPaidBill, amount: e.target.value })}
                                                className="h-12 bg-white border-slate-100 rounded-xl px-4 text-xs font-bold"
                                            />
                                            <IOSButton onClick={addPaidBill} className="bg-slate-900 hover:bg-black text-white h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-slate-200" disabled={!newPaidBill.staffId || !newPaidBill.amount}>
                                                <Plus className="h-5 w-5" />
                                            </IOSButton>
                                        </div>
                                    </div>
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                        {(formData.paid_bills_details || []).map((bill: any) => (
                                            <div key={bill.id} className="flex items-center justify-between p-4 bg-white rounded-none border border-slate-50 shadow-sm group">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">
                                                        {bill.name.substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-slate-900">{bill.name}</p>
                                                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{new Date(bill.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-sm font-black text-slate-600 tabular-nums">{bill.amount.toLocaleString()}</span>
                                                    <button onClick={() => removePaidBill(bill.id)} className="p-2 text-slate-200 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* ── Final Section: Handover Notes ── */}
                        <section className="space-y-10 pt-16 border-t border-slate-100">
                            <div className="flex items-center gap-6">
                                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <Plus className="h-6 w-6 text-slate-400" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">Handover Notes</h3>
                            </div>
                            <Textarea
                                placeholder="Any observations or handover notes..."
                                value={formData.notes || ''}
                                onChange={(e) => updateField('notes', e.target.value)}
                                className="min-h-[150px] text-lg font-medium bg-slate-50 border-none rounded-xl p-8 focus:bg-white focus:ring-4 focus:ring-slate-100 transition-all shadow-inner placeholder:text-slate-200"
                            />
                        </section>

                        {/* ── Submission Footer ── */}
                        <div className="pt-20 pb-16 flex justify-center">
                            <IOSButton 
                                onClick={handleSubmit} 
                                loading={isLoading}
                                className="h-20 px-16 bg-slate-900 hover:bg-black text-white rounded-xl text-xl font-black shadow-2xl shadow-slate-900/20 transition-all hover:scale-[1.02] active:scale-95 flex items-center gap-4"
                                disabled={isLoading || !formData.closing_float}
                            >
                                <CheckCircle2 className="h-6 w-6 text-white" />
                                Archive Shift Log
                            </IOSButton>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
