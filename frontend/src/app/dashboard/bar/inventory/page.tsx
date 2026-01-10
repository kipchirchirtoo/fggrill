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
    AlertTriangle, ArrowLeft, ArrowRight, Warehouse, Plus
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
    // Add other fields from restaurant_bar_inventory as needed
}

export default function BarInventoryPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [items, setItems] = useState<BarInventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showRequestModal, setShowRequestModal] = useState(false);

    const fetchInventory = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await api.barInventory.getStock({ branch_id: activeBranchId });

            if (res.success) {
                setItems(res.data || []);
            }
        } catch (error) {
            console.error('Error fetching inventory:', error);
            toast.error('Failed to load bar inventory');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId]);
    // ...
    // In the table render:
    <td className="px-4 py-4 text-center">
        <p className="text-[14px] sm:text-[15px] font-bold text-stone-900">{item.current_bottles} <span className="text-[10px] font-bold text-stone-400 ml-0.5">{item.unit}</span></p>
    </td>

    useEffect(() => {
        fetchInventory();
    }, [fetchInventory]);

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
                                <p className="text-stone-500 text-sm mt-0.5">Track stock levels and reorder</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={fetchInventory}
                                disabled={isLoading}
                                className="btn-secondary h-[44px] px-4 flex-1 sm:flex-none flex items-center justify-center gap-2"
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span className="hidden xs:inline">Refresh</span>
                            </button>
                            <button
                                onClick={() => setShowRequestModal(true)}
                                className="btn-primary flex-1 sm:flex-none h-[44px] px-4 flex items-center justify-center gap-2"
                            >
                                <ShoppingCart className="h-4 w-4" />
                                <span>Request Stock</span>
                            </button>
                        </div>
                    </div>

                    {/* Stats Summary */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
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
                            <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Low Stock</p>
                                <p className="text-xl font-bold text-amber-600">{lowStockItems.length}</p>
                            </div>
                        </IOSCard>
                        <IOSCard className="p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 shadow-sm col-span-2 lg:col-span-1">
                            <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                                <Warehouse className="h-5 w-5 text-purple-600" />
                            </div>
                            <div className="truncate w-full">
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-0.5">Storage</p>
                                <p className="text-xl font-bold text-stone-900">Bar Store</p>
                            </div>
                        </IOSCard>
                    </div>

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
                                        <th className="px-4 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-widest text-center">Par Level</th>
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
                                                </td>
                                                <td className="px-4 py-4 text-center">
                                                    <span className="text-xs text-stone-500 font-medium">{item.par_level}</span>
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
