'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSButton } from '@/components/ui/ios-button';
import { Input } from '@/components/ui/input';
import { IOSBadge } from '@/components/ui/ios-badge';
import { IOSCard } from '@/components/ui/ios-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClipboardList, Plus, Eye, RefreshCw, Play, CheckCircle, Clock, XCircle, AlertTriangle, Package, Save } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate } from '@/lib/date-utils';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

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
  const [newForm, setNewForm] = useState({ branch_id: 0, take_type: 'FULL', notes: '' });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      const [takesRes, branchesRes] = await Promise.all([
        fetch(`${API_URL}/api/store/stock-takes`, { headers }),
        fetch(`${API_URL}/api/store/branches`, { headers })
      ]);
      if (takesRes.ok) { const data = await takesRes.json(); setStockTakes(data.data || []); }
      if (branchesRes.ok) { const data = await branchesRes.json(); setBranches(data.data || []); }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  };

  const handleStartStockTake = async () => {
    if (!newForm.branch_id) { toast.error('Please select a branch'); return; }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/store/stock-takes`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(newForm)
      });
      if (res.ok) {
        toast.success('Stock take started');
        setIsNewModalOpen(false);
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to start stock take');
      }
    } catch { toast.error('Error starting stock take'); }
  };

  const handleViewTake = async (take: StockTake) => {
    setSelectedTake(take);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/store/stock-takes/${take.id}/items`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTakeItems(data.data || []);
      }
    } catch { console.error('Error fetching items'); }
    setIsViewModalOpen(true);
  };

  const handleUpdateCount = async (itemId: string, countedQty: number) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/api/store/stock-take-items/${itemId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ counted_quantity: countedQty })
      });
      setTakeItems(items => items.map(i => i.id === itemId ? { ...i, counted_quantity: countedQty, status: 'COUNTED' } : i));
    } catch { toast.error('Error updating count'); }
  };

  const handleCompleteTake = async () => {
    if (!selectedTake) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/store/stock-takes/${selectedTake.id}/complete`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Stock take completed');
        setIsViewModalOpen(false);
        fetchData();
      }
    } catch { toast.error('Error completing stock take'); }
  };

  const getStatusColor = (s: string) => ({
    IN_PROGRESS: 'bg-[#F2F2F7] text-[#000000]',
    COMPLETED: 'bg-[#F2F2F7] text-[#000000]',
    CANCELLED: 'bg-[#F2F2F7] text-[#000000]'
  }[s] || 'bg-gray-100 text-gray-800');

  const getStatusIcon = (s: string) => {
    if (s === 'IN_PROGRESS') return <Clock className="h-4 w-4" />;
    if (s === 'COMPLETED') return <CheckCircle className="h-4 w-4" />;
    if (s === 'CANCELLED') return <XCircle className="h-4 w-4" />;
    return null;
  };

  const inProgressCount = stockTakes.filter(t => t.status === 'IN_PROGRESS').length;
  const completedCount = stockTakes.filter(t => t.status === 'COMPLETED').length;

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
              <IOSButton variant="outline" onClick={fetchData}><RefreshCw className="h-4 w-4 mr-2" />Refresh</IOSButton>
              {canEdit && <IOSButton onClick={() => setIsNewModalOpen(true)}><Plus className="h-4 w-4 mr-2" />New Stock Take</IOSButton>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <IOSCard className="p-4"><div className="flex items-center gap-3"><ClipboardList className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">Total Takes</p><p className="text-2xl font-bold">{stockTakes.length}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-[#3C3C43]" /><div><p className="text-sm text-gray-500">In Progress</p><p className="text-2xl font-bold text-[#3C3C43]">{inProgressCount}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><CheckCircle className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">Completed</p><p className="text-2xl font-bold text-[#3C3C43]">{completedCount}</p></div></div></IOSCard>
            <IOSCard className="p-4"><div className="flex items-center gap-3"><AlertTriangle className="h-8 w-8 text-[#8E8E93]0" /><div><p className="text-sm text-gray-500">With Variances</p><p className="text-2xl font-bold text-[#3C3C43]">{stockTakes.filter(t => t.items_with_variance > 0).length}</p></div></div></IOSCard>
          </div>

          <IOSCard>
            {isLoading ? (
              <div className="p-12 text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[rgba(60,60,67,0.12)] mx-auto"></div></div>
            ) : stockTakes.length === 0 ? (
              <div className="p-12 text-center text-gray-500"><ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No stock takes yet</p>{canEdit && <IOSButton className="mt-4" onClick={() => setIsNewModalOpen(true)}><Plus className="h-4 w-4 mr-2" />Start First Stock Take</IOSButton>}</div>
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
                    {stockTakes.map(take => (
                      <tr key={take.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 font-mono text-sm">{take.take_number}</td>
                        <td className="px-4 py-4">{take.branch?.name || 'Unknown'}</td>
                        <td className="px-4 py-4"><IOSBadge variant="outline">{take.take_type}</IOSBadge></td>
                        <td className="px-4 py-4"><IOSBadge className={getStatusColor(take.status)}><span className="flex items-center gap-1">{getStatusIcon(take.status)} {take.status}</span></IOSBadge></td>
                        <td className="px-4 py-4">{take.total_items_counted}</td>
                        <td className="px-4 py-4">
                          {take.items_with_variance > 0 ? (
                            <span className="text-[#3C3C43] font-bold flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{take.items_with_variance}</span>
                          ) : <span className="text-[#3C3C43]">0</span>}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-500">{formatDate(take.started_at)}</td>
                        <td className="px-4 py-4">
                          <IOSButton size="sm" variant="outline" onClick={() => handleViewTake(take)}>
                            {take.status === 'IN_PROGRESS' ? <><Play className="h-4 w-4 mr-1" />Continue</> : <><Eye className="h-4 w-4 mr-1" />View</>}
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
                <select value={newForm.branch_id} onChange={e => setNewForm({...newForm, branch_id: parseInt(e.target.value)})} className="w-full px-3 py-2 border rounded-ios-lg">
                  <option value={0}>Select branch...</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Type</label>
                <select value={newForm.take_type} onChange={e => setNewForm({...newForm, take_type: e.target.value})} className="w-full px-3 py-2 border rounded-ios-lg">
                  {TAKE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea value={newForm.notes} onChange={e => setNewForm({...newForm, notes: e.target.value})} className="w-full px-3 py-2 border rounded-ios-lg" rows={2} placeholder="Optional notes..." />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <IOSButton variant="outline" onClick={() => setIsNewModalOpen(false)}>Cancel</IOSButton>
                <IOSButton onClick={handleStartStockTake}><Play className="h-4 w-4 mr-2" />Start</IOSButton>
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
                    {takeItems.map(item => {
                      const variance = (item.counted_quantity ?? 0) - item.system_quantity;
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium">{item.item?.item_name || item.item?.description}</p>
                            <p className="text-xs text-gray-500 font-mono">{item.item_sku}</p>
                          </td>
                          <td className="px-4 py-3 font-bold">{item.system_quantity}</td>
                          <td className="px-4 py-3">
                            {selectedTake?.status === 'IN_PROGRESS' ? (
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

              {selectedTake?.status === 'IN_PROGRESS' && (
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <IOSButton variant="outline" onClick={() => setIsViewModalOpen(false)}>Save & Close</IOSButton>
                  <IOSButton className="bg-[#3C3C43] hover:bg-[#3C3C43]" onClick={handleCompleteTake}><CheckCircle className="h-4 w-4 mr-2" />Complete Stock Take</IOSButton>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
