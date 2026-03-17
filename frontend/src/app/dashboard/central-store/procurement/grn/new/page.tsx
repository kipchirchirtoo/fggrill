'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from "@/components/ui/minimal/card";
import { Input } from '@/components/ui/input';
import { procurementAPI, storeAPI } from '@/lib/api';
import { Save, X, Plus, Trash2, ArrowLeft, RefreshCw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface FormData {
    po_id: string;
    supplier_id: string;
    grn_date: string;
    delivery_note_number: string;
    invoice_number: string;
    vehicle_number: string;
    driver_name: string;
    driver_phone: string;
    remarks: string;
    items: any[];
}

export default function NewGRNPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const po_id = searchParams.get('po_id');
    const { user } = useAuth();

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [purchaseOrder, setPurchaseOrder] = useState<any>(null);
    const [formData, setFormData] = useState<FormData>({
        po_id: po_id || '',
        supplier_id: '',
        grn_date: new Date().toISOString().split('T')[0],
        delivery_note_number: '',
        invoice_number: '',
        vehicle_number: '',
        driver_name: '',
        driver_phone: '',
        remarks: '',
        items: []
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const suppliersRes = await procurementAPI.getSuppliers();
            if (suppliersRes.success) setSuppliers(suppliersRes.data || []);

            if (po_id) {
                const poRes = await procurementAPI.getPurchaseOrder(po_id);
                if (poRes.success) {
                    const po = poRes.data;
                    setPurchaseOrder(po);
                    setFormData(prev => ({
                        ...prev,
                        supplier_id: po.supplier_id,
                        po_id: po.id,
                        items: (po.items || []).map((item: any) => ({
                            po_item_id: item.id,
                            item_id: item.item_id,
                            item_name: item.item?.name || item.item_name,
                            unit: item.item?.unit || item.unit,
                            quantity_ordered: item.quantity_ordered,
                            quantity_received: item.quantity_ordered,
                            quantity_accepted: item.quantity_ordered,
                            quantity_rejected: 0,
                            quantity_damaged: 0,
                            unit_price: item.unit_price,
                            quality_status: 'accepted',
                            notes: ''
                        }))
                    }));
                }
            }
        } catch (error) { console.error('Error fetching data:', error); }
        finally { setIsLoading(false); }
    }, [po_id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };

        // Auto-calculate accepted if received changes
        if (field === 'quantity_received') {
            newItems[index].quantity_accepted = value - (newItems[index].quantity_rejected || 0) - (newItems[index].quantity_damaged || 0);
        }

        setFormData({ ...formData, items: newItems });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.supplier_id || formData.items.length === 0) {
            toast.error('Supplier and at least one item are required');
            return;
        }

        setIsSaving(true);
        try {
            const res = await procurementAPI.createGRN(formData);
            if (res.success) {
                toast.success('Goods Received Note Created successfully');
                router.push('/dashboard/central-store/procurement/grn');
            } else {
                toast.error(res.message || 'Failed to create GRN');
            }
        } catch (error: any) {
            toast.error(error.message || 'Error occurred');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return (
        <DashboardLayout>
            <div className="flex justify-center items-center h-64"><RefreshCw className="animate-spin text-amber-500" /></div>
        </DashboardLayout>
    );

    return (
        <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="max-w-5xl mx-auto space-y-6">
                    <div className="flex items-center gap-4">
                        <button onClick={() => router.back()} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                            <ArrowLeft size={20} className="text-stone-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Record Goods Receipt</h1>
                            <p className="text-stone-500 text-sm">Create a new Goods Received Note (GRN)</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <IOSCard className="md:col-span-2 p-6 space-y-4 border-none shadow-sm bg-white">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-4">Shipment Details</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-stone-500 uppercase px-1">Supplier</label>
                                        <select
                                            className="w-full h-11 px-4 bg-stone-50 border-none rounded-ios-lg text-sm focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                                            value={formData.supplier_id}
                                            onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                                            disabled={!!po_id}
                                            required
                                        >
                                            <option value="">Select Supplier...</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.supplier_code})</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-stone-500 uppercase px-1">Receipt Date</label>
                                        <Input
                                            type="date"
                                            value={formData.grn_date}
                                            onChange={(e) => setFormData({ ...formData, grn_date: e.target.value })}
                                            className="h-11 bg-stone-50 border-none rounded-ios-lg font-medium"
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-stone-500 uppercase px-1">Delivery Note #</label>
                                        <Input
                                            placeholder="S12345"
                                            value={formData.delivery_note_number}
                                            onChange={(e) => setFormData({ ...formData, delivery_note_number: e.target.value })}
                                            className="h-11 bg-stone-50 border-none rounded-ios-lg"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-stone-500 uppercase px-1">Supplier Invoice #</label>
                                        <Input
                                            placeholder="INV-001"
                                            value={formData.invoice_number}
                                            onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                                            className="h-11 bg-stone-50 border-none rounded-ios-lg"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 pt-2">
                                    <label className="text-[11px] font-bold text-stone-500 uppercase px-1">Remarks / Quality Notes</label>
                                    <textarea
                                        className="w-full p-4 bg-stone-50 border-none rounded-ios-xl text-sm min-h-[80px]"
                                        placeholder="Add any verification notes or shipment comments..."
                                        value={formData.remarks}
                                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    />
                                </div>
                            </IOSCard>

                            <IOSCard className="p-6 space-y-4 border-none shadow-sm bg-[#F2F2F7]">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400 mb-4">Logistics</h2>
                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-stone-500 uppercase px-1">Vehicle Number</label>
                                        <Input
                                            placeholder="KAA 123X"
                                            value={formData.vehicle_number}
                                            onChange={(e) => setFormData({ ...formData, vehicle_number: e.target.value })}
                                            className="h-11 bg-white border-none rounded-ios-lg shadow-sm font-mono uppercase"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-stone-500 uppercase px-1">Driver Name</label>
                                        <Input
                                            placeholder="John Doe"
                                            value={formData.driver_name}
                                            onChange={(e) => setFormData({ ...formData, driver_name: e.target.value })}
                                            className="h-11 bg-white border-none rounded-ios-lg shadow-sm"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-stone-500 uppercase px-1">Driver Phone</label>
                                        <Input
                                            placeholder="0712345678"
                                            value={formData.driver_phone}
                                            onChange={(e) => setFormData({ ...formData, driver_phone: e.target.value })}
                                            className="h-11 bg-white border-none rounded-ios-lg shadow-sm"
                                        />
                                    </div>
                                </div>

                                {purchaseOrder && (
                                    <div className="mt-8 pt-6 border-t border-stone-200">
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-2 font-mono">Linked Purchase Order</p>
                                        <p className="text-lg font-black text-stone-800">{purchaseOrder.po_number}</p>
                                        <p className="text-xs text-stone-500">Dated: {new Date(purchaseOrder.po_date).toLocaleDateString()}</p>
                                    </div>
                                )}
                            </IOSCard>
                        </div>

                        <IOSCard className="p-6 border-none shadow-sm bg-white overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-sm font-bold uppercase tracking-widest text-stone-400">Items Verification</h2>
                                {!po_id && (
                                    <IOSButton type="button" variant="secondary" onClick={() => toast.info('Direct receipt item selection coming soon')} leftIcon={<Plus size={16} />}>Add Custom Item</IOSButton>
                                )}
                            </div>

                            <div className="overflow-x-auto -mx-6">
                                <table className="w-full">
                                    <thead className="bg-stone-50 text-stone-500 border-b border-stone-100">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-[10px] font-black uppercase tracking-widest">Item Description</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">PO Qty</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Received</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">Rejected</th>
                                            <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest bg-amber-50/50">Accepted</th>
                                            <th className="px-6 py-3 text-center text-[10px] font-black uppercase tracking-widest">Condition</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-50">
                                        {formData.items.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-stone-50/30 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-bold text-stone-800">{item.item_name}</p>
                                                    <p className="text-[10px] text-stone-400 font-mono italic">Unit: {item.unit || 'unit'}</p>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <span className="font-mono text-stone-400">{item.quantity_ordered}</span>
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <input
                                                        type="number"
                                                        className="w-20 text-right bg-stone-50 border-none rounded px-2 py-1 font-bold text-stone-800"
                                                        value={item.quantity_received}
                                                        onChange={(e) => handleItemChange(idx, 'quantity_received', Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-right">
                                                    <input
                                                        type="number"
                                                        className="w-20 text-right bg-red-50 text-red-600 border-none rounded px-2 py-1 font-bold"
                                                        value={item.quantity_rejected}
                                                        onChange={(e) => handleItemChange(idx, 'quantity_rejected', Number(e.target.value))}
                                                    />
                                                </td>
                                                <td className="px-4 py-4 text-right bg-amber-50/20">
                                                    <span className="font-black text-amber-600 text-base">{item.quantity_received - (item.quantity_rejected || 0) - (item.quantity_damaged || 0)}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <select
                                                        className="text-[10px] font-bold uppercase rounded-full border border-stone-200 px-3 py-1 bg-white text-stone-600 cursor-pointer"
                                                        value={item.quality_status}
                                                        onChange={(e) => handleItemChange(idx, 'quality_status', e.target.value)}
                                                    >
                                                        <option value="accepted">Accepted</option>
                                                        <option value="partially_accepted">Partial</option>
                                                        <option value="rejected">Rejected</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-8 flex justify-end items-center gap-6 pr-6">
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Total Verified Items</p>
                                    <p className="text-3xl font-black text-stone-900">{formData.items.length}</p>
                                </div>
                                <div className="w-px h-12 bg-stone-100" />
                                <div className="text-right text-amber-600">
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Net Received Quantity</p>
                                    <p className="text-3xl font-black">{formData.items.reduce((sum, i) => sum + (i.quantity_received - (i.quantity_rejected || 0)), 0)}</p>
                                </div>
                            </div>
                        </IOSCard>

                        <div className="flex justify-end gap-3 pt-4 pb-12">
                            <IOSButton type="button" variant="secondary" className="h-12 px-8 rounded-ios-xl" onClick={() => router.back()}>Discard</IOSButton>
                            <IOSButton
                                type="submit"
                                className="h-12 px-12 rounded-ios-xl shadow-amber-200 shadow-xl"
                                disabled={isSaving}
                                leftIcon={isSaving ? <RefreshCw className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                            >
                                {isSaving ? 'Processing Receipt...' : 'Complete & Save GRN'}
                            </IOSButton>
                        </div>
                    </form>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
