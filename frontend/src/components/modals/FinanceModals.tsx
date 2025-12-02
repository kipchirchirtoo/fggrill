'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  X, Save, DollarSign, Calendar, FileText,
  CreditCard, User, Hash, Building, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { financeAPI } from '@/lib/api';

interface FinanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'create' | 'edit';
  initialData?: any;
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
      await financeAPI.processPayment(paymentData);
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
        className="bg-white rounded-xl p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
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
              name="reference"
              value={paymentData.reference}
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
    customerName: '',
    items: [],
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
        className="bg-white rounded-xl p-6 max-w-lg w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
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
