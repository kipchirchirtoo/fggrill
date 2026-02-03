'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { procurementAPI } from '@/lib/api';
import { BarChart3, FileText, History, Download, ShieldCheck, PieChart, TrendingUp, AlertCircle, RefreshCw, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface AuditLog {
    id: string;
    action_type: string;
    entity_type: string;
    entity_id: string;
    user_name: string;
    old_values: any;
    new_values: any;
    created_at: string;
}

export default function ProcurementReportsPage() {
    const { user } = useAuth();
    const [vatSummary, setVatSummary] = useState<any>(null);
    const [grniLogs, setGrniLogs] = useState<any[]>([]);
    const [agingData, setAgingData] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'vat' | 'grni' | 'aging' | 'audit'>('vat');

    const fetchAuditLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await procurementAPI.getAuditTrail();
            if (response.success) setAuditLogs(response.data || []);
        } catch (error) { console.error('Error fetching audit logs:', error); }
        finally { setIsLoading(false); }
    }, []);

    const fetchVATReport = useCallback(async () => {
        setIsLoading(true);
        try {
            const today = new Date();
            const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            const lastDay = today.toISOString().split('T')[0];
            const response = await procurementAPI.getVATReport(firstDay, lastDay);
            if (response.success) setVatSummary(response);
        } catch (error) { console.error('Error fetching VAT report:', error); }
        finally { setIsLoading(false); }
    }, []);

    const fetchGRNIReport = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await procurementAPI.getGRNIReport();
            if (response.success) setGrniLogs(response.data || []);
        } catch (error) { console.error('Error fetching GRNI report:', error); }
        finally { setIsLoading(false); }
    }, []);

    const fetchAgingReport = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await procurementAPI.getAgingAnalysis();
            if (response.success) setAgingData(response.data || []);
        } catch (error) { console.error('Error fetching Aging report:', error); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => {
        if (activeTab === 'audit') fetchAuditLogs();
        else if (activeTab === 'vat') fetchVATReport();
        else if (activeTab === 'grni') fetchGRNIReport();
        else if (activeTab === 'aging') fetchAgingReport();
    }, [activeTab, fetchAuditLogs, fetchVATReport, fetchGRNIReport, fetchAgingReport]);

    return (
        <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.AUDITOR]}>
            <DashboardLayout>
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Procurement Intelligence</h1>
                            <p className="text-gray-500">Compliance reports and immutable audit trails</p>
                        </div>
                        <div className="flex gap-2">
                            <IOSButton variant="secondary" leftIcon={<Download size={16} />} onClick={() => toast.info('Generating PDF Report...')}>Export All</IOSButton>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 py-2 border-b border-stone-100">
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers'}>Suppliers</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/purchase-orders'}>POs</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/grn'}>GRN</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/invoices'}>Invoices</IOSButton>
                        <IOSButton variant="secondary" className="bg-white border-none h-8 text-xs px-3 hover:bg-stone-50" onClick={() => window.location.href = '/dashboard/central-store/suppliers/payments'}>Payments</IOSButton>
                        <IOSButton variant="secondary" className="bg-stone-50 border-none h-8 text-xs px-3" onClick={() => window.location.href = '/dashboard/central-store/suppliers/reports'}>Reports</IOSButton>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        <button
                            onClick={() => setActiveTab('vat')}
                            className={`p-3 rounded-ios-lg border transition-all text-left ${activeTab === 'vat' ? 'border-[#007AFF] bg-blue-50/50 ring-1 ring-[#007AFF]' : 'border-stone-100 bg-white hover:bg-stone-50'}`}
                        >
                            <PieChart size={18} className={activeTab === 'vat' ? 'text-[#007AFF]' : 'text-stone-400'} />
                            <p className="text-[10px] font-bold uppercase mt-2 text-stone-500">VAT Input</p>
                            <p className="text-xs font-medium truncate">KRA Tax Summary</p>
                        </button>
                        <button
                            onClick={() => setActiveTab('grni')}
                            className={`p-3 rounded-ios-lg border transition-all text-left ${activeTab === 'grni' ? 'border-[#007AFF] bg-blue-50/50 ring-1 ring-[#007AFF]' : 'border-stone-100 bg-white hover:bg-stone-50'}`}
                        >
                            <TrendingUp size={18} className={activeTab === 'grni' ? 'text-[#007AFF]' : 'text-stone-400'} />
                            <p className="text-[10px] font-bold uppercase mt-2 text-stone-500">GRNI Acc</p>
                            <p className="text-xs font-medium truncate">Goods Rec Not Inv</p>
                        </button>
                        <button
                            onClick={() => setActiveTab('aging')}
                            className={`p-3 rounded-ios-lg border transition-all text-left ${activeTab === 'aging' ? 'border-[#007AFF] bg-blue-50/50 ring-1 ring-[#007AFF]' : 'border-stone-100 bg-white hover:bg-stone-50'}`}
                        >
                            <AlertCircle size={18} className={activeTab === 'aging' ? 'text-[#007AFF]' : 'text-stone-400'} />
                            <p className="text-[10px] font-bold uppercase mt-2 text-stone-500">Aging</p>
                            <p className="text-xs font-medium truncate">Payables Analysis</p>
                        </button>
                        <button
                            onClick={() => setActiveTab('audit')}
                            className={`p-3 rounded-ios-lg border transition-all text-left ${activeTab === 'audit' ? 'border-[#007AFF] bg-blue-50/50 ring-1 ring-[#007AFF]' : 'border-stone-100 bg-white hover:bg-stone-50'}`}
                        >
                            <History size={18} className={activeTab === 'audit' ? 'text-[#007AFF]' : 'text-stone-400'} />
                            <p className="text-[10px] font-bold uppercase mt-2 text-stone-500">Audit Trail</p>
                            <p className="text-xs font-medium truncate">Immutable Logs</p>
                        </button>
                    </div>

                    <IOSCard className="min-h-[400px]">
                        {activeTab === 'vat' && (
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div><h3 className="text-lg font-bold">VAT Input Summary</h3><p className="text-sm text-stone-500 italic">Consolidated VAT for the current period</p></div>
                                    <IOSButton variant="secondary" size="sm" leftIcon={<Download size={14} />}>Export KRA Format</IOSButton>
                                </div>
                                {isLoading ? (
                                    <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-stone-300" /></div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="p-4 bg-stone-50 rounded-ios-xl"><p className="text-[10px] font-bold text-stone-400 uppercase">Total Vatable Purchases</p><p className="text-xl font-black">KES {vatSummary?.summary?.total_subtotal?.toLocaleString() || '0'}</p></div>
                                            <div className="p-4 bg-emerald-50 rounded-ios-xl"><p className="text-[10px] font-bold text-emerald-600 uppercase">Input VAT (16%)</p><p className="text-xl font-black text-emerald-700">KES {vatSummary?.summary?.total_vat?.toLocaleString() || '0'}</p></div>
                                            <div className="p-4 bg-amber-50 rounded-ios-xl"><p className="text-[10px] font-bold text-amber-600 uppercase">Withholding VAT</p><p className="text-xl font-black text-amber-700">KES {vatSummary?.summary?.total_withholding?.toLocaleString() || '0'}</p></div>
                                        </div>
                                        <div className="rounded-lg border border-stone-100 overflow-hidden">
                                            <table className="w-full text-xs text-left">
                                                <thead className="bg-stone-50 font-bold uppercase text-[9px] text-stone-500">
                                                    <tr><th className="px-4 py-2">Invoice #</th><th className="px-4 py-2">Supplier</th><th className="px-4 py-2 text-right">Taxable Amt</th><th className="px-4 py-2 text-right">VAT</th></tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-50 font-medium text-stone-600">
                                                    {vatSummary?.data?.map((inv: any, idx: number) => (
                                                        <tr key={idx} className="hover:bg-stone-25">
                                                            <td className="px-4 py-2 font-mono">{inv.invoice_number}</td>
                                                            <td className="px-4 py-2 font-bold">{inv.supplier?.name}</td>
                                                            <td className="px-4 py-2 text-right font-mono">{Number(inv.subtotal).toLocaleString()}</td>
                                                            <td className="px-4 py-2 text-right font-mono text-emerald-600">{Number(inv.vat_amount).toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                    {(!vatSummary?.data || vatSummary.data.length === 0) && (
                                                        <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400 italic">No VAT transactions for this period</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {activeTab === 'grni' && (
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div><h3 className="text-lg font-bold">GRNI Control Account</h3><p className="text-sm text-stone-500 italic">Goods Received Not Invoiced - Outstanding Liability</p></div>
                                    <IOSButton variant="secondary" size="sm" onClick={fetchGRNIReport}>Refresh</IOSButton>
                                </div>
                                {isLoading ? (
                                    <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-stone-300" /></div>
                                ) : (
                                    <div className="rounded-lg border border-stone-100 overflow-hidden">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-stone-50 font-bold uppercase text-[9px] text-stone-500">
                                                <tr><th className="px-4 py-2">GRN #</th><th className="px-4 py-2">Supplier</th><th className="px-4 py-2 text-right">Estimated Liability</th><th className="px-4 py-2">Age</th></tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-50 font-medium text-stone-600">
                                                {grniLogs.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-stone-25">
                                                        <td className="px-4 py-2 font-mono">{item.grn?.grn_number}</td>
                                                        <td className="px-4 py-2 font-bold">{item.supplier?.name}</td>
                                                        <td className="px-4 py-2 text-right font-mono text-amber-600">{Number(item.estimated_amount).toLocaleString()}</td>
                                                        <td className="px-4 py-2">{Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24))} days</td>
                                                    </tr>
                                                ))}
                                                {grniLogs.length === 0 && (
                                                    <tr><td colSpan={4} className="px-4 py-8 text-center text-stone-400 italic">No outstanding GRN items</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'aging' && (
                            <div className="p-6 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div><h3 className="text-lg font-bold">Accounts Payable Aging</h3><p className="text-sm text-stone-500 italic">Analysis of outstanding debts by duration</p></div>
                                    <IOSButton variant="secondary" size="sm" onClick={fetchAgingReport}>Analyze Now</IOSButton>
                                </div>
                                {isLoading ? (
                                    <div className="flex justify-center py-12"><RefreshCw className="animate-spin text-stone-300" /></div>
                                ) : (
                                    <div className="rounded-lg border border-stone-100 overflow-hidden">
                                        <table className="w-full text-[11px] text-left">
                                            <thead className="bg-stone-50 font-bold uppercase text-[9px] text-stone-500">
                                                <tr>
                                                    <th className="px-4 py-2">Supplier</th>
                                                    <th className="px-4 py-2 text-right">0-30 Days</th>
                                                    <th className="px-4 py-2 text-right">31-60 Days</th>
                                                    <th className="px-4 py-2 text-right">61-90 Days</th>
                                                    <th className="px-4 py-2 text-right text-red-600 font-black">90+ Days</th>
                                                    <th className="px-4 py-2 text-right bg-stone-100">Total Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-50 font-medium">
                                                {agingData.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-stone-25 transition-colors">
                                                        <td className="px-4 py-2 font-bold text-stone-800">{item.supplier?.name}</td>
                                                        <td className="px-4 py-2 text-right font-mono">{Number(item.current_amount).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-right font-mono">{Number(item.days_30_amount).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-right font-mono">{Number(item.days_60_amount).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-right font-mono text-red-500">{Number(item.days_90_plus_amount).toLocaleString()}</td>
                                                        <td className="px-4 py-2 text-right font-black bg-stone-50 text-[#007AFF]">{Number(item.current_balance).toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                                {agingData.length === 0 && (
                                                    <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-400 italic">No aging data available</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </IOSCard>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
