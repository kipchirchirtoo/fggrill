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
    ClipboardList, Plus, RefreshCw, ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function UsageTrackingPage() {
    const { activeBranchId } = useBranch();
    const [usageEntries, setUsageEntries] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        item_sku: '',
        item_name: '',
        quantity: 1,
        unit_of_measure: 'kg',
        usage_type: 'STAFF_MEAL',
        notes: '',
        shift: 'DAY'
    });

    useEffect(() => {
        fetchUsage();
    }, [activeBranchId]);

    const fetchUsage = async () => {
        setIsLoading(true);
        try {
            const response = await api.kitchen.getUsageEntries(activeBranchId || undefined);
            if (response.data?.success || response.success) {
                setUsageEntries(response.data?.data || response.data || []);
            }
        } catch (error) {
            console.error('Error fetching usage:', error);
            toast.error('Failed to load usage entries');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async () => {
        try {
            const response = await api.kitchen.recordUsage({
                ...formData,
                branch_id: activeBranchId
            });
            if (response.data?.success || response.success) {
                toast.success('Usage recorded successfully');
                setIsModalOpen(false);
                setFormData({
                    item_sku: '',
                    item_name: '',
                    quantity: 1,
                    unit_of_measure: 'kg',
                    usage_type: 'STAFF_MEAL',
                    notes: '',
                    shift: 'DAY'
                });
                fetchUsage();
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to record usage');
        }
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
                                    Usage Tracking
                                </h1>
                                <p className="text-stone-500 text-sm mt-0.5">
                                    Manual usage entries
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton
                                onClick={fetchUsage}
                                leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}
                                variant="secondary"
                            >
                                Refresh
                            </IOSButton>
                            <IOSButton onClick={() => setIsModalOpen(true)} leftIcon={<Plus />}>
                                Record Usage
                            </IOSButton>
                        </div>
                    </div>

                    {/* Usage List */}
                    <IOSCard>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Date</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Item</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Type</th>
                                        <th className="px-4 py-3 text-right text-xs font-bold text-stone-500 uppercase">Quantity</th>
                                        <th className="px-4 py-3 text-left text-xs font-bold text-stone-500 uppercase">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center">
                                                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-stone-400" />
                                            </td>
                                        </tr>
                                    ) : usageEntries.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                                                No usage entries found
                                            </td>
                                        </tr>
                                    ) : (
                                        usageEntries.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-stone-50">
                                                <td className="px-4 py-3 text-sm">
                                                    {new Date(entry.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <p className="font-medium text-stone-900">{entry.item_name}</p>
                                                    <p className="text-xs text-stone-500">{entry.item_sku}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <IOSBadge className="bg-blue-100 text-blue-700">{entry.usage_type}</IOSBadge>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono">
                                                    {entry.quantity} {entry.unit_of_measure}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-stone-600">{entry.notes || '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>

                    {/* Record Usage Modal */}
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Record Usage</DialogTitle>
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
                                        <label className="block text-sm font-medium mb-1">Usage Type</label>
                                        <select
                                            value={formData.usage_type}
                                            onChange={(e) => setFormData({ ...formData, usage_type: e.target.value })}
                                            className="w-full h-10 px-3 rounded-ios-lg border border-stone-200"
                                        >
                                            <option value="STAFF_MEAL">Staff Meal</option>
                                            <option value="COMPLIMENTARY">Complimentary</option>
                                            <option value="TEST">Test Cooking</option>
                                            <option value="OTHER">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">Shift</label>
                                        <select
                                            value={formData.shift}
                                            onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                                            className="w-full h-10 px-3 rounded-ios-lg border border-stone-200"
                                        >
                                            <option value="DAY">Day</option>
                                            <option value="NIGHT">Night</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-1">Notes</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        className="w-full px-3 py-2 border rounded-ios-lg"
                                        rows={2}
                                        placeholder="Additional details..."
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-4 border-t">
                                    <IOSButton variant="secondary" onClick={() => setIsModalOpen(false)}>
                                        Cancel
                                    </IOSButton>
                                    <IOSButton onClick={handleSubmit}>
                                        Record Usage
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
