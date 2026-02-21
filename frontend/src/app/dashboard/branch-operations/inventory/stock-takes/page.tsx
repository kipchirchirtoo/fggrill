'use client';

import { useEffect, useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { branchOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw, ClipboardList, PlusCircle, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface StockTake {
  id: string;
  reference: string;
  status: string;
  created_by: string;
  created_at: string;
  completed_at: string | null;
  category: string;
  total_items: number;
  discrepancies: number;
}

function BranchStockTakesContent() {
  const { activeBranch, activeBranchId } = useBranch();

  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [filteredStockTakes, setFilteredStockTakes] = useState<StockTake[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | string>('all');

  useEffect(() => {
    if (activeBranchId) {
      fetchStockTakes();
    }
  }, [activeBranchId]);

  useEffect(() => {
    applyFilters();
  }, [stockTakes, searchTerm, statusFilter]);

  const fetchStockTakes = async () => {
    if (!activeBranchId) return;

    setIsLoading(true);
    try {
      const response = await branchOperationsAPI.getStockTakes(undefined, activeBranchId);

      if (response && (response as any).success && Array.isArray((response as any).data)) {
        setStockTakes((response as any).data as StockTake[]);
      } else if (Array.isArray(response)) {
        setStockTakes(response as StockTake[]);
      } else {
        setStockTakes([]);
      }
    } catch (error) {
      console.error('Error fetching stock takes:', error);
      toast.error('Failed to load stock takes');
      setStockTakes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...stockTakes];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter((s) =>
        s.reference.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q),
      );
    }

    if (statusFilter !== 'all') {
      result = result.filter((s) => s.status === statusFilter);
    }

    setFilteredStockTakes(result);
  };

  const formatDateSafe = (value: string | null) => {
    if (!value) return '—';
    try {
      return format(new Date(value), 'MMM d, yyyy HH:mm');
    } catch {
      return value;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'draft':
        return <IOSBadge className="bg-gray-100 text-gray-700">Draft</IOSBadge>;
      case 'in_progress':
        return <IOSBadge className="bg-blue-100 text-blue-700">In Progress</IOSBadge>;
      case 'completed':
        return <IOSBadge className="bg-green-100 text-green-700">Completed</IOSBadge>;
      default:
        return <IOSBadge className="bg-gray-100 text-gray-700">{status}</IOSBadge>;
    }
  };

  return (
    <div className="space-y-4">
      <IOSCard className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1 flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by reference or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-ios-lg border border-gray-200 px-3 text-sm bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <IOSButton
              variant="secondary"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={fetchStockTakes}
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
                <th className="px-4 py-3 text-left font-medium text-gray-500">Reference</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Completed</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Items</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Discrepancies</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="h-5 w-5 animate-spin inline-block mr-2 text-gray-400" />
                    Loading stock takes...
                  </td>
                </tr>
              ) : filteredStockTakes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No stock takes found
                  </td>
                </tr>
              ) : (
                filteredStockTakes.map((take) => (
                  <tr key={take.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{take.reference}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{take.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDateSafe(take.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDateSafe(take.completed_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{take.total_items}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{take.discrepancies}</td>
                    <td className="px-4 py-3">{getStatusBadge(take.status)}</td>
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

export default function BranchStockTakesPage() {
  return (
    <ProtectedRoute
      allowedRoles={[
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.BRANCH_MANAGER,
        UserRole.BRANCH_OPERATIONS_MANAGER,
        UserRole.BRANCH_STOREKEEPER,
        UserRole.AUDITOR,
      ]}
    >
      <BranchPageWrapper>
        <BranchAwareDashboardLayout
          title="Stock Takes"
          subtitle="Review and manage branch stock counts"
        >
          <BranchStockTakesContent />
        </BranchAwareDashboardLayout>
      </BranchPageWrapper>
    </ProtectedRoute>
  );
}

