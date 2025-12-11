'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { accountingAPI } from '@/lib/api';
import { 
  FileText, Plus, Search, Filter, Download, Eye, Edit3, CheckCircle, 
  Clock, AlertCircle, TrendingUp, TrendingDown, DollarSign, Receipt,
  Calculator, FileSpreadsheet, UserCheck, Shield, BarChart3, Activity,
  Calendar, Building2, CreditCard, Wallet, PiggyBank, Target, Scale,
  Stamp, Signature, FileSignature, Archive, RefreshCw, ChevronDown, X
} from 'lucide-react';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { JournalEntryModal } from '@/components/accounting/journal-entry-modal';
import { toast } from 'sonner';

// Types for accounting entries
interface JournalEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  debit_account: string;
  credit_account: string;
  amount: number;
  currency: string;
  status: 'draft' | 'pending_review' | 'approved' | 'posted' | 'rejected';
  created_by: string;
  reviewed_by?: string;
  reviewed_at?: string;
  posted_at?: string;
  attachments: string[];
  branch_id?: number;
  department: string;
  category: 'revenue' | 'expense' | 'asset' | 'liability' | 'equity';
  tax_code?: string;
  project_code?: string;
}

interface AuditTrail {
  id: string;
  entry_id: string;
  action: string;
  user: string;
  timestamp: string;
  details: string;
  ip_address: string;
}

interface ReconciliationItem {
  id: string;
  account_name: string;
  account_type: string;
  book_balance: number;
  bank_balance: number;
  difference: number;
  last_reconciled: string;
  status: 'reconciled' | 'pending' | 'discrepancy';
  reconciled_by?: string;
}

interface Workpaper {
  id: string;
  title: string;
  type: 'workpaper' | 'schedule' | 'supporting_document';
  period: string;
  status: 'draft' | 'in_review' | 'completed';
  prepared_by: string;
  reviewed_by?: string;
  file_url?: string;
  created_at: string;
}

