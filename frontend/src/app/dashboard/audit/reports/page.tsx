'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { FileText, Download, Calendar, Eye, Plus, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface AuditReport { id: string; title: string; type: string; period: string; status: 'draft' | 'completed' | 'reviewed'; findings: number; created_at: string; }

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-gray-700', bg: 'bg-gray-100' },
  completed: { label: 'Completed', color: 'text-blue-700', bg: 'bg-blue-100' },
  reviewed: { label: 'Reviewed', color: 'text-green-700', bg: 'bg-green-100' },
};

export default function AuditReportsPage() {
  const { user } = useAuth();
  const [reports] = useState<AuditReport[]>([
    { id: '1', title: 'Q4 2024 Financial Audit', type: 'Financial', period: 'Oct-Dec 2024', status: 'completed', findings: 3, created_at: '2024-12-01' },
    { id: '2', title: 'Inventory Audit - November', type: 'Inventory', period: 'Nov 2024', status: 'reviewed', findings: 5, created_at: '2024-11-30' },
    { id: '3', title: 'Compliance Review', type: 'Compliance', period: 'Q4 2024', status: 'draft', findings: 0, created_at: '2024-12-02' },
  ]);

  const handleExport = (id: string, format: 'pdf' | 'excel') => {
    toast.success(`Exporting report as ${format.toUpperCase()}...`);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Audit Reports</h1><p className="text-gray-500">Generate and manage reports</p></div>
            <IOSButton><Plus className="h-4 w-4 mr-2" /> New Report</IOSButton>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4"><FileText className="h-6 w-6 text-[#007AFF] mb-2" /><p className="text-sm text-gray-500">Total Reports</p><p className="text-xl font-bold">{reports.length}</p></IOSCard>
            <IOSCard className="p-4"><CheckCircle className="h-6 w-6 text-[#34C759] mb-2" /><p className="text-sm text-gray-500">Reviewed</p><p className="text-xl font-bold text-[#34C759]">{reports.filter(r => r.status === 'reviewed').length}</p></IOSCard>
            <IOSCard className="p-4"><AlertTriangle className="h-6 w-6 text-yellow-600 mb-2" /><p className="text-sm text-gray-500">Total Findings</p><p className="text-xl font-bold text-yellow-600">{reports.reduce((sum, r) => sum + r.findings, 0)}</p></IOSCard>
          </div>

          <div className="space-y-4">
            {reports.map((report) => {
              const status = statusConfig[report.status];
              return (
                <IOSCard key={report.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-blue-100 flex items-center justify-center"><FileText className="h-6 w-6 text-[#007AFF]" /></div>
                      <div>
                        <p className="font-bold">{report.title}</p>
                        <p className="text-sm text-gray-500">{report.type} • {report.period}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(report.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {report.findings > 0 && <span className="text-sm text-yellow-600">{report.findings} findings</span>}
                      <IOSBadge className={`${status.bg} ${status.color}`}>{status.label}</IOSBadge>
                      <div className="flex gap-2">
                        <IOSButton size="sm" variant="secondary"><Eye className="h-4 w-4" /></IOSButton>
                        <IOSButton size="sm" variant="secondary" onClick={() => handleExport(report.id, 'pdf')}><Download className="h-4 w-4" /></IOSButton>
                      </div>
                    </div>
                  </div>
                </IOSCard>
              );
            })}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
