"use client";

import { useState, useEffect } from "react";
import { IOSCard } from "@/components/ui/ios-card";
import { IOSBadge } from "@/components/ui/ios-badge";
import { IOSButton } from "@/components/ui/ios-button";
import { stockAnalyticsAPI } from "@/lib/api/branch-manager";
import { storeAPI } from "@/lib/api/store";
import {
  AlertTriangle,
  TrendingDown,
  Clock,
  DollarSign,
  Users,
  Package,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface Alert {
  id: string;
  type: "stock" | "financial" | "staff" | "operational";
  severity: "urgent" | "high" | "medium" | "low";
  title: string;
  description: string;
  action_url?: string;
  created_at: string;
}

interface AlertsWidgetProps {
  branchId: string;
}

export function AlertsWidget({ branchId }: AlertsWidgetProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "urgent" | "high">("all");

  useEffect(() => {
    fetchAlerts();
    // Refresh every 5 minutes
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [branchId]);

  const fetchAlerts = async () => {
    if (!branchId) return;

    setIsLoading(true);
    try {
      // Fetch low stock alerts
      const stockResponse = await stockAnalyticsAPI.getReorderSuggestions({
        branch_id: branchId,
      });

      const stockAlerts: Alert[] = (stockResponse.data?.suggestions || [])
        .filter((s: any) => s.priority === "urgent" || s.priority === "high")
        .slice(0, 5)
        .map((s: any) => ({
          id: `stock-${s.item_sku}`,
          type: "stock" as const,
          severity:
            s.priority === "urgent" ? ("urgent" as const) : ("high" as const),
          title: `Low Stock: ${s.item_name}`,
          description: `Only ${s.days_until_stockout} days of stock remaining`,
          action_url: "/dashboard/branch-manager/stock/analytics",
          created_at: new Date().toISOString(),
        }));

      // Fetch pending approvals
      const approvalsResponse = await storeAPI.getPendingRequests();
      const approvalAlerts: Alert[] = (approvalsResponse.data || [])
        .slice(0, 3)
        .map((r: any) => ({
          id: `approval-${r.id}`,
          type: "operational" as const,
          severity: "medium" as const,
          title: "Pending Stock Request",
          description: `Request from ${r.requester_name || "Staff"} awaiting approval`,
          action_url: "/dashboard/auditor/approvals",
          created_at: r.created_at,
        }));

      // Combine all alerts
      const allAlerts = [...stockAlerts, ...approvalAlerts].sort((a, b) => {
        const severityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      setAlerts(allAlerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filter === "all") return true;
    return alert.severity === filter;
  });

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "stock":
        return <Package className="h-4 w-4" />;
      case "financial":
        return <DollarSign className="h-4 w-4" />;
      case "staff":
        return <Users className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "urgent":
        return "danger";
      case "high":
        return "warning";
      case "medium":
        return "info";
      default:
        return "success";
    }
  };

  return (
    <IOSCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-[#FF3B30]" />
          Active Alerts
        </h3>
        <IOSButton
          size="sm"
          variant="secondary"
          leftIcon={<RefreshCw className={isLoading ? "animate-spin" : ""} />}
          onClick={fetchAlerts}
        >
          Refresh
        </IOSButton>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            filter === "all"
              ? "bg-[#007AFF] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({alerts.length})
        </button>
        <button
          onClick={() => setFilter("urgent")}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            filter === "urgent"
              ? "bg-[#FF3B30] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Urgent ({alerts.filter((a) => a.severity === "urgent").length})
        </button>
        <button
          onClick={() => setFilter("high")}
          className={`px-3 py-1 text-sm rounded-lg transition-colors ${
            filter === "high"
              ? "bg-[#FF9500] text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          High ({alerts.filter((a) => a.severity === "high").length})
        </button>
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="text-center py-8">
          <AlertTriangle className="h-12 w-12 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No alerts at this time</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className="p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg ${
                    alert.severity === "urgent"
                      ? "bg-red-100"
                      : alert.severity === "high"
                        ? "bg-orange-100"
                        : "bg-gray-200"
                  }`}
                >
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {alert.title}
                    </p>
                    <IOSBadge
                      variant="light"
                      color={getSeverityColor(alert.severity)}
                      className="flex-shrink-0"
                    >
                      {alert.severity}
                    </IOSBadge>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">
                    {alert.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </span>
                    {alert.action_url && (
                      <Link href={alert.action_url}>
                        <IOSButton size="sm" variant="secondary">
                          View
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </IOSButton>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </IOSCard>
  );
}
