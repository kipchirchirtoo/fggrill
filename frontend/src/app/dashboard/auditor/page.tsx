'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield, RefreshCw, FileText, AlertTriangle, CheckCircle,
    Clock, ClipboardList, BarChart3, Package, Search,
    User, Eye, Filter, Download, Plus,
    XCircle, ArrowLeft, DollarSign, TrendingUp,
    ArrowUpRight, ArrowDownRight, Flag, Target, Activity, Scale,
    ShoppingBag, Users, Truck, Briefcase, FileCheck
} from 'lucide-react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { auditAPI, restaurantAPI, storeAPI, payrollAPI } from '@/lib/api';
import { toast } from 'sonner';
import { useSearchParams, useRouter } from 'next/navigation';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { motion, AnimatePresence } from 'framer-motion';

// --- Sub-components Migration ---

// 1. Overview Tab
const OverviewTab = ({ stats, fetchData, isLoading }: { stats: any, fetchData: () => void, isLoading: boolean }) => (
    <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
                { label: 'Total Audits', value: stats.totalAudits, icon: ClipboardList, color: 'text-blue-600' },
                { label: 'Pending Reviews', value: stats.pendingReviews, icon: Clock, color: 'text-amber-600' },
                { label: 'Compliance Score', value: `${stats.complianceScore}%`, icon: CheckCircle, color: 'text-emerald-600' },
                { label: 'High Findings', value: stats.recentFindings, icon: AlertTriangle, color: 'text-rose-600' },
            ].map((stat, i) => (
                <IOSCard key={i} className="p-5 flex flex-col gap-2">
                    <div className={`p-2 w-fit rounded-ios-lg bg-stone-100 ${stat.color}`}>
                        <stat.icon className="h-5 w-5" />
                    </div>
                    <p className="text-2xl font-bold text-stone-900">{stat.value}</p>
                    <p className="text-xs text-stone-500 font-medium uppercase tracking-wider">{stat.label}</p>
                </IOSCard>
            ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <IOSCard className="md:col-span-2 p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg font-bold text-stone-900 font-sf-pro-display">Compliance Health Index</h2>
                    <IOSBadge className="bg-emerald-100 text-emerald-700">Stable</IOSBadge>
                </div>
                <div className="h-4 bg-stone-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-stone-900 rounded-full transition-all duration-700 ease-out"
                        style={{ width: `${stats.complianceScore}%` }}
                    />
                </div>
                <div className="flex items-center justify-between mt-3">
                    <p className="text-sm text-stone-500 font-medium">System-wide control adherence</p>
                    <p className="text-lg font-bold text-stone-900">{stats.complianceScore}%</p>
                </div>
            </IOSCard>

            <IOSCard className="p-6">
                <h2 className="text-lg font-bold text-stone-900 mb-4 font-sf-pro-display">Audit Quick Actions</h2>
                <div className="grid grid-cols-1 gap-3">
                    <IOSButton className="w-full justify-start" variant="secondary" leftIcon={<Plus />}>New Exception Log</IOSButton>
                    <IOSButton className="w-full justify-start" variant="secondary" leftIcon={<FileCheck />}>Verify Shift Sales</IOSButton>
                    <IOSButton className="w-full justify-start" variant="secondary" leftIcon={<RefreshCw />}>Recalculate Stock</IOSButton>
                </div>
            </IOSCard>
        </div>

        <IOSCard className="p-6">
            <h2 className="text-lg font-bold text-stone-900 mb-4 font-sf-pro-display">Risk Map</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <RiskCard title="Voided Orders" value="12" risk="high" />
                <RiskCard title="Unconfirmed Deliveries" value="5" risk="medium" />
                <RiskCard title="Payroll Variances" value="0" risk="low" />
            </div>
        </IOSCard>
    </div>
);

const RiskCard = ({ title, value, risk }: { title: string, value: string, risk: 'high' | 'medium' | 'low' }) => {
    const colors = {
        high: 'bg-rose-50 text-rose-700 border-rose-100',
        medium: 'bg-amber-50 text-amber-700 border-amber-100',
        low: 'bg-emerald-50 text-emerald-700 border-emerald-100'
    };
    return (
        <div className={`p-4 rounded-ios-xl border ${colors[risk]} flex items-center justify-between`}>
            <div>
                <p className="text-xs font-bold uppercase tracking-wider">{title}</p>
                <p className="text-xl font-bold mt-1">{value}</p>
            </div>
            <AlertTriangle className="h-5 w-5 opacity-40" />
        </div>
    );
};

// 2. Sales Audit Tab
const SalesAuditTab = () => {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchSalesData = async () => {
        setIsLoading(true);
        try {
            const res = await restaurantAPI.getOrders({ limit: 20 });
            if (res.success) setOrders(res.data || []);
        } catch (e) { toast.error("Failed to fetch sales data"); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchSalesData(); }, []);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <IOSCard className="p-5 border-l-4 border-emerald-500">
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Expected Revenue</p>
                    <p className="text-2xl font-bold mt-1">KES 142,500</p>
                </IOSCard>
                <IOSCard className="p-5 border-l-4 border-blue-500">
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Reported Deposits</p>
                    <p className="text-2xl font-bold mt-1">KES 140,000</p>
                </IOSCard>
                <IOSCard className="p-5 border-l-4 border-rose-500 bg-rose-50/30">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Variance</p>
                            <p className="text-2xl font-bold mt-1 text-rose-600">-KES 2,500</p>
                        </div>
                        <AlertTriangle className="h-5 w-5 text-rose-500" />
                    </div>
                </IOSCard>
            </div>

            <IOSCard className="overflow-hidden">
                <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                    <h3 className="font-bold text-stone-900">Recent Flagged Transactions</h3>
                    <div className="flex gap-2">
                        <IOSButton size="sm" variant="secondary" leftIcon={<Filter />}>Filter</IOSButton>
                        <IOSButton size="sm" variant="secondary" leftIcon={<Download />}>Export</IOSButton>
                    </div>
                </div>
                <div className="divide-y divide-stone-100">
                    {orders.filter((o: any) => o.status === 'cancelled' || o.total > 5000).map((order) => (
                        <div key={order.id} className="p-4 hover:bg-stone-50 transition-colors flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className={`p-2 rounded-full ${order.status === 'cancelled' ? 'bg-rose-100 text-rose-600' : 'bg-stone-100 text-stone-600'}`}>
                                    <ShoppingBag className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="font-bold text-stone-900">{order.order_number}</p>
                                    <p className="text-xs text-stone-500">{order.guest_name} • {new Date(order.created_at).toLocaleTimeString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-6">
                                <div className="text-right">
                                    <p className="font-bold text-stone-900">KES {order.total.toLocaleString()}</p>
                                    <p className={`text-[10px] font-bold uppercase ${order.status === 'cancelled' ? 'text-rose-500' : 'text-emerald-500'}`}>{order.status}</p>
                                </div>
                                <IOSButton variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">Investigate</IOSButton>
                            </div>
                        </div>
                    ))}
                </div>
            </IOSCard>
        </div>
    );
};

// 3. Stock Audit Tab
const StockAuditTab = () => {
    const [stockItems, setStockItems] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchStockData = async () => {
        setIsLoading(true);
        try {
            const res = await storeAPI.getBranchStock();
            if (res.success) setStockItems(res.data || []);
        } catch (e) { toast.error("Failed to fetch stock data"); }
        finally { setIsLoading(false); }
    };

    useEffect(() => { fetchStockData(); }, []);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <IOSCard className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <Package className="h-5 w-5 text-stone-400" />
                        <h3 className="font-bold text-stone-900">Items Sold vs Stock Depleted</h3>
                    </div>
                    <div className="space-y-4">
                        <ComparisonRow label="Castle Lite 500ml" sold={24} stockOut={26} variance={-2} />
                        <ComparisonRow label="Prime Cut Steak" sold={12} stockOut={15} variance={-3} />
                        <ComparisonRow label="White Cap 500ml" sold={45} stockOut={45} variance={0} />
                    </div>
                    <IOSButton variant="secondary" className="w-full mt-6" leftIcon={<RefreshCw />}>Run Consumption Match</IOSButton>
                </IOSCard>

                <IOSCard className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <ClipboardList className="h-5 w-5 text-stone-400" />
                        <h3 className="font-bold text-stone-900">Pending Stock Requisitions</h3>
                    </div>
                    <div className="space-y-4">
                        <RequisitionItem branch="Kapsoit" items={12} date="Today" status="urgent" />
                        <RequisitionItem branch="Bomet HQ" items={45} date="Yesterday" status="normal" />
                    </div>
                </IOSCard>
            </div>

            <IOSCard className="p-6">
                <h3 className="font-bold text-stone-900 mb-4">Stock Levels & Variances</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] tracking-widest">
                            <tr>
                                <th className="px-4 py-3">Item Name</th>
                                <th className="px-4 py-3">Opening</th>
                                <th className="px-4 py-3">Received</th>
                                <th className="px-4 py-3">Expected (Sales)</th>
                                <th className="px-4 py-3">Closing</th>
                                <th className="px-4 py-3 text-right">Variance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {stockItems.slice(0, 5).map((item, i) => (
                                <tr key={i} className="hover:bg-stone-50 transition-colors">
                                    <td className="px-4 py-3 font-bold text-stone-900">{item.item_name}</td>
                                    <td className="px-4 py-3">100</td>
                                    <td className="px-4 py-3">20</td>
                                    <td className="px-4 py-3 text-stone-500">85</td>
                                    <td className="px-4 py-3">{item.quantity}</td>
                                    <td className="px-4 py-3 text-right font-bold text-rose-600">-1.5</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </IOSCard>
        </div>
    );
};

const ComparisonRow = ({ label, sold, stockOut, variance }: any) => (
    <div className="flex items-center justify-between p-3 bg-stone-50 rounded-ios-lg">
        <div>
            <p className="text-sm font-bold text-stone-900">{label}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-widest">Sold: {sold} | Out: {stockOut}</p>
        </div>
        <div className={`px-2 py-1 rounded text-xs font-bold ${variance < 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
            {variance > 0 ? '+' : ''}{variance}
        </div>
    </div>
);

const RequisitionItem = ({ branch, items, date, status }: any) => (
    <div className="flex items-center justify-between p-4 border border-stone-100 rounded-ios-xl hover:border-stone-900 transition-colors group">
        <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${status === 'urgent' ? 'bg-rose-500 animate-pulse' : 'bg-blue-500'}`} />
            <div>
                <p className="font-bold text-stone-900">{branch} Branch</p>
                <p className="text-xs text-stone-500">{items} items requested • {date}</p>
            </div>
        </div>
        <IOSButton size="sm" variant="secondary" className="opacity-0 group-hover:opacity-100">Review</IOSButton>
    </div>
);

// 4. Payroll & HR Audit Tab
const PayrollAuditTab = () => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <IOSCard className="p-6">
                    <h3 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
                        <Users className="h-5 w-5 text-blue-500" />
                        Employee Credit Limits
                    </h3>
                    <div className="space-y-3">
                        <CreditRow name="John Doe" used={1500} limit={5000} />
                        <CreditRow name="Jane Smith" used={4800} limit={5000} />
                        <CreditRow name="Alex Johnson" used={200} limit={5000} />
                    </div>
                </IOSCard>

                <IOSCard className="p-6">
                    <h3 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-amber-500" />
                        Pay Period Variances
                    </h3>
                    <div className="space-y-4">
                        <div className="p-4 bg-rose-50 border border-rose-100 rounded-ios-xl">
                            <div className="flex items-center gap-2 text-rose-700 mb-2">
                                <AlertTriangle className="h-4 w-4" />
                                <span className="text-xs font-bold uppercase tracking-widest">Abnormal Overtime</span>
                            </div>
                            <p className="text-sm font-medium text-stone-900">5 employees in Kitchen Dept exceed 40hrs OT this month.</p>
                            <button className="text-[11px] font-bold text-rose-600 mt-2 hover:underline">View Breakdown</button>
                        </div>
                    </div>
                </IOSCard>
            </div>

            <IOSCard className="p-6">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-stone-900">Payroll Review Ledger</h3>
                    <IOSButton variant="secondary" leftIcon={<Filter />}>Filter Period</IOSButton>
                </div>
                <div className="space-y-4">
                    <PayrollReviewItem employee="David Otieno" basic={45000} net={52000} variance="+7,000" reason="Bonus + OT" status="pending" />
                    <PayrollReviewItem employee="Mary Wanjiku" basic={38000} net={38000} variance="0" reason="Matched" status="approved" />
                </div>
            </IOSCard>
        </div>
    );
};

