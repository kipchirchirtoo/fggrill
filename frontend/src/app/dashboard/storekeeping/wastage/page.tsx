'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/minimal/button";
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Trash2, Plus, RefreshCw, Search, Package, AlertTriangle,
  Calendar, FileText, TrendingDown, DollarSign, Clock, XCircle, 
  Building2, User, Camera, Eye, CheckCircle, X, Download,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface WastageRecord {
  id: string;
  wastage_number: string;
  branch_id: number;
  branch?: { id: number; name: string; code: string };
  item_id: number;
  item?: { id: number; name: string; sku: string };
  quantity: number;
  unit_cost: number;
  total_loss: number;
  reason: string;
  reason_details?: string;
  recorded_by?: string;
  approved_by?: string;
  status: string;
  disposal_method?: string;
  created_at: string;
}

interface StoreItem {
  id: number;
  name: string;
  sku: string;
  cost_price?: number;
  quantity?: number;
}

interface Branch {
  id: number;
  name: string;
  code: string;
}

export default function WastagePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<WastageRecord[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    branch_id: '',
    item_id: '',
    quantity: 1,
    reason: '',
    reason_details: '',
    disposal_method: ''
  });

  // Stats
  const [stats, setStats] = useState({
    totalWastage: 0,
    totalLoss: 0,
    thisMonth: 0,
    thisMonthLoss: 0,
    lastMonth: 0,
    lastMonthLoss: 0,
    topReason: '',
    avgLossPerRecord: 0,
    pendingApproval: 0
  });
  
  // Enhanced state
  const [selectedRecord, setSelectedRecord] = useState<WastageRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [reasonBreakdown, setReasonBreakdown] = useState<{reason: string; count: number; loss: number}[]>([]);
  const [branchBreakdown, setBranchBreakdown] = useState<{branch: string; count: number; loss: number}[]>([]);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchData();
  }, [reasonFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [wastageRes, itemsRes, branchesRes] = await Promise.all([
        fetch(`${API_URL}/api/store/wastage${reasonFilter ? `?reason=${reasonFilter}` : ''}`, { headers }),
        fetch(`${API_URL}/api/store/items`, { headers }),
        fetch(`${API_URL}/api/store/branches`, { headers })
      ]);
      
      if (wastageRes.ok) {
        const data = await wastageRes.json();
        const wastageData = data.data || [];
        setRecords(wastageData);
        
        // Calculate enhanced stats
        const totalLoss = wastageData.reduce((sum: number, r: WastageRecord) => sum + (r.total_loss || 0), 0);
        const now = new Date();
        const thisMonthRecords = wastageData.filter((r: WastageRecord) => {
          const date = new Date(r.created_at);
          return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
        });
        const lastMonthRecords = wastageData.filter((r: WastageRecord) => {
          const date = new Date(r.created_at);
          const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
          const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
          return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
        });
        
        const thisMonthLoss = thisMonthRecords.reduce((sum: number, r: WastageRecord) => sum + (r.total_loss || 0), 0);
        const lastMonthLoss = lastMonthRecords.reduce((sum: number, r: WastageRecord) => sum + (r.total_loss || 0), 0);
        const pendingApproval = wastageData.filter((r: WastageRecord) => r.status === 'PENDING').length;
        
        // Reason breakdown
        const reasonStats: Record<string, {count: number; loss: number}> = {};
        wastageData.forEach((r: WastageRecord) => {
          if (!reasonStats[r.reason]) reasonStats[r.reason] = { count: 0, loss: 0 };
          reasonStats[r.reason].count += 1;
          reasonStats[r.reason].loss += r.total_loss || 0;
        });
        const reasonBreakdownData = Object.entries(reasonStats)
          .map(([reason, data]) => ({ reason, ...data }))
          .sort((a, b) => b.loss - a.loss);
        setReasonBreakdown(reasonBreakdownData);
        
        // Branch breakdown
        const branchStats: Record<string, {count: number; loss: number}> = {};
        wastageData.forEach((r: WastageRecord) => {
          const branchName = r.branch?.name || 'Unknown';
          if (!branchStats[branchName]) branchStats[branchName] = { count: 0, loss: 0 };
          branchStats[branchName].count += 1;
          branchStats[branchName].loss += r.total_loss || 0;
        });
        const branchBreakdownData = Object.entries(branchStats)
          .map(([branch, data]) => ({ branch, ...data }))
          .sort((a, b) => b.loss - a.loss);
        setBranchBreakdown(branchBreakdownData);
        
        const topReason = reasonBreakdownData[0]?.reason || '-';
        
        setStats({
          totalWastage: wastageData.length,
          totalLoss,
          thisMonth: thisMonthRecords.length,
          thisMonthLoss,
          lastMonth: lastMonthRecords.length,
          lastMonthLoss,
          topReason,
          avgLossPerRecord: wastageData.length > 0 ? Math.round(totalLoss / wastageData.length) : 0,
          pendingApproval
        });
      }
      if (itemsRes.ok) {
        const data = await itemsRes.json();
        setItems(data.data || []);
      }
      if (branchesRes.ok) {
        const data = await branchesRes.json();
        setBranches(data.data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateWastage = async () => {
    try {
      const selectedItem = items.find(i => i.id === parseInt(formData.item_id));
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/wastage`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          branch_id: parseInt(formData.branch_id) || user?.branch_id,
          item_id: parseInt(formData.item_id),
          unit_cost: selectedItem?.cost_price || 0,
          total_loss: formData.quantity * (selectedItem?.cost_price || 0)
        })
      });
      
      if (response.ok) {
        toast.success('Wastage recorded - stock adjusted');
        setIsCreateModalOpen(false);
        setFormData({ branch_id: '', item_id: '', quantity: 1, reason: '', reason_details: '', disposal_method: '' });
        fetchData();
      } else {
        const err = await response.json();
        toast.error(err.error || 'Failed to record wastage');
      }
    } catch (error) {
      toast.error('Failed to record wastage');
    }
  };

  const getReasonColor = (reason: string) => {
    const colors: Record<string, string> = {
      'EXPIRED': 'bg-[#F2F2F7] text-[#000000]',
      'DAMAGED': 'bg-[#F2F2F7] text-[#3C3C43]',
      'SPOILED': 'bg-[#F2F2F7] text-[#3C3C43]',
      'THEFT': 'bg-[#F2F2F7] text-[#3C3C43]',
      'BREAKAGE': 'bg-[#F2F2F7] text-[#000000]',
      'QUALITY_ISSUE': 'bg-[#F2F2F7] text-[#3C3C43]',
      'OTHER': 'bg-gray-100 text-gray-700'
    };
    return colors[reason] || 'bg-gray-100';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'PENDING': 'bg-[#F2F2F7] text-[#3C3C43]',
      'APPROVED': 'bg-[#F2F2F7] text-[#000000]',
      'REJECTED': 'bg-[#F2F2F7] text-[#000000]'
    };
    return colors[status] || 'bg-gray-100';
  };

  // Approval handler
  const handleApproval = async (recordId: string, action: 'approve' | 'reject') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/wastage/${recordId}/${action}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        toast.success(`Wastage record ${action}d successfully`);
        fetchData();
        setIsViewModalOpen(false);
      } else {
        toast.error(`Failed to ${action} record`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} record`);
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Ref #', 'Item', 'SKU', 'Branch', 'Quantity', 'Unit Cost', 'Total Loss', 'Reason', 'Status', 'Date', 'Details'];
    const rows = filteredRecords.map(r => [
      r.wastage_number,
      r.item?.name || '',
      r.item?.sku || '',
      r.branch?.name || '',
      r.quantity,
      r.unit_cost,
      r.total_loss,
      r.reason,
      r.status,
      formatDate(r.created_at),
      r.reason_details || ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wastage-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Report exported successfully');
  };

  // View record details
  const viewRecord = (record: WastageRecord) => {
    setSelectedRecord(record);
    setIsViewModalOpen(true);
  };

  // Calculate month-over-month change
  const getMonthChange = () => {
    if (stats.lastMonthLoss === 0) return { percent: 0, type: 'same' };
    const change = ((stats.thisMonthLoss - stats.lastMonthLoss) / stats.lastMonthLoss) * 100;
    return { percent: Math.abs(Math.round(change)), type: change > 0 ? 'increase' : 'decrease' };
  };
  const monthChange = getMonthChange();

  const filteredRecords = records.filter(r => {
    const matchesSearch = searchTerm === '' ||
      r.wastage_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.item?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.branch?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === '' || r.status === statusFilter;
    const matchesDate = (!dateFilter.from || new Date(r.created_at) >= new Date(dateFilter.from)) &&
                        (!dateFilter.to || new Date(r.created_at) <= new Date(dateFilter.to));
    return matchesSearch && matchesStatus && matchesDate;
  });
  
  const canApprove = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER;

  const selectedItem = items.find(i => i.id === parseInt(formData.item_id));
  const estimatedLoss = formData.quantity * (selectedItem?.cost_price || 0);

  const canManage = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || 
                    user?.role === UserRole.CENTRAL_STOREKEEPER || user?.role === UserRole.BRANCH_STOREKEEPER;

  const reasons = [
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'DAMAGED', label: 'Damaged' },
    { value: 'SPOILED', label: 'Spoiled' },
    { value: 'BREAKAGE', label: 'Breakage' },
    { value: 'THEFT', label: 'Theft/Loss' },
    { value: 'QUALITY_ISSUE', label: 'Quality Issue' },
    { value: 'OTHER', label: 'Other' }
  ];

  const disposalMethods = [
    { value: 'DISPOSED', label: 'Disposed' },
    { value: 'RETURNED_SUPPLIER', label: 'Returned to Supplier' },
    { value: 'DONATED', label: 'Donated' },
    { value: 'RECYCLED', label: 'Recycled' },
    { value: 'DESTROYED', label: 'Destroyed' }
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Trash2 className="h-6 w-6 text-[#3C3C43]" />
                Wastage Tracking
              </h1>
              <p className="text-gray-600">Record and monitor stock wastage, spoilage, and losses</p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </IOSButton>
              {canManage && (
                <IOSButton onClick={() => setIsCreateModalOpen(true)} className="bg-[#3C3C43] hover:bg-[#3C3C43]" leftIcon={<Plus />}>
                  Record Wastage
                </IOSButton>
              )}
            </div>
          </div>

          {/* Enhanced Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IOSCard className="p-5 bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#3C3C43]">Total Loss Value</p>
                  <p className="text-2xl font-bold text-[#000000] mt-1">KES {stats.totalLoss.toLocaleString()}</p>
                  <p className="text-xs text-[#8E8E93]0 mt-1">{stats.totalWastage} records total</p>
                </div>
                <div className="p-3 bg-[#E5E5EA] rounded-full">
                  <DollarSign className="h-6 w-6 text-[#000000]" />
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-5 bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#3C3C43]">This Month</p>
                  <p className="text-2xl font-bold text-[#3C3C43] mt-1">KES {stats.thisMonthLoss.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-1">
                    {monthChange.type === 'increase' ? (
                      <ArrowUpRight className="h-3 w-3 text-[#8E8E93]0" />
                    ) : monthChange.type === 'decrease' ? (
                      <ArrowDownRight className="h-3 w-3 text-[#8E8E93]0" />
                    ) : null}
                    <p className={`text-xs ${monthChange.type === 'increase' ? 'text-[#8E8E93]0' : monthChange.type === 'decrease' ? 'text-[#8E8E93]0' : 'text-gray-500'}`}>
                      {monthChange.percent}% vs last month
                    </p>
                  </div>
                </div>
                <div className="p-3 bg-[#F2F2F7] rounded-full">
                  <Calendar className="h-6 w-6 text-[#3C3C43]" />
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-5 bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#3C3C43]">Pending Approval</p>
                  <p className="text-2xl font-bold text-[#3C3C43] mt-1">{stats.pendingApproval}</p>
                  <p className="text-xs text-[#3C3C43] mt-1">Awaiting review</p>
                </div>
                <div className="p-3 bg-[#F2F2F7] rounded-full">
                  <Clock className="h-6 w-6 text-[#3C3C43]" />
                </div>
              </div>
            </IOSCard>
            
            <IOSCard className="p-5 bg-[#F2F2F7] border-[rgba(60,60,67,0.12)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-[#3C3C43]">Avg. Loss/Record</p>
                  <p className="text-2xl font-bold text-[#3C3C43] mt-1">KES {stats.avgLossPerRecord.toLocaleString()}</p>
                  <p className="text-xs text-[#3C3C43] mt-1">Top: {stats.topReason}</p>
                </div>
                <div className="p-3 bg-[#F2F2F7] rounded-full">
                  <BarChart3 className="h-6 w-6 text-[#3C3C43]" />
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Loss by Reason */}
            <IOSCard className="p-5">
              <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-4 flex items-center gap-2">
                <PieChart className="h-5 w-5 text-[#8E8E93]0" />
                Loss by Reason
              </h3>
              <div className="space-y-3">
                {reasonBreakdown.slice(0, 5).map((item, idx) => (
                  <div key={item.reason} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{item.reason}</span>
                        <span className="text-sm text-gray-500">{item.count} records</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            idx === 0 ? 'bg-[#F2F2F7]0' : 
                            idx === 1 ? 'bg-[#F2F2F7]' : 
                            idx === 2 ? 'bg-[#F2F2F7]' : 
                            idx === 3 ? 'bg-[#F2F2F7]0' : 'bg-gray-400'
                          }`}
                          style={{ width: `${stats.totalLoss > 0 ? (item.loss / stats.totalLoss) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-[#3C3C43] w-28 text-right">
                      KES {item.loss.toLocaleString()}
                    </span>
                  </div>
                ))}
                {reasonBreakdown.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No data available</p>
                )}
              </div>
            </IOSCard>

            {/* Loss by Branch */}
            <IOSCard className="p-5">
              <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#8E8E93]0" />
                Loss by Branch
              </h3>
              <div className="space-y-3">
                {branchBreakdown.slice(0, 5).map((item, idx) => (
                  <div key={item.branch} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{item.branch}</span>
                        <span className="text-sm text-gray-500">{item.count} records</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            idx === 0 ? 'bg-[#F2F2F7]0' : 
                            idx === 1 ? 'bg-[#F2F2F7]0' : 
                            idx === 2 ? 'bg-[#F2F2F7]' : 
                            idx === 3 ? 'bg-[#F2F2F7]' : 'bg-gray-400'
                          }`}
                          style={{ width: `${stats.totalLoss > 0 ? (item.loss / stats.totalLoss) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-bold text-[#3C3C43] w-28 text-right">
                      KES {item.loss.toLocaleString()}
                    </span>
                  </div>
                ))}
                {branchBreakdown.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No data available</p>
                )}
              </div>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by ref, item, or branch..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="border rounded-ios-lg px-3 py-2 text-sm"
              >
                <option value="">All Reasons</option>
                {reasons.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-ios-lg px-3 py-2 text-sm"
              >
                <option value="">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateFilter.from}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, from: e.target.value }))}
                  className="w-36 text-sm"
                />
                <span className="text-gray-400">to</span>
                <Input
                  type="date"
                  value={dateFilter.to}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, to: e.target.value }))}
                  className="w-36 text-sm"
                />
              </div>
              <IOSButton variant="outline" onClick={exportToCSV} className="ml-auto" leftIcon={<Download />}>Export CSV
              </IOSButton>
            </div>
          </IOSCard>

          {/* Wastage Table */}
          <IOSCard>
            {isLoading ? (
              <div className="p-12 text-center text-gray-500">Loading records...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No wastage records found</p>
                <p className="text-sm mt-1">That's a good thing! Less waste = more profit</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Loss</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-sm text-[#3C3C43]">{record.wastage_number}</td>
                        <td className="px-4 py-4">
                          <p className="font-medium">{record.item?.name}</p>
                          <p className="text-xs text-gray-500 font-mono">{record.item?.sku}</p>
                        </td>
                        <td className="px-4 py-4 text-sm">{record.branch?.name || '-'}</td>
                        <td className="px-4 py-4 text-center font-bold text-[#3C3C43]">{record.quantity}</td>
                        <td className="px-4 py-4">
                          <IOSBadge className={getReasonColor(record.reason)}>{record.reason}</IOSBadge>
                        </td>
                        <td className="px-4 py-4 text-right font-medium text-[#3C3C43]">
                          KES {record.total_loss?.toLocaleString()}
                        </td>
                        <td className="px-4 py-4">
                          <IOSBadge className={getStatusColor(record.status)}>{record.status}</IOSBadge>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">{formatDate(record.created_at)}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <IOSButton size="sm" variant="outline" onClick={() => viewRecord(record)}>
                              <Eye className="h-4 w-4" />
                            </IOSButton>
                            {canApprove && record.status === 'PENDING' && (
                              <>
                                <IOSButton 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-[#3C3C43] hover:bg-[#F2F2F7]"
                                  onClick={() => handleApproval(record.id, 'approve')}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </IOSButton>
                                <IOSButton 
                                  size="sm" 
                                  variant="outline" 
                                  className="text-[#3C3C43] hover:bg-[#F2F2F7]"
                                  onClick={() => handleApproval(record.id, 'reject')}
                                >
                                  <X className="h-4 w-4" />
                                </IOSButton>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </IOSCard>
        </div>

        {/* Create Wastage Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="max-w-2xl w-[95vw]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-[#3C3C43]">
                <Trash2 className="h-5 w-5" />
                Record Wastage
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 mt-4">
              <div className="bg-[#F2F2F7] border border-[rgba(60,60,67,0.12)] rounded-ios-lg p-4">
                <p className="text-sm text-[#000000] flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>This will reduce stock quantity and record a financial loss</span>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branches.length > 1 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Branch</label>
                    <select
                      value={formData.branch_id}
                      onChange={(e) => setFormData(prev => ({ ...prev, branch_id: e.target.value }))}
                      className="w-full border rounded-ios-lg px-3 py-2.5"
                    >
                      <option value="">Select Branch</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={branches.length > 1 ? '' : 'md:col-span-2'}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Item *</label>
                  <select
                    value={formData.item_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, item_id: e.target.value }))}
                    className="w-full border rounded-ios-lg px-3 py-2.5"
                  >
                    <option value="">Select Item</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.sku}) — Stock: {i.quantity || 0}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Quantity *</label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                    className="py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit Cost</label>
                  <div className="border rounded-ios-lg px-3 py-2.5 bg-gray-50 text-gray-600">
                    KES {(selectedItem?.cost_price || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Loss</label>
                  <div className="border-2 border-[rgba(60,60,67,0.12)] rounded-ios-lg px-3 py-2.5 bg-[#F2F2F7] text-[#000000] font-bold">
                    KES {estimatedLoss.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reason *</label>
                  <select
                    value={formData.reason}
                    onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    className="w-full border rounded-ios-lg px-3 py-2.5"
                  >
                    <option value="">Select Reason</option>
                    {reasons.map(r => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Disposal Method</label>
                  <select
                    value={formData.disposal_method}
                    onChange={(e) => setFormData(prev => ({ ...prev, disposal_method: e.target.value }))}
                    className="w-full border rounded-ios-lg px-3 py-2.5"
                  >
                    <option value="">Select Method</option>
                    {disposalMethods.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Details</label>
                <textarea
                  value={formData.reason_details}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason_details: e.target.value }))}
                  className="w-full border rounded-ios-lg px-3 py-2.5"
                  rows={3}
                  placeholder="Describe what happened, when it was discovered, etc..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-5 border-t">
                <IOSButton variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </IOSButton>
                <IOSButton 
                  onClick={handleCreateWastage} 
                  disabled={!formData.item_id || !formData.reason}
                  className="bg-[#3C3C43] hover:bg-[#3C3C43]"
                 leftIcon={<Trash2 />}>Record Wastage
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Details Modal */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-[#3C3C43]" />
                Wastage Record Details
              </DialogTitle>
            </DialogHeader>
            {selectedRecord && (
              <div className="space-y-6 mt-4">
                {/* Status Banner */}
                <div className={`p-4 rounded-ios-lg flex items-center justify-between ${
                  selectedRecord.status === 'APPROVED' ? 'bg-[#F2F2F7] border border-[rgba(60,60,67,0.12)]' :
                  selectedRecord.status === 'REJECTED' ? 'bg-[#F2F2F7] border border-[rgba(60,60,67,0.12)]' :
                  'bg-[#F2F2F7] border border-[rgba(60,60,67,0.12)]'
                }`}>
                  <div className="flex items-center gap-3">
                    {selectedRecord.status === 'APPROVED' ? (
                      <CheckCircle className="h-6 w-6 text-[#3C3C43]" />
                    ) : selectedRecord.status === 'REJECTED' ? (
                      <XCircle className="h-6 w-6 text-[#3C3C43]" />
                    ) : (
                      <Clock className="h-6 w-6 text-[#3C3C43]" />
                    )}
                    <div>
                      <p className="font-semibold font-sf-pro-display">{selectedRecord.status}</p>
                      <p className="text-sm text-gray-600">
                        {selectedRecord.status === 'PENDING' ? 'Awaiting approval' : 
                         `${selectedRecord.status === 'APPROVED' ? 'Approved' : 'Rejected'} by ${selectedRecord.approved_by || 'Manager'}`}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-lg">{selectedRecord.wastage_number}</span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Item</label>
                      <p className="font-semibold font-sf-pro-display text-lg">{selectedRecord.item?.name}</p>
                      <p className="text-sm text-gray-500 font-mono">{selectedRecord.item?.sku}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Branch</label>
                      <p className="font-medium">{selectedRecord.branch?.name}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Recorded By</label>
                      <p className="font-medium">{selectedRecord.recorded_by || 'System'}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Quantity Wasted</label>
                      <p className="font-bold text-2xl text-[#3C3C43]">{selectedRecord.quantity}</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Total Loss</label>
                      <p className="font-bold text-xl text-[#3C3C43]">KES {selectedRecord.total_loss?.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">@ KES {selectedRecord.unit_cost?.toLocaleString()} per unit</p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Date Recorded</label>
                      <p className="font-medium">{formatDate(selectedRecord.created_at)}</p>
                    </div>
                  </div>
                </div>

                {/* Reason & Details */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-xs text-gray-500 uppercase">Reason:</label>
                    <IOSBadge className={getReasonColor(selectedRecord.reason)}>{selectedRecord.reason}</IOSBadge>
                    {selectedRecord.disposal_method && (
                      <>
                        <label className="text-xs text-gray-500 uppercase ml-4">Disposal:</label>
                        <IOSBadge variant="light" color="secondary">{selectedRecord.disposal_method}</IOSBadge>
                      </>
                    )}
                  </div>
                  {selectedRecord.reason_details && (
                    <div className="bg-gray-50 rounded-ios-lg p-3">
                      <label className="text-xs text-gray-500 uppercase">Additional Details</label>
                      <p className="mt-1 text-sm">{selectedRecord.reason_details}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <IOSButton variant="outline" onClick={() => setIsViewModalOpen(false)}>
                    Close
                  </IOSButton>
                  {canApprove && selectedRecord.status === 'PENDING' && (
                    <>
                      <IOSButton 
                        variant="outline" 
                        className="text-[#3C3C43] border-[rgba(60,60,67,0.12)] hover:bg-[#F2F2F7]"
                        onClick={() => handleApproval(selectedRecord.id, 'reject')}
                        leftIcon={<X />}
                      >
                        Reject
                      </IOSButton>
                      <IOSButton 
                        className="bg-[#3C3C43] hover:bg-[#3C3C43]"
                        onClick={() => handleApproval(selectedRecord.id, 'approve')}
                        leftIcon={<CheckCircle />}
                      >
                        Approve
                      </IOSButton>
                    </>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
