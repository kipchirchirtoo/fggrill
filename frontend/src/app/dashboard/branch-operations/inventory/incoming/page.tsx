"use client";

import { useEffect, useState } from "react";
import { useAuth, UserRole } from "@/lib/auth-context";
import { useBranch } from "@/lib/branch-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { BranchAwareDashboardLayout } from "@/components/layout/branch-aware-dashboard-layout";
import { BranchPageWrapper } from "@/components/branch/branch-page-wrapper";
import { branchOperationsAPI } from "@/lib/branch-api";
import { IOSCard } from "@/components/ui/ios-card";
import { IOSBadge } from "@/components/ui/ios-badge";
import { IOSButton } from "@/components/ui/ios-button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";
import { Search, RefreshCw, TruckIcon, CheckCircle2, AlertTriangle, X, Package, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface IncomingShipment {
  id: string;
  dispatch_number: string;
  source?: string;
  from_branch?: { name: string };
  status: string;
  created_at: string;
  expected_delivery?: string | null;
  estimated_delivery?: string | null;
  delivered_at: string | null;
  items?: any[];
}

function ConfirmationModal({
  isOpen,
  onClose,
  shipment,
  onConfirm
}: {
  isOpen: boolean;
  onClose: () => void;
  shipment: IncomingShipment | null;
  onConfirm: () => void;
}) {
  const [receivedItems, setReceivedItems] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (shipment?.items) {
      setReceivedItems(shipment.items.map(item => ({
        item_id: item.id,
        item_sku: item.item_sku,
        item_name: item.item?.item_name || item.item_sku,
        dispatched_quantity: item.dispatched_quantity,
        received_quantity: item.dispatched_quantity,
        damaged_quantity: 0,
        discrepancy_reason: ""
      })));
    }
  }, [shipment]);

  const handleUpdateQty = (index: number, field: string, value: number | string) => {
    const newItems = [...receivedItems];
    newItems[index] = { ...newItems[index], [field]: value };
    setReceivedItems(newItems);
  };

  const handleSubmit = async () => {
    if (!shipment) return;
    setIsSubmitting(true);
    try {
      const response = await branchOperationsAPI.confirmDelivery(shipment.id, {
        items_received: receivedItems,
        discrepancy_notes: notes
      });

      if (response.success) {
        toast.success("Delivery confirmed successfully");
        onConfirm();
        onClose();
      } else {
        toast.error(response.message || "Failed to confirm delivery");
      }
    } catch (error) {
      console.error("Error confirming delivery:", error);
      toast.error("An error occurred while confirming delivery");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!shipment) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm Delivery: {shipment.dispatch_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-blue-50 p-3 rounded-ios-lg text-sm text-blue-700 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <p>Please verify the quantities received. Any discrepancies should be noted in the reason field.</p>
          </div>

          <div className="overflow-x-auto border rounded-ios-lg">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Item</th>
                  <th className="px-3 py-2 text-right">Dispatched</th>
                  <th className="px-3 py-2 text-center">Received</th>
                  <th className="px-3 py-2 text-center">Damaged</th>
                  <th className="px-3 py-2 text-left">Reason/Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {receivedItems.map((item, idx) => (
                  <tr key={item.item_id}>
                    <td className="px-3 py-2">
                      <p className="font-medium">{item.item_name}</p>
                      <p className="text-xs text-gray-500">{item.item_sku}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-bold">{item.dispatched_quantity}</td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        value={item.received_quantity}
                        onChange={(e) => handleUpdateQty(idx, 'received_quantity', parseInt(e.target.value) || 0)}
                        className="w-16 h-8 border rounded text-center"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="number"
                        value={item.damaged_quantity}
                        onChange={(e) => handleUpdateQty(idx, 'damaged_quantity', parseInt(e.target.value) || 0)}
                        className="w-16 h-8 border rounded text-center"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={item.discrepancy_reason}
                        onChange={(e) => handleUpdateQty(idx, 'discrepancy_reason', e.target.value)}
                        placeholder="Optional"
                        className="w-full h-8 border rounded px-2 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">General Delivery Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded-ios-lg p-2 text-sm"
              rows={3}
              placeholder="Any additional comments about this delivery..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <IOSButton variant="secondary" onClick={onClose}>Cancel</IOSButton>
            <IOSButton onClick={handleSubmit} disabled={isSubmitting} leftIcon={isSubmitting ? <RefreshCw className="animate-spin" /> : <Check />}>
              {isSubmitting ? "Confirming..." : "Confirm Delivery"}
            </IOSButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BranchIncomingInventoryContent() {
  const { activeBranchId } = useBranch();

  const [shipments, setShipments] = useState<IncomingShipment[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<IncomingShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");

  // Modal state
  const [selectedShipment, setSelectedShipment] = useState<IncomingShipment | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  useEffect(() => {
    if (activeBranchId) {
      fetchIncomingShipments();
    }
  }, [activeBranchId]);

  useEffect(() => {
    applyFilters();
  }, [shipments, searchTerm, statusFilter]);

  const fetchIncomingShipments = async () => {
    if (!activeBranchId) return;

    setIsLoading(true);
    try {
      const response = await branchOperationsAPI.getIncomingStock(activeBranchId);

      if (response && (response as any).success && Array.isArray((response as any).data)) {
        setShipments((response as any).data as IncomingShipment[]);
      } else if (Array.isArray(response)) {
        setShipments(response as IncomingShipment[]);
      } else {
        setShipments([]);
      }
    } catch (error) {
      console.error("Error fetching incoming shipments:", error);
      toast.error("Failed to load incoming shipments");
      setShipments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...shipments];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.dispatch_number.toLowerCase().includes(q) ||
          (s.source && s.source.toLowerCase().includes(q)) ||
          (s.from_branch?.name && s.from_branch.name.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((s) => s.status.toUpperCase() === statusFilter.toUpperCase());
    }

    setFilteredShipments(result);
  };

  const formatDateSafe = (value: string | null | undefined) => {
    if (!value) return "—";
    try {
      return format(new Date(value), "MMM d, yyyy HH:mm");
    } catch {
      return value;
    }
  };

  const handleConfirmClick = (shipment: IncomingShipment) => {
    setSelectedShipment(shipment);
    setIsConfirmModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <IOSCard className="p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1 flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by dispatch number or source..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-ios-lg border border-gray-200 px-3 text-sm bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="DELIVERED">Delivered</option>
            </select>
            <IOSButton
              variant="secondary"
              leftIcon={<RefreshCw className="h-4 w-4" />}
              onClick={fetchIncomingShipments}
            >
              Refresh
            </IOSButton>
          </div>
        </div>
      </IOSCard>

      <IOSCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Dispatch</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Source</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Created</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Expected</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-center font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="h-5 w-5 animate-spin inline-block mr-2 text-gray-400" />
                    Loading incoming shipments...
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No incoming shipments found
                  </td>
                </tr>
              ) : (
                filteredShipments.map((shipment) => {
                  const s = shipment.status.toUpperCase();
                  return (
                    <tr key={shipment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <TruckIcon className="h-4 w-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {shipment.dispatch_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {shipment.from_branch?.name || shipment.source || "Central Warehouse"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatDateSafe(shipment.created_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {formatDateSafe(shipment.expected_delivery || shipment.estimated_delivery)}
                      </td>
                      <td className="px-4 py-3">
                        <IOSBadge
                          className={
                            s === "CONFIRMED" || s === "DELIVERED"
                              ? "bg-green-100 text-green-700"
                              : s === "IN_TRANSIT"
                                ? "bg-yellow-100 text-yellow-700"
                                : s === "DISPUTED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                          }
                        >
                          {s}
                        </IOSBadge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {s === "IN_TRANSIT" && (
                          <IOSButton
                            size="sm"
                            leftIcon={<CheckCircle2 className="h-4 w-4" />}
                            onClick={() => handleConfirmClick(shipment)}
                          >
                            Confirm
                          </IOSButton>
                        )}
                        {(s === "CONFIRMED" || s === "DELIVERED") && (
                          <span className="text-xs text-gray-400 flex items-center justify-center gap-1">
                            <Check className="h-3 w-3" /> Received
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </IOSCard>

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        shipment={selectedShipment}
        onConfirm={fetchIncomingShipments}
      />
    </div>
  );
}

export default function BranchIncomingInventoryPage() {
  const { user } = useAuth();

  return (
    <ProtectedRoute
      allowedRoles={[
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.BRANCH_MANAGER,
        UserRole.BRANCH_OPERATIONS_MANAGER,
        UserRole.BRANCH_STOREKEEPER,
      ]}
    >
      <BranchPageWrapper>
        <BranchAwareDashboardLayout
          title="Incoming Shipments"
          subtitle="Track deliveries from the central warehouse"
        >
          <BranchIncomingInventoryContent />
        </BranchAwareDashboardLayout>
      </BranchPageWrapper>
    </ProtectedRoute>
  );
}