const CreditRow = ({ name, used, limit }: any) => {
    const percent = (used / limit) * 100;
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-stone-700">{name}</span>
                <span className="font-bold text-stone-900">KES {used} / {limit}</span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${percent > 80 ? 'bg-rose-500' : 'bg-stone-900'}`} style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
};

const PayrollReviewItem = ({ employee, basic, net, variance, reason, status }: any) => (
    <div className="p-4 border border-stone-100 rounded-ios-xl flex items-center justify-between group hover:bg-stone-50 transition-colors">
        <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center font-bold text-stone-400">
                {employee[0]}
            </div>
            <div>
                <p className="font-bold text-stone-900">{employee}</p>
                <p className="text-xs text-stone-500">Basis: KES {basic.toLocaleString()} • Net: KES {net.toLocaleString()}</p>
            </div>
        </div>
        <div className="flex items-center gap-6">
            <div className="text-right">
                <p className={`font-bold ${variance === '0' ? 'text-stone-400' : 'text-amber-600'}`}>{variance}</p>
                <p className="text-[10px] text-stone-500 uppercase">{reason}</p>
            </div>
            {status === 'pending' ? (
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <IOSButton size="sm" variant="ghost" className="text-rose-600">Flag</IOSButton>
                    <IOSButton size="sm" variant="secondary">Approve</IOSButton>
                </div>
            ) : (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
            )}
        </div>
    </div>
);

// 5. Supplier Audit Tab
const SupplierAuditTab = () => {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <IOSCard className="p-6 md:col-span-2">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-bold text-stone-900">Supplier Price Tracker</h3>
                        <IOSBadge className="bg-amber-100 text-amber-700">3 Price Hikes Detected</IOSBadge>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-[10px] font-bold text-stone-400 uppercase tracking-widest border-b border-stone-100">
                                <tr>
                                    <th className="pb-4 text-left">Item</th>
                                    <th className="pb-4 text-left">Current Supplier</th>
                                    <th className="pb-4 text-right">Last Price</th>
                                    <th className="pb-4 text-right">Trend</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                                <PriceTrendRow item="Tomato (Box)" supplier="Main Mart" price="2,500" trend="up" percent="12%" />
                                <PriceTrendRow item="Cooking Oil (20L)" supplier="Fresh Wholesalers" price="4,200" trend="stable" percent="0%" />
                                <PriceTrendRow item="Chicken Breast (Kg)" supplier="Poultry Hub" price="650" trend="up" percent="5%" />
                            </tbody>
                        </table>
                    </div>
                </IOSCard>

                <IOSCard className="p-6">
                    <h3 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
                        <Truck className="h-5 w-5 text-stone-400" />
                        Delivery Discrepancies
                    </h3>
                    <div className="space-y-4">
                        <DiscrepancyItem supplier="Main Mart" date="Jan 04" diff="-2 Boxes" status="open" />
                        <DiscrepancyItem supplier="Poultry Hub" date="Jan 02" diff="-5 Kg" status="resolved" />
                    </div>
                </IOSCard>
            </div>
        </div>
    );
};

const PriceTrendRow = ({ item, supplier, price, trend, percent }: any) => (
    <tr className="group">
        <td className="py-4">
            <p className="font-bold text-stone-900">{item}</p>
        </td>
        <td className="py-4 text-stone-500">{supplier}</td>
        <td className="py-4 text-right font-mono font-bold">KES {price}</td>
        <td className="py-4 text-right">
            <div className={`flex items-center justify-end gap-1 ${trend === 'up' ? 'text-rose-600' : 'text-emerald-600'}`}>
                {trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                <span className="text-xs font-bold">{percent}</span>
            </div>
        </td>
    </tr>
);

const DiscrepancyItem = ({ supplier, date, diff, status }: any) => (
    <div className="p-3 border border-stone-100 rounded-ios-lg">
        <div className="flex justify-between items-start mb-1">
            <span className="text-xs font-bold text-stone-900">{supplier}</span>
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${status === 'open' ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-stone-500'}`}>{status}</span>
        </div>
        <p className="text-xs text-stone-500">{date} • Shortage: <span className="font-bold text-rose-600">{diff}</span></p>
    </div>
);

