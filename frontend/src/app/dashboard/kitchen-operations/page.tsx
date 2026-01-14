'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import {
    Package, TrendingUp, TrendingDown, AlertTriangle,
    ShoppingCart, Trash2, RefreshCw, ArrowRight,
    BookOpen, ClipboardList, ChefHat, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { api } from '@/lib/api';

interface KitchenStats {
    receiptsToday: number;
    usageToday: number;
    wastageToday: number;
    wastageValue: number;
    lowStockCount: number;
}

export default function KitchenOperationsPage() {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [stats, setStats] = useState<KitchenStats>({
        receiptsToday: 0,
        usageToday: 0,
        wastageToday: 0,
        wastageValue: 0,
        lowStockCount: 0
    });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, [activeBranchId]);

    const fetchStats = async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/kitchen/dashboard/stats?branch_id=${activeBranchId}`);
            if (response.data.success) {
                setStats(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching kitchen stats:', error);
            toast.error('Failed to load kitchen statistics');
        } finally {
            setIsLoading(false);
        }
    };

    const quickActions = [
        {
            title: 'Stock Ledger',
            description: 'View all stock movements',
            icon: BookOpen,
            href: '/dashboard/kitchen-operations/stock',
            color: 'blue'
        },
        {
            title: 'Request Stock',
            description: 'Create requisition',
            icon: ShoppingCart,
            href: '/dashboard/kitchen-operations/requisitions',
            color: 'green'
        },
        {
            title: 'Recipes',
            description: 'Manage recipes & BOM',
            icon: ChefHat,
            href: '/dashboard/kitchen-operations/recipes',
            color: 'purple'
        },
        {
            title: 'Record Wastage',
            description: 'Log wastage items',
            icon: Trash2,
            href: '/dashboard/kitchen-operations/wastage',
            color: 'red'
        },
        {
            title: 'Usage Tracking',
            description: 'Manual usage entries',
            icon: ClipboardList,
            href: '/dashboard/kitchen-operations/usage',
            color: 'amber'
        },
        {
            title: 'Reports',
            description: 'Food cost & variance',
            icon: BarChart3,
            href: '/dashboard/kitchen-operations/reports',
            color: 'indigo'
        }
    ];

    return (
        <ProtectedRoute allowedRoles={[
            UserRole.KITCHEN,
            UserRole.POS_KITCHEN,
            UserRole.KITCHEN_OPERATIONS,
            UserRole.RESTAURANT,
            UserRole.SUPER_ADMIN,
            UserRole.GENERAL_MANAGER,
            UserRole.BRANCH_MANAGER
        ]}>
            <DashboardLayout>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-[22px] sm:text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">
                                Kitchen Operations
                            </h1>
                            <p className="text-stone-500 text-sm mt-0.5">
                                Ledger-based stock management and food cost control
                            </p>
                        </div>
                        <IOSButton
                            onClick={fetchStats}
                            leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}
                            variant="secondary"
                        >
                            Refresh
                        </IOSButton>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
                                    <TrendingUp className="h-5 w-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Received Today</p>
                                    <p className="text-2xl font-bold text-stone-900">{stats.receiptsToday}</p>
                                </div>
                            </div>
                        </IOSCard>

                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                                    <TrendingDown className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Used Today</p>
                                    <p className="text-2xl font-bold text-stone-900">{stats.usageToday.toFixed(1)}</p>
                                </div>
                            </div>
                        </IOSCard>

                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                                    <Trash2 className="h-5 w-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Wastage Today</p>
                                    <p className="text-2xl font-bold text-red-600">{stats.wastageToday.toFixed(1)}</p>
                                </div>
                            </div>
                        </IOSCard>

                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center">
                                    <Package className="h-5 w-5 text-amber-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Wastage Value</p>
                                    <p className="text-2xl font-bold text-amber-600">KES {stats.wastageValue.toLocaleString()}</p>
                                </div>
                            </div>
                        </IOSCard>

                        <IOSCard className="p-4">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center">
                                    <AlertTriangle className="h-5 w-5 text-orange-600" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Low Stock</p>
                                    <p className="text-2xl font-bold text-orange-600">{stats.lowStockCount}</p>
                                </div>
                            </div>
                        </IOSCard>
                    </div>

                    {/* Low Stock Alert */}
                    {stats.lowStockCount > 0 && (
                        <IOSCard className="p-4 bg-orange-50 border-orange-200">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                                <div className="flex-1">
                                    <h3 className="font-bold text-stone-900 mb-1">Low Stock Alert</h3>
                                    <p className="text-sm text-stone-600 mb-3">
                                        {stats.lowStockCount} item{stats.lowStockCount !== 1 ? 's' : ''} running low. Create a requisition to restock.
                                    </p>
                                    <Link href="/dashboard/kitchen-operations/requisitions">
                                        <IOSButton size="sm" variant="primary">
                                            Create Requisition <ArrowRight className="h-4 w-4 ml-1" />
                                        </IOSButton>
                                    </Link>
                                </div>
                            </div>
                        </IOSCard>
                    )}

                    {/* Quick Actions */}
                    <div>
                        <h2 className="text-lg font-bold text-stone-900 mb-4">Quick Actions</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {quickActions.map((action) => {
                                const Icon = action.icon;
                                const colorClasses = {
                                    blue: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
                                    green: 'bg-green-50 text-green-600 hover:bg-green-100',
                                    purple: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
                                    red: 'bg-red-50 text-red-600 hover:bg-red-100',
                                    amber: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
                                    indigo: 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                };

                                return (
                                    <Link key={action.title} href={action.href}>
                                        <IOSCard className="p-4 hover:shadow-md transition-shadow cursor-pointer">
                                            <div className="flex items-start gap-3">
                                                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${colorClasses[action.color as keyof typeof colorClasses]}`}>
                                                    <Icon className="h-6 w-6" />
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-stone-900 mb-1">{action.title}</h3>
                                                    <p className="text-sm text-stone-500">{action.description}</p>
                                                </div>
                                                <ArrowRight className="h-5 w-5 text-stone-400" />
                                            </div>
                                        </IOSCard>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>

                    {/* Info Card */}
                    <IOSCard className="p-6 bg-blue-50 border-blue-200">
                        <div className="flex items-start gap-4">
                            <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                                <BookOpen className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-bold text-stone-900 mb-2">Ledger-Based Stock Tracking</h3>
                                <p className="text-sm text-stone-600 mb-3">
                                    All stock movements are tracked through an immutable ledger. Stock balances are computed automatically - no manual edits allowed. This ensures complete accountability and accurate food cost control.
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <IOSBadge className="bg-white text-blue-700 border-blue-200">
                                        ✓ Immutable Ledger
                                    </IOSBadge>
                                    <IOSBadge className="bg-white text-blue-700 border-blue-200">
                                        ✓ Auto-Deduction from POS
                                    </IOSBadge>
                                    <IOSBadge className="bg-white text-blue-700 border-blue-200">
                                        ✓ Recipe-Based Costing
                                    </IOSBadge>
                                    <IOSBadge className="bg-white text-blue-700 border-blue-200">
                                        ✓ Daily Variance Reports
                                    </IOSBadge>
                                </div>
                            </div>
                        </div>
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
