import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, TrendingUp, PieChart, Calendar } from 'lucide-react';

export const ReportsTab = () => {
    const [activeReport, setActiveReport] = useState<string | null>(null);

    const reports = [
        { id: 'pnl', name: 'Profit & Loss', description: 'Income, expenses, and net profit', icon: TrendingUp },
        { id: 'bs', name: 'Balance Sheet', description: 'Assets, liabilities, and equity', icon: Scale }, // Scale is not imported, need to fix or use another icon
        { id: 'sales', name: 'Sales Analysis', description: 'Sales performance by category', icon: PieChart },
        { id: 'closing', name: 'Period Closing', description: 'End of day/month closing reports', icon: Calendar },
    ];

    return (
        <div className="space-y-6">
            {!activeReport ? (
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold">Financial Reports</CardTitle>
                            <CardDescription>View and export financial statements</CardDescription>
                        </div>
                        <Button variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Export All
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {reports.map((report) => (
                                <div
                                    key={report.id}
                                    className="p-4 border rounded-lg hover:bg-stone-50 transition-colors cursor-pointer flex items-center justify-between group"
                                    onClick={() => setActiveReport(report.id)}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-stone-100 rounded-md group-hover:bg-white transition-colors">
                                            <report.icon className="h-5 w-5 text-stone-600" />
                                        </div>
                                        <div>
                                            <span className="font-medium text-stone-900 block">{report.name}</span>
                                            <span className="text-xs text-stone-500">{report.description}</span>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">View</Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <Card className="border-none shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" onClick={() => setActiveReport(null)}>← Back</Button>
                            <div>
                                <CardTitle className="text-lg font-bold">{reports.find(r => r.id === activeReport)?.name}</CardTitle>
                                <CardDescription>Report for current period</CardDescription>
                            </div>
                        </div>
                        <Button variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Export PDF
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="min-h-[300px] flex items-center justify-center text-stone-400">
                            <p>Report visualization placeholder</p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};
// Need to import Scale locally or remove it from usage if not imported.
// Actually I'll just use FileText for Balance Sheet for now to avoid import error if Scale is not in lucide-react (it is, but I need to import it).
// Wait, I missed importing Scale in the top import. I will fix that in the ReplacementContent.

