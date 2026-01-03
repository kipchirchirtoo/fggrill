'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { financeAPI, guestAPI } from '@/lib/api';
import { FileText, Plus, RefreshCw, Search, Eye, Download, Trash2, Calendar, User, Mail, MapPin, CreditCard, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { BranchSelector } from '@/components/finance/BranchSelector';
import { DateRangeSelector, DateRangePreset } from '@/components/finance/DateRangeSelector';
import { formatNumber } from '@/lib/utils';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_name?: string;
  guest_id?: string;
  guest?: { first_name: string; last_name: string; email: string };
  total_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  due_date: string;
  created_at: string;
  notes?: string;
  items?: InvoiceItem[];
}

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [datePreset, setDatePreset] = useState<DateRangePreset>('month');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [guests, setGuests] = useState<any[]>([]);

  // New invoice form
  const [newInvoice, setNewInvoice] = useState({
    guestId: '',
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    notes: '',
  });
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([{ description: '', quantity: 1, unit_price: 0 }]);

  const fetchInvoices = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getInvoices({
        branch_id: selectedBranch || undefined,
        startDate,
        endDate,
        status: statusFilter !== 'all' ? statusFilter : undefined
      });
      if (response.success) setInvoices(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch, startDate, endDate, statusFilter]);

  const fetchGuests = async () => {
    try {
      const response = await guestAPI.getGuests(undefined, undefined, true);
      if (response.success) setGuests(response.data || []);
    } catch (error) { console.error('Error fetching guests:', error); }
  };

  useEffect(() => {
    fetchInvoices();
    fetchGuests();
  }, [fetchInvoices]);

  const addInvoiceItem = () => setInvoiceItems([...invoiceItems, { description: '', quantity: 1, unit_price: 0 }]);
  const removeInvoiceItem = (index: number) => setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  const updateInvoiceItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updated = [...invoiceItems];
    updated[index] = { ...updated[index], [field]: value } as InvoiceItem;
    setInvoiceItems(updated);
  };

  const invoiceTotal = invoiceItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const invoiceSubtotal = Math.round(invoiceTotal / 1.16);
  const invoiceTax = invoiceTotal - invoiceSubtotal;

  const handleCreateInvoice = async () => {
    if (!newInvoice.guestId) { toast.error('Please select a guest'); return; }
    if (invoiceItems.some(item => !item.description || item.unit_price <= 0)) { toast.error('All items must have description and price'); return; }

    setIsSubmitting(true);
    try {
      await financeAPI.createInvoice({
        guestId: newInvoice.guestId,
        dueDate: newInvoice.due_date,
        notes: newInvoice.notes,
        items: invoiceItems.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price
        })),
        totalAmount: invoiceTotal,
      });
      toast.success('Invoice created successfully!');
      setShowCreateModal(false);
      setNewInvoice({ guestId: '', due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: '' });
      setInvoiceItems([{ description: '', quantity: 1, unit_price: 0 }]);
      fetchInvoices();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create invoice');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredInvoices = invoices.filter((inv) => {
    const guestName = inv.guest ? `${inv.guest.first_name} ${inv.guest.last_name}` : inv.customer_name || '';
    const matchesSearch = inv.invoice_number?.toLowerCase().includes(searchQuery.toLowerCase()) || guestName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0),
    paid: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.total_amount || 0), 0),
    pending: invoices.filter(i => ['sent', 'draft'].includes(i.status)).reduce((sum, i) => sum + (i.total_amount || 0), 0),
    overdue: invoices.filter(i => i.status === 'overdue').reduce((sum, i) => sum + (i.total_amount || 0), 0),
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case 'overdue': return <AlertCircle className="h-4 w-4 text-rose-500" />;
      case 'sent': return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <FileText className="h-4 w-4 text-stone-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'overdue': return 'bg-rose-50 text-rose-700 border-rose-100';
      case 'sent': return 'bg-blue-50 text-blue-700 border-blue-100';
      default: return 'bg-stone-50 text-stone-700 border-stone-100';
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">Invoices</h1>
              <p className="text-sm text-stone-500 mt-1">Manage guest billing and accounts receivable</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <BranchSelector
                selectedBranch={selectedBranch}
                onBranchChange={setSelectedBranch}
              />
              <DateRangeSelector
                startDate={startDate}
                endDate={endDate}
                onRangeChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
                preset={datePreset}
                onPresetChange={setDatePreset}
              />
              <button onClick={fetchInvoices} disabled={isLoading} className="p-2.5 text-stone-500 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-all shadow-sm">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-stone-900 rounded-xl hover:bg-stone-800 transition-all shadow-sm active:scale-95">
                <Plus className="h-4 w-4" />
                Create Invoice
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Invoiced', value: stats.total, color: 'stone' },
              { label: 'Paid', value: stats.paid, color: 'emerald' },
              { label: 'Pending', value: stats.pending, color: 'blue' },
              { label: 'Overdue', value: stats.overdue, color: 'rose' }
            ].map((stat) => (
              <div key={stat.label} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">{stat.label}</p>
                <p className={`text-xl font-bold mt-1 text-stone-900`}>KES {formatNumber(stat.value)}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-stone-400" />
                <input
                  type="text"
                  placeholder="Search by invoice # or guest name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100 transition-all"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto pb-1 md:pb-0">
                {['all', 'draft', 'sent', 'paid', 'overdue'].map((status) => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${statusFilter === status ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500 hover:bg-stone-50'}`}
                  >
                    {status.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white border border-stone-200 rounded-2xl shadow-sm">
              <RefreshCw className="h-10 w-10 animate-spin text-stone-300 mb-4" />
              <p className="text-stone-400 font-medium">Loading invoices...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-16 text-center shadow-sm">
              <div className="w-20 h-20 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <FileText className="h-10 w-10 text-stone-200" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900">No invoices found</h3>
              <p className="text-stone-500 mt-2 max-w-xs mx-auto">Try adjusting your filters or search query.</p>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden divide-y divide-stone-100">
              {filteredInvoices.map((invoice) => {
                const guestName = invoice.guest ? `${invoice.guest.first_name} ${invoice.guest.last_name}` : invoice.customer_name || 'Unknown Guest';
                return (
                  <div key={invoice.id} className="flex items-center justify-between p-5 hover:bg-stone-50/50 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-stone-50 flex items-center justify-center group-hover:bg-white transition-colors border border-transparent group-hover:border-stone-100">
                        <FileText className="h-6 w-6 text-stone-600" />
                      </div>
                      <div>
                        <p className="font-bold text-stone-900">{invoice.invoice_number}</p>
                        <p className="text-sm text-stone-500 font-medium">{guestName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar className="h-3 w-3 text-stone-300" />
                          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Due: {new Date(invoice.due_date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="font-bold text-stone-900 text-lg">KES {formatNumber(invoice.total_amount)}</p>
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider mt-1 ${getStatusColor(invoice.status)}`}>
                          {getStatusIcon(invoice.status)}
                          {invoice.status}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setSelectedInvoice(invoice); setShowViewModal(true); }}
                          className="p-2.5 text-stone-400 hover:text-stone-900 hover:bg-white rounded-xl transition-all border border-transparent hover:border-stone-200 shadow-none hover:shadow-sm"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button className="p-2.5 text-stone-400 hover:text-stone-900 hover:bg-white rounded-xl transition-all border border-transparent hover:border-stone-200 shadow-none hover:shadow-sm">
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Create Invoice Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl p-0">
            <div className="px-5 py-8">
              <DialogHeader><DialogTitle className="text-2xl font-bold text-stone-900">Create New Invoice</DialogTitle></DialogHeader>
              <div className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 block">Select Guest *</label>
                    <select
                      value={newInvoice.guestId}
                      onChange={(e) => setNewInvoice({ ...newInvoice, guestId: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100 transition-all text-sm font-medium"
                    >
                      <option value="">Choose a guest...</option>
                      {guests.map(g => (
                        <option key={g.id} value={g.id}>{g.firstName} {g.lastName} ({g.email})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 block">Due Date</label>
                    <input type="date" value={newInvoice.due_date} onChange={(e) => setNewInvoice({ ...newInvoice, due_date: e.target.value })} className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100 transition-all text-sm font-medium" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2 block">Notes</label>
                  <textarea
                    value={newInvoice.notes}
                    onChange={(e) => setNewInvoice({ ...newInvoice, notes: e.target.value })}
                    placeholder="Optional notes for the guest..."
                    rows={2}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100 transition-all text-sm font-medium resize-none"
                  />
                </div>

                <div className="pt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-stone-900 uppercase tracking-widest">Invoice Items</h3>
                    <button onClick={addInvoiceItem} className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-stone-600 bg-stone-50 border border-stone-200 rounded-lg hover:bg-stone-100 transition-all">
                      <Plus className="h-3 w-3" /> Add Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-3 px-1 pr-2 text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                      <div className="flex-[3] min-w-[200px]">Description</div>
                      <div className="w-14">Qty</div>
                      <div className="w-24">Price</div>
                      <div className="w-28 text-right">Total</div>
                      {invoiceItems.length > 1 && <div className="w-12"></div>}
                    </div>
                    {invoiceItems.map((item, index) => (
                      <div key={index} className="flex gap-3 items-center pr-2 animate-in fade-in slide-in-from-left-2 duration-200">
                        <input type="text" className="flex-[3] min-w-[200px] px-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100" placeholder="Description" value={item.description} onChange={(e) => updateInvoiceItem(index, 'description', e.target.value)} />
                        <input type="number" className="w-14 px-2 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100" placeholder="Qty" value={item.quantity} onChange={(e) => updateInvoiceItem(index, 'quantity', parseInt(e.target.value) || 0)} />
                        <input type="number" className="w-24 px-2 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-100" placeholder="Price" value={item.unit_price} onChange={(e) => updateInvoiceItem(index, 'unit_price', parseFloat(e.target.value) || 0)} />
                        <div className="w-28 text-right font-bold text-stone-900 text-sm whitespace-nowrap">KES {formatNumber(item.quantity * item.unit_price)}</div>
                        {invoiceItems.length > 1 && (
                          <button onClick={() => removeInvoiceItem(index)} className="w-12 flex justify-center p-2 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="h-4 w-4" /></button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-stone-50 rounded-2xl p-6 space-y-3 border border-stone-100">
                  <div className="flex justify-between text-sm font-medium"><span className="text-stone-500">Subtotal</span><span className="text-stone-900">KES {formatNumber(invoiceSubtotal)}</span></div>
                  <div className="flex justify-between text-sm font-medium"><span className="text-stone-500">Tax (16%)</span><span className="text-stone-900">KES {formatNumber(invoiceTax)}</span></div>
                  <div className="flex justify-between font-bold text-xl pt-3 border-t border-stone-200"><span>Total</span><span className="text-stone-900">KES {formatNumber(invoiceTotal)}</span></div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button onClick={() => setShowCreateModal(false)} className="flex-1 px-6 py-3 text-sm font-bold text-stone-500 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-all">Cancel</button>
                  <button onClick={handleCreateInvoice} disabled={isSubmitting} className="flex-1 px-6 py-3 text-sm font-bold text-white bg-stone-900 rounded-xl hover:bg-stone-800 disabled:opacity-50 shadow-lg shadow-stone-200 transition-all active:scale-95">
                    {isSubmitting ? 'Creating...' : 'Create Invoice'}
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Invoice Modal */}
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border-none shadow-2xl p-0">
            {selectedInvoice && (
              <div className="p-0">
                <div className="bg-stone-900 p-8 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-10"><FileText className="h-32 w-32" /></div>
                  <div className="relative z-10 flex justify-between items-start">
                    <div>
                      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mb-4 bg-white/10 border border-white/20`}>
                        {selectedInvoice.status}
                      </div>
                      <h2 className="text-3xl font-bold">{selectedInvoice.invoice_number}</h2>
                      <p className="text-stone-400 mt-1 font-medium">Issued on {new Date(selectedInvoice.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Total Amount</p>
                      <p className="text-4xl font-bold">KES {formatNumber(selectedInvoice.total_amount)}</p>
                    </div>
                  </div>
                </div>

                <div className="p-8 space-y-8">
                  <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <User className="h-3 w-3" /> Bill To
                      </h4>
                      <div>
                        <p className="text-lg font-bold text-stone-900">
                          {selectedInvoice.guest ? `${selectedInvoice.guest.first_name} ${selectedInvoice.guest.last_name}` : selectedInvoice.customer_name}
                        </p>
                        {selectedInvoice.guest?.email && (
                          <div className="flex items-center gap-2 text-stone-500 mt-1">
                            <Mail className="h-3.5 w-3.5" />
                            <span className="text-sm">{selectedInvoice.guest.email}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="h-3 w-3" /> Payment Details
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-500">Due Date</span>
                          <span className="font-bold text-stone-900">{new Date(selectedInvoice.due_date).toLocaleDateString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-stone-500">Status</span>
                          <span className={`font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-full border ${getStatusColor(selectedInvoice.status)}`}>
                            {selectedInvoice.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest">Line Items</h4>
                    <div className="border border-stone-100 rounded-2xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-stone-50 text-stone-500 font-bold uppercase text-[10px] tracking-widest">
                          <tr>
                            <th className="px-6 py-4 text-left">Description</th>
                            <th className="px-6 py-4 text-center">Qty</th>
                            <th className="px-6 py-4 text-right">Unit Price</th>
                            <th className="px-6 py-4 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                          {selectedInvoice.items?.map((item, idx) => (
                            <tr key={idx} className="hover:bg-stone-50/50 transition-colors">
                              <td className="px-6 py-4 font-medium text-stone-900">{item.description}</td>
                              <td className="px-6 py-4 text-center text-stone-600">{item.quantity}</td>
                              <td className="px-6 py-4 text-right text-stone-600">KES {formatNumber(item.unit_price)}</td>
                              <td className="px-6 py-4 text-right font-bold text-stone-900">KES {formatNumber(item.total_price || (item.quantity * item.unit_price))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {selectedInvoice.notes && (
                    <div className="bg-stone-50 rounded-2xl p-6 border border-stone-100">
                      <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-2">Notes</h4>
                      <p className="text-sm text-stone-600 leading-relaxed">{selectedInvoice.notes}</p>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4">
                    <button onClick={() => setShowViewModal(false)} className="flex-1 px-6 py-3 text-sm font-bold text-stone-500 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-all">Close</button>
                    <button className="flex-1 px-6 py-3 text-sm font-bold text-white bg-stone-900 rounded-xl hover:bg-stone-800 shadow-lg shadow-stone-200 transition-all flex items-center justify-center gap-2">
                      <Download className="h-4 w-4" /> Download PDF
                    </button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
