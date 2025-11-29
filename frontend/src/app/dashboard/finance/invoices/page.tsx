'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, Search, Filter, Download, Send, Eye, Edit2, Trash2,
  CheckCircle, Clock, AlertTriangle, XCircle, MoreVertical, Printer,
  Calendar, DollarSign, Building2, User, Mail, Phone, ChevronDown,
  ArrowUpRight, ArrowDownRight, RefreshCw, Copy, X, Check, Hash
} from 'lucide-react';
import { toast } from 'sonner';

// Invoice status types
type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue' | 'cancelled';

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  branch: string;
  branchCode: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  notes: string;
  createdBy: string;
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; icon: any }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: Edit2 },
  sent: { label: 'Sent', color: 'bg-blue-100 text-blue-700', icon: Send },
  paid: { label: 'Paid', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  partial: { label: 'Partial', color: 'bg-amber-100 text-amber-700', icon: Clock },
  overdue: { label: 'Overdue', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

const BRANCHES = [
  { id: 1, name: 'Bomet HQ', code: 'FGB-HQ' },
  { id: 2, name: 'Bomet Town', code: 'FGB-BMT' },
  { id: 3, name: 'Kericho', code: 'FGB-KER' },
  { id: 4, name: 'Kapsoit', code: 'FGB-KAP' },
  { id: 5, name: 'Mogogosiek', code: 'FGB-MOG' },
  { id: 6, name: 'Litein', code: 'FGB-LIT' },
];

export default function FinanceInvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
  });

  // New invoice form state
  const [newInvoice, setNewInvoice] = useState({
    customer: { name: '', email: '', phone: '', address: '' },
    branch: '',
    items: [{ id: '1', description: '', quantity: 1, unitPrice: 0, total: 0 }],
    tax: 16,
    discount: 0,
    dueDate: '',
    notes: '',
  });

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    setIsLoading(true);
    try {
      // Simulated data - replace with actual API call
      const mockInvoices: Invoice[] = [
        {
          id: '1',
          invoiceNumber: 'INV-2024-001',
          customer: { name: 'Safari Lodge Ltd', email: 'accounts@safarilodge.co.ke', phone: '+254 722 123456', address: 'Nairobi, Kenya' },
          branch: 'Bomet HQ',
          branchCode: 'FGB-HQ',
          items: [
            { id: '1', description: 'Accommodation - Deluxe Room (3 nights)', quantity: 3, unitPrice: 8500, total: 25500 },
            { id: '2', description: 'Restaurant Services', quantity: 1, unitPrice: 4500, total: 4500 },
          ],
          subtotal: 30000,
          tax: 4800,
          discount: 0,
          total: 34800,
          amountPaid: 34800,
          balance: 0,
          status: 'paid',
          issueDate: '2024-11-15',
          dueDate: '2024-11-30',
          notes: 'Thank you for your business!',
          createdBy: 'John Accountant',
        },
        {
          id: '2',
          invoiceNumber: 'INV-2024-002',
          customer: { name: 'Corporate Events Co', email: 'finance@corpevents.com', phone: '+254 733 456789', address: 'Kericho, Kenya' },
          branch: 'Kericho',
          branchCode: 'FGB-KER',
          items: [
            { id: '1', description: 'Conference Hall Rental (Full Day)', quantity: 2, unitPrice: 25000, total: 50000 },
            { id: '2', description: 'Catering Services (100 pax)', quantity: 100, unitPrice: 850, total: 85000 },
            { id: '3', description: 'Audio/Visual Equipment', quantity: 1, unitPrice: 15000, total: 15000 },
          ],
          subtotal: 150000,
          tax: 24000,
          discount: 10000,
          total: 164000,
          amountPaid: 82000,
          balance: 82000,
          status: 'partial',
          issueDate: '2024-11-20',
          dueDate: '2024-12-05',
          notes: '50% deposit received',
          createdBy: 'Jane Finance',
        },
        {
          id: '3',
          invoiceNumber: 'INV-2024-003',
          customer: { name: 'Travel Tours Kenya', email: 'bookings@traveltours.ke', phone: '+254 711 789012', address: 'Mombasa, Kenya' },
          branch: 'Litein',
          branchCode: 'FGB-LIT',
          items: [
            { id: '1', description: 'Group Booking - Standard Rooms (10 rooms, 2 nights)', quantity: 20, unitPrice: 5500, total: 110000 },
          ],
          subtotal: 110000,
          tax: 17600,
          discount: 5000,
          total: 122600,
          amountPaid: 0,
          balance: 122600,
          status: 'overdue',
          issueDate: '2024-11-01',
          dueDate: '2024-11-15',
          notes: 'Payment overdue - follow up required',
          createdBy: 'John Accountant',
        },
        {
          id: '4',
          invoiceNumber: 'INV-2024-004',
          customer: { name: 'New Client Corp', email: 'info@newclient.com', phone: '+254 700 111222', address: 'Nakuru, Kenya' },
          branch: 'Bomet Town',
          branchCode: 'FGB-BMT',
          items: [
            { id: '1', description: 'Premium Suite (5 nights)', quantity: 5, unitPrice: 12000, total: 60000 },
          ],
          subtotal: 60000,
          tax: 9600,
          discount: 0,
          total: 69600,
          amountPaid: 0,
          balance: 69600,
          status: 'sent',
          issueDate: '2024-11-25',
          dueDate: '2024-12-10',
          notes: '',
          createdBy: 'Jane Finance',
        },
        {
          id: '5',
          invoiceNumber: 'INV-2024-005',
          customer: { name: 'Draft Customer', email: '', phone: '', address: '' },
          branch: 'Kapsoit',
          branchCode: 'FGB-KAP',
          items: [
            { id: '1', description: 'Services TBD', quantity: 1, unitPrice: 0, total: 0 },
          ],
          subtotal: 0,
          tax: 0,
          discount: 0,
          total: 0,
          amountPaid: 0,
          balance: 0,
          status: 'draft',
          issueDate: '2024-11-28',
          dueDate: '',
          notes: 'Pending details',
          createdBy: 'John Accountant',
        },
      ];

      setInvoices(mockInvoices);
      
      // Calculate stats
      const totalAmount = mockInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const paidAmount = mockInvoices.reduce((sum, inv) => sum + inv.amountPaid, 0);
      
      setStats({
        total: mockInvoices.length,
        draft: mockInvoices.filter(i => i.status === 'draft').length,
        sent: mockInvoices.filter(i => i.status === 'sent').length,
        paid: mockInvoices.filter(i => i.status === 'paid').length,
        overdue: mockInvoices.filter(i => i.status === 'overdue').length,
        totalAmount,
        paidAmount,
        pendingAmount: totalAmount - paidAmount,
      });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast.error('Failed to load invoices');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter invoices
  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         inv.customer.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const matchesBranch = branchFilter === 'all' || inv.branchCode === branchFilter;
    return matchesSearch && matchesStatus && matchesBranch;
  });

  const handleCreateInvoice = () => {
    // Generate new invoice number
    const newNumber = `INV-2024-${String(invoices.length + 1).padStart(3, '0')}`;
    toast.success(`Invoice ${newNumber} created`);
    setShowCreateModal(false);
    fetchInvoices();
  };

  const handleSendInvoice = (invoice: Invoice) => {
    toast.success(`Invoice ${invoice.invoiceNumber} sent to ${invoice.customer.email}`);
  };

  const handleDeleteInvoice = (id: string) => {
    setInvoices(prev => prev.filter(i => i.id !== id));
    toast.success('Invoice deleted');
  };

  const handleBulkAction = (action: string) => {
    if (selectedInvoices.length === 0) {
      toast.error('No invoices selected');
      return;
    }
    toast.success(`${action} applied to ${selectedInvoices.length} invoices`);
    setSelectedInvoices([]);
  };

  const addInvoiceItem = () => {
    setNewInvoice(prev => ({
      ...prev,
      items: [...prev.items, { id: String(prev.items.length + 1), description: '', quantity: 1, unitPrice: 0, total: 0 }]
    }));
  };

  const updateInvoiceItem = (index: number, field: string, value: any) => {
    setNewInvoice(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        items[index].total = items[index].quantity * items[index].unitPrice;
      }
      return { ...prev, items };
    });
  };

  const calculateTotals = () => {
    const subtotal = newInvoice.items.reduce((sum, item) => sum + item.total, 0);
    const taxAmount = (subtotal * newInvoice.tax) / 100;
    const total = subtotal + taxAmount - newInvoice.discount;
    return { subtotal, taxAmount, total };
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Invoice Management</h1>
              <p className="text-gray-600 mt-1">Create, track, and manage all invoices</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={fetchInvoices}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-2" />
                New Invoice
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Total Invoices</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-gray-300" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Paid</p>
                  <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-200" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Pending</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.sent}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-200" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Overdue</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-200" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Total Value</p>
                  <p className="text-lg font-bold">KES {stats.totalAmount.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-indigo-200" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Outstanding</p>
                  <p className="text-lg font-bold text-amber-600">KES {stats.pendingAmount.toLocaleString()}</p>
                </div>
                <ArrowUpRight className="h-8 w-8 text-amber-200" />
              </div>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by invoice number or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="overdue">Overdue</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Branches</option>
                {BRANCHES.map(b => (
                  <option key={b.code} value={b.code}>{b.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="From"
              />
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="To"
              />
            </div>

            {/* Bulk Actions */}
            {selectedInvoices.length > 0 && (
              <div className="mt-4 flex items-center gap-4 p-3 bg-indigo-50 rounded-lg">
                <span className="text-sm font-medium text-indigo-700">
                  {selectedInvoices.length} selected
                </span>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('Send')}>
                  <Send className="h-4 w-4 mr-1" /> Send All
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('Export')}>
                  <Download className="h-4 w-4 mr-1" /> Export
                </Button>
                <Button size="sm" variant="outline" className="text-red-600" onClick={() => setSelectedInvoices([])}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            )}
          </Card>

          {/* Invoice Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-left">
                      <input
                        type="checkbox"
                        checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                        onChange={(e) => setSelectedInvoices(e.target.checked ? filteredInvoices.map(i => i.id) : [])}
                        className="rounded"
                      />
                    </th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Invoice</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Branch</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Due Date</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredInvoices.map((invoice) => {
                    const StatusIcon = STATUS_CONFIG[invoice.status].icon;
                    return (
                      <motion.tr
                        key={invoice.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-50"
                      >
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedInvoices.includes(invoice.id)}
                            onChange={(e) => {
                              setSelectedInvoices(prev =>
                                e.target.checked
                                  ? [...prev, invoice.id]
                                  : prev.filter(id => id !== invoice.id)
                              );
                            }}
                            className="rounded"
                          />
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="font-medium text-indigo-600">{invoice.invoiceNumber}</p>
                              <p className="text-xs text-gray-500">{invoice.issueDate}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="font-medium">{invoice.customer.name}</p>
                          <p className="text-xs text-gray-500">{invoice.customer.email}</p>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">{invoice.branch}</Badge>
                        </td>
                        <td className="p-4">
                          <p className="font-semibold">KES {invoice.total.toLocaleString()}</p>
                          {invoice.balance > 0 && (
                            <p className="text-xs text-amber-600">Due: KES {invoice.balance.toLocaleString()}</p>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge className={STATUS_CONFIG[invoice.status].color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {STATUS_CONFIG[invoice.status].label}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <p className={`text-sm ${invoice.status === 'overdue' ? 'text-red-600 font-medium' : ''}`}>
                            {invoice.dueDate || '-'}
                          </p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedInvoice(invoice); setShowViewModal(true); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {invoice.status === 'draft' && (
                              <Button variant="ghost" size="sm" onClick={() => handleSendInvoice(invoice)}>
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm">
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500"
                              onClick={() => handleDeleteInvoice(invoice.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredInvoices.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No invoices found</p>
                </div>
              )}
            </div>
          </Card>

          {/* Create Invoice Modal */}
          <AnimatePresence>
            {showCreateModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setShowCreateModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 border-b sticky top-0 bg-white z-10">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold">Create New Invoice</h2>
                      <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)}>
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Customer Details */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" /> Customer Details
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <input
                          type="text"
                          placeholder="Customer Name *"
                          value={newInvoice.customer.name}
                          onChange={(e) => setNewInvoice(prev => ({
                            ...prev,
                            customer: { ...prev.customer, name: e.target.value }
                          }))}
                          className="px-3 py-2 border rounded-lg"
                        />
                        <input
                          type="email"
                          placeholder="Email"
                          value={newInvoice.customer.email}
                          onChange={(e) => setNewInvoice(prev => ({
                            ...prev,
                            customer: { ...prev.customer, email: e.target.value }
                          }))}
                          className="px-3 py-2 border rounded-lg"
                        />
                        <input
                          type="tel"
                          placeholder="Phone"
                          value={newInvoice.customer.phone}
                          onChange={(e) => setNewInvoice(prev => ({
                            ...prev,
                            customer: { ...prev.customer, phone: e.target.value }
                          }))}
                          className="px-3 py-2 border rounded-lg"
                        />
                        <select
                          value={newInvoice.branch}
                          onChange={(e) => setNewInvoice(prev => ({ ...prev, branch: e.target.value }))}
                          className="px-3 py-2 border rounded-lg"
                        >
                          <option value="">Select Branch *</option>
                          {BRANCHES.map(b => (
                            <option key={b.code} value={b.code}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        placeholder="Address"
                        value={newInvoice.customer.address}
                        onChange={(e) => setNewInvoice(prev => ({
                          ...prev,
                          customer: { ...prev.customer, address: e.target.value }
                        }))}
                        className="w-full mt-4 px-3 py-2 border rounded-lg"
                        rows={2}
                      />
                    </div>

                    {/* Invoice Items */}
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Invoice Items
                      </h3>
                      <div className="space-y-3">
                        {newInvoice.items.map((item, idx) => (
                          <div key={item.id} className="flex gap-3 items-center">
                            <input
                              type="text"
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) => updateInvoiceItem(idx, 'description', e.target.value)}
                              className="flex-1 px-3 py-2 border rounded-lg"
                            />
                            <input
                              type="number"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => updateInvoiceItem(idx, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-20 px-3 py-2 border rounded-lg"
                            />
                            <input
                              type="number"
                              placeholder="Unit Price"
                              value={item.unitPrice}
                              onChange={(e) => updateInvoiceItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-32 px-3 py-2 border rounded-lg"
                            />
                            <div className="w-32 px-3 py-2 bg-gray-50 rounded-lg text-right font-medium">
                              KES {item.total.toLocaleString()}
                            </div>
                            {newInvoice.items.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500"
                                onClick={() => setNewInvoice(prev => ({
                                  ...prev,
                                  items: prev.items.filter((_, i) => i !== idx)
                                }))}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={addInvoiceItem}>
                          <Plus className="h-4 w-4 mr-1" /> Add Item
                        </Button>
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="w-80 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal</span>
                          <span className="font-medium">KES {calculateTotals().subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Tax (%)</span>
                          <input
                            type="number"
                            value={newInvoice.tax}
                            onChange={(e) => setNewInvoice(prev => ({ ...prev, tax: parseFloat(e.target.value) || 0 }))}
                            className="w-20 px-2 py-1 border rounded text-right"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Discount</span>
                          <input
                            type="number"
                            value={newInvoice.discount}
                            onChange={(e) => setNewInvoice(prev => ({ ...prev, discount: parseFloat(e.target.value) || 0 }))}
                            className="w-32 px-2 py-1 border rounded text-right"
                          />
                        </div>
                        <div className="flex justify-between pt-2 border-t">
                          <span className="font-semibold">Total</span>
                          <span className="text-xl font-bold text-indigo-600">
                            KES {calculateTotals().total.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Due Date & Notes */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Due Date</label>
                        <input
                          type="date"
                          value={newInvoice.dueDate}
                          onChange={(e) => setNewInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Notes</label>
                        <input
                          type="text"
                          value={newInvoice.notes}
                          onChange={(e) => setNewInvoice(prev => ({ ...prev, notes: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg"
                          placeholder="Payment terms, thank you note, etc."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                    <Button variant="outline" onClick={handleCreateInvoice}>
                      <Edit2 className="h-4 w-4 mr-2" /> Save as Draft
                    </Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={handleCreateInvoice}>
                      <Send className="h-4 w-4 mr-2" /> Create & Send
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* View Invoice Modal */}
          <AnimatePresence>
            {showViewModal && selectedInvoice && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setShowViewModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold">{selectedInvoice.invoiceNumber}</h2>
                        <Badge className={STATUS_CONFIG[selectedInvoice.status].color}>
                          {STATUS_CONFIG[selectedInvoice.status].label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Printer className="h-4 w-4 mr-1" /> Print
                        </Button>
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-1" /> PDF
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowViewModal(false)}>
                          <X className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">Bill To:</h3>
                        <p className="font-medium">{selectedInvoice.customer.name}</p>
                        <p className="text-sm text-gray-600">{selectedInvoice.customer.email}</p>
                        <p className="text-sm text-gray-600">{selectedInvoice.customer.phone}</p>
                        <p className="text-sm text-gray-600">{selectedInvoice.customer.address}</p>
                      </div>
                      <div className="text-right">
                        <div className="space-y-1">
                          <p><span className="text-gray-500">Invoice Date:</span> {selectedInvoice.issueDate}</p>
                          <p><span className="text-gray-500">Due Date:</span> {selectedInvoice.dueDate}</p>
                          <p><span className="text-gray-500">Branch:</span> {selectedInvoice.branch}</p>
                        </div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="p-3 text-left text-xs font-semibold text-gray-600">Description</th>
                            <th className="p-3 text-right text-xs font-semibold text-gray-600">Qty</th>
                            <th className="p-3 text-right text-xs font-semibold text-gray-600">Unit Price</th>
                            <th className="p-3 text-right text-xs font-semibold text-gray-600">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {selectedInvoice.items.map(item => (
                            <tr key={item.id}>
                              <td className="p-3">{item.description}</td>
                              <td className="p-3 text-right">{item.quantity}</td>
                              <td className="p-3 text-right">KES {item.unitPrice.toLocaleString()}</td>
                              <td className="p-3 text-right font-medium">KES {item.total.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Totals */}
                    <div className="flex justify-end">
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Subtotal</span>
                          <span>KES {selectedInvoice.subtotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Tax (16%)</span>
                          <span>KES {selectedInvoice.tax.toLocaleString()}</span>
                        </div>
                        {selectedInvoice.discount > 0 && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount</span>
                            <span>-KES {selectedInvoice.discount.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-2 border-t font-bold">
                          <span>Total</span>
                          <span>KES {selectedInvoice.total.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-green-600">
                          <span>Paid</span>
                          <span>KES {selectedInvoice.amountPaid.toLocaleString()}</span>
                        </div>
                        {selectedInvoice.balance > 0 && (
                          <div className="flex justify-between text-red-600 font-bold pt-2 border-t">
                            <span>Balance Due</span>
                            <span>KES {selectedInvoice.balance.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {selectedInvoice.notes && (
                      <div className="p-4 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Notes:</span> {selectedInvoice.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-6 border-t bg-gray-50 flex justify-between">
                    <p className="text-sm text-gray-500">Created by: {selectedInvoice.createdBy}</p>
                    <div className="flex gap-3">
                      {selectedInvoice.status !== 'paid' && selectedInvoice.status !== 'cancelled' && (
                        <Button className="bg-green-600 hover:bg-green-700">
                          <DollarSign className="h-4 w-4 mr-2" /> Record Payment
                        </Button>
                      )}
                      {selectedInvoice.status === 'draft' && (
                        <Button className="bg-indigo-600 hover:bg-indigo-700">
                          <Send className="h-4 w-4 mr-2" /> Send Invoice
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
