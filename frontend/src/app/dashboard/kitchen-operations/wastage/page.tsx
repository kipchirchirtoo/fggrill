'use client';

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    Trash2, Plus, RefreshCw, ArrowLeft, Search, Filter, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';
import { UserRole } from '@/lib/auth-context';

export default function WastagePage() {
    const { activeBranchId } = useBranch();
    const [wastageRecords, setWastageRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterReason, setFilterReason] = useState('ALL');
    const [formData, setFormData] = useState({
        item_sku: '',
        item_name: '',
        quantity: 1,
        unit_of_measure: 'kg',
        reason: 'SPOILAGE',
        estimated_value: 0,
        shift: 'DAY',
        photo_url: ''
    });

    useEffect(() => {
        fetchWastage();
    }, [activeBranchId]);

    const fetchWastage = async () => {
        setIsLoading(true);
        try {
            const response = await api.kitchen.getWastageRecords(activeBranchId || undefined);
            if (response.data?.success || response.success) {
                setWastageRecords(response.data?.data || response.data || []);
            }
        } catch (error) {
            console.error('Error fetching wastage:', error);
            toast.error('Failed to load wastage records');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.item_name || !formData.quantity || !formData.estimated_value) {
            toast.error('Please fill in required fields');
            return;
        }

        try {
            const response = await api.kitchen.recordWastage({
                ...formData,
                branch_id: activeBranchId
            });
            if (response.data?.success || response.success) {
                toast.success('Wastage recorded successfully');
                setIsModalOpen(false);
                setFormData({
                    item_sku: '',
                    item_name: '',
                    quantity: 1,
                    unit_of_measure: 'kg',
                    reason: 'SPOILAGE',
                    estimated_value: 0,
                    shift: 'DAY',
                    photo_url: ''
                });
                fetchWastage();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to record wastage');
        }
    };

    const filteredRecords = wastageRecords.filter(record => {
        const matchesSearch = record.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            record.item_sku?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterReason === 'ALL' || record.reason === filterReason;
        return matchesSearch && matchesFilter;
    });

    const getReasonBadge = (reason: string) => {
        const styles: Record<string, string> = {
            SPOILAGE: 'bg-red-100 text-red-700',
            OVERCOOKING: 'bg-orange-100 text-orange-700',
            CONTAMINATION: 'bg-purple-100 text-purple-700',
            EXPIRED: 'bg-amber-100 text-amber-700',
            DROPPED: 'bg-blue-100 text-blue-700',
            OTHER: 'bg-stone-100 text-stone-700'
        };
        const style = styles[reason] || styles.OTHER;
        return <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${style}`}>{reason}</span>;
    };

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
                                <h1 className="page-title">Wastage Recording</h1>
                                <p className="page-subtitle">Track and analyze wastage</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={fetchWastage}
                                className="btn-secondary"
                                disabled={isLoading}
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                                <Plus className="h-4 w-4" />
                                <span>Record Wastage</span>
                            </button>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="card-elevated p-4">
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                                <input
                                    type="text"
                                    placeholder="Search by item name or SKU..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="input-field pl-10"
                                />
                            </div>
                            <select
                                value={filterReason}
                                onChange={(e) => setFilterReason(e.target.value)}
                                className="input-field w-full md:w-48"
                            >
                                <option value="ALL">All Reasons</option>
                                <option value="SPOILAGE">Spoilage</option>
                                <option value="OVERCOOKING">Overcooking</option>
                                <option value="CONTAMINATION">Contamination</option>
                                <option value="EXPIRED">Expired</option>
                                <option value="DROPPED">Dropped</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                    </div>

                    {/* Wastage List */}
                    <div className="card-elevated overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50 border-b border-stone-100">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Date</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Item</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Reason</th>
                                        <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Quantity</th>
                                        <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Est. Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {isLoading ? (
                                        <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-stone-500">Loading wastage records...</td></tr>
                                    ) : filteredRecords.length === 0 ? (
                                        <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-stone-500">No wastage records found</td></tr>
                                    ) : (
                                        filteredRecords.map((record) => (
                                            <tr key={record.id} className="hover:bg-stone-50/50 transition-colors">
                                                <td className="px-5 py-3 text-[13px] text-stone-600">
                                                    {new Date(record.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <p className="text-[13px] font-semibold text-stone-900">{record.item_name}</p>
                                                    <p className="text-[10px] text-stone-500 mt-0.5">{record.item_sku || '-'}</p>
                                                </td>
                                                <td className="px-5 py-3">
                                                    {getReasonBadge(record.reason)}
                                                </td>
                                                <td className="px-5 py-3 text-right text-[13px] font-bold font-variant-numeric text-red-600">
                                                    {record.quantity} {record.unit_of_measure}
                                                </td>
                                                <td className="px-5 py-3 text-right text-[13px] font-bold font-variant-numeric text-red-600">
                                                    KES {record.estimated_value?.toLocaleString() || '0'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Record Wastage Modal */}
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 overflow-hidden">
                            <DialogHeader className="px-6 py-5 border-b border-stone-100 bg-stone-50/50">
                                <DialogTitle className="flex items-center gap-2 text-[17px] font-semibold text-stone-900">
                                    <Trash2 className="h-5 w-5 text-stone-500" />
                                    Record Wastage
                                </DialogTitle>
                            </DialogHeader>

                            <div className="overflow-y-auto px-6 py-6 flex-1 space-y-5">
                                <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                                    <p className="text-xs text-red-800">
                                        Recording wastage helps in accurate food cost calculation. Please be precise with quantities and reasons.
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="input-label">Item Name</label>
                                        <input
                                            value={formData.item_name}
                                            onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                                            placeholder="e.g., Tomatoes"
                                            className="input-field"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="input-label">Item SKU</label>
                                        <input
                                            value={formData.item_sku}
                                            onChange={(e) => setFormData({ ...formData, item_sku: e.target.value })}
                                            placeholder="Optional"
                                            className="input-field"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="input-label">Quantity</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={formData.quantity}
                                                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                                                className="input-field"
                                            />
                                            <input
                                                value={formData.unit_of_measure}
                                                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                                                placeholder="kg"
                                                className="input-field w-20"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="input-label">Est. Value (KES)</label>
                                        <input
                                            type="number"
                                            value={formData.estimated_value}
                                            onChange={(e) => setFormData({ ...formData, estimated_value: Number(e.target.value) })}
                                            className="input-field"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="input-label">Reason</label>
                                        <select
                                            value={formData.reason}
                                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                            className="input-field"
                                        >
                                            <option value="SPOILAGE">Spoilage</option>
                                            <option value="OVERCOOKING">Overcooking</option>
                                            <option value="CONTAMINATION">Contamination</option>
                                            <option value="EXPIRED">Expired</option>
                                            <option value="DROPPED">Dropped</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="input-label">Shift</label>
                                        <select
                                            value={formData.shift}
                                            onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                                            className="input-field"
                                        >
                                            <option value="DAY">Day Shift</option>
                                            <option value="NIGHT">Night Shift</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 px-6 py-4 border-t border-stone-100 bg-stone-50/50">
                                <button className="btn-secondary flex-1" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button className="btn-primary flex-1" onClick={handleSubmit}>
                                    Record Wastage
                                </button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
