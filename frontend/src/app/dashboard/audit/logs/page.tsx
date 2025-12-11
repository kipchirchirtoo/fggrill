'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Input } from '@/components/ui/input';
import { auditAPI } from '@/lib/api';
import { ClipboardList, RefreshCw, Search, User, Calendar, Eye, Filter } from 'lucide-react';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface AuditLog { id: string; action: string; module: string; user_name: string; user_role: string; details?: string; created_at: string; severity: 'low' | 'medium' | 'high'; }

const severityConfig: Record<string, { label: string; color: string; bg: string }> = {
  low: { label: 'Low', color: 'text-green-700', bg: 'bg-green-100' },
  medium: { label: 'Medium', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  high: { label: 'High', color: 'text-red-700', bg: 'bg-red-100' },
};

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await auditAPI.getAuditLogs({ module: moduleFilter !== 'all' ? moduleFilter : undefined });
      if (response.success) setLogs(response.data || []);
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [moduleFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const modules = [...new Set(logs.map(l => l.module))].filter(Boolean);
  const filteredLogs = logs.filter((l) => l.action?.toLowerCase().includes(searchQuery.toLowerCase()) || l.user_name?.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <ProtectedRoute allowedRoles={[UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1><p className="text-gray-500">System activity and changes</p></div>
            <IOSButton variant="secondary" onClick={fetchLogs} leftIcon={<RefreshCw />}>Refresh</IOSButton>
          </div>

          <IOSCard className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Search logs..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} className="px-3 py-2 border rounded-ios-lg">
                <option value="all">All Modules</option>
                {modules.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </IOSCard>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : filteredLogs.length === 0 ? (
            <IOSCard className="p-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No logs found</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => {
                const severity = severityConfig[log.severity] || severityConfig.low;
                return (
                  <IOSCard key={log.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold">{log.action}</p>
                          <IOSBadge className={`${severity.bg} ${severity.color}`}>{severity.label}</IOSBadge>
                        </div>
                        <p className="text-sm text-gray-500">{log.module}</p>
                        {log.details && <p className="text-sm text-gray-400 mt-1">{log.details}</p>}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                          <span className="flex items-center gap-1"><User className="h-3 w-3" /> {log.user_name} ({log.user_role})</span>
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(log.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      <IOSButton size="sm" variant="ghost"><Eye className="h-4 w-4" /></IOSButton>
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
