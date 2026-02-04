'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import {
    Package, Search, RefreshCw, ShoppingCart,
    AlertTriangle, ArrowLeft, ArrowRight, Warehouse, Plus,
    ClipboardCheck, Save, X, Loader2, Calculator, BarChartHorizontal, Database
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { BarStockRequestModal } from '@/components/modals/BarModals';

interface BarInventoryItem {
    id: string;
    name: string;
    category: string;
    current_bottles: number;
    unit: string;
    par_level: number;
    supplier_id?: string;
    sold_qty?: number;
    expected_remaining?: number;
}

export default function BarInventoryPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [items, setItems] = useState<BarInventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showRequestModal, setShowRequestModal] = useState(false);

    // Stock Take State
    const [isRecording, setIsRecording] = useState(false);
    const [stockTakeItems, setStockTakeItems] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const fetchInventory = useCallback(async () => {
        setIsLoading(true);
        try {
            // Fetch both current stock and consumption report
            const branchIdStr = activeBranchId ? String(activeBranchId) : undefined;
            const [stockRes, reportRes] = await Promise.all([
                api.barInventory.getStock({ branch_id: branchIdStr }),
                api.barInventory.getConsumptionReport({ branch_id: branchIdStr })
            ]);

            if (stockRes.success) {
                const reportMap = Object.fromEntries(
                    (reportRes.data || []).map((r: any) => [r.id, r])
                );

                const merged = stockRes.data.map((item: any) => ({
                    ...item,
                    sold_qty: reportMap[item.id]?.sold_qty || 0,
                    expected_remaining: reportMap[item.id]?.expected_remaining || item.current_bottles
                }));
                setItems(merged);
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
            toast.error('Failed to load bar inventory');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

    const handleSyncFromMaster = async () => {
        setIsSyncing(true);
        try {
            const branchIdStr = activeBranchId ? String(activeBranchId) : undefined;
            const res = await api.barInventory.syncFromMaster({ branch_id: branchIdStr });
            if (res.success) {
                toast.success(res.message);
                fetchInventory();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to sync from Master Inventory');
        } finally {
            setIsSyncing(false);
        }
    };

    const startRecording = () => {
        setStockTakeItems(items.map(i => ({
            drink_id: i.id,
            name: i.name,
            system_quantity: i.current_bottles,
            physical_quantity: i.current_bottles, // Default to system
            sold_qty: i.sold_qty
        })));
        setIsRecording(true);
    };

    const handlePhysicalUpdate = (id: string, val: string) => {
        setStockTakeItems(prev => prev.map(i =>
            i.drink_id === id ? { ...i, physical_quantity: val } : i
        ));
    };

    const submitStockTake = async () => {
        setIsSubmitting(true);
        try {
            const res = await api.barInventory.submitStockTake({
                branch_id: activeBranchId || undefined,
                items: stockTakeItems,
                notes: `Daily Bar Stock Take by ${user?.firstName} ${user?.lastName}`
            });

            if (res.success) {
                toast.success('Stock take submitted for auditing');
                setIsRecording(false);
                fetchInventory();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit stock take');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredItems = items.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const lowStockItems = items.filter(item => item.current_bottles <= item.par_level);

    return (
        <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/bar">
                                <button className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                                    <ArrowLeft className="h-5 w-5 text-stone-600" />
                                </button>
                            </Link>
                            <div>
                                <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Bar Inventory</h1>
                                <p className="text-stone-500 text-sm mt-0.5">Track stock levels and record usage</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSyncFromMaster}
                                disabled={isSyncing}
                                className="btn-secondary h-[44px] px-4 flex items-center justify-center gap-2 bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100"
                            >
                                <Database className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                <span>{isSyncing ? 'Syncing...' : 'Sync Master'}</span>
                            </button>
                            <Link href="/dashboard/bar/inventory/morning-count">
                                <button className="btn-secondary h-[44px] px-4 flex items-center justify-center gap-2 bg-orange-50 text-orange-700 border-orange-100 hover:bg-orange-100">
                                    <ClipboardCheck className="h-4 w-4" />
                                    <span>Morning Count</span>
                                </button>
                            </Link>
                            <button
                                onClick={startRecording}
                                className="btn-secondary h-[44px] px-4 flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100"
                            >
                                <ClipboardCheck className="h-4 w-4" />
                                <span>Record Daily Usage</span>
                            </button>
                            <button
                                onClick={() => setShowRequestModal(true)}
                                className="btn-primary h-[44px] px-4 flex items-center justify-center gap-2"
                            >
                                <ShoppingCart className="h-4 w-4" />
                                <span>Request Stock</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <IOSCard className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 shadow-sm">
                            <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                                <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Total Items</p>
                                <p className="text-xl font-bold text-stone-900">{items.length}</p>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 shadow-sm">
                            <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                                <BarChartHorizontal className="h-5 w-5 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Today's Sales</p>
                                <p className="text-xl font-bold text-orange-600">{items.reduce((sum, i) => sum + (i.sold_qty || 0), 0)} <span className="text-[10px]">Units</span></p>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 shadow-sm">
                            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Low Stock</p>
                                <p className="text-xl font-bold text-amber-600">{lowStockItems.length}</p>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 shadow-sm">
                            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                                <Warehouse className="h-5 w-5 text-purple-600" />
                            </div>
                            <div className="truncate w-full">
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Location</p>
                                <p className="text-xl font-bold text-stone-900 truncate">Bar Store</p>
                            </div>
                        </IOSCard>
                    </div>

                    {/* Stock Take UI */}
                    {isRecording ? (
                        <IOSCard className="p-6 border-emerald-200 bg-emerald-50/20">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-stone-900">Recording Physical Inventory</h2>
                                    <p className="text-sm text-stone-500 italic">Enter the number of bottles remaining for each item.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => setIsRecording(false)} className="px-4 py-2 text-sm font-bold text-stone-500 hover:text-stone-900">Cancel</button>
                                    <IOSButton onClick={submitStockTake} disabled={isSubmitting} className="bg-emerald-600 text-white">
                                        {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <><Save className="h-4 w-4 mr-2" /> Submit to Auditor</>}
                                    </IOSButton>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {stockTakeItems.map((item) => (
                                    <div key={item.drink_id} className="bg-white p-4 rounded-2xl border border-stone-100 flex items-center justify-between shadow-sm">
                                        <div className="flex-1">
                                            <p className="font-bold text-stone-900">{item.name}</p>
                                            <div className="flex gap-4 mt-1">
                                                <p className="text-[10px] text-stone-400 uppercase font-bold">System: {item.system_quantity}</p>
                                                <p className="text-[10px] text-orange-500 uppercase font-bold">Today Sales: {item.sold_qty || 0}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Wastage</p>
                                                <Input
                                                    type="number"
                                                    value={item.wastage || 0}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setStockTakeItems(prev => prev.map(i =>
                                                            i.drink_id === item.drink_id ? { ...i, wastage: val } : i
                                                        ));
                                                    }}
                                                    className="w-20 text-center font-bold text-sm h-10 border-red-100 focus:ring-red-500"
                                                />
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Physical</p>
                                                <Input
                                                    type="number"
                                                    value={item.physical_quantity}
                                                    onChange={(e) => handlePhysicalUpdate(item.drink_id, e.target.value)}
                                                    className="w-24 text-center font-bold text-lg h-10 border-emerald-100 focus:ring-emerald-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </IOSCard>
                    ) : (
                        <>
                            {/* Search and Filters */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <Input
                                    placeholder="Search drinks..."
                                    className="pl-10 h-11 bg-white"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {/* Inventory Table */}
                            <IOSCard className="overflow-hidden border-stone-200">
                                <div className="overflow-x-auto no-scrollbar">
                                    <table className="w-full text-left min-w-[500px] lg:min-w-0">
                                        <thead>
                                            <tr className="bg-stone-50 border-b border-stone-100">
                                                <th className="px-4 ps-6 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest">Item Details</th>
                                                <th className="px-4 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-center">In Stock</th>
                                                <th className="px-4 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-center">Today Sales</th>
                                                <th className="px-4 pe-6 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-right">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100">
                                            {isLoading ? (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-12 text-center">
                                                        <RefreshCw className="h-6 w-6 animate-spin mx-auto text-stone-300" />
                                                    </td>
                                                </tr>
                                            ) : filteredItems.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-12 text-center text-stone-400">
                                                        {searchTerm ? 'No items match your search' : 'No inventory items found for bar'}
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredItems.map((item) => (
                                                    <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                                                        <td className="px-4 ps-6 py-4">
                                                            <p className="text-[13px] sm:text-[14px] font-bold text-stone-900">{item.name}</p>
                                                            <p className="text-[10px] text-stone-400 font-mono mt-0.5">{item.category}</p>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <p className="text-[14px] sm:text-[15px] font-bold text-stone-900">{item.current_bottles} <span className="text-[10px] font-bold text-stone-400 ml-0.5">Bottles</span></p>
                                                            <p className="text-[9px] text-stone-400">Exp: {item.expected_remaining}</p>
                                                        </td>
                                                        <td className="px-4 py-4 text-center">
                                                            <span className={`text-xs font-bold ${item.sold_qty ? 'text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full' : 'text-stone-300'}`}>
                                                                {item.sold_qty || 0} Sold
                                                            </span>
                                                        </td>
                                                        <td className="px-4 pe-6 py-4 text-right">
                                                            {item.current_bottles <= 0 ? (
                                                                <IOSBadge size="sm" className="bg-red-50 text-red-600 border-red-100">Out of Stock</IOSBadge>
                                                            ) : item.current_bottles <= item.par_level ? (
                                                                <IOSBadge size="sm" className="bg-amber-50 text-amber-600 border-amber-100">Low Stock</IOSBadge>
                                                            ) : (
                                                                <IOSBadge size="sm" className="bg-green-50 text-green-600 border-green-100">OK</IOSBadge>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </IOSCard>
                        </>
                    )}
                </div>

                <BarStockRequestModal
                    isOpen={showRequestModal}
                    onClose={() => setShowRequestModal(false)}
                    onSuccess={fetchInventory}
                />
            </DashboardLayout>
        </ProtectedRoute>
    );
}
