'use client';

import { useState, useEffect } from 'react';
import { Package, Truck, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { branchManagerAPI } from '@/lib/branch-api';
import { wastageAPI } from '@/lib/api';
import { toast } from 'sonner';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { UserRole } from '@/lib/auth-context';

interface DispatchItem {
  id: string;
  item_sku: string;
  dispatched_quantity: number;
  received_quantity?: number;
  damaged_quantity?: number;
  item?: {
    item_name: string;
    unit: string;
  };
}

interface IncomingDispatch {
  id: string;
  dispatch_number: string;
  from_branch: {
    name: string;
  };
  status: string;
  vehicle_number?: string;
  driver_name?: string;
  driver_phone?: string;
  estimated_delivery?: string;
  dispatched_at?: string;
  items: DispatchItem[];
}

export default function BranchIncomingPage() {
  const [dispatches, setDispatches] = useState<IncomingDispatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDispatch, setSelectedDispatch] = useState<IncomingDispatch | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    fetchDispatches();
  }, []);

  const fetchDispatches = async () => {
    setIsLoading(true);
    try {
      const response = await branchManagerAPI.getIncomingDispatches();
      if (response.success) {
        setDispatches(response.data || []);
      } else {
        toast.error('Failed to fetch incoming dispatches');
      }
    } catch (error) {
      console.error('Error fetching dispatches:', error);
      toast.error('Failed to load dispatches');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDelivery = (dispatch: IncomingDispatch) => {
    setSelectedDispatch(dispatch);
    setShowConfirmModal(true);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'IN_TRANSIT':
        return 'info';
      case 'DELIVERED':
        return 'success';
      case 'CONFIRMED':
        return 'secondary';
      case 'DISPUTED':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN, UserRole.BRANCH_STOREKEEPER]}>
      <DashboardLayout>
        <BranchPageWrapper>
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Truck className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Incoming Dispatches</h1>
                  <p className="text-sm text-gray-500">Track and confirm deliveries from central warehouse</p>
                </div>
              </div>
              <IOSButton variant="secondary" onClick={fetchDispatches} leftIcon={<RefreshCw className={isLoading ? 'animate-spin' : ''} />}>
                Refresh
              </IOSButton>
            </div>

            {/* Dispatches List */}
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              </div>
            ) : dispatches.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-12 text-center">
                <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No incoming dispatches</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {dispatches.map((dispatch) => (
                  <div
                    key={dispatch.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{dispatch.dispatch_number}</h3>
                        <p className="text-sm text-gray-500">From: {dispatch.from_branch?.name || 'Central Warehouse'}</p>
                      </div>
                      <IOSBadge color={getStatusBadgeColor(dispatch.status)}>
                        {dispatch.status.replace('_', ' ')}
                      </IOSBadge>
                    </div>

                    {/* Dispatch Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      {dispatch.vehicle_number && (
                        <div>
                          <p className="text-xs text-gray-500">Vehicle</p>
                          <p className="text-sm font-medium">{dispatch.vehicle_number}</p>
                        </div>
                      )}
                      {dispatch.driver_name && (
                        <div>
                          <p className="text-xs text-gray-500">Driver</p>
                          <p className="text-sm font-medium">{dispatch.driver_name}</p>
                          {dispatch.driver_phone && (
                            <p className="text-xs text-gray-400">{dispatch.driver_phone}</p>
                          )}
                        </div>
                      )}
                      {dispatch.estimated_delivery && (
                        <div>
                          <p className="text-xs text-gray-500">Est. Delivery</p>
                          <p className="text-sm font-medium">
                            {new Date(dispatch.estimated_delivery).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500">Items</p>
                        <p className="text-sm font-medium">{dispatch.items?.length || 0} items</p>
                      </div>
                    </div>

                    {/* Items Preview */}
                    {dispatch.items && dispatch.items.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <p className="text-xs font-medium text-gray-700 mb-2">Items:</p>
                        <div className="space-y-1">
                          {dispatch.items.slice(0, 3).map((item) => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-gray-600">{item.item?.item_name || item.item_sku}</span>
                              <span className="font-medium">{item.dispatched_quantity} {item.item?.unit}</span>
                            </div>
                          ))}
                          {dispatch.items.length > 3 && (
                            <p className="text-xs text-gray-500">+{dispatch.items.length - 3} more items</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {dispatch.status === 'IN_TRANSIT' && (
                      <div className="flex justify-end">
                        <IOSButton
                          variant="primary"
                          onClick={() => handleConfirmDelivery(dispatch)}
                        >
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Confirm Delivery
                        </IOSButton>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Confirmation Modal */}
            {showConfirmModal && selectedDispatch && (
              <ConfirmDeliveryModal
                dispatch={selectedDispatch}
                onClose={() => {
                  setShowConfirmModal(false);
                  setSelectedDispatch(null);
                }}
                onSuccess={() => {
                  fetchDispatches();
                  setShowConfirmModal(false);
                  setSelectedDispatch(null);
                }}
              />
            )}
          </div>
        </BranchPageWrapper>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

// Confirmation Modal Component
function ConfirmDeliveryModal({
  dispatch,
  onClose,
  onSuccess
}: {
  dispatch: IncomingDispatch;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [items, setItems] = useState(
    dispatch.items.map((item) => ({
      ...item,
      received_quantity: item.dispatched_quantity,
      damaged_quantity: 0,
      discrepancy_reason: ''
    }))
  );
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // 1. Confirm the delivery
      const response = await branchManagerAPI.confirmDispatchDelivery(dispatch.id, {
        items_received: items.map((item) => ({
          item_id: item.id,
          received_quantity: item.received_quantity || 0,
          damaged_quantity: item.damaged_quantity || 0,
          discrepancy_reason: item.discrepancy_reason
        })),
        discrepancy_notes: notes
      });

      if (response.success) {
        // 2. Record wastage for damaged items
        const damagedItems = items.filter(item => (item.damaged_quantity || 0) > 0);

        if (damagedItems.length > 0) {
          const wastageRecords = damagedItems.map(item => ({
            item_name: item.item?.item_name || item.item_sku,
            item_id: item.item_sku,
            item_type: 'inventory',
            quantity: item.damaged_quantity,
            unit: item.item?.unit || 'unit',
            reason: 'damaged_in_transit',
            description: `Damaged during delivery: ${dispatch.dispatch_number}. Notes: ${notes}`
          }));

          try {
            await wastageAPI.bulkCreateWastageRecords(wastageRecords);
            toast.success(`Delivery confirmed and ${wastageRecords.length} wastage records created`);
          } catch (wastageError) {
            console.error('Error recording wastage:', wastageError);
            toast.warning('Delivery confirmed but failed to record wastage automatically');
          }
        } else {
          toast.success('Delivery confirmed successfully');
        }

        onSuccess();
      } else {
        toast.error(response.message || 'Failed to confirm delivery');
      }
    } catch (error) {
      console.error('Error confirming delivery:', error);
      toast.error('Failed to confirm delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4">
          <h2 className="text-xl font-semibold">Confirm Delivery - {dispatch.dispatch_number}</h2>
        </div>

        <div className="p-6 space-y-6">
          {/* Items Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Item</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Dispatched</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Received</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Damaged</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-sm">{item.item?.item_name || item.item_sku}</td>
                    <td className="px-4 py-3 text-center text-sm">{item.dispatched_quantity}</td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        max={item.dispatched_quantity}
                        value={item.received_quantity}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].received_quantity = parseInt(e.target.value) || 0;
                          setItems(newItems);
                        }}
                        className="w-20 px-2 py-1 border rounded text-center"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        value={item.damaged_quantity}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].damaged_quantity = parseInt(e.target.value) || 0;
                          setItems(newItems);
                        }}
                        className="w-20 px-2 py-1 border rounded text-center"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Notes
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about the delivery..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <IOSButton variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </IOSButton>
            <IOSButton variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Confirming...' : 'Confirm Delivery'}
            </IOSButton>
          </div>
        </div>
      </div>
    </div>
  );
}
