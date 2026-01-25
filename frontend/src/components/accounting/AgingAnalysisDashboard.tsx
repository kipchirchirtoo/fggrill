'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, User, Clock, AlertTriangle, ChevronRight, FileSpreadsheet, Send, Search, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { useBranch } from '@/lib/branch-context';
import { toast } from 'sonner';

interface Invoice {
    id: string;
    invoice_number: string;
    customer_name: string;
    date: string;
    due_date: string;
    amount: number;
    balance: number;
    aging_days: number;
}

export default function AgingAnalysisDashboard() {
    const { activeBranchId } = useBranch();
    const [searchTerm, setSearchTerm] = useState('');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [buckets, setBuckets] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.accounting.getAgingAnalysis({
                branch_id: activeBranchId || undefined
            });
            if (response.success) {
                setInvoices(response.data.invoices || []);
                setBuckets(response.data.buckets || []);
            }
        } catch (error: any) {
            toast.error('Failed to load aging analysis data');
        } finally {
            setIsLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const totalOutstanding = buckets.reduce((acc, b) => acc + (b.amount || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h2 className="text-[18px] font-bold text-stone-900">Customer Aging Analysis</h2>
                    <p className="text-[12px] text-stone-500">Breakdown of outstanding receivables by time period</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        className="btn-secondary h-9 w-9 p-0 flex items-center justify-center"
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button className="btn-secondary">
                        <FileSpreadsheet className="h-4 w-4" />
                        <span>Export Excel</span>
                    </button>
                    <button className="btn-primary bg-stone-900 text-white">
                        <Search className="h-4 w-4" />
                        <span>Filter</span>
                    </button>
                </div>
            </div>

            {/* Aging Buckets Visualization */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {buckets.map((bucket) => (
                    <div key={bucket.label} className="card-elevated p-4 border-b-2 border-b-stone-200 hover:border-b-stone-900 transition-all">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">{bucket.label}</span>
                            <div className={`h-2 w-2 rounded-full ${bucket.color || 'bg-stone-300'}`} />
                        </div>
                        <p className="text-[18px] font-bold text-stone-900">KES {(bucket.amount || 0).toLocaleString()}</p>
                        <p className="text-[11px] text-stone-500 mt-1">{bucket.count || 0} Invoices</p>
                        <div className="mt-3 w-full bg-stone-100 h-1 rounded-full overflow-hidden">
                            <div
                                className={`h-full ${bucket.color || 'bg-stone-400'}`}
                                style={{ width: `${totalOutstanding > 0 ? ((bucket.amount || 0) / totalOutstanding) * 100 : 0}%` }}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {/* Invoice Listing */}
            <div className="card-elevated p-0 overflow-hidden">
                <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                    <h3 className="text-[14px] font-bold text-stone-900">Detail View</h3>
                    <div className="relative">
                        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input
                            type="text"
                            placeholder="Search customer or invoice..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-stone-200 w-64"
                        />
                    </div>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-stone-50">
                        <tr>
                            <th className="px-5 py-3 text-[11px] font-bold text-stone-500 uppercase">Customer</th>
                            <th className="px-5 py-3 text-[11px] font-bold text-stone-500 uppercase">Invoice</th>
                            <th className="px-5 py-3 text-[11px] font-bold text-stone-500 uppercase">Due Date</th>
                            <th className="px-5 py-3 text-[11px] font-bold text-stone-500 uppercase text-center">Days</th>
                            <th className="px-5 py-3 text-[11px] font-bold text-stone-500 uppercase text-right">Balance</th>
                            <th className="px-5 py-3 text-[11px] font-bold text-stone-500 uppercase w-20">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={6} className="px-5 py-20 text-center text-stone-400 text-sm">Loading data...</td>
                            </tr>
                        ) : invoices.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-5 py-20 text-center text-stone-400 text-sm italic">No outstanding invoices found</td>
                            </tr>
                        ) : (
                            invoices
                                .filter(i =>
                                    i.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                    i.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
                                )
                                .map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-stone-50/50">
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-stone-100 flex items-center justify-center">
                                                    <User className="h-4 w-4 text-stone-500" />
                                                </div>
                                                <span className="text-[13px] font-bold text-stone-900">{invoice.customer_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <p className="text-[12px] font-medium text-stone-600">{invoice.invoice_number}</p>
                                            <p className="text-[10px] text-stone-400">{format(new Date(invoice.date), 'MMM dd, yyyy')}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center gap-1.5 text-[12px] text-stone-600 font-medium">
                                                <Calendar className="h-3.5 w-3.5 text-stone-400" />
                                                {format(new Date(invoice.due_date), 'MMM dd, yyyy')}
                                            </div>
                                        </td>
                                        <td className="px-5 py-4 text-center">
                                            <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full ${invoice.aging_days < 30 ? 'bg-emerald-50 text-emerald-600' :
                                                invoice.aging_days < 60 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'
                                                }`}>
                                                {invoice.aging_days} d
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <p className="text-[14px] font-bold text-stone-900">KES {(invoice.balance || 0).toLocaleString()}</p>
                                            <p className="text-[10px] text-stone-400">Total: KES {(invoice.amount || 0).toLocaleString()}</p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <button className="p-2 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-900 transition-colors" title="Send Reminder">
                                                <Send className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Aging Summary Legend */}
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-4 text-[11px] text-stone-600">
                <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Current: On time</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-amber-400" />
                    <span>1-30: Attention needed</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-rose-500" />
                    <span>60+: Critical / Follow up</span>
                </div>
            </div>
        </div>
    );
}
