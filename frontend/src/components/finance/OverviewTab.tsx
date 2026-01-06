import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
    DollarSign, TrendingUp, Receipt, FileText,
    FileSpreadsheet, PieChart
} from 'lucide-react';

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

interface OverviewTabProps {
    stats: StatItem[];
    chartData: ChartDataPoint[];
}

export const OverviewTab = ({ stats, chartData }: OverviewTabProps) => (
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
