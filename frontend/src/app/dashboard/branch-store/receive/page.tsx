'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI, auditorReportsAPI } from '@/lib/api';
import { Truck, RefreshCw, Check, AlertTriangle, ArrowDownToLine, Package, Search, FileDown, Activity, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';

interface IncomingDispatch {
  id: string;
  dispatch_number: string;
  status: string;
  dispatched_at: string;
  estimated_delivery: string;
  from_branch: { name: string; };
  items: any[];
  vehicle?: { registration_number: string; model: string; };
  vehicle_registration?: string;
  driver?: { name: string; phone: string; };
  driver_name?: string;
  auditor_id?: string;
  audited_at?: string;
  audit_notes?: string;
}

export default function BranchReceivePage() {
  const { user } = useAuth();
  const [dispatches, setDispatches] = useState<IncomingDispatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDispatch, setSelectedDispatch] = useState<IncomingDispatch | null>(null);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [receivedItems, setReceivedItems] = useState<Record<string, {
    quantity: number,
    damaged: number,
    missing: number,
    note: string
  }>>({});
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const fetchDispatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getIncomingDispatches();
      if (response.success) setDispatches(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  const handleExport = async () => {
    try {
      toast.loading("Generating delivery oversight report...");
      await auditorReportsAPI.exportBrandedPdf('dispatches', {
        branch_id: user?.branch_id
      });
      toast.dismiss();
      toast.success("Report generated successfully");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to generate report");
    }
  };

  const stats = useMemo(() => {
    const total = dispatches.length;
    const inTransit = dispatches.filter(d => d.status === 'IN_TRANSIT').length;
    const totalItems = dispatches.reduce((acc, d) => acc + (d.items?.length || 0), 0);
    return { total, inTransit, totalItems };
  }, [dispatches]);

  useEffect(() => { fetchDispatches(); }, [fetchDispatches]);

  const handleOpenReceive = (dispatch: IncomingDispatch) => {
    setSelectedDispatch(dispatch);
    const initialReceived: Record<string, any> = {};
    dispatch.items.forEach(item => {
      initialReceived[item.id] = {
        quantity: item.dispatched_quantity,
        damaged: 0,
        missing: 0,
        note: ''
      };
    });
    setReceivedItems(initialReceived);
    setIsReceiveModalOpen(true);
  };

  const handleConfirmDelivery = async () => {
    if (!selectedDispatch) return;

    try {
      const payload = {
        items_received: selectedDispatch.items.map(item => {
          const verification = receivedItems[item.id] || { quantity: item.dispatched_quantity, damaged: 0, missing: 0, note: '' };
          return {
            item_id: item.id,
            quantity: verification.quantity,
            damaged: verification.damaged,
            missing: verification.missing,
            note: verification.note
          };
        }),
        notes: deliveryNotes
      };

      await storeAPI.receiveDispatch(selectedDispatch.id, payload);
      toast.success('Dispatch received successfully');
      setIsReceiveModalOpen(false);
      fetchDispatches();
    } catch (error: any) {
      toast.error(error.message || 'Failed to receive dispatch');
    }
  };

  const handleFlagAnomaly = async (dispatch: IncomingDispatch) => {
    try {
      toast.loading("Flagging anomaly...");
      await auditAPI.createException({
        audit_session_id: 'MANUAL_RECEIVE_' + new Date().getTime(),
        exception_type: 'RECEIVE_ANOMALY',
        severity: 'medium',
        description: `Potential anomaly in receipt of dispatch ${dispatch.dispatch_number} from ${dispatch.from_branch?.name}`,
        amount: dispatch.items?.length || 0,
        reference_type: 'dispatch_note',
        reference_id: dispatch.id,
      });
      toast.dismiss();
      toast.success("Anomaly flagged for review");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to flag anomaly");
    }
  };

  const handleVerify = async (dispatch: IncomingDispatch) => {
    try {
      toast.loading("Verifying dispatch...");
      await auditAPI.verifyAnomaly({
        id: dispatch.id,
        type: 'dispatch_note',
        notes: 'Verified by auditor'
      });
      toast.dismiss();
      toast.success("Dispatch verified successfully");
      fetchDispatches(); // Refresh data
      setIsDetailModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Failed to verify dispatch");
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {user?.role === UserRole.AUDITOR ? 'Delivery Oversight' : 'Receive Goods'}
              </h1>
              <p className="text-gray-500">
                {user?.role === UserRole.AUDITOR ? 'Review incoming delivery records' : 'Confirm incoming deliveries'}
              </p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchDispatches} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>Refresh</IOSButton>
              {user?.role === UserRole.AUDITOR && (
                <IOSButton variant="secondary" onClick={handleExport} leftIcon={<FileDown />}>Oversight Log</IOSButton>
              )}
            </div>
          </div>

          {user?.role === UserRole.AUDITOR && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <IOSCard className="p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600">
                    <Package className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Incoming Dispatches</p>
                    <p className="text-xl font-black text-stone-900">{stats.total}</p>
                  </div>
                </div>
              </IOSCard>
              <IOSCard className="p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#007AFF]">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest text-[#007AFF]">In Transit</p>
                    <p className="text-xl font-black text-[#007AFF]">{stats.inTransit}</p>
                  </div>
                </div>
              </IOSCard>
              <IOSCard className="p-4 bg-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Total Item Load</p>
                    <p className="text-xl font-black text-emerald-600">{stats.totalItems}</p>
                  </div>
                </div>
              </IOSCard>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : dispatches.length === 0 ? (
            <IOSCard className="p-12 text-center"><Truck className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No incoming deliveries</p></IOSCard>
          ) : (
            <div className="grid gap-4">
              {dispatches.map((dispatch) => (
                <IOSCard key={dispatch.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><Truck className="h-6 w-6 text-[#007AFF]" /></div>
                      <div>
                        <p className="font-bold">{dispatch.dispatch_number}</p>
                        <p className="text-sm text-gray-500">From: {dispatch.from_branch?.name}</p>
                        <p className="text-xs text-gray-400">Items: {dispatch.items?.length || 0}</p>
                      </div>
                    </div>
                    {dispatch.status === 'IN_TRANSIT' ? (
                      <>
                        {user?.role === UserRole.AUDITOR && (
                          <IOSBadge variant="light" color="warning">In Transit</IOSBadge>
                        )}
                        {user?.role !== UserRole.AUDITOR && (
                          <IOSButton size="sm" onClick={() => handleOpenReceive(dispatch)} leftIcon={<ArrowDownToLine />}>Receive</IOSButton>
                        )}
                        {user?.role === UserRole.AUDITOR && (
                          <IOSButton size="sm" variant="secondary" onClick={() => { setSelectedDispatch(dispatch); setIsDetailModalOpen(true); }} leftIcon={<Search />}>Audit</IOSButton>
                        )}
                      </>
                    ) : (
                      <IOSBadge variant="light" color="success">Received</IOSBadge>
                    )}
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>

        <Dialog open={isReceiveModalOpen} onOpenChange={setIsReceiveModalOpen}>
          <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-xl border-none shadow-2xl">
            <div className="flex flex-col flex-1 min-h-0 bg-white">
              {/* Sticky Header */}
              <div className="px-5 py-3 border-b border-stone-100 flex-none bg-stone-50/50">
                <DialogHeader>
                  <DialogTitle className="text-[17px] font-bold text-stone-900 flex items-center gap-2">
                    <Package className="h-5 w-5 text-[#007AFF]" />
                    Process Delivery: {selectedDispatch?.dispatch_number}
                  </DialogTitle>
                </DialogHeader>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* Logistics Info & Batch Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-stone-50 p-3 rounded-xl border border-stone-100">
                  <div className="flex gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Vehicle</p>
                      <p className="text-sm font-bold text-stone-900">{selectedDispatch?.vehicle_registration || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">Driver</p>
                      <p className="text-sm font-bold text-stone-900">{selectedDispatch?.driver_name || 'N/A'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const allGood: Record<string, any> = {};
                      selectedDispatch?.items.forEach(item => {
                        allGood[item.id] = {
                          quantity: item.dispatched_quantity,
                          damaged: 0,
                          missing: 0,
                          note: 'Received as dispatched'
                        };
                      });
                      setReceivedItems(allGood);
                      toast.success('All items set to expected');
                    }}
                    className="w-full md:w-auto px-4 py-2 bg-stone-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm"
                  >
                    <Check className="h-4 w-4" />
                    <span>Mark All Verified</span>
                  </button>
                </div>

                {/* Items Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">Incoming Items</h3>
                    <span className="text-[10px] font-bold text-stone-400">{selectedDispatch?.items.length} Units</span>
                  </div>

                  <div className="space-y-2">
                    {selectedDispatch?.items.map((item) => (
                      <div key={item.id} className="group grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-4 p-3 border border-stone-100 rounded-xl bg-white hover:bg-stone-50/50 hover:border-stone-200 transition-all">
                        <div className="lg:col-span-5 flex flex-col justify-center">
                          <p className="font-bold text-[14px] text-stone-800 leading-tight">{item.item_name}</p>
                          <p className="text-[10px] font-semibold text-stone-400 uppercase mt-0.5 tracking-tight">{item.item_sku}</p>
                        </div>

                        <div className="lg:col-span-1 border-stone-100 flex flex-col items-center justify-center bg-blue-50/50 rounded-lg py-1">
                          <p className="text-[9px] font-bold text-blue-400 uppercase tracking-tighter">Exp</p>
                          <p className="text-sm font-bold text-[#007AFF]">{item.dispatched_quantity}</p>
                        </div>

                        <div className="lg:col-span-6 grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-stone-400/80 uppercase tracking-tighter block text-center">Received</label>
                            <input
                              type="number"
                              className="w-full h-9 text-xs text-center font-bold bg-white border border-stone-200 rounded-lg focus:ring-2 focus:ring-[#007AFF]/20 focus:border-[#007AFF] outline-none transition-all"
                              value={receivedItems[item.id]?.quantity}
                              onChange={(e) => setReceivedItems({ ...receivedItems, [item.id]: { ...receivedItems[item.id], quantity: parseInt(e.target.value) || 0 } })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-rose-400/80 uppercase tracking-tighter block text-center">Damaged</label>
                            <input
                              type="number"
                              className="w-full h-9 text-xs text-center font-bold bg-white border border-rose-100 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 outline-none transition-all text-rose-600"
                              value={receivedItems[item.id]?.damaged}
                              onChange={(e) => setReceivedItems({ ...receivedItems, [item.id]: { ...receivedItems[item.id], damaged: parseInt(e.target.value) || 0 } })}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-amber-500/80 uppercase tracking-tighter block text-center">Missing</label>
                            <input
                              type="number"
                              className="w-full h-9 text-xs text-center font-bold bg-white border border-amber-100 rounded-lg focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 outline-none transition-all text-amber-600"
                              value={receivedItems[item.id]?.missing}
                              onChange={(e) => setReceivedItems({ ...receivedItems, [item.id]: { ...receivedItems[item.id], missing: parseInt(e.target.value) || 0 } })}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Observations */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-stone-400" />
                    <h3 className="text-[11px] font-bold text-stone-500 uppercase tracking-widest">Observations & Notes</h3>
                  </div>
                  <textarea
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-medium focus:ring-2 focus:ring-[#007AFF]/10 focus:border-[#007AFF]/30 outline-none min-h-[80px] transition-all resize-none"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Enter any discrepancies or delivery observations here..."
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="px-5 py-4 border-t border-stone-100 flex-none bg-stone-50/50 backdrop-blur-md">
                <div className="flex gap-4">
                  <button
                    onClick={() => setIsReceiveModalOpen(false)}
                    className="flex-1 h-11 rounded-xl border border-stone-200 font-bold text-sm text-stone-500 bg-white hover:bg-stone-50 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelivery}
                    className="flex-3 h-11 px-8 rounded-xl bg-stone-900 text-white text-sm font-bold hover:bg-black transition-all active:scale-95 shadow-lg shadow-stone-200"
                  >
                    Confirm Delivery & Update Stock
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Dispatch Audit: {selectedDispatch?.dispatch_number}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4 text-sm text-stone-600">
              <div className="grid grid-cols-2 gap-4 bg-stone-50 p-3 rounded-ios-lg">
                <div><p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">From</p><p className="font-bold text-stone-900">{selectedDispatch?.from_branch?.name}</p></div>
                <div><p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Status</p><p className="font-bold text-stone-900">{selectedDispatch?.status}</p></div>
                <div className="col-span-2"><p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold">Dispatched At</p><p className="font-bold text-stone-900">{selectedDispatch && new Date(selectedDispatch.dispatched_at).toLocaleString()}</p></div>
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-widest text-stone-400 font-bold mb-2">Items Included</p>
                <div className="space-y-1">
                  {selectedDispatch?.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center py-1 border-b border-stone-100 last:border-0">
                      <span>{item.item?.item_name || 'Item'}</span>
                      <span className="font-bold">{item.dispatched_quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-stone-100">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Audit Status</p>
                  {selectedDispatch?.audited_at ? (
                    <div className="flex items-center gap-1 text-emerald-600">
                      <Check className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Verified</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-amber-600">
                      <Clock className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Unverified</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <IOSButton onClick={() => setIsDetailModalOpen(false)} variant="secondary" className="w-full">Close</IOSButton>
                  {!selectedDispatch?.audited_at && (
                    <IOSButton variant="secondary" onClick={() => handleVerify(selectedDispatch!)} leftIcon={<Check />} className="w-full">
                      Verify
                    </IOSButton>
                  )}
                </div>

                {!selectedDispatch?.audited_at && (
                  <IOSButton variant="destructive" onClick={() => handleFlagAnomaly(selectedDispatch!)} leftIcon={<AlertTriangle />} className="w-full">
                    Flag Anomaly
                  </IOSButton>
                )}
                {selectedDispatch?.audited_at && (
                  <div className="pt-2 italic text-[10px] text-stone-500">
                    Verified on {selectedDispatch.audited_at ? new Date(selectedDispatch.audited_at).toLocaleDateString() : 'N/A'}.
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
