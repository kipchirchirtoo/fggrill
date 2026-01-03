'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { motion } from 'framer-motion';
import { 
  BarChart3, ArrowLeft, DollarSign, TrendingUp, AlertCircle, RefreshCw,
  CheckCircle, XCircle, Clock, Eye, Search, Download, AlertTriangle,
  Flag, Target, Activity, Scale, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

const BRANCHES = [
  { code: 'FGB-HQ', name: 'Bomet HQ' },
  { code: 'FGB-BMT', name: 'Bomet Town' },
  { code: 'FGB-KER', name: 'Kericho' },
  { code: 'FGB-KAP', name: 'Kapsoit' },
  { code: 'FGB-MOG', name: 'Mogogosiek' },
  { code: 'FGB-LIT', name: 'Litein' },
];

const transactions = [
  { id: '1', date: '2024-11-28', desc: 'Room booking - Safari Lodge', type: 'revenue', amount: 34800, branch: 'Bomet HQ', ref: 'TXN-001', status: 'verified', risk: 'low' },
  { id: '2', date: '2024-11-28', desc: 'Cash refund - cancelled booking', type: 'refund', amount: 15000, branch: 'Kericho', ref: 'TXN-002', status: 'flagged', risk: 'medium' },
  { id: '3', date: '2024-11-27', desc: 'Kitchen supplies purchase', type: 'expense', amount: 89500, branch: 'Bomet HQ', ref: 'TXN-003', status: 'pending', risk: 'low' },
  { id: '4', date: '2024-11-27', desc: 'Inter-branch transfer', type: 'transfer', amount: 250000, branch: 'Kapsoit', ref: 'TXN-004', status: 'verified', risk: 'low' },
  { id: '5', date: '2024-11-27', desc: 'Restaurant sales - Weekend', type: 'revenue', amount: 156000, branch: 'Litein', ref: 'TXN-005', status: 'discrepancy', risk: 'high' },
  { id: '6', date: '2024-11-26', desc: 'Utility payment - Electricity', type: 'expense', amount: 45000, branch: 'Mogogosiek', ref: 'TXN-006', status: 'verified', risk: 'low' },
];

const reconciliations = [
  { account: 'Main Operating Account', system: 2450000, actual: 2450000, variance: 0, status: 'matched' },
  { account: 'Petty Cash - Bomet HQ', system: 50000, actual: 47500, variance: -2500, status: 'variance' },
  { account: 'M-Pesa Float', system: 180000, actual: 180000, variance: 0, status: 'matched' },
  { account: 'IOSCard Settlements', system: 890000, actual: 845600, variance: -44400, status: 'variance' },
];

export default function FinancialAuditPage() {
  const [activeTab, setActiveTab] = useState<'transactions' | 'reconciliation'>('transactions');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const stats = { total: 1247, pending: 34, discrepancies: 7, flagged: 12, compliance: 94.2 };

  const filtered = transactions.filter(t => 
    (statusFilter === 'all' || t.status === statusFilter) &&
    (t.desc.toLowerCase().includes(searchQuery.toLowerCase()) || t.ref.includes(searchQuery))
  );

  const getStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any }> = {
      verified: { color: 'bg-[#F2F2F7] text-[#000000]', icon: CheckCircle },
      pending: { color: 'bg-[#F2F2F7] text-[#3C3C43]', icon: Clock },
      flagged: { color: 'bg-[#F2F2F7] text-[#3C3C43]', icon: Flag },
      discrepancy: { color: 'bg-[#F2F2F7] text-[#000000]', icon: AlertTriangle },
    };
    const Icon = config[status]?.icon || Clock;
    return <IOSBadge className={config[status]?.color}><Icon className="h-3 w-3 mr-1" />{status}</IOSBadge>;
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/audit"><IOSButton variant="ghost" size="sm" leftIcon={<ArrowLeft />}>Back</IOSButton></Link>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <div className="p-2 bg-[#F2F2F7] rounded-ios-lg"><BarChart3 className="h-6 w-6 text-[#3C3C43]" /></div>
                  Financial Audit
                </h1>
                <p className="text-sm text-gray-500">Review transactions, reconcile accounts, identify discrepancies</p>
              </div>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="outline" size="sm"leftIcon={<Download />}>Export</IOSButton>
              <IOSButton size="sm" className="bg-[#F2F2F7] hover:bg-[#F2F2F7]" leftIcon={<RefreshCw />}>Sync</IOSButton>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <IOSCard className="p-4"><div className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-[#3C3C43]" /><div><p className="text-xs text-gray-500">Total</p><p className="text-xl font-bold">{stats.total}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-2"><Clock className="h-5 w-5 text-[#3C3C43]" /><div><p className="text-xs text-gray-500">Pending</p><p className="text-xl font-bold text-[#3C3C43]">{stats.pending}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-[#3C3C43]" /><div><p className="text-xs text-gray-500">Discrepancies</p><p className="text-xl font-bold text-[#3C3C43]">{stats.discrepancies}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-2"><Flag className="h-5 w-5 text-[#3C3C43]" /><div><p className="text-xs text-gray-500">Flagged</p><p className="text-xl font-bold text-[#3C3C43]">{stats.flagged}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-2"><Target className="h-5 w-5 text-[#3C3C43]" /><div><p className="text-xs text-gray-500">Compliance</p><p className="text-xl font-bold text-[#3C3C43]">{stats.compliance}%</p></div></div></IOSCard>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-ios-lg w-fit">
            {(['transactions', 'reconciliation'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm font-medium capitalize ${activeTab === tab ? 'bg-[#FFFFFF] shadow' : 'text-gray-600'}`}>{tab}</button>
            ))}
          </div>

          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <>
              <IOSCard className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                    <input type="text" placeholder="Search transactions..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-ios-lg" />
                  </div>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 border rounded-ios-lg">
                    <option value="all">All Status</option>
                    <option value="verified">Verified</option>
                    <option value="pending">Pending</option>
                    <option value="flagged">Flagged</option>
                    <option value="discrepancy">Discrepancy</option>
                  </select>
                </div>
              </IOSCard>

              <IOSCard className="overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="p-4 text-left text-xs font-semibold font-sf-pro-display text-gray-600">Date</th>
                      <th className="p-4 text-left text-xs font-semibold font-sf-pro-display text-gray-600">Reference</th>
                      <th className="p-4 text-left text-xs font-semibold font-sf-pro-display text-gray-600">Description</th>
                      <th className="p-4 text-left text-xs font-semibold font-sf-pro-display text-gray-600">Type</th>
                      <th className="p-4 text-right text-xs font-semibold font-sf-pro-display text-gray-600">Amount</th>
                      <th className="p-4 text-left text-xs font-semibold font-sf-pro-display text-gray-600">Branch</th>
                      <th className="p-4 text-left text-xs font-semibold font-sf-pro-display text-gray-600">Status</th>
                      <th className="p-4 text-left text-xs font-semibold font-sf-pro-display text-gray-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(txn => (
                      <motion.tr key={txn.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hover:bg-gray-50">
                        <td className="p-4 text-sm">{txn.date}</td>
                        <td className="p-4 font-mono text-sm text-[#3C3C43]">{txn.ref}</td>
                        <td className="p-4 text-sm font-medium">{txn.desc}</td>
                        <td className="p-4">
                          <span className={`text-sm ${txn.type === 'revenue' ? 'text-[#3C3C43]' : txn.type === 'expense' ? 'text-[#3C3C43]' : 'text-[#3C3C43]'}`}>
                            {txn.type === 'revenue' ? <ArrowUpRight className="h-4 w-4 inline" /> : <ArrowDownRight className="h-4 w-4 inline" />} {txn.type}
                          </span>
                        </td>
                        <td className={`p-4 text-right font-bold ${txn.type === 'revenue' ? 'text-[#3C3C43]' : 'text-[#3C3C43]'}`}>
                          KES {txn.amount.toLocaleString()}
                        </td>
                        <td className="p-4 text-sm">{txn.branch}</td>
                        <td className="p-4">{getStatusBadge(txn.status)}</td>
                        <td className="p-4">
                          <div className="flex gap-1">
                            <IOSButton variant="ghost" size="sm"><Eye className="h-4 w-4" /></IOSButton>
                            {txn.status === 'pending' && <IOSButton variant="ghost" size="sm" className="text-[#3C3C43]" onClick={() => toast.success('Verified')}><CheckCircle className="h-4 w-4" /></IOSButton>}
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </IOSCard>
            </>
          )}

          {/* Reconciliation Tab */}
          {activeTab === 'reconciliation' && (
            <IOSCard className="overflow-hidden">
              <div className="p-4 border-b"><h3 className="font-semibold font-sf-pro-display">Account Reconciliation</h3></div>
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-4 text-left text-xs font-semibold font-sf-pro-display text-gray-600">Account</th>
                    <th className="p-4 text-right text-xs font-semibold font-sf-pro-display text-gray-600">System Balance</th>
                    <th className="p-4 text-right text-xs font-semibold font-sf-pro-display text-gray-600">Actual Balance</th>
                    <th className="p-4 text-right text-xs font-semibold font-sf-pro-display text-gray-600">Variance</th>
                    <th className="p-4 text-left text-xs font-semibold font-sf-pro-display text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reconciliations.map((rec, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="p-4 font-medium">{rec.account}</td>
                      <td className="p-4 text-right">KES {rec.system.toLocaleString()}</td>
                      <td className="p-4 text-right">KES {rec.actual.toLocaleString()}</td>
                      <td className={`p-4 text-right font-bold ${rec.variance !== 0 ? 'text-[#3C3C43]' : 'text-[#3C3C43]'}`}>
                        {rec.variance !== 0 ? `KES ${rec.variance.toLocaleString()}` : '-'}
                      </td>
                      <td className="p-4">
                        <IOSBadge className={rec.status === 'matched' ? 'bg-[#F2F2F7] text-[#000000]' : 'bg-[#F2F2F7] text-[#000000]'}>
                          {rec.status === 'matched' ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          {rec.status}
                        </IOSBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </IOSCard>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
