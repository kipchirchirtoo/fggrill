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
  CreditCard, Plus, Search, Filter, Download, Eye, Trash2, Receipt,
  CheckCircle, Clock, AlertTriangle, XCircle, Printer, Calendar,
  DollarSign, Building2, User, ChevronDown, ArrowUpRight, ArrowDownRight,
  RefreshCw, X, Smartphone, Banknote, Landmark, FileText, Hash, Check,
  RotateCcw, Send, Copy, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';

// Payment types
type PaymentStatus = 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled';
type PaymentMethod = 'cash' | 'mpesa' | 'bank_transfer' | 'card' | 'cheque';

interface Payment {
  id: string;
  receiptNumber: string;
  invoiceNumber: string;
  invoiceId: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  amount: number;
  method: PaymentMethod;
  transactionRef: string;
  branch: string;
  branchCode: string;
  status: PaymentStatus;
  date: string;
  time: string;
  processedBy: string;
  notes: string;
}

const STATUS_CONFIG: Record<PaymentStatus, { label: string; color: string; icon: any }> = {
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: XCircle },
  refunded: { label: 'Refunded', color: 'bg-purple-100 text-purple-700', icon: RotateCcw },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500', icon: XCircle },
};

const METHOD_CONFIG: Record<PaymentMethod, { label: string; icon: any; color: string }> = {
  cash: { label: 'Cash', icon: Banknote, color: 'text-green-600 bg-green-50' },
  mpesa: { label: 'M-Pesa', icon: Smartphone, color: 'text-green-600 bg-green-50' },
  bank_transfer: { label: 'Bank Transfer', icon: Landmark, color: 'text-blue-600 bg-blue-50' },
  card: { label: 'Card', icon: CreditCard, color: 'text-purple-600 bg-purple-50' },
  cheque: { label: 'Cheque', icon: FileText, color: 'text-amber-600 bg-amber-50' },
};

const BRANCHES = [
  { id: 1, name: 'Bomet HQ', code: 'FGB-HQ' },
  { id: 2, name: 'Bomet Town', code: 'FGB-BMT' },
  { id: 3, name: 'Kericho', code: 'FGB-KER' },
  { id: 4, name: 'Kapsoit', code: 'FGB-KAP' },
  { id: 5, name: 'Mogogosiek', code: 'FGB-MOG' },
  { id: 6, name: 'Litein', code: 'FGB-LIT' },
];

