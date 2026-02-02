'use client';

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    ShoppingCart, Plus, RefreshCw, ArrowLeft, X, Filter, Search
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';
import { UserRole } from '@/lib/auth-context';

interface Requisition {
    id: number;
    requisition_number: string;
    status: string;
    priority: string;
    requested_at: string;
    items: any[];
}

export default function RequisitionsPage() {
    const { activeBranchId } = useBranch();
    const [requisitions, setRequisitions] = useState<Requisition[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedItems, setSelectedItems] = useState<any[]>([]);
    const [priority, setPriority] = useState('NORMAL');
    const [reason, setReason] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

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
        const styles: Record<string, string> = {
            PENDING: 'bg-yellow-100 text-yellow-700',
            APPROVED: 'bg-green-100 text-green-700',
            REJECTED: 'bg-red-100 text-red-700',
            FULFILLED: 'bg-blue-100 text-blue-700'
        };
        const style = styles[status] || 'bg-stone-100 text-stone-700';
        return <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${style}`}>{status}</span>;
    };

    const filteredRequisitions = filterStatus === 'ALL'
        ? requisitions
        : requisitions.filter(r => r.status === filterStatus);

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.KITCHEN, UserRole.POS_KITCHEN, UserRole.KITCHEN_OPERATIONS, UserRole.RESTAURANT,
            UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <Link href="/dashboard/kitchen-operations">
                                <button className="p-2 hover:bg-stone-100 rounded-lg transition-colors text-stone-500 hover:text-stone-900">
                                    <ArrowLeft className="h-5 w-5" />
                                </button>
                            </Link>
                            <div>
                                <h1 className="page-title">Stock Requisitions</h1>
                                <p className="page-subtitle">Request items from main store</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={fetchRequisitions}
                                className="btn-secondary"
                                disabled={isLoading}
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                            <button
                                onClick={() => setIsModalOpen(true)}
                                className="btn-primary"
                            >
                                <Plus className="h-4 w-4" />
                                <span>New Request</span>
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="card-elevated p-4">
                        <div className="flex items-center gap-4 overflow-x-auto">
                            <Filter className="h-4 w-4 text-stone-400 shrink-0" />
                            {['ALL', 'PENDING', 'APPROVED', 'FULFILLED', 'REJECTED'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap ${filterStatus === status
                                            ? 'bg-stone-900 text-white'
                                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                                        }`}
                                >
                                    {status === 'ALL' ? 'All Requests' : status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Requisitions List */}
                    <div className="card-elevated overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50 border-b border-stone-100">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Requisition No.</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Date</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Status</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Priority</th>
                                        <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Items</th>
                                        <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {isLoading ? (
                                        <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-stone-500">Loading requisitions...</td></tr>
                                    ) : filteredRequisitions.length === 0 ? (
                                        <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-stone-500">No requisitions found</td></tr>
                                    ) : (
                                        filteredRequisitions.map((req) => (
                                            <tr key={req.id} className="hover:bg-stone-50/50 transition-colors">
                                                <td className="px-5 py-3">
                                                    <span className="font-mono text-[13px] font-medium text-stone-900">{req.requisition_number}</span>
                                                </td>
                                                <td className="px-5 py-3 text-[13px] text-stone-600">
                                                    {new Date(req.requested_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-5 py-3">
                                                    {getStatusBadge(req.status)}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={`text-[11px] font-bold uppercase ${req.priority === 'URGENT' ? 'text-red-600' :
                                                            req.priority === 'HIGH' ? 'text-orange-600' :
                                                                'text-stone-500'
                                                        }`}>
                                                        {req.priority}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-3 text-right text-[13px] text-stone-600">
                                                    {req.items?.length || 0}
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <button className="text-[13px] font-medium text-blue-600 hover:text-blue-700">
                                                        View Details
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Create Requisition Modal */}
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                            <DialogHeader className="px-6 py-5 border-b border-stone-100 bg-stone-50/50">
                                <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold text-stone-900">
                                    <ShoppingCart className="h-5 w-5 text-stone-500" />
                                    Create Stock Requisition
                                </DialogTitle>
                            </DialogHeader>

                            <div className="overflow-y-auto px-6 py-6 flex-1 space-y-6">
                                <div className="grid grid-cols-2 gap-5">
                                    <div className="space-y-1.5">
                                        <label className="input-label">Priority Level</label>
                                        <select
                                            value={priority}
                                            onChange={(e) => setPriority(e.target.value)}
                                            className="input-field"
                                        >
                                            <option value="LOW">Low - Normal Replenishment</option>
                                            <option value="NORMAL">Normal - Standard Request</option>
                                            <option value="HIGH">High - Urgent Need</option>
                                            <option value="URGENT">Urgent - Critical Shortage</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="input-label">Reason for Request</label>
                                        <input
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                            placeholder="e.g., Weekly restocking"
                                            className="input-field"
                                        />
                                    </div>
                                </div>

                                <div className="border-t border-stone-100 pt-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-bold text-stone-900">Items to Request</h3>
                                        <button
                                            onClick={addItem}
                                            className="btn-secondary py-1.5 px-3 h-auto text-xs"
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            <span>Add Item</span>
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        {selectedItems.map((item, index) => (
                                            <div key={index} className="grid grid-cols-12 gap-3 items-end bg-stone-50 p-3 rounded-lg border border-stone-100">
                                                <div className="col-span-3 space-y-1">
                                                    <label className="input-label">SKU</label>
                                                    <input
                                                        value={item.item_sku}
                                                        onChange={(e) => updateItem(index, 'item_sku', e.target.value)}
                                                        placeholder="SKU"
                                                        className="input-field py-1.5 text-xs h-8"
                                                    />
                                                </div>
                                                <div className="col-span-5 space-y-1">
                                                    <label className="input-label">Item Name</label>
                                                    <input
                                                        value={item.item_name}
                                                        onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                                                        placeholder="Item Name"
                                                        className="input-field py-1.5 text-xs h-8"
                                                    />
                                                </div>
                                                <div className="col-span-2 space-y-1">
                                                    <label className="input-label">Qty</label>
                                                    <input
                                                        type="number"
                                                        value={item.requested_quantity}
                                                        onChange={(e) => updateItem(index, 'requested_quantity', Number(e.target.value))}
                                                        className="input-field py-1.5 text-xs h-8"
                                                    />
                                                </div>
                                                <div className="col-span-2 space-y-1">
                                                    <label className="input-label">Unit</label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            value={item.unit_of_measure}
                                                            onChange={(e) => updateItem(index, 'unit_of_measure', e.target.value)}
                                                            placeholder="kg"
                                                            className="input-field py-1.5 text-xs h-8"
                                                        />
                                                        <button
                                                            onClick={() => removeItem(index)}
                                                            className="text-stone-400 hover:text-red-500 transition-colors"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {selectedItems.length === 0 && (
                                            <div className="text-center py-8 border-2 border-dashed border-stone-200 rounded-lg">
                                                <p className="text-sm text-stone-500">No items added to this requisition yet.</p>
                                                <button onClick={addItem} className="text-sm text-blue-600 font-medium hover:underline mt-1">
                                                    Add your first item
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50">
                                <button className="btn-secondary flex-1" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button className="btn-primary flex-1" onClick={handleCreateRequisition}>
                                    Submit Request
                                </button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
