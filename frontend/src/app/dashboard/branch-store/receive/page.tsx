'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { storeAPI } from '@/lib/api';
import { Truck, RefreshCw, Check, AlertTriangle, ArrowDownToLine, Package, Search } from 'lucide-react';
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

  const fetchDispatches = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await storeAPI.getIncomingDispatches();
      if (response.success) setDispatches(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

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
            received_quantity: verification.quantity,
            damaged_quantity: verification.damaged,
            missing_quantity: verification.missing,
            discrepancy_reason: verification.note
          };
        }),
        discrepancy_notes: deliveryNotes
      };

      await storeAPI.confirmDelivery(selectedDispatch.id, payload);
      toast.success('Delivery confirmed and stock updated');
      setIsReceiveModalOpen(false);
      fetchDispatches();
    } catch (error) {
      toast.error('Failed to confirm delivery');
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Receive Goods</h1><p className="text-gray-500">Confirm incoming deliveries</p></div>
            <IOSButton variant="secondary" onClick={fetchDispatches} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

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
                      <IOSButton size="sm" onClick={() => handleOpenReceive(dispatch)}>Receive</IOSButton>
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
          <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
            <div className="flex flex-col h-full bg-white">
              {/* Sticky Header */}
              <div className="p-6 border-b border-stone-100 flex-none bg-white">
                <DialogHeader>
                  <DialogTitle className="text-xl font-black text-stone-900 tracking-tight">
                    Receive Delivery: {selectedDispatch?.dispatch_number}
                  </DialogTitle>
                </DialogHeader>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Logistics Info Section */}
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="space-y-2">
                    <h3 className="text-[11px] font-black text-stone-400 uppercase tracking-widest">Logistics Information</h3>
                    <div className="flex gap-8 text-sm">
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase font-black tracking-tight">Vehicle</p>
                        <p className="font-bold text-stone-900">{selectedDispatch?.vehicle_registration || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-stone-400 uppercase font-black tracking-tight">Driver</p>
                        <p className="font-bold text-stone-900">{selectedDispatch?.driver_name || 'N/A'}</p>
                      </div>
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
                      toast.success('All quantities set to expected amounts');
                    }}
                    className="px-4 py-2.5 bg-stone-900 text-white text-[12px] font-bold rounded-xl shadow-lg shadow-stone-200 hover:bg-black transition-all flex items-center gap-2 active:scale-95"
                  >
                    <Check className="h-4 w-4" />
                    <span>Mark All Verified</span>
                  </button>
                </div>

                {/* Items List */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-black text-stone-400 uppercase tracking-widest px-1">Shipment Contents</h3>
                  {selectedDispatch?.items.map((item) => (
                    <div key={item.id} className="p-5 border border-stone-100 rounded-2xl bg-white shadow-sm hover:border-stone-200 transition-colors space-y-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-black text-stone-900">{item.item?.name || item.item_sku}</p>
                          <p className="text-[10px] text-stone-400 font-bold uppercase tracking-tight">{item.item_sku}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-black text-stone-400 uppercase tracking-tight">Expected</p>
                          <p className="text-lg font-black text-[#007AFF] leading-none">{item.dispatched_quantity}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-stone-50/50 p-4 rounded-xl border border-stone-100">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-stone-400 uppercase tracking-wider ml-1">Received</label>
                          <Input
                            type="number"
                            className="bg-white border-stone-200 rounded-lg font-bold focus:ring-[#007AFF]"
                            value={receivedItems[item.id]?.quantity}
                            onChange={(e) => setReceivedItems({ ...receivedItems, [item.id]: { ...receivedItems[item.id], quantity: parseInt(e.target.value) || 0 } })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-rose-400 uppercase tracking-wider ml-1">Damaged</label>
                          <Input
                            type="number"
                            className="bg-white border-stone-200 rounded-lg font-bold focus:ring-[#007AFF]"
                            value={receivedItems[item.id]?.damaged}
                            onChange={(e) => setReceivedItems({ ...receivedItems, [item.id]: { ...receivedItems[item.id], damaged: parseInt(e.target.value) || 0 } })}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black text-amber-500 uppercase tracking-wider ml-1">Missing</label>
                          <Input
                            type="number"
                            className="bg-white border-stone-200 rounded-lg font-bold focus:ring-[#007AFF]"
                            value={receivedItems[item.id]?.missing}
                            onChange={(e) => setReceivedItems({ ...receivedItems, [item.id]: { ...receivedItems[item.id], missing: parseInt(e.target.value) || 0 } })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Additional Notes */}
                <div className="pt-2">
                  <label className="text-[11px] font-black text-stone-400 uppercase tracking-widest px-1 mb-2 block">Discrepancy Notes / Verification Remarks</label>
                  <textarea
                    className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-4 text-sm font-medium focus:ring-2 focus:ring-[#007AFF]/20 outline-none min-h-[100px] transition-all"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Enter any observations about the condition of the items..."
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="p-6 border-t border-stone-100 flex-none bg-white">
                <div className="flex gap-4">
                  <button
                    onClick={() => setIsReceiveModalOpen(false)}
                    className="flex-1 h-12 rounded-xl border border-stone-200 font-bold text-stone-500 hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmDelivery}
                    className="flex-1 h-12 rounded-xl bg-[#007AFF] text-white font-black hover:bg-blue-600 transition-all shadow-lg shadow-blue-100 active:scale-95"
                  >
                    Confirm & Update Stock
                  </button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
