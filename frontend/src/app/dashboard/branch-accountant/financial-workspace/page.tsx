"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, UserRole } from "@/lib/auth-context";
import { useBranch } from "@/lib/branch-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { BranchAwareDashboardLayout } from "@/components/layout/branch-aware-dashboard-layout";
import { IOSCard } from "@/components/ui/ios-card";
import { IOSButton } from "@/components/ui/ios-button";
import { financeAPI } from "@/lib/api/finance";
import { API_URL } from "@/lib/config";
import {
  Calendar as CalendarIcon,
  RefreshCw,
  Download,
  FileText,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import { DailyEntryModal } from "./components/DailyEntryModal";
import { MonthlyAdjustmentsModal } from "./components/MonthlyAdjustmentsModal";

interface DailyRecord {
  id: string;
  record_date: string;
  status: "DRAFT" | "SUBMITTED" | "REVIEWED" | "FLAGGED";
  total_revenue: number;
  total_payments: number;
  expected_cash: number;
  unbanked_cash: number;
  net_profit: number;
}

export default function FinancialWorkspacePage() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMonthlyModalOpen, setIsMonthlyModalOpen] = useState(false);

  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchRecords = useCallback(async () => {
    if (!currentBranchId) return;

    setIsLoading(true);
    try {
      const start = format(startOfMonth(currentDate), "yyyy-MM-dd");
      const end = format(endOfMonth(currentDate), "yyyy-MM-dd");

      const response = await financeAPI.workspace.getDailyRecords({
        branch_id: currentBranchId,
        start_date: start,
        end_date: end,
      });

      if (response.success) {
        setRecords(response.data);
      }
    } catch (error: any) {
      console.error("Failed to fetch records:", error);
      toast.error(error.message || "Failed to load financial records");
    } finally {
      setIsLoading(false);
    }
  }, [currentBranchId, currentDate]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setIsModalOpen(true);
  };

  const handleModalClose = (wasSaved: boolean) => {
    setIsModalOpen(false);
    setSelectedDate(null);
    if (wasSaved) {
      fetchRecords();
    }
  };

  // Calendar Generation
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const getRecordForDate = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return records.find((r) => r.record_date === dateStr);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "REVIEWED":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      case "FLAGGED":
        return <AlertCircle className="h-4 w-4 text-rose-500" />;
      case "DRAFT":
      default:
        return <FileText className="h-4 w-4 text-stone-400" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "SUBMITTED":
        return "bg-blue-50 border-blue-200";
      case "REVIEWED":
        return "bg-emerald-50 border-emerald-200";
      case "FLAGGED":
        return "bg-rose-50 border-rose-200";
      case "DRAFT":
        return "bg-stone-50 border-stone-200";
      default:
        return "bg-white border-stone-100 hover:border-stone-300";
    }
  };

  return (
    <ProtectedRoute
      allowedRoles={[
        UserRole.BRANCH_MANAGER,
        UserRole.BRANCH_ACCOUNTANT,
        UserRole.ACCOUNTANT,
        UserRole.AUDITOR,
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
        UserRole.DIRECTOR,
      ]}
    >
      <BranchAwareDashboardLayout
        title="Financial Workspace"
        subtitle="Daily financial tracking and reconciliation"
      >
        <div className="space-y-6">
          {/* Director Review Tasks Widget */}
          <DirectorTasksWidget role="branch_accountant" />

          {/* Header Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-stone-200 shadow-sm">
            <div className="flex items-center gap-4">
              <IOSButton
                variant="secondary"
                onClick={() =>
                  setCurrentDate(
                    new Date(
                      currentDate.getFullYear(),
                      currentDate.getMonth() - 1,
                      1,
                    ),
                  )
                }
              >
                Previous
              </IOSButton>
              <h2 className="text-lg font-semibold min-w-[150px] text-center">
                {format(currentDate, "MMMM yyyy")}
              </h2>
              <IOSButton
                variant="secondary"
                onClick={() =>
                  setCurrentDate(
                    new Date(
                      currentDate.getFullYear(),
                      currentDate.getMonth() + 1,
                      1,
                    ),
                  )
                }
              >
                Next
              </IOSButton>
            </div>

            <div className="flex items-center gap-2">
              <IOSButton
                variant="secondary"
                leftIcon={<DollarSign />}
                onClick={() => setIsMonthlyModalOpen(true)}
              >
                Monthly Adjustments
              </IOSButton>
              <IOSButton
                variant="secondary"
                leftIcon={
                  <RefreshCw className={isLoading ? "animate-spin" : ""} />
                }
                onClick={fetchRecords}
              >
                Refresh
              </IOSButton>
              <IOSButton
                variant="primary"
                leftIcon={<Download />}
                onClick={() => {
                  if (!currentBranchId) return;
                  const url = financeAPI.workspace.exportMonthlyStatement({
                    branch_id: currentBranchId,
                    fiscal_year: currentDate.getFullYear(),
                    fiscal_month: currentDate.getMonth() + 1,
                  });
                  window.open(`${API_URL}${url}`, "_blank");
                }}
              >
                Export Month
              </IOSButton>
            </div>
          </div>

          {/* Monthly Summary Cards could go here */}

          {/* Calendar Grid */}
          <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-[120px]">
              {/* Padding for first day of month */}
              {Array.from({ length: startOfMonth(currentDate).getDay() }).map(
                (_, i) => (
                  <div
                    key={`pad-${i}`}
                    className="border-r border-b border-stone-100 bg-stone-50/50"
                  />
                ),
              )}

              {daysInMonth.map((date) => {
                const record = getRecordForDate(date);
                const isCurrentDay = isToday(date);

                return (
                  <div
                    key={date.toISOString()}
                    onClick={() => handleDateClick(date)}
                    className={`
                      border-r border-b border-stone-200 p-2 cursor-pointer transition-all duration-200
                      ${getStatusColor(record?.status)}
                      ${isCurrentDay ? "ring-2 ring-inset ring-[#007AFF]" : ""}
                      hover:shadow-md relative
                    `}
                  >
                    <div className="flex justify-between items-start">
                      <span
                        className={`
                        text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full
                        ${isCurrentDay ? "bg-[#007AFF] text-white" : "text-stone-700"}
                      `}
                      >
                        {format(date, "d")}
                      </span>
                      {record && (
                        <div title={`Status: ${record.status}`}>
                          {getStatusIcon(record.status)}
                        </div>
                      )}
                    </div>

                    {record && (
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-stone-500">Rev:</span>
                          <span className="font-medium text-stone-900">
                            {Number(record.total_revenue || 0).toLocaleString(
                              "en-KE",
                              { maximumFractionDigits: 0 },
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-stone-500">Net:</span>
                          <span
                            className={`font-medium ${Number(record.net_profit) >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                          >
                            {Number(record.net_profit || 0).toLocaleString(
                              "en-KE",
                              { maximumFractionDigits: 0 },
                            )}
                          </span>
                        </div>
                        {Number(record.unbanked_cash) > 0 && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] text-rose-600 bg-rose-100 px-1 py-0.5 rounded">
                            <AlertCircle className="w-3 h-3" />
                            Unbanked
                          </div>
                        )}
                      </div>
                    )}

                    {!record && date <= new Date() && (
                      <div className="mt-6 flex justify-center">
                        <span className="text-xs text-stone-400 font-medium">
                          Add Entry
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {isModalOpen && selectedDate && (
          <DailyEntryModal
            isOpen={isModalOpen}
            onClose={handleModalClose}
            date={selectedDate}
            branchId={currentBranchId!}
            existingRecord={getRecordForDate(selectedDate)}
          />
        )}

        {isMonthlyModalOpen && (
          <MonthlyAdjustmentsModal
            isOpen={isMonthlyModalOpen}
            onClose={() => setIsMonthlyModalOpen(false)}
            year={currentDate.getFullYear()}
            month={currentDate.getMonth() + 1}
            branchId={currentBranchId!}
          />
        )}
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

// ── Director Review Tasks Widget ──────────────────────────────────────────────
function DirectorTasksWidget({ role }: { role: string }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [responding, setResponding] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const apiBase = API_URL;

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(
      `${apiBase}/api/finance/director/tasks?status=PENDING&assigned_to_role=${role}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    )
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setTasks(r.data || []);
      });
  }, [role]);

  if (tasks.length === 0) return null;

  const submitResponse = async (id: string) => {
    if (!responseText.trim()) return;
    setSubmitting(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(
        `${apiBase}/api/finance/director/tasks/${id}/respond`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ response_notes: responseText }),
        },
      );
      const r = await res.json();
      if (r.success) {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setResponding(null);
        setResponseText("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const PRIO: Record<string, string> = {
    CRITICAL: "border-rose-500 bg-rose-50",
    HIGH: "border-orange-400 bg-orange-50",
    MEDIUM: "border-amber-400 bg-amber-50",
    LOW: "border-blue-400 bg-blue-50",
  };

  return (
    <div className="bg-white border-2 border-rose-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 bg-rose-600 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm1 11H9v-2h2v2zm0-4H9V7h2v2z" />
          </svg>
          <span className="font-bold text-sm">Director Review Tasks</span>
          <span className="bg-white text-rose-600 text-xs font-black px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <span className="text-rose-200 text-xs">Requires your attention</span>
      </div>
      <div className="divide-y divide-stone-100">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`p-4 border-l-4 ${PRIO[task.priority] || "border-stone-200 bg-white"}`}
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase text-stone-400">
                    {task.priority}
                  </span>
                  {task.branches?.name && (
                    <span className="text-[10px] text-stone-400">
                      · {task.branches.name}
                    </span>
                  )}
                  {task.related_record_date && (
                    <span className="text-[10px] text-stone-400">
                      · {task.related_record_date}
                    </span>
                  )}
                </div>
                <p className="font-bold text-stone-900 text-sm">{task.title}</p>
                <p className="text-xs text-stone-600 mt-0.5">
                  {task.description}
                </p>
                {task.due_date && (
                  <p className="text-xs text-rose-600 font-semibold mt-1">
                    Due: {task.due_date}
                  </p>
                )}
              </div>
              <button
                onClick={() =>
                  setResponding(responding === task.id ? null : task.id)
                }
                className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-bold hover:bg-stone-700 transition-colors whitespace-nowrap"
              >
                Respond
              </button>
            </div>
            {responding === task.id && (
              <div className="mt-3 space-y-2">
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Type your response to the Director..."
                  rows={3}
                  className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-stone-400 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => submitResponse(task.id)}
                    disabled={submitting || !responseText.trim()}
                    className="flex-1 bg-emerald-600 text-white rounded-lg py-2 text-xs font-bold disabled:opacity-50"
                  >
                    {submitting ? "Sending..." : "Submit Response"}
                  </button>
                  <button
                    onClick={() => {
                      setResponding(null);
                      setResponseText("");
                    }}
                    className="px-4 border border-stone-200 rounded-lg text-xs font-bold text-stone-600 hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
