'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Upload, FileText, Calculator, Search } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { toast } from 'sonner';

interface JournalEntry {
  id?: string;
  date: string;
  reference: string;
  description: string;
  debit_account: string;
  credit_account: string;
  amount: number;
  currency: string;
  department: string;
  category: 'revenue' | 'expense' | 'asset' | 'liability' | 'equity';
  tax_code?: string;
  project_code?: string;
  branch_id?: number;
  attachments: string[];
  status?: 'draft' | 'pending_review' | 'approved' | 'posted' | 'rejected';
  created_by?: string;
}

interface JournalEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (entry: JournalEntry) => void | Promise<void>;
  entry?: JournalEntry | null;
  branches?: Array<{ id: number; name: string }>;
}

// Chart of Accounts
const CHART_OF_ACCOUNTS = [
  // Assets
  { code: '1000', name: 'Cash and Cash Equivalents', type: 'asset' },
  { code: '1100', name: 'Accounts Receivable', type: 'asset' },
  { code: '1200', name: 'Inventory', type: 'asset' },
  { code: '1300', name: 'Prepaid Expenses', type: 'asset' },
  { code: '1400', name: 'Furniture & Equipment', type: 'asset' },
  { code: '1500', name: 'Accumulated Depreciation', type: 'asset' },
  
  // Liabilities
  { code: '2000', name: 'Accounts Payable', type: 'liability' },
  { code: '2100', name: 'Accrued Expenses', type: 'liability' },
  { code: '2200', name: 'Taxes Payable', type: 'liability' },
  { code: '2300', name: 'Deferred Revenue', type: 'liability' },
  
  // Equity
  { code: '3000', name: 'Owner\'s Equity', type: 'equity' },
  { code: '3100', name: 'Retained Earnings', type: 'equity' },
  
  // Revenue
  { code: '4000', name: 'Room Revenue', type: 'revenue' },
  { code: '4100', name: 'Restaurant Revenue', type: 'revenue' },
  { code: '4200', name: 'Bar Revenue', type: 'revenue' },
  { code: '4300', name: 'Other Revenue', type: 'revenue' },
  
  // Expenses
  { code: '5000', name: 'Cost of Goods Sold', type: 'expense' },
  { code: '5100', name: 'Salaries & Wages', type: 'expense' },
  { code: '5200', name: 'Utilities', type: 'expense' },
  { code: '5300', name: 'Rent Expense', type: 'expense' },
  { code: '5400', name: 'Marketing & Advertising', type: 'expense' },
  { code: '5500', name: 'Maintenance & Repairs', type: 'expense' },
  { code: '5600', name: 'Office Supplies', type: 'expense' },
  { code: '5700', name: 'Insurance', type: 'expense' },
  { code: '5800', name: 'Depreciation Expense', type: 'expense' },
  { code: '5900', name: 'Other Expenses', type: 'expense' }
];

const TAX_CODES = [
  { code: 'VAT0', name: 'VAT Exempt (0%)', rate: 0 },
  { code: 'VAT16', name: 'Standard VAT (16%)', rate: 0.16 },
  { code: 'VAT8', name: 'Reduced VAT (8%)', rate: 0.08 },
  { code: 'WHT5', name: 'Withholding Tax (5%)', rate: 0.05 },
  { code: 'WHT15', name: 'Withholding Tax (15%)', rate: 0.15 }
];

const DEPARTMENTS = [
  'Rooms Division',
  'Food & Beverage',
  'Bar Operations',
  'Housekeeping',
  'Maintenance',
  'Administration',
  'Marketing',
  'Human Resources',
  'Finance',
  'Other'
];

