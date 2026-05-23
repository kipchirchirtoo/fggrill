'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Trash2, Plus, RefreshCw, Search, Package, AlertTriangle,
  Calendar, DollarSign, Clock, Eye, CheckCircle, X, Download,
  BarChart3, PieChart, ArrowUpRight, ArrowDownRight, Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { storeAPI } from '@/lib/api';

interface SpoilageRecord {
  id: string;
  spoilage_number: string;
  item_sku: string;
  item_name: string;
  store_type: string;
  category: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_loss: number;
  reason: string;
  reason_details?: string;
  disposal_method?: string;
  status: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  recorded_by: string;
  recorded_by_name?: string;
  notes?: string;
  spoilage_date: string;
  created_at: string;
  current_stock?: number;
}

interface SpoilageItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  store_type: string;
  unit: string;
  cost: number;
  stock: number;
}

export default function CentralSpoilagePage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<SpoilageRecord[]>([]);
  const [items, setItems] = useState<SpoilageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [storeTypeFilter, setStoreTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState({ from: '', to: '' });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    item_sku: '',
    quantity: 1,
    unit: 'pcs',
    reason: '',
    reason_details: '',
    disposal_method: '',
    notes: '',
    spoilage_date: new Date().toISOString().split('T')[0]
  });

  // Stats
  const [stats, setStats] = useState({
    totalRecords: 0,
    totalLoss: 0,
    pendingApproval: 0,
    byReason: {} as Record<string, number>,
    byStoreType: {} as Record<string, number>
  });

  // View modal
  const [selectedRecord, setSelectedRecord] = useState<SpoilageRecord | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [reasonFilter, statusFilter, storeTypeFilter]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [recordsRes, itemsRes] = await Promise.all([
        storeAPI.getSpoilageRecords({
          reason: reasonFilter,
          status: statusFilter,
          store_type: storeTypeFilter,
          from_date: dateFilter.from,
          to_date: dateFilter.to
        }),
        storeAPI.getSpoilageItems()
      ]);

      if (recordsRes.success) {
        setRecords(recordsRes.data || []);
        setStats(recordsRes.summary || {
          totalRecords: 0,
          totalLoss: 0,
          pendingApproval: 0,
          byReason: {},
          byStoreType: {}
        });
      }
      if (itemsRes.success) {
        setItems(itemsRes.data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSpoilage = async () => {
    try {
      const selectedItem = items.find(i => i.sku === formData.item_sku);
      const result = await storeAPI.createSpoilageRecord({
        ...formData,
        unit: selectedItem?.unit || 'pcs'
      });

      if (result.success) {
        toast.success('Spoilage recorded - stock deducted');
        setIsCreateModalOpen(false);
        setFormData({
          item_sku: '',
          quantity: 1,
          unit: 'pcs',
          reason: '',
          reason_details: '',
          disposal_method: '',
          notes: '',
          spoilage_date: new Date().toISOString().split('T')[0]
        });
        fetchData();
      } else {
        toast.error(result.message || 'Failed to record spoilage');
      }
    } catch (error) {
      toast.error('Failed to record spoilage');
    }
  };

  const getReasonColor = (reason: string) => {
    const colors: Record<string, string> = {
      'EXPIRED': 'bg-orange-100 text-orange-700',
      'DAMAGED': 'bg-red-100 text-red-700',
      'SPOILED': 'bg-yellow-100 text-yellow-700',
      'QUALITY_ISSUE': 'bg-purple-100 text-purple-700',
      'THEFT': 'bg-gray-100 text-gray-700',
      'BREAKAGE': 'bg-blue-100 text-blue-700',
      'CONTAMINATION': 'bg-pink-100 text-pink-700',
      'OTHER': 'bg-gray-100 text-gray-700'
    };
    return colors[reason] || 'bg-gray-100 text-gray-700';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'PENDING': 'bg-yellow-100 text-yellow-700',
      'APPROVED': 'bg-green-100 text-green-700',
      'REJECTED': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const handleApproval = async (recordId: string, action: 'approve' | 'reject') => {
    try {
      const rejectionReason = action === 'reject' ? prompt('Enter rejection reason:') : undefined;
      if (action === 'reject' && !rejectionReason) {
        return;
      }

      const result = await storeAPI.updateSpoilageStatus(recordId, {
        action,
        rejection_reason: rejectionReason
      });

      if (result.success) {
        toast.success(`Spoilage record ${action}d successfully`);
        fetchData();
        setIsViewModalOpen(false);
      } else {
        toast.error(`Failed to ${action} record`);
      }
    } catch (error) {
      toast.error(`Failed to ${action} record`);
    }
  };

  const exportToCSV = () => {
    const headers = ['Ref #', 'Item', 'SKU', 'Store Type', 'Quantity', 'Unit', 'Unit Cost', 'Total Loss', 'Reason', 'Status', 'Date', 'Recorded By'];
    const rows = filteredRecords.map(r => [
      r.spoilage_number,
      r.item_name,
      r.item_sku,
      r.store_type,
      r.quantity,
      r.unit,
      r.unit_cost,
      r.total_loss,
      r.reason,
      r.status,
      formatDate(r.created_at),
      r.recorded_by_name || ''
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `central-spoilage-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast.success('Report exported successfully');
  };

  const viewRecord = (record: SpoilageRecord) => {
    setSelectedRecord(record);
    setIsViewModalOpen(true);
  };

  const filteredRecords = records.filter(r => {
    const matchesSearch = searchTerm === '' ||
      r.spoilage_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.item_sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDate = (!dateFilter.from || new Date(r.created_at) >= new Date(dateFilter.from)) &&
      (!dateFilter.to || new Date(r.created_at) <= new Date(dateFilter.to));
    return matchesSearch && matchesDate;
  });

  const canApprove = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.AUDITOR;
  const canManage = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;

  const selectedItem = items.find(i => i.sku === formData.item_sku);
  const estimatedLoss = formData.quantity * (selectedItem?.cost || 0);

  const reasons = [
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'DAMAGED', label: 'Damaged' },
    { value: 'SPOILED', label: 'Spoiled' },
    { value: 'QUALITY_ISSUE', label: 'Quality Issue' },
    { value: 'THEFT', label: 'Theft/Loss' },
    { value: 'BREAKAGE', label: 'Breakage' },
    { value: 'CONTAMINATION', label: 'Contamination' },
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
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Trash2 className="h-6 w-6 text-stone-700" />
                Central Store Spoilage Log
              </h1>
              <p className="text-gray-600">Record and monitor central store spoilage, damage, and losses</p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={fetchData} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </IOSButton>
              {canManage && (
                <IOSButton onClick={() => setIsCreateModalOpen(true)} leftIcon={<Plus />}>
                  Record Spoilage
                </IOSButton>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-5 bg-stone-50 border-stone-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-600">Total Loss Value</p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">KES {stats.totalLoss.toLocaleString()}</p>
                  <p className="text-xs text-stone-500 mt-1">{stats.totalRecords} records total</p>
                </div>
                <div className="p-3 bg-stone-200 rounded-full">
                  <DollarSign className="h-6 w-6 text-stone-700" />
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-5 bg-stone-50 border-stone-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-600">Pending Approval</p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">{stats.pendingApproval}</p>
                  <p className="text-xs text-stone-500 mt-1">Awaiting review</p>
                </div>
                <div className="p-3 bg-stone-200 rounded-full">
                  <Clock className="h-6 w-6 text-stone-700" />
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-5 bg-stone-50 border-stone-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-600">Foodstuffs</p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">{stats.byStoreType?.foodstuffs || 0}</p>
                  <p className="text-xs text-stone-500 mt-1">Records</p>
                </div>
                <div className="p-3 bg-orange-100 rounded-full">
                  <Package className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </IOSCard>

            <IOSCard className="p-5 bg-stone-50 border-stone-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-600">Bar Store</p>
                  <p className="text-2xl font-bold text-stone-900 mt-1">{stats.byStoreType?.bar_store || 0}</p>
                  <p className="text-xs text-stone-500 mt-1">Records</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-full">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </IOSCard>
          </div>

          {/* Filters */}
          <IOSCard className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input
                  placeholder="Search by ref, item, or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={storeTypeFilter}
                onChange={(e) => setStoreTypeFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Store Types</option>
                <option value="foodstuffs">Foodstuffs</option>
                <option value="bar_store">Bar Store</option>
              </select>
              <select
                value={reasonFilter}
                onChange={(e) => setReasonFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Reasons</option>
                {reasons.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
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
              <IOSButton variant="outline" onClick={exportToCSV} className="ml-auto" leftIcon={<Download />}>
                Export CSV
              </IOSButton>
            </div>
          </IOSCard>

          {/* Spoilage Table */}
          <IOSCard>
            {isLoading ? (
              <div className="p-12 text-center text-gray-500">Loading records...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Trash2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>No spoilage records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ref #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store Type</th>
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
                        <td className="px-4 py-4 font-mono text-sm text-stone-700">{record.spoilage_number}</td>
                        <td className="px-4 py-4">
                          <p className="font-medium">{record.item_name}</p>
                          <p className="text-xs text-gray-500 font-mono">{record.item_sku}</p>
                        </td>
                        <td className="px-4 py-4">
                          <IOSBadge className={record.store_type === 'bar_store' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}>
                            {record.store_type === 'bar_store' ? 'Bar Store' : 'Foodstuffs'}
                          </IOSBadge>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-stone-700">{record.quantity} {record.unit}</td>
                        <td className="px-4 py-4">
                          <IOSBadge className={getReasonColor(record.reason)}>{record.reason}</IOSBadge>
                        </td>
                        <td className="px-4 py-4 text-right font-medium text-stone-700">
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
                                  className="text-green-600 hover:bg-green-50"
                                  onClick={() => handleApproval(record.id, 'approve')}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </IOSButton>
                                <IOSButton
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:bg-red-50"
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

        {/* Create Spoilage Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="max-w-2xl w-[95vw]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-stone-700">
                <Trash2 className="h-5 w-5" />
                Record Central Store Spoilage
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 mt-4">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-sm text-orange-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  <span>This will reduce stock quantity and record a financial loss</span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Item *</label>
                <select
                  value={formData.item_sku}
                  onChange={(e) => setFormData(prev => ({ ...prev, item_sku: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2.5"
                >
                  <option value="">Select Item</option>
                  {items.map(i => (
                    <option key={i.id} value={i.sku}>
                      {i.name} ({i.sku}) — Stock: {i.stock} — {i.store_type === 'bar_store' ? 'Bar Store' : 'Foodstuffs'}
                    </option>
                  ))}
                </select>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                  <div className="border rounded-lg px-3 py-2.5 bg-gray-50 text-gray-600">
                    {selectedItem?.unit || 'pcs'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Total Loss</label>
                  <div className="border-2 border-orange-200 rounded-lg px-3 py-2.5 bg-orange-50 text-orange-900 font-bold">
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
                    className="w-full border rounded-lg px-3 py-2.5"
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
                    className="w-full border rounded-lg px-3 py-2.5"
                  >
                    <option value="">Select Method</option>
                    {disposalMethods.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Spoilage Date</label>
                <Input
                  type="date"
                  value={formData.spoilage_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, spoilage_date: e.target.value }))}
                  className="py-2.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason Details</label>
                <Input
                  placeholder="Additional details about the spoilage..."
                  value={formData.reason_details}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason_details: e.target.value }))}
                  className="py-2.5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <Input
                  placeholder="Any additional notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="py-2.5"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <IOSButton variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</IOSButton>
                <IOSButton onClick={handleCreateSpoilage} disabled={!formData.item_sku || !formData.reason}>
                  Record Spoilage
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Record Modal */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="max-w-lg w-[95vw]">
            <DialogHeader>
              <DialogTitle>Spoilage Record Details</DialogTitle>
            </DialogHeader>
            {selectedRecord && (
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Reference</p>
                    <p className="font-medium">{selectedRecord.spoilage_number}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <IOSBadge className={getStatusColor(selectedRecord.status)}>{selectedRecord.status}</IOSBadge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Item</p>
                    <p className="font-medium">{selectedRecord.item_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">SKU</p>
                    <p className="font-mono text-sm">{selectedRecord.item_sku}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Quantity</p>
                    <p className="font-medium">{selectedRecord.quantity} {selectedRecord.unit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Loss</p>
                    <p className="font-medium text-red-600">KES {selectedRecord.total_loss?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Reason</p>
                    <IOSBadge className={getReasonColor(selectedRecord.reason)}>{selectedRecord.reason}</IOSBadge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Store Type</p>
                    <p className="font-medium">{selectedRecord.store_type === 'bar_store' ? 'Bar Store' : 'Foodstuffs'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Recorded By</p>
                    <p className="font-medium">{selectedRecord.recorded_by_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date</p>
                    <p className="font-medium">{formatDate(selectedRecord.created_at)}</p>
                  </div>
                </div>
                {selectedRecord.reason_details && (
                  <div>
                    <p className="text-sm text-gray-500">Reason Details</p>
                    <p className="font-medium">{selectedRecord.reason_details}</p>
                  </div>
                )}
                {selectedRecord.rejection_reason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-sm text-red-800">Rejection Reason: {selectedRecord.rejection_reason}</p>
                  </div>
                )}
                {selectedRecord.notes && (
                  <div>
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="font-medium">{selectedRecord.notes}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
