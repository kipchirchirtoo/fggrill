"use client";

import React, { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { UserRole } from "@/lib/user-roles";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShieldAlert,
  X,
  Plus,
  Loader2,
  Filter,
  Download,
  Eye,
  Calendar,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { API_URL } from "@/lib/config";

export default function AuditorDiscrepanciesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [flags, setFlags] = useState<any[]>([]);
  const [filter, setFilter] = useState({ status: "", severity: "", branch_id: "" });
  const [branches, setBranches] = useState<any[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<any>(null);

  const fetchBranches = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/finance/branches`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (result.success) setBranches(result.data || []);
    } catch (error) {
      console.error("Failed to fetch branches:", error);
    }
  };

  const fetchFlags = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      let url = `${API_URL}/api/finance/discrepancies?`;
      if (filter.status) url += `status=${filter.status}&`;
      if (filter.severity) url += `severity=${filter.severity}&`;
      if (filter.branch_id) url += `branch_id=${filter.branch_id}&`;

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (result.success) {
        setFlags(result.data || []);
      } else {
        toast.error(result.message || "Failed to fetch discrepancies");
      }
    } catch (error: any) {
      toast.error("Failed to fetch discrepancies");
      console.error("Fetch Flags Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [filter]);

  const handleCreateFlag = async (formData: any) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/finance/discrepancies`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Discrepancy flag created successfully");
        setShowCreateModal(false);
        fetchFlags();
      } else {
        toast.error(result.message || "Failed to create flag");
      }
    } catch (error) {
      toast.error("Failed to create discrepancy flag");
      console.error("Create Flag Error:", error);
    }
  };

  const exportReport = async () => {
    try {
      const token = localStorage.getItem("token");
      let url = `${API_URL}/api/finance/discrepancies/export?`;
      if (filter.status) url += `status=${filter.status}&`;
      if (filter.severity) url += `severity=${filter.severity}&`;
      if (filter.branch_id) url += `branch_id=${filter.branch_id}&`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `Discrepancy_Audit_Report_${new Date().toISOString().split("T")[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(blobUrl);
      toast.success("Report exported successfully");
    } catch (error) {
      toast.error("Failed to generate audit report");
    }
  };

  const stats = {
    total: flags.length,
    pending: flags.filter((f) => f.status === "PENDING").length,
    underReview: flags.filter((f) => f.status === "UNDER_REVIEW").length,
    resolved: flags.filter((f) => f.status === "RESOLVED").length,
    critical: flags.filter((f) => f.severity === "CRITICAL").length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-stone-900 tracking-tight flex items-center gap-3">
                <ShieldAlert className="w-8 h-8 text-rose-600" />
                Audit & Discrepancy Control
              </h1>
              <p className="text-stone-500 mt-1">
                Monitor, flag, and track financial discrepancies across all branches
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportReport}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Report
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] hover:bg-[#0056b3] text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Flag
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-2xl border border-stone-200 p-4 flex flex-wrap gap-3">
            <select
              value={filter.branch_id}
              onChange={(e) => setFilter({ ...filter, branch_id: e.target.value })}
              className="px-4 py-2 border border-stone-200 rounded-xl text-sm outline-none focus:border-[#007AFF]"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              value={filter.status}
              onChange={(e) => setFilter({ ...filter, status: e.target.value })}
              className="px-4 py-2 border border-stone-200 rounded-xl text-sm outline-none focus:border-[#007AFF]"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="ESCALATED">Escalated</option>
            </select>
            <select
              value={filter.severity}
              onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
              className="px-4 py-2 border border-stone-200 rounded-xl text-sm outline-none focus:border-[#007AFF]"
            >
              <option value="">All Severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total Flags" value={stats.total} color="border-l-stone-700" />
            <StatCard label="Pending" value={stats.pending} color="border-l-rose-500" />
            <StatCard label="Under Review" value={stats.underReview} color="border-l-amber-500" />
            <StatCard label="Resolved" value={stats.resolved} color="border-l-emerald-500" />
            <StatCard label="Critical" value={stats.critical} color="border-l-red-600" />
          </div>

          {/* Flags List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="w-12 h-12 text-[#007AFF] animate-spin" />
              <p className="text-stone-500 text-sm">Loading discrepancies...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flags.length === 0 ? (
                <div className="bg-stone-50 border border-dashed border-stone-200 rounded-3xl p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-stone-800">
                    No Discrepancies Found
                  </h3>
                  <p className="text-stone-500">
                    All systems clean or adjust filters to see more results
                  </p>
                </div>
              ) : (
                flags.map((flag) => (
                  <FlagCard
                    key={flag.id}
                    flag={flag}
                    onView={(f) => {
                      setSelectedFlag(f);
                      setShowDetailModal(true);
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <CreateFlagModal
            branches={branches}
            onClose={() => setShowCreateModal(false)}
            onSubmit={handleCreateFlag}
          />
        )}

        {/* Detail Modal */}
        {showDetailModal && selectedFlag && (
          <FlagDetailModal
            flag={selectedFlag}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedFlag(null);
            }}
          />
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function StatCard({ label, value, color }: any) {
  return (
    <div
      className={`bg-white border border-stone-200 border-l-4 ${color} rounded-2xl p-4 shadow-sm`}
    >
      <p className="text-xs font-bold text-stone-400 uppercase">{label}</p>
      <p className="text-3xl font-black text-stone-900 mt-1">{value}</p>
    </div>
  );
}

function FlagCard({ flag, onView }: any) {
  const severityColors: any = {
    LOW: "bg-blue-50 text-blue-700 border-blue-200",
    MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
    HIGH: "bg-orange-50 text-orange-700 border-orange-200",
    CRITICAL: "bg-rose-50 text-rose-700 border-rose-200",
  };

  const statusIcons: any = {
    PENDING: <Clock className="w-4 h-4 text-rose-500" />,
    UNDER_REVIEW: <MessageSquare className="w-4 h-4 text-amber-500" />,
    RESOLVED: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
    ESCALATED: <ShieldAlert className="w-4 h-4 text-rose-700" />,
  };

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden hover:border-[#007AFF]/30 transition-all">
      <div className="p-5 flex items-center justify-between gap-6">
        <div className="flex items-start gap-4 flex-1">
          <div
            className={`p-3 rounded-xl ${flag.severity === "CRITICAL" ? "bg-rose-600" : "bg-stone-900"} text-white shadow-lg`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${severityColors[flag.severity]}`}
              >
                {flag.severity}
              </span>
              <span className="text-xs font-bold text-stone-900">
                {flag.branches?.name}
              </span>
              <span className="text-xs font-medium text-stone-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(flag.record_date), "MMM d, yyyy")}
              </span>
            </div>
            <h4 className="text-lg font-bold text-stone-900">
              {flag.flag_type?.replace(/_/g, " ")}
            </h4>
            <p className="text-stone-600 text-sm">{flag.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-stone-50 rounded-full border border-stone-100">
            {statusIcons[flag.status]}
            <span className="text-xs font-bold text-stone-700">
              {flag.status?.replace(/_/g, " ")}
            </span>
          </div>
          <button
            onClick={() => onView(flag)}
            className="p-2 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <Eye className="w-5 h-5 text-stone-400" />
          </button>
        </div>
      </div>

      {flag.accountant_response && (
        <div className="bg-stone-50/50 border-t border-stone-100 p-4 flex gap-4">
          <MessageSquare className="w-4 h-4 text-[#007AFF] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase mb-1">
              Accountant Response
            </p>
            <p className="text-sm text-stone-700 italic">
              "{flag.accountant_response}"
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CreateFlagModal({ branches, onClose, onSubmit }: any) {
  const [formData, setFormData] = useState({
    flag_type: "MISSING_DOCUMENTATION",
    severity: "MEDIUM",
    description: "",
    branch_id: "",
    record_date: format(new Date(), "yyyy-MM-dd"),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSubmit(formData);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-2xl font-bold text-stone-900 mb-6">
          Create Discrepancy Flag
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Branch
            </label>
            <select
              value={formData.branch_id}
              onChange={(e) =>
                setFormData({ ...formData, branch_id: e.target.value })
              }
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF]"
              required
            >
              <option value="">Select Branch</option>
              {branches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Flag Type
            </label>
            <select
              value={formData.flag_type}
              onChange={(e) =>
                setFormData({ ...formData, flag_type: e.target.value })
              }
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF]"
              required
            >
              <option value="MISSING_DOCUMENTATION">Missing Documentation</option>
              <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
              <option value="UNAUTHORIZED_TRANSACTION">
                Unauthorized Transaction
              </option>
              <option value="POLICY_VIOLATION">Policy Violation</option>
              <option value="SUSPICIOUS_ACTIVITY">Suspicious Activity</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Severity
            </label>
            <select
              value={formData.severity}
              onChange={(e) =>
                setFormData({ ...formData, severity: e.target.value })
              }
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF]"
              required
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Record Date
            </label>
            <input
              type="date"
              value={formData.record_date}
              onChange={(e) =>
                setFormData({ ...formData, record_date: e.target.value })
              }
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full px-4 py-2 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF] min-h-[120px] resize-none"
              placeholder="Describe the discrepancy in detail..."
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border-2 border-stone-200 rounded-xl font-bold text-stone-700 hover:bg-stone-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[#007AFF] text-white rounded-xl font-bold hover:bg-[#0056b3] disabled:opacity-50"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Flag"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FlagDetailModal({ flag, onClose }: any) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-2xl font-bold text-stone-900">
              Discrepancy Details
            </h3>
            <p className="text-sm text-stone-500 mt-1">Flag ID: {flag.id}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg">
            <X className="w-6 h-6 text-stone-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                Branch
              </p>
              <p className="text-sm font-medium text-stone-900">
                {flag.branches?.name || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                Flag Type
              </p>
              <p className="text-sm font-medium text-stone-900">
                {flag.flag_type?.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                Severity
              </p>
              <span
                className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                  flag.severity === "CRITICAL"
                    ? "bg-rose-100 text-rose-700"
                    : flag.severity === "HIGH"
                      ? "bg-orange-100 text-orange-700"
                      : flag.severity === "MEDIUM"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-blue-100 text-blue-700"
                }`}
              >
                {flag.severity}
              </span>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                Status
              </p>
              <p className="text-sm font-medium text-stone-900">
                {flag.status?.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                Record Date
              </p>
              <p className="text-sm font-medium text-stone-900">
                {format(new Date(flag.record_date), "MMM d, yyyy")}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                Created
              </p>
              <p className="text-sm font-medium text-stone-900">
                {format(new Date(flag.created_at), "MMM d, yyyy HH:mm")}
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-stone-400 uppercase mb-2">
              Description
            </p>
            <p className="text-sm text-stone-700 bg-stone-50 p-4 rounded-xl">
              {flag.description}
            </p>
          </div>
          {flag.accountant_response && (
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-2">
                Accountant Response
              </p>
              <p className="text-sm text-stone-700 bg-blue-50 p-4 rounded-xl border-l-4 border-blue-500">
                {flag.accountant_response}
              </p>
            </div>
          )}
          {flag.director_final_decision && (
            <div>
              <p className="text-xs font-bold text-stone-400 uppercase mb-2">
                Director Resolution
              </p>
              <p className="text-sm text-stone-700 bg-emerald-50 p-4 rounded-xl border-l-4 border-emerald-500">
                {flag.director_final_decision}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
