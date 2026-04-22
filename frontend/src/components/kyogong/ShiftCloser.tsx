'use client';

import React, { useState } from 'react';
import { kyogongAPI } from '@/lib/api/kyogong';
import { toast } from 'sonner';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface ShiftCloserProps {
    shift: any;
    onShiftClosed: () => void;
}

export function ShiftCloser({ shift, onShiftClosed }: ShiftCloserProps) {
    const [closingCash, setClosingCash] = useState('');
    const [closingPettyCash, setClosingPettyCash] = useState('');
    const [varianceReason, setVarianceReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showVarianceField, setShowVarianceField] = useState(false);

    console.log('🌐 [ShiftCloser] Received shift prop:', JSON.stringify(shift, null, 2));
    console.log('🌐 [ShiftCloser] Shift ID:', shift?.id);
    console.log('🌐 [ShiftCloser] Shift keys:', shift ? Object.keys(shift) : 'null');

    // Early validation
    if (!shift) {
        return (
            <div className="max-w-lg mx-auto bg-red-50 rounded-xl border border-red-200 p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-red-900 mb-2">Invalid Shift Data</h3>
                <p className="text-red-700 text-sm">No shift data available. Please refresh the page.</p>
            </div>
        );
    }

    if (!shift.id) {
        return (
            <div className="max-w-lg mx-auto bg-red-50 rounded-xl border border-red-200 p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-red-900 mb-2">Missing Shift ID</h3>
                <p className="text-red-700 text-sm mb-4">
                    The shift data is missing a required ID field. This may be a data synchronization issue.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                    Refresh Page
                </button>
            </div>
        );
    }

    const cashExpected = (shift.opening_cash_float || 0) + (shift.cash_sales || 0);
    const cashVariance = closingCash ? parseFloat(closingCash) - cashExpected : null;
    const varianceThreshold = Math.max(cashExpected * 0.05, 1000);
    const varianceIsLarge = cashVariance !== null && Math.abs(cashVariance) > varianceThreshold;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!shift?.id) {
            console.error('🌐 [ShiftCloser] ERROR: Cannot close shift - ID is missing!', shift);
            toast.error('Invalid shift data. Please refresh the page and try again.');
            return;
        }
        
        if (!closingCash) {
            toast.error('Closing cash count is required');
            return;
        }
        if (varianceIsLarge && !varianceReason) {
            toast.error('Please provide an explanation for the variance');
            setShowVarianceField(true);
            return;
        }

        setIsSubmitting(true);
        try {
            console.log('🌐 [ShiftCloser] Closing shift with ID:', shift.id);
            const res = await kyogongAPI.closeShift(shift.id, {
                closing_cash_counted: parseFloat(closingCash),
                closing_petty_cash: closingPettyCash ? parseFloat(closingPettyCash) : undefined,
                variance_reason: varianceReason || undefined
            });

            if (res.success) {
                toast.success('Shift closed! Submitted for review.');
                onShiftClosed();
            } else {
                if (res.data?.variance !== undefined) {
                    setShowVarianceField(true);
                    toast.warning(res.error || 'Variance explanation required');
                } else {
                    toast.error(res.error || 'Failed to close shift');
                }
            }
        } catch (error) {
            console.error('🌐 [ShiftCloser] Error closing shift:', error);
            toast.error('Failed to close shift');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="max-w-lg mx-auto bg-white rounded-xl shadow-lg border p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Close Shift</h2>

            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-gray-600">Opening Float</span>
                    <span className="font-medium">KES {(shift.opening_cash_float || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Cash Sales</span>
                    <span className="font-medium">KES {(shift.cash_sales || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold border-t pt-2">
                    <span>Expected Cash</span>
                    <span>KES {cashExpected.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-blue-600">
                    <span>Total Sales (All Methods)</span>
                    <span>KES {(shift.total_sales || 0).toLocaleString()}</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Closing Cash Count (Physical Count) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500">KES</span>
                        </div>
                        <input
                            type="number"
                            value={closingCash}
                            onChange={(e) => setClosingCash(e.target.value)}
                            className="pl-12 w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            placeholder="0.00"
                            required
                        />
                    </div>
                    {cashVariance !== null && (
                        <div className={`mt-2 flex items-center gap-2 text-sm font-medium ${cashVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {cashVariance >= 0 ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                            Variance: KES {cashVariance.toFixed(2)} ({cashVariance >= 0 ? 'SURPLUS' : 'SHORTAGE'})
                        </div>
                    )}
                </div>

                {shift.sales_point?.supports_petty_cash && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Closing Petty Cash</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-gray-500">KES</span>
                            </div>
                            <input
                                type="number"
                                value={closingPettyCash}
                                onChange={(e) => setClosingPettyCash(e.target.value)}
                                className="pl-12 w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                                placeholder="0.00"
                            />
                        </div>
                    </div>
                )}

                {(showVarianceField || varianceIsLarge) && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Variance Explanation <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={varianceReason}
                            onChange={(e) => setVarianceReason(e.target.value)}
                            rows={3}
                            className="w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                            placeholder="Explain the variance..."
                            required={varianceIsLarge}
                        />
                    </div>
                )}

                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center transition-colors"
                >
                    {isSubmitting ? (
                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Closing Shift...</>
                    ) : 'Close & Submit Shift'}
                </button>
            </form>
        </div>
    );
}
