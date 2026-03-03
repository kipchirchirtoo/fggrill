'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X, Save, DollarSign, Calendar, FileText,
  CreditCard, User, Hash, Building, Clock,
  Plus, Minus, Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { financeAPI, folioAPI } from '@/lib/api';

interface FinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialData?: any;
}

export function FolioModal({ isOpen, onClose, initialData }: FinanceModalProps) {
  const [folio, setFolio] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const fetchFolio = async () => {
    if (!initialData?.id) return;
    setIsLoading(true);
    try {
      const res = await folioAPI.getFolio(initialData.id);
      if (res.success || res.data) {
        setFolio(res.data?.folio || res.folio || res.data);
        setTransactions(res.data?.transactions || res.transactions || []);
      }
    } catch (error) {
      toast.error('Failed to load folio details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFolio();
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.95 }}
          className="bg-white rounded-xl p-5 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Folio Management</h2>
              <p className="text-sm text-gray-500">
                Reservation: {initialData?.confirmation_number || initialData?.id?.slice(0, 8)} • Guest: {initialData?.guest_name}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
              <X className="h-5 w-5" />
            </button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center">
              <div className="animate-spin h-8 w-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-2 text-gray-500">Loading folio details...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-4 rounded-ios-lg">
                  <p className="text-sm text-gray-500">Total Charges</p>
                  <p className="text-lg font-bold">KES {folio?.totalCharges?.toLocaleString() ?? 0}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-ios-lg">
                  <p className="text-sm text-gray-500">Total Payments</p>
                  <p className="text-lg font-bold text-green-600">KES {folio?.totalPayments?.toLocaleString() ?? 0}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-ios-lg">
                  <p className="text-sm text-gray-500">Balance Due</p>
                  <p className={`text-lg font-bold ${folio?.balance > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    KES {folio?.balance?.toLocaleString() ?? 0}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-ios-lg">
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${folio?.status === 'closed' ? 'bg-gray-200 text-gray-800' : 'bg-green-100 text-green-800'
                    }`}>
                    {(folio?.status || 'OPEN').toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm border-b pb-4">
                <div>
                  <span className="text-gray-500">Room:</span> KES {folio?.roomCharges?.toLocaleString() ?? 0}
                </div>
                <div>
                  <span className="text-gray-500">Food:</span> KES {folio?.foodCharges?.toLocaleString() ?? 0}
                </div>
                <div>
                  <span className="text-gray-500">Beverage:</span> KES {folio?.beverageCharges?.toLocaleString() ?? 0}
                </div>
                <div>
                  <span className="text-gray-500">Other:</span> KES {folio?.otherCharges?.toLocaleString() ?? 0}
                </div>
              </div>

              {/* Transactions Table */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-900">Transactions</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddCharge(true)}
                      className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-ios-lg hover:bg-gray-200 flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" /> Add Charge
                    </button>
                    <button
                      onClick={() => setShowPayment(true)}
                      className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700 flex items-center gap-1"
                    >
                      <DollarSign className="h-4 w-4" /> Add Payment
                    </button>
                  </div>
                </div>
                <div className="border rounded-ios-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Type</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">Description</th>
                        <th className="px-4 py-3 text-right font-medium text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-left font-medium text-gray-700">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                            No transactions found
                          </td>
                        </tr>
                      ) : (
                        transactions.map((t: any) => (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-600">
                              {new Date(t.createdAt).toLocaleDateString()}
                              <div className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleTimeString()}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 text-xs rounded-full ${t.type === 'payment' ? 'bg-green-100 text-green-800' :
                                t.type === 'refund' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                {t.type.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-900">{t.description}</td>
                            <td className={`px-4 py-3 text-right font-medium ${t.type === 'payment' ? 'text-green-600' : 'text-gray-900'
                              }`}>
                              {t.type === 'payment' ? '-' : ''}KES {t.amount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">
                              {t.performedBy || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>

      <AddChargeModal
        isOpen={showAddCharge}
        onClose={() => setShowAddCharge(false)}
        initialData={{ bookingId: initialData?.id }}
        onSuccess={fetchFolio}
      />

      <PaymentModal
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        initialData={{ bookingId: initialData?.id }}
      // You might need to add onSuccess prop to PaymentModal to refresh folio
      // For now, assume user refreshes manually or we trigger fetchFolio on close
      />
    </>
  );
}

export function AddChargeModal({ isOpen, onClose, initialData, onSuccess }: any) {
  const [charge, setCharge] = useState({
    type: 'charge',
    category: 'other',
    amount: 0,
    description: '',
    quantity: 1
  });

  const handleSubmit = async () => {
    try {
      // Map 'type' to 'transaction_type' for backend consistency
      const payload = {
        ...charge,
        transaction_type: charge.type === 'payment' ? 'credit' : 'debit',
        amount: charge.amount,
        description: charge.description
      };
      await folioAPI.addTransaction(initialData.bookingId, payload);
      toast.success('Charge added');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('Failed to add charge');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
    >
      <div className="bg-white rounded-xl p-5 max-w-sm w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-3">Add Charge</h3>
        <div className="space-y-3">
          <select
            className="w-full p-2 border rounded"
            value={charge.category}
            onChange={e => setCharge({ ...charge, category: e.target.value })}
          >
            <option value="room">Room Charge</option>
            <option value="food">Food</option>
            <option value="beverage">Beverage</option>
            <option value="other">Other</option>
          </select>
          <input
            type="number"
            placeholder="Amount"
            className="w-full p-2 border rounded"
            value={charge.amount}
            onChange={e => setCharge({ ...charge, amount: Number(e.target.value) })}
          />
          <input
            type="text"
            placeholder="Description"
            className="w-full p-2 border rounded"
            value={charge.description}
            onChange={e => setCharge({ ...charge, description: e.target.value })}
          />
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={onClose} className="px-4 py-2 text-gray-600">Cancel</button>
            <button onClick={handleSubmit} className="px-4 py-2 bg-indigo-600 text-white rounded">Add</button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function PaymentModal({ isOpen, onClose, mode = 'create', initialData }: FinanceModalProps) {
  const [paymentData, setPaymentData] = useState(initialData || {
    bookingId: '',
    amount: 0,
    paymentMethod: 'cash',
    reference: '',
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setPaymentData((prev: { bookingId: string; amount: number; paymentMethod: string; reference: string; notes: string }) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        invoiceId: paymentData.invoiceId,
        bookingId: paymentData.bookingId,
        amount: Number(paymentData.amount),
        paymentMethod: paymentData.paymentMethod,
        paymentReference: paymentData.paymentReference || paymentData.reference,
        notes: paymentData.notes
      };
      await financeAPI.processPayment(payload);
      toast.success('Payment processed successfully!');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process payment');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'create' ? 'Process Payment' : 'Edit Payment'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Booking ID
            </label>
            <input
              type="text"
              name="bookingId"
              value={paymentData.bookingId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount (KES)
            </label>
            <input
              type="number"
              name="amount"
              value={paymentData.amount}
              onChange={handleChange}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              name="paymentMethod"
              value={paymentData.paymentMethod}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mpesa">M-Pesa</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reference Number
            </label>
            <input
              type="text"
              name="paymentReference"
              value={paymentData.paymentReference || paymentData.reference || ''}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              name="notes"
              value={paymentData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700"
          >
            <Save className="inline h-4 w-4 mr-2" />
            {mode === 'create' ? 'Process Payment' : 'Update Payment'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function InvoiceModal({ isOpen, onClose, mode = 'create', initialData }: FinanceModalProps) {
  const [invoiceData, setInvoiceData] = useState(initialData || {
    bookingId: '',
    guestId: '',
    customerName: '',
    items: [],
    totalAmount: 0,
    dueDate: '',
    notes: ''
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setInvoiceData((prev: { bookingId: string; customerName: string; items: any[]; dueDate: string; notes: string }) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async () => {
    try {
      await financeAPI.createInvoice(invoiceData);
      toast.success('Invoice generated successfully!');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate invoice');
    }
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="bg-white rounded-xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {mode === 'create' ? 'Generate Invoice' : 'Edit Invoice'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Booking ID
            </label>
            <input
              type="text"
              name="bookingId"
              value={invoiceData.bookingId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Customer Name
            </label>
            <input
              type="text"
              name="customerName"
              value={invoiceData.customerName}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              name="dueDate"
              value={invoiceData.dueDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes
            </label>
            <textarea
              name="notes"
              value={invoiceData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-ios-lg"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6 pt-6 border-t">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-indigo-600 text-white rounded-ios-lg hover:bg-indigo-700"
          >
            <FileText className="inline h-4 w-4 mr-2" />
            {mode === 'create' ? 'Generate Invoice' : 'Update Invoice'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
