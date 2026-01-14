'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    ShoppingCart, Plus, RefreshCw, ArrowLeft, Check, X, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Requisition {
    id: number;
    requisition_number: string;
    status: string;
    priority: string;
    requested_at: string;
    items: any[];
}

export default function RequisitionsPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [priority, setPriority] = useState('NORMAL');
    const [reason, setReason] = useState('');

    useEffect(() => {
        fetchRequisitions();
    }, [activeBranchId]);

    const fetchRequisitions = async () => {
        setIsLoading(true);
        try {
            const response = await api.kitchen.getRequisitions({ branch_id: activeBranchId || undefined });
            if (response.data?.success || response.success) {
                setRequisitions(response.data?.data || response.data || []);
            }
        } catch (error) {
            console.error('Error fetching requisitions:', error);
            toast.error('Failed to load requisitions');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateRequisition = async () => {
        if (selectedItems.length === 0) {
            toast.error('Please add at least one item');
            return;
        }

        try {
            const response = await api.kitchen.createRequisition({
                items: selectedItems,
                priority,
                reason,
                branch_id: activeBranchId
            });

            if (response.data?.success || response.success) {
                toast.success('Requisition created successfully');
                setIsModalOpen(false);
                setSelectedItems([]);
                setReason('');
                fetchRequisitions();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to create requisition');
        }
    };

    const addItem = () => {
        setSelectedItems([...selectedItems, {
            item_sku: '',
            item_name: '',
            requested_quantity: 1,
            unit_of_measure: 'kg'
        }]);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const updated = [...selectedItems];
        updated[index] = { ...updated[index], [field]: value };
        setSelectedItems(updated);
    };

    const removeItem = (index: number) => {
        setSelectedItems(selectedItems.filter((_, i) => i !== index));
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { bg: string; text: string }> = {
            PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
            APPROVED: { bg: 'bg-green-100', text: 'text-green-700' },
            REJECTED: { bg: 'bg-red-100', text: 'text-red-700' },
            FULFILLED: { bg: 'bg-blue-100', text: 'text-blue-700' }
        };
        const badge = badges[status] || { bg: 'bg-stone-100', text: 'text-stone-700' };
        return <IOSBadge className={`${badge.bg} ${badge.text}`}>{status}</IOSBadge>;
    };

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.KITCHEN, UserRole.POS_KITCHEN, UserRole.KITCHEN_OPERATIONS, UserRole.RESTAURANT,
            UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/kitchen-operations">
                                <button className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                                    <ArrowLeft className="h-5 w-5 text-stone-600" />
                                </button>
                            </Link>
                            <div>
                                <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">
                                    Stock Requisitions
                                </h1>
                                <p className="text-stone-500 text-sm mt-0.5">
                                    Request items from main store
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton
                                onClick={fetchRequisitions}
                                leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}
                                variant="secondary"
                            >
                                Refresh
                            </IOSButton>
                            <IOSButton
                                onClick={() => setIsModalOpen(true)}
                                leftIcon={<Plus />}
                            >
                                New Requisition
                            </IOSButton>
                        </div>
                    </div>

                    {/* Requisitions List */}
                    <div className="grid gap-4">
                        {isLoading ? (
                            <IOSCard className="p-8 text-center">
                                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-400" />
                            </IOSCard>
                        ) : requisitions.length === 0 ? (
                            <IOSCard className="p-8 text-center">
                                <ShoppingCart className="h-12 w-12 mx-auto mb-2 text-stone-300" />
                                <p className="text-stone-500">No requisitions found</p>
                            </IOSCard>
                        ) : (
                            requisitions.map((req) => (
                                <IOSCard key={req.id} className="p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <h3 className="font-bold text-stone-900">{req.requisition_number}</h3>
                                            <p className="text-sm text-stone-500">
                                                {new Date(req.requested_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            {getStatusBadge(req.status)}
                                            <IOSBadge className={
                                                req.priority === 'URGENT' ? 'bg-red-100 text-red-700' :
                                                    req.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-stone-100 text-stone-700'
                                            }>
                                                {req.priority}
                                            </IOSBadge>
                                        </div>
                                    </div>
                                    <div className="text-sm text-stone-600">
                                        {req.items?.length || 0} item(s)
                                    </div>
                                </IOSCard>
                            ))
                        )}
                    </div>

                    {/* Create Requisition Modal */}
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Create Stock Requisition</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4 mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Priority</label>
                                        <select
                                            value={priority}
                                            onChange={(e) => setPriority(e.target.value)}
                                            className="w-full h-10 px-3 rounded-ios-lg border border-stone-200"
                                        >
                                            <option value="LOW">Low</option>
                                            <option value="NORMAL">Normal</option>
                                            <option value="HIGH">High</option>
                                            <option value="URGENT">Urgent</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Reason</label>
                                    <textarea
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        placeholder="Why do you need these items?"
                                        className="w-full px-3 py-2 border rounded-ios-lg"
                                        rows={2}
                                    />
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium">Items</label>
                                        <IOSButton size="sm" onClick={addItem} leftIcon={<Plus />}>
                                            Add Item
                                        </IOSButton>
                                    </div>

                                    <div className="space-y-2">
                                        {selectedItems.map((item, index) => (
                                            <div key={index} className="grid grid-cols-12 gap-2 items-end">
                                                <div className="col-span-3">
                                                    <Input
                                                        placeholder="SKU"
                                                        value={item.item_sku}
                                                        onChange={(e) => updateItem(index, 'item_sku', e.target.value)}
                                                    />
                                                </div>
                                                <div className="col-span-4">
                                                    <Input
                                                        placeholder="Item Name"
                                                        value={item.item_name}
                                                        onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <Input
                                                        type="number"
                                                        placeholder="Qty"
                                                        value={item.requested_quantity}
                                                        onChange={(e) => updateItem(index, 'requested_quantity', Number(e.target.value))}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <Input
                                                        placeholder="Unit"
                                                        value={item.unit_of_measure}
                                                        onChange={(e) => updateItem(index, 'unit_of_measure', e.target.value)}
                                                    />
                                                </div>
                                                <div className="col-span-1">
                                                    <IOSButton
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => removeItem(index)}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </IOSButton>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <IOSButton variant="secondary" onClick={() => setIsModalOpen(false)}>
                                        Cancel
                                    </IOSButton>
                                    <IOSButton onClick={handleCreateRequisition}>
                                        Create Requisition
                                    </IOSButton>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
