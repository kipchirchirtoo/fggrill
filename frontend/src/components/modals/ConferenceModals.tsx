'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, Clock, Users, DollarSign, FileText, Save, Info, Building2, Plus, Minus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { conferenceAPI } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface ConferenceBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function ConferenceBookingModal({ isOpen, onClose, onSuccess }: ConferenceBookingModalProps): JSX.Element | null {
    const { activeBranchId } = useBranch();
    const [activeTab, setActiveTab] = useState<'client' | 'event' | 'meals' | 'schedule' | 'amenities'>('client');
    const [halls, setHalls] = useState<any[]>([]);
    const [isLoadingHalls, setIsLoadingHalls] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState<any>({
        conference_hall_id: '',
        company_name: '',
        contact_person: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        activity_type: 'Full Day Conference',
        start_date: '',
        end_date: '',
        num_participants: 0,
        amount_per_pax: 0,
        meal_plan_details: [],
        amenities_details: [],
        program_schedule: [],
        payment_mode: 'Invoice',
        total_amount: 0,
        notes: ''
    });

    const mealOptions = [
        { id: 'full-day', name: 'Full Day', price: 0 },
        { id: 'half-day', name: 'Half Day', price: 0 },
        { id: 'full-board', name: 'Full Board', price: 0 },
        { id: 'half-board', name: 'Half Board', price: 0 },
        { id: 'dinner', name: 'Dinner', price: 0 }
    ];

    const amenityOptions = [
        { id: 'projector', name: 'Projector', unit_cost: 0 },
        { id: 'pa-system', name: 'PA System', unit_cost: 0 },
        { id: 'microphone', name: 'Microphones', unit_cost: 0 },
        { id: 'flip-chart', name: 'Flip charts', unit_cost: 0 },
        { id: 'writing-materials', name: 'Writing materials', unit_cost: 0 }
    ];

    useEffect(() => {
        if (isOpen && activeBranchId) {
            fetchHalls();
        }
    }, [isOpen, activeBranchId]);

    const fetchHalls = async () => {
        setIsLoadingHalls(true);
        try {
            const response = await conferenceAPI.getHalls(activeBranchId as any);
            if (response.success) {
                setHalls(response.data || []);
            }
        } catch (error) {
            toast.error('Failed to load conference halls');
        } finally {
            setIsLoadingHalls(false);
        }
    };

    const calculateTotals = () => {
        let total = 0;
        const hall = halls.find(h => h.id === formData.conference_hall_id);

        // 1. Hall Rate
        if (hall && formData.start_date && formData.end_date) {
            const start = new Date(formData.start_date);
            const end = new Date(formData.end_date);
            const diffMs = end.getTime() - start.getTime();
            if (diffMs > 0) {
                const diffHours = diffMs / (1000 * 60 * 60);
                if (diffHours >= 8) {
                    total += Math.ceil(diffHours / 24) * hall.base_price_per_day;
                } else {
                    total += Math.ceil(diffHours) * hall.base_price_per_hour;
                }
            }
        }

        // 2. Per Pax
        if (formData.num_participants && formData.amount_per_pax) {
            total += (formData.num_participants * formData.amount_per_pax);
        }

        // 3. Meals
        formData.meal_plan_details.forEach((meal: any) => {
            total += (meal.price * (meal.pax || formData.num_participants));
        });

        // 4. Amenities
        formData.amenities_details.forEach((item: any) => {
            total += (item.unit_cost * item.quantity);
        });

        return total;
    };

    useEffect(() => {
        const total = calculateTotals();
        setFormData((prev: any) => ({ ...prev, total_amount: total }));
    }, [
        formData.conference_hall_id,
        formData.start_date,
        formData.end_date,
        formData.num_participants,
        formData.amount_per_pax,
        formData.meal_plan_details,
        formData.amenities_details
    ]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.conference_hall_id || !formData.start_date || !formData.end_date || !formData.customer_name) {
            toast.error('Please fill in required fields (Hall, Dates, Name)');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await conferenceAPI.createBooking({
                ...formData,
                branch_id: activeBranchId
            });

            if (response.success) {
                toast.success('Conference booking created successfully');
                onSuccess?.();
                onClose();
            } else {
                toast.error(response.message || 'Failed to create booking');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to create booking');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <Calendar className="h-6 w-6 text-indigo-600" />
                        Conference Booking Management
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-6 bg-gray-50 border-b border-gray-100 overflow-x-auto gap-4">
                    {[
                        { id: 'client', label: 'Client Details' },
                        { id: 'event', label: 'Hall & Event' },
                        { id: 'meals', label: 'Meal Plan' },
                        { id: 'amenities', label: 'Amenities' },
                        { id: 'schedule', label: 'Schedule' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`py-3 px-2 border-b-2 font-medium text-sm transition-all whitespace-nowrap ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
                    {activeTab === 'client' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-2">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Company / Group Name</label>
                                <input
                                    type="text"
                                    value={formData.company_name}
                                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Contact Person</label>
                                <input
                                    type="text"
                                    value={formData.contact_person}
                                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Customer Display Name*</label>
                                <input
                                    type="text"
                                    value={formData.customer_name}
                                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                    required
                                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Telephone Number</label>
                                <input
                                    type="tel"
                                    value={formData.customer_phone}
                                    onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-semibold text-gray-700">Payment Mode</label>
                                <select
                                    value={formData.payment_mode}
                                    onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="Invoice">Invoice</option>
                                    <option value="Cash">Cash</option>
                                    <option value="MPesa">MPesa</option>
                                    <option value="Card">Card</option>
                                </select>
                            </div>
                        </div>
                    )}

                    {activeTab === 'event' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-right-2">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Hall Booked*</label>
                                <select
                                    value={formData.conference_hall_id}
                                    onChange={(e) => setFormData({ ...formData, conference_hall_id: e.target.value })}
                                    required
                                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Select Hall</option>
                                    {halls.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Activity Type</label>
                                <select
                                    value={formData.activity_type}
                                    onChange={(e) => setFormData({ ...formData, activity_type: e.target.value })}
                                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="Full Day Conference">Full Day Conference</option>
                                    <option value="Half Day Meeting">Half Day Meeting</option>
                                    <option value="Training">Training</option>
                                    <option value="Workshop">Workshop</option>
                                    <option value="Dinner Event">Dinner Event</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Check-in Date*</label>
                                <input
                                    type="datetime-local"
                                    value={formData.start_date}
                                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                    required
                                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Check-out Date*</label>
                                <input
                                    type="datetime-local"
                                    value={formData.end_date}
                                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                    required
                                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">No. of Pax</label>
                                <input
                                    type="number"
                                    value={formData.num_participants}
                                    onChange={(e) => setFormData({ ...formData, num_participants: parseInt(e.target.value) || 0 })}
                                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Amount Per Pax (Optional)</label>
                                <input
                                    type="number"
                                    value={formData.amount_per_pax}
                                    onChange={(e) => setFormData({ ...formData, amount_per_pax: parseInt(e.target.value) || 0 })}
                                    className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'meals' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                            <h3 className="font-semibold text-gray-900">Select Meal Plans</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {mealOptions.map(meal => {
                                    const selected = formData.meal_plan_details.find((m: any) => m.id === meal.id);
                                    return (
                                        <div key={meal.id} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${selected ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="checkbox"
                                                    checked={!!selected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({ ...formData, meal_plan_details: [...formData.meal_plan_details, { ...meal, pax: formData.num_participants }] });
                                                        } else {
                                                            setFormData({ ...formData, meal_plan_details: formData.meal_plan_details.filter((m: any) => m.id !== meal.id) });
                                                        }
                                                    }}
                                                    className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <div>
                                                    <p className="font-bold text-gray-900">{meal.name}</p>
                                                    <p className="text-xs text-gray-500">Connects to kitchen/POS</p>
                                                </div>
                                            </div>
                                            {selected && (
                                                <div className="flex items-center gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] uppercase font-bold text-gray-400">Price</label>
                                                        <input
                                                            type="number"
                                                            value={selected.price}
                                                            onChange={(e) => {
                                                                const updated = formData.meal_plan_details.map((m: any) => m.id === meal.id ? { ...m, price: parseInt(e.target.value) || 0 } : m);
                                                                setFormData({ ...formData, meal_plan_details: updated });
                                                            }}
                                                            className="w-24 h-8 px-2 bg-white border border-gray-200 rounded-lg text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] uppercase font-bold text-gray-400">Pax</label>
                                                        <input
                                                            type="number"
                                                            value={selected.pax}
                                                            onChange={(e) => {
                                                                const updated = formData.meal_plan_details.map((m: any) => m.id === meal.id ? { ...m, pax: parseInt(e.target.value) || 0 } : m);
                                                                setFormData({ ...formData, meal_plan_details: updated });
                                                            }}
                                                            className="w-20 h-8 px-2 bg-white border border-gray-200 rounded-lg text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'amenities' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                            <h3 className="font-semibold text-gray-900">Extra Amenities Management</h3>
                            <div className="grid grid-cols-1 gap-3">
                                {amenityOptions.map(item => {
                                    const selected = formData.amenities_details.find((a: any) => a.id === item.id);
                                    return (
                                        <div key={item.id} className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${selected ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                                            <div className="flex items-center gap-4">
                                                <input
                                                    type="checkbox"
                                                    checked={!!selected}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData({ ...formData, amenities_details: [...formData.amenities_details, { ...item, quantity: 1 }] });
                                                        } else {
                                                            setFormData({ ...formData, amenities_details: formData.amenities_details.filter((a: any) => a.id !== item.id) });
                                                        }
                                                    }}
                                                    className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                />
                                                <p className="font-bold text-gray-900">{item.name}</p>
                                            </div>
                                            {selected && (
                                                <div className="flex items-center gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] uppercase font-bold text-gray-400">Qty</label>
                                                        <input
                                                            type="number"
                                                            value={selected.quantity}
                                                            onChange={(e) => {
                                                                const updated = formData.amenities_details.map((a: any) => a.id === item.id ? { ...a, quantity: parseInt(e.target.value) || 0 } : a);
                                                                setFormData({ ...formData, amenities_details: updated });
                                                            }}
                                                            className="w-20 h-8 px-2 bg-white border border-gray-200 rounded-lg text-sm"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] uppercase font-bold text-gray-400">Unit Cost</label>
                                                        <input
                                                            type="number"
                                                            value={selected.unit_cost}
                                                            onChange={(e) => {
                                                                const updated = formData.amenities_details.map((a: any) => a.id === item.id ? { ...a, unit_cost: parseInt(e.target.value) || 0 } : a);
                                                                setFormData({ ...formData, amenities_details: updated });
                                                            }}
                                                            className="w-24 h-8 px-2 bg-white border border-gray-200 rounded-lg text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {activeTab === 'schedule' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-gray-900">Program Schedule</h3>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, program_schedule: [...formData.program_schedule, { id: Date.now(), time: '', activity: '', pax: formData.num_participants }] })}
                                    className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 hover:bg-indigo-700"
                                >
                                    <Plus size={14} /> Add Activity
                                </button>
                            </div>
                            <div className="space-y-3">
                                {formData.program_schedule.map((item: any) => (
                                    <div key={item.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex gap-3 items-end">
                                        <div className="space-y-1 flex-1">
                                            <label className="text-[10px] uppercase font-bold text-gray-400">Time</label>
                                            <input
                                                type="time"
                                                value={item.time}
                                                onChange={(e) => {
                                                    const updated = formData.program_schedule.map((s: any) => s.id === item.id ? { ...s, time: e.target.value } : s);
                                                    setFormData({ ...formData, program_schedule: updated });
                                                }}
                                                className="w-full h-9 px-2 bg-white border border-gray-200 rounded-lg text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1 flex-[3]">
                                            <label className="text-[10px] uppercase font-bold text-gray-400">Activity / Meal Details</label>
                                            <input
                                                type="text"
                                                value={item.activity}
                                                placeholder="e.g. Morning Tea with Snacks"
                                                onChange={(e) => {
                                                    const updated = formData.program_schedule.map((s: any) => s.id === item.id ? { ...s, activity: e.target.value } : s);
                                                    setFormData({ ...formData, program_schedule: updated });
                                                }}
                                                className="w-full h-9 px-2 bg-white border border-gray-200 rounded-lg text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1 flex-1">
                                            <label className="text-[10px] uppercase font-bold text-gray-400">Pax</label>
                                            <input
                                                type="number"
                                                value={item.pax}
                                                onChange={(e) => {
                                                    const updated = formData.program_schedule.map((s: any) => s.id === item.id ? { ...s, pax: parseInt(e.target.value) || 0 } : s);
                                                    setFormData({ ...formData, program_schedule: updated });
                                                }}
                                                className="w-full h-9 px-2 bg-white border border-gray-200 rounded-lg text-sm"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setFormData({ ...formData, program_schedule: formData.program_schedule.filter((s: any) => s.id !== item.id) })}
                                            className="h-9 w-9 flex items-center justify-center bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {formData.program_schedule.length === 0 && (
                                    <div className="p-8 text-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl">
                                        <p className="text-gray-400 text-sm">No activities scheduled yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </form>

                {/* Footer Pricing Summary */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-indigo-900 font-medium">
                            <DollarSign className="h-5 w-5 text-indigo-600" />
                            Auto-calculated Total Amount
                        </div>
                        <div className="text-2xl font-bold text-indigo-700">
                            KES {formData.total_amount.toLocaleString()}
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl border border-gray-200 font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="flex-[2] h-12 bg-indigo-600 rounded-xl font-bold text-white hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creating Booking...
                                </>
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    Confirm & Generate Invoice
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

/**
 * Modal to record partial or full payment for a conference booking
 */
export function AddConferencePaymentModal({
    isOpen,
    onClose,
    booking,
    onSuccess
}: {
    isOpen: boolean;
    onClose: () => void;
    booking: any;
    onSuccess: () => void;
}) {
    const [amount, setAmount] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [reference, setReference] = useState('');
    const [remarks, setRemarks] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !booking) return null;

    const balance = booking.total_amount - (booking.amount_paid || 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (amount <= 0) {
            toast.error("Please enter a valid amount");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await conferenceAPI.addPayment(booking.id, {
                amount,
                payment_method: paymentMethod,
                reference,
                remarks
            });

            if (res.success) {
                toast.success("Payment recorded successfully");
                onSuccess();
                onClose();
            } else {
                toast.error(res.message || "Failed to record payment");
            }
        } catch (error) {
            toast.error("An error occurred while recording payment");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
                <div className="px-6 py-4 bg-indigo-600 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">Record Payment</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="h-6 w-6 text-white" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-indigo-600 font-medium">Invoice:</span>
                            <span className="font-bold text-indigo-900">{booking.invoice_number}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-indigo-600 font-medium">Customer:</span>
                            <span className="font-bold text-indigo-900">{booking.company_name || booking.customer_name}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-indigo-200">
                            <span className="text-indigo-600 font-medium">Outstanding Balance:</span>
                            <span className="text-lg font-black text-indigo-700">KES {balance.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Payment Amount*</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">KES</span>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(Number(e.target.value))}
                                    max={balance}
                                    className="w-full h-12 pl-12 pr-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-lg"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Payment Method*</label>
                            <select
                                value={paymentMethod}
                                onChange={(e) => setPaymentMethod(e.target.value)}
                                className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                                required
                            >
                                <option value="cash">Cash</option>
                                <option value="mpesa">M-Pesa</option>
                                <option value="card">Bank Card</option>
                                <option value="bank_transfer">Bank Transfer</option>
                                <option value="cheque">Cheque</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Reference Number (Optional)</label>
                            <input
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                placeholder="e.g. M-Pesa Code"
                                className="w-full h-12 px-4 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || amount <= 0}
                        className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <DollarSign className="h-6 w-6" />
                                Confirm Payment
                            </>
                        )}
                    </button>
                </form>
            </motion.div>
        </div>
    );
}