export default function FinancePaymentsPage() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Stats
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalAmount: 0,
    todayAmount: 0,
    pendingAmount: 0,
    completedCount: 0,
    failedCount: 0,
    byMethod: {} as Record<string, number>,
  });

  // New payment form
  const [newPayment, setNewPayment] = useState({
    invoiceNumber: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    amount: 0,
    method: 'cash' as PaymentMethod,
    transactionRef: '',
    branch: '',
    notes: '',
  });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setIsLoading(true);
    try {
      // Simulated data - replace with actual API call
      const mockPayments: Payment[] = [
        {
          id: '1',
          receiptNumber: 'RCP-2024-001',
          invoiceNumber: 'INV-2024-001',
          invoiceId: '1',
          customer: { name: 'Safari Lodge Ltd', email: 'accounts@safarilodge.co.ke', phone: '+254 722 123456' },
          amount: 34800,
          method: 'mpesa',
          transactionRef: 'QK7XYZ9ABC',
          branch: 'Bomet HQ',
          branchCode: 'FGB-HQ',
          status: 'completed',
          date: '2024-11-28',
          time: '10:30 AM',
          processedBy: 'John Accountant',
          notes: 'Full payment received',
        },
        {
          id: '2',
          receiptNumber: 'RCP-2024-002',
          invoiceNumber: 'INV-2024-002',
          invoiceId: '2',
          customer: { name: 'Corporate Events Co', email: 'finance@corpevents.com', phone: '+254 733 456789' },
          amount: 82000,
          method: 'bank_transfer',
          transactionRef: 'FT24328KCB001',
          branch: 'Kericho',
          branchCode: 'FGB-KER',
          status: 'completed',
          date: '2024-11-27',
          time: '2:15 PM',
          processedBy: 'Jane Finance',
          notes: '50% deposit payment',
        },
        {
          id: '3',
          receiptNumber: 'RCP-2024-003',
          invoiceNumber: 'INV-2024-004',
          invoiceId: '4',
          customer: { name: 'New Client Corp', email: 'info@newclient.com', phone: '+254 700 111222' },
          amount: 69600,
          method: 'mpesa',
          transactionRef: '',
          branch: 'Bomet Town',
          branchCode: 'FGB-BMT',
          status: 'pending',
          date: '2024-11-28',
          time: '11:45 AM',
          processedBy: 'John Accountant',
          notes: 'Awaiting M-Pesa confirmation',
        },
        {
          id: '4',
          receiptNumber: 'RCP-2024-004',
          invoiceNumber: 'INV-2024-005',
          invoiceId: '5',
          customer: { name: 'Guest Walk-in', email: '', phone: '+254 712 345678' },
          amount: 15000,
          method: 'cash',
          transactionRef: 'CASH-001',
          branch: 'Litein',
          branchCode: 'FGB-LIT',
          status: 'completed',
          date: '2024-11-28',
          time: '9:00 AM',
          processedBy: 'Reception Staff',
          notes: 'Walk-in guest payment',
        },
        {
          id: '5',
          receiptNumber: 'RCP-2024-005',
          invoiceNumber: 'INV-2024-006',
          invoiceId: '6',
          customer: { name: 'Failed Payment Test', email: 'test@example.com', phone: '+254 700 000000' },
          amount: 25000,
          method: 'card',
          transactionRef: 'DECLINED-001',
          branch: 'Kapsoit',
          branchCode: 'FGB-KAP',
          status: 'failed',
          date: '2024-11-26',
          time: '4:30 PM',
          processedBy: 'Jane Finance',
          notes: 'Card declined - insufficient funds',
        },
        {
          id: '6',
          receiptNumber: 'RCP-2024-006',
          invoiceNumber: 'INV-2024-007',
          invoiceId: '7',
          customer: { name: 'Refund Customer', email: 'refund@example.com', phone: '+254 711 222333' },
          amount: 12000,
          method: 'mpesa',
          transactionRef: 'REF-QK123ABC',
          branch: 'Mogogosiek',
          branchCode: 'FGB-MOG',
          status: 'refunded',
          date: '2024-11-25',
          time: '3:00 PM',
          processedBy: 'John Accountant',
          notes: 'Booking cancelled - full refund issued',
        },
      ];

      setPayments(mockPayments);

      // Calculate stats
      const completed = mockPayments.filter(p => p.status === 'completed');
      const totalAmount = completed.reduce((sum, p) => sum + p.amount, 0);
      const today = new Date().toISOString().split('T')[0];
      const todayPayments = completed.filter(p => p.date === today);
      const todayAmount = todayPayments.reduce((sum, p) => sum + p.amount, 0);
      const pending = mockPayments.filter(p => p.status === 'pending');
      const pendingAmount = pending.reduce((sum, p) => sum + p.amount, 0);

      // By method
      const byMethod: Record<string, number> = {};
      completed.forEach(p => {
        byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      });

      setStats({
        totalPayments: mockPayments.length,
        totalAmount,
        todayAmount,
        pendingAmount,
        completedCount: completed.length,
        failedCount: mockPayments.filter(p => p.status === 'failed').length,
        byMethod,
      });
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast.error('Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter payments
  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.transactionRef.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || p.method === methodFilter;
    const matchesBranch = branchFilter === 'all' || p.branchCode === branchFilter;
    return matchesSearch && matchesStatus && matchesMethod && matchesBranch;
  });

  const handleRecordPayment = () => {
    const newReceiptNumber = `RCP-2024-${String(payments.length + 1).padStart(3, '0')}`;
    toast.success(`Payment recorded! Receipt: ${newReceiptNumber}`);
    setShowRecordModal(false);
    setNewPayment({
      invoiceNumber: '',
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      amount: 0,
      method: 'cash',
      transactionRef: '',
      branch: '',
      notes: '',
    });
    fetchPayments();
  };

  const handleRefund = (payment: Payment) => {
    toast.success(`Refund initiated for ${payment.receiptNumber}`);
  };

  const handlePrintReceipt = (payment: Payment) => {
    toast.success(`Printing receipt ${payment.receiptNumber}`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Payment Processing</h1>
              <p className="text-gray-600 mt-1">Record, track, and manage all payments</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={fetchPayments}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button onClick={() => setShowRecordModal(true)} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Total Received</p>
                  <p className="text-xl font-bold text-green-600">KES {stats.totalAmount.toLocaleString()}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-200" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Today</p>
                  <p className="text-xl font-bold text-blue-600">KES {stats.todayAmount.toLocaleString()}</p>
                </div>
                <Calendar className="h-8 w-8 text-blue-200" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Pending</p>
                  <p className="text-xl font-bold text-amber-600">KES {stats.pendingAmount.toLocaleString()}</p>
                </div>
                <Clock className="h-8 w-8 text-amber-200" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Completed</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completedCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-200" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Failed</p>
                  <p className="text-2xl font-bold text-red-600">{stats.failedCount}</p>
                </div>
                <XCircle className="h-8 w-8 text-red-200" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Transactions</p>
                  <p className="text-2xl font-bold">{stats.totalPayments}</p>
                </div>
                <Receipt className="h-8 w-8 text-gray-200" />
              </div>
            </Card>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(METHOD_CONFIG).map(([key, config]) => {
              const Icon = config.icon;
              const amount = stats.byMethod[key] || 0;
              return (
                <Card key={key} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${config.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{config.label}</p>
                      <p className="font-semibold">KES {amount.toLocaleString()}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by receipt, invoice, customer, or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              >
                <option value="all">All Methods</option>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
                <option value="cheque">Cheque</option>
              </select>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
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
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
              />
            </div>
          </Card>

          {/* Payments Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Receipt</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Invoice</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Customer</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Amount</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Method</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Date/Time</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPayments.map((payment) => {
                    const StatusIcon = STATUS_CONFIG[payment.status].icon;
                    const MethodIcon = METHOD_CONFIG[payment.method].icon;
                    return (
                      <motion.tr
                        key={payment.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="hover:bg-gray-50"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Receipt className="h-4 w-4 text-gray-400" />
                            <div>
                              <p className="font-medium text-green-600">{payment.receiptNumber}</p>
                              {payment.transactionRef && (
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                  Ref: {payment.transactionRef}
                                  <button onClick={() => copyToClipboard(payment.transactionRef)}>
                                    <Copy className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                                  </button>
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-indigo-600 font-medium">{payment.invoiceNumber}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-medium">{payment.customer.name}</p>
                          <p className="text-xs text-gray-500">{payment.customer.phone}</p>
                        </td>
                        <td className="p-4">
                          <p className="font-bold text-lg">KES {payment.amount.toLocaleString()}</p>
                        </td>
                        <td className="p-4">
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg ${METHOD_CONFIG[payment.method].color}`}>
                            <MethodIcon className="h-4 w-4" />
                            <span className="text-sm font-medium">{METHOD_CONFIG[payment.method].label}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge className={STATUS_CONFIG[payment.status].color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {STATUS_CONFIG[payment.status].label}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <p className="text-sm">{payment.date}</p>
                          <p className="text-xs text-gray-500">{payment.time}</p>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setSelectedPayment(payment); setShowViewModal(true); }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handlePrintReceipt(payment)}>
                              <Printer className="h-4 w-4" />
                            </Button>
                            {payment.status === 'completed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-purple-600"
                                onClick={() => handleRefund(payment)}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredPayments.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Receipt className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No payments found</p>
                </div>
              )}
            </div>
          </Card>

          {/* Record Payment Modal */}
          <AnimatePresence>
            {showRecordModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setShowRecordModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 border-b">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold">Record Payment</h2>
                      <Button variant="ghost" size="sm" onClick={() => setShowRecordModal(false)}>
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Invoice Link */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Link to Invoice (Optional)</label>
                      <input
                        type="text"
                        placeholder="Invoice Number (e.g., INV-2024-001)"
                        value={newPayment.invoiceNumber}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>

                    {/* Customer Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="block text-sm font-medium mb-2">Customer Name *</label>
                        <input
                          type="text"
                          placeholder="Customer Name"
                          value={newPayment.customerName}
                          onChange={(e) => setNewPayment(prev => ({ ...prev, customerName: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Phone</label>
                        <input
                          type="tel"
                          placeholder="+254 7XX XXX XXX"
                          value={newPayment.customerPhone}
                          onChange={(e) => setNewPayment(prev => ({ ...prev, customerPhone: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Email</label>
                        <input
                          type="email"
                          placeholder="customer@email.com"
                          value={newPayment.customerEmail}
                          onChange={(e) => setNewPayment(prev => ({ ...prev, customerEmail: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg"
                        />
                      </div>
                    </div>

                    {/* Payment Details */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Amount (KES) *</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          value={newPayment.amount || ''}
                          onChange={(e) => setNewPayment(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                          className="w-full px-3 py-2 border rounded-lg text-xl font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Branch *</label>
                        <select
                          value={newPayment.branch}
                          onChange={(e) => setNewPayment(prev => ({ ...prev, branch: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg"
                        >
                          <option value="">Select Branch</option>
                          {BRANCHES.map(b => (
                            <option key={b.code} value={b.code}>{b.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Payment Method *</label>
                      <div className="grid grid-cols-5 gap-2">
                        {Object.entries(METHOD_CONFIG).map(([key, config]) => {
                          const Icon = config.icon;
                          return (
                            <button
                              key={key}
                              onClick={() => setNewPayment(prev => ({ ...prev, method: key as PaymentMethod }))}
                              className={`p-3 rounded-lg border-2 transition-all ${
                                newPayment.method === key
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <Icon className={`h-6 w-6 mx-auto mb-1 ${newPayment.method === key ? 'text-green-600' : 'text-gray-400'}`} />
                              <span className="text-xs font-medium">{config.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Transaction Reference */}
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Transaction Reference
                        {newPayment.method === 'mpesa' && <span className="text-gray-500 font-normal"> (M-Pesa Code)</span>}
                        {newPayment.method === 'bank_transfer' && <span className="text-gray-500 font-normal"> (Bank Reference)</span>}
                      </label>
                      <input
                        type="text"
                        placeholder={
                          newPayment.method === 'mpesa' ? 'e.g., QK7XYZ9ABC' :
                          newPayment.method === 'bank_transfer' ? 'e.g., FT24328KCB001' :
                          'Reference number'
                        }
                        value={newPayment.transactionRef}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, transactionRef: e.target.value.toUpperCase() }))}
                        className="w-full px-3 py-2 border rounded-lg font-mono"
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Notes</label>
                      <textarea
                        placeholder="Additional notes..."
                        value={newPayment.notes}
                        onChange={(e) => setNewPayment(prev => ({ ...prev, notes: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
                    <div className="text-lg">
                      Total: <span className="font-bold text-2xl text-green-600">KES {newPayment.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setShowRecordModal(false)}>Cancel</Button>
                      <Button className="bg-green-600 hover:bg-green-700" onClick={handleRecordPayment}>
                        <Check className="h-4 w-4 mr-2" /> Record Payment
                      </Button>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* View Payment Modal */}
          <AnimatePresence>
            {showViewModal && selectedPayment && (
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
                  className="bg-white rounded-xl shadow-xl w-full max-w-md"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Receipt Header */}
                  <div className="p-6 border-b text-center">
                    <h2 className="text-xl font-bold">Famous Gate Hotel</h2>
                    <p className="text-sm text-gray-500">{selectedPayment.branch}</p>
                    <div className="mt-4">
                      <p className="text-2xl font-mono font-bold">{selectedPayment.receiptNumber}</p>
                      <Badge className={`mt-2 ${STATUS_CONFIG[selectedPayment.status].color}`}>
                        {STATUS_CONFIG[selectedPayment.status].label}
                      </Badge>
                    </div>
                  </div>

                  {/* Receipt Body */}
                  <div className="p-6 space-y-4">
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-gray-600">Date</span>
                      <span className="font-medium">{selectedPayment.date} {selectedPayment.time}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-gray-600">Customer</span>
                      <span className="font-medium">{selectedPayment.customer.name}</span>
                    </div>
                    {selectedPayment.customer.phone && (
                      <div className="flex justify-between py-2 border-b border-dashed">
                        <span className="text-gray-600">Phone</span>
                        <span className="font-medium">{selectedPayment.customer.phone}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-gray-600">Invoice</span>
                      <span className="font-medium text-indigo-600">{selectedPayment.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-dashed">
                      <span className="text-gray-600">Method</span>
                      <span className="font-medium">{METHOD_CONFIG[selectedPayment.method].label}</span>
                    </div>
                    {selectedPayment.transactionRef && (
                      <div className="flex justify-between py-2 border-b border-dashed">
                        <span className="text-gray-600">Reference</span>
                        <span className="font-mono font-medium">{selectedPayment.transactionRef}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-4 text-xl font-bold">
                      <span>Amount Paid</span>
                      <span className="text-green-600">KES {selectedPayment.amount.toLocaleString()}</span>
                    </div>
                    {selectedPayment.notes && (
                      <div className="p-3 bg-gray-50 rounded-lg text-sm">
                        <span className="text-gray-600">Notes:</span> {selectedPayment.notes}
                      </div>
                    )}
                  </div>

                  {/* Receipt Footer */}
                  <div className="p-6 border-t bg-gray-50">
                    <p className="text-xs text-gray-500 text-center mb-4">
                      Processed by: {selectedPayment.processedBy}
                    </p>
                    <div className="flex gap-3">
                      <Button variant="outline" className="flex-1" onClick={() => handlePrintReceipt(selectedPayment)}>
                        <Printer className="h-4 w-4 mr-2" /> Print
                      </Button>
                      <Button variant="outline" className="flex-1">
                        <Send className="h-4 w-4 mr-2" /> Email
                      </Button>
                      <Button variant="ghost" onClick={() => setShowViewModal(false)}>
                        <X className="h-4 w-4" />
                      </Button>
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
