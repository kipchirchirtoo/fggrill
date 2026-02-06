'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/minimal/button';
import { IOSCard } from '@/components/ui/ios-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    FileText, Plus, Search, Filter,
    CheckCircle2, Clock, AlertTriangle, Loader2, Download
} from 'lucide-react';
import { accountingAPI } from '@/lib/api';
import { toast } from 'sonner';

interface InvoicesContentProps {
    branchId: number | null;
    isAuditor?: boolean;
}

export function InvoicesContent({ branchId, isAuditor = false }: InvoicesContentProps) {
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        customer_id: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        subtotal: '',
        notes: ''
    });

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            // In a real scenario, we would filter by branchId here
            const res = await accountingAPI.getInvoices();
            if (res.success && res.data) {
                setInvoices(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInvoices();
    }, [branchId]);

    const handleCreate = async () => {
        try {
            if (!formData.customer_id || !formData.subtotal) {
                toast.error('Please fill required fields');
                return;
            }
            setLoading(true);

            const res = await accountingAPI.createInvoice({
                ...formData,
                subtotal: parseFloat(formData.subtotal),
                tax_amount: parseFloat(formData.subtotal) * 0.16 // Simple 16% VAT assumption for now
            });

            if (res.success) {
                toast.success('Invoice created successfully');
                setIsModalOpen(false);
                fetchInvoices();
                setFormData({
                    customer_id: '',
                    invoice_date: new Date().toISOString().split('T')[0],
                    due_date: new Date().toISOString().split('T')[0],
                    subtotal: '',
                    notes: ''
                });
            }
        } catch (error) {
            console.error('Failed to create invoice:', error);
            toast.error('Failed to create invoice');
        } finally {
            setLoading(false);
        }
    };

    // Mock customers for now since we don't have a full customer DB integrated yet
    const mockCustomers = [
        { id: '00000000-0000-0000-0000-000000000001', name: 'Walk-in Customer' },
        { id: '00000000-0000-0000-0000-000000000002', name: 'Corporate Client A' }
    ];

    const generatePDF = (inv: any) => {
        const downloadUrl = `http://localhost:5000/api/reports/generate/branded-pdf`;
        fetch(downloadUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reportType: 'invoice',
                data: {
                    invoice_number: inv.invoice_number,
                    invoice_date: new Date(inv.invoice_date).toLocaleDateString(),
                    due_date: new Date(inv.due_date).toLocaleDateString(),
                    status: inv.status,
                    customer_name: inv.customer_name || 'Customer',
                    total_amount: inv.total_amount,
                    items: inv.items || [{ description: 'Service', total: inv.total_amount, quantity: 1, unit_price: inv.total_amount }]
                }
            })
        })
            .then(res => res.blob())
            .then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Invoice_${inv.invoice_number}.pdf`;
                a.click();
            })
            .catch(err => toast.error('Failed to download invoice'));
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 tracking-tight">
                        {isAuditor ? 'Audit Invoices' : 'Invoices'}
                    </h1>
                    <p className="text-stone-500 text-sm mt-0.5">
                        {isAuditor ? 'Review accounts receivable' : 'Manage accounts receivable'}
                    </p>
                </div>
                {!isAuditor && (
                    <Button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Invoice
                    </Button>
                )}
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <IOSCard className="p-4 flex items-center justify-between bg-emerald-50 border-emerald-100">
                    <div>
                        <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Paid this month</p>
                        <p className="text-2xl font-bold text-emerald-900 mt-0.5">KES {invoices.filter(i => i.status === 'paid').reduce((acc, curr) => acc + (curr.total_amount || 0), 0).toLocaleString()}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                </IOSCard>
                {/* Add more stats cards as needed */}
            </div>

            {/* List */}
            {loading && invoices.length === 0 ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
                </div>
            ) : invoices.length > 0 ? (
                <div className="grid gap-3">
                    {invoices.map((inv) => (
                        <IOSCard key={inv.id} className="p-4 flex items-center justify-between hover:bg-stone-50 transition-colors cursor-pointer border-stone-200">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-500">
                                    <FileText className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-stone-900">{inv.invoice_number}</h4>
                                    <p className="text-xs text-stone-500">
                                        {new Date(inv.invoice_date).toLocaleDateString()} • Due {new Date(inv.due_date).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="font-bold text-stone-900">KES {inv.total_amount?.toLocaleString()}</p>
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {inv.status}
                                </span>
                            </div>
                            <div className="flex gap-2 ml-4">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        generatePDF(inv);
                                    }}
                                    className="p-2 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                                    title="Download PDF"
                                >
                                    <Download className="h-4 w-4" />
                                </button>
                            </div>
                        </IOSCard>
                    ))}
                </div>
            ) : (
                <IOSCard className="overflow-hidden border-stone-200 shadow-sm">
                    <div className="text-center py-16">
                        <FileText className="h-12 w-12 text-stone-300 mx-auto mb-3" />
                        <h3 className="text-stone-900 font-semibold">No invoices found</h3>
                        <p className="text-stone-500 text-sm mt-1">
                            {isAuditor ? 'No invoices recorded yet.' : 'Start by recording a new invoice.'}
                        </p>
                        {!isAuditor && (
                            <Button variant="outline" className="mt-4" onClick={() => setIsModalOpen(true)}>Create First Invoice</Button>
                        )}
                    </div>
                </IOSCard>
            )}

            {/* Modal */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Invoice</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-stone-700">Customer</label>
                            <select
                                className="w-full h-10 px-3 rounded-lg border border-stone-200 bg-white text-sm"
                                value={formData.customer_id}
                                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                            >
                                <option value="">Select Customer...</option>
                                {mockCustomers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-stone-700">Date</label>
                                <input type="date" className="w-full h-10 px-3 rounded-lg border border-stone-200"
                                    value={formData.invoice_date}
                                    onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-stone-700">Due Date</label>
                                <input type="date" className="w-full h-10 px-3 rounded-lg border border-stone-200"
                                    value={formData.due_date}
                                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-stone-700">Amount (KES)</label>
                            <input type="number" className="w-full h-10 px-3 rounded-lg border border-stone-200" placeholder="0.00"
                                value={formData.subtotal}
                                onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-stone-700">Notes</label>
                            <textarea className="w-full h-20 px-3 py-2 rounded-lg border border-stone-200 resize-none"
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                        <Button className="btn-primary" onClick={handleCreate} disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Create Invoice
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
