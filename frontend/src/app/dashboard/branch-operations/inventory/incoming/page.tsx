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
import { Search, RefreshCw, TruckIcon } from "lucide-react";

interface IncomingShipment {
  id: string;
  dispatch_number: string;
  source: string;
  status: string;
  created_at: string;
  expected_delivery: string | null;
  delivered_at: string | null;
}

function BranchIncomingInventoryContent() {
  const { activeBranchId } = useBranch();

  const [shipments, setShipments] = useState<IncomingShipment[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<IncomingShipment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");

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
          s.source.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }

    setFilteredShipments(result);
  };

  const formatDateSafe = (value: string | null) => {
    if (!value) return "—";
    try {
      return format(new Date(value), "MMM d, yyyy HH:mm");
    } catch {
      return value;
    }
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
              <option value="pending">Pending</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
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
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    <RefreshCw className="h-5 w-5 animate-spin inline-block mr-2 text-gray-400" />
                    Loading incoming shipments...
                  </td>
                </tr>
              ) : filteredShipments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No incoming shipments found
                  </td>
                </tr>
              ) : (
                filteredShipments.map((shipment) => (
                  <tr key={shipment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TruckIcon className="h-4 w-4 text-gray-400" />
                        <span className="font-medium text-gray-900">
                          {shipment.dispatch_number}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{shipment.source}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDateSafe(shipment.created_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {formatDateSafe(shipment.expected_delivery)}
                    </td>
                    <td className="px-4 py-3">
                      <IOSBadge
                        className={
                          shipment.status === "delivered"
                            ? "bg-green-100 text-green-700"
                            : shipment.status === "in_transit"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-blue-100 text-blue-700"
                        }
                      >
                        {shipment.status.toUpperCase()}
                      </IOSBadge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </IOSCard>
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