export default function AccountingWorkspace() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'entries' | 'review' | 'reconciliation' | 'audit' | 'reports'>('entries');
  const [isLoading, setIsLoading] = useState(false);
  
  // Entries state
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  
  // Review queue state
  const [reviewQueue, setReviewQueue] = useState<JournalEntry[]>([]);
  
  // Reconciliation state
  const [reconciliations, setReconciliations] = useState<ReconciliationItem[]>([]);
  
  // Audit state
  const [auditTrail, setAuditTrail] = useState<AuditTrail[]>([]);
  const [workpapers, setWorkpapers] = useState<Workpaper[]>([]);
  
  // Filters
  const [filters, setFilters] = useState({
    status: '',
    department: '',
    dateRange: { start: '', end: '' },
    branch: ''
  });

  // Branches for modal
  const [branches, setBranches] = useState([
    { id: 1, name: 'Famous Gate Bomet (Central)' },
    { id: 2, name: 'Famous Gate Kericho' },
    { id: 3, name: 'Famous Gate Litein' }
  ]);

  // Fetch data
  useEffect(() => {
    fetchEntries();
    if (user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN) {
      fetchReviewQueue();
      fetchAuditTrail();
    }
    fetchReconciliations();
    fetchWorkpapers();
  }, [user]);

  const fetchEntries = async () => {
    setIsLoading(true);
    try {
      const response = await accountingAPI.getJournalEntries();
      if (response.success && Array.isArray(response.data)) {
        setEntries(response.data);
      }
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error('Failed to fetch journal entries');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReviewQueue = async () => {
    try {
      const response = await accountingAPI.getReviewQueue();
      if (response.success && Array.isArray(response.data)) {
        setReviewQueue(response.data);
      }
    } catch (error) {
      console.error('Error fetching review queue:', error);
    }
  };

  const fetchReconciliations = async () => {
    try {
      const response = await accountingAPI.getReconciliations();
      if (response.success && Array.isArray(response.data)) {
        setReconciliations(response.data);
      }
    } catch (error) {
      console.error('Error fetching reconciliations:', error);
    }
  };

  const fetchAuditTrail = async () => {
    try {
      const response = await accountingAPI.getAuditTrail();
      if (response.success && Array.isArray(response.data)) {
        setAuditTrail(response.data);
      }
    } catch (error) {
      console.error('Error fetching audit trail:', error);
    }
  };

  const fetchWorkpapers = async () => {
    try {
      const response = await accountingAPI.getWorkpapers();
      if (response.success && Array.isArray(response.data)) {
        setWorkpapers(response.data);
      }
    } catch (error) {
      console.error('Error fetching workpapers:', error);
    }
  };

  const handleCreateEntry = () => {
    setEditingEntry(null);
    setShowEntryModal(true);
  };

  const handleEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setShowEntryModal(true);
  };

  const handleReviewEntry = async (entryId: string, action: 'approve' | 'reject', notes?: string) => {
    try {
      const response = await accountingAPI.reviewJournalEntry(entryId, { action, notes, reviewer: user?.email });
      if (response.success) {
        toast.success(`Entry ${action}d successfully`);
        fetchEntries();
        fetchReviewQueue();
      }
    } catch (error) {
      toast.error(`Failed to ${action} entry`);
    }
  };

  const handlePostEntry = async (entryId: string) => {
    try {
      const response = await accountingAPI.postJournalEntry(entryId, user?.email);
      if (response.success) {
        toast.success('Entry posted to ledger');
        fetchEntries();
      }
    } catch (error) {
      toast.error('Failed to post entry');
    }
  };

  const handleSaveEntry = async (entry: JournalEntry) => {
    try {
      const entryData = {
        ...entry,
        created_by: user?.email,
        updated_by: user?.email
      };

      if (entry.id) {
        const response = await accountingAPI.updateJournalEntry(entry.id, entryData);
        if (response.success) {
          toast.success('Entry updated successfully');
          fetchEntries();
        }
      } else {
        const response = await accountingAPI.createJournalEntry(entryData);
        if (response.success) {
          toast.success('Entry created successfully');
          fetchEntries();
        }
      }
    } catch (error) {
      toast.error('Failed to save entry');
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      pending_review: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-blue-100 text-blue-700',
      posted: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getCategoryIcon = (category: string) => {
    const icons = {
      revenue: TrendingUp,
      expense: TrendingDown,
      asset: Building2,
      liability: CreditCard,
      equity: Wallet
    };
    return icons[category as keyof typeof icons] || FileText;
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">
                {user?.role === UserRole.AUDITOR ? 'Audit Workspace' : 'Accounting Workspace'}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {user?.role === UserRole.AUDITOR 
                  ? 'Review, audit, and ensure compliance across all financial transactions'
                  : 'Create, review, and manage journal entries and financial records'
                }
              </p>
            </div>
            <div className="flex gap-2">
              {(user?.role === UserRole.ACCOUNTANT || user?.role === UserRole.SUPER_ADMIN) && (
                <IOSButton onClick={handleCreateEntry}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Entry
                </IOSButton>
              )}
              <IOSButton variant="secondary">
                <Download className="h-4 w-4 mr-2" />
                Export
              </IOSButton>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Entries</p>
                  <p className="text-xl font-semibold text-gray-900">{entries.length}</p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Pending Review</p>
                  <p className="text-xl font-semibold text-gray-900">{reviewQueue.length}</p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Posted Today</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {entries.filter(e => e.status === 'posted' && 
                      e.date === new Date().toISOString().split('T')[0]).length}
                  </p>
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Activity className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Reconciled</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {reconciliations.filter(r => r.status === 'reconciled').length}
                  </p>
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              {[
                { id: 'entries', label: 'Journal Entries', icon: FileText },
                { id: 'review', label: 'Review Queue', icon: Eye, show: user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN },
                { id: 'reconciliation', label: 'Bank Reconciliation', icon: Scale },
                { id: 'audit', label: 'Audit Trail', icon: Shield, show: user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN },
                { id: 'reports', label: 'Reports', icon: BarChart3 }
              ].filter(tab => tab.show !== false).map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                    {tab.id === 'review' && reviewQueue.length > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                        {reviewQueue.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'entries' && (
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="approved">Approved</option>
                  <option value="posted">Posted</option>
                </select>
                
                <select
                  value={filters.department}
                  onChange={(e) => setFilters(prev => ({ ...prev, department: e.target.value }))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">All Departments</option>
                  <option value="rooms">Rooms</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="bar">Bar</option>
                  <option value="housekeeping">Housekeeping</option>
                </select>
                
                <input
                  type="date"
                  value={filters.dateRange.start}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    dateRange: { ...prev.dateRange, start: e.target.value }
                  }))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="Start Date"
                />
                
                <input
                  type="date"
                  value={filters.dateRange.end}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    dateRange: { ...prev.dateRange, end: e.target.value }
                  }))}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  placeholder="End Date"
                />
              </div>

              {/* Entries List */}
              <IOSCard>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Reference</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Description</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Account</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-700">Amount</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => {
                        const CategoryIcon = getCategoryIcon(entry.category);
                        return (
                          <tr key={entry.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm">{entry.date}</td>
                            <td className="py-3 px-4 text-sm font-mono">{entry.reference}</td>
                            <td className="py-3 px-4 text-sm">
                              <div className="flex items-center gap-2">
                                <CategoryIcon className="h-4 w-4 text-gray-400" />
                                {entry.description}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm">
                              <div>
                                <div className="text-xs text-gray-500">Dr: {entry.debit_account}</div>
                                <div className="text-xs text-gray-500">Cr: {entry.credit_account}</div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-right font-medium">
                              {entry.currency} {entry.amount.toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <IOSBadge className={getStatusColor(entry.status)}>
                                {entry.status.replace('_', ' ')}
                              </IOSBadge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleEditEntry(entry)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                {entry.status === 'approved' && user?.role !== UserRole.AUDITOR && (
                                  <button
                                    onClick={() => handlePostEntry(entry.id)}
                                    className="text-green-600 hover:text-green-800"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </IOSCard>
            </div>
          )}

          {activeTab === 'review' && (
            <div className="space-y-4">
              <IOSCard>
                <h3 className="text-lg font-semibold mb-4">Review Queue</h3>
                {reviewQueue.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No entries pending review</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {reviewQueue.map((entry) => (
                      <div key={entry.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="font-mono text-sm">{entry.reference}</span>
                              <IOSBadge className={getStatusColor(entry.status)}>
                                {entry.status.replace('_', ' ')}
                              </IOSBadge>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{entry.description}</p>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-500">Debit:</span> {entry.debit_account}
                              </div>
                              <div>
                                <span className="text-gray-500">Credit:</span> {entry.credit_account}
                              </div>
                              <div>
                                <span className="text-gray-500">Amount:</span> {entry.currency} {entry.amount.toLocaleString()}
                              </div>
                              <div>
                                <span className="text-gray-500">Created:</span> {entry.created_by}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <IOSButton
                              size="sm"
                              variant="secondary"
                              onClick={() => handleReviewEntry(entry.id, 'reject')}
                            >
                              <X className="h-4 w-4" />
                              Reject
                            </IOSButton>
                            <IOSButton
                              size="sm"
                              onClick={() => handleReviewEntry(entry.id, 'approve')}
                            >
                              <CheckCircle className="h-4 w-4" />
                              Approve
                            </IOSButton>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </IOSCard>
            </div>
          )}

          {activeTab === 'reconciliation' && (
            <div className="space-y-4">
              <IOSCard>
                <h3 className="text-lg font-semibold mb-4">Bank Reconciliation</h3>
                <div className="space-y-4">
                  {reconciliations.map((item) => (
                    <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{item.account_name}</h4>
                          <p className="text-sm text-gray-500">{item.account_type}</p>
                        </div>
                        <IOSBadge className={
                          item.status === 'reconciled' ? 'bg-green-100 text-green-700' :
                          item.status === 'discrepancy' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }>
                          {item.status}
                        </IOSBadge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 mt-4 text-sm">
                        <div>
                          <span className="text-gray-500">Book Balance:</span>
                          <p className="font-medium">KES {item.book_balance.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Bank Balance:</span>
                          <p className="font-medium">KES {item.bank_balance.toLocaleString()}</p>
                        </div>
                        <div>
                          <span className="text-gray-500">Difference:</span>
                          <p className={`font-medium ${item.difference !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                            KES {Math.abs(item.difference).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </IOSCard>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Audit Trail */}
                <IOSCard>
                  <h3 className="text-lg font-semibold mb-4">Recent Audit Trail</h3>
                  <div className="space-y-3">
                    {auditTrail.slice(0, 10).map((log) => (
                      <div key={log.id} className="flex items-start gap-3 text-sm">
                        <div className="p-1 bg-gray-100 rounded">
                          <Activity className="h-3 w-3 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{log.action}</p>
                          <p className="text-gray-500">{log.details}</p>
                          <p className="text-xs text-gray-400">
                            {log.user} • {new Date(log.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </IOSCard>

                {/* Workpapers */}
                <IOSCard>
                  <h3 className="text-lg font-semibold mb-4">Audit Workpapers</h3>
                  <div className="space-y-3">
                    {workpapers.map((paper) => (
                      <div key={paper.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                        <div>
                          <p className="font-medium">{paper.title}</p>
                          <p className="text-sm text-gray-500">{paper.type} • {paper.period}</p>
                        </div>
                        <IOSBadge className={
                          paper.status === 'completed' ? 'bg-green-100 text-green-700' :
                          paper.status === 'in_review' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }>
                          {paper.status}
                        </IOSBadge>
                      </div>
                    ))}
                  </div>
                </IOSCard>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { title: 'Trial Balance', icon: Calculator, desc: 'Debit/Credit verification' },
                  { title: 'General Ledger', icon: FileSpreadsheet, desc: 'Detailed transaction log' },
                  { title: 'Balance Sheet', icon: Scale, desc: 'Assets, Liabilities & Equity' },
                  { title: 'Income Statement', icon: TrendingUp, desc: 'Revenue & Expenses' },
                  { title: 'Cash Flow', icon: DollarSign, desc: 'Cash movement analysis' },
                  { title: 'Aging Report', icon: Clock, desc: 'AR/AP aging schedule' }
                ].map((report) => {
                  const Icon = report.icon;
                  return (
                    <IOSCard key={report.title} className="p-4 cursor-pointer hover:shadow-md transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Icon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-medium">{report.title}</h4>
                          <p className="text-sm text-gray-500">{report.desc}</p>
                        </div>
                      </div>
                    </IOSCard>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
      
      {/* Journal Entry Modal */}
      <JournalEntryModal
        isOpen={showEntryModal}
        onClose={() => setShowEntryModal(false)}
        onSave={handleSaveEntry}
        entry={editingEntry}
        branches={branches}
      />
    </ProtectedRoute>
  );
}
