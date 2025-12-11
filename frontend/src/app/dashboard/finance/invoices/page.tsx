'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { financeAPI } from '@/lib/api';
import { FileText, Plus, RefreshCw, Search, Eye, Download, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Invoice { id: string; invoice_number: string; customer_name: string; amount: number; status: 'draft' | 'sent' | 'paid' | 'overdue'; due_date: string; created_at: string; }
interface InvoiceItem { description: string; quantity: number; unit_price: number; }

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
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
              <p className="text-sm text-gray-500 mt-1">Manage invoices and billing</p>
            </div>
            <div className="flex gap-2">
              <button onClick={fetchInvoices} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800">
                <Plus className="h-4 w-4" />
                Create Invoice
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Invoiced</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">KES {stats.total.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Paid</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">KES {stats.paid.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">KES {stats.pending.toLocaleString()}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Overdue</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">KES {stats.overdue.toLocaleString()}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input type="text" placeholder="Search invoices..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
              </div>
              <div className="flex gap-1">
                {['all', 'draft', 'sent', 'paid', 'overdue'].map((status) => (
                  <button key={status} onClick={() => setStatusFilter(status)} className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${statusFilter === status ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : filteredInvoices.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No invoices found</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {filteredInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{invoice.invoice_number}</p>
                      <p className="text-sm text-gray-500">{invoice.customer_name}</p>
                      <p className="text-xs text-gray-400">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-semibold text-gray-900">KES {invoice.amount.toLocaleString()}</p>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700">
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </span>
                    <div className="flex gap-1">
                      <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Eye className="h-4 w-4" /></button>
                      <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"><Download className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Create Invoice Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create New Invoice</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Customer Name *</label>
                  <input type="text" value={newInvoice.customer_name} onChange={(e) => setNewInvoice({ ...newInvoice, customer_name: e.target.value })} placeholder="Customer name" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Customer Email</label>
                  <input type="email" value={newInvoice.customer_email} onChange={(e) => setNewInvoice({ ...newInvoice, customer_email: e.target.value })} placeholder="customer@email.com" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Due Date</label>
                  <input type="date" value={newInvoice.due_date} onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Notes</label>
                  <input type="text" value={newInvoice.notes} onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })} placeholder="Optional notes" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">Invoice Items</h3>
                  <button onClick={addInvoiceItem} className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                    <Plus className="h-3 w-3" /> Add Item
                  </button>
                </div>
                <div className="space-y-2">
                  {invoiceItems.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center">
                      <input type="text" className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="Description" value={item.description} onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)} />
                      <input type="number" className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="Qty" value={item.quantity} onChange={(e) => updateInvoiceItem(index, 'quantity', parseInt(e.target.value) || 0)} />
                      <input type="number" className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg" placeholder="Price" value={item.unit_price} onChange={(e) => updateInvoiceItem(index, 'unit_price', parseFloat(e.target.value) || 0)} />
                      <span className="w-28 text-right font-medium text-gray-900">KES {(item.quantity * item.unit_price).toLocaleString()}</span>
                      {invoiceItems.length > 1 && (
                        <button onClick={() => removeInvoiceItem(index)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Subtotal</span><span className="text-gray-900">KES {invoiceSubtotal.toLocaleString()}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Tax (16%)</span><span className="text-gray-900">KES {invoiceTax.toLocaleString()}</span></div>
                <div className="flex justify-between font-semibold text-lg pt-2 border-t"><span>Total</span><span>KES {invoiceTotal.toLocaleString()}</span></div>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={handleCreateInvoice} disabled={isSubmitting} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 disabled:opacity-50">
                  {isSubmitting ? 'Creating...' : 'Create Invoice'}
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
