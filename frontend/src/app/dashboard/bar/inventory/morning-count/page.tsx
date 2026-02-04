'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import {
    Package, RefreshCw, ArrowLeft,
    ClipboardCheck, Save, Loader2, Sunrise
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface BarInventoryItem {
    id: string;
    name: string;
    category: string;
    current_bottles: number;
    unit: string;
}

export default function MorningCountPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [items, setItems] = useState<BarInventoryItem[]>([]);

    // Stock Take State
    const [stockTakeItems, setStockTakeItems] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchInventory = useCallback(async () => {
        setIsLoading(true);
        try {
            const branchIdStr = activeBranchId ? String(activeBranchId) : undefined;
            // Only need stock, not consumption report for morning count (usually)
            const stockRes = await api.barInventory.getStock({ branch_id: branchIdStr });

            if (stockRes.success) {
                const data = stockRes.data || [];
                setItems(data);

                // Initialize stock take items
                setStockTakeItems(data.map((i: any) => ({
                    drink_id: i.id,
                    name: i.name,
                    category: i.category,
                    system_quantity: i.current_bottles,
                    physical_quantity: i.current_bottles, // Default to system
                    notes: ''
                })));
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

    const handlePhysicalUpdate = (id: string, val: string) => {
        setStockTakeItems(prev => prev.map(i =>
            i.drink_id === id ? { ...i, physical_quantity: val } : i
        ));
    };

    const handleNotesUpdate = (id: string, val: string) => {
        setStockTakeItems(prev => prev.map(i =>
            i.drink_id === id ? { ...i, notes: val } : i
        ));
    };

    const submitMorningCount = async () => {
        setIsSubmitting(true);
        try {
            const res = await api.barInventory.submitStockTake({
                branch_id: activeBranchId || undefined,
                items: stockTakeItems,
                count_type: 'morning_opening',
                notes: `Morning Stock Count by ${user?.firstName} ${user?.lastName}`
            });

            if (res.success) {
                toast.success('Morning count submitted successfully');
                router.push('/dashboard/bar/inventory');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit morning count');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Group items by category
    const groupedItems = stockTakeItems.reduce((acc, item) => {
        const cat = item.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, typeof stockTakeItems>);

    return (
        <ProtectedRoute allowedRoles={[UserRole.BARTENDER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
            <DashboardLayout>
                <div className="space-y-6 max-w-5xl mx-auto">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/bar/inventory">
                                <button className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                                    <ArrowLeft className="h-5 w-5 text-stone-600" />
                                </button>
                            </Link>
                            <div>
                                <div className="flex items-center gap-2">
                                    <Sunrise className="h-6 w-6 text-orange-500" />
                                    <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Morning Stock Count</h1>
                                </div>
                                <p className="text-stone-500 text-sm mt-0.5">Verify opening stock levels for the day</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton
                                onClick={submitMorningCount}
                                disabled={isSubmitting || isLoading}
                                className="bg-orange-500 hover:bg-orange-600 text-white shadow-orange-200"
                            >
                                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4" /> : <><ClipboardCheck className="h-4 w-4 mr-2" /> Submit Morning Count</>}
                            </IOSButton>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="p-12 text-center">
                            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-300" />
                            <p className="mt-2 text-stone-400">Loading inventory items...</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {Object.entries(groupedItems).map(([category, items]) => (
                                <div key={category} className="space-y-3">
                                    <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest px-2">{category}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {items.map((item: any) => (
                                            <IOSCard key={item.drink_id} className="p-4 border-stone-200 hover:border-orange-200 transition-colors">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <p className="font-bold text-stone-900 line-clamp-1">{item.name}</p>
                                                        <p className="text-[10px] text-stone-400 font-mono">System: {item.system_quantity}</p>
                                                    </div>
                                                    <Package className="h-4 w-4 text-stone-300" />
                                                </div>

                                                <div className="flex items-end gap-3">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-bold text-stone-400 uppercase mb-1.5 block">Physical Count</label>
                                                        <Input
                                                            type="number"
                                                            value={item.physical_quantity}
                                                            onChange={(e) => handlePhysicalUpdate(item.drink_id, e.target.value)}
                                                            className="w-full font-bold text-lg h-10 border-stone-200 focus:ring-orange-500 focus:border-orange-500"
                                                        />
                                                    </div>
                                                </div>
                                            </IOSCard>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
