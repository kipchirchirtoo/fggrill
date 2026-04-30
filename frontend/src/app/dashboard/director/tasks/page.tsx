"use client";

import React, { useState, useEffect } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { UserRole } from "@/lib/user-roles";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  ChevronDown,
  X,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/config";

const API_BASE = API_URL;
const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
  "Content-Type": "application/json",
});

const PRIO_COLOR: Record<string, string> = {
  CRITICAL: "bg-rose-100 text-rose-700 border-rose-200",
  HIGH: "bg-orange-100 text-orange-700 border-orange-200",
  MEDIUM: "bg-amber-100 text-amber-700 border-amber-200",
  LOW: "bg-blue-100 text-blue-700 border-blue-200",
};
const STAT_COLOR: Record<string, string> = {
  PENDING: "bg-rose-50 text-rose-700",
  IN_PROGRESS: "bg-amber-50 text-amber-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  DISMISSED: "bg-stone-100 text-stone-500",
};
const STAT_ICON: Record<string, any> = {
  PENDING: <Clock className="w-3 h-3" />,
  IN_PROGRESS: <MessageSquare className="w-3 h-3" />,
  COMPLETED: <CheckCircle2 className="w-3 h-3" />,
  DISMISSED: <XCircle className="w-3 h-3" />,
};

