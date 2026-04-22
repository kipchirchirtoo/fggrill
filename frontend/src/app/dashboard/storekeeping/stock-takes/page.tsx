'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { storeAPI } from '@/lib/api';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from "@/components/ui/minimal/button";
import { Input } from '@/components/ui/input';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClipboardList, Plus, Eye, RefreshCw, Play, CheckCircle, Clock, XCircle, AlertTriangle, Package, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';


interface StockTake {
  id: string;
  take_number: string;
  branch_id: number;
  branch?: { id: number; name: string; code: string };
  take_type: string;
  status: string;
  total_items_counted: number;
  items_with_variance: number;
  started_by: string;
  started_at: string;
  completed_at?: string;
  notes?: string;
}

interface StockTakeItem {
  id: string;
  item_sku: string;
  item?: { item_name?: string; description?: string };
  system_quantity: number;
  counted_quantity?: number;
  variance_reason?: string;
  status: string;
}

interface Branch {
  id: number;
  name: string;
  code: string;
}

const TAKE_TYPES = ['FULL', 'PARTIAL', 'SPOT_CHECK'];

export default function StockTakesPage() {
  const { user } = useAuth();
  const canEdit = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;
  const [stockTakes, setStockTakes] = useState<StockTake[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedTake, setSelectedTake] = useState<StockTake | null>(null);
  const [takeItems, setTakeItems] = useState<StockTakeItem[]>([]);
  const [newForm, setNewForm] = useState({ branch_id: 0, count_type: 'FULL', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [filteredTakes, setFilteredTakes] = useState<StockTake[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchData(); }, []);

  // Filter stock takes based on current filters
  const getFilteredTakes = () => {
    return stockTakes.filter(take => {
      const matchesStatus = statusFilter === 'all' || take.status === statusFilter;
      const matchesSearch = !searchQuery || 
        take.take_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (take.branch?.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        take.take_type.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesStatus && matchesSearch;
    });
  };
  
  // Update filtered takes when dependencies change
  useEffect(() => {
    setFilteredTakes(getFilteredTakes());
  }, [stockTakes, statusFilter, searchQuery]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [takesRes, branchesRes] = await Promise.all([
        storeAPI.getStockTakes(),
        storeAPI.getBranches()
      ]);

      if (takesRes.success && Array.isArray(takesRes.data)) {
        setStockTakes(takesRes.data);
      } else {
        toast.error(takesRes.message || 'Error loading stock takes');
        setStockTakes([]);
      }

      if (branchesRes.success && Array.isArray(branchesRes.data)) {
        setBranches(branchesRes.data);
      } else {
        toast.error(branchesRes.message || 'Error loading branches');
        setBranches([]);
      }
    } catch (error: any) { 
      console.error('Error:', error);
      toast.error(error.message || 'Failed to load data');
    }
    finally { setIsLoading(false); }
  };

  const validateNewForm = () => {
    const errors: {[key: string]: string} = {};
    
    if (!newForm.branch_id) {
      errors.branch_id = 'Branch is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleStartStockTake = async () => {
    if (!validateNewForm()) return;
    
    setIsSubmitting(true);
    try {
      const res = await storeAPI.createStockTake(newForm);
      if (res.success) {
        toast.success('Stock take started successfully');
        setIsNewModalOpen(false);
        setNewForm({ branch_id: 0, count_type: 'FULL', notes: '' });
        fetchData();
      } else {
        toast.error(res.message || 'Failed to start stock take');
      }
    } catch (error: any) { 
      console.error('Error starting stock take:', error);
      toast.error(error.message || 'Error starting stock take'); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewTake = async (take: StockTake) => {
    setSelectedTake(take);
    setTakeItems([]); // Clear previous items
    setIsViewModalOpen(true);
    
    try {
      const res = await storeAPI.getStockTakeItems(take.id);
      if (res.success) {
        if (Array.isArray(res.data)) {
          setTakeItems(res.data);
        } else {
          setTakeItems([]);
          toast.error('Error loading stock take items');
        }
      } else {
        toast.error(res.message || 'Error loading stock take items');
      }
    } catch (error: any) { 
      console.error('Error fetching items:', error);
      toast.error('Failed to load stock take items'); 
    }
  };

  const handleUpdateCount = async (itemId: string, countedQty: number) => {
    // Skip if value is negative
    if (countedQty < 0) {
      toast.error('Quantity cannot be negative');
      return;
    }
    
    try {
      const res = await storeAPI.updateStockTakeItem(itemId, { actual_quantity: countedQty });
      
      if (res.success) {
        // Update local state only if successful
        setTakeItems(items => items.map(i => i.id === itemId ? { ...i, counted_quantity: countedQty, status: 'COUNTED' } : i));
      } else {
        toast.error(res.message || 'Error updating count');
      }
    } catch (error: any) { 
      console.error('Error updating count:', error);
      toast.error(error.message || 'Error updating count'); 
    }
  };

  const handleCompleteTake = async () => {
    if (!selectedTake) return;
    
    // Check if any items haven't been counted
    const uncountedItems = takeItems.filter(item => item.status !== 'COUNTED');
    if (uncountedItems.length > 0) {
      if (!confirm(`${uncountedItems.length} items have not been counted. Do you want to proceed anyway?`)) {
        return;
      }
    }
    
    setIsSubmitting(true);
    try {
      const res = await storeAPI.completeStockTake(selectedTake.id);
      
      if (res.success) {
        toast.success('Stock take completed successfully');
        setIsViewModalOpen(false);
        fetchData();
      } else {
        toast.error(res.message || 'Error completing stock take');
      }
    } catch (error: any) { 
      console.error('Error completing stock take:', error);
      toast.error(error.message || 'Error completing stock take'); 
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (s: string) => ({
    draft: 'bg-blue-100 text-blue-800',
    submitted: 'bg-yellow-100 text-yellow-800',
    verified: 'bg-green-100 text-green-800',
    approved: 'bg-green-100 text-green-800',
    rejected: 'bg-red-100 text-red-800'
  }[s] || 'bg-gray-100 text-gray-800');

  const getStatusIcon = (s: string) => {
    if (s === 'draft') return <Clock className="h-4 w-4" />;
    if (s === 'submitted') return <Clock className="h-4 w-4" />;
    if (s === 'verified' || s === 'approved') return <CheckCircle className="h-4 w-4" />;
    if (s === 'rejected') return <XCircle className="h-4 w-4" />;
    return null;
  };

  const getStatusLabel = (s: string) => ({
    draft: 'In Progress',
    submitted: 'Pending Audit',
    verified: 'Verified',
    approved: 'Approved',
    rejected: 'Rejected'
  }[s] || s);

  const inProgressCount = stockTakes.filter(t => t.status === 'draft').length;
  const completedCount = stockTakes.filter(t => t.status === 'verified' || t.status === 'approved').length;

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Stock Takes</h1>
              <p className="text-gray-600">Physical inventory counts and variance tracking</p>
            </div>
            <div className="flex gap-3">
              <IOSButton variant="outline" onClick={fetchData} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              {canEdit && <IOSButton onClick={() => setIsNewModalOpen(true)} leftIcon={<Plus />}>New Stock Take</IOSButton>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><div className="flex items-center gap-3"><ClipboardList className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">Total Takes</p><p className="text-2xl font-bold">{stockTakes.length}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-[#3C3C43]" /><div><p className="text-sm text-gray-500">In Progress</p><p className="text-2xl font-bold text-[#3C3C43]">{inProgressCount}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><CheckCircle className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">Completed</p><p className="text-2xl font-bold text-[#3C3C43]">{completedCount}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">With Variances</p><p className="text-2xl font-bold text-[#3C3C43]">{stockTakes.filter(t => t.items_with_variance > 0).length}</p></div></div></IOSCard>
          </div>

          {/* Search and filter */}
          <IOSCard className="p-4 mb-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-gray-400" />
                <Input 
                  placeholder="Search by take number, branch, or type..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="pl-9" 
                />
              </div>
              <div>
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full p-2 border rounded-ios-lg"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">In Progress</option>
                  <option value="submitted">Pending Audit</option>
                  <option value="verified">Verified</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </IOSCard>

          <IOSCard>
            {isLoading ? (
              <div className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(60,60,67,0.12)] mx-auto"></div></div>
            ) : stockTakes.length === 0 ? (
              <div className="p-12 text-center text-gray-500"><ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No stock takes yet</p>{canEdit && <IOSButton className="mt-4" onClick={() => setIsNewModalOpen(true)} leftIcon={<Plus />}>Start First Stock Take</IOSButton>}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Take #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Branch</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variances</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Started</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredTakes.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                          No stock takes found matching your filters
                        </td>
                      </tr>
                    ) : filteredTakes.map(take => (
                      <tr key={take.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-sm">{take.take_number}</td>
                        <td className="px-4 py-4">{take.branch?.name || 'Unknown'}</td>
                        <td className="px-4 py-4"><IOSBadge variant="light" color="secondary">{take.take_type}</IOSBadge></td>
                        <td className="px-4 py-4"><IOSBadge className={getStatusColor(take.status)}><span className="flex items-center gap-1">{getStatusIcon(take.status)} {getStatusLabel(take.status)}</span></IOSBadge></td>
                        <td className="px-4 py-4">{take.total_items_counted}</td>
                        <td className="px-4 py-4">
                          {take.items_with_variance > 0 ? (
                            <span className="text-[#3C3C43] font-bold flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{take.items_with_variance}</span>
                          ) : <span className="text-[#3C3C43]">0</span>}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">{formatDate(take.started_at)}</td>
                        <td className="px-4 py-4">
                          <IOSButton size="sm" variant="outline" onClick={() => handleViewTake(take)} leftIcon={take.status === 'draft' ? <Play /> : <Eye />}>
                            {take.status === 'draft' ? 'Continue' : 'View'}
                          </IOSButton>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </IOSCard>
        </div>

        {/* New Stock Take Modal */}
        <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-[#3C3C43]" />Start New Stock Take</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Branch *</label>
                <select 
                  value={newForm.branch_id} 
                  onChange={e => setNewForm({...newForm, branch_id: parseInt(e.target.value)})} 
                  className={`w-full px-3 py-2 border rounded-ios-lg ${formErrors.branch_id ? 'border-red-500' : ''}`}
                >
                  <option value={0}>Select branch...</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                {formErrors.branch_id && <p className="text-red-500 text-xs mt-1">{formErrors.branch_id}</p>}
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select value={newForm.count_type} onChange={e => setNewForm({...newForm, count_type: e.target.value})} className="w-full px-3 py-2 border rounded-ios-lg">
                  {TAKE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea value={newForm.notes} onChange={e => setNewForm({...newForm, notes: e.target.value})} className="w-full px-3 py-2 border rounded-ios-lg" rows={2} placeholder="Optional notes..." />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <IOSButton variant="outline" onClick={() => setIsNewModalOpen(false)} disabled={isSubmitting}>Cancel</IOSButton>
                <IOSButton onClick={handleStartStockTake} leftIcon={<Play />} disabled={isSubmitting}>
                  {isSubmitting ? 'Starting...' : 'Start'}
                </IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* View/Count Modal */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-[#3C3C43]" />{selectedTake?.take_number}</span>
                <IOSBadge className={getStatusColor(selectedTake?.status || '')}>{selectedTake?.status}</IOSBadge>
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-ios-lg">
                <div><p className="text-sm text-gray-500">Branch</p><p className="font-medium">{selectedTake?.branch?.name}</p></div>
                <div><p className="text-sm text-gray-500">Type</p><p className="font-medium">{selectedTake?.take_type}</p></div>
                <div><p className="text-sm text-gray-500">Started</p><p className="font-medium">{selectedTake?.started_at ? new Date(selectedTake.started_at).toLocaleString() : '-'}</p></div>
              </div>

              <div className="overflow-x-auto border rounded-ios-lg">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">System Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Counted Qty</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Variance</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {takeItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                          {isLoading ? (
                            <div className="flex justify-center"><RefreshCw className="h-5 w-5 animate-spin" /></div>
                          ) : (
                            'No items found for this stock take'
                          )}
                        </td>
                      </tr>
                    ) : takeItems.map(item => {
                      const variance = (item.counted_quantity ?? 0) - item.system_quantity;
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium">{item.item?.item_name || item.item?.description}</p>
                            <p className="text-xs text-gray-500 font-mono">{item.item_sku}</p>
                          </td>
                          <td className="px-4 py-3 font-bold">{item.system_quantity}</td>
                          <td className="px-4 py-3">
                            {selectedTake?.status === 'draft' ? (
                              <Input
                                type="number"
                                defaultValue={item.counted_quantity || ''}
                                onBlur={e => handleUpdateCount(item.id, parseInt(e.target.value) || 0)}
                                className="w-24"
                              />
                            ) : (
                              <span className="font-bold">{item.counted_quantity ?? '-'}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {item.counted_quantity !== undefined && (
                              <span className={`font-bold ${variance === 0 ? 'text-[#3C3C43]' : variance > 0 ? 'text-[#3C3C43]' : 'text-[#3C3C43]'}`}>
                                {variance > 0 ? '+' : ''}{variance}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <IOSBadge className={item.status === 'COUNTED' ? 'bg-[#F2F2F7] text-[#000000]' : 'bg-gray-100 text-gray-800'}>{item.status}</IOSBadge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {selectedTake?.status === 'draft' && (
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <IOSButton variant="outline" onClick={() => setIsViewModalOpen(false)} disabled={isSubmitting}>Save & Close</IOSButton>
                  <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={handleCompleteTake} leftIcon={<CheckCircle />} disabled={isSubmitting}>
                    {isSubmitting ? 'Completing...' : 'Complete Stock Take'}
                  </IOSButton>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
