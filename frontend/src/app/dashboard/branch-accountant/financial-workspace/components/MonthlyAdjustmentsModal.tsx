'use client';

import React, { useState, useEffect } from 'react';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { financeAPI } from '@/lib/api/finance';
import { toast } from 'sonner';
import { X, Save, Calculator, Landmark } from 'lucide-react';

interface MonthlyAdjustmentsModalProps {
  isOpen: boolean;
  onClose: (wasSaved: boolean) => void;
  year: number;
  month: number;
  branchId: number;
}

export function MonthlyAdjustmentsModal({ isOpen, onClose, year, month, branchId }: MonthlyAdjustmentsModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'expenses' | 'statements'>('expenses');
  const [adjustments, setAdjustments] = useState({
    electricity: 0,
    salaries: 0,
    water: 0,
    rent: 0,
    nssf: 0,
    shif: 0,
    tax: 0,
    levy: 0,
    licenses: 0
  });

  const [subscriptions, setSubscriptions] = useState({
    entries: [] as Array<{ description: string, amount: number }>,
    total: 0
  });

  const [statements, setStatements] = useState({
    cash_flow: { entries: [] as any[], notes: '' },
    balance_sheet: { entries: [] as any[], notes: '' }
  });
  
  useEffect(() => {
    const fetchAdjustments = async () => {
      try {
        const response = await financeAPI.workspace.getMonthlyAdjustments({
          branch_id: branchId,
          fiscal_year: year,
          fiscal_month: month
        });
        if (response.success && response.data.length > 0) {
          const data = response.data[0];
          setAdjustments({
            electricity: data.electricity || 0,
            salaries: data.salaries || 0,
            water: data.water || 0,
            rent: data.rent || 0,
            nssf: data.nssf || 0,
            shif: data.shif || 0,
            tax: data.tax || 0,
            levy: data.levy || 0,
            licenses: data.licenses || 0
          });
          setSubscriptions({
            entries: data.subscriptions?.entries || [],
            total: data.subscriptions?.total || 0
          });
          setStatements({
            cash_flow: data.cash_flow_data || { entries: [], notes: '' },
            balance_sheet: data.balance_sheet_data || { entries: [], notes: '' }
          });
        }
      } catch (error) {
        console.error('Failed to fetch monthly adjustments:', error);
      }
    };

    if (isOpen) {
      fetchAdjustments();
    }
  }, [isOpen, branchId, year, month]);

  const totalMonthlyExpenses = Object.values(adjustments).reduce((a, b) => Number(a) + Number(b), 0);

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await financeAPI.workspace.saveMonthlyAdjustment({
        branch_id: branchId,
        fiscal_year: year,
        fiscal_month: month,
        ...adjustments,
        subscriptions: {
          entries: subscriptions.entries,
          total: subscriptions.entries.reduce((sum, e) => sum + Number(e.amount), 0)
        },
        cash_flow_data: statements.cash_flow,
        balance_sheet_data: statements.balance_sheet,
        total_monthly_expenses: totalMonthlyExpenses
      });
      toast.success('Monthly adjustments saved successfully');
      onClose(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to save adjustments');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper component for entry lists
  const EntryList = ({ 
    entries, 
    onChange, 
    label 
  }: { 
    entries: any[], 
    onChange: (entries: any[]) => void, 
    label: string
  }) => {
    const addEntry = () => onChange([...entries, { description: '', amount: 0 }]);
    const removeEntry = (index: number) => onChange(entries.filter((_, i) => i !== index));
    const updateEntry = (index: number, field: string, value: any) => {
      const newEntries = [...entries];
      newEntries[index] = { ...newEntries[index], [field]: value };
      onChange(newEntries);
    };

    return (
      <div className="space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-200 mt-4">
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-stone-700">{label}</label>
          <IOSButton variant="secondary" onClick={addEntry} className="h-8 py-0 text-xs">
            + Add Entry
          </IOSButton>
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
                  className="flex-1 h-9 text-sm"
                />
                <Input
                  type="number"
                  placeholder="Amount"
                  value={entry.amount}
                  onChange={(e) => updateEntry(idx, 'amount', Number(e.target.value))}
                  className="w-32 h-9 text-sm font-mono"
                />
                <button onClick={() => removeEntry(idx)} className="p-1 hover:bg-stone-200 rounded-full">
                  <X className="w-4 h-4 text-stone-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleInputChange = (field: string, value: string) => {
    setAdjustments({ ...adjustments, [field]: value === '' ? '' : Number(value) });
  };

  if (!isOpen) return null;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-stone-50">
          <div>
            <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-[#007AFF]" />
              Monthly Adjustments
            </h2>
            <p className="text-sm text-stone-500">{monthNames[month - 1]} {year}</p>
          </div>
          <button onClick={() => onClose(false)} className="p-2 hover:bg-stone-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-stone-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-200">
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'expenses' ? 'text-[#007AFF] border-b-2 border-[#007AFF]' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Fixed & Recurring Expenses
          </button>
          <button
            onClick={() => setActiveTab('statements')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              activeTab === 'statements' ? 'text-[#007AFF] border-b-2 border-[#007AFF]' : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            Financial Statements
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'expenses' ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { key: 'salaries', label: 'Salaries & Wages' },
                  { key: 'rent', label: 'Rent' },
                  { key: 'electricity', label: 'Electricity' },
                  { key: 'water', label: 'Water' },
                  { key: 'nssf', label: 'NSSF Contributions' },
                  { key: 'shif', label: 'SHIF/NHIF' },
                  { key: 'tax', label: 'Corporate Tax' },
                  { key: 'levy', label: 'Catering Levy' },
                  { key: 'licenses', label: 'Licenses & Permits' }
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-stone-500 uppercase tracking-wider mb-1">{label}</label>
                    <Input
                      type="number"
                      value={(adjustments as any)[key]}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className="font-mono"
                    />
                  </div>
                ))}
              </div>

              <EntryList 
                label="Detailed Subscriptions" 
                entries={subscriptions.entries}
                onChange={(entries) => setSubscriptions({ 
                  ...subscriptions, 
                  entries,
                  total: entries.reduce((sum, e) => sum + Number(e.amount), 0)
                })}
              />

              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 flex justify-between items-center mt-6">
                <div className="flex items-center gap-2 text-stone-600">
                  <Calculator className="w-4 h-4" />
                  <span className="font-semibold">Total Monthly Adjustments</span>
                </div>
                <span className="text-xl font-bold text-[#007AFF]">
                  KES {(totalMonthlyExpenses + Number(subscriptions.total)).toLocaleString()}
                </span>
              </div>
            </>
          ) : (
            <div className="space-y-8">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">Cash Flow Statement Entries</h3>
                <EntryList 
                  label="Cash Flow Entries" 
                  entries={statements.cash_flow.entries}
                  onChange={(entries) => setStatements({
                    ...statements,
                    cash_flow: { ...statements.cash_flow, entries }
                  })}
                />
                <textarea
                  placeholder="Cash flow notes..."
                  value={statements.cash_flow.notes}
                  onChange={(e) => setStatements({
                    ...statements,
                    cash_flow: { ...statements.cash_flow, notes: e.target.value }
                  })}
                  className="w-full h-20 p-3 rounded-xl border border-stone-200 text-sm focus:ring-1 focus:ring-[#007AFF] outline-none"
                />
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold text-stone-900 uppercase tracking-wider">Balance Sheet Entries</h3>
                <EntryList 
                  label="Balance Sheet Entries" 
                  entries={statements.balance_sheet.entries}
                  onChange={(entries) => setStatements({
                    ...statements,
                    balance_sheet: { ...statements.balance_sheet, entries }
                  })}
                />
                <textarea
                  placeholder="Balance sheet notes..."
                  value={statements.balance_sheet.notes}
                  onChange={(e) => setStatements({
                    ...statements,
                    balance_sheet: { ...statements.balance_sheet, notes: e.target.value }
                  })}
                  className="w-full h-20 p-3 rounded-xl border border-stone-200 text-sm focus:ring-1 focus:ring-[#007AFF] outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-200 bg-stone-50 flex justify-end gap-3">
          <IOSButton variant="secondary" onClick={() => onClose(false)}>Cancel</IOSButton>
          <IOSButton 
            variant="primary" 
            leftIcon={<Save />}
            onClick={handleSave}
            disabled={isLoading}
          >
            Save Adjustments
          </IOSButton>
        </div>
      </div>
    </div>
  );
}
