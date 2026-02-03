'use client';

import { useState, useEffect } from 'react';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    ClipboardList, Plus, RefreshCw, ArrowLeft, Search, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';
import { UserRole } from '@/lib/auth-context';

export default function UsageTrackingPage() {
    const { activeBranchId } = useBranch();
    const [usageEntries, setUsageEntries] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [kitchenStock, setKitchenStock] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('ALL');
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
        if (activeBranchId) {
            fetchStock();
        }
    }, [activeBranchId]);

    const fetchStock = async () => {
        try {
            const response = await api.kitchen.getKitchenStock(activeBranchId!);
            if (response.success) {
                setKitchenStock(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching kitchen stock:', error);
        }
    };

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
        if (!formData.item_sku || !formData.quantity || !formData.usage_type) {
            toast.error('Item SKU, quantity, and usage type are required');
            return;
        }

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

    const filteredEntries = usageEntries.filter(entry => {
        const matchesSearch = entry.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.item_sku?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterType === 'ALL' || entry.usage_type === filterType;
        return matchesSearch && matchesFilter;
    });

    const getUsageBadge = (type: string) => {
        const styles: Record<string, string> = {
            STAFF_MEAL: 'bg-blue-100 text-blue-700',
            COMPLIMENTARY: 'bg-green-100 text-green-700',
            TEST: 'bg-amber-100 text-amber-700',
            OTHER: 'bg-stone-100 text-stone-700'
        };
        const style = styles[type] || 'bg-stone-100 text-stone-700';
        return <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${style}`}>{type.replace('_', ' ')}</span>;
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
                                <h1 className="page-title">Usage Tracking</h1>
                                <p className="page-subtitle">Manual usage entries</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={fetchUsage}
                                className="btn-secondary"
                                disabled={isLoading}
                            >
                                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                            <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                                <Plus className="h-4 w-4" />
                                <span>Record Usage</span>
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
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="input-field w-full md:w-48"
                            >
                                <option value="ALL">All Types</option>
                                <option value="STAFF_MEAL">Staff Meal</option>
                                <option value="COMPLIMENTARY">Complimentary</option>
                                <option value="TEST">Test Cooking</option>
                                <option value="OTHER">Other</option>
                            </select>
                        </div>
                    </div>

                    {/* Usage List */}
                    <div className="card-elevated overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-stone-50 border-b border-stone-100">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Date</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Item</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Type</th>
                                        <th className="px-5 py-3 text-right text-[11px] font-bold text-stone-500 uppercase">Quantity</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Shift</th>
                                        <th className="px-5 py-3 text-left text-[11px] font-bold text-stone-500 uppercase">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100">
                                    {isLoading ? (
                                        <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-stone-500">Loading usage entries...</td></tr>
                                    ) : filteredEntries.length === 0 ? (
                                        <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-stone-500">No usage entries found</td></tr>
                                    ) : (
                                        filteredEntries.map((entry) => (
                                            <tr key={entry.id} className="hover:bg-stone-50/50 transition-colors">
                                                <td className="px-5 py-3 text-[13px] text-stone-600">
                                                    {new Date(entry.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <p className="text-[13px] font-semibold text-stone-900">{entry.item_name}</p>
                                                    <p className="text-[10px] text-stone-500 mt-0.5">{entry.item_sku || '-'}</p>
                                                </td>
                                                <td className="px-5 py-3">
                                                    {getUsageBadge(entry.usage_type)}
                                                </td>
                                                <td className="px-5 py-3 text-right text-[13px] font-bold font-variant-numeric text-stone-900">
                                                    {entry.quantity} {entry.unit_of_measure}
                                                </td>
                                                <td className="px-5 py-3 text-[13px] text-stone-600 capitalize">
                                                    {entry.shift ? entry.shift.toLowerCase() : '-'}
                                                </td>
                                                <td className="px-5 py-3 text-[13px] text-stone-500 italic">
                                                    {entry.notes || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Record Usage Modal */}
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogContent className="max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden border-stone-200">
                            <DialogHeader className="px-4 py-3 border-b border-stone-100 bg-stone-50/50">
                                <DialogTitle className="flex items-center gap-2 text-[15px] font-semibold text-stone-900">
                                    <ClipboardList className="h-4 w-4 text-stone-500" />
                                    Record Kitchen Usage
                                </DialogTitle>
                            </DialogHeader>

                            <div className="overflow-y-auto px-4 py-4 flex-1 space-y-4">
                                <div className="space-y-3">
                                    <div className="bg-blue-50/50 border border-blue-100/50 rounded-lg p-2.5 text-[11px] text-blue-800 leading-relaxed">
                                        Record manual usage like staff meals or taste testing. Do not use for wastage.
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="space-y-1">
                                            <label className="input-label text-[12px] mb-1">Select Item from Stock</label>
                                            <select
                                                className="input-field py-1.5 px-3 text-[13px]"
                                                value={formData.item_sku}
                                                onChange={(e) => {
                                                    const stockItem = kitchenStock.find(i => i.item_sku === e.target.value);
                                                    if (stockItem) {
                                                        setFormData({
                                                            ...formData,
                                                            item_sku: stockItem.item_sku,
                                                            item_name: stockItem.item_name,
                                                            unit_of_measure: stockItem.unit_of_measure
                                                        });
                                                    } else {
                                                        setFormData({ ...formData, item_sku: '', item_name: '', unit_of_measure: 'kg' });
                                                    }
                                                }}
                                            >
                                                <option value="">-- Choose Stock Item --</option>
                                                {kitchenStock.map((item) => (
                                                    <option key={item.item_sku} value={item.item_sku}>
                                                        {item.item_name} ({item.current_balance} {item.unit_of_measure} available)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="input-label text-[12px] mb-1">Quantity</label>
                                            <input
                                                type="number"
                                                value={formData.quantity}
                                                onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                                                className="input-field py-1.5 px-3 text-[13px]"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="input-label text-[12px] mb-1">Unit</label>
                                            <input
                                                value={formData.unit_of_measure}
                                                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                                                placeholder="kg"
                                                className="input-field py-1.5 px-3 text-[13px]"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="input-label text-[12px] mb-1">Usage Type</label>
                                            <select
                                                value={formData.usage_type}
                                                onChange={(e) => setFormData({ ...formData, usage_type: e.target.value })}
                                                className="input-field py-1.5 px-3 text-[13px]"
                                            >
                                                <option value="STAFF_MEAL">Staff Meal</option>
                                                <option value="COMPLIMENTARY">Complimentary</option>
                                                <option value="TEST">Test Cooking</option>
                                                <option value="OTHER">Other</option>
                                            </select>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="input-label text-[12px] mb-1">Shift</label>
                                            <select
                                                value={formData.shift}
                                                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                                                className="input-field py-1.5 px-3 text-[13px]"
                                            >
                                                <option value="DAY">Day Shift</option>
                                                <option value="NIGHT">Night Shift</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="input-label text-[12px] mb-1">Notes</label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            className="input-field min-h-[60px] py-1.5 px-3 text-[13px]"
                                            placeholder="Details..."
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 px-4 py-3 border-t border-stone-100 bg-stone-50/50">
                                <button className="btn-secondary py-1.5 text-[13px] flex-1" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                <button className="btn-primary py-1.5 text-[13px] flex-1" onClick={handleSubmit}>
                                    Record Usage
                                </button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
