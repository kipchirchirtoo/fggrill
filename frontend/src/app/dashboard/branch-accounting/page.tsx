'use client';

import React, { useState, useEffect } from 'react';
import {
    DollarSign, TrendingUp, Receipt, FileText,
    FileSpreadsheet, PieChart, ArrowUpRight, ArrowDownRight,
    TrendingDown, Calendar, Filter, Download, Plus,
    Box, ClipboardList, CheckCircle2, History, Search,
    Scan, CreditCard, Banknote, AlertCircle, Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { useSearchParams } from 'next/navigation';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI, financeAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// --- Sub-components moved outside for better type safety and structure ---

const NewStockTakeModal = ({ isOpen, onClose, onSubmit }: { isOpen: boolean, onClose: () => void, onSubmit: (data: any) => void }) => {
    const [takeType, setTakeType] = useState('FULL');
    const [notes, setNotes] = useState('');

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Start New Stock Take</DialogTitle>
                    <DialogDescription>
                        Initialize a new inventory verification session for this branch.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="type">Take Type</Label>
                        <Select value={takeType} onValueChange={setTakeType}>
                            <SelectTrigger id="type">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="FULL">Full Inventory</SelectItem>
                                <SelectItem value="PARTIAL">Partial/Cyclic</SelectItem>
                                <SelectItem value="SPOT_CHECK">Spot Check</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="notes">Notes (Optional)</Label>
                        <Textarea
                            id="notes"
                            placeholder="Add any instructions or context..."
                            value={notes}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={() => onSubmit({ take_type: takeType, notes })} className="bg-stone-900 text-white">Start Session</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

interface StatItem {
    label: string;
    value: string;
    icon: React.ElementType;
    change: string;
    trend: 'up' | 'down' | 'neutral';
    color: string;
}

interface ChartDataPoint {
    name: string;
    revenue: number;
    expenses: number;
}

const OverviewTab = ({ stats, chartData }: { stats: StatItem[], chartData: ChartDataPoint[] }) => (
    <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat, index) => (
                <Card key={index} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className={`p-2 rounded-xl bg-stone-100 ${stat.color}`}>
                                <stat.icon className="h-5 w-5" />
                            </div>
                            <Badge variant="secondary" className={
                                stat.trend === 'up' ? 'bg-emerald-50 text-emerald-700 border-none shadow-none' :
                                    stat.trend === 'down' ? 'bg-rose-50 text-rose-700 border-none shadow-none' :
                                        'bg-blue-50 text-blue-700 border-none shadow-none'
                            }>
                                {stat.change}
                            </Badge>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-stone-500">{stat.label}</p>
                            <p className="text-2xl font-bold text-stone-900 mt-1">{stat.value}</p>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chart Section */}
            <Card className="lg:col-span-2 border-none shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-bold">Revenue vs Expenses</CardTitle>
                        <CardDescription>Daily financial performance trend</CardDescription>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span>Revenue</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                            <span>Expenses</span>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f5f5f5" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: '#888' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: '#888' }}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" />
                                <Area type="monotone" dataKey="expenses" stroke="#d1d5db" strokeWidth={2} fill="transparent" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="border-none shadow-sm h-full">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-3">
                        {[
                            { label: 'Daily Report', icon: FileSpreadsheet, sub: 'Generate daily branch report' },
                            { label: 'Log Expense', icon: Receipt, sub: 'Record new branch expense' },
                            { label: 'Petty Cash', icon: DollarSign, sub: 'Manage branch petty cash' },
                            { label: 'Tax Filing', icon: FileText, sub: 'Branch tax documentation' },
                        ].map((action, idx) => (
                            <button key={idx} className="p-4 rounded-xl bg-white border border-stone-100 hover:border-stone-900 hover:shadow-sm transition-all text-left flex flex-col gap-2 group">
                                <div className="p-2 rounded-lg bg-stone-50 group-hover:bg-stone-900 group-hover:text-white transition-colors w-fit">
                                    <action.icon className="h-4 w-4" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-stone-900">{action.label}</p>
                                    <p className="text-[11px] text-stone-500">{action.sub}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
);

const InventoryTab = ({ stockTakes, onNew }: { stockTakes: any[], onNew: () => void }) => (
    <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-lg font-bold">Branch Stock Taking</CardTitle>
                <CardDescription>Record and verify physical stock levels</CardDescription>
            </div>
            <IOSButton size="sm" className="bg-stone-900 text-white" leftIcon={<Plus />} onClick={onNew}>New Stock Take</IOSButton>
        </CardHeader>
        <CardContent>
            {stockTakes.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-stone-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Date</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Notes</th>
                                <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {stockTakes.map((take) => (
                                <tr key={take.id} className="hover:bg-stone-50 transition-colors">
                                    <td className="px-4 py-4 text-sm text-stone-900">{new Date(take.created_at).toLocaleDateString()}</td>
                                    <td className="px-4 py-4 text-sm text-stone-900 capitalize">{take.take_type?.toLowerCase()}</td>
                                    <td className="px-4 py-4">
                                        <IOSBadge className={take.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}>
                                            {take.status}
                                        </IOSBadge>
                                    </td>
                                    <td className="px-4 py-4 text-sm text-stone-500 truncate max-w-xs">{take.notes || '-'}</td>
                                    <td className="px-4 py-4 text-right">
                                        <Button variant="ghost" size="sm" onClick={() => { }}>
                                            {take.status === 'OPEN' ? 'Continue' : 'View'}
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="text-center py-12 text-stone-500">
                    <Box className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>No active stock take sessions found.</p>
                    <p className="text-xs mt-1">Start a new session to record physical counts.</p>
                </div>
            )}
        </CardContent>
    </Card>
);

const BillingTab = () => (
    <Card className="border-none shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle className="text-lg font-bold">Invoices & Credit Bills</CardTitle>
                <CardDescription>Manage outstanding payments and customer credit</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm">All</Button>
                <Button variant="outline" size="sm">Pending</Button>
                <Button variant="outline" size="sm">Credit</Button>
            </div>
        </CardHeader>
        <CardContent>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-stone-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Invoice #</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Customer</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Amount</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-stone-500 uppercase tracking-wider">Date</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-stone-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {[1, 2, 3].map((i) => (
                            <tr key={i} className="hover:bg-stone-50 transition-colors">
                                <td className="px-4 py-4 text-sm font-mono text-stone-600">INV-2024-00{i}</td>
                                <td className="px-4 py-4 text-sm font-bold text-stone-900">Guest User {i}</td>
                                <td className="px-4 py-4 text-sm font-bold text-stone-900 text-emerald-600">KES {(4500 * i).toLocaleString()}</td>
                                <td className="px-4 py-4">
                                    <IOSBadge className={i === 2 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}>
                                        {i === 2 ? "Credit" : "Paid"}
                                    </IOSBadge>
                                </td>
                                <td className="px-4 py-4 text-xs text-stone-500">2024-05-20</td>
                                <td className="px-4 py-4 text-right">
                                    <Button variant="ghost" size="sm">View</Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </CardContent>
    </Card>
);

const PaymentsTab = () => (
    <div className="space-y-6">
        <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-lg font-bold">Payment Verification Queue</CardTitle>
                    <CardDescription>Confirm M-Pesa and Banking payments pushed by cashiers</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <div className="divide-y divide-stone-100">
                    {[
                        { id: '1', type: 'mpesa', amount: 5400, ref: 'RCK1234567', cashier: 'Main Cashier', time: '10 mins ago' },
                        { id: '2', type: 'bank', amount: 12500, ref: 'BANK-TRANSFER-990', cashier: 'Resto Cashier', time: '25 mins ago' },
                    ].map((pmt) => (
                        <div key={pmt.id} className="py-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${pmt.type === 'mpesa' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {pmt.type === 'mpesa' ? <Scan className="h-5 w-5" /> : <Banknote className="h-5 w-5" />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-stone-900">{pmt.type.toUpperCase()} Payment - KES {pmt.amount.toLocaleString()}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-stone-500 font-mono">{pmt.ref}</span>
                                        <span className="text-[10px] text-stone-300">•</span>
                                        <span className="text-xs text-stone-500">{pmt.cashier}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-stone-400 flex items-center gap-1">
                                    <Clock className="h-3 w-3" /> {pmt.time}
                                </span>
                                <IOSButton size="sm" className="bg-stone-900 text-white">Confirm</IOSButton>
                                <Button variant="ghost" size="sm" className="text-rose-600">Reject</Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-none shadow-sm">
                <CardHeader>
                    <CardTitle className="text-sm font-bold">M-Pesa Till Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                            <span className="text-xs text-stone-500">Till #889900</span>
                            <span className="font-bold text-stone-900">KES 45,600</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                            <span className="text-xs text-stone-500">Till #112233</span>
                            <span className="font-bold text-stone-900">KES 12,400</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm">
                <CardHeader>
                    <CardTitle className="text-sm font-bold">Banking Summary</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                            <span className="text-xs text-stone-500">KCB Bank</span>
                            <span className="font-bold text-stone-900">KES 89,000</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-stone-50 rounded-lg">
                            <span className="text-xs text-stone-500">Equity Bank</span>
                            <span className="font-bold text-stone-900">KES 34,200</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    </div>
);

// --- Main Page Component ---

export default function BranchAccountingDashboard() {
    const { activeBranchId } = useBranch();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'billing' | 'payments'>('overview');
    const [dateRange, setDateRange] = useState('Today');
    const [isLoading, setIsLoading] = useState(true);
    const [stockTakes, setStockTakes] = useState<any[]>([]);
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);

    // Initial tab from URL
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['overview', 'inventory', 'billing', 'payments'].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);

    // Fetch data
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const takesRes = await storeAPI.getStockTakes();
            // Filter by branch if activeBranchId is present
            let takes = takesRes.data || [];
            if (activeBranchId) {
                takes = takes.filter((t: any) => t.branch_id === activeBranchId);
            }
            setStockTakes(takes);
        } catch (error) {
            console.error("Dashboard primary fetch failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activeBranchId]);

    const handleStartStockTake = async (data: any) => {
        if (!activeBranchId) {
            toast.error("Please select a branch first");
            return;
        }

        try {
            const res = await storeAPI.createStockTake({
                branch_id: Number(activeBranchId),
                take_type: data.take_type,
                notes: data.notes
            });
            if (res.success) {
                toast.success("Stock take session started");
                setIsStockModalOpen(false);
                fetchData();
            }
        } catch (error) {
            toast.error("Failed to start stock take");
        }
    };

    // Mock data for initial implementation
    const stats: StatItem[] = [
        { label: 'Total Revenue', value: 'KES 125,400', icon: TrendingUp, change: '+12.5%', trend: 'up' as const, color: 'text-emerald-600' },
        { label: 'Total Expenses', value: 'KES 45,200', icon: Receipt, change: '-4.3%', trend: 'down' as const, color: 'text-rose-600' },
        { label: 'Pending Invoices', value: '12', icon: FileText, change: '5 urgent', trend: 'neutral' as const, color: 'text-blue-600' },
        { label: 'Net Profit', value: 'KES 80,200', icon: PieChart, change: '+18.2%', trend: 'up' as const, color: 'text-amber-600' },
    ];

    const chartData = [
        { name: '08:00', revenue: 4200, expenses: 1200 },
        { name: '10:00', revenue: 15600, expenses: 4500 },
        { name: '12:00', revenue: 35800, expenses: 8900 },
        { name: '14:00', revenue: 28400, expenses: 6200 },
        { name: '16:00', revenue: 22100, expenses: 5100 },
        { name: '18:00', revenue: 19300, expenses: 4800 },
    ];

    return (
        <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
            <DashboardLayout>
                <>
                    <div className="p-6 space-y-6 bg-stone-50 min-h-screen max-w-[1600px] mx-auto">
                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Branch Accounting</h1>
                                <p className="text-stone-500 text-sm">Financial oversight and operational monitoring</p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" className="bg-white">
                                    <Calendar className="mr-2 h-4 w-4" />
                                    {dateRange}
                                </Button>
                                <Button size="sm" className="bg-stone-900 text-white hover:bg-stone-800">
                                    <Download className="mr-2 h-4 w-4" />
                                    Export
                                </Button>
                            </div>
                        </div>

                        {/* Integrated Tabs */}
                        <div className="flex border-b border-stone-200">
                            {[
                                { id: 'overview', label: 'Overview', icon: PieChart },
                                { id: 'inventory', label: 'Stock Taking', icon: Box },
                                { id: 'billing', label: 'Billing & Credit', icon: FileText },
                                { id: 'payments', label: 'Payment Confirmation', icon: CheckCircle2 },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative ${activeTab === tab.id
                                        ? 'text-stone-900'
                                        : 'text-stone-400 hover:text-stone-600'
                                        }`}
                                >
                                    <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? 'text-stone-900' : 'text-stone-400'}`} />
                                    {tab.label}
                                    {activeTab === tab.id && (
                                        <div className="absolute bottom-0 left-0 w-full h-0.5 bg-stone-900" />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Tab Panels */}
                        <div className="mt-6">
                            {activeTab === 'overview' && <OverviewTab stats={stats} chartData={chartData} />}
                            {activeTab === 'inventory' && <InventoryTab stockTakes={stockTakes} onNew={() => setIsStockModalOpen(true)} />}
                            {activeTab === 'billing' && <BillingTab />}
                            {activeTab === 'payments' && <PaymentsTab />}
                        </div>

                        <NewStockTakeModal
                            isOpen={isStockModalOpen}
                            onClose={() => setIsStockModalOpen(false)}
                            onSubmit={handleStartStockTake}
                        />
                    </div>
                </>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
