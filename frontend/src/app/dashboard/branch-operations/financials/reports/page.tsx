'use client';

import { useEffect, useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { branchOperationsAPI } from '@/lib/branch-api';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Search, RefreshCw, ArrowUpDown, FileText, Download as DownloadIcon } from 'lucide-react';

const Download = DownloadIcon;

interface FinancialReport {
  id: string;
  title: string;
  type: string;
  period?: string;
  created_at: string;
  status?: string;
  file_format?: string;
  download_url?: string;
}

function BranchFinancialReportsContent() {
  const { activeBranchId } = useBranch();

  const [reports, setReports] = useState<FinancialReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<FinancialReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
  const [sortField, setSortField] = useState<'title' | 'created_at'>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (activeBranchId) {
      fetchReports();
    }
  }, [activeBranchId, typeFilter]);

  useEffect(() => {
    applyFilters();
  }, [reports, searchTerm, typeFilter, sortField, sortDirection]);

  const fetchReports = async () => {
    if (!activeBranchId) return;

    setIsLoading(true);
    try {
      const params: { type?: string } = {};
      if (typeFilter !== 'all') params.type = typeFilter;

      // Real API call – no sample data
      const response = await branchOperationsAPI.getFinancialReports(params, activeBranchId as number);

      if (response && (response as any).success && Array.isArray((response as any).data)) {
        setReports((response as any).data as FinancialReport[]);
      } else if (Array.isArray(response)) {
        // In case the endpoint returns a bare array
        setReports(response as FinancialReport[]);
      } else {
        setReports([]);
      }
    } catch (error) {
      console.error('Error fetching financial reports:', error);
      toast.error('Failed to load financial reports');
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...reports];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) || (r.type || '').toLowerCase().includes(q),
      );
    }

    if (typeFilter !== 'all') {
      result = result.filter((r) => r.type === typeFilter);
    }

    result.sort((a, b) => {
      if (sortField === 'title') {
        return sortDirection === 'asc'
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      }

      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
    });

    setFilteredReports(result);
  };

  const handleSort = (field: 'title' | 'created_at') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const formatDateSafe = (value: string) => {
    try {
      return format(new Date(value), 'MMM d, yyyy HH:mm');
    } catch {
      return value;
    }
  };

  return (
    <div className="space-y-4">
      <IOSCard className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1 flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search reports by title or type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-ios-lg border border-gray-200 px-3 text-sm bg-white"
            >
              <option value="all">All Types</option>
              <option value="income_statement">Income Statement</option>
              <option value="balance_sheet">Balance Sheet</option>
              <option value="cashflow">Cashflow</option>
              <option value="tax_report">Tax Report</option>
            </select>
            <IOSButton
              variant="secondary"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={fetchReports}
            >
              Refresh
            </IOSButton>
          </div>
        </div>
      </IOSCard>

      <IOSCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-500 cursor-pointer"
                  onClick={() => handleSort('title')}
                >
                  <span className="inline-flex items-center gap-1">
                    Title
                    {sortField === 'title' && (
                      <ArrowUpDown
                        className={`h-3 w-3 ${sortDirection === 'asc' ? 'rotate-180' : ''}`}
                      />
                    )}
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Type</th>
                <th
                  className="px-4 py-3 text-left font-medium text-gray-500 cursor-pointer"
                  onClick={() => handleSort('created_at')}
                >
                  <span className="inline-flex items-center gap-1">
                    Created At
                    {sortField === 'created_at' && (
                      <ArrowUpDown
                        className={`h-3 w-3 ${sortDirection === 'asc' ? 'rotate-180' : ''}`}
                      />
                    )}
                  </span>
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Format</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="h-5 w-5 animate-spin inline-block mr-2 text-gray-400" />
                    Loading financial reports...
                  </td>
                </tr>
              ) : filteredReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    No financial reports found for this branch
                  </td>
                </tr>
              ) : (
                filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{report.title}</div>
                      {report.period && (
                        <div className="text-xs text-gray-500">Period: {report.period}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                        {report.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDateSafe(report.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <IOSBadge
                        className={
                          report.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : report.status === 'failed'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-yellow-100 text-yellow-700'
                        }
                      >
                        {report.status ? report.status.toUpperCase() : 'PENDING'}
                      </IOSBadge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {report.file_format ? report.file_format.toUpperCase() : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {report.download_url ? (
                        <a
                          href={report.download_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[#007AFF] hover:underline"
                        >
                          <Download className="h-3 w-3" />
                          Download
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">Not available</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </IOSCard>
    </div>
  );
}

export default function BranchFinancialReportsPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute
      allowedRoles={[
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.ACCOUNTANT,
        UserRole.BRANCH_MANAGER,
        UserRole.BRANCH_OPERATIONS_MANAGER,
        UserRole.AUDITOR,
      ]}
    >
      <BranchPageWrapper>
        <BranchAwareDashboardLayout
          title="Financial Reports"
          subtitle="View and download branch financial reports"
        >
          <BranchFinancialReportsContent />
        </BranchAwareDashboardLayout>
      </BranchPageWrapper>
    </ProtectedRoute>
  );
}
