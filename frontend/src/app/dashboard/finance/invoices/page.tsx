'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { financeAPI } from '@/lib/api';
import { FileText, Plus, RefreshCw, Search, Eye, Download, Send, DollarSign, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface Invoice { id: string; invoice_number: string; customer_name: string; amount: number; status: 'draft' | 'sent' | 'paid' | 'overdue'; due_date: string; created_at: string; }
interface InvoiceItem { description: string; quantity: number; unit_price: number; }

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  draft: { label: 'Draft', color: 'text-gray-700', bgColor: 'bg-gray-100' },
  sent: { label: 'Sent', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  paid: { label: 'Paid', color: 'text-green-700', bgColor: 'bg-green-100' },
  overdue: { label: 'Overdue', color: 'text-red-700', bgColor: 'bg-red-100' },
};

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New invoice form
  const [newInvoice, setNewInvoice] = useState({
    customer_name: '',
    customer_email: '',
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  });
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getInvoices();
      if (response.success) setInvoices(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const addInvoiceItem = () => setInvoiceItems([...invoiceItems, { description: '', quantity: 1, unit_price: 0 }]);
  const removeInvoiceItem = (index: number) => setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  const updateInvoiceItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updated = [...invoiceItems];
    updated[index] = { ...updated[index], [field]: value };
    setInvoiceItems(updated);
  };

  const invoiceSubtotal = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const invoiceTax = Math.round(invoiceSubtotal * 0.16);
  const invoiceTotal = invoiceSubtotal + invoiceTax;

  const handleCreateInvoice = async () => {
    if (!newInvoice.customer_name) { toast.error('Customer name is required'); return; }
    if (invoiceItems.some(item => !item.description || item.unit_price <= 0)) { toast.error('All items must have description and price'); return; }

    setIsSubmitting(true);
    try {
      await financeAPI.createInvoice({
        ...newInvoice,
        items: invoiceItems,
        subtotal: invoiceSubtotal,
        tax: invoiceTax,
        amount: invoiceTotal,
        status: 'draft',
      });
      toast.success('Invoice created successfully!');
      setShowCreateModal(false);
      setNewInvoice({ customer_name: '', customer_email: '', due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: '' });
      setInvoiceItems([{ description: '', quantity: 1, unit_price: 0 }]);
      fetchInvoices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) || inv.customer_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: invoices.reduce((sum, i) => sum + i.amount, 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0),
    pending: invoices.filter(i => ['sent', 'draft'].includes(i.status)).reduce((sum, i) => sum + i.amount, 0),
    overdue: invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0),
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Invoices</h1><p className="text-gray-500">Manage invoices and billing</p></div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchInvoices}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
              <IOSButton onClick={() => setShowCreateModal(true)}><Plus className="h-4 w-4 mr-2" /> Create Invoice</IOSButton>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><p className="text-sm text-gray-500">Total Invoiced</p><p className="text-2xl font-bold">KES {stats.total.toLocaleString()}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-green-500"><p className="text-sm text-gray-500">Paid</p><p className="text-2xl font-bold text-[#34C759]">KES {stats.paid.toLocaleString()}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-[#007AFF]"><p className="text-sm text-gray-500">Pending</p><p className="text-2xl font-bold text-[#007AFF]">KES {stats.pending.toLocaleString()}</p></IOSCard>
            <IOSCard className="p-4 border-l-4 border-red-500"><p className="text-sm text-gray-500">Overdue</p><p className="text-2xl font-bold text-[#FF3B30]">KES {stats.overdue.toLocaleString()}</p></IOSCard>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search invoices..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="flex gap-2">
                {['all', 'draft', 'sent', 'paid', 'overdue'].map((status) => (
                  <IOSButton key={status} variant={statusFilter === status ? 'primary' : 'secondary'} size="sm" onClick={() => setStatusFilter(status)}>
                    {status === 'all' ? 'All' : statusConfig[status]?.label || status}
                  </IOSButton>
                ))}
              </div>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredInvoices.length === 0 ? (
            <IOSCard className="p-12 text-center"><FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No invoices found</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredInvoices.map((invoice) => {
                const statusInfo = statusConfig[invoice.status];
                return (
                  <IOSCard key={invoice.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><FileText className="h-6 w-6 text-[#007AFF]" /></div>
                        <div>
                          <p className="font-bold">{invoice.invoice_number}</p>
                          <p className="text-sm text-gray-500">{invoice.customer_name}</p>
                          <p className="text-xs text-gray-400">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-bold text-lg">KES {invoice.amount.toLocaleString()}</p>
                        <IOSBadge className={`${statusInfo.bgColor} ${statusInfo.color}`}>{statusInfo.label}</IOSBadge>
                        <div className="flex gap-2">
                          <IOSButton size="sm" variant="secondary"><Eye className="h-4 w-4" /></IOSButton>
                          <IOSButton size="sm" variant="secondary"><Download className="h-4 w-4" /></IOSButton>
                        </div>
                      </div>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Invoice Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Customer Name *</label>
                  <Input value={newInvoice.customer_name} onChange={(e) => setNewInvoice({ ...newInvoice, customer_name: e.target.value })} placeholder="Customer name" />
                </div>
                <div>
                  <label className="text-sm font-medium">Customer Email</label>
                  <Input type="email" value={newInvoice.customer_email} onChange={(e) => setNewInvoice({ ...newInvoice, customer_email: e.target.value })} placeholder="customer@email.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Due Date</label>
                  <Input type="date" value={newInvoice.due_date} onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Input value={newInvoice.notes} onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })} placeholder="Optional notes" />
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">Invoice Items</h3>
                  <IOSButton size="sm" variant="secondary" onClick={addInvoiceItem}><Plus className="h-3 w-3 mr-1" /> Add Item</IOSButton>
                </div>
                <div className="space-y-2">
                  {invoiceItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <Input className="flex-1" placeholder="Description" value={item.description} onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)} />
                      <Input className="w-20" type="number" placeholder="Qty" value={item.quantity} onChange={(e) => updateInvoiceItem(index, 'quantity', parseInt(e.target.value) || 0)} />
                      <Input className="w-32" type="number" placeholder="Price" value={item.unit_price} onChange={(e) => updateInvoiceItem(index, 'unit_price', parseFloat(e.target.value) || 0)} />
                      <span className="w-28 text-right font-medium">KES {(item.quantity * item.unit_price).toLocaleString()}</span>
                      {invoiceItems.length > 1 && (
                        <IOSButton size="sm" variant="destructive" onClick={() => removeInvoiceItem(index)}><Trash2 className="h-3 w-3" /></IOSButton>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-1">
                <div className="flex justify-between"><span>Subtotal</span><span>KES {invoiceSubtotal.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Tax (16%)</span><span>KES {invoiceTax.toLocaleString()}</span></div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t"><span>Total</span><span>KES {invoiceTotal.toLocaleString()}</span></div>
              </div>

              <div className="flex gap-2 pt-4">
                <IOSButton variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleCreateInvoice} disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'Creating...' : 'Create Invoice'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
