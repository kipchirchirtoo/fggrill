'use client';

import { useState, useEffect } from 'react';
import { PieChart, Save, Trash2, Plus, AlertCircle, Camera, ChevronRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { storekeepingAPI, stockTakeAPI } from '@/lib/api';

interface StockItem {
    id: string;
    itemCode: string;
    name: string;
    unit: string;
    systemQuantity: number;
    physicalQuantity: number;
    variance: number;
    unitCost: number;
    reason?: string;
    photo?: File;
}

export default function StockCountForm({ branchId, isAuditor = false }: { branchId: number | string | null, isAuditor?: boolean }) {
    const [items, setItems] = useState<StockItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stockTakeId, setStockTakeId] = useState<string | null>(null);

    // Fetch inventory items for the branch
    useEffect(() => {
        const fetchInventoryItems = async () => {
            if (!branchId) return;

            setIsLoading(true);
            try {
                const res = await storekeepingAPI.getBranchStock(Number(branchId));

                if (res.success && res.data) {
                    // Map inventory items to stock count format
                    const mappedItems: StockItem[] = res.data.map((inv: any) => ({
                        id: inv.id,
                        itemCode: inv.sku || inv.item_sku || inv.item_code,
                        name: inv.item_name || inv.name,
                        unit: inv.unit || 'Unit',
                        systemQuantity: inv.quantity || inv.current_quantity || 0,
                        physicalQuantity: inv.quantity || inv.current_quantity || 0,
                        variance: 0,
                        unitCost: inv.cost_price || inv.unit_cost || 0
                    }));
                    setItems(mappedItems);
                }
            } catch (error) {
                console.error('Failed to fetch inventory:', error);
                toast.error('Failed to load inventory items');
            } finally {
                setIsLoading(false);
            }
        };

        fetchInventoryItems();
    }, [branchId]);

    const handleQuantityChange = (id: string, value: string) => {
        const qty = parseFloat(value) || 0;
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const variance = qty - item.systemQuantity;
                return { ...item, physicalQuantity: qty, variance };
            }
            return item;
        }));
    };

    const handleReasonChange = (id: string, reason: string) => {
        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, reason } : item
        ));
    };

    const handleSubmit = async () => {
        if (!branchId) {
            toast.error('Branch ID is required');
            return;
        }

        setIsSubmitting(true);
        try {
            const createResult = await stockTakeAPI.createStockTake({
                branch_id: typeof branchId === 'number' ? branchId : Number(branchId),
                count_type: 'FULL',
                notes: isAuditor ? 'Auditor stock count' : 'Branch stock count'
            });

            if (!createResult.success || !createResult.data?.id) {
                throw new Error(createResult.message || 'Failed to create stock count');
            }

            const createdStockTakeId = createResult.data.id;
            setStockTakeId(createdStockTakeId);

            const createdItemsResult = await stockTakeAPI.getStockTakeItems(createdStockTakeId);

            if (!createdItemsResult.success || !createdItemsResult.data) {
                throw new Error(createdItemsResult.message || 'Failed to load stock count items');
            }

            const itemIdMap = new Map(
                createdItemsResult.data
                    .filter((item: any) => item.id && item.item_sku)
                    .map((item: any) => [String(item.item_sku), item.id])
            );

            const updateItems = items
                .map(item => {
                    const countItemId = itemIdMap.get(String(item.itemCode));

                    if (!countItemId) {
                        return null;
                    }

                    return {
                        id: countItemId,
                        counted_quantity: item.physicalQuantity,
                        variance_reason: item.variance !== 0 ? item.reason : null,
                        notes: item.reason
                    };
                })
                .filter(Boolean);

            const updateResult = await stockTakeAPI.updateStockTake(createdStockTakeId, {
                notes: isAuditor ? 'Auditor stock count' : 'Branch stock count',
                status: isAuditor ? 'COMPLETED' : undefined,
                items: updateItems
            });

            if (!updateResult.success) {
                throw new Error(updateResult.message || 'Failed to save stock count items');
            }

            if (isAuditor) {
                toast.success('Audit count submitted successfully');
            } else {
                const submitResult = await stockTakeAPI.submitToAuditor(createdStockTakeId);

                if (!submitResult.success) {
                    throw new Error(submitResult.message || 'Failed to submit stock count for review');
                }

                toast.success('Stock count submitted for review');
            }
        } catch (error) {
            console.error('Failed to submit stock count:', error);
            toast.error('Failed to submit stock count');
        } finally {
            setIsSubmitting(false);
        }
    };

    const totalVarianceValue = items.reduce((acc, item) => acc + (item.variance * item.unitCost), 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[18px] font-bold text-stone-900">{isAuditor ? 'Audit Stock Count' : 'New Stock Count'}</h2>
                    <p className="text-[12px] text-stone-500">{isAuditor ? 'Independent verification of stock levels' : 'Daily verification for branch inventory'}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="btn-secondary py-2">
                        <Save className="h-4 w-4" />
                        <span>Save Draft</span>
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="btn-primary py-2 px-6 bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-50"
                    >
                        {isSubmitting ? 'Submitting...' : (isAuditor ? 'Submit Audit' : 'Submit for Review')}
                    </button>
                </div>
            </div>

            {/* Variance Summary Card */}
            <div className={`p-4 rounded-xl border ${totalVarianceValue < 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${totalVarianceValue < 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {totalVarianceValue < 0 ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                        </div>
                        <div>
                            <p className="text-[11px] font-medium uppercase tracking-wider opacity-60">Estimated Variance Value</p>
                            <p className={`text-[20px] font-bold ${totalVarianceValue < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                KES {Math.abs(totalVarianceValue).toLocaleString()}
                                <span className="text-[13px] ml-1 font-medium">{totalVarianceValue < 0 ? '(Loss)' : '(Gain)'}</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Items Table */}
            <div className="card-elevated overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-stone-50 border-b border-stone-200">
                        <tr>
                            <th className="px-4 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider">Item Details</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-center">System Qty</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-center w-32">Physical Qty</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider text-center">Variance</th>
                            <th className="px-4 py-3 text-[11px] font-bold text-stone-500 uppercase tracking-wider">Reason / Evidence</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {items.map((item) => (
                            <tr key={item.id} className="hover:bg-stone-50/50 transition-colors">
                                <td className="px-4 py-4">
                                    <p className="text-[13px] font-bold text-stone-900">{item.name}</p>
                                    <p className="text-[11px] text-stone-500">{item.itemCode} • {item.unit}</p>
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <span className="text-[13px] font-semibold text-stone-600 bg-stone-100 px-2 py-1 rounded">
                                        {item.systemQuantity}
                                    </span>
                                </td>
                                <td className="px-4 py-4">
                                    <input
                                        type="number"
                                        value={item.physicalQuantity}
                                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                                        className="w-full text-center py-2 border border-stone-200 rounded-lg text-[13px] font-bold focus:ring-2 focus:ring-stone-400 focus:border-stone-400 outline-none"
                                    />
                                </td>
                                <td className="px-4 py-4 text-center">
                                    <span className={`text-[13px] font-bold px-2 py-1 rounded ${item.variance === 0 ? 'bg-stone-100 text-stone-500' :
                                        item.variance < 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                                        }`}>
                                        {item.variance > 0 ? '+' : ''}{item.variance}
                                    </span>
                                </td>
                                <td className="px-4 py-4">
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="Add reason if variance..."
                                            value={item.reason || ''}
                                            onChange={(e) => handleReasonChange(item.id, e.target.value)}
                                            className="grow bg-transparent border-b border-stone-200 text-[12px] py-1 focus:border-stone-500 outline-none"
                                        />
                                        <button className="p-1.5 rounded-lg border border-stone-200 hover:bg-white text-stone-400 hover:text-stone-600 transition-colors">
                                            <Camera className="h-4 w-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button className="w-full py-4 border-2 border-dashed border-stone-200 rounded-xl text-stone-400 hover:text-stone-600 hover:border-stone-300 hover:bg-stone-50 transition-all flex items-center justify-center gap-2">
                <Plus className="h-4 w-4" />
                <span className="text-[13px] font-semibold">Add Custom Item</span>
            </button>
        </div>
    );
}