export function JournalEntryModal({ isOpen, onClose, onSave, entry, branches = [] }: JournalEntryModalProps) {
  const [formData, setFormData] = useState<JournalEntry>({
    date: new Date().toISOString().split('T')[0],
    reference: `JE${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 1000)}`,
    description: '',
    debit_account: '',
    credit_account: '',
    amount: 0,
    currency: 'KES',
    department: '',
    category: 'expense',
    tax_code: '',
    project_code: '',
    branch_id: branches[0]?.id,
    attachments: []
  });

  const [showAccountSearch, setShowAccountSearch] = useState<'debit' | 'credit' | null>(null);
  const [accountSearchTerm, setAccountSearchTerm] = useState('');
  const [calculatedTax, setCalculatedTax] = useState(0);

  useEffect(() => {
    if (entry) {
      setFormData(entry);
    }
  }, [entry]);

  useEffect(() => {
    // Calculate tax amount
    if (formData.tax_code) {
      const tax = TAX_CODES.find(t => t.code === formData.tax_code);
      if (tax) {
        setCalculatedTax(formData.amount * tax.rate);
      }
    } else {
      setCalculatedTax(0);
    }
  }, [formData.amount, formData.tax_code]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.debit_account || !formData.credit_account) {
      toast.error('Please select both debit and credit accounts');
      return;
    }
    
    if (formData.debit_account === formData.credit_account) {
      toast.error('Debit and credit accounts must be different');
      return;
    }
    
    if (formData.amount <= 0) {
      toast.error('Amount must be greater than 0');
      return;
    }
    
    onSave(formData);
    onClose();
  };

  const filteredAccounts = CHART_OF_ACCOUNTS.filter(account =>
    account.name.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
    account.code.includes(accountSearchTerm)
  );

  const selectAccount = (account: typeof CHART_OF_ACCOUNTS[0]) => {
    if (showAccountSearch === 'debit') {
      setFormData(prev => ({ ...prev, debit_account: `${account.code} - ${account.name}` }));
    } else if (showAccountSearch === 'credit') {
      setFormData(prev => ({ ...prev, credit_account: `${account.code} - ${account.name}` }));
    }
    setShowAccountSearch(null);
    setAccountSearchTerm('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {entry ? 'Edit Journal Entry' : 'Create Journal Entry'}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData(prev => ({ ...prev, reference: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg font-mono"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
              <select
                value={formData.branch_id || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, branch_id: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                {branches.map(branch => (
                  <option key={branch.id} value={branch.id}>{branch.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              rows={3}
              placeholder="Enter transaction description..."
              required
            />
          </div>

          {/* Account Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Debit Account</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.debit_account}
                  onChange={(e) => setFormData(prev => ({ ...prev, debit_account: e.target.value }))}
                  onFocus={() => setShowAccountSearch('debit')}
                  placeholder="Search or select account..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg pr-10"
                  required
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Credit Account</label>
              <div className="relative">
                <input
                  type="text"
                  value={formData.credit_account}
                  onChange={(e) => setFormData(prev => ({ ...prev, credit_account: e.target.value }))}
                  onFocus={() => setShowAccountSearch('credit')}
                  placeholder="Search or select account..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg pr-10"
                  required
                />
                <Search className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Account Search Modal */}
          {showAccountSearch && (
            <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
              <div className="p-2 border-b border-gray-200">
                <input
                  type="text"
                  value={accountSearchTerm}
                  onChange={(e) => setAccountSearchTerm(e.target.value)}
                  placeholder="Search accounts..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  autoFocus
                />
              </div>
              {filteredAccounts.map(account => (
                <button
                  key={account.code}
                  type="button"
                  onClick={() => selectAccount(account)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex justify-between">
                    <span className="font-medium">{account.name}</span>
                    <span className="text-sm text-gray-500">{account.code}</span>
                  </div>
                  <span className="text-xs text-gray-500 capitalize">{account.type}</span>
                </button>
              ))}
            </div>
          )}

          {/* Amount and Tax */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                min="0"
                step="0.01"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                <option value="KES">KES</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Code</label>
              <select
                value={formData.tax_code}
                onChange={(e) => setFormData(prev => ({ ...prev, tax_code: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              >
                <option value="">No Tax</option>
                {TAX_CODES.map(tax => (
                  <option key={tax.code} value={tax.code}>
                    {tax.code} - {tax.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tax Amount</label>
              <input
                type="text"
                value={calculatedTax.toFixed(2)}
                disabled
                className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50"
              />
            </div>
          </div>

          {/* Department and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                required
              >
                <option value="">Select Department</option>
                {DEPARTMENTS.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                required
              >
                <option value="revenue">Revenue</option>
                <option value="expense">Expense</option>
                <option value="asset">Asset</option>
                <option value="liability">Liability</option>
                <option value="equity">Equity</option>
              </select>
            </div>
          </div>

          {/* Project Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Code (Optional)</label>
            <input
              type="text"
              value={formData.project_code}
              onChange={(e) => setFormData(prev => ({ ...prev, project_code: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              placeholder="e.g., RENOVATION2024, MAINTENANCEQ1"
            />
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Attachments</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
              <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Drop files here or click to upload</p>
              <p className="text-xs text-gray-500 mt-1">Supports: PDF, Excel, Images (Max 10MB)</p>
              <button type="button" className="mt-2 text-blue-600 hover:text-blue-800 text-sm">
                Choose Files
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <IOSButton
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </IOSButton>
            <IOSButton type="submit">
              {entry ? 'Update Entry' : 'Create Entry'}
            </IOSButton>
          </div>
        </form>
      </div>
    </div>
  );
}
