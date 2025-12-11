'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI } from '@/lib/api';
import { FileText, RefreshCw, Plus, ChevronDown, ChevronUp } from 'lucide-react';

interface JournalLine {
  account: string;
  debit: number;
  credit: number;
}

interface JournalEntry {
  id: string;
  date: string;
  description: string;
  reference: string;
  lines: JournalLine[];
}

interface Branch { id: number; name: string; }

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<number | null>(null);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchBranches = useCallback(async () => {
    try {
      const response = await financeAPI.getBranches();
      if (response.success && Array.isArray(response.data)) setBranches(response.data);
    } catch (error) { console.error('Error:', error); }
  }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financeAPI.getJournalEntries({ branch_id: selectedBranch || undefined, limit: 50 });
      if (response.success && Array.isArray(response.data)) setEntries(response.data);
      else if (Array.isArray(response)) setEntries(response);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [selectedBranch]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);
  useEffect(() => { fetchData(); }, [fetchData]);

  const entriesArray = Array.isArray(entries) ? entries : [];

  const toggleEntry = (id: string) => {
    setExpandedEntry(expandedEntry === id ? null : id);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.ACCOUNTANT, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Journal Entries</h1>
              <p className="text-sm text-gray-500 mt-1">Record and view financial transactions</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedBranch || ''}
                onChange={(e) => setSelectedBranch(e.target.value ? Number(e.target.value) : null)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              >
                <option value="">All Branches</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <button onClick={fetchData} disabled={isLoading} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button 
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800"
              >
                <Plus className="h-4 w-4" /> New Entry
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Entries</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{entriesArray.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Debits</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                KES {entriesArray.reduce((sum, e) => sum + (Array.isArray(e.lines) ? e.lines.reduce((s, l) => s + (l.debit || 0), 0) : 0), 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-5">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Credits</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                KES {entriesArray.reduce((sum, e) => sum + (Array.isArray(e.lines) ? e.lines.reduce((s, l) => s + (l.credit || 0), 0) : 0), 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* Entries List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-gray-400" /></div>
          ) : entriesArray.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No journal entries found</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
              {entriesArray.map((entry) => {
                const isExpanded = expandedEntry === entry.id;
                const lines = Array.isArray(entry.lines) ? entry.lines : [];
                const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
                const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
                
                return (
                  <div key={entry.id}>
                    <button
                      onClick={() => toggleEntry(entry.id)}
                      className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <FileText className="h-4 w-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{entry.description}</p>
                          <p className="text-sm text-gray-500">{entry.date} {entry.reference && `• ${entry.reference}`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-900">KES {totalDebit.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">{lines.length} line(s)</p>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <div className="px-5 pb-4 bg-gray-50">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-500 uppercase">
                              <th className="py-2 text-left font-medium">Account</th>
                              <th className="py-2 text-right font-medium">Debit</th>
                              <th className="py-2 text-right font-medium">Credit</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {lines.map((line, i) => (
                              <tr key={i}>
                                <td className="py-2 text-gray-900">{line.account}</td>
                                <td className="py-2 text-right font-mono text-gray-900">
                                  {(line.debit || 0) > 0 ? (line.debit || 0).toLocaleString() : '-'}
                                </td>
                                <td className="py-2 text-right font-mono text-gray-900">
                                  {(line.credit || 0) > 0 ? (line.credit || 0).toLocaleString() : '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t-2 border-gray-300">
                            <tr className="font-semibold">
                              <td className="py-2">Total</td>
                              <td className="py-2 text-right font-mono">{totalDebit.toLocaleString()}</td>
                              <td className="py-2 text-right font-mono">{totalCredit.toLocaleString()}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Create Modal Placeholder */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Journal Entry</h2>
                <p className="text-gray-500 mb-4">Journal entry creation form will be implemented here.</p>
                <div className="flex justify-end gap-3">
                  <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                    Cancel
                  </button>
                  <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800">
                    Save Entry
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