// --- Main Dashboard Component ---

export default function AuditorDashboard() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState('overview');
    const [isLoading, setIsLoading] = useState(true);
    const [logs, setLogs] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalAudits: 0, pendingReviews: 0, complianceScore: 92, recentFindings: 0 });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await auditAPI.getAuditLogs();
            if (res.success) {
                const data = res.data || [];
                setLogs(data);
                setStats(prev => ({
                    ...prev,
                    totalAudits: data.length,
                    pendingReviews: 5, // Mocking for now based on UI requirements
                    recentFindings: data.filter((l: any) => l.severity === 'high').length,
                }));
            }
        } catch (e) {
            console.error("Auditor fetch failed:", e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const tab = searchParams.get('tab');
        if (tab && ['overview', 'sales', 'stock', 'payroll', 'suppliers', 'compliance', 'logs'].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams, fetchData]);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', tab);
        router.push(`/dashboard/auditor?${params.toString()}`);
    };

    const tabs = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'sales', label: 'Sales Audit', icon: DollarSign },
        { id: 'stock', label: 'Stock Audit', icon: Package },
        { id: 'payroll', label: 'Payroll & HR', icon: Users },
        { id: 'suppliers', label: 'Suppliers', icon: Truck },
        { id: 'compliance', label: 'Compliance', icon: Shield },
        { id: 'logs', label: 'Activity Logs', icon: ClipboardList },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <div className="min-h-screen bg-stone-50 p-6 space-y-8 max-w-[1600px] mx-auto">
                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-3xl font-bold text-stone-900 tracking-tight font-sf-pro-display">Internal Audit Control</h1>
                            <p className="text-stone-500 font-medium">Ensuring data consistency, operational integrity and financial health</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="hidden lg:flex flex-col items-end mr-2">
                                <span className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Auditor Access</span>
                                <span className="text-xs font-bold text-stone-900 bg-amber-100 px-2 py-0.5 rounded-full">Secure Session</span>
                            </div>
                            <IOSButton variant="secondary" onClick={fetchData} disabled={isLoading} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                                {isLoading ? 'Refreshing...' : 'Refresh Data'}
                            </IOSButton>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-1 p-1 bg-stone-200/50 rounded-2xl w-fit backdrop-blur-sm sticky top-6 z-10 shadow-sm overflow-x-auto no-scrollbar max-w-full">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === tab.id
                                    ? 'bg-stone-900 text-white shadow-lg scale-[1.02]'
                                    : 'text-stone-600 hover:bg-stone-200/50 hover:text-stone-900'
                                    }`}
                            >
                                <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-white' : 'text-stone-400'}`} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Panels with Layout Animation */}
                    <div className="min-h-[600px]">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                            >
                                {activeTab === 'overview' && <OverviewTab stats={stats} fetchData={fetchData} isLoading={isLoading} />}
                                {activeTab === 'sales' && <SalesAuditTab />}
                                {activeTab === 'stock' && <StockAuditTab />}
                                {activeTab === 'payroll' && <PayrollAuditTab />}
                                {activeTab === 'suppliers' && <SupplierAuditTab />}
                                {activeTab === 'compliance' && <ComplianceTabPlaceholder />}
                                {activeTab === 'logs' && <LogsTabPlaceholder logs={logs} isLoading={isLoading} fetchData={fetchData} />}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}

// Placeholder for items not yet fully detailed in this iteration but kept for structure
const ComplianceTabPlaceholder = () => (
    <IOSCard className="p-12 text-center text-stone-400 italic">
        <Shield className="h-12 w-12 mx-auto mb-4 opacity-20" />
        Compliance monitoring and policy enforcement module.
    </IOSCard>
);

const LogsTabPlaceholder = ({ logs, isLoading, fetchData }: any) => (
    <IOSCard className="p-12 text-center text-stone-400 italic">
        <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-20" />
        System activity logs and audit trail.
    </IOSCard>
);
