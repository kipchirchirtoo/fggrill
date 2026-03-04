'use client';

import { useState, useEffect } from 'react';
import { X, DollarSign, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import FloatDisplay from './FloatDisplay';

interface CashPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  billTotal: number;
  shiftId: string;
  onPaymentComplete: (cashAmount: number, changeAmount: number) => void;
}

export default function CashPaymentModal({
  isOpen,
  onClose,
  billTotal,
  shiftId,
  onPaymentComplete
}: CashPaymentModalProps) {
  const [cashReceived, setCashReceived] = useState<string>('');
  const [floatRefreshTrigger, setFloatRefreshTrigger] = useState(0);

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setCashReceived('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const cashAmount = parseFloat(cashReceived) || 0;
  const changeAmount = Math.max(0, cashAmount - billTotal);
  const isValidPayment = cashAmount >= billTotal && cashAmount > 0;
  const hasValidDecimals = /^\d+(\.\d{0,2})?$/.test(cashReceived) || cashReceived === '';

  const formatCurrency = (amount: number): string => {
    return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleCashReceivedChange = (value: string) => {
    // Allow empty string, numbers, and one decimal point
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setCashReceived(value);
    }
  };

  const handleConfirmPayment = () => {
    if (!isValidPayment) {
      toast.error('Cash received must be greater than or equal to bill total');
      return;
    }

    if (!hasValidDecimals) {
      toast.error('Cash amount can have at most 2 decimal places');
      return;
    }

    onPaymentComplete(cashAmount, changeAmount);
    setFloatRefreshTrigger(prev => prev + 1);
    onClose();
  };

  const handleQuickAmount = (amount: number) => {
    setCashReceived(amount.toString());
  };

  // Quick amount buttons (common denominations)
  const quickAmounts = [
    billTotal, // Exact amount
    Math.ceil(billTotal / 100) * 100, // Round up to nearest 100
    Math.ceil(billTotal / 500) * 500, // Round up to nearest 500
    Math.ceil(billTotal / 1000) * 1000, // Round up to nearest 1000
  ].filter((amount, index, self) => self.indexOf(amount) === index); // Remove duplicates

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Cash Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Float Display */}
          <FloatDisplay shiftId={shiftId} refreshTrigger={floatRefreshTrigger} />

          {/* Bill Total */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-700 mb-1">Bill Total</p>
            <p className="text-3xl font-bold text-blue-900">{formatCurrency(billTotal)}</p>
          </div>

          {/* Cash Received Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cash Received <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <span className="text-gray-500 font-medium">KES</span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                value={cashReceived}
                onChange={(e) => handleCashReceivedChange(e.target.value)}
                placeholder="0.00"
                className={`w-full pl-16 pr-4 py-4 text-2xl font-bold border-2 rounded-lg focus:outline-none focus:ring-2 ${
                  cashReceived && !isValidPayment
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-200'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
                }`}
                autoFocus
              />
            </div>
            {cashReceived && !hasValidDecimals && (
              <p className="mt-2 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                Maximum 2 decimal places allowed
              </p>
            )}
            {cashReceived && cashAmount < billTotal && (
              <p className="mt-2 text-sm text-red-600 flex items-center">
                <AlertCircle className="w-4 h-4 mr-1" />
                Insufficient payment: Need {formatCurrency(billTotal - cashAmount)} more
              </p>
            )}
          </div>

          {/* Quick Amount Buttons */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Quick Amounts</p>
            <div className="grid grid-cols-4 gap-2">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  onClick={() => handleQuickAmount(amount)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-semibold text-gray-700 transition-colors"
                >
                  {amount.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Change Display */}
          {cashAmount >= billTotal && (
            <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4">
              <p className="text-sm text-yellow-700 mb-1">Change to Give</p>
              <p className="text-3xl font-bold text-yellow-900">{formatCurrency(changeAmount)}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-6 py-3 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmPayment}
            disabled={!isValidPayment || !hasValidDecimals}
            className={`px-8 py-3 rounded-lg font-bold text-white transition-all ${
              isValidPayment && hasValidDecimals
                ? 'bg-green-600 hover:bg-green-700 shadow-lg hover:shadow-xl'
                : 'bg-gray-300 cursor-not-allowed'
            }`}
          >
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
}
