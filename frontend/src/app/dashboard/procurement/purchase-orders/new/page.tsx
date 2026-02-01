'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/button";
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from '@/components/ui/badge';
import {
    ShoppingCart, Plus, Trash2, Search, Package,
    Building2, Calendar, FileText, ArrowLeft, Save,
    Calculator, User
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';

interface POItem {
    item_id: string;
    item_name: string;
    item_code: string;
    unit: string;
    unit_price: number;
    quantity: number;
    total: number;
}

export default function NewPurchaseOrderPage() {
    const router = useRouter();
    const { user } = useAuth();

    // Form state
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);

    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [selectedBranchId, setSelectedBranchId] = useState('1'); // Default to Central Store
    const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
    const [paymentTerms, setPaymentTerms] = useState('credit_30_days');
    const [notes, setNotes] = useState('');

    const [poItems, setPoItems] = useState<POItem[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Item selection state
    const [itemSearchTerm, setItemSearchTerm] = useState('');

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setIsLoadingData(true);
        try {
            // In a real app we'd search, but for MVP we fetch lists
            const [suppliersRes, itemsRes, branchesRes] = await Promise.all([
                api.procurement.getSuppliers?.() || api.store.getSuppliers(),
                api.store.getItems(),
                api.system.getBranches()
            ]);

            if (suppliersRes.success) setSuppliers(suppliersRes.data || []);
            if (itemsRes.success) setItems(itemsRes.data || []);
            if (branchesRes.success) setBranches(branchesRes.data || []);

            // Set branch naturally if user is from Bomet (ID 1)
            if (user?.branch_id) {
                setSelectedBranchId(user.branch_id.toString());
            }
        } catch (error) {
            console.error('Error loading PO data:', error);
            toast.error('Failed to load initial data');
        } finally {
            setIsLoadingData(false);
        }
    };

    const addItemToPO = (item: any) => {
        if (poItems.find(i => i.item_id === item.id)) {
            toast.info('Item already in list');
            return;
        }

        const newItem: POItem = {
            item_id: item.id,
            item_name: item.name,
            item_code: item.item_code,
            unit: item.unit,
            unit_price: item.average_cost || 0,
            quantity: 1,
            total: item.average_cost || 0
        };

        setPoItems([...poItems, newItem]);
        setItemSearchTerm('');
    };

    const updateItem = (index: number, field: keyof POItem, value: any) => {
        const updated = [...poItems];
        if (field === 'quantity' || field === 'unit_price') {
            const numVal = parseFloat(value) || 0;
            (updated[index] as any)[field] = numVal;
            updated[index].total = updated[index].quantity * updated[index].unit_price;
        }
        setPoItems(updated);
    };

    const removeItem = (index: number) => {
        setPoItems(poItems.filter((_, i) => i !== index));
    };

    const subtotal = poItems.reduce((sum, i) => sum + i.total, 0);
    const tax = subtotal * 0.16;
    const total = subtotal + tax;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedSupplierId) return toast.error('Please select a supplier');
        if (poItems.length === 0) return toast.error('Please add at least one item');
        if (!expectedDeliveryDate) return toast.error('Please set expected delivery date');

        setIsSubmitting(true);
        try {
            const payload = {
                supplier_id: selectedSupplierId,
                receiving_branch_id: parseInt(selectedBranchId),
                expected_delivery_date: expectedDeliveryDate,
                payment_terms: paymentTerms,
                special_instructions: notes,
                items: poItems.map(i => ({
                    item_id: i.item_id,
                    quantity: i.quantity,
                    unit_price: i.unit_price
                }))
            };

            const response = await api.procurement.createPurchaseOrder(payload);
            if (response.success) {
                toast.success('Purchase Order created successfully');
                router.push('/dashboard/procurement/purchase-orders');
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to create PO');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.PROCUREMENT, UserRole.CENTRAL_STOREKEEPER]}>
            <div className="p-6 max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" asChild>
                            <Link href="/dashboard/procurement/purchase-orders">
                                <ArrowLeft className="h-5 w-5" />
                            </Link>
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold">New Purchase Order</h1>
                            <p className="text-stone-500">Create a statutory PO with VAT breakdown</p>
                        </div>
                    </div>
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting || poItems.length === 0}
                        className="bg-stone-800 hover:bg-stone-900"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Order'}
                        <Save className="h-4 w-4 ml-2" />
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Form Area */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="border-stone-200">
                            <CardHeader>
                                <CardTitle className="text-lg">Order Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-stone-500">Supplier</label>
                                        <select
                                            value={selectedSupplierId}
                                            onChange={(e) => setSelectedSupplierId(e.target.value)}
                                            className="w-full h-10 border border-stone-200 rounded-md px-3 text-sm"
                                        >
                                            <option value="">Select Supplier</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} ({s.supplier_code})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-stone-500">Deliver To</label>
                                        <select
                                            value={selectedBranchId}
                                            onChange={(e) => setSelectedBranchId(e.target.value)}
                                            className="w-full h-10 border border-stone-200 rounded-md px-3 text-sm"
                                        >
                                            {branches.map(b => (
                                                <option key={b.id} value={b.id}>{b.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-stone-500">Exp. Delivery Date</label>
                                        <Input
                                            type="date"
                                            value={expectedDeliveryDate}
                                            onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                                            className="h-10"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold uppercase text-stone-500">Payment Terms</label>
                                        <select
                                            value={paymentTerms}
                                            onChange={(e) => setPaymentTerms(e.target.value)}
                                            className="w-full h-10 border border-stone-200 rounded-md px-3 text-sm"
                                        >
                                            <option value="cash">Cash on Delivery</option>
                                            <option value="credit_7_days">7 Days Credit</option>
                                            <option value="credit_15_days">15 Days Credit</option>
                                            <option value="credit_30_days">30 Days Credit</option>
                                            <option value="advance_payment">Advance Payment</option>
                                        </select>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-stone-200 overflow-hidden">
                            <CardHeader className="bg-stone-50/50 border-b">
                                <CardTitle className="text-lg flex items-center justify-between">
                                    <span>Items & Pricing</span>
                                    <Badge variant="outline" className="text-[10px] uppercase">{poItems.length} items</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-stone-50/30">
                                            <TableHead>Item Name</TableHead>
                                            <TableHead className="w-24 text-right">Qty</TableHead>
                                            <TableHead className="w-32 text-right">Unit Pr.</TableHead>
                                            <TableHead className="w-32 text-right">Total</TableHead>
                                            <TableHead className="w-12"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {poItems.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-32 text-center text-stone-400 italic">
                                                    No items added yet. Search on the right to add items.
                                                </TableCell>
                                            </TableRow>
                                        ) : poItems.map((item, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell>
                                                    <div className="font-medium">{item.item_name}</div>
                                                    <div className="text-[10px] text-stone-400 font-mono">{item.item_code}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                        className="h-8 text-right pr-2"
                                                    />
                                                    <span className="text-[10px] text-stone-400 block text-right mt-1">{item.unit}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={item.unit_price}
                                                        onChange={(e) => updateItem(idx, 'unit_price', e.target.value)}
                                                        className="h-8 text-right pr-2"
                                                    />
                                                </TableCell>
                                                <TableCell className="text-right font-semibold">
                                                    {item.total.toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-stone-300 hover:text-rose-500">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar Area */}
                    <div className="space-y-6">
                        <Card className="border-stone-200">
                            <CardHeader>
                                <CardTitle className="text-sm uppercase tracking-wider text-stone-500">Search Items</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                    <Input
                                        placeholder="Type item name..."
                                        value={itemSearchTerm}
                                        onChange={(e) => setItemSearchTerm(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                                <div className="max-h-[300px] overflow-y-auto space-y-1 pr-1">
                                    {items
                                        .filter(i => i.name.toLowerCase().includes(itemSearchTerm.toLowerCase()))
                                        .slice(0, 10)
                                        .map(i => (
                                            <button
                                                key={i.id}
                                                onClick={() => addItemToPO(i)}
                                                className="w-full text-left p-2 rounded-md hover:bg-stone-50 border border-transparent hover:border-stone-100 transition-all group"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="text-sm font-medium">{i.name}</span>
                                                    <Plus className="h-3 w-3 text-stone-300 group-hover:text-amber-600" />
                                                </div>
                                                <div className="text-[10px] text-stone-400">{i.item_code} | {i.unit}</div>
                                            </button>
                                        ))}
                                    {itemSearchTerm && items.filter(i => i.name.toLowerCase().includes(itemSearchTerm.toLowerCase())).length === 0 && (
                                        <p className="text-xs text-center text-stone-400 py-4">No matching items</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-stone-900 text-white border-0 shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-sm uppercase tracking-wider opacity-60">Order Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="opacity-60">Subtotal</span>
                                        <span className="font-medium">KES {subtotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="opacity-60">VAT (16%)</span>
                                        <span className="font-medium text-amber-400">KES {tax.toLocaleString()}</span>
                                    </div>
                                    <div className="pt-4 border-t border-white/10">
                                        <div className="flex justify-between items-end">
                                            <span className="text-xs uppercase opacity-60">Grand Total</span>
                                            <span className="text-2xl font-bold">KES {total.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="pt-4 space-y-2">
                                    <label className="text-[10px] font-bold uppercase opacity-40">Internal Notes</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500 min-h-[80px]"
                                        placeholder="Payment terms, delivery preferences..."
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </ProtectedRoute>
    );
}
