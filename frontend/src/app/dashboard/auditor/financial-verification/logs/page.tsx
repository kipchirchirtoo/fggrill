'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft, Search, Filter, Calendar,
    RefreshCw, Download, ChevronRight,
    Wallet, Smartphone, CreditCard, Building2,
    CheckCircle2, AlertCircle, Clock
} from 'lucide-react';
import { auditAPI } from '@/lib/api';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { UserRole } from '@/lib/auth-context';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function FinancialLogsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [transactions, setTransactions] = useState<any[]>([]);
    const [filteredTransactions, setFilteredTransactions] = useState<any[]>([]);

    const entityId = searchParams.get('entity_id');
    const entityType = searchParams.get('entity_type');
    const isAuditMode = !!entityId;

    const dateParam = searchParams.get('date');
    const [selectedDate, setSelectedDate] = useState(dateParam || new Date().toISOString().split('T')[0]);
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            let res;
            if (isAuditMode) {
                res = await auditAPI.getAuditTrail({
                    entity_id: entityId,
                    entity_type: entityType,
                    start_date: selectedDate
                });
            } else {
                res = await auditAPI.verifyFinances({
                    date: selectedDate,
                    limit: 'all'
                });
            }

            if (res.success) {
                const data = isAuditMode ? (res.data || []) : (res.data?.recent_transactions || []);
                setTransactions(data);
                setFilteredTransactions(data);
            } else {
                toast.error(res.message || 'Failed to fetch logs');
            }
        } catch (e) {
            console.error('Logs fetch failed:', e);
            toast.error('An error occurred while fetching logs');
        } finally {
            setIsLoading(false);
        }
    }, [selectedDate, isAuditMode, entityId, entityType]);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        let result = transactions;

        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(t =>
                isAuditMode
                    ? ((t.action?.toLowerCase() || '').includes(lowerTerm) || (t.user?.toLowerCase() || '').includes(lowerTerm))
                    : ((t.reference_number?.toLowerCase() || '').includes(lowerTerm) || (t.cashier_name?.toLowerCase() || '').includes(lowerTerm))
            );
        }

        if (!isAuditMode) {
            if (paymentMethodFilter !== 'all') {
                if (paymentMethodFilter === 'mpesa') result = result.filter(t => t.payment_method?.toLowerCase().includes('mpesa'));
                else if (paymentMethodFilter === 'card') result = result.filter(t => t.payment_method?.toLowerCase().includes('card'));
                else if (paymentMethodFilter === 'cash') result = result.filter(t => t.payment_method === 'cash');
                else if (paymentMethodFilter === 'pool') result = result.filter(t => t.is_pool_token);
            }
            if (statusFilter !== 'all') result = result.filter(t => t.status === statusFilter);
        }

        setFilteredTransactions(result);
    }, [transactions, searchTerm, paymentMethodFilter, statusFilter, isAuditMode]);

    const handleExport = async () => {
        if (filteredTransactions.length === 0) { toast.error('No data to export'); return; }
        setIsExporting(true);
        try {
            const { default: jsPDF } = await import('jspdf');
            const { default: autoTable } = await import('jspdf-autotable');

            const doc = new jsPDF();
            const margin = 20;
            let cursorY = 20;

            // Logo
            try {
                const img = new Image();
                img.src = '/fglogo.png';
                await Promise.race([
                    new Promise((res, rej) => { img.onload = res; img.onerror = rej; }),
                    new Promise((_, rej) => setTimeout(() => rej(), 3000))
                ]);
                doc.addImage(img, 'PNG', margin, cursorY, 30, 30);
            } catch { /* skip */ }

            // Header
            doc.setFontSize(20);
            doc.setTextColor(44, 62, 80);
            doc.text(isAuditMode ? 'AUDIT TRAIL REPORT' : 'FINANCIAL GATEWAY LOGS', 190, cursorY + 8, { align: 'right' });
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text('FamousGate Hotels', 190, cursorY + 18, { align: 'right' });
            doc.text('Bomet, Kenya', 190, cursorY + 24, { align: 'right' });
            doc.text('0706782828', 190, cursorY + 30, { align: 'right' });

            cursorY = 60;
            doc.setDrawColor(200);
            doc.line(margin, cursorY, 190, cursorY);
            cursorY += 10;

            // Meta
            doc.setFontSize(10);
            doc.setTextColor(44, 62, 80);
            doc.text('REPORT DETAILS:', margin, cursorY);
            cursorY += 7;
            doc.setTextColor(0);
            if (isAuditMode) {
                doc.text(`Entity Type: ${entityType?.replace('_', ' ') || 'Record'}`, margin, cursorY); cursorY += 5;
                doc.text(`Entity ID: ${entityId}`, margin, cursorY); cursorY += 5;
            } else {
                doc.text(`Date: ${format(new Date(selectedDate), 'MMMM d, yyyy')}`, margin, cursorY); cursorY += 5;
                doc.text(`Total Records: ${filteredTransactions.length}`, margin, cursorY); cursorY += 5;
            }
            doc.text(`Generated: ${format(new Date(), 'MMM d, yyyy HH:mm')}`, margin, cursorY);
            cursorY += 15;

            if (isAuditMode) {
                autoTable(doc, {
                    startY: cursorY,
                    head: [['Timestamp', 'User', 'Action', 'Details']],
                    body: filteredTransactions.map(tx => [
                        format(new Date(tx.timestamp || tx.created_at || new Date()), 'MMM d, yyyy HH:mm:ss'),
                        tx.user_name || tx.admin || 'System',
                        tx.action || '',
                        (tx.details || tx.changes || JSON.stringify(tx.data || {})).substring(0, 60)
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 8 },
                    bodyStyles: { fontSize: 8 },
                    columnStyles: { 0: { cellWidth: 38 }, 1: { cellWidth: 30 }, 2: { cellWidth: 25 }, 3: { cellWidth: 80 } },
                    margin: { left: margin, right: margin }
                });
            } else {
                const totalAmt = filteredTransactions.reduce((s, t) => s + Number(t.amount || 0), 0);
                const cash = filteredTransactions.filter(t => t.payment_method === 'cash');
                const mpesa = filteredTransactions.filter(t => t.payment_method?.toLowerCase().includes('mpesa'));
                const card = filteredTransactions.filter(t => t.payment_method?.toLowerCase().includes('card'));

                doc.setFillColor(245, 245, 247);
                doc.rect(margin, cursorY, 170, 22, 'F');
                doc.setFontSize(9);
                doc.setTextColor(100);
                doc.text('Total Transactions:', margin + 5, cursorY + 7);
                doc.text('Cash:', margin + 5, cursorY + 14);
                doc.text('M-Pesa:', margin + 60, cursorY + 7);
                doc.text('Card:', margin + 60, cursorY + 14);
                doc.text('Grand Total:', margin + 115, cursorY + 7);
                doc.setTextColor(0);
                doc.setFont('helvetica', 'bold');
                doc.text(`${filteredTransactions.length}`, margin + 45, cursorY + 7);
                doc.text(`${cash.length}`, margin + 45, cursorY + 14);
                doc.text(`${mpesa.length}`, margin + 95, cursorY + 7);
                doc.text(`${card.length}`, margin + 95, cursorY + 14);
                doc.text(`KES ${totalAmt.toLocaleString()}`, margin + 140, cursorY + 7);
                doc.setFont('helvetica', 'normal');
                cursorY += 32;

                autoTable(doc, {
                    startY: cursorY,
                    head: [['Reference', 'Method', 'Amount (KES)', 'Branch', 'Cashier', 'Status', 'Time']],
                    body: filteredTransactions.map(tx => [
                        tx.reference_number || '—',
                        (tx.payment_method || '').replace('_', ' '),
                        Number(tx.amount || 0).toLocaleString(),
                        tx.branch_name || '—',
                        tx.cashier_name || '—',
                        tx.status || '—',
                        tx.created_at ? format(new Date(tx.created_at), 'HH:mm:ss') : '—'
                    ]),
                    theme: 'striped',
                    headStyles: { fillColor: [44, 62, 80], textColor: 255, fontSize: 8 },
                    bodyStyles: { fontSize: 8 },
                    columnStyles: {
                        0: { cellWidth: 30 }, 1: { cellWidth: 22 },
                        2: { cellWidth: 25, halign: 'right' }, 3: { cellWidth: 30 },
                        4: { cellWidth: 28 }, 5: { cellWidth: 20, halign: 'center' },
                        6: { cellWidth: 18, halign: 'center' }
                    },
                    margin: { left: margin, right: margin }
                });
            }

            // Footer
            const pageCount = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text('FamousGate Hotels - Financial Audit System', 105, 285, { align: 'center' });
                doc.text(`Page ${i} of ${pageCount}`, 190, 285, { align: 'right' });
            }

            doc.save(isAuditMode
                ? `audit-trail-${entityId?.substring(0, 8)}-${selectedDate}.pdf`
                : `financial-logs-${selectedDate}.pdf`
            );
            toast.success('PDF exported successfully');
        } catch (e) {
            console.error('Export failed:', e);
            toast.error('Export failed');
        } finally {
            setIsExporting(false);
        }
    };

    const getMethodIcon = (method: string, isPool: boolean) => {
        if (isPool) return <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600"><Wallet className="h-4 w-4" /></div>;
        if (method === 'cash') return <div className="p-1.5 rounded-lg bg-stone-100 text-stone-600"><Wallet className="h-4 w-4" /></div>;
        if (method?.includes('mpesa')) return <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600"><Smartphone className="h-4 w-4" /></div>;
        return <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><CreditCard className="h-4 w-4" /></div>;
    };

    return (
        <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
            <DashboardLayout>
                <div className="space-y-6 pb-12">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <button onClick={() => router.back()} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                                <ArrowLeft className="h-5 w-5 text-stone-500" />
                            </button>
                            <div>
                                <h1 className="page-title">{isAuditMode ? 'Audit Record History' : 'Financial Gateway Logs'}</h1>
                                <p className="page-subtitle">
                                    {isAuditMode
                                        ? `Audit trail for ${entityType?.replace('_', ' ') || 'Record'} #${entityId?.substring(0, 8)}`
                                        : `Full unified transaction history for ${format(new Date(selectedDate), 'MMMM d, yyyy')}`
                                    }
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {!isAuditMode && (
                                <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-4 py-1.5 shadow-sm h-11">
                                    <Calendar className="h-4 w-4 text-stone-400" />
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="text-[13px] font-bold text-stone-800 bg-transparent outline-none w-32 cursor-pointer"
                                    />
                                </div>
                            )}
                            <button onClick={fetchData} className="btn-white h-11 px-4">
                                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                                Sync
                            </button>
                            <button onClick={handleExport} disabled={isExporting} className="btn-primary h-11 px-4">
                                <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-pulse' : ''}`} />
                                {isExporting ? 'Exporting...' : 'Export PDF'}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                            <input
                                type="text"
                                placeholder={isAuditMode ? 'Search actions or users...' : 'Search reference, cashier, or branch...'}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 rounded-xl border border-stone-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/10 transition-all"
                            />
                        </div>
                        {!isAuditMode && (
                            <>
                                <select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)}
                                    className="h-11 px-4 rounded-xl border border-stone-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/10 bg-white">
                                    <option value="all">All Payment Methods</option>
                                    <option value="cash">Cash</option>
                                    <option value="mpesa">M-PESA</option>
                                    <option value="card">Card / Bank</option>
                                    <option value="pool">Pool Tokens</option>
                                </select>
                                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                                    className="h-11 px-4 rounded-xl border border-stone-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-stone-900/10 bg-white">
                                    <option value="all">All Statuses</option>
                                    <option value="completed">Completed</option>
                                    <option value="pending">Pending</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </>
                        )}
                    </div>

                    <div className="card-elevated bg-white overflow-hidden shadow-sm border border-stone-200">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center p-20">
                                <RefreshCw className="h-8 w-8 animate-spin text-stone-300 mb-2" />
                                <p className="text-sm font-medium text-stone-400">Loading {isAuditMode ? 'audit trail' : 'full log'}...</p>
                            </div>
                        ) : filteredTransactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-20 opacity-60">
                                <Filter className="h-10 w-10 text-stone-200 mb-4" />
                                <p className="text-sm font-bold text-stone-400">No records match your filters</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-stone-50 border-b border-stone-100">
                                        <tr>
                                            {isAuditMode ? (
                                                <>
                                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Timestamp</th>
                                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">User</th>
                                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Action</th>
                                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Details</th>
                                                </>
                                            ) : (
                                                <>
                                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Transaction Ref</th>
                                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Method</th>
                                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Amount</th>
                                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Branch / Cashier</th>
                                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Status</th>
                                                    <th className="px-6 py-4 text-left text-[11px] font-bold text-stone-400 uppercase tracking-wider">Time</th>
                                                    <th className="px-6 py-4 text-right text-[11px] font-bold text-stone-400 uppercase tracking-wider">Action</th>
                                                </>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100">
                                        {filteredTransactions.map((tx, i) => (
                                            <tr key={tx.id || i} className="group hover:bg-stone-50/50 transition-colors">
                                                {isAuditMode ? (
                                                    <>
                                                        <td className="px-6 py-4 text-sm text-stone-500">
                                                            {format(new Date(tx.timestamp || tx.created_at || new Date()), 'MMM d, HH:mm:ss')}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-6 w-6 rounded-full bg-stone-100 flex items-center justify-center text-xs font-bold text-stone-500">
                                                                    {(tx.user_name || tx.admin || 'U')[0]}
                                                                </div>
                                                                <span className="text-sm font-medium text-stone-900">{tx.user_name || tx.admin || 'System'}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="px-2 py-1 rounded-md bg-stone-100 text-stone-700 text-xs font-bold uppercase">{tx.action}</span>
                                                        </td>
                                                        <td className="px-6 py-4 text-sm text-stone-600 max-w-md truncate">
                                                            {tx.details || tx.changes || JSON.stringify(tx.data || {})}
                                                        </td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                {getMethodIcon(tx.payment_method, tx.is_pool_token)}
                                                                <div>
                                                                    <p className="text-[13px] font-bold text-stone-900 font-mono">{tx.reference_number}</p>
                                                                    {tx.is_pool_token && <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">POOL TOKEN</span>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <p className="text-[13px] font-medium text-stone-700 capitalize">{tx.payment_method?.replace('_', ' ')}</p>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <p className="text-[13px] font-bold text-stone-900">KES {Number(tx.amount).toLocaleString()}</p>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-[13px] font-medium text-stone-900 flex items-center gap-1">
                                                                    <Building2 className="h-3 w-3 text-stone-400" /> {tx.branch_name}
                                                                </span>
                                                                <span className="text-[11px] text-stone-500 mt-0.5 ml-4">by {tx.cashier_name}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                                                                tx.status === 'completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                                                tx.status === 'cancelled' ? 'bg-rose-50 border-rose-100 text-rose-700' :
                                                                'bg-amber-50 border-amber-100 text-amber-700'
                                                            }`}>
                                                                {tx.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                                                                <span className="text-[10px] font-bold uppercase tracking-wide">{tx.status}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-1.5 text-stone-500">
                                                                <Clock className="h-3.5 w-3.5" />
                                                                <span className="text-[12px] font-medium">{format(new Date(tx.created_at), 'HH:mm:ss')}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {tx.id ? (
                                                                <button
                                                                    onClick={() => router.push(`/dashboard/auditor/financial-verification/logs/${tx.id}?date=${selectedDate}`)}
                                                                    className="p-2 hover:bg-stone-200 rounded-lg transition-colors text-stone-400 hover:text-stone-900"
                                                                >
                                                                    <ChevronRight className="h-4 w-4" />
                                                                </button>
                                                            ) : (
                                                                <span className="text-[10px] text-stone-300 italic">No ID</span>
                                                            )}
                                                        </td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
