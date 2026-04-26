'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { kyogongAPI } from '@/lib/api/kyogong';
import { toast } from 'sonner';
import { Loader2, DollarSign, Store } from 'lucide-react';

interface SalesPoint {
    id: number;
    name: string;
    code: string;
    supports_petty_cash: boolean;
}

interface ShiftOpenerProps {
    onShiftOpened: (shift: any) => void;
    salesPointCode?: string;
}

export function ShiftOpener({ onShiftOpened, salesPointCode }: ShiftOpenerProps) {
    const { user } = useAuth();
    const [salesPoints, setSalesPoints] = useState<SalesPoint[]>([]);
    const [isLoadingPoints, setIsLoadingPoints] = useState(false);
    const [loadError, setLoadError] = useState(false);

    const [selectedPointId, setSelectedPointId] = useState<string>('');
    const [openingFloat, setOpeningFloat] = useState('');
    const [openingPettyCash, setOpeningPettyCash] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchSalesPoints();
    }, []);

    const fetchSalesPoints = async () => {
        setIsLoadingPoints(true);
        setLoadError(false);
        try {
            const res = await kyogongAPI.getSalesPoints({ is_active: true });

            if (res.success && res.data) {
                setSalesPoints(res.data);

                // Auto-select by salesPointCode prop first (most specific)
                if (salesPointCode) {
                    const point = res.data.find((p: any) => p.code === salesPointCode);
                    if (point) {
                        setSelectedPointId(point.id.toString());
                        return;
                    }
                }

                // Pre-select if only one
                if (res.data.length === 1) {
                    setSelectedPointId(res.data[0].id.toString());
                }
            } else {
                setLoadError(true);
                const message = res.error || 'Could not load sales points';
                toast.error(message);
            }
        } catch (error) {
            setLoadError(true);
            const message = error instanceof Error ? error.message : 'Could not load sales points';
            toast.error(message);
        } finally {
            setIsLoadingPoints(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!selectedPointId) {
            toast.error('Please select a sales point');
            return;
        }
        
        if (!openingFloat || parseFloat(openingFloat) < 0) {
            toast.error('Please enter a valid opening float');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await kyogongAPI.openShift({
                sales_point_id: parseInt(selectedPointId),
                opening_cash_float: parseFloat(openingFloat),
                opening_petty_cash: openingPettyCash ? parseFloat(openingPettyCash) : 0
            });

            if (res.success && res.data) {
                toast.success('Shift opened successfully');
                onShiftOpened(res.data);
            } else {
                const message = res.error || 'Failed to open shift';
                toast.error(message);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to open shift';
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedPoint = salesPoints.find(p => p.id.toString() === selectedPointId);

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="w-full max-w-md bg-white rounded-xl shadow-lg border border-gray-100 p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Store className="w-8 h-8 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900">Open New Shift</h2>
                    <p className="text-gray-500 mt-2">Start your shift to begin sales</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Sales Point
                        </label>
                        {loadError ? (
                            <div className="flex items-center gap-2">
                                <p className="text-sm text-red-500 flex-1">Failed to load sales points.</p>
                                <button
                                    type="button"
                                    onClick={fetchSalesPoints}
                                    className="text-sm text-blue-600 hover:underline font-medium"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (
                        <>
                            <select
                                value={selectedPointId}
                                onChange={(e) => setSelectedPointId(e.target.value)}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors bg-white text-gray-900"
                                disabled={isLoadingPoints}
                            >
                                <option value="">{isLoadingPoints ? 'Loading...' : 'Select Sales Point...'}</option>
                                {salesPoints.map(point => (
                                    <option key={point.id} value={point.id}>
                                        {point.name}
                                    </option>
                                ))}
                            </select>
                            {!isLoadingPoints && salesPoints.length === 0 && (
                                <p className="text-sm text-amber-600 mt-1">
                                    No sales points found. Please contact your administrator.
                                </p>
                            )}
                        </>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Opening Float (Cash)
                        </label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="text-gray-500 font-medium">KES</span>
                            </div>
                            <input
                                type="number"
                                value={openingFloat}
                                onChange={(e) => setOpeningFloat(e.target.value)}
                                className="pl-14 pr-4 py-3 w-full rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-900"
                                placeholder="0.00"
                                step="0.01"
                                min="0"
                                required
                            />
                        </div>
                    </div>

                    {selectedPoint?.supports_petty_cash && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Opening Petty Cash
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="text-gray-500 font-medium">KES</span>
                                </div>
                                <input
                                    type="number"
                                    value={openingPettyCash}
                                    onChange={(e) => setOpeningPettyCash(e.target.value)}
                                    className="pl-14 pr-4 py-3 w-full rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors text-gray-900"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Existing petty cash fund balance if rolling over.
                            </p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isSubmitting || !selectedPointId || !openingFloat}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Opening Shift...
                            </>
                        ) : (
                            'Start Shift'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
