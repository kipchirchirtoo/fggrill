'use client';

import { useEffect, useMemo, useState } from 'react';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { useAuth, UserRole } from '@/lib/auth-context';
import { storeAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ClipboardCheck, Plus, RefreshCw, Search, ArrowLeft, CheckCircle, AlertTriangle, Download, FileSpreadsheet, XCircle } from 'lucide-react';
import { toast } from 'sonner';

const STORE_TYPES = [
  { key: 'foodstuffs', label: 'Foodstuffs' },
  { key: 'bar_store', label: 'Bar Store' }
] as const;

type StoreType = (typeof STORE_TYPES)[number]['key'];

interface CentralStockTakeSession {
  id: string;
  session_number: string;
  store_type: StoreType;
  status: string;
  notes?: string;
  started_at: string;
  total_items_counted: number;
  items_with_variance: number;
  total_variance_value: number;
}

interface CentralStockTakeItem {
  id: string;
  item_sku: string;
  item_name: string;
  unit?: string;
  category?: string;
  reorder_level?: number | null;
  cost_price?: number | null;
  system_quantity: number;
  counted_quantity: number | null;
  variance: number | null;
  variance_reason?: string | null;
  variance_value?: number | null;
}

export default function CentralStockTakesPage() {
  const { user } = useAuth();
  const canEdit = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER || user?.role === UserRole.CENTRAL_STOREKEEPER;
  const canApprove = user?.role === UserRole.AUDITOR || user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.GENERAL_MANAGER;

  const [sessions, setSessions] = useState<CentralStockTakeSession[]>([]);
  const [activeStoreType, setActiveStoreType] = useState<StoreType>('foodstuffs');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<CentralStockTakeSession | null>(null);
  const [sessionItems, setSessionItems] = useState<CentralStockTakeItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const res = await storeAPI.getCentralStockTakes({ store_type: activeStoreType });
      if (res.success) {
        setSessions(res.data || []);
      } else {
        toast.error(res.message || 'Failed to load stock takes');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load stock takes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [activeStoreType]);

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(session =>
      session.session_number?.toLowerCase().includes(q) ||
      session.status?.toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  const handleStartStockTake = async () => {
    setIsSubmitting(true);
    try {
      const res = await storeAPI.createCentralStockTake({ store_type: activeStoreType });
      if (res.success) {
        toast.success('Central stock take started');
        setIsNewModalOpen(false);
        fetchSessions();
      } else {
        toast.error(res.message || 'Failed to start stock take');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to start stock take');
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadSession = async (session: CentralStockTakeSession) => {
    setSelectedSession(session);
    setSessionItems([]);

    try {
      const res = await storeAPI.getCentralStockTake(session.id);
      if (res.success) {
        setSessionItems(res.data?.items || []);
      } else {
        toast.error(res.message || 'Failed to load stock take');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load stock take');
    }
  };

  const handleItemChange = (id: string, value: string) => {
    const qty = value === '' ? null : Math.max(0, Number(value));
    setSessionItems(items =>
      items.map(item => {
        if (item.id !== id) return item;
        const variance = qty === null ? null : qty - item.system_quantity;
        return {
          ...item,
          counted_quantity: qty,
          variance
        };
      })
    );
  };

  const handleReasonChange = (id: string, reason: string) => {
    setSessionItems(items => items.map(item => (item.id === id ? { ...item, variance_reason: reason } : item)));
  };

  const saveProgress = async () => {
    if (!selectedSession) return;

    setIsSubmitting(true);
    try {
      const payload = sessionItems.map(item => ({
        id: item.id,
        counted_quantity: item.counted_quantity,
        variance_reason: item.variance_reason
      }));

      const res = await storeAPI.updateCentralStockTake(selectedSession.id, { items: payload });
      if (res.success) {
        toast.success('Progress saved');
        fetchSessions();
      } else {
        toast.error(res.message || 'Failed to save progress');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save progress');
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitSession = async () => {
    if (!selectedSession) return;

    setIsSubmitting(true);
    try {
      const res = await storeAPI.submitCentralStockTake(selectedSession.id);
      if (res.success) {
        toast.success('Stock take submitted for review');
        setSelectedSession(null);
        fetchSessions();
      } else {
        toast.error(res.message || 'Failed to submit stock take');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit stock take');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approveSession = async () => {
    if (!selectedSession) return;

    setIsSubmitting(true);
    try {
      const res = await storeAPI.approveCentralStockTake(selectedSession.id);
      if (res.success) {
        toast.success('Stock take approved and adjustments posted');
        setSelectedSession(null);
        fetchSessions();
      } else {
        toast.error(res.message || 'Failed to approve stock take');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve stock take');
    } finally {
      setIsSubmitting(false);
    }
  };

  const rejectSession = async () => {
    if (!selectedSession) return;

    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;

    setIsSubmitting(true);
    try {
      const res = await storeAPI.rejectCentralStockTake(selectedSession.id, reason);
      if (res.success) {
        toast.success('Stock take rejected');
        setSelectedSession(null);
        fetchSessions();
      } else {
        toast.error(res.message || 'Failed to reject stock take');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject stock take');
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadPDF = async () => {
    if (!selectedSession) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/store/central-stock-takes/${selectedSession.id}/worksheet-pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to download PDF');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedSession.session_number}-worksheet.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download PDF');
    }
  };

  const downloadExcel = async () => {
    if (!selectedSession) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/store/central-stock-takes/${selectedSession.id}/excel`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to download Excel');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedSession.session_number}-report.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download Excel');
    }
  };

  const summary = useMemo(() => {
    const totalItems = sessionItems.length;
    const counted = sessionItems.filter(item => item.counted_quantity !== null).length;
    const varianceItems = sessionItems.filter(item => item.variance !== null && item.variance !== 0).length;
    const varianceValue = sessionItems.reduce((sum, item) => sum + (item.variance_value || 0), 0);
    return { totalItems, counted, varianceItems, varianceValue };
  }, [sessionItems]);

  const downloadPDFForSession = async (session: CentralStockTakeSession) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/store/central-stock-takes/${session.id}/worksheet-pdf`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to download PDF');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session.session_number}-worksheet.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download PDF');
    }
  };

  const downloadExcelForSession = async (session: CentralStockTakeSession) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/store/central-stock-takes/${session.id}/excel`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('Failed to download Excel');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${session.session_number}-report.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel downloaded');
    } catch (error: any) {
      toast.error(error.message || 'Failed to download Excel');
    }
  };

  if (selectedSession) {
    return (
      <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
        <DashboardLayout>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <IOSButton variant="secondary" onClick={() => setSelectedSession(null)} leftIcon={<ArrowLeft />}>Back</IOSButton>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{selectedSession.session_number}</h1>
                  <p className="text-sm text-gray-500">{STORE_TYPES.find(t => t.key === selectedSession.store_type)?.label}</p>
                </div>
                <IOSBadge>{selectedSession.status}</IOSBadge>
              </div>
              <div className="flex gap-2 flex-wrap">
                <IOSButton variant="secondary" onClick={saveProgress} disabled={isSubmitting}>Save Progress</IOSButton>
                <IOSButton variant="secondary" onClick={downloadPDF} leftIcon={<Download />}>PDF Worksheet</IOSButton>
                <IOSButton variant="secondary" onClick={downloadExcel} leftIcon={<FileSpreadsheet />}>Excel Report</IOSButton>
                {selectedSession.status === 'in_progress' && (
                  <IOSButton onClick={submitSession} disabled={isSubmitting} leftIcon={<CheckCircle />}>Submit for Review</IOSButton>
                )}
                {selectedSession.status === 'submitted' && canApprove && (
                  <>
                    <IOSButton onClick={approveSession} disabled={isSubmitting} leftIcon={<CheckCircle />}>Approve</IOSButton>
                    <IOSButton variant="destructive" onClick={rejectSession} disabled={isSubmitting} leftIcon={<XCircle />}>Reject</IOSButton>
                  </>
                )}
              </div>
            </div>

            <IOSCard className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Total Items</p>
                  <p className="text-lg font-semibold">{summary.totalItems}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Counted</p>
                  <p className="text-lg font-semibold">{summary.counted}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Variance Items</p>
                  <p className="text-lg font-semibold">{summary.varianceItems}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Variance Value</p>
                  <p className="text-lg font-semibold">KES {summary.varianceValue.toLocaleString()}</p>
                </div>
              </div>
            </IOSCard>

            <IOSCard className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-3 text-left">SKU</th>
                      <th className="px-3 py-3 text-left">Item Name</th>
                      <th className="px-3 py-3 text-left">Category</th>
                      <th className="px-3 py-3 text-right">Reorder</th>
                      <th className="px-3 py-3 text-right">Cost</th>
                      <th className="px-3 py-3 text-right">System Closing</th>
                      <th className="px-3 py-3 text-right">Physical Count</th>
                      <th className="px-3 py-3 text-right">Variance</th>
                      <th className="px-3 py-3 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {sessionItems.map(item => {
                      const variance = item.counted_quantity === null ? null : (item.counted_quantity - item.system_quantity);
                      const needsReason = variance !== null && variance !== 0;
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3">
                            <p className="text-xs text-gray-600 font-mono">{item.item_sku}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium">{item.item_name}</p>
                            <p className="text-xs text-gray-500">{item.unit || 'units'}</p>
                          </td>
                          <td className="px-3 py-3">
                            <span className="inline-block px-2 py-0.5 rounded text-xs bg-blue-50 text-blue-700">
                              {item.category || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right text-sm text-gray-700">{item.reorder_level ?? '—'}</td>
                          <td className="px-3 py-3 text-right text-sm text-gray-700">{item.cost_price ? item.cost_price.toFixed(2) : '—'}</td>
                          <td className="px-3 py-3 text-right font-semibold">{item.system_quantity}</td>
                          <td className="px-3 py-3 text-right">
                            <Input
                              type="number"
                              min={0}
                              value={item.counted_quantity ?? ''}
                              onChange={(e) => handleItemChange(item.id, e.target.value)}
                              className="w-28 text-right"
                              placeholder="Enter count"
                            />
                          </td>
                          <td className="px-3 py-3 text-right">
                            {variance === null ? '—' : (
                              <span className={variance === 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                {variance > 0 ? '+' : ''}{variance}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {needsReason ? (
                              <Input
                                value={item.variance_reason || ''}
                                onChange={(e) => handleReasonChange(item.id, e.target.value)}
                                placeholder="Required for variance"
                                className={item.variance_reason ? '' : 'border-rose-300'}
                              />
                            ) : (
                              <span className="text-xs text-gray-400">No variance</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </IOSCard>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Central Store Stock Takes</h1>
              <p className="text-gray-500">Separated counts for foodstuffs and bar store</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchSessions} leftIcon={<RefreshCw />}>Refresh</IOSButton>
              {canEdit && (
                <IOSButton onClick={() => setIsNewModalOpen(true)} leftIcon={<Plus />}>New Stock Take</IOSButton>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {STORE_TYPES.map(type => (
              <IOSButton
                key={type.key}
                variant={activeStoreType === type.key ? 'primary' : 'secondary'}
                onClick={() => setActiveStoreType(type.key)}
              >
                {type.label}
              </IOSButton>
            ))}
          </div>

          <IOSCard className="p-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by session number or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </IOSCard>

          <IOSCard className="overflow-hidden">
            {isLoading ? (
              <div className="p-10 text-center"><RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" /></div>
            ) : filteredSessions.length === 0 ? (
              <div className="p-10 text-center text-gray-500">
                <ClipboardCheck className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                <p>No stock takes found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3 text-left">Session #</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Counted</th>
                      <th className="px-4 py-3 text-right">Variances</th>
                      <th className="px-4 py-3 text-right">Variance Value</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                      <th className="px-4 py-3 text-right">Exports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredSessions.map(session => (
                      <tr key={session.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono">{session.session_number}</td>
                        <td className="px-4 py-3"><IOSBadge>{session.status}</IOSBadge></td>
                        <td className="px-4 py-3 text-right">{session.total_items_counted}</td>
                        <td className="px-4 py-3 text-right">
                          {session.items_with_variance > 0 ? (
                            <span className="text-rose-600 font-semibold flex items-center justify-end gap-1"><AlertTriangle className="h-4 w-4" />{session.items_with_variance}</span>
                          ) : '0'}
                        </td>
                        <td className="px-4 py-3 text-right">KES {Number(session.total_variance_value || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">
                          <IOSButton size="sm" variant="secondary" onClick={() => loadSession(session)}>
                            View / Count
                          </IOSButton>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end">
                            <IOSButton size="sm" variant="ghost" onClick={() => downloadPDFForSession(session)} leftIcon={<Download />}>PDF</IOSButton>
                            <IOSButton size="sm" variant="ghost" onClick={() => downloadExcelForSession(session)} leftIcon={<FileSpreadsheet />}>Excel</IOSButton>
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

        <Dialog open={isNewModalOpen} onOpenChange={setIsNewModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start Central Stock Take</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Start a new stock take for {STORE_TYPES.find(t => t.key === activeStoreType)?.label}.</p>
              <div className="flex justify-end gap-2">
                <IOSButton variant="secondary" onClick={() => setIsNewModalOpen(false)}>Cancel</IOSButton>
                <IOSButton onClick={handleStartStockTake} disabled={isSubmitting}>Start</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
