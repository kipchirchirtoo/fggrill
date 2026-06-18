'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { financeAPI } from '@/lib/api/finance';
import { toast } from 'sonner';
import { 
  X, DollarSign, CreditCard, Building, 
  ShoppingCart, Receipt, TrendingDown, Save, Send, AlertCircle 
} from 'lucide-react';

interface DailyEntryModalProps {
  isOpen: boolean;
  onClose: (wasSaved: boolean) => void;
  date: Date;
  branchId: number;
  existingRecord?: any;
}

// Helper component for entry lists - defined outside to prevent focus loss on re-render
const EntryList = ({ 
  entries, 
  onChange, 
  label, 
  isReadOnly 
}: { 
  entries: any[], 
  onChange: (entries: any[]) => void, 
  label: string,
  isReadOnly: boolean 
}) => {
  const addEntry = () => onChange([...entries, { description: '', amount: 0 }]);
  const removeEntry = (index: number) => onChange(entries.filter((_, i) => i !== index));
  const updateEntry = (index: number, field: string, value: any) => {
    const newEntries = [...entries];
    newEntries[index] = { ...newEntries[index], [field]: value };
    onChange(newEntries);
  };

  return (
    <div className="space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold text-stone-700">{label}</label>
        {!isReadOnly && (
          <IOSButton variant="secondary" onClick={addEntry} className="h-8 py-0 text-xs">
            + Add Entry
          </IOSButton>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-stone-400 italic">No entries added.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                placeholder="Description"
                value={entry.description}
                onChange={(e) => updateEntry(idx, 'description', e.target.value)}
                disabled={isReadOnly}
                className="flex-1 h-9 text-sm"
              />
              <Input
                type="number"
                placeholder="Amount"
                value={entry.amount}
                onChange={(e) => updateEntry(idx, 'amount', Number(e.target.value))}
                disabled={isReadOnly}
                className="w-32 h-9 text-sm font-mono"
              />
              {!isReadOnly && (
                <button onClick={() => removeEntry(idx)} className="p-1 hover:bg-stone-200 rounded-full">
                  <X className="w-4 h-4 text-stone-400" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="pt-2 border-t border-stone-200 flex justify-between items-center">
        <span className="text-xs font-medium text-stone-500 uppercase">Total {label}</span>
        <span className="text-sm font-bold text-stone-900">
          KES {entries.reduce((sum, e) => sum + Number(e.amount), 0).toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export function DailyEntryModal({ isOpen, onClose, date, branchId, existingRecord }: DailyEntryModalProps) {

  const [activeTab, setActiveTab] = useState<'revenue' | 'payments' | 'banking' | 'cogs' | 'expenses'>('revenue');
  const [isLoading, setIsLoading] = useState(false);

  // Form States
  const [revenue, setRevenue] = useState({
    restaurant: 0,
    bar: 0,
    executive_bar: 0,
    sports_bar: 0,
    pool_table: 0,
    spa_sauna: 0,
    carwash: 0,
    conferences: 0,
    outside_catering: 0,
    rooms: 0,
    non_consumables: 0,
    swimming_pool: 0,
    other: 0
  });
  
  const [payments, setPayments] = useState({
    cash: 0, mpesa: 0, swipe: 0
  });

  const [banking, setBanking] = useState({
    banked: 0, 
    account: '', 
    time: '', 
    ref: '',
    entries: [] as Array<{ id: string, method: string, amount: number, account: string, reference: string, time: string, notes: string }>
  });

  const [cogs, setCogs] = useState({
    opening_balance: 0, 
    central_store_receipts: 0, 
    weekly_supplier_receipts: 0, 
    closing_balance: 0
  });

  const [expenses, setExpenses] = useState({
    petty_cash_total: 0,
    petty_cash_entries: [] as Array<{ description: string, amount: number }>,
    transaction_costs_total: 0,
    transaction_cost_entries: [] as Array<{ description: string, amount: number }>,
    direct_suppliers_total: 0,
    direct_supplier_entries: [] as Array<{ description: string, amount: number }>,
    wastage_total: 0,
    wastage_entries: [] as Array<{ description: string, amount: number }>,
    shorts_total: 0,
    shorts_entries: [] as Array<{ description: string, amount: number }>,
    other_expenses_total: 0,
    other_entries: [] as Array<{ description: string, amount: number }>
  });

  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'SUBMITTED' | 'REVIEWED' | 'FLAGGED'>('DRAFT');

  // Initialization
  useEffect(() => {
    if (existingRecord) {
      setRevenue({
        restaurant: existingRecord.revenue_data?.restaurant || 0,
        bar: existingRecord.revenue_data?.bar || 0,
        executive_bar: existingRecord.revenue_data?.executive_bar || 0,
        sports_bar: existingRecord.revenue_data?.sports_bar || 0,
        pool_table: existingRecord.revenue_data?.pool_table || existingRecord.revenue_data?.pool || 0,
        spa_sauna: existingRecord.revenue_data?.spa_sauna || existingRecord.revenue_data?.spa || 0,
        carwash: existingRecord.revenue_data?.carwash || existingRecord.revenue_data?.wash || 0,
        conferences: existingRecord.revenue_data?.conferences || existingRecord.revenue_data?.conf || 0,
        outside_catering: existingRecord.revenue_data?.outside_catering || existingRecord.revenue_data?.catering || 0,
        rooms: existingRecord.revenue_data?.rooms || 0,
        non_consumables: existingRecord.revenue_data?.non_consumables || 0,
        swimming_pool: existingRecord.revenue_data?.swimming_pool || 0,
        other: existingRecord.revenue_data?.other || 0
      });
      setPayments({
        cash: existingRecord.payment_data?.cash || 0,
        mpesa: existingRecord.payment_data?.mpesa || 0,
        swipe: existingRecord.payment_data?.swipe || existingRecord.payment_data?.card || 0
      });
      setBanking({
        banked: existingRecord.banking_data?.banked || 0,
        account: existingRecord.banking_data?.primary_account || existingRecord.banking_data?.account || '',
        time: existingRecord.banking_data?.time || '',
        ref: existingRecord.banking_data?.primary_reference || existingRecord.banking_data?.ref || '',
        entries: existingRecord.banking_data?.entries || existingRecord.banking_data?.history || []
      });
      setCogs({
        opening_balance: existingRecord.cogs_data?.opening_balance || existingRecord.cogs_data?.opening || 0,
        central_store_receipts: existingRecord.cogs_data?.central_store_receipts || existingRecord.cogs_data?.central || 0,
        weekly_supplier_receipts: existingRecord.cogs_data?.weekly_supplier_receipts || existingRecord.cogs_data?.deliveries || 0,
        closing_balance: existingRecord.cogs_data?.closing_balance || existingRecord.cogs_data?.closing || 0
      });
      setExpenses({
        petty_cash_total: existingRecord.expense_data?.petty_cash_total || existingRecord.expense_data?.petty_cash || 0,
        petty_cash_entries: existingRecord.expense_data?.petty_cash_entries || [],
        transaction_costs_total: existingRecord.expense_data?.transaction_costs_total || existingRecord.expense_data?.transaction || 0,
        transaction_cost_entries: existingRecord.expense_data?.transaction_cost_entries || [],
        direct_suppliers_total: existingRecord.expense_data?.direct_suppliers_total || existingRecord.expense_data?.suppliers || 0,
        direct_supplier_entries: existingRecord.expense_data?.direct_supplier_entries || [],
        wastage_total: existingRecord.expense_data?.wastage_total || existingRecord.expense_data?.wastage || 0,
        wastage_entries: existingRecord.expense_data?.wastage_entries || [],
        shorts_total: existingRecord.expense_data?.shorts_total || existingRecord.expense_data?.shorts || 0,
        shorts_entries: existingRecord.expense_data?.shorts_entries || [],
        other_expenses_total: existingRecord.expense_data?.other_expenses_total || existingRecord.expense_data?.other || 0,
        other_entries: existingRecord.expense_data?.other_entries || []
      });
      setNotes(existingRecord.notes || '');
      setStatus(existingRecord.status || 'DRAFT');
    }
  }, [existingRecord]);

  // Calculations
  const totalRevenue = Object.values(revenue).reduce((a, b) => Number(a) + Number(b), 0);
  const totalPayments = Object.values(payments).reduce((a, b) => Number(a) + Number(b), 0);
  const paymentVariance = totalPayments - totalRevenue;
  
  const entriesBankingTotal = banking.entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
  const totalBanked = entriesBankingTotal > 0 ? entriesBankingTotal : Number(banking.banked);
  
  const expectedCash = Number(payments.cash) - Number(expenses.petty_cash_total); 
  const unbankedCash = expectedCash - totalBanked;

  const totalCogs = Number(cogs.opening_balance) + Number(cogs.central_store_receipts) + Number(cogs.weekly_supplier_receipts) - Number(cogs.closing_balance);
  const totalExpenses = 
    Number(expenses.petty_cash_total) + 
    Number(expenses.transaction_costs_total) + 
    Number(expenses.direct_suppliers_total) + 
    Number(expenses.wastage_total) + 
    Number(expenses.shorts_total) + 
    Number(expenses.other_expenses_total);
  
  const netProfit = totalRevenue - (totalCogs + totalExpenses);

  const handleSave = async (submitStatus: 'DRAFT' | 'SUBMITTED') => {
    if (submitStatus === 'SUBMITTED' && Math.abs(paymentVariance) > 1) {
      toast.error('Cannot submit with a payment variance. Total payments must equal total revenue.');
      return;
    }

    setIsLoading(true);
    try {
      // SECURITY: Strip reference numbers from banking entries for Branch Accountants
      // References should only be added/verified by Auditors during review
      const sanitizedBankingEntries = banking.entries.map(entry => ({
        ...entry,
        reference: '' // Clear any reference data
      }));

      await financeAPI.workspace.saveDailyRecord({
        branch_id: branchId,
        record_date: format(date, 'yyyy-MM-dd'),
        status: submitStatus,
        revenue_data: revenue,
        total_revenue: totalRevenue,
        payment_data: payments,
        total_payments: totalPayments,
        banking_data: {
          ...banking,
          entries: sanitizedBankingEntries,
          banked: totalBanked,
          primary_account: banking.account,
          primary_reference: '' // Clear reference data
        },
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
                  {[
                    { key: 'restaurant', label: 'Restaurant' },
                    { key: 'bar', label: 'General Bar' },
                    { key: 'executive_bar', label: 'Executive Bar' },
                    { key: 'sports_bar', label: 'Sports Bar' },
                    { key: 'pool_table', label: 'Pool Table' },
                    { key: 'spa_sauna', label: 'Spa & Sauna' },
                    { key: 'carwash', label: 'Carwash' },
                    { key: 'conferences', label: 'Conferences' },
                    { key: 'outside_catering', label: 'Outside Catering' },
                    { key: 'rooms', label: 'Rooms' },
                    { key: 'non_consumables', label: 'Non-Consumables' },
                    { key: 'swimming_pool', label: 'Swimming Pool' },
                    { key: 'other', label: 'Other Revenue' }
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                        {label}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={(revenue as any)[key]}
                        onChange={(e) => handleInputChange(setRevenue, revenue, key, e.target.value)}
                        disabled={isReadOnly}
                        className="font-mono h-9"
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
                  {[
                    { key: 'cash', label: 'Cash' },
                    { key: 'mpesa', label: 'Mpesa' },
                    { key: 'swipe', label: 'Swipe (Card)' }
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                        {label}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={(payments as any)[key]}
                        onChange={(e) => handleInputChange(setPayments, payments, key, e.target.value)}
                        disabled={isReadOnly}
                        className="font-mono h-9"
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
                
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                   <label className="block text-xs font-medium text-stone-500 uppercase mb-1">Expected Cash (Cash Payments - Petty Cash)</label>
                   <p className="text-2xl font-bold font-mono text-[#007AFF]">KES {expectedCash.toLocaleString()}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-semibold text-stone-700">Banking History</h4>
                    {!isReadOnly && (
                      <IOSButton 
                        variant="secondary" 
                        className="h-8 py-0 text-xs"
                        onClick={() => setBanking({
                          ...banking,
                          entries: [...banking.entries, { 
                            id: crypto.randomUUID(), 
                            method: 'cash', 
                            amount: 0, 
                            account: '', 
                            reference: '', 
                            time: format(new Date(), 'HH:mm'),
                            notes: '' 
                          }]
                        })}
                      >
                        + Record Banking
                      </IOSButton>
                    )}
                  </div>

                  {banking.entries.length === 0 ? (
                    <div className="p-8 border-2 border-dashed border-stone-200 rounded-xl text-center">
                      <Building className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <p className="text-sm text-stone-400">No banking records for today yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {banking.entries.map((entry, idx) => (
                        <div key={entry.id || idx} className="p-4 bg-white border border-stone-200 rounded-xl shadow-sm space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-stone-400 uppercase">Amount</label>
                              <Input 
                                type="number" 
                                value={entry.amount} 
                                onChange={(e) => {
                                  const newEntries = [...banking.entries];
                                  newEntries[idx].amount = Number(e.target.value);
                                  setBanking({ ...banking, entries: newEntries });
                                }}
                                disabled={isReadOnly}
                                className="h-8 font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-stone-400 uppercase">Method</label>
                              <select
                                value={entry.method}
                                onChange={(e) => {
                                  const newEntries = [...banking.entries];
                                  newEntries[idx].method = e.target.value;
                                  setBanking({ ...banking, entries: newEntries });
                                }}
                                disabled={isReadOnly}
                                className="w-full h-8 px-2 text-sm rounded-md border border-stone-200 bg-white"
                              >
                                <option value="cash">Cash Deposit</option>
                                <option value="mpesa">Paybill/Mpesa</option>
                                <option value="swipe">Card Swipe</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-stone-400 uppercase">Account</label>
                              <Input 
                                value={entry.account} 
                                onChange={(e) => {
                                  const newEntries = [...banking.entries];
                                  newEntries[idx].account = e.target.value;
                                  setBanking({ ...banking, entries: newEntries });
                                }}
                                disabled={isReadOnly}
                                className="h-8"
                                placeholder="Bank Acc"
                              />
                            </div>
                            {/* SECURITY: Reference field hidden from Branch Accountants to prevent figure manipulation */}
                            {/* Only visible to Auditors/Directors during review */}
                          </div>
                          {!isReadOnly && (
                            <div className="flex justify-end">
                              <button 
                                onClick={() => {
                                  const newEntries = banking.entries.filter((_, i) => i !== idx);
                                  setBanking({ ...banking, entries: newEntries });
                                }}
                                className="text-xs text-rose-500 hover:text-rose-700 font-medium"
                              >
                                Remove Entry
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-stone-200 flex justify-between items-center font-semibold">
                  <span className="text-stone-600">Total Banked Today:</span>
                  <span className="text-xl text-stone-900 font-mono">KES {totalBanked.toLocaleString()}</span>
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
                  {[
                    { key: 'opening_balance', label: 'Stock Opening Balance' },
                    { key: 'central_store_receipts', label: 'From Central Store' },
                    { key: 'weekly_supplier_receipts', label: 'Weekly Supplier Deliveries' },
                    { key: 'closing_balance', label: 'Stock Closing Balance' }
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">
                        {label}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        value={(cogs as any)[key]}
                        onChange={(e) => handleInputChange(setCogs, cogs, key, e.target.value)}
                        disabled={isReadOnly}
                        className="font-mono h-9"
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
                <h3 className="text-lg font-semibold border-b pb-2">Daily Expenses Breakdown</h3>
                
                <EntryList 
                  label="Petty Cash" 
                  entries={expenses.petty_cash_entries}
                  onChange={(entries) => setExpenses({ 
                    ...expenses, 
                    petty_cash_entries: entries,
                    petty_cash_total: entries.reduce((sum, e) => sum + Number(e.amount), 0)
                  })}
                  isReadOnly={isReadOnly}
                />

                <EntryList 
                  label="Direct Suppliers" 
                  entries={expenses.direct_supplier_entries}
                  onChange={(entries) => setExpenses({ 
                    ...expenses, 
                    direct_supplier_entries: entries,
                    direct_suppliers_total: entries.reduce((sum, e) => sum + Number(e.amount), 0)
                  })}
                  isReadOnly={isReadOnly}
                />

                <EntryList 
                  label="Spoilt Items (Wastage)" 
                  entries={expenses.wastage_entries}
                  onChange={(entries) => setExpenses({ 
                    ...expenses, 
                    wastage_entries: entries,
                    wastage_total: entries.reduce((sum, e) => sum + Number(e.amount), 0)
                  })}
                  isReadOnly={isReadOnly}
                />

                <EntryList 
                  label="Lost Items (Shorts)" 
                  entries={expenses.shorts_entries}
                  onChange={(entries) => setExpenses({ 
                    ...expenses, 
                    shorts_entries: entries,
                    shorts_total: entries.reduce((sum, e) => sum + Number(e.amount), 0)
                  })}
                  isReadOnly={isReadOnly}
                />

                <EntryList 
                  label="Transaction Cost" 
                  entries={expenses.transaction_cost_entries}
                  onChange={(entries) => setExpenses({ 
                    ...expenses, 
                    transaction_cost_entries: entries,
                    transaction_costs_total: entries.reduce((sum, e) => sum + Number(e.amount), 0)
                  })}
                  isReadOnly={isReadOnly}
                />

                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex justify-between items-center">
                  <span className="font-semibold text-stone-700">Total Daily Expenses</span>
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
