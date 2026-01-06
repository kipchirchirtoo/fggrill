'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { centralOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import {
    Package, Truck, ClipboardList, AlertTriangle,
    ArrowUpRight, ArrowDownRight, TrendingUp,
    Clock, CheckCircle, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function WarehouseDashboardPage() {
    return (
        <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.CENTRAL_OPERATIONS_MANAGER, UserRole.CENTRAL_STOREKEEPER]}>
            <BranchAwareDashboardLayout>
                <WarehouseDashboardContent />
            </BranchAwareDashboardLayout>
        </ProtectedRoute>
    );
}

function WarehouseDashboardContent() {
    const [stats, setStats] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            const response = await centralOperationsAPI.getWarehouseDashboard();
            if (response.success) {
                setStats(response.data);
            } else {
                toast.error(response.message || 'Failed to fetch dashboard data');
            }
        } catch (error) {
            console.error('Error fetching warehouse dashboard:', error);
            toast.error('Failed to load dashboard data');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Warehouse Dashboard</h1>
                    <p className="text-gray-500">Overview of central inventory and logistics</p>
                </div>
                <IOSButton
                    variant="secondary"
                    leftIcon={<RefreshCw className="h-4 w-4" />}
                    onClick={fetchDashboardData}
                >
                    Refresh
                </IOSButton>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Inventory Items"
                    value={stats?.inventory?.total_items || 0}
                    icon={<Package className="h-6 w-6 text-blue-600" />}
                    description="Unique SKUs in stock"
                    color="blue"
                />
                <StatCard
                    title="Low Stock Alerts"
                    value={stats?.inventory?.low_stock_items || 0}
                    icon={<AlertTriangle className="h-6 w-6 text-amber-600" />}
                    description="Items below reorder level"
                    color="amber"
                    trend={stats?.inventory?.low_stock_items > 0 ? 'up' : 'none'}
                />
                <StatCard
                    title="Pending Requests"
                    value={stats?.requests?.pending_requests || 0}
                    icon={<ClipboardList className="h-6 w-6 text-purple-600" />}
                    description="Awaiting review"
                    color="purple"
                />
                <StatCard
                    title="Active Dispatches"
                    value={stats?.dispatches?.in_transit_dispatches || 0}
                    icon={<Truck className="h-6 w-6 text-green-600" />}
                    description="Currently in transit"
                    color="green"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity */}
                <IOSCard className="lg:col-span-2 overflow-hidden">
                    <div className="p-4 border-b flex justify-between items-center">
                        <h2 className="font-semibold text-gray-800">Recent Activity</h2>
                        <Link href="/dashboard/central-operations/warehouse/transfers?status=pending">
                            <span className="text-sm text-blue-600 hover:underline flex items-center">
                                View All <ChevronRight className="h-4 w-4" />
                            </span>
                        </Link>
                    </div>
                    <div className="divide-y">
                        {stats?.recentActivity?.length > 0 ? (
                            stats.recentActivity.map((activity: any, index: number) => (
                                <ActivityItem key={index} activity={activity} />
                            ))
                        ) : (
                            <div className="p-8 text-center text-gray-500">No recent activity</div>
                        )}
                    </div>
                </IOSCard>

                {/* Top Requested Items */}
                <IOSCard>
                    <div className="p-4 border-b">
                        <h2 className="font-semibold text-gray-800">Top Requested Items</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        {stats?.topItems?.length > 0 ? (
                            stats.topItems.map((item: any, index: number) => (
                                <div key={index} className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-600">
                                            {index + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{item.item_name}</p>
                                            <p className="text-xs text-gray-500">{item.item_sku}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-gray-900">{item.total_requested}</p>
                                        <p className="text-xs text-gray-500">units</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-8 text-center text-gray-500 text-sm">No request data available</div>
                        )}
                    </div>
                    <div className="p-4 bg-gray-50 border-t">
                        <Link href="/dashboard/central-operations/warehouse/inventory">
                            <IOSButton variant="ghost" size="sm" fullWidth>
                                Manage Inventory
                            </IOSButton>
                        </Link>
                    </div>
                </IOSCard>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <QuickActionCard
                    title="Review Requests"
                    description="Approve or reject branch stock requests"
                    icon={<ClipboardList className="h-5 w-5" />}
                    href="/dashboard/central-operations/warehouse/transfers?status=pending"
                    color="blue"
                />
                <QuickActionCard
                    title="Manage Dispatches"
                    description="Track and confirm item deliveries"
                    icon={<Truck className="h-5 w-5" />}
                    href="/dashboard/central-operations/warehouse/dispatches"
                    color="green"
                />
                <QuickActionCard
                    title="Purchase Orders"
                    description="Restock warehouse from suppliers"
                    icon={<Package className="h-5 w-5" />}
                    href="/dashboard/central-operations/warehouse/purchase-orders"
                    color="purple"
                />
            </div>
        </div>
    );
}

function StatCard({ title, value, icon, description, color, trend }: any) {
    const colorClasses: any = {
        blue: 'bg-blue-50 text-blue-600',
        amber: 'bg-amber-50 text-amber-600',
        purple: 'bg-purple-50 text-purple-600',
        green: 'bg-green-50 text-green-600',
    };

    return (
        <IOSCard className="p-4">
            <div className="flex justify-between items-start">
                <div className={`p-2 rounded-xl ${colorClasses[color]}`}>
                    {icon}
                </div>
                {trend === 'up' && (
                    <div className="flex items-center text-red-500 text-xs font-medium">
                        <ArrowUpRight className="h-3 w-3 mr-1" />
                        High
                    </div>
                )}
            </div>
            <div className="mt-4">
                <p className="text-sm text-gray-500">{title}</p>
                <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
                <p className="text-xs text-gray-400 mt-1">{description}</p>
            </div>
        </IOSCard>
    );
}

function ActivityItem({ activity }: any) {
    const isRequest = activity.type === 'REQUEST';

    return (
        <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
            <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-full ${isRequest ? 'bg-purple-50 text-purple-600' : 'bg-green-50 text-green-600'}`}>
                    {isRequest ? <ClipboardList className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                </div>
                <div>
                    <p className="text-sm font-medium text-gray-900">
                        {isRequest ? 'New Stock Request' : 'Items Dispatched'}
                    </p>
                    <p className="text-xs text-gray-500">
                        {activity.reference} • {format(new Date(activity.created_at), 'MMM d, h:mm a')}
                    </p>
                </div>
            </div>
            <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${activity.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                    activity.status === 'APPROVED' || activity.status === 'DELIVERED' ? 'bg-green-100 text-green-700' :
                        activity.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                    }`}>
                    {activity.status}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-300" />
            </div>
        </div>
    );
}

function QuickActionCard({ title, description, icon, href, color }: any) {
    const colorClasses: any = {
        blue: 'text-blue-600 group-hover:bg-blue-600',
        green: 'text-green-600 group-hover:bg-green-600',
        purple: 'text-purple-600 group-hover:bg-purple-600',
    };

    return (
        <Link href={href} className="group">
            <IOSCard className="p-4 h-full hover:shadow-md transition-shadow border-transparent hover:border-gray-200">
                <div className="flex items-center space-x-4">
                    <div className={`p-3 rounded-xl bg-gray-50 ${colorClasses[color]} group-hover:text-white transition-colors`}>
                        {icon}
                    </div>
                    <div>
                        <h3 className="font-semibold text-gray-900">{title}</h3>
                        <p className="text-xs text-gray-500">{description}</p>
                    </div>
                </div>
            </IOSCard>
        </Link>
    );
}

function RefreshCw(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
        </svg>
    );
}
