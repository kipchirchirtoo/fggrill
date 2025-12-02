'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { auditAPI } from '@/lib/api';
import { ClipboardList, RefreshCw, User, Calendar, Eye } from 'lucide-react';

interface AuditLog { id: string; action: string; module: string; user_name: string; created_at: string; severity: string; }

export default function AdminAuditPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await auditAPI.getAuditLogs();
      if (response.success) setLogs(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const severityConfig: Record<string, { color: string; bg: string }> = {
    low: { color: 'text-green-700', bg: 'bg-green-100' },
    medium: { color: 'text-yellow-700', bg: 'bg-yellow-100' },
    high: { color: 'text-red-700', bg: 'bg-red-100' },
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1><p className="text-gray-500">System activity logs</p></div>
            <IOSButton variant="secondary" onClick={fetchLogs}><RefreshCw className="h-4 w-4 mr-2" /> Refresh</IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : logs.length === 0 ? (
            <IOSCard className="p-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No logs</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {logs.slice(0, 50).map((log) => {
                const severity = severityConfig[log.severity] || severityConfig.low;
                return (
                  <IOSCard key={log.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold">{log.action}</p>
                        <p className="text-sm text-gray-500">{log.module}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><User className="h-3 w-3" /> {log.user_name}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(log.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <IOSBadge className={`${severity.bg} ${severity.color}`}>{log.severity}</IOSBadge>
                    </div>
                  </IOSCard>
                );
              })}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
