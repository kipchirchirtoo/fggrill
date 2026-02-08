'use client';

import { useState, useEffect } from 'react';
import { storeAPI } from '@/lib/api';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Save, CheckCircle, ArrowLeft, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface StockTakeDetailProps {
    stockTakeId: string;
    onBack: () => void;
    onComplete: () => void;
}

export function StockTakeDetail({ stockTakeId, onBack, onComplete }: StockTakeDetailProps) {
    const [items, setItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [savingId, setSavingId] = useState<string | null>(null);

    useEffect(() => {
        loadItems();
    }, [stockTakeId]);

    const loadItems = async () => {
        setIsLoading(true);
        try {
            const res = await storeAPI.getStockTakeItems(stockTakeId);
            if (res.success && Array.isArray(res.data)) {
                setItems(res.data);
            }
        } catch (error) {
            console.error('Error loading items:', error);
            toast.error('Failed to load stock list');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateQuantity = async (itemId: string, quantity: number) => {
        setSavingId(itemId);
        try {
            const res = await storeAPI.updateStockTakeItem(itemId, { actual_quantity: quantity });
            if (res.success) {
                setItems(prev => prev.map(item =>
                    item.id === itemId ? { ...item, actual_quantity: quantity, variance: quantity - item.system_quantity } : item
                ));
            } else {
                toast.error('Failed to update quantity');
            }
        } catch (error) {
            toast.error('Update failed');
        } finally {
            setSavingId(null);
        }
    };

    const handleComplete = async () => {
        if (!confirm('Are you sure you want to complete this stock take? It will be sent to the Auditor for verification.')) return;

        try {
            const res = await storeAPI.completeStockTake(stockTakeId);
            if (res.success) {
                toast.success('Stock take submitted to Auditor');
                onComplete();
            } else {
                toast.error(res.message || 'Failed to complete stock take');
            }
        } catch (error) {
            toast.error('Error completing stock take');
        }
    };

    const filteredItems = items.filter(item =>
        item.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.item_sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <IOSButton variant="secondary" onClick={onBack} leftIcon={<ArrowLeft />}>Back</IOSButton>
                    <h2 className="text-xl font-bold">Recording Stock</h2>
                </div>
                <IOSButton onClick={handleComplete} leftIcon={<CheckCircle />}>Submit to Auditor</IOSButton>
            </div>

            <IOSCard className="p-4">
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-stone-500 uppercase bg-stone-50">
                            <tr>
                                <th className="px-6 py-3">Item</th>
                                <th className="px-6 py-3 text-center">System Qty</th>
                                <th className="px-6 py-3 text-center">Actual Qty</th>
                                <th className="px-6 py-3 text-center">Variance</th>
                                <th className="px-6 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {isLoading ? (
                                <tr><td colSpan={5} className="py-8 text-center text-stone-500">Loading items...</td></tr>
                            ) : filteredItems.length === 0 ? (
                                <tr><td colSpan={5} className="py-8 text-center text-stone-500">No items found matching search.</td></tr>
                            ) : (
                                filteredItems.map(item => (
                                    <tr key={item.id} className="hover:bg-stone-50">
                                        <td className="px-6 py-4 font-medium">
                                            <div>{item.item_name}</div>
                                            <div className="text-xs text-stone-400">{item.item_sku}</div>
                                        </td>
                                        <td className="px-6 py-4 text-center text-stone-600">{item.system_quantity}</td>
                                        <td className="px-6 py-4 text-center">
                                            <input
                                                type="number"
                                                min="0"
                                                className="w-24 text-center p-1 border rounded focus:ring-2 focus:ring-blue-500"
                                                value={item.actual_quantity ?? ''}
                                                onChange={(e) => handleUpdateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                                onBlur={(e) => handleUpdateQuantity(item.id, parseFloat(e.target.value) || 0)}
                                            />
                                            {savingId === item.id && <span className="ml-2 text-xs text-blue-500">Saving...</span>}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {item.variance ? (
                                                <span className={`flex items-center justify-center gap-1 font-medium ${item.variance < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                                    {item.variance < 0 && <AlertTriangle className="h-3 w-3" />}
                                                    {item.variance > 0 ? '+' : ''}{item.variance}
                                                </span>
                                            ) : (
                                                <span className="text-green-600 text-xs font-medium">Matched</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.actual_quantity !== null && item.actual_quantity !== undefined ? (
                                                <span className="text-green-600 text-xs flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Recorded</span>
                                            ) : (
                                                <span className="text-stone-400 text-xs">Pending</span>
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
    );
}
