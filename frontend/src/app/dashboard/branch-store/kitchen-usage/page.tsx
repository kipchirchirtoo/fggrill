'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ChefHat, 
  Package, 
  AlertTriangle, 
  TrendingDown, 
  Plus,
  RefreshCw,
  Eye,
  CheckCircle,
  XCircle,
  Users,
  Calendar,
  Filter
} from 'lucide-react';
import { storeAPI, staffAPI } from '@/lib/api';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface UsageRecord {
  id: string;
  item_sku: string;
  item_name: string;
  category: string;
  received_quantity: number;
  consumed_quantity: number;
  spoilt_quantity: number;
  lost_quantity: number;
  damaged_quantity: number;
  remaining_quantity: number;
  unit_cost: number;
  loss_value: number;
  status: string;
  usage_date: string;
}

interface UsageEntry {
  id: string;
  usage_type: string;
  quantity: number;
  responsible_staff_id: string;
  responsible_staff_name: string;
  reason: string;
  notes: string;
  produced_item: string;
  portions_produced: number;
  created_at: string;
}

interface Staff {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
}

interface BranchStock {
  item_sku: string;
  item_name: string;
  category: string;
  quantity: number;
  cost_price: number;
  retail_price: number;
}

export default function KitchenUsagePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'track' | 'records' | 'reports'>('track');
  const [isLoading, setIsLoading] = useState(true);
  
  // Data states
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [branchStock, setBranchStock] = useState<BranchStock[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<UsageRecord | null>(null);
  const [usageEntries, setUsageEntries] = useState<UsageEntry[]>([]);
  
  // Modal states
  const [showNewRecordModal, setShowNewRecordModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Form states
  const [newRecord, setNewRecord] = useState({
    item_sku: '',
    received_quantity: 1,
    unit_cost: 0,
    expected_revenue: 0,
    usage_date: new Date().toISOString().split('T')[0]
  });
  
  const [newEntry, setNewEntry] = useState({
    usage_type: 'CONSUMED' as 'CONSUMED' | 'SPOILT' | 'LOST' | 'DAMAGED' | 'EXPIRED' | 'RETURNED',
    quantity: 1,
    responsible_staff_id: '',
    responsible_staff_name: '',
    reason: '',
    notes: '',
    produced_item: '',
    portions_produced: 0
  });

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [recordsRes, stockRes, staffRes] = await Promise.all([
        storeAPI.getKitchenUsageRecords().catch(() => ({ data: [] })),
        storeAPI.getTrackableItems().catch(() => ({ data: [] })),
        storeAPI.getBranchStaffForUsage().catch(() => ({ data: [] }))
      ]);
      
      setUsageRecords(Array.isArray(recordsRes.data) ? recordsRes.data : []);
      setBranchStock(Array.isArray(stockRes.data) ? stockRes.data : []);
      setStaff(Array.isArray(staffRes.data) ? staffRes.data : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecord.item_sku || newRecord.received_quantity <= 0) {
      toast.error('Please select an item and quantity');
      return;
    }
    
    try {
      await storeAPI.createKitchenUsageRecord({
        item_sku: newRecord.item_sku,
        received_quantity: newRecord.received_quantity,
        unit_cost: newRecord.unit_cost,
        expected_revenue: newRecord.expected_revenue,
        usage_date: newRecord.usage_date
      });
      toast.success('Usage tracking record created');
      setShowNewRecordModal(false);
      setNewRecord({
        item_sku: '',
        received_quantity: 1,
        unit_cost: 0,
        expected_revenue: 0,
        usage_date: new Date().toISOString().split('T')[0]
      });
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create record');
    }
  };

  const handleRecordEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord || newEntry.quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }
    
    // Get staff name if staff selected
    let staffName = newEntry.responsible_staff_name;
    if (newEntry.responsible_staff_id) {
      const staffMember = staff.find(s => s.id === newEntry.responsible_staff_id);
      staffName = staffMember ? `${staffMember.first_name} ${staffMember.last_name}` : '';
    }
    
    try {
      await storeAPI.recordKitchenUsageEntry(selectedRecord.id, {
        ...newEntry,
        responsible_staff_name: staffName
      });
      toast.success('Usage entry recorded');
      setShowEntryModal(false);
      setNewEntry({
        usage_type: 'CONSUMED',
        quantity: 1,
        responsible_staff_id: '',
        responsible_staff_name: '',
        reason: '',
        notes: '',
        produced_item: '',
        portions_produced: 0
      });
      fetchData();
      // Refresh entries if viewing details
      if (showDetailsModal) {
        loadEntries(selectedRecord.id);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to record entry');
    }
  };

  const loadEntries = async (recordId: string) => {
    try {
      const res = await storeAPI.getKitchenUsageEntries(recordId);
      setUsageEntries(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error loading entries:', error);
      setUsageEntries([]);
    }
  };

  const handleViewDetails = async (record: UsageRecord) => {
    setSelectedRecord(record);
    await loadEntries(record.id);
    setShowDetailsModal(true);
  };

  const handleAddEntry = (record: UsageRecord) => {
    setSelectedRecord(record);
    setShowEntryModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-700';
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-700';
      case 'CLOSED': return 'bg-gray-100 text-gray-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };

  const getUsageTypeColor = (type: string) => {
    switch (type) {
      case 'CONSUMED': return 'bg-green-100 text-green-700';
      case 'SPOILT': return 'bg-red-100 text-red-700';
      case 'LOST': return 'bg-orange-100 text-orange-700';
      case 'DAMAGED': return 'bg-yellow-100 text-yellow-700';
      case 'EXPIRED': return 'bg-purple-100 text-purple-700';
      case 'RETURNED': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Calculate summary stats
  const stats = {
    totalRecords: usageRecords.length,
    pendingRecords: usageRecords.filter(r => r.status === 'PENDING').length,
    totalConsumed: usageRecords.reduce((sum, r) => sum + (r.consumed_quantity || 0), 0),
    totalLoss: usageRecords.reduce((sum, r) => sum + parseFloat(String(r.loss_value || 0)), 0)
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Kitchen Usage Tracking</h1>
              <p className="text-gray-600">Track how received items are used in the kitchen</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={fetchData} variant="outline" disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={() => setShowNewRecordModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
                <Plus className="h-4 w-4 mr-2" />
                New Tracking Record
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Records</p>
                  <p className="text-2xl font-bold">{stats.totalRecords}</p>
                </div>
                <Package className="h-8 w-8 text-indigo-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Pending Tracking</p>
                  <p className="text-2xl font-bold">{stats.pendingRecords}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Items Consumed</p>
                  <p className="text-2xl font-bold">{stats.totalConsumed}</p>
                </div>
                <ChefHat className="h-8 w-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Loss Value</p>
                  <p className="text-2xl font-bold text-red-600">KES {stats.totalLoss.toLocaleString()}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-red-500" />
              </div>
            </Card>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-4">
              {[
                { id: 'track', label: 'Track Usage', icon: ChefHat },
                { id: 'records', label: 'Usage Records', icon: Package },
                { id: 'reports', label: 'Staff Reports', icon: Users }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'track' && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Items Available for Tracking</h2>
              <p className="text-gray-600 text-sm mb-4">
                Select items from your branch stock to start tracking kitchen usage.
              </p>
              
              {branchStock.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No items in branch stock to track</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Item</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Category</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Stock</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Cost Price</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {branchStock.map((item) => (
                        <tr key={item.item_sku} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium">{item.item_name}</p>
                            <p className="text-xs text-gray-500">{item.item_sku}</p>
                          </td>
                          <td className="px-4 py-3 text-sm">{item.category || '-'}</td>
                          <td className="px-4 py-3 text-sm font-medium">{item.quantity}</td>
                          <td className="px-4 py-3 text-sm">KES {item.cost_price?.toLocaleString() || 0}</td>
                          <td className="px-4 py-3">
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setNewRecord({
                                  item_sku: item.item_sku,
                                  received_quantity: 1,
                                  unit_cost: item.cost_price || 0,
                                  expected_revenue: 0,
                                  usage_date: new Date().toISOString().split('T')[0]
                                });
                                setShowNewRecordModal(true);
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Track
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {activeTab === 'records' && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Usage Tracking Records</h2>
                <div className="flex gap-2">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="border rounded-lg px-3 py-1 text-sm"
                  >
                    <option value="">All Status</option>
                    <option value="PENDING">Pending</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
              </div>
              
              {usageRecords.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No usage records yet</p>
                  <Button 
                    className="mt-4" 
                    variant="outline"
                    onClick={() => setShowNewRecordModal(true)}
                  >
                    Create First Record
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Item</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Received</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Consumed</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Spoilt/Lost</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Remaining</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Loss Value</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {usageRecords
                        .filter(r => !statusFilter || r.status === statusFilter)
                        .map((record) => (
                        <tr key={record.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">{record.usage_date}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium">{record.item_name}</p>
                            <p className="text-xs text-gray-500">{record.item_sku}</p>
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-medium">{record.received_quantity}</td>
                          <td className="px-4 py-3 text-center text-sm text-green-600">{record.consumed_quantity || 0}</td>
                          <td className="px-4 py-3 text-center text-sm text-red-600">
                            {(record.spoilt_quantity || 0) + (record.lost_quantity || 0) + (record.damaged_quantity || 0)}
                          </td>
                          <td className="px-4 py-3 text-center text-sm font-medium">{record.remaining_quantity}</td>
                          <td className="px-4 py-3 text-sm text-red-600">
                            KES {parseFloat(String(record.loss_value || 0)).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(record.status)}`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handleViewDetails(record)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {record.remaining_quantity > 0 && record.status !== 'CLOSED' && (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleAddEntry(record)}
                                  className="text-indigo-600"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {activeTab === 'reports' && (
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Staff Accountability Reports</h2>
              <p className="text-gray-500 text-sm mb-4">
                View staff performance and accountability for kitchen usage.
              </p>
              
              {staff.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No staff data available</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {staff.map((member) => (
                    <div key={member.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{member.first_name} {member.last_name}</p>
                          <p className="text-sm text-gray-500">{member.role}</p>
                        </div>
                        <Button size="sm" variant="outline">
                          View Report
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>

        {/* New Record Modal */}
        <AnimatePresence>
          {showNewRecordModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setShowNewRecordModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-xl p-6 max-w-md w-full mx-4"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-semibold mb-4">Create Usage Tracking Record</h2>
                <form onSubmit={handleCreateRecord} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Select Item</label>
                    <select
                      value={newRecord.item_sku}
                      onChange={(e) => {
                        const item = branchStock.find(s => s.item_sku === e.target.value);
                        setNewRecord({
                          ...newRecord,
                          item_sku: e.target.value,
                          unit_cost: item?.cost_price || 0
                        });
                      }}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    >
                      <option value="">-- Select Item --</option>
                      {branchStock.map((item) => (
                        <option key={item.item_sku} value={item.item_sku}>
                          {item.item_name} ({item.quantity} in stock)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={newRecord.received_quantity}
                        onChange={(e) => setNewRecord({ ...newRecord, received_quantity: parseInt(e.target.value) || 1 })}
                        className="w-full border rounded-lg px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Unit Cost (KES)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newRecord.unit_cost}
                        onChange={(e) => setNewRecord({ ...newRecord, unit_cost: parseFloat(e.target.value) || 0 })}
                        className="w-full border rounded-lg px-3 py-2"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Expected Revenue (KES)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newRecord.expected_revenue}
                      onChange={(e) => setNewRecord({ ...newRecord, expected_revenue: parseFloat(e.target.value) || 0 })}
                      className="w-full border rounded-lg px-3 py-2"
                      placeholder="How much should this generate?"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Date</label>
                    <input
                      type="date"
                      value={newRecord.usage_date}
                      onChange={(e) => setNewRecord({ ...newRecord, usage_date: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setShowNewRecordModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                      Create Record
                    </Button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Entry Modal */}
        <AnimatePresence>
          {showEntryModal && selectedRecord && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setShowEntryModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h2 className="text-xl font-semibold mb-2">Record Usage Entry</h2>
                <p className="text-gray-500 text-sm mb-4">
                  {selectedRecord.item_name} - {selectedRecord.remaining_quantity} remaining
                </p>
                
                <form onSubmit={handleRecordEntry} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Usage Type</label>
                    <select
                      value={newEntry.usage_type}
                      onChange={(e) => setNewEntry({ ...newEntry, usage_type: e.target.value as any })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    >
                      <option value="CONSUMED">Consumed (Used in cooking)</option>
                      <option value="SPOILT">Spoilt</option>
                      <option value="LOST">Lost</option>
                      <option value="DAMAGED">Damaged</option>
                      <option value="EXPIRED">Expired</option>
                      <option value="RETURNED">Returned to Store</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedRecord.remaining_quantity}
                      value={newEntry.quantity}
                      onChange={(e) => setNewEntry({ ...newEntry, quantity: parseInt(e.target.value) || 1 })}
                      className="w-full border rounded-lg px-3 py-2"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">Max: {selectedRecord.remaining_quantity}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Responsible Staff</label>
                    <select
                      value={newEntry.responsible_staff_id}
                      onChange={(e) => setNewEntry({ ...newEntry, responsible_staff_id: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                    >
                      <option value="">-- Select Staff (Optional) --</option>
                      {staff.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.first_name} {member.last_name} ({member.role})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  {newEntry.usage_type === 'CONSUMED' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium mb-1">What was produced?</label>
                        <input
                          type="text"
                          value={newEntry.produced_item}
                          onChange={(e) => setNewEntry({ ...newEntry, produced_item: e.target.value })}
                          className="w-full border rounded-lg px-3 py-2"
                          placeholder="e.g., Grilled Chicken"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Portions Produced</label>
                        <input
                          type="number"
                          min="0"
                          value={newEntry.portions_produced}
                          onChange={(e) => setNewEntry({ ...newEntry, portions_produced: parseInt(e.target.value) || 0 })}
                          className="w-full border rounded-lg px-3 py-2"
                        />
                      </div>
                    </>
                  )}
                  
                  {['SPOILT', 'LOST', 'DAMAGED', 'EXPIRED'].includes(newEntry.usage_type) && (
                    <div>
                      <label className="block text-sm font-medium mb-1">Reason</label>
                      <input
                        type="text"
                        value={newEntry.reason}
                        onChange={(e) => setNewEntry({ ...newEntry, reason: e.target.value })}
                        className="w-full border rounded-lg px-3 py-2"
                        placeholder="Why did this happen?"
                      />
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <textarea
                      value={newEntry.notes}
                      onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                      className="w-full border rounded-lg px-3 py-2"
                      rows={2}
                      placeholder="Additional notes..."
                    />
                  </div>
                  
                  <div className="flex gap-2 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setShowEntryModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700">
                      Record Entry
                    </Button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Details Modal */}
        <AnimatePresence>
          {showDetailsModal && selectedRecord && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => setShowDetailsModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedRecord.item_name}</h2>
                    <p className="text-gray-500 text-sm">{selectedRecord.item_sku} - {selectedRecord.usage_date}</p>
                  </div>
                  <span className={`px-3 py-1 text-sm rounded-full ${getStatusColor(selectedRecord.status)}`}>
                    {selectedRecord.status}
                  </span>
                </div>

                {/* Summary */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-gray-500">Received</p>
                    <p className="text-xl font-bold">{selectedRecord.received_quantity}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-gray-500">Consumed</p>
                    <p className="text-xl font-bold text-green-600">{selectedRecord.consumed_quantity || 0}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <p className="text-sm text-gray-500">Loss</p>
                    <p className="text-xl font-bold text-red-600">
                      {(selectedRecord.spoilt_quantity || 0) + (selectedRecord.lost_quantity || 0) + (selectedRecord.damaged_quantity || 0)}
                    </p>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="mb-6">
                  <h3 className="font-medium mb-2">Usage Breakdown</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>Consumed:</span>
                      <span className="font-medium text-green-600">{selectedRecord.consumed_quantity || 0}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>Spoilt:</span>
                      <span className="font-medium text-red-600">{selectedRecord.spoilt_quantity || 0}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>Lost:</span>
                      <span className="font-medium text-orange-600">{selectedRecord.lost_quantity || 0}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>Damaged:</span>
                      <span className="font-medium text-yellow-600">{selectedRecord.damaged_quantity || 0}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span>Remaining:</span>
                      <span className="font-bold">{selectedRecord.remaining_quantity}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-red-50 rounded">
                      <span>Loss Value:</span>
                      <span className="font-bold text-red-600">KES {parseFloat(String(selectedRecord.loss_value || 0)).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Entries */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium">Usage Entries</h3>
                    {selectedRecord.remaining_quantity > 0 && selectedRecord.status !== 'CLOSED' && (
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setShowDetailsModal(false);
                          handleAddEntry(selectedRecord);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Entry
                      </Button>
                    )}
                  </div>
                  
                  {usageEntries.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">No entries recorded yet</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {usageEntries.map((entry) => (
                        <div key={entry.id} className="border rounded-lg p-3 text-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getUsageTypeColor(entry.usage_type)}`}>
                              {entry.usage_type}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {new Date(entry.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="font-medium">Quantity: {entry.quantity}</p>
                          {entry.responsible_staff_name && (
                            <p className="text-gray-600">Staff: {entry.responsible_staff_name}</p>
                          )}
                          {entry.produced_item && (
                            <p className="text-gray-600">Produced: {entry.produced_item} ({entry.portions_produced} portions)</p>
                          )}
                          {entry.reason && (
                            <p className="text-gray-600">Reason: {entry.reason}</p>
                          )}
                          {entry.notes && (
                            <p className="text-gray-500 text-xs mt-1">{entry.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 mt-4 border-t">
                  <Button variant="outline" className="flex-1" onClick={() => setShowDetailsModal(false)}>
                    Close
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
