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
    Trash2, Plus, RefreshCw, ArrowLeft, Camera
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function WastagePage() {
    const { activeBranchId } = useBranch();
    const [wastageRecords, setWastageRecords] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
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
            const response = await api.get(`/kitchen/wastage?branch_id=${activeBranchId}`);
            if (response.data.success) {
                setWastageRecords(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching wastage:', error);
            toast.error('Failed to load wastage records');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            const response = await api.post('/kitchen/wastage', formData);
            if (response.data.success) {
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

    const getReasonBadge = (reason: string) => {
        const badges: Record<string, { bg: string; text: string }> = {
            SPOILAGE: { bg: 'bg-red-100', text: 'text-red-700' },
            OVERCOOKING: { bg: 'bg-orange-100', text: 'text-orange-700' },
            CONTAMINATION: { bg: 'bg-purple-100', text: 'text-purple-700' },
            EXPIRED: { bg: 'bg-amber-100', text: 'text-amber-700' },
            DROPPED: { bg: 'bg-blue-100', text: 'text-blue-700' },
            OTHER: { bg: 'bg-stone-100', text: 'text-stone-700' }
        };
        const badge = badges[reason] || badges.OTHER;
        return <IOSBadge className={`${badge.bg} ${badge.text}`}>{reason}</IOSBadge>;
    };

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.KITCHEN, UserRole.POS_KITCHEN, UserRole.RESTAURANT,
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
                                    Wastage Recording
                                </h1>
                                <p className="text-stone-500 text-sm mt-0.5">
                                    Track and analyze wastage
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton
                                onClick={fetchWastage}
                                leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}
                                variant="secondary"
                            >
                                Refresh
                            </IOSButton>
                            <IOSButton onClick={() => setIsModalOpen(true)} leftIcon={<Plus />}>
                                Record Wastage
                            </IOSButton>
                        </div>
                    </div>

                    {/* Wastage List */}
                    <IOSCard>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Item</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Reason</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Quantity</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center">
                                                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-400" />
                                            </td>
                                        </tr>
                                    ) : wastageRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                                                No wastage records found
                                            </td>
                                        </tr>
                                    ) : (
                                        wastageRecords.map((record) => (
                                            <tr key={record.id} className="hover:bg-stone-50">
                                                <td className="px-4 py-3 text-sm">
                                                    {new Date(record.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-stone-900">{record.item_name}</p>
                                                    <p className="text-xs text-stone-500">{record.item_sku}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {getReasonBadge(record.reason)}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-red-600">
                                                    {record.quantity} {record.unit_of_measure}
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono text-red-600">
                                                    KES {record.estimated_value?.toLocaleString() || '0'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>

                    {/* Record Wastage Modal */}
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Record Wastage</DialogTitle>
                            </DialogHeader>

                            <div className="space-y-4 mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Item SKU</label>
                                        <Input
                                            value={formData.item_sku}
                                            onChange={(e) => setFormData({ ...formData, item_sku: e.target.value })}
                                            placeholder="e.g., RICE-001"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Item Name</label>
                                        <Input
                                            value={formData.item_name}
                                            onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                                            placeholder="e.g., White Rice"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Quantity</label>
                                        <Input
                                            type="number"
                                            value={formData.quantity}
                                            onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Unit</label>
                                        <Input
                                            value={formData.unit_of_measure}
                                            onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Reason</label>
                                        <select
                                            value={formData.reason}
                                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                            className="w-full h-10 px-3 rounded-ios-lg border border-stone-200"
                                        >
                                            <option value="SPOILAGE">Spoilage</option>
                                            <option value="OVERCOOKING">Overcooking</option>
                                            <option value="CONTAMINATION">Contamination</option>
                                            <option value="EXPIRED">Expired</option>
                                            <option value="DROPPED">Dropped</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Estimated Value (KES)</label>
                                        <Input
                                            type="number"
                                            value={formData.estimated_value}
                                            onChange={(e) => setFormData({ ...formData, estimated_value: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <IOSButton variant="secondary" onClick={() => setIsModalOpen(false)}>
                                        Cancel
                                    </IOSButton>
                                    <IOSButton onClick={handleSubmit}>
                                        Record Wastage
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
