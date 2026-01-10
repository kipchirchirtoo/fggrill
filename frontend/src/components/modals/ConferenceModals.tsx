'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Calendar, Clock, Users, DollarSign, FileText, Save, Info } from 'lucide-react';
import { toast } from 'sonner';
import { conferenceAPI } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';

interface ConferenceBookingModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function ConferenceBookingModal({ isOpen, onClose, onSuccess }: ConferenceBookingModalProps): JSX.Element | null {
    const { activeBranchId } = useBranch();
    const [halls, setHalls] = useState<any[]>([]);
    const [isLoadingHalls, setIsLoadingHalls] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        conference_hall_id: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        start_date: '',
        end_date: '',
        total_amount: 0,
        notes: ''
    });

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

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };

            // Auto-calculate price if hall and dates are selected
            if (field === 'conference_hall_id' || field === 'start_date' || field === 'end_date') {
                const hall = halls.find(h => h.id === updated.conference_hall_id);
                if (hall && updated.start_date && updated.end_date) {
                    const start = new Date(updated.start_date);
                    const end = new Date(updated.end_date);
                    const diffMs = end.getTime() - start.getTime();
                    if (diffMs > 0) {
                        const diffHours = diffMs / (1000 * 60 * 60);
                        const diffDays = diffHours / 24;

                        // If more than 8 hours, use day rate, else use hour rate
                        if (diffHours >= 8) {
                            updated.total_amount = Math.ceil(diffDays) * hall.base_price_per_day;
                        } else {
                            updated.total_amount = Math.ceil(diffHours) * hall.base_price_per_hour;
                        }
                    }
                }
            }

            return updated;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.conference_hall_id || !formData.start_date || !formData.end_date || !formData.customer_name) {
            toast.error('Please fill in all required fields');
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
                setFormData({
                    conference_hall_id: '',
                    customer_name: '',
                    customer_phone: '',
                    customer_email: '',
                    start_date: '',
                    end_date: '',
                    total_amount: 0,
                    notes: ''
                });
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
                        New Conference Booking
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X className="h-5 w-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Hall Selection */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Select Hall*</label>
                            <select
                                value={formData.conference_hall_id}
                                onChange={(e) => handleInputChange('conference_hall_id', e.target.value)}
                                className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                required
                            >
                                <option value="">Select a hall...</option>
                                {halls.map(hall => (
                                    <option key={hall.id} value={hall.id}>
                                        {hall.name} (Cap: {hall.capacity})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Customer Name */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Customer Name*</label>
                            <input
                                type="text"
                                value={formData.customer_name}
                                onChange={(e) => handleInputChange('customer_name', e.target.value)}
                                placeholder="Individual or Organization Name"
                                className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                required
                            />
                        </div>

                        {/* Customer Contact */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Phone Number</label>
                            <input
                                type="tel"
                                value={formData.customer_phone}
                                onChange={(e) => handleInputChange('customer_phone', e.target.value)}
                                placeholder="e.g. 0712345678"
                                className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Email Address</label>
                            <input
                                type="email"
                                value={formData.customer_email}
                                onChange={(e) => handleInputChange('customer_email', e.target.value)}
                                placeholder="customer@example.com"
                                className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                            />
                        </div>

                        {/* Start Date/Time */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">Start Date & Time*</label>
                            <input
                                type="datetime-local"
                                value={formData.start_date}
                                onChange={(e) => handleInputChange('start_date', e.target.value)}
                                className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                required
                            />
                        </div>

                        {/* End Date/Time */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-gray-700">End Date & Time*</label>
                            <input
                                type="datetime-local"
                                value={formData.end_date}
                                onChange={(e) => handleInputChange('end_date', e.target.value)}
                                className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                required
                            />
                        </div>
                    </div>

                    {/* Pricing Summary */}
                    {formData.total_amount > 0 && (
                        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center justify-between">
                            <div className="flex items-center gap-3 text-indigo-900 font-medium">
                                <DollarSign className="h-5 w-5" />
                                Estimated Total Amount
                            </div>
                            <div className="text-2xl font-bold text-indigo-700">
                                KES {formData.total_amount.toLocaleString()}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Special Requests / Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => handleInputChange('notes', e.target.value)}
                            placeholder="e.g. Projector required, water for 20 people, etc."
                            rows={3}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none"
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 h-12 rounded-xl border border-gray-200 font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
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
                                    Confirm Booking
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}
