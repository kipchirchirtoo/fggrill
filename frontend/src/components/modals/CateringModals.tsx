'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    Plus,
    Calendar,
    User,
    Phone,
    MapPin,
    Users,
    Utensils,
    DollarSign,
    FileText,
    Loader2
} from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { cateringAPI } from '@/lib/api';
import { useBranch } from '@/hooks/useBranch';

interface OutsideCateringBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const OutsideCateringBookingModal = ({
    isOpen,
    onClose,
    onSuccess
}: OutsideCateringBookingModalProps) => {
    const { activeBranchId } = useBranch();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        customer_name: '',
        customer_phone: '',
        event_date: '',
        event_location: '',
        guest_count: 50,
        menu_details: '',
        total_amount: 0,
        notes: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeBranchId) {
            toast.error('No active branch selected');
            return;
        }

        setLoading(true);
        try {
            const response = await cateringAPI.createBooking({
                ...formData,
                branch_id: activeBranchId,
                total_amount: Number(formData.total_amount),
                guest_count: Number(formData.guest_count)
            });

            if (response.success) {
                toast.success('Catering booking created successfully');
                onSuccess();
                onClose();
                resetForm();
            } else {
                toast.error(response.error || 'Failed to create booking');
            }
        } catch (error: any) {
            toast.error(error.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            customer_name: '',
            customer_phone: '',
            event_date: '',
            event_location: '',
            guest_count: 50,
            menu_details: '',
            total_amount: 0,
            notes: ''
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-stone-50 rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden"
            >
                <div className="p-6 border-b border-stone-200 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                            <Utensils className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-stone-900">New Catering Booking</h2>
                            <p className="text-xs text-stone-500">Book an outside catering event</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5 text-stone-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[70vh]">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Customer Details */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-stone-700 flex items-center gap-2">
                                <User className="h-4 w-4" /> Customer Information
                            </h3>

                            <div>
                                <label className="text-xs font-medium text-stone-500 mb-1 block">Customer Name *</label>
                                <Input
                                    required
                                    placeholder="e.g. John Doe"
                                    value={formData.customer_name}
                                    onChange={e => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                                    className="bg-white border-stone-200 rounded-xl"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-stone-500 mb-1 block">Phone Number</label>
                                <Input
                                    placeholder="e.g. 0712345678"
                                    value={formData.customer_phone}
                                    onChange={e => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                                    className="bg-white border-stone-200 rounded-xl"
                                />
                            </div>
                        </div>

                        {/* Event Details */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-stone-700 flex items-center gap-2">
                                <Calendar className="h-4 w-4" /> Event Details
                            </h3>

                            <div>
                                <label className="text-xs font-medium text-stone-500 mb-1 block">Event Date & Time *</label>
                                <Input
                                    required
                                    type="datetime-local"
                                    value={formData.event_date}
                                    onChange={e => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                                    className="bg-white border-stone-200 rounded-xl [color-scheme:light]"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-medium text-stone-500 mb-1 block">Event Location *</label>
                                <Input
                                    required
                                    placeholder="e.g. Karen Residence"
                                    value={formData.event_location}
                                    onChange={e => setFormData(prev => ({ ...prev, event_location: e.target.value }))}
                                    className="bg-white border-stone-200 rounded-xl"
                                />
                            </div>
                        </div>

                        {/* Logistics & Pricing */}
                        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-stone-100">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-stone-700 flex items-center gap-2">
                                    <Users className="h-4 w-4" /> Logistics
                                </h3>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-stone-500 mb-1 block">Guest Count</label>
                                        <Input
                                            type="number"
                                            min="1"
                                            value={formData.guest_count}
                                            onChange={e => setFormData(prev => ({ ...prev, guest_count: parseInt(e.target.value) }))}
                                            className="bg-white border-stone-200 rounded-xl"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-stone-500 mb-1 block">Total Amount *</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                            <Input
                                                required
                                                type="number"
                                                min="0"
                                                placeholder="0.00"
                                                value={formData.total_amount}
                                                onChange={e => setFormData(prev => ({ ...prev, total_amount: parseFloat(e.target.value) }))}
                                                className="bg-white border-stone-200 rounded-xl pl-9"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-medium text-stone-500 mb-1 block">Menu Details</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Briefly describe the menu selected..."
                                        value={formData.menu_details}
                                        onChange={e => setFormData(prev => ({ ...prev, menu_details: e.target.value }))}
                                        className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="font-semibold text-stone-700 flex items-center gap-2">
                                    <FileText className="h-4 w-4" /> Additional Info
                                </h3>

                                <div>
                                    <label className="text-xs font-medium text-stone-500 mb-1 block">Notes / Special Instructions</label>
                                    <textarea
                                        rows={6}
                                        placeholder="Any other details..."
                                        value={formData.notes}
                                        onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                        className="w-full bg-white border border-stone-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex gap-3">
                        <IOSButton
                            type="button"
                            variant="secondary"
                            onClick={onClose}
                            className="flex-1 rounded-2xl py-6"
                        >
                            Cancel
                        </IOSButton>
                        <IOSButton
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl py-6"
                        >
                            {loading ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="h-5 w-5 mr-2" />
                                    Confirm Booking
                                </>
                            )}
                        </IOSButton>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};
