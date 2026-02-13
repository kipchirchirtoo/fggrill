'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DollarSign, Waves, Ticket, Users, Bed,
    UtensilsCrossed, Wine, Plus, CreditCard,
    Banknote, Building, AlertCircle, CheckCircle2, Clock,
    Trash2, User
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
        notes: ''
    });

    const [staffList, setStaffList] = useState<any[]>([]);
    const [newCreditBill, setNewCreditBill] = useState({ staffId: '', amount: '', name: '' });


    const [newPaidBill, setNewPaidBill] = useState({ staffId: '', amount: '', name: '' });

    useEffect(() => {
        if (isOpen) {
            loadStaff();
        }
    }, [isOpen]);

    const loadStaff = async () => {
        try {
            const res = await fetchAPI('/staff?status=active') as any;
            if (res.success) setStaffList(res.data);
        } catch (error) {
            console.error('Failed to load staff list', error);
        }
    };

    const addCreditBill = () => {
        if (!newCreditBill.staffId || !newCreditBill.amount) return;

        const amount = parseFloat(newCreditBill.amount);
        if (isNaN(amount) || amount <= 0) return;

        const staff = staffList.find(s => s.id === newCreditBill.staffId);
        const bill = {
            id: Date.now().toString(),
            staff_id: newCreditBill.staffId,
            name: staff ? `${staff.first_name} ${staff.last_name}` : 'Unknown Staff',
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

        const staff = staffList.find(s => s.id === newPaidBill.staffId);
        const bill = {
            id: Date.now().toString(),
            staff_id: newPaidBill.staffId,
            name: staff ? `${staff.first_name} ${staff.last_name}` : 'Unknown Staff',
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
            formData.other_revenue || 0
        ];
        return revenue.reduce((sum, val) => sum + val, 0);
    };

    const expectedClosing = currentShift?.opening_float + (currentShift?.total_cash_sales || 0);
    const variance = formData.closing_float - expectedClosing;
    const totalRevenue = calculateTotalRevenue();

    const handleSubmit = () => {
        onSubmit(formData);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden bg-white border-none shadow-2xl">
                <div className="px-6 py-5 border-b border-stone-100 bg-stone-50/50">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-stone-900 tracking-tight">Close Shift - {currentShift?.shift_number}</DialogTitle>
                        <p className="text-[11px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3" />
                            Started: {currentShift?.shift_start && new Date(currentShift.shift_start).toLocaleString()}
                        </p>
                    </DialogHeader>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <Tabs defaultValue="cash" className="w-full">
                        <TabsList className="grid w-full grid-cols-4 mb-8 bg-stone-100/50 p-1 rounded-xl">
                            <TabsTrigger value="cash" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Cash Float</TabsTrigger>
                            <TabsTrigger value="revenue" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Revenue</TabsTrigger>
                            <TabsTrigger value="credit" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Credit/Bills</TabsTrigger>
                            <TabsTrigger value="banking" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">Banking</TabsTrigger>
                        </TabsList>

                        {/* Tab 1: Cash Float */}
                        <TabsContent value="cash" className="space-y-6 mt-0">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
                                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <Banknote className="h-3 w-3" /> Opening Float
                                    </p>
                                    <p className="text-2xl font-black text-stone-900">
                                        KES {currentShift?.opening_float?.toLocaleString() || 0}
                                    </p>
                                </div>
                                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <DollarSign className="h-3 w-3" /> Cash Sales
                                    </p>
                                    <p className="text-2xl font-black text-emerald-700">
                                        KES {currentShift?.total_cash_sales?.toLocaleString() || 0}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[12px] font-bold text-stone-900 uppercase tracking-widest">Actual Closing Cash Count *</Label>
                                <Input
                                    type="number"
                                    placeholder="Enter physical cash amount"
                                    value={formData.closing_float || ''}
                                    onChange={(e) => updateField('closing_float', parseFloat(e.target.value) || 0)}
                                    className="h-14 text-2xl font-black text-stone-900 border-2 focus:border-stone-900 transition-all rounded-xl px-6"
                                />
                            </div>

                            {formData.closing_float > 0 && (
                                <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                        <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mb-1">Expected Cash</p>
                                        <p className="text-xl font-black text-blue-700">
                                            KES {expectedClosing?.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className={`p-4 rounded-xl border ${variance === 0 ? 'bg-emerald-50/50 border-emerald-100' : variance > 0 ? 'bg-orange-50/50 border-orange-100' : 'bg-rose-50/50 border-rose-100'}`}>
                                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${variance === 0 ? 'text-emerald-500' : variance > 0 ? 'text-orange-500' : 'text-rose-500'}`}>
                                            Net Variance
                                        </p>
                                        <p className={`text-xl font-black ${variance === 0 ? 'text-emerald-700' : variance > 0 ? 'text-orange-700' : 'text-rose-700'}`}>
                                            {variance > 0 ? '+' : ''}KES {variance?.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </TabsContent>

                        {/* Tab 2: Revenue by Source */}
                        <TabsContent value="revenue" className="space-y-6 mt-0 pb-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Swimming Pool */}
                                <div className="space-y-3 p-4 bg-stone-50/50 rounded-xl border border-stone-100 transition-all focus-within:border-stone-400">
                                    <div className="flex items-center justify-between">
                                        <Label className="flex items-center gap-2 text-[11px] font-bold text-stone-900 uppercase tracking-widest">
                                            <Waves className="h-4 w-4 text-blue-500" />
                                            Swimming Pool
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                checked={formData.pool_na}
                                                onCheckedChange={(checked) => updateField('pool_na', checked)}
                                                className="border-stone-300"
                                            />
                                            <span className="text-[10px] font-bold text-stone-500 uppercase">N/A</span>
                                        </div>
                                    </div>
                                    <Input
                                        type="number"
                                        disabled={formData.pool_na}
                                        value={formData.pool_na ? '' : formData.swimming_pool_revenue || ''}
                                        onChange={(e) => updateField('swimming_pool_revenue', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="h-11 font-bold bg-white rounded-lg px-4"
                                    />
                                </div>

                                {/* Pool Tokens */}
                                <div className="space-y-3 p-4 bg-stone-50/50 rounded-xl border border-stone-100 transition-all focus-within:border-stone-400">
                                    <div className="flex items-center justify-between">
                                        <Label className="flex items-center gap-2 text-[11px] font-bold text-stone-900 uppercase tracking-widest">
                                            <Ticket className="h-4 w-4 text-cyan-500" />
                                            Pool Tokens
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                checked={formData.pool_tokens_na}
                                                onCheckedChange={(checked) => updateField('pool_tokens_na', checked)}
                                                className="border-stone-300"
                                            />
                                            <span className="text-[10px] font-bold text-stone-500 uppercase">N/A</span>
                                        </div>
                                    </div>
                                    <Input
                                        type="number"
                                        disabled={formData.pool_tokens_na}
                                        value={formData.pool_tokens_na ? '' : formData.pool_token_revenue || ''}
                                        onChange={(e) => updateField('pool_token_revenue', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="h-11 font-bold bg-white rounded-lg px-4"
                                    />
                                </div>

                                {/* Conference */}
                                <div className="space-y-3 p-4 bg-stone-50/50 rounded-xl border border-stone-100 transition-all focus-within:border-stone-400">
                                    <div className="flex items-center justify-between">
                                        <Label className="flex items-center gap-2 text-[11px] font-bold text-stone-900 uppercase tracking-widest">
                                            <Users className="h-4 w-4 text-purple-500" />
                                            Conference
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                checked={formData.conference_na}
                                                onCheckedChange={(checked) => updateField('conference_na', checked)}
                                                className="border-stone-300"
                                            />
                                            <span className="text-[10px] font-bold text-stone-500 uppercase">N/A</span>
                                        </div>
                                    </div>
                                    <Input
                                        type="number"
                                        disabled={formData.conference_na}
                                        value={formData.conference_na ? '' : formData.conference_revenue || ''}
                                        onChange={(e) => updateField('conference_revenue', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="h-11 font-bold bg-white rounded-lg px-4"
                                    />
                                </div>

                                {/* Room Bookings */}
                                <div className="space-y-3 p-4 bg-stone-50/50 rounded-xl border border-stone-100 transition-all focus-within:border-stone-400">
                                    <div className="flex items-center justify-between">
                                        <Label className="flex items-center gap-2 text-[11px] font-bold text-stone-900 uppercase tracking-widest">
                                            <Bed className="h-4 w-4 text-indigo-500" />
                                            Rooms
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                checked={formData.rooms_na}
                                                onCheckedChange={(checked) => updateField('rooms_na', checked)}
                                                className="border-stone-300"
                                            />
                                            <span className="text-[10px] font-bold text-stone-500 uppercase">N/A</span>
                                        </div>
                                    </div>
                                    <Input
                                        type="number"
                                        disabled={formData.rooms_na}
                                        value={formData.rooms_na ? '' : formData.room_booking_revenue || ''}
                                        onChange={(e) => updateField('room_booking_revenue', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="h-11 font-bold bg-white rounded-lg px-4"
                                    />
                                </div>

                                {/* Restaurant */}
                                <div className="space-y-3 p-4 bg-stone-50/50 rounded-xl border border-stone-100 transition-all focus-within:border-stone-400">
                                    <Label className="flex items-center gap-2 text-[11px] font-bold text-stone-900 uppercase tracking-widest">
                                        <UtensilsCrossed className="h-4 w-4 text-orange-500" />
                                        Restaurant
                                    </Label>
                                    <Input
                                        type="number"
                                        value={formData.restaurant_revenue || ''}
                                        onChange={(e) => updateField('restaurant_revenue', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="h-11 font-bold bg-white rounded-lg px-4"
                                    />
                                </div>

                                {/* Bar */}
                                <div className="space-y-3 p-4 bg-stone-50/50 rounded-xl border border-stone-100 transition-all focus-within:border-stone-400">
                                    <Label className="flex items-center gap-2 text-[11px] font-bold text-stone-900 uppercase tracking-widest">
                                        <Wine className="h-4 w-4 text-rose-500" />
                                        Bar
                                    </Label>
                                    <Input
                                        type="number"
                                        value={formData.bar_revenue || ''}
                                        onChange={(e) => updateField('bar_revenue', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="h-11 font-bold bg-white rounded-lg px-4"
                                    />
                                </div>

                                {/* Other */}
                                <div className="space-y-3 p-4 bg-stone-50/50 rounded-xl border border-stone-100 transition-all focus-within:border-stone-400 md:col-span-2">
                                    <Label className="flex items-center gap-2 text-[11px] font-bold text-stone-900 uppercase tracking-widest">
                                        <Plus className="h-4 w-4 text-stone-500" />
                                        Other
                                    </Label>
                                    <Input
                                        type="number"
                                        value={formData.other_revenue || ''}
                                        onChange={(e) => updateField('other_revenue', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="h-11 font-bold bg-white rounded-lg px-4"
                                    />
                                </div>
                            </div>

                            <div className="p-5 bg-stone-900 text-white rounded-2xl shadow-xl shadow-stone-900/10">
                                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-1">Shift Total Revenue (All Streams)</p>
                                <p className="text-3xl font-black">
                                    KES {totalRevenue.toLocaleString()}
                                </p>
                            </div>
                        </TabsContent>

                        {/* Tab 3: Credit & Bills */}
                        <TabsContent value="credit" className="space-y-6 mt-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Credit Bills Section */}
                                <div className="space-y-4">
                                    <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <Label className="text-[11px] font-bold text-rose-600 uppercase tracking-widest flex items-center gap-2">
                                                <User className="h-4 w-4" /> Credit Bills (Staff)
                                            </Label>
                                            <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                                Total: {formData.credit_bills_taken?.toLocaleString()} ({formData.credit_bills_count})
                                            </span>
                                        </div>

                                        <div className="space-y-3 mb-4">
                                            <Select
                                                value={newCreditBill.staffId}
                                                onValueChange={(val) => setNewCreditBill({ ...newCreditBill, staffId: val })}
                                            >
                                                <SelectTrigger className="bg-white">
                                                    <SelectValue placeholder="Select Staff Member" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {staffList.map((staff) => (
                                                        <SelectItem key={staff.id} value={staff.id}>
                                                            {staff.first_name} {staff.last_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    placeholder="Amount"
                                                    value={newCreditBill.amount}
                                                    onChange={(e) => setNewCreditBill({ ...newCreditBill, amount: e.target.value })}
                                                    className="bg-white"
                                                />
                                                <IOSButton
                                                    onClick={addCreditBill}
                                                    variant="secondary"
                                                    className="bg-rose-100 text-rose-700 hover:bg-rose-200"
                                                    disabled={!newCreditBill.staffId || !newCreditBill.amount}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </IOSButton>
                                            </div>
                                        </div>

                                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                            {formData.credit_bills_details?.map((bill: any) => (
                                                <div key={bill.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-rose-100 text-sm">
                                                    <div>
                                                        <p className="font-bold text-stone-700">{bill.name}</p>
                                                        <p className="text-xs text-stone-400">{new Date(bill.timestamp).toLocaleTimeString()}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-rose-600">{bill.amount.toLocaleString()}</span>
                                                        <button
                                                            onClick={() => removeCreditBill(bill.id)}
                                                            className="text-stone-400 hover:text-rose-600 transition-colors"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!formData.credit_bills_details || formData.credit_bills_details.length === 0) && (
                                                <p className="text-center text-xs text-stone-400 py-4 italic">No credit bills added</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Paid Bills Section */}
                                <div className="space-y-4">
                                    <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                                        <div className="flex items-center justify-between mb-3">
                                            <Label className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4" /> Paid Bills
                                            </Label>
                                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                                                Total: {formData.paid_bills_value?.toLocaleString()} ({formData.paid_bills_count})
                                            </span>
                                        </div>

                                        <div className="space-y-3 mb-4">
                                            <Select
                                                value={newPaidBill.staffId}
                                                onValueChange={(val) => setNewPaidBill({ ...newPaidBill, staffId: val })}
                                            >
                                                <SelectTrigger className="bg-white">
                                                    <SelectValue placeholder="Select Payer (Staff)" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {staffList.map((staff) => (
                                                        <SelectItem key={staff.id} value={staff.id}>
                                                            {staff.first_name} {staff.last_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <div className="flex gap-2">
                                                <Input
                                                    type="number"
                                                    placeholder="Amount"
                                                    value={newPaidBill.amount}
                                                    onChange={(e) => setNewPaidBill({ ...newPaidBill, amount: e.target.value })}
                                                    className="bg-white"
                                                />
                                                <IOSButton
                                                    onClick={addPaidBill}
                                                    variant="secondary"
                                                    className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                                    disabled={!newPaidBill.staffId || !newPaidBill.amount}
                                                >
                                                    <Plus className="h-4 w-4" />
                                                </IOSButton>
                                            </div>
                                        </div>

                                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                                            {formData.paid_bills_details?.map((bill: any) => (
                                                <div key={bill.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-emerald-100 text-sm">
                                                    <div>
                                                        <p className="font-bold text-stone-700">{bill.name}</p>
                                                        <p className="text-xs text-stone-400">{new Date(bill.timestamp).toLocaleTimeString()}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-emerald-600">{bill.amount.toLocaleString()}</span>
                                                        <button
                                                            onClick={() => removePaidBill(bill.id)}
                                                            className="text-stone-400 hover:text-emerald-600 transition-colors"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!formData.paid_bills_details || formData.paid_bills_details.length === 0) && (
                                                <p className="text-center text-xs text-stone-400 py-4 italic">No paid bills added</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>


                        </TabsContent>

                        {/* Tab 4: Banking */}
                        <TabsContent value="banking" className="space-y-6 mt-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3 p-4 bg-stone-50/50 rounded-xl border border-stone-100">
                                    <Label className="flex items-center gap-2 text-[11px] font-bold text-stone-900 uppercase tracking-widest">
                                        <Banknote className="h-4 w-4 text-emerald-500" />
                                        Physical Cash at Hand
                                    </Label>
                                    <Input
                                        type="number"
                                        value={formData.cash_at_hand || ''}
                                        onChange={(e) => updateField('cash_at_hand', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="h-11 font-bold bg-white"
                                    />
                                </div>
                                <div className="space-y-3 p-4 bg-stone-50/50 rounded-xl border border-stone-100">
                                    <Label className="flex items-center gap-2 text-[11px] font-bold text-stone-900 uppercase tracking-widest">
                                        <Building className="h-4 w-4 text-blue-500" />
                                        Commercial Bank Deposit
                                    </Label>
                                    <Input
                                        type="number"
                                        value={formData.cash_deposited || ''}
                                        onChange={(e) => updateField('cash_deposited', parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className="h-11 font-bold bg-white"
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[11px] font-bold text-stone-900 uppercase tracking-widest">Deposit Transaction Reference</Label>
                                <Input
                                    type="text"
                                    value={formData.bank_deposit_ref || ''}
                                    onChange={(e) => updateField('bank_deposit_ref', e.target.value)}
                                    placeholder="Enter deposit slip ID or mobile ref"
                                    className="h-12 font-bold px-6 border-2 focus:border-stone-900 rounded-xl"
                                />
                            </div>

                            <div className="space-y-3">
                                <Label className="text-[11px] font-bold text-stone-900 uppercase tracking-widest">Shift Performance Notes (Optional)</Label>
                                <Textarea
                                    value={formData.notes || ''}
                                    onChange={(e) => updateField('notes', e.target.value)}
                                    placeholder="Brief summary of shift highlights, anomalies or specific events..."
                                    className="min-h-[120px] p-5 bg-stone-50/50 border-stone-200 rounded-2xl resize-none text-[14px] font-medium leading-relaxed"
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="p-6 border-t border-stone-100 bg-white flex items-center justify-end gap-3">
                    <IOSButton
                        onClick={onClose}
                        variant="ghost"
                        className="h-12 px-6 rounded-xl font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
                        disabled={isLoading}
                    >
                        Keep Open
                    </IOSButton>
                    <IOSButton
                        onClick={handleSubmit}
                        className="h-12 px-8 rounded-xl font-bold bg-stone-900 text-white shadow-lg shadow-stone-900/20 hover:bg-stone-800 hover:shadow-stone-900/30 transition-all active:scale-95"
                        disabled={isLoading || !formData.closing_float}
                    >
                        {isLoading ? (
                            <span className="flex items-center gap-2">
                                <Plus className="h-4 w-4 animate-spin" /> Finalizing...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4" /> Confirm & Archive
                            </span>
                        )}
                    </IOSButton>
                </div>
            </DialogContent>
        </Dialog>
    );
}
