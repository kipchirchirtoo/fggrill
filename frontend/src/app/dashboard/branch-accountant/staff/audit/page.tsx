'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { exportSummaryPDF, exportTransactionsPDF, downloadFile } from '@/lib/staff-audit-export';
import { Shield, AlertTriangle, Search, RefreshCw, Download, Building2, Users, CreditCard, Banknote, Wallet, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

interface StaffAuditRecord {
  id: string;
  date: string;
  type: 'Credit Bill' | 'Advance' | 'Loan' | 'Unpaid Bill';
  amount: number;
  staff_name: string;
  staff_id: string;
  staff_code?: string | null;
  staff_department?: string | null;
  staff_role?: string | null;
  staff_phone?: string | null;
  description: string;
  status: string;
  reference: string;
  outstanding_amount?: number;
  linked_party_name?: string | null;
  auditor_id?: string;
  auditor_confirmed_at?: string;
}

interface StaffSummary {
  staff_id: string;
  staff_name: string;
  employee_id?: string | null;
  department?: string | null;
  role?: string | null;
  phone?: string | null;
  total_credit_bills: number;
  total_advances: number;
  total_loans: number;
  total_unpaid_bills: number;
  outstanding_balance: number;
}

export default function StaffAuditPage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [records, setRecords] = useState<StaffAuditRecord[]>([]);
  const [summary, setSummary] = useState<StaffSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'summary' | 'transactions'>('summary');
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchAuditTrail = useCallback(async () => {
    if (!currentBranchId) {
      setRecords([]);
      setSummary([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.audit.getStaffAudit({
        branch_id: currentBranchId,
        staff_id: selectedStaffId !== 'all' ? selectedStaffId : undefined,
        start_date: dateRange.from,
        end_date: dateRange.to
      });
      
      if (response.success) {
        setRecords(response.data || []);
        setSummary(response.summary || []);
      } else {
        setRecords([]);
        setSummary([]);
      }
    } catch (error: any) {
      console.error('Error fetching audit trail:', error);
      toast.error(error.message || 'Failed to load staff financial audit');
    } finally {
      setIsLoading(false);
    }
  }, [currentBranchId, dateRange, selectedStaffId]);

  useEffect(() => {
    fetchAuditTrail();
  }, [fetchAuditTrail]);

  const filteredRecords = records.filter((record) => {
    const searchValue = searchQuery.toLowerCase();
    const matchesSearch =
      record.staff_name?.toLowerCase().includes(searchValue) ||
      record.staff_code?.toLowerCase().includes(searchValue) ||
      record.staff_department?.toLowerCase().includes(searchValue) ||
      record.staff_role?.toLowerCase().includes(searchValue) ||
      record.reference?.toLowerCase().includes(searchValue) ||
      record.description?.toLowerCase().includes(searchValue) ||
      record.linked_party_name?.toLowerCase().includes(searchValue);
    const matchesType = filterType === 'all' || record.type === filterType;

    return matchesSearch && matchesType;
  });

  const filteredSummary = summary.filter((item) => {
    const searchValue = searchQuery.toLowerCase();
    const matchesSearch =
      item.staff_name?.toLowerCase().includes(searchValue) ||
      item.employee_id?.toLowerCase().includes(searchValue) ||
      item.department?.toLowerCase().includes(searchValue) ||
      item.role?.toLowerCase().includes(searchValue) ||
      item.phone?.toLowerCase().includes(searchValue);

    if (filterType === 'Credit Bill') return matchesSearch && item.total_credit_bills > 0;
    if (filterType === 'Advance') return matchesSearch && item.total_advances > 0;
    if (filterType === 'Loan') return matchesSearch && item.total_loans > 0;
    if (filterType === 'Unpaid Bill') return matchesSearch && item.total_unpaid_bills > 0;

    return matchesSearch;
  });

  const totals = filteredSummary.reduce((acc, item) => {
    acc.creditBills += Number(item.total_credit_bills || 0);
    acc.advances += Number(item.total_advances || 0);
    acc.loans += Number(item.total_loans || 0);
    acc.unpaidBills += Number(item.total_unpaid_bills || 0);
    acc.outstanding += Number(item.outstanding_balance || 0);
    return acc;
  }, {
    creditBills: 0,
    advances: 0,
    loans: 0,
    unpaidBills: 0,
    outstanding: 0
  });

  const exportToPDF = async () => {
    const branchName = activeBranch?.name || 'Branch';
    const staffName = selectedStaffId === 'all'
      ? 'All Staff'
      : summary.find((item) => item.staff_id === selectedStaffId)?.staff_name || 'Selected Staff';

    try {
      toast.info('Generating branded PDF...');

      if (viewMode === 'summary') {
        const doc = await exportSummaryPDF(filteredSummary, {
          startDate: dateRange.from,
          endDate: dateRange.to,
          selectedBranch: String(currentBranchId || ''),
          selectedStaff: selectedStaffId,
          branchName,
          staffName
        });
        const pdfBlob = doc.output('blob');
        downloadFile(pdfBlob, `staff-financial-summary-${dateRange.from}-to-${dateRange.to}.pdf`, 'pdf');
      } else {
        const doc = await exportTransactionsPDF(filteredRecords, {
          startDate: dateRange.from,
          endDate: dateRange.to,
          selectedBranch: String(currentBranchId || ''),
          selectedStaff: selectedStaffId,
          branchName,
          staffName
        });
        const pdfBlob = doc.output('blob');
        downloadFile(pdfBlob, `staff-financial-transactions-${dateRange.from}-to-${dateRange.to}.pdf`, 'pdf');
      }

      toast.success('PDF downloaded successfully');
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast.error(error.message || 'Failed to export PDF');
    }
  };

  const getTypeColor = (type: string) => {
    if (type === 'Credit Bill') return 'warning';
    if (type === 'Advance') return 'default';
    if (type === 'Loan') return 'success';
    if (type === 'Unpaid Bill') return 'danger';
    return 'default';
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase() || '';

    if (normalizedStatus.includes('paid') || normalizedStatus.includes('approved') || normalizedStatus.includes('active') || normalizedStatus.includes('confirmed') || normalizedStatus.includes('deducted')) {
      return 'success';
    }

    if (normalizedStatus.includes('pending') || normalizedStatus.includes('unpaid')) {
      return 'warning';
    }

    if (normalizedStatus.includes('rejected') || normalizedStatus.includes('cancelled') || normalizedStatus.includes('defaulted')) {
      return 'danger';
    }

    return 'default';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(Number(amount || 0));
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_ACCOUNTANT, UserRole.BRANCH_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="h-6 w-6 text-[#007AFF]" />
                Staff Financial Audit
              </h1>
              <p className="text-gray-500 flex items-center gap-1 mt-1">
                <Building2 className="h-3.5 w-3.5" />
                {activeBranch?.name || 'Select a branch'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden bg-white">
                <button
                  onClick={() => setViewMode('summary')}
                  className={`px-4 py-2 text-sm font-medium ${viewMode === 'summary' ? 'bg-[#007AFF] text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  Staff Summary
                </button>
                <button
                  onClick={() => setViewMode('transactions')}
                  className={`px-4 py-2 text-sm font-medium border-l border-gray-200 ${viewMode === 'transactions' ? 'bg-[#007AFF] text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  Transactions
                </button>
              </div>
              <IOSButton
                variant="secondary"
                leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}
                onClick={fetchAuditTrail}
              >
                Refresh
              </IOSButton>
              <IOSButton
                variant="secondary"
                leftIcon={<Download />}
                onClick={exportToPDF}
                disabled={viewMode === 'summary' ? filteredSummary.length === 0 : filteredRecords.length === 0}
              >
                Export PDF
              </IOSButton>
            </div>
          </div>

          {/* Summary Stats */}
          {summary.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <IOSCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <Users className="h-5 w-5 text-slate-700" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Staff in Scope</p>
                    <p className="text-2xl font-bold">{filteredSummary.length}</p>
                  </div>
                </div>
              </IOSCard>

              <IOSCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <CreditCard className="h-5 w-5 text-[#007AFF]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Credit Bills</p>
                    <p className="text-2xl font-bold">{formatCurrency(totals.creditBills)}</p>
                  </div>
                </div>
              </IOSCard>

              <IOSCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Banknote className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Advances</p>
                    <p className="text-2xl font-bold">{formatCurrency(totals.advances)}</p>
                  </div>
                </div>
              </IOSCard>

              <IOSCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg">
                    <Wallet className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Loans</p>
                    <p className="text-2xl font-bold">{formatCurrency(totals.loans)}</p>
                  </div>
                </div>
              </IOSCard>

              <IOSCard className="p-4 border-l-4 border-red-500">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-[#FF3B30]" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Unpaid / Outstanding</p>
                    <p className="text-2xl font-bold text-[#FF3B30]">{formatCurrency(totals.unpaidBills || totals.outstanding)}</p>
                  </div>
                </div>
              </IOSCard>

              <IOSCard className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-50 rounded-lg">
                    <DollarSign className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Exposure</p>
                    <p className="text-2xl font-bold">{formatCurrency(totals.creditBills + totals.advances + totals.loans + totals.unpaidBills)}</p>
                  </div>
                </div>
              </IOSCard>
            </div>
          )}

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search staff, employee ID, department, reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              />

              <Input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              />

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Financial Records</option>
                <option value="Credit Bill">Credit Bills</option>
                <option value="Advance">Advances</option>
                <option value="Loan">Loans</option>
                <option value="Unpaid Bill">Unpaid Bills</option>
              </select>

              <select
                value={selectedStaffId}
                onChange={(e) => setSelectedStaffId(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="all">All Staff</option>
                {summary.map((item) => (
                  <option key={item.staff_id} value={item.staff_id}>
                    {item.staff_name}{item.employee_id ? ` (${item.employee_id})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </IOSCard>

          {/* Audit Logs Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : viewMode === 'summary' ? (
            filteredSummary.length === 0 ? (
              <IOSCard className="p-12 text-center">
                <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No staff summary found</p>
              </IOSCard>
            ) : (
              <IOSCard className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff Member</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee ID</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Credit Bills</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Advances</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Loans</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unpaid Bills</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Exposure</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredSummary.map((item) => {
                        const totalExposure = item.total_credit_bills + item.total_advances + item.total_loans + item.total_unpaid_bills;

                        return (
                          <tr key={item.staff_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-900">{item.staff_name}</p>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.employee_id || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.department || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.role?.replace(/_/g, ' ').toUpperCase() || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.phone || '-'}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(item.total_credit_bills)}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(item.total_advances)}</td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(item.total_loans)}</td>
                            <td className="px-4 py-3 text-sm text-right text-red-600">{formatCurrency(item.total_unpaid_bills)}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-amber-600">{formatCurrency(item.outstanding_balance)}</td>
                            <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{formatCurrency(totalExposure)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </IOSCard>
            )
          ) : filteredRecords.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No staff financial records found</p>
            </IOSCard>
          ) : (
            <IOSCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredRecords.map((record) => (
                      <tr key={`${record.type}-${record.id}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          {new Date(record.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{record.staff_name}</p>
                            <p className="text-xs text-gray-500">{record.staff_code || '-'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <p>{record.staff_department || '-'}</p>
                          <p className="text-xs text-gray-500">{record.staff_role?.replace(/_/g, ' ').toUpperCase() || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <IOSBadge variant="light" color={getTypeColor(record.type)}>
                            {record.type}
                          </IOSBadge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                          {record.reference}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-md truncate">
                          {record.description || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {formatCurrency(record.amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-amber-600">
                          {formatCurrency(record.outstanding_amount || 0)}
                        </td>
                        <td className="px-4 py-3">
                          <IOSBadge variant="light" color={getStatusColor(record.status)}>
                            {record.status}
                          </IOSBadge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </IOSCard>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
