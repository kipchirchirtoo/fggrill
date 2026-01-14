'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, CreditCard, Smartphone, Banknote, DollarSign,
  CheckCircle, XCircle, Loader2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { paymentsAPI, folioAPI } from '@/lib/api';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  folioId: string;
  guestId?: string;
  guestName: string;
  currentBalance: number;
  onPaymentComplete?: () => void;
}

type PaymentMethod = 'card' | 'mpesa' | 'cash';
type PaymentStatus = 'idle' | 'processing' | 'success' | 'failed';

export default function PaymentModal({
  isOpen,
  onClose,
  folioId,
  guestId,
  guestName,
  currentBalance,
  onPaymentComplete,
}: PaymentModalProps) {
  const [amount, setAmount] = useState<number>(currentBalance > 0 ? currentBalance : 0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount(currentBalance > 0 ? currentBalance : 0);
      setStatus('idle');
      setError('');
      setPaymentIntentId(null);
    }
  }, [isOpen, currentBalance]);

  const handleSubmit = async () => {
    if (amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (paymentMethod === 'mpesa' && !phoneNumber) {
      setError('Please enter M-Pesa phone number');
      return;
    }

    setStatus('processing');
    setError('');

    try {
      if (paymentMethod === 'mpesa') {
        // M-Pesa STK Push flow
        const response = await paymentsAPI.initiateMpesa({
          phoneNumber: phoneNumber.replace(/\D/g, ''),
          amount,
          folioId,
        });

        if (response.success) {
          toast.info('Check your phone for M-Pesa prompt');
          // Poll for status (simplified for demo)
          setTimeout(() => {
            setStatus('success');
            onPaymentComplete?.();
          }, 5000);
        } else {
          throw new Error(response.message || 'M-Pesa request failed');
        }
      } else if (paymentMethod === 'cash') {
        // Direct cash payment - record immediately
        const response = await folioAPI.addTransaction(folioId, {
          type: 'payment',
          description: 'Cash payment',
          amount,
          paymentMethod: 'cash',
        });

        if (response.success) {
          setStatus('success');
          toast.success('Cash payment recorded');
          onPaymentComplete?.();
        } else {
          throw new Error(response.message || 'Failed to record payment');
        }
      } else {
        // Card payment - create intent and confirm
        const intentResponse = await paymentsAPI.createFolioIntent({
          folioId,
          amount,
          paymentMethod: 'card',
          guestId,
        });

        if (!intentResponse.success) {
          throw new Error(intentResponse.message || 'Failed to create payment');
        }

        setPaymentIntentId(intentResponse.data.paymentIntentId);

        // Simulate card processing delay
        await new Promise((resolve) => setTimeout(resolve, 1500));

        // Confirm payment
        const confirmResponse = await paymentsAPI.confirmPayment(intentResponse.data.paymentIntentId);

        if (confirmResponse.success && confirmResponse.data.status === 'completed') {
          setStatus('success');
          toast.success('Payment successful');
          onPaymentComplete?.();
        } else {
          throw new Error(confirmResponse.data?.message || 'Payment failed');
        }
      }
    } catch (err: any) {
      setStatus('failed');
      setError(err.message || 'Payment failed');
      toast.error(err.message || 'Payment failed');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Process Payment
              </h2>
              <p className="text-sm text-gray-500">
                {guestName}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={status === 'processing'}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-5">
            {/* Status Display */}
            {status === 'success' && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Payment Successful
                </h3>
                <p className="text-gray-500 mb-4">
                  {formatCurrency(amount)} has been received
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Done
                </button>
              </motion.div>
            )}

            {status === 'failed' && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-8"
              >
                <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Payment Failed
                </h3>
                <p className="text-red-500 mb-4">
                  {error || 'An error occurred processing payment'}
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </motion.div>
            )}

            {status === 'processing' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8"
              >
                <Loader2 className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Processing Payment
                </h3>
                <p className="text-gray-500">
                  {paymentMethod === 'mpesa'
                    ? 'Waiting for M-Pesa confirmation...'
                    : 'Please wait...'}
                </p>
              </motion.div>
            )}

            {status === 'idle' && (
              <div className="space-y-6">
                {/* Error Display */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm">{error}</span>
                  </div>
                )}

                {/* Balance Info */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Outstanding Balance</span>
                    <span className="text-xl font-bold text-gray-900">
                      {formatCurrency(currentBalance)}
                    </span>
                  </div>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Amount
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                      placeholder="0"
                      min="0"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {[1000, 5000, 10000].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setAmount(preset)}
                        className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        {formatCurrency(preset)}
                      </button>
                    ))}
                    <button
                      onClick={() => setAmount(currentBalance)}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-colors"
                    >
                      Full Balance
                    </button>
                  </div>
                </div>

                {/* Payment Method Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Method
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      onClick={() => setPaymentMethod('card')}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'card'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <CreditCard className={`w-6 h-6 ${paymentMethod === 'card' ? 'text-blue-600' : 'text-gray-500'}`} />
                      <span className={`text-sm font-medium ${paymentMethod === 'card' ? 'text-blue-700' : 'text-gray-700'}`}>
                        Card
                      </span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('mpesa')}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'mpesa'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <Smartphone className={`w-6 h-6 ${paymentMethod === 'mpesa' ? 'text-green-600' : 'text-gray-500'}`} />
                      <span className={`text-sm font-medium ${paymentMethod === 'mpesa' ? 'text-green-700' : 'text-gray-700'}`}>
                        M-Pesa
                      </span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === 'cash'
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                        }`}
                    >
                      <Banknote className={`w-6 h-6 ${paymentMethod === 'cash' ? 'text-amber-600' : 'text-gray-500'}`} />
                      <span className={`text-sm font-medium ${paymentMethod === 'cash' ? 'text-amber-700' : 'text-gray-700'}`}>
                        Cash
                      </span>
                    </button>
                  </div>
                </div>

                {/* M-Pesa Phone Number */}
                {paymentMethod === 'mpesa' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      M-Pesa Phone Number
                    </label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="tel"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        placeholder="254712345678"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Format: 254XXXXXXXXX</p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  onClick={handleSubmit}
                  disabled={amount <= 0}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <DollarSign className="w-5 h-5" />
                  Process {formatCurrency(amount)}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
