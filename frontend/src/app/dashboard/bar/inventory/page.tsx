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
    AlertTriangle, ArrowLeft, ArrowRight, Warehouse
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface InventoryItem {
    id: string;
    sku: string;
    item_name: string;
    category: string;
    quantity: number;
    reorder_level: number;
    unit_of_measure: string;
    retail_price: number;
}

export default function BarInventoryPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchInventory = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const branchQuery = activeBranchId ? `?branch_id=${activeBranchId}` : '';
            const response = await fetch(`${API_URL}/api/store/items${branchQuery}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                // Filter for Bar & Beverages
                const allItems = Array.isArray(data.data) ? data.data : [];
                const barItems = allItems.filter((item: any) =>
                    item.category === 'Bar & Beverages' || item.category === 'Bar' || item.category === 'Beverages'
                );
                setItems(barItems);
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

    const filteredItems = items.filter(item =>
        item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const lowStockItems = items.filter(item => item.quantity <= item.reorder_level);

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
                                <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Bar Inventory</h1>
                                <p className="text-stone-500 mt-0.5">Track stock levels and reorder supplies</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="outline" onClick={fetchInventory} disabled={isLoading} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                                Refresh
                            </IOSButton>
                            <Link href="/dashboard/storekeeping/requests">
                                <IOSButton leftIcon={<ShoppingCart />}>
                                    Request Stock
                                </IOSButton>
                            </Link>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <IOSCard className="p-4 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                                <Package className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">Total Items</p>
                                <p className="text-xl font-bold text-stone-900">{items.length}</p>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-4 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">Low Stock</p>
                                <p className="text-xl font-bold text-amber-600">{lowStockItems.length}</p>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-4 flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center">
                                <Warehouse className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                                <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">Storage</p>
                                <p className="text-xl font-bold text-stone-900">Bar Store</p>
                            </div>
                        </IOSCard>
                    </div>

                    {/* Search and Filters */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <Input
                            placeholder="Search drinks, snacks or SKUs..."
                            className="pl-10 h-11 bg-white"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Inventory Table */}
                    <IOSCard className="overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-stone-50 border-b border-stone-100">
                                        <th className="px-5 py-3 text-[11px] font-semibold text-stone-400 uppercase tracking-widest">Item Details</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold text-stone-400 uppercase tracking-widest text-center">Current Qty</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold text-stone-400 uppercase tracking-widest text-center">Status</th>
                                        <th className="px-5 py-3 text-[11px] font-semibold text-stone-400 uppercase tracking-widest text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={4} className="px-5 py-10 text-center">
                                                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-stone-300" />
                                            </td>
                                        </tr>
                                    ) : filteredItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-5 py-10 text-center text-stone-400">
                                                {searchTerm ? 'No items match your search' : 'No inventory items found for bar'}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredItems.map((item) => (
                                            <tr key={item.sku} className="hover:bg-stone-50/50 transition-colors">
                                                <td className="px-5 py-4">
                                                    <p className="text-[14px] font-semibold text-stone-900">{item.item_name}</p>
                                                    <p className="text-[11px] text-stone-400 font-mono mt-0.5">{item.sku}</p>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <p className="text-[15px] font-bold text-stone-900">{item.quantity} <span className="text-[11px] font-medium text-stone-400 ml-0.5">{item.unit_of_measure}</span></p>
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    {item.quantity <= 0 ? (
                                                        <IOSBadge variant="light" color="danger">Out of Stock</IOSBadge>
                                                    ) : item.quantity <= item.reorder_level ? (
                                                        <IOSBadge variant="light" color="warning">Low Stock</IOSBadge>
                                                    ) : (
                                                        <IOSBadge variant="light" color="success">Healthy</IOSBadge>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <Link href={`/dashboard/storekeeping/requests`}>
                                                        <button className="text-[12px] font-semibold text-stone-900 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 rounded-ios transition-colors inline-flex items-center gap-1.5">
                                                            Request
                                                            <ArrowRight className="h-3 w-3" />
                                                        </button>
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
