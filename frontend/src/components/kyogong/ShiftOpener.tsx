'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Loader2, DollarSign, Store } from 'lucide-react';
import { API_URL } from '@/lib/config';

interface SalesPoint {
    id: number;
    name: string;
    code: string;
    supports_petty_cash: boolean;
}

interface ShiftOpenerProps {
    onShiftOpened: (shift: any) => void;
}

export function ShiftOpener({ onShiftOpened }: ShiftOpenerProps) {
    const { user } = useAuth();
    const [salesPoints, setSalesPoints] = useState<SalesPoint[]>([]);
    const [isLoadingPoints, setIsLoadingPoints] = useState(false);

    const [selectedPointId, setSelectedPointId] = useState<string>('');
    const [openingFloat, setOpeningFloat] = useState('');
    const [openingPettyCash, setOpeningPettyCash] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchSalesPoints();
    }, []);

    const fetchSalesPoints = async () => {
        setIsLoadingPoints(true);
        try {
            // We need to add this endpoint to api.ts or use fetchAPI directly
            // Using fetchAPI for now as it might not be in api.ts yet
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/kyogong/sales-points?is_active=true`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();

            if (data.success) {
                setSalesPoints(data.data);
                // Pre-select if only one
                if (data.data.length === 1) {
                    setSelectedPointId(data.data[0].id.toString());
                }

                // Intelligent pre-selection based on Role
                // This mimics the logic we want: roles mapped to specific points
                if (user?.role?.includes('spa')) {
                    const point = data.data.find((p: any) => p.code === 'SPA');
                    if (point) setSelectedPointId(point.id.toString());
                } else if (user?.role?.includes('sports_bar')) {
                    const point = data.data.find((p: any) => p.code === 'SPORTS_BAR');
                    if (point) setSelectedPointId(point.id.toString());
                } else if (user?.role?.includes('executive_bar')) {
                    const point = data.data.find((p: any) => p.code === 'EXEC_BAR');
                    if (point) setSelectedPointId(point.id.toString());
                } else if (user?.role?.includes('reception')) {
                    const point = data.data.find((p: any) => p.code === 'RECEPTION');
                    if (point) setSelectedPointId(point.id.toString());
                }
            }
        } catch (error) {
            console.error('Failed to fetch sales points', error);
            toast.error('Could not load sales points');
        } finally {
            setIsLoadingPoints(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPointId || !openingFloat) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/api/kyogong/shifts/open`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    sales_point_id: parseInt(selectedPointId),
                    opening_cash_float: parseFloat(openingFloat),
                    opening_petty_cash: openingPettyCash ? parseFloat(openingPettyCash) : 0
                })
            });
            const data = await res.json();

            if (data.success) {
                toast.success('Shift opened successfully');
                onShiftOpened(data.data);
            } else {
                toast.error(data.error || 'Failed to open shift');
            }
        } catch (error) {
            console.error('Open shift error:', error);
            toast.error('Failed to open shift');
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
                        <select
                            value={selectedPointId}
                            onChange={(e) => setSelectedPointId(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors bg-white text-gray-900"
                            disabled={isLoadingPoints}
                        >
                            <option value="">Select Sales Point...</option>
                            {salesPoints.map(point => (
                                <option key={point.id} value={point.id}>
                                    {point.name}
                                </option>
                            ))}
                        </select>
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
