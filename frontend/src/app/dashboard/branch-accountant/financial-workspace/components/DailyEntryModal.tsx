'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { financeAPI } from '@/lib/api/finance';
import { toast } from 'sonner';
import { 
  X, DollarSign, CreditCard, Building, 
  ShoppingCart, Receipt, TrendingDown, Save, Send 
} from 'lucide-react';

interface DailyEntryModalProps {
  isOpen: boolean;
  onClose: (wasSaved: boolean) => void;
  date: Date;
  branchId: number;
  existingRecord?: any;
}

export function DailyEntryModal({ isOpen, onClose, date, branchId, existingRecord }: DailyEntryModalProps) {
  const [activeTab, setActiveTab] = useState<'revenue' | 'payments' | 'banking' | 'cogs' | 'expenses'>('revenue');
  const [isLoading, setIsLoading] = useState(false);

  // Form States
  const [revenue, setRevenue] = useState({
    restaurant: 0, bar: 0, pool: 0, spa: 0, wash: 0, conf: 0, catering: 0, rooms: 0, bills: 0, other: 0
  });
  
  const [payments, setPayments] = useState({
    cash: 0, mpesa: 0, card: 0
  });

  const [banking, setBanking] = useState({
    banked: 0, account: '', time: '', ref: ''
  });

  const [cogs, setCogs] = useState({
    opening: 0, central: 0, deliveries: 0, closing: 0
  });

  const [expenses, setExpenses] = useState({
    petty_cash: 0, suppliers: 0, transaction: 0, wastage: 0, shorts: 0, credit: 0, other: 0
  });

  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'FLAGGED'>('DRAFT');

  // Initialization
  useEffect(() => {
    if (existingRecord) {
      setRevenue(existingRecord.revenue_data || revenue);
      setPayments(existingRecord.payment_data || payments);
      setBanking(existingRecord.banking_data || banking);
      setCogs(existingRecord.cogs_data || cogs);
      setExpenses(existingRecord.expense_data || expenses);
      setNotes(existingRecord.notes || '');
      setStatus(existingRecord.status || 'DRAFT');
    }
  }, [existingRecord]);

  // Calculations
  const totalRevenue = Object.values(revenue).reduce((a, b) => Number(a) + Number(b), 0);
  const totalPayments = Object.values(payments).reduce((a, b) => Number(a) + Number(b), 0);
  const paymentVariance = totalPayments - totalRevenue;
  
  const expectedCash = payments.cash - expenses.petty_cash; // Simplistic
  const unbankedCash = expectedCash - banking.banked;

  const totalCogs = Number(cogs.opening) + Number(cogs.central) + Number(cogs.deliveries) - Number(cogs.closing);
  const totalExpenses = Object.values(expenses).reduce((a, b) => Number(a) + Number(b), 0);
  
  const netProfit = totalRevenue - (totalCogs + totalExpenses);

  const handleSave = async (submitStatus: 'DRAFT' | 'SUBMITTED') => {
    if (submitStatus === 'SUBMITTED' && Math.abs(paymentVariance) > 1) {
      toast.error('Cannot submit with a payment variance. Total payments must equal total revenue.');
      return;
    }

    setIsLoading(true);
    try {
      await financeAPI.workspace.saveDailyRecord({
        branch_id: branchId,
        record_date: format(date, 'yyyy-MM-dd'),
        status: submitStatus,
        revenue_data: revenue,
        total_revenue: totalRevenue,
        payment_data: payments,
        total_payments: totalPayments,
        banking_data: banking,
        expected_cash: expectedCash,
        unbanked_cash: unbankedCash,
        cogs_data: cogs,
        total_cogs: totalCogs,
        expense_data: expenses,
        total_expenses: totalExpenses,
        net_profit: netProfit,
        notes
      });
      
      toast.success(`Record ${submitStatus === 'SUBMITTED' ? 'submitted' : 'saved'} successfully`);
      onClose(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save record');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const isReadOnly = status === 'SUBMITTED' || status === 'REVIEWED';

  const handleInputChange = (setter: any, state: any, field: string, value: string) => {
    setter({ ...state, [field]: value === '' ? '' : Number(value) });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
          <div>
            <h2 className="text-xl font-bold text-stone-900">Financial Entry</h2>
            <p className="text-sm text-stone-500">{format(date, 'EEEE, MMMM do, yyyy')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
              status === 'SUBMITTED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
              status === 'REVIEWED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              status === 'FLAGGED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
              'bg-stone-100 text-stone-700 border-stone-200'
            }`}>
              {status}
            </span>
            <button onClick={() => onClose(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
              <X className="w-5 h-5 text-stone-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Tabs */}
          <div className="w-48 bg-stone-50 border-r border-stone-200 p-4 space-y-2 flex-shrink-0">
            {[
              { id: 'revenue', label: 'Revenue', icon: <DollarSign className="w-4 h-4" /> },
              { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
              { id: 'banking', label: 'Cash Banking', icon: <Building className="w-4 h-4" /> },
              { id: 'cogs', label: 'COGS', icon: <ShoppingCart className="w-4 h-4" /> },
              { id: 'expenses', label: 'Expenses', icon: <TrendingDown className="w-4 h-4" /> },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-[#007AFF] text-white shadow-sm' 
                    : 'text-stone-600 hover:bg-stone-200'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Main Area */}
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            
            {activeTab === 'revenue' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2">Revenue Breakdown</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(revenue).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                        {key.replace('_', ' ')}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={value}
                        onChange={(e) => handleInputChange(setRevenue, revenue, key, e.target.value)}
                        disabled={isReadOnly}
                        className="font-mono"
                      />
                    </div>
                  ))}
                </div>
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex justify-between items-center">
                  <span className="font-semibold text-stone-700">Total Revenue</span>
                  <span className="text-xl font-bold text-emerald-600">KES {totalRevenue.toLocaleString()}</span>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2">Payment Methods</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(payments).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                        {key}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={value}
                        onChange={(e) => handleInputChange(setPayments, payments, key, e.target.value)}
                        disabled={isReadOnly}
                        className="font-mono"
                      />
                    </div>
                  ))}
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-500">Total Revenue Recorded:</span>
                    <span className="font-mono font-medium">KES {totalRevenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-stone-500">Total Payments Recorded:</span>
                    <span className="font-mono font-medium">KES {totalPayments.toLocaleString()}</span>
                  </div>
                  <div className={`p-3 rounded-lg border flex justify-between items-center ${
                    Math.abs(paymentVariance) <= 1 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
                  }`}>
                    <span className={`font-semibold ${Math.abs(paymentVariance) <= 1 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      Variance (Must be 0)
                    </span>
                    <span className={`font-bold font-mono ${Math.abs(paymentVariance) <= 1 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      KES {paymentVariance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'banking' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 flex items-center gap-2">
                  <Building className="text-stone-400 w-5 h-5" /> 
                  Cash Banking Module
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Expected Cash (Cash Payments - Petty Cash)</label>
                    <Input value={`KES ${expectedCash.toLocaleString()}`} disabled className="font-mono bg-stone-50" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Amount Banked</label>
                    <Input
                      type="number"
                      min="0"
                      value={banking.banked}
                      onChange={(e) => handleInputChange(setBanking, banking, 'banked', e.target.value)}
                      disabled={isReadOnly}
                      className="font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Bank Account</label>
                    <Input
                      value={banking.account}
                      onChange={(e) => setBanking({ ...banking, account: e.target.value })}
                      disabled={isReadOnly}
                      placeholder="e.g. KCB - 123456789"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Reference Number</label>
                    <Input
                      value={banking.ref}
                      onChange={(e) => setBanking({ ...banking, ref: e.target.value })}
                      disabled={isReadOnly}
                      placeholder="e.g. TR-98765432"
                    />
                  </div>
                </div>

                {unbankedCash > 0 && (
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
                    <AlertCircle className="text-rose-500 w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-rose-800">Unbanked Cash Detected</h4>
                      <p className="text-xs text-rose-600 mt-1">
                        There is <span className="font-bold font-mono">KES {unbankedCash.toLocaleString()}</span> in expected cash that has not been recorded as banked. Please add a note explaining this if intentional.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'cogs' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2">Cost of Goods Sold (COGS)</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(cogs).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                        {key === 'central' ? 'From Central Store' : key.replace('_', ' ')}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={value}
                        onChange={(e) => handleInputChange(setCogs, cogs, key, e.target.value)}
                        disabled={isReadOnly}
                        className="font-mono"
                      />
                    </div>
                  ))}
                </div>
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex justify-between items-center">
                  <span className="text-sm text-stone-600">Formula: Opening + Central + Deliveries - Closing</span>
                  <div className="text-right">
                    <span className="block text-xs text-stone-500">Total COGS</span>
                    <span className="text-xl font-bold text-stone-800">KES {totalCogs.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'expenses' && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2">Daily Expenses</h3>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(expenses).map(([key, value]) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                        {key.replace('_', ' ')}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={value}
                        onChange={(e) => handleInputChange(setExpenses, expenses, key, e.target.value)}
                        disabled={isReadOnly}
                        className="font-mono"
                      />
                    </div>
                  ))}
                </div>
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex justify-between items-center">
                  <span className="font-semibold text-stone-700">Total Expenses</span>
                  <span className="text-xl font-bold text-rose-600">KES {totalExpenses.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* Notes Section - Visible on all tabs at the bottom */}
            <div className="mt-8">
              <label className="block text-sm font-medium text-stone-700 mb-2">Notes & Remarks</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isReadOnly}
                className="w-full h-24 p-3 rounded-xl border border-stone-200 focus:border-[#007AFF] focus:ring-1 focus:ring-[#007AFF] outline-none resize-none text-sm"
                placeholder="Add any context, explanations for variances, or unbanked cash remarks here..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-xs text-stone-500">Total Revenue</p>
              <p className="font-bold font-mono">KES {totalRevenue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-stone-500">Net Profit</p>
              <p className={`font-bold font-mono ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                KES {netProfit.toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <IOSButton variant="secondary" onClick={() => onClose(false)}>Cancel</IOSButton>
            {!isReadOnly && (
              <>
                <IOSButton 
                  variant="secondary" 
                  leftIcon={<Save />}
                  onClick={() => handleSave('DRAFT')}
                  disabled={isLoading}
                >
                  Save Draft
                </IOSButton>
                <IOSButton 
                  variant="primary" 
                  leftIcon={<Send />}
                  onClick={() => handleSave('SUBMITTED')}
                  disabled={isLoading}
                >
                  Submit
                </IOSButton>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
