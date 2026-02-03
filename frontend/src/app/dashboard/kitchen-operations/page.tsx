'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
    TrendingUp, TrendingDown, AlertTriangle,
    ShoppingCart, Trash2, RefreshCw, BookOpen,
    ClipboardList, ChefHat, BarChart3, Package
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
            const response = await api.kitchen.getDashboardStats(activeBranchId || undefined);
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
            icon: BookOpen,
            href: '/dashboard/kitchen-operations/stock'
        },
        {
            title: 'Request Stock',
            icon: ShoppingCart,
            href: '/dashboard/kitchen-operations/requisitions'
        },
        {
            title: 'Recipes',
            icon: ChefHat,
            href: '/dashboard/kitchen-operations/recipes'
        },
        {
            title: 'Record Wastage',
            icon: Trash2,
            href: '/dashboard/kitchen-operations/wastage'
        },
        {
            title: 'Usage',
            icon: ClipboardList,
            href: '/dashboard/kitchen-operations/usage'
        },
        {
            title: 'Food Controls',
            icon: BarChart3,
            href: '/dashboard/kitchen-operations/food-controls'
        },
        {
            title: 'Portion Stock',
            icon: Package,
            href: '/dashboard/kitchen-operations/food-controls?tab=portions'
        },
        {
            title: 'Variance',
            icon: AlertTriangle,
            href: '/dashboard/kitchen-operations/food-controls?tab=variance'
        }
    ];

    const statCards = [
        { label: 'Received', value: stats.receiptsToday.toString(), icon: TrendingUp },
        { label: 'Used', value: stats.usageToday.toFixed(1), icon: TrendingDown },
        { label: 'Wastage', value: stats.wastageToday.toFixed(1), icon: Trash2 },
        { label: 'Wastage Value', value: `KES ${stats.wastageValue.toLocaleString()}`, icon: Package },
        { label: 'Low Stock', value: stats.lowStockCount.toString(), icon: AlertTriangle },
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
                            <h1 className="page-title">Kitchen Operations</h1>
                            <p className="page-subtitle">Manage stock, recipes, and food costs</p>
                        </div>
                        <button
                            onClick={fetchStats}
                            disabled={isLoading}
                            className="btn-secondary"
                        >
                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                        {statCards.map((stat, i) => (
                            <div key={i} className="stat-card">
                                <div className="stat-icon">
                                    <stat.icon className="h-5 w-5" />
                                </div>
                                <p className="stat-value">{stat.value}</p>
                                <p className="stat-label">{stat.label}</p>
                            </div>
                        ))}
                    </div>

                    {/* Quick Access */}
                    <div className="card-elevated p-6">
                        <div className="section-header">
                            <div>
                                <h2 className="section-title">Quick Actions</h2>
                                <p className="section-subtitle">Common kitchen tasks</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                            {quickActions.map((action) => (
                                <Link key={action.href} href={action.href}>
                                    <div className="action-card group">
                                        <div className="action-card-icon">
                                            <action.icon className="h-5 w-5" />
                                        </div>
                                        <p className="action-card-label">{action.title}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
