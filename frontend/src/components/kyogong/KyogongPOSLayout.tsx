'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ShiftOpener } from './ShiftOpener';
import { ShiftCloser } from './ShiftCloser';
import { SaleForm } from './SaleForm';
import { PettyCashModal } from './PettyCashModal';
import { kyogongAPI } from '@/lib/api/kyogong';
import { cashierAPI } from '@/lib/api/bar';
import { toast } from 'sonner';
import {
    Clock, DollarSign, TrendingUp, BarChart3,
    Receipt, Wallet, X, AlertCircle, Loader2,
    LogIn, LogOut, RefreshCcw, List, Plus
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { CashierModals } from '@/components/modals/CashierModals';

interface KyogongPOSLayoutProps {
    serviceType?: string;
    salesPointCode?: string;
    title: string;
    subtitle?: string;
    allowedRole: string;
    supportsPettyCash?: boolean;
}

export function KyogongPOSLayout({
    serviceType,
    salesPointCode,
    title,
    subtitle,
    allowedRole,
    supportsPettyCash = false
}: KyogongPOSLayoutProps) {
    const { user } = useAuth();
    const [activeShift, setActiveShift] = useState<any>(null);
    const [shiftLoading, setShiftLoading] = useState(true);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<'pos' | 'transactions' | 'close' | 'petty_cash'>('pos');
    const [showPettyCash, setShowPettyCash] = useState(false);
    const [showDynamicBillModal, setShowDynamicBillModal] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        fetchCurrentShift();
    }, [refreshKey]);

    const fetchCurrentShift = async () => {
        setShiftLoading(true);
        try {
            const res = await kyogongAPI.getCurrentShift();
            console.log('🌐 [Web] getCurrentShift RAW response:', JSON.stringify(res, null, 2));
            
            if (res.success && res.data) {
                console.log('🌐 [Web] Shift data:', JSON.stringify(res.data, null, 2));
                console.log('🌐 [Web] Shift ID:', res.data.id);
                console.log('🌐 [Web] Shift keys:', Object.keys(res.data));
                
                // Ensure the shift has an ID before setting it
                if (!res.data.id) {
                    console.error('🌐 [Web] CRITICAL ERROR: Shift data missing ID field!', res.data);
                    toast.error('Invalid shift data received. Please refresh the page.');
                    setActiveShift(null);
                    return;
                }
                
                setActiveShift(res.data);
                fetchTransactions(res.data.id);
            } else {
                console.log('🌐 [Web] No active shift found');
                setActiveShift(null);
            }
        } catch (error) {
            console.error('🌐 [Web] Error fetching current shift:', error);
            toast.error('Failed to load shift data');
            setActiveShift(null);
        } finally {
            setShiftLoading(false);
        }
    };

    const fetchTransactions = async (shiftId: string) => {
        if (!shiftId) {
            console.warn('Cannot fetch transactions: shiftId is undefined');
            return;
        }
        try {
            const res = await kyogongAPI.getShiftTransactions(shiftId);
            if (res.success) setTransactions(res.data || []);
        } catch { /* silent */ }
    };

    const handleShiftOpened = (shift: any) => {
        setActiveShift(shift);
        setActiveTab('pos');
        if (shift?.id) {
            fetchTransactions(shift.id);
        }
    };

    const handleShiftClosed = () => {
        setActiveShift(null);
        setTransactions([]);
        setActiveTab('pos');
        setRefreshKey(k => k + 1);
    };

    const handleTransactionCreated = (tx: any) => {
        setTransactions(prev => [tx, ...prev]);
        setRefreshKey(k => k + 1); // re-fetch shift totals
    };

    const stats = activeShift ? [
        { label: 'Cash Sales', value: `KES ${(activeShift.cash_sales || 0).toLocaleString()}`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'M-Pesa Sales', value: `KES ${(activeShift.mpesa_sales || 0).toLocaleString()}`, icon: Wallet, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Card Sales', value: `KES ${(activeShift.card_sales || 0).toLocaleString()}`, icon: Receipt, color: 'text-purple-600', bg: 'bg-purple-50' },
        { label: 'Total Sales', value: `KES ${(activeShift.total_sales || 0).toLocaleString()}`, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    ] : [];

    if (shiftLoading) return (
        <DashboardLayout>
            <div className="flex items-center justify-center h-96">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        </DashboardLayout>
    );

    return (
        <DashboardLayout>
            <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
                        {subtitle && <p className="text-gray-500 mt-0.5">{subtitle}</p>}
                    </div>
                    {activeShift && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowDynamicBillModal(true)}
                                className="flex items-center gap-1.5 bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full text-sm font-bold border border-orange-100 hover:bg-orange-100 transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Create General Bill
                            </button>
                            <div className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-sm font-medium">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                Shift Active
                            </div>
                            <button onClick={() => setRefreshKey(k => k + 1)}
                                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                                <RefreshCcw className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {!activeShift ? (
                    <ShiftOpener onShiftOpened={handleShiftOpened} salesPointCode={salesPointCode} />
                ) : (
                    <>
                        {/* Stats Row */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {stats.map((stat, i) => (
                                <div key={i} className={`${stat.bg} rounded-xl p-4`}>
                                    <div className={`${stat.color} flex items-center gap-2 mb-1`}>
                                        <stat.icon className="w-4 h-4" />
                                        <span className="text-xs font-medium uppercase">{stat.label}</span>
                                    </div>
                                    <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                                </div>
                            ))}
                        </div>

                        {/* Tabs */}
                        <div className="border-b border-gray-200">
                            <nav className="-mb-px flex gap-6">
                                {[
                                    { id: 'pos', label: 'New Sale', icon: DollarSign },
                                    { id: 'transactions', label: `Transactions (${transactions.length})`, icon: List },
                                    ...(supportsPettyCash ? [{ id: 'petty_cash', label: 'Petty Cash', icon: Wallet }] : []),
                                    { id: 'close', label: 'Close Shift', icon: LogOut },
                                ].map(tab => (
                                    <button key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`flex items-center gap-2 pb-3 px-1 border-b-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                        <tab.icon className="w-4 h-4" />
                                        {tab.label}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Tab Content */}
                        <div>
                            {activeTab === 'pos' && (
                                <SaleForm shift={activeShift} serviceType={serviceType} onTransactionCreated={handleTransactionCreated} />
                            )}

                            {activeTab === 'transactions' && (
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    {transactions.length === 0 ? (
                                        <div className="text-center py-16 text-gray-400">
                                            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p>No transactions yet this shift</p>
                                        </div>
                                    ) : (
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                                                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {transactions.map((tx: any) => (
                                                    <tr key={tx.id} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 text-xs text-gray-500 font-mono">{tx.transaction_number || tx.id?.slice(0, 8)}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-900">{tx.customer_name || '—'}</td>
                                                        <td className="px-4 py-3 text-sm text-gray-600">{tx.items?.length || 0} items</td>
                                                        <td className="px-4 py-3 text-sm font-semibold text-right text-gray-900">KES {(tx.total_amount || 0).toLocaleString()}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${tx.payment_method === 'MPESA' ? 'bg-green-100 text-green-700' : tx.payment_method === 'CARD' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                                                {tx.payment_method || 'CASH'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-xs text-gray-500">
                                                            {tx.created_at ? new Date(tx.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : '—'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            )}

                            {activeTab === 'petty_cash' && supportsPettyCash && (
                                <div className="text-center py-12">
                                    <Wallet className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                                    <h3 className="font-semibold text-gray-900 mb-2">Petty Cash Ledger</h3>
                                    <p className="text-gray-500 text-sm mb-4">Record and track petty cash transactions</p>
                                    <button onClick={() => setShowPettyCash(true)}
                                        className="bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                                        + New Entry
                                    </button>
                                </div>
                            )}

                            {activeTab === 'close' && (
                                <ShiftCloser shift={activeShift} onShiftClosed={handleShiftClosed} />
                            )}
                        </div>
                    </>
                )}
            </div>

            {showPettyCash && activeShift && (
                <PettyCashModal
                    shift={activeShift}
                    onClose={() => setShowPettyCash(false)}
                    onSaved={() => setRefreshKey(k => k + 1)}
                />
            )}

            <AnimatePresence mode="wait">
                {showDynamicBillModal && (
                    <CashierModals.CreateDynamicBillModal
                        isOpen={showDynamicBillModal}
                        onClose={() => setShowDynamicBillModal(false)}
                        onSuccess={() => {
                            setShowDynamicBillModal(false);
                            setRefreshKey(k => k + 1);
                        }}
                    />
                )}
            </AnimatePresence>
        </DashboardLayout>
    );
}
