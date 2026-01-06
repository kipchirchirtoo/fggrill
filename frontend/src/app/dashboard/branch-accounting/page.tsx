'use client';

import React, { useState, useEffect } from 'react';
import {
    PieChart, Box, FileText, CheckCircle2,
    Calendar, Download, Receipt, BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSearchParams } from 'next/navigation';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { storeAPI, financeAPI } from '@/lib/api';
import { toast } from 'sonner';
import { OverviewTab } from '@/components/finance/OverviewTab';
import { InventoryTab } from '@/components/finance/InventoryTab';
import { BillingTab } from '@/components/finance/BillingTab';
import { PaymentsTab } from '@/components/finance/PaymentsTab';
import { ExpensesTab } from '@/components/finance/ExpensesTab';
import { ReportsTab } from '@/components/finance/ReportsTab';
import { AccountingTab } from '@/components/finance/AccountingTab';
import { NewStockTakeModal } from '@/components/finance/NewStockTakeModal';
import { TrendingUp } from 'lucide-react';

// --- Main Page Component ---

export default function BranchAccountingDashboard() {
    const { activeBranchId } = useBranch();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<'overview' | 'inventory' | 'billing' | 'payments' | 'expenses' | 'reports' | 'accounting'>('overview');
    const [dateRange, setDateRange] = useState('Today');
    const [isLoading, setIsLoading] = useState(true);
    const [stockTakes, setStockTakes] = useState<any[]>([]);
    const [isStockModalOpen, setIsStockModalOpen] = useState(false);

    // Initial tab from URL
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['overview', 'inventory', 'billing', 'payments', 'expenses', 'reports', 'accounting'].includes(tab)) {
            setActiveTab(tab as any);
        }
    }, [searchParams]);

    const [branchStock, setBranchStock] = useState<any[]>([]);
    const [invoices, setInvoices] = useState<any[]>([]);

    // Fetch data
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [takesRes, stockRes, invoicesRes] = await Promise.all([
                storeAPI.getStockTakes(),
                activeBranchId ? storeAPI.getBranchStock(Number(activeBranchId)) : Promise.resolve({ data: [] }),
                activeBranchId ? financeAPI.getInvoices({ branch_id: Number(activeBranchId) }) : Promise.resolve({ data: [] })
            ]);

            // Filter by branch if activeBranchId is present
            let takes = takesRes.data || [];
            if (activeBranchId) {
                takes = takes.filter((t: any) => t.branch_id === activeBranchId);
            }
            setStockTakes(takes);
            setBranchStock(stockRes.data || []);
            setInvoices(invoicesRes.data || []);
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
    const stats = [
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
                        <div className="flex border-b border-stone-200 overflow-x-auto">
                            {[
                                { id: 'overview', label: 'Overview', icon: PieChart },
                                { id: 'inventory', label: 'Stock Taking', icon: Box },
                                { id: 'billing', label: 'Billing & Credit', icon: FileText },
                                { id: 'payments', label: 'Payments', icon: CheckCircle2 },
                                { id: 'expenses', label: 'Expenses', icon: Receipt },
                                { id: 'reports', label: 'Reports', icon: FileText },
                                { id: 'accounting', label: 'Accounting', icon: BookOpen },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-all relative whitespace-nowrap ${activeTab === tab.id
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
                            {activeTab === 'billing' && <BillingTab invoices={invoices} />}
                            {activeTab === 'payments' && <PaymentsTab />}
                            {activeTab === 'expenses' && <ExpensesTab />}
                            {activeTab === 'reports' && <ReportsTab />}
                            {activeTab === 'accounting' && <AccountingTab />}
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
