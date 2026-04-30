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
  Send,
  Loader2,
  FileText,
  Calendar,
  Building,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { API_URL } from "@/lib/config";

export default function BranchAccountantDiscrepanciesPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [flags, setFlags] = useState<any[]>([]);
  const [selectedFlag, setSelectedFlag] = useState<any>(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [response, setResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchFlags = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;
      const branchId = user?.branch_id;

      if (!branchId) {
        toast.error("Branch information not found");
        return;
      }

      const response = await fetch(
        `${API_URL}/api/finance/discrepancies?branch_id=${branchId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

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
    fetchFlags();
  }, []);

  const handleRespond = async () => {
    if (!response.trim()) {
      toast.error("Please provide a response");
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/api/finance/discrepancies/${selectedFlag.id}/respond`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ accountant_response: response }),
        }
      );

      const result = await res.json();

      if (result.success) {
        toast.success("Response submitted successfully");
        setShowResponseModal(false);
        setSelectedFlag(null);
        setResponse("");
        fetchFlags();
      } else {
        toast.error(result.message || "Failed to submit response");
      }
    } catch (error) {
      toast.error("Failed to submit response");
      console.error("Respond Error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingFlags = flags.filter((f) => f.status === "PENDING");
  const underReviewFlags = flags.filter((f) => f.status === "UNDER_REVIEW");
  const resolvedFlags = flags.filter((f) => f.status === "RESOLVED");

  return (
    <ProtectedRoute
      allowedRoles={[
        UserRole.BRANCH_ACCOUNTANT,
        UserRole.ACCOUNTANT,
        UserRole.SUPER_ADMIN,
      ]}
    >
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-stone-900 tracking-tight flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-rose-600" />
              My Discrepancy Flags
            </h1>
            <p className="text-stone-500 mt-1">
              Review and respond to flags raised for your branch
            </p>
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm border-l-4 border-l-rose-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
                    Pending Response
                  </p>
                  <h4 className="text-3xl font-black text-rose-600">
                    {pendingFlags.length}
                  </h4>
                </div>
                <Clock className="w-10 h-10 text-rose-200" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm border-l-4 border-l-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
                    Under Review
                  </p>
                  <h4 className="text-3xl font-black text-amber-600">
                    {underReviewFlags.length}
                  </h4>
                </div>
                <MessageSquare className="w-10 h-10 text-amber-200" />
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm border-l-4 border-l-emerald-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">
                    Resolved
                  </p>
                  <h4 className="text-3xl font-black text-emerald-600">
                    {resolvedFlags.length}
                  </h4>
                </div>
                <CheckCircle2 className="w-10 h-10 text-emerald-200" />
              </div>
            </div>
          </div>

          {/* Flags List */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <Loader2 className="w-12 h-12 text-[#007AFF] animate-spin" />
              <p className="text-stone-500 text-sm">Loading flags...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {flags.length === 0 ? (
                <div className="bg-stone-50 border border-dashed border-stone-200 rounded-3xl p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-stone-800">
                    No Flags for Your Branch
                  </h3>
                  <p className="text-stone-500">
                    All clear! No discrepancies have been raised.
                  </p>
                </div>
              ) : (
                flags.map((flag) => (
                  <FlagCard
                    key={flag.id}
                    flag={flag}
                    onRespond={(f) => {
                      setSelectedFlag(f);
                      setShowResponseModal(true);
                    }}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Response Modal */}
        {showResponseModal && selectedFlag && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-stone-900">
                    Respond to Flag
                  </h3>
                  <p className="text-sm text-stone-500 mt-1">
                    Provide your explanation for this discrepancy
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowResponseModal(false);
                    setSelectedFlag(null);
                    setResponse("");
                  }}
                  className="p-2 hover:bg-stone-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-stone-400" />
                </button>
              </div>

              {/* Flag Details */}
              <div className="bg-stone-50 rounded-xl p-4 mb-6 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                      Flag Type
                    </p>
                    <p className="text-sm font-medium text-stone-900">
                      {selectedFlag.flag_type?.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                      Severity
                    </p>
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${
                        selectedFlag.severity === "CRITICAL"
                          ? "bg-rose-100 text-rose-700"
                          : selectedFlag.severity === "HIGH"
                            ? "bg-orange-100 text-orange-700"
                            : selectedFlag.severity === "MEDIUM"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {selectedFlag.severity}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                      Record Date
                    </p>
                    <p className="text-sm font-medium text-stone-900">
                      {format(new Date(selectedFlag.record_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                      Created
                    </p>
                    <p className="text-sm font-medium text-stone-900">
                      {format(
                        new Date(selectedFlag.created_at),
                        "MMM d, yyyy HH:mm"
                      )}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-2">
                    Description
                  </p>
                  <p className="text-sm text-stone-700">
                    {selectedFlag.description}
                  </p>
                </div>
              </div>

              {/* Response Input */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-stone-700 mb-2">
                    Your Response
                  </label>
                  <textarea
                    value={response}
                    onChange={(e) => setResponse(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-stone-200 rounded-xl outline-none focus:border-[#007AFF] min-h-[150px] resize-none"
                    placeholder="Explain the discrepancy, provide context, or clarify the situation..."
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowResponseModal(false);
                      setSelectedFlag(null);
                      setResponse("");
                    }}
                    className="flex-1 px-4 py-3 border-2 border-stone-200 rounded-xl font-bold text-stone-700 hover:bg-stone-50"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRespond}
                    disabled={!response.trim() || isSubmitting}
                    className="flex-1 px-4 py-3 bg-[#007AFF] text-white rounded-xl font-bold hover:bg-[#0056b3] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Submit Response
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function FlagCard({ flag, onRespond }: any) {
  const severityColors: any = {
    LOW: "bg-blue-50 text-blue-700 border-blue-200",
    MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
    HIGH: "bg-orange-50 text-orange-700 border-orange-200",
    CRITICAL: "bg-rose-50 text-rose-700 border-rose-200",
  };

  const statusConfig: any = {
    PENDING: {
      icon: <Clock className="w-4 h-4" />,
      color: "text-rose-600 bg-rose-50",
      label: "Pending Response",
    },
    UNDER_REVIEW: {
      icon: <MessageSquare className="w-4 h-4" />,
      color: "text-amber-600 bg-amber-50",
      label: "Under Review",
    },
    RESOLVED: {
      icon: <CheckCircle2 className="w-4 h-4" />,
      color: "text-emerald-600 bg-emerald-50",
      label: "Resolved",
    },
    ESCALATED: {
      icon: <ShieldAlert className="w-4 h-4" />,
      color: "text-red-600 bg-red-50",
      label: "Escalated",
    },
  };

  const status = statusConfig[flag.status] || statusConfig.PENDING;

  return (
    <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden hover:border-[#007AFF]/30 transition-all">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-4 flex-1">
            <div
              className={`p-3 rounded-xl ${flag.severity === "CRITICAL" ? "bg-rose-600" : "bg-stone-900"} text-white shadow-lg`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${severityColors[flag.severity]}`}
                >
                  {flag.severity}
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

          <div className="flex flex-col items-end gap-2">
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${status.color}`}
            >
              {status.icon}
              <span className="text-xs font-bold">{status.label}</span>
            </div>
          </div>
        </div>

        {/* Response Section */}
        {flag.accountant_response && (
          <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-4 mb-4">
            <p className="text-xs font-bold text-blue-700 uppercase mb-1 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              Your Response
            </p>
            <p className="text-sm text-blue-900 italic">
              "{flag.accountant_response}"
            </p>
          </div>
        )}

        {/* Director Resolution */}
        {flag.director_final_decision && (
          <div className="bg-emerald-50 border-l-4 border-emerald-500 rounded-lg p-4 mb-4">
            <p className="text-xs font-bold text-emerald-700 uppercase mb-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Director Resolution
            </p>
            <p className="text-sm text-emerald-900">
              {flag.director_final_decision}
            </p>
          </div>
        )}

        {/* Action Button */}
        {flag.status === "PENDING" && (
          <button
            onClick={() => onRespond(flag)}
            className="w-full mt-4 px-4 py-2.5 bg-[#007AFF] hover:bg-[#0056b3] text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            Respond to Flag
          </button>
        )}
      </div>
    </div>
  );
}