export default function DirectorTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState({
    status: "",
    priority: "",
    assigned_to_role: "",
  });
  const [selected, setSelected] = useState<any>(null);
  const [closeNote, setCloseNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setIsLoading(true);
    const q = new URLSearchParams();
    if (filter.status) q.set("status", filter.status);
    if (filter.priority) q.set("priority", filter.priority);
    if (filter.assigned_to_role)
      q.set("assigned_to_role", filter.assigned_to_role);
    fetch(`${API_BASE}/api/finance/director/tasks?${q}`, {
      headers: authHeaders(),
    })
      .then((r) => r.json())
      .then((r) => {
        if (r.success) setTasks(r.data || []);
      })
      .catch(() => toast.error("Failed to load tasks"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, [filter]);

  const closeTask = async (id: string, status: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/finance/director/tasks/${id}/close`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ status, director_notes: closeNote }),
        },
      );
      const r = await res.json();
      if (r.success) {
        toast.success(`Task ${status.toLowerCase()}`);
        setSelected(null);
        setCloseNote("");
        load();
      } else toast.error(r.message);
    } finally {
      setSubmitting(false);
    }
  };

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "PENDING").length,
    inProgress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    completed: tasks.filter((t) => t.status === "COMPLETED").length,
    critical: tasks.filter((t) => t.priority === "CRITICAL").length,
  };

  return (
    <ProtectedRoute
      allowedRoles={[
        UserRole.DIRECTOR,
        UserRole.SUPER_ADMIN,
        UserRole.GENERAL_MANAGER,
      ]}
    >
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-stone-900 flex items-center gap-3">
              <ClipboardList className="w-8 h-8 text-[#007AFF]" /> Director
              Review Tasks
            </h1>
            <p className="text-stone-500 mt-1">
              Review assignments issued to branches, auditors, and HR
            </p>
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              {
                label: "Total Tasks",
                value: stats.total,
                color: "border-l-stone-700",
              },
              {
                label: "Pending",
                value: stats.pending,
                color: "border-l-rose-500",
              },
              {
                label: "In Progress",
                value: stats.inProgress,
                color: "border-l-amber-500",
              },
              {
                label: "Completed",
                value: stats.completed,
                color: "border-l-emerald-500",
              },
              {
                label: "Critical",
                value: stats.critical,
                color: "border-l-red-600",
              },
            ].map((k) => (
              <div
                key={k.label}
                className={`bg-white border border-stone-200 border-l-4 ${k.color} rounded-2xl p-4 shadow-sm`}
              >
                <p className="text-xs font-bold text-stone-400 uppercase">
                  {k.label}
                </p>
                <p className="text-3xl font-black text-stone-900 mt-1">
                  {k.value}
                </p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            {[
              {
                key: "status",
                opts: ["", "PENDING", "IN_PROGRESS", "COMPLETED", "DISMISSED"],
                label: "All Statuses",
              },
              {
                key: "priority",
                opts: ["", "CRITICAL", "HIGH", "MEDIUM", "LOW"],
                label: "All Priorities",
              },
              {
                key: "assigned_to_role",
                opts: [
                  "",
                  "branch_accountant",
                  "auditor",
                  "hr_manager",
                  "branch_manager",
                  "general_manager",
                ],
                label: "All Roles",
              },
            ].map((f) => (
              <select
                key={f.key}
                value={(filter as any)[f.key]}
                onChange={(e) =>
                  setFilter({ ...filter, [f.key]: e.target.value })
                }
                className="border border-stone-200 rounded-xl px-4 py-2 text-sm bg-white outline-none focus:border-[#007AFF]"
              >
                <option value="">{f.label}</option>
                {f.opts.slice(1).map((o) => (
                  <option key={o} value={o}>
                    {o
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            ))}
          </div>

          {/* Task list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-[#007AFF]" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="bg-stone-50 border border-dashed border-stone-200 rounded-3xl p-12 text-center">
              <ClipboardList className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <p className="font-bold text-stone-600">No tasks found</p>
              <p className="text-stone-400 text-sm mt-1">
                Assign review tasks from the Drill-Down page
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelected(task)}
                  className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm hover:border-[#007AFF]/40 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1">
                      <div
                        className={`mt-1 p-2 rounded-xl border ${PRIO_COLOR[task.priority] || ""}`}
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${PRIO_COLOR[task.priority] || ""}`}
                          >
                            {task.priority}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 ${STAT_COLOR[task.status] || ""}`}
                          >
                            {STAT_ICON[task.status]}
                            {task.status.replace("_", " ")}
                          </span>
                          {task.branches?.name && (
                            <span className="text-xs text-stone-400">
                              {task.branches.name}
                            </span>
                          )}
                          {task.related_record_date && (
                            <span className="text-xs text-stone-400">
                              {task.related_record_date}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-stone-900">
                          {task.title}
                        </h4>
                        <p className="text-sm text-stone-500 mt-0.5 line-clamp-1">
                          {task.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 pl-4 md:border-l border-stone-100 text-right">
                      <div>
                        <p className="text-[10px] font-bold text-stone-400 uppercase">
                          Assigned To
                        </p>
                        <p className="text-sm font-bold text-stone-700 capitalize">
                          {(task.assigned_to_role || "").replace(/_/g, " ")}
                        </p>
                        {task.assignee && (
                          <p className="text-xs text-stone-400">
                            {task.assignee.first_name} {task.assignee.last_name}
                          </p>
                        )}
                      </div>
                      {task.due_date && (
                        <div>
                          <p className="text-[10px] font-bold text-stone-400 uppercase">
                            Due
                          </p>
                          <p className="text-sm font-bold text-stone-700">
                            {task.due_date}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  {task.response_notes && (
                    <div className="mt-3 pt-3 border-t border-stone-100 flex gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-stone-600 italic">
                        "{task.response_notes}"
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail modal */}
        {selected && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start mb-5">
                <h3 className="text-xl font-bold text-stone-900">
                  {selected.title}
                </h3>
                <button
                  onClick={() => {
                    setSelected(null);
                    setCloseNote("");
                  }}
                  className="p-1.5 hover:bg-stone-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-stone-400" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { l: "Branch", v: selected.branches?.name || "—" },
                    {
                      l: "Assigned Role",
                      v: (selected.assigned_to_role || "").replace(/_/g, " "),
                    },
                    { l: "Priority", v: selected.priority },
                    { l: "Status", v: selected.status.replace("_", " ") },
                    { l: "Due Date", v: selected.due_date || "—" },
                    { l: "Stream", v: selected.related_stream || "—" },
                  ].map((item) => (
                    <div key={item.l}>
                      <p className="text-xs font-bold text-stone-400 uppercase">
                        {item.l}
                      </p>
                      <p className="text-sm font-semibold text-stone-800 capitalize">
                        {item.v}
                      </p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                    Instructions
                  </p>
                  <p className="text-sm text-stone-700 bg-stone-50 p-3 rounded-xl">
                    {selected.description}
                  </p>
                </div>
                {selected.director_notes && (
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                      Director's Notes
                    </p>
                    <p className="text-sm text-stone-700 bg-blue-50 border-l-4 border-blue-500 p-3 rounded-xl">
                      {selected.director_notes}
                    </p>
                  </div>
                )}
                {selected.response_notes && (
                  <div>
                    <p className="text-xs font-bold text-stone-400 uppercase mb-1">
                      Staff Response
                    </p>
                    <p className="text-sm text-stone-700 bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-xl">
                      {selected.response_notes}
                    </p>
                  </div>
                )}
                {selected.status !== "COMPLETED" &&
                  selected.status !== "DISMISSED" && (
                    <div>
                      <p className="text-xs font-bold text-stone-400 uppercase mb-2">
                        Close Task
                      </p>
                      <textarea
                        value={closeNote}
                        onChange={(e) => setCloseNote(e.target.value)}
                        rows={3}
                        placeholder="Final notes (optional)..."
                        className="w-full border border-stone-200 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#007AFF] resize-none mb-3"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => closeTask(selected.id, "COMPLETED")}
                          disabled={submitting}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-50"
                        >
                          {submitting ? "Saving..." : "✓ Mark Completed"}
                        </button>
                        <button
                          onClick={() => closeTask(selected.id, "DISMISSED")}
                          disabled={submitting}
                          className="flex-1 border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-xl py-2.5 font-bold text-sm disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>
        )}
      </DashboardLayout>
    </ProtectedRoute>
  );
}
