'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI } from '@/lib/api';
import { Pencil, RefreshCw, Search, Package } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/utils';

interface Item { id: string; sku: string; item_name: string; category: string; quantity: number; reorder_level: number; unit_of_measure: string; cost_price: number; }

export default function StationeryPage() {
    const [items, setItems] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchItems = useCallback(async () => {
        setIsLoading(true);
        try {
            // Using 'office_supplies' as the category for stationery
            const response = await storeAPI.getItems({ category: 'office_supplies' });
            if (response.success) setItems(response.data || []);
        } catch (error) { console.error('Error:', error); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const filteredItems = items.filter((i) =>
        i.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const lowStockCount = items.filter(i => i.quantity <= i.reorder_level).length;

    return (
        <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <Pencil className="h-5 w-5 text-stone-900" />
                                <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Stationery Items</h1>
                            </div>
                            <p className="text-stone-500 mt-0.5">Office supplies and stationery inventory</p>
                        </div>
                        <button onClick={fetchItems} disabled={isLoading} className="btn-secondary h-10 px-3">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {/* Minimal Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm">
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Total Items</p>
                            <p className="text-2xl font-semibold text-stone-900 mt-1">{items.length}</p>
                        </div>
                        <div className="bg-white border border-stone-100 p-4 rounded-lg shadow-sm border-l-4 border-l-stone-400">
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Low Stock</p>
                            <p className="text-2xl font-semibold text-amber-600 mt-1">{lowStockCount}</p>
                        </div>
                        <div className="col-span-2 bg-stone-900 p-4 rounded-lg shadow-sm flex flex-col justify-center">
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Estimated Valuation</p>
                            <p className="text-2xl font-bold text-white mt-1">KES {formatNumber(items.reduce((acc, i) => acc + (i.cost_price * i.quantity), 0))}</p>
                        </div>
                    </div>

                    {/* Filter */}
                    <div className="bg-white p-4 rounded-lg border border-stone-100 shadow-sm flex items-center gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <input
                                placeholder="Search stationery..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-stone-400"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white rounded-lg border border-stone-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-stone-50/50 border-b border-stone-100 text-left">
                                    <tr>
                                        <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider">Product</th>
                                        <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider text-center">Stock</th>
                                        <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider text-center">Status</th>
                                        <th className="p-4 font-semibold text-stone-500 uppercase text-[11px] tracking-wider text-right">Value (KES)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-50">
                                    {isLoading ? (
                                        Array(3).fill(0).map((_, i) => (
                                            <tr key={`skeleton-${i}`}><td colSpan={4} className="p-4"><Skeleton className="h-10 w-full" /></td></tr>
                                        ))
                                    ) : filteredItems.length === 0 ? (
                                        <tr><td colSpan={4} className="p-20 text-center text-stone-400">No stationery items found.</td></tr>
                                    ) : (
                                        filteredItems.map((item, index) => {
                                            const isLow = item.quantity <= item.reorder_level;
                                            return (
                                                <tr key={item.id || item.sku || `stationery-item-${index}`} className="hover:bg-stone-50/50 transition-colors">
                                                    <td className="p-4">
                                                        <p className="font-medium text-stone-900">{item.item_name}</p>
                                                        <p className="text-[11px] font-mono text-stone-400 mt-0.5 uppercase">{item.sku}</p>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <p className="font-semibold text-stone-800">{item.quantity} {item.unit_of_measure}</p>
                                                        <p className="text-[10px] text-stone-400">Min: {item.reorder_level}</p>
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${isLow ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-500'}`}>
                                                            {isLow ? 'Restock' : 'Optimal'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <p className="font-medium text-stone-900">{formatNumber(item.cost_price * item.quantity)}</p>
                                                        <p className="text-[10px] text-stone-400">@{formatNumber(item.cost_price)}</p>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
