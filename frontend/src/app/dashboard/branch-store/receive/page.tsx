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
        received_items: selectedDispatch.items.map(item => {
          const verification = receivedItems[item.id] || { quantity: item.dispatched_quantity, damaged: 0, missing: 0, note: '' };
          return {
            id: item.id,
            received_quantity: verification.quantity,
            damaged_quantity: verification.damaged,
            missing_quantity: verification.missing,
            discrepancy_reason: verification.note
          };
        }),
        delivery_notes: deliveryNotes
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Receive Delivery: {selectedDispatch?.dispatch_number}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              {/* Logistics Info Section */}
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-bold text-stone-700 uppercase tracking-wider">Logistics Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase font-bold">Vehicle</p>
                    <p className="font-medium text-stone-900">{selectedDispatch?.vehicle_registration || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase font-bold">Driver</p>
                    <p className="font-medium text-stone-900">{selectedDispatch?.driver_name || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Items Section */}
              {selectedDispatch?.items.map((item) => (
                <div key={item.id} className="p-4 border rounded-ios-lg space-y-3">
                  <div className="flex justify-between font-medium">
                    <span>{item.item?.name || item.item_sku}</span>
                    <span className="text-gray-500">Expected: {item.dispatched_quantity}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="text-[10px] text-gray-400 uppercase">Received</label><Input type="number" value={receivedItems[item.id]?.quantity} onChange={(e) => setReceivedItems({ ...receivedItems, [item.id]: { ...receivedItems[item.id], quantity: parseInt(e.target.value) || 0 } })} /></div>
                    <div><label className="text-[10px] text-gray-400 uppercase">Damaged</label><Input type="number" value={receivedItems[item.id]?.damaged} onChange={(e) => setReceivedItems({ ...receivedItems, [item.id]: { ...receivedItems[item.id], damaged: parseInt(e.target.value) || 0 } })} /></div>
                    <div><label className="text-[10px] text-gray-400 uppercase">Missing</label><Input type="number" value={receivedItems[item.id]?.missing} onChange={(e) => setReceivedItems({ ...receivedItems, [item.id]: { ...receivedItems[item.id], missing: parseInt(e.target.value) || 0 } })} /></div>
                  </div>
                </div>
              ))}
              <div><label className="text-sm font-medium">Delivery Notes</label><Input value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)} placeholder="Condition, discrepancies, etc." /></div>
              <div className="flex gap-3 pt-4">
                <IOSButton variant="secondary" onClick={() => setIsReceiveModalOpen(false)} className="flex-1">Cancel</IOSButton>
                <IOSButton onClick={handleConfirmDelivery} className="flex-1">Confirm Receipt</IOSButton>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
