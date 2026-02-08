'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { Package, RefreshCw, CheckCircle, AlertTriangle, Plus, ArrowRight } from 'lucide-react';
import { storeAPI } from '@/lib/api';
import { toast } from 'sonner';
import { StockTakeDetail } from '@/components/dashboard/branch/StockTakeDetail';

export default function BranchStockTakePage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [stockTakes, setStockTakes] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeStockTakeId, setActiveStockTakeId] = useState<string | null>(null);

    const fetchStockTakes = async () => {
        if (!activeBranchId) return;
        setIsLoading(true);
        try {
            const res = await storeAPI.getStockTakes();
            if (res.success && Array.isArray(res.data)) {
                // Filter locally for branch if API returns all
                const branchTakes = res.data.filter((t: any) => t.branch_id === activeBranchId);
                setStockTakes(branchTakes);
            }
        } catch (error) {
            console.error('Error fetching stock takes:', error);
            toast.error('Failed to load stock takes');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchStockTakes();
    }, [activeBranchId]);

    const handleCreateStockTake = async () => {
        if (!activeBranchId) return;
        try {
            const res = await storeAPI.createStockTake({
                branch_id: activeBranchId,
                take_type: 'monthly', // Default or selector
                notes: 'Generated from Branch Accounting'
            });

            if (res.success) {
                toast.success('New stock take started');
                fetchStockTakes();
                setActiveStockTakeId(res.data.id);
            } else {
                toast.error(res.message || 'Failed to create stock take');
            }
        } catch (error) {
            toast.error('Error creating stock take');
        }
    };

    if (activeStockTakeId) {
        return (
            <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
                <DashboardLayout>
                    <StockTakeDetail
                        stockTakeId={activeStockTakeId}
                        onBack={() => setActiveStockTakeId(null)}
                        onComplete={() => {
                            setActiveStockTakeId(null);
                            fetchStockTakes();
                        }}
                    />
                </DashboardLayout>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <Package className="h-6 w-6 text-blue-600" />
                                Branch Stock Takes
                            </h1>
                            <p className="text-gray-500">View and manage stock takes. Completed takes are sent to Auditor.</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" onClick={fetchStockTakes} leftIcon={<RefreshCw />}>Refresh</IOSButton>
                            <IOSButton onClick={handleCreateStockTake} leftIcon={<Plus />}>Start New Stock Take</IOSButton>
                        </div>
                    </div>

                    <IOSCard className="p-0 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Type</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Variance</th>
                                        <th className="px-6 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {isLoading ? (
                                        <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading...</td></tr>
                                    ) : stockTakes.length === 0 ? (
                                        <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No stock takes found.</td></tr>
                                    ) : (
                                        stockTakes.map((take) => (
                                            <tr key={take.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium">{new Date(take.date).toLocaleDateString()}</td>
                                                <td className="px-6 py-4">{take.type || 'Regular'}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${take.status === 'completed' ? 'bg-green-100 text-green-800' :
                                                        take.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                            take.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                                                'bg-gray-100 text-gray-800'
                                                        }`}>
                                                        {take.status === 'pending' ? 'Pending Audit' : take.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {take.variance !== 0 ? (
                                                        <span className="text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {take.variance}</span>
                                                    ) : (
                                                        <span className="text-green-600 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Balanced</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {take.status === 'in_progress' ? (
                                                        <button
                                                            onClick={() => setActiveStockTakeId(take.id)}
                                                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center justify-end gap-1 w-full"
                                                        >
                                                            Continue <ArrowRight className="h-3 w-3" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => setActiveStockTakeId(take.id)}
                                                            className="text-stone-500 hover:text-stone-800 font-medium"
                                                        >
                                                            View Details
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
