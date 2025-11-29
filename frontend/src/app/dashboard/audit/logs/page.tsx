'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSearch, RefreshCw, ArrowLeft, Filter } from 'lucide-react';
import { auditAPI } from '@/lib/api';
import { formatDateTime } from '@/lib/date-utils';
import Link from 'next/link';

export default function AuditLogsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState({ module: '', from_date: '', to_date: '' });

  useEffect(() => { fetchLogs(); }, [filter]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await auditAPI.getAuditLogs(filter);
      setLogs(Array.isArray(res.logs || res.data) ? (res.logs || res.data) : []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/audit">
                <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              </Link>
              <h1 className="text-2xl font-bold">Audit Logs</h1>
            </div>
            <Button onClick={fetchLogs} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <Card className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Filter className="h-5 w-5 text-gray-400" />
              <select value={filter.module} onChange={(e) => setFilter(prev => ({ ...prev, module: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm">
                <option value="">All Modules</option>
                <option value="inventory">Inventory</option>
                <option value="finance">Finance</option>
                <option value="users">Users</option>
                <option value="bookings">Bookings</option>
              </select>
              <input type="date" value={filter.from_date}
                onChange={(e) => setFilter(prev => ({ ...prev, from_date: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm" placeholder="From" />
              <input type="date" value={filter.to_date}
                onChange={(e) => setFilter(prev => ({ ...prev, to_date: e.target.value }))}
                className="border rounded-lg px-3 py-2 text-sm" placeholder="To" />
            </div>
          </Card>

          <Card className="p-4">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading logs...</div>
            ) : logs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Module</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Action</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map((log, idx) => (
                      <tr key={log.id || idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">{formatDateTime(log.created_at)}</td>
                        <td className="px-4 py-3 text-sm">{log.user_name || log.user_email || '-'}</td>
                        <td className="px-4 py-3 text-sm">{log.module || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded ${
                            log.action_type === 'CREATE' ? 'bg-green-100 text-green-700' :
                            log.action_type === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                            log.action_type === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-gray-100'
                          }`}>{log.action_type || log.action || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{log.details || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileSearch className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No audit logs found</p>
              </div>
            )}
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
