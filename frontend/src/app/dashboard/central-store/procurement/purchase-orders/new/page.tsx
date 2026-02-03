'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from "@/components/ui/minimal/card";
import { Input } from '@/components/ui/input';
import { procurementAPI, storeAPI } from '@/lib/api';
import { Save, X, Plus, Trash2, ArrowLeft, RefreshCw, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

export default function NewPOPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [inventoryItems, setInventoryItems] = useState<any[]>([]);
    const [formData, setFormData] = useState({
        supplier_id: '',
        po_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: '',
        notes: '',
        items: [] as any[]
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [suppliersRes, itemsRes] = await Promise.all([
                procurementAPI.getSuppliers(),
                storeAPI.getItems()
            ]);
            if (suppliersRes.success) setSuppliers(suppliersRes.data || []);
            if (itemsRes.success) setInventoryItems(itemsRes.data || []);
        } catch (error) { console.error('Error:', error); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const addItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { item_id: '', quantity_ordered: 1, unit_price: 0, total_price: 0 }]
        });
    };

    const removeItem = (index: number) => {
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        if (field === 'item_id') {
            const item = inventoryItems.find(i => i.id === value);
            if (item) {
                newItems[index].unit_price = item.cost_price || 0;
                newItems[index].item_name = item.item_name;
            }
        }

        newItems[index].total_price = newItems[index].quantity_ordered * newItems[index].unit_price;
        setFormData({ ...formData, items: newItems });
    };

    const totalAmount = formData.items.reduce((sum, item) => sum + (item.total_price || 0), 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.supplier_id || formData.items.length === 0) {
            toast.error('Supplier and at least one item are required');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                ...formData,
                total_amount: totalAmount
            };
            const res = await procurementAPI.createPurchaseOrder(payload);
            if (res.success) {
                toast.success('Purchase Order created successfully');
                router.push('/dashboard/central-store/procurement/purchase-orders');
            } else {
                toast.error(res.message || 'Failed to create PO');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="flex justify-center py-20"><RefreshCw className="animate-spin text-amber-500" /></div>;

    return (
        <ProtectedRoute allowedRoles={[UserRole.PROCUREMENT, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-stone-100 rounded-full">
                            <ArrowLeft size={20} className="text-stone-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Create Purchase Order</h1>
                            <p className="text-stone-500 text-sm">Draft a new procurement request</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <IOSCard className="p-6 space-y-4 border-none shadow-sm bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-stone-500 uppercase px-1">Supplier</label>
                                    <select
                                        className="w-full h-11 px-4 bg-stone-50 border-none rounded-ios-lg text-sm focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                                        value={formData.supplier_id}
                                        onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Supplier...</option>
                                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-stone-500 uppercase px-1">PO Date</label>
                                    <Input
                                        type="date"
                                        value={formData.po_date}
                                        onChange={(e) => setFormData({ ...formData, po_date: e.target.value })}
                                        className="h-11 bg-stone-50 border-none rounded-ios-lg"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-stone-500 uppercase px-1">Expected Delivery</label>
                                    <Input
                                        type="date"
                                        value={formData.expected_delivery_date}
                                        onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                                        className="h-11 bg-stone-50 border-none rounded-ios-lg"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-stone-500 uppercase px-1">Notes / Instructions</label>
                                    <Input
                                        placeholder="Special handling or delivery instructions..."
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="h-11 bg-stone-50 border-none rounded-ios-lg"
                                    />
                                </div>
                            </div>
                        </IOSCard>

                        <IOSCard className="p-6 border-none shadow-sm bg-white overflow-hidden">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400">Order Items</h2>
                                <IOSButton type="button" variant="secondary" onClick={addItem} leftIcon={<Plus size={16} />}>Add Item</IOSButton>
                            </div>

                            <div className="space-y-3">
                                {formData.items.map((item, idx) => (
                                    <div key={idx} className="flex flex-col md:flex-row gap-3 p-4 bg-stone-50 rounded-xl relative group">
                                        <div className="flex-1 space-y-1">
                                            <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Select Item</label>
                                            <select
                                                className="w-full h-10 px-3 bg-white border-none rounded-lg text-sm shadow-sm"
                                                value={item.item_id}
                                                onChange={(e) => handleItemChange(idx, 'item_id', e.target.value)}
                                                required
                                            >
                                                <option value="">Select an item...</option>
                                                {inventoryItems.map(i => <option key={i.id} value={i.id}>{i.item_name} ({i.sku})</option>)}
                                            </select>
                                        </div>
                                        <div className="w-full md:w-32 space-y-1">
                                            <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Quantity</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={item.quantity_ordered}
                                                onChange={(e) => handleItemChange(idx, 'quantity_ordered', Number(e.target.value))}
                                                className="h-10 border-none shadow-sm"
                                            />
                                        </div>
                                        <div className="w-full md:w-40 space-y-1">
                                            <label className="text-[10px] font-bold text-stone-400 uppercase ml-1">Unit Price</label>
                                            <Input
                                                type="number"
                                                value={item.unit_price}
                                                onChange={(e) => handleItemChange(idx, 'unit_price', Number(e.target.value))}
                                                className="h-10 border-none shadow-sm px-3"
                                            />
                                        </div>
                                        <div className="w-full md:w-44 space-y-1">
                                            <label className="text-[10px] font-bold text-stone-400 uppercase ml-1 text-right block">Total</label>
                                            <div className="h-10 flex items-center justify-end px-3 font-bold text-stone-700">
                                                KES {item.total_price.toLocaleString()}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeItem(idx)}
                                            className="absolute -right-2 top-1/2 -translate-y-1/2 p-2 text-stone-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))}

                                {formData.items.length === 0 && (
                                    <div className="text-center py-12 border-2 border-dashed border-stone-100 rounded-xl text-stone-400 italic">
                                        No items added to this purchase order yet.
                                    </div>
                                )}
                            </div>

                            {formData.items.length > 0 && (
                                <div className="mt-8 pt-6 border-t border-stone-100 flex justify-end">
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Total PO Amount</p>
                                        <p className="text-4xl font-black text-amber-600">KES {totalAmount.toLocaleString()}</p>
                                    </div>
                                </div>
                            )}
                        </IOSCard>

                        <div className="flex justify-end gap-3 pt-4">
                            <IOSButton type="button" variant="secondary" onClick={() => router.back()}>Cancel</IOSButton>
                            <IOSButton
                                type="submit"
                                className="h-12 px-12 rounded-ios-xl shadow-amber-200 shadow-xl"
                                disabled={isSaving}
                                leftIcon={isSaving ? <RefreshCw className="animate-spin" size={18} /> : <ShoppingBag size={18} />}
                            >
                                {isSaving ? 'Creating PO...' : 'Create Purchase Order'}
                            </IOSButton>
                        </div>
                    </form>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
