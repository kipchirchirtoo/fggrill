import { useState, useEffect } from 'react';
import { FileText, Download, Filter, Printer, TrendingUp, TrendingDown, Landmark, PieChart, RefreshCw } from 'lucide-react';
import { accountingAPI } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';

export default function FinancialReports() {
    const { activeBranchId } = useBranch();
    const [activeReport, setActiveReport] = useState<'p&l' | 'trial-balance'>('p&l');
    const [isLoading, setIsLoading] = useState(true);
    const [reportData, setReportData] = useState<any>(null);

    const fetchReport = async () => {
        setIsLoading(true);
        try {
            const res = activeReport === 'p&l'
                ? await accountingAPI.getProfitAndLoss({ branch_id: activeBranchId })
                : await accountingAPI.getTrialBalance({ branch_id: activeBranchId });

            if (res.success) {
                setReportData(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch report:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, [activeReport, activeBranchId]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-[18px] font-bold text-stone-900">Financial Reporting</h2>
                    <p className="text-[12px] text-stone-500">Generate and export branch financial statements</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchReport} className="btn-secondary">
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="flex bg-stone-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveReport('p&l')}
                            className={`px-4 py-1.5 rounded-md text-[12px] font-bold transition-all ${activeReport === 'p&l' ? 'bg-white shadow text-stone-900' : 'text-stone-400'}`}
                        >
                            Profit & Loss
                        </button>
                        <button
                            onClick={() => setActiveReport('trial-balance')}
                            className={`px-4 py-1.5 rounded-md text-[12px] font-bold transition-all ${activeReport === 'trial-balance' ? 'bg-white shadow text-stone-900' : 'text-stone-400'}`}
                        >
                            Trial Balance
                        </button>
                    </div>
                </div>
            </div>

            {activeReport === 'p&l' ? (
                <div className="space-y-6 relative">
                    {isLoading && !reportData && (
                        <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10 min-h-[400px]">
                            <RefreshCw className="h-8 w-8 text-stone-400 animate-spin" />
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="card-elevated p-6 bg-stone-50">
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">Total Revenue</p>
                            <p className="text-[24px] font-bold text-stone-900">KES {(reportData?.revenue_total || 0).toLocaleString()}</p>
                            <div className="flex items-center gap-1 mt-2 text-stone-400">
                                <TrendingUp className="h-3.5 w-3.5" />
                                <span className="text-[11px] font-bold">Standard Operations</span>
                            </div>
                        </div>
                        <div className="card-elevated p-6 bg-stone-50">
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">Total Expenses</p>
                            <p className="text-[24px] font-bold text-stone-900">KES {(reportData?.expense_total || 1120500).toLocaleString()}</p>
                            <div className="flex items-center gap-1 mt-2 text-stone-400">
                                <TrendingDown className="h-3.5 w-3.5" />
                                <span className="text-[11px] font-bold">Incurred Costs</span>
                            </div>
                        </div>
                        <div className="card-elevated p-6 bg-stone-900 text-white shadow-xl">
                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider mb-2">Net Profit</p>
                            <p className="text-[24px] font-bold">KES {(reportData?.net_profit || 0).toLocaleString()}</p>
                            <div className="flex items-center gap-1 mt-2 text-emerald-400">
                                <TrendingUp className="h-3.5 w-3.5" />
                                <span className="text-[11px] font-bold">Margin: {reportData?.net_profit && reportData?.revenue_total ? ((reportData.net_profit / reportData.revenue_total) * 100).toFixed(1) : 0}%</span>
                            </div>
                        </div>
                    </div>

                    <div className="card-elevated p-0 overflow-hidden">
                        <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex items-center justify-between">
                            <h3 className="text-[14px] font-bold text-stone-900">P&L Detailed Statement</h3>
                            <div className="flex items-center gap-2 text-[12px] text-stone-500 font-medium">
                                <Filter className="h-3.5 w-3.5" />
                                Period: Jan 01 - Jan 31, 2024
                            </div>
                        </div>
                        <div className="p-8">
                            <div className="space-y-8 max-w-2xl mx-auto">
                                {/* Revenue Section */}
                                <section>
                                    <h4 className="text-[11px] font-bold text-stone-400 uppercase mb-4 tracking-widest">Revenue</h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[13px] font-medium border-b border-stone-50 pb-2">
                                            <span>Room Revenue</span>
                                            <span className="font-bold">1,850,000.00</span>
                                        </div>
                                        <div className="flex justify-between text-[13px] font-medium border-b border-stone-50 pb-2">
                                            <span>F&B Sales</span>
                                            <span className="font-bold">450,000.00</span>
                                        </div>
                                        <div className="flex justify-between text-[13px] font-bold pt-2 text-stone-900 uppercase">
                                            <span>Total Revenue</span>
                                            <span>2,450,000.00</span>
                                        </div>
                                    </div>
                                </section>

                                {/* COGS/Direct Costs */}
                                <section>
                                    <h4 className="text-[11px] font-bold text-stone-400 uppercase mb-4 tracking-widest">Operating Expenses</h4>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-[13px] font-medium border-b border-stone-50 pb-2">
                                            <span>Salaries & Wages</span>
                                            <span className="font-bold">650,000.00</span>
                                        </div>
                                        <div className="flex justify-between text-[13px] font-medium border-b border-stone-50 pb-2">
                                            <span>Utilities (Electricity/Water)</span>
                                            <span className="font-bold">120,500.00</span>
                                        </div>
                                        <div className="flex justify-between text-[13px] font-medium border-b border-stone-50 pb-2">
                                            <span>Maintenance Costs</span>
                                            <span className="font-bold">85,000.00</span>
                                        </div>
                                        <div className="flex justify-between text-[13px] font-bold pt-2 text-stone-900 uppercase">
                                            <span>Total Expenses</span>
                                            <span>1,120,500.00</span>
                                        </div>
                                    </div>
                                </section>

                                <div className="p-6 bg-stone-900 rounded-xl text-white mt-10">
                                    <div className="flex justify-between text-[16px] font-bold">
                                        <span>Net Profit / (Loss)</span>
                                        <span>1,329,500.00</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card-elevated p-0 overflow-hidden relative">
                    {isLoading && (
                        <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                            <RefreshCw className="h-8 w-8 text-stone-400 animate-spin" />
                        </div>
                    )}
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-stone-50 border-b border-stone-100">
                            <tr>
                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Code</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest">Account Name</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Debit</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-stone-400 uppercase tracking-widest text-right">Credit</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                            {(reportData?.accounts || []).map((row: any) => (
                                <tr key={row.account_id} className="hover:bg-stone-50/50 transition-colors">
                                    <td className="px-6 py-4 text-[12px] font-bold text-stone-400">{row.account_code}</td>
                                    <td className="px-6 py-4 text-[13px] font-medium text-stone-900">{row.account_name}</td>
                                    <td className="px-6 py-4 text-[13px] font-bold text-stone-900 text-right">{row.debit > 0 ? row.debit.toLocaleString() : '-'}</td>
                                    <td className="px-6 py-4 text-[13px] font-bold text-stone-900 text-right">{row.credit > 0 ? row.credit.toLocaleString() : '-'}</td>
                                </tr>
                            ))}
                            {(!reportData?.accounts || reportData.accounts.length === 0) && (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-stone-400 text-[13px]">No account data available for the selected period</td>
                                </tr>
                            )}
                        </tbody>
                        <tfoot className="bg-stone-900 text-white font-bold">
                            <tr>
                                <td colSpan={2} className="px-6 py-4 text-[13px] uppercase tracking-wider">Total Combined Balance</td>
                                <td className="px-6 py-4 text-[16px] text-right">{(reportData?.total_debit || 0).toLocaleString()}</td>
                                <td className="px-6 py-4 text-[16px] text-right">{(reportData?.total_credit || 0).toLocaleString()}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            )}

            <div className="flex items-center gap-4 p-4 bg-stone-50 border border-stone-100 rounded-xl">
                <PieChart className="h-5 w-5 text-stone-400" />
                <p className="text-[12px] text-stone-500 font-medium">
                    Pro Tip: You can drill down into any account row to see the contributing journal entries for this period.
                </p>
            </div>
        </div>
    );
}
