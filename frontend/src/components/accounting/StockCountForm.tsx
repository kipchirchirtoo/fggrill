'use client';

import { useState, useEffect } from 'react';
import { PieChart, Save, Trash2, Plus, AlertCircle, Camera, ChevronRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

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

export default function StockCountForm({ branchId }: { branchId: string }) {
    const [items, setItems] = useState<StockItem[]>([
        { id: '1', itemCode: 'BEV-001', name: 'White Cap Lager', unit: 'Bottle', systemQuantity: 120, physicalQuantity: 120, variance: 0, unitCost: 250 },
        { id: '2', itemCode: 'BEV-002', name: 'Tusker Lager', unit: 'Bottle', systemQuantity: 85, physicalQuantity: 80, variance: -5, unitCost: 250 },
        { id: '3', itemCode: 'KIT-001', name: 'Cooking Oil', unit: 'Liter', systemQuantity: 15, physicalQuantity: 14.5, variance: -0.5, unitCost: 350 },
    ]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        setIsSubmitting(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1500));
            toast.success('Stock count submitted for review');
        } catch (error) {
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
                    <h2 className="text-[18px] font-bold text-stone-900">New Stock Count</h2>
                    <p className="text-[12px] text-stone-500">Daily verification for Bar & Kitchen</p>
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
                        {isSubmitting ? 'Submitting...' : 'Submit for Review'}
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
