'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    CreditCard,
    Calendar,
    Download,
    RefreshCw,
    ArrowUpRight,
    ArrowDownLeft,
    PieChart,
    BarChart3
} from 'lucide-react';
import { financeAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function BranchFinancialsPage() {
    const [loading, setLoading] = useState(true);
    const [financialData, setFinancialData] = useState<any>(null);
    const [dateRange, setDateRange] = useState('this_month'); // today, this_week, this_month, this_year

    useEffect(() => {
        fetchFinancials();
    }, [dateRange]);

    const fetchFinancials = async () => {
        setLoading(true);
        try {
            const branchId = localStorage.getItem('activeBranchId');
            if (!branchId) {
                toast.error('Branch ID not found');
                return;
            }

            // Calculate start/end dates based on range
            const now = new Date();
            let startDate = new Date();
            let endDate = new Date();

            if (dateRange === 'today') {
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
            } else if (dateRange === 'this_week') {
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
                startDate = new Date(now.setDate(diff));
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date();
                endDate.setHours(23, 59, 59, 999);
            } else if (dateRange === 'this_month') {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                endDate.setHours(23, 59, 59, 999);
            } else if (dateRange === 'this_year') {
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
            }

            const response = await financeAPI.getFinancialOverview({
                branch_id: Number(branchId),
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            });

            if (response.success) {
                setFinancialData(response.data);
            } else {
                toast.error(response.message || 'Failed to fetch financial data');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error loading financials');
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0
        }).format(amount || 0);
    };

    if (loading && !financialData) {
        return (
            <div className="flex items-center justify-center p-8">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2">Loading financials...</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Branch Financials</h1>
                    <p className="text-muted-foreground">Consolidated view of payments, expenses, and cash flow.</p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        value={dateRange}
                        onChange={(e) => setDateRange(e.target.value)}
                    >
                        <option value="today">Today</option>
                        <option value="this_week">This Week</option>
                        <option value="this_month">This Month</option>
                        <option value="this_year">This Year</option>
                    </select>
                    <Button variant="outline" size="icon" onClick={fetchFinancials}>
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export
                    </Button>
                </div>
            </div>

            {/* Key Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(financialData?.totalRevenue)}</div>
                        <p className="text-xs text-muted-foreground">Sales & Income</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(financialData?.totalExpenses)}</div>
                        <p className="text-xs text-muted-foreground">Operational & Other</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
                        <DollarSign className={`h-4 w-4 ${financialData?.netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${financialData?.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(financialData?.netProfit)}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Margin: {Number(financialData?.profitMargin || 0).toFixed(1)}%
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pending Payments</CardTitle>
                        <CreditCard className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(financialData?.pendingPayments)}</div>
                        <p className="text-xs text-muted-foreground">Uncollected Revenue</p>
                    </CardContent>
                </Card>
            </div>

            {/* Breakdown */}
            <div className="grid gap-4 md:grid-cols-2">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowDownLeft className="h-5 w-5 text-green-500" />
                            Income Breakdown
                        </CardTitle>
                        <CardDescription>Sources of revenue for the selected period</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-blue-500"></div>
                                    <span className="text-sm font-medium">Restaurant Sales</span>
                                </div>
                                <span className="font-bold">{formatCurrency(financialData?.breakdown?.restaurant)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-purple-500"></div>
                                    <span className="text-sm font-medium">Bar Sales</span>
                                </div>
                                <span className="font-bold">{formatCurrency(financialData?.breakdown?.bar)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-orange-500"></div>
                                    <span className="text-sm font-medium">Room Bookings</span>
                                </div>
                                <span className="font-bold">{formatCurrency(financialData?.breakdown?.room)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                                    <span className="text-sm font-medium">Other Income</span>
                                </div>
                                <span className="font-bold">{formatCurrency(financialData?.breakdown?.other_income)}</span>
                            </div>
                            <div className="pt-4 border-t flex justify-between font-bold">
                                <span>Total Income</span>
                                <span>{formatCurrency(financialData?.totalRevenue)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ArrowUpRight className="h-5 w-5 text-red-500" />
                            Expense Breakdown
                        </CardTitle>
                        <CardDescription>Where money is going</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-red-500"></div>
                                    <span className="text-sm font-medium">Operational Expenses</span>
                                </div>
                                <span className="font-bold">{formatCurrency(financialData?.breakdown?.operational_expenses)}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                                    <span className="text-sm font-medium">Other Expenses</span>
                                </div>
                                <span className="font-bold">{formatCurrency(financialData?.breakdown?.other_expenses)}</span>
                            </div>
                            {/* Placeholders for future detailed breakdown */}
                            <div className="flex items-center justify-between text-muted-foreground">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-full bg-gray-300"></div>
                                    <span className="text-sm font-medium">Cost of Goods (Est.)</span>
                                </div>
                                <span className="font-bold">--</span>
                            </div>
                            <div className="pt-4 border-t flex justify-between font-bold">
                                <span>Total Expenses</span>
                                <span>{formatCurrency(financialData?.totalExpenses)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
