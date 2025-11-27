'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Search, Calendar, User, Database } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

interface AuditLog {
  id: number;
  user_id?: string;
  action: string;
  table_name: string;
  record_id: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export default function AuditLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [filterAction, filterTable, dateFrom, dateTo]);

  const fetchLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      
      if (filterAction !== 'all') params.append('action', filterAction);
      if (filterTable !== 'all') params.append('table_name', filterTable);
      if (dateFrom) params.append('startDate', dateFrom);
      if (dateTo) params.append('endDate', dateTo);
      params.append('limit', '100');

      const url = `${API_URL}/api/audit/logs${params.toString() ? '?' + params.toString() : ''}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(log =>
    log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.user && log.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'create': return 'bg-green-500';
      case 'update': return 'bg-blue-500';
      case 'delete': return 'bg-red-500';
      case 'approve': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Audit Logs</h1>
            <p className="text-gray-600 mt-1">Track all system activities and changes</p>
          </div>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  id="search"
                  type="text"
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="action">Action</Label>
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger id="action">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="approve">Approve</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="table">Table</Label>
              <Select value={filterTable} onValueChange={setFilterTable}>
                <SelectTrigger id="table">
                  <SelectValue placeholder="All tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  <SelectItem value="users">Users</SelectItem>
                  <SelectItem value="bookings">Bookings</SelectItem>
                  <SelectItem value="expenses">Expenses</SelectItem>
                  <SelectItem value="budgets">Budgets</SelectItem>
                  <SelectItem value="vehicles">Vehicles</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dateFrom">Date From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Date To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Logs List */}
        {isLoading ? (
          <div className="text-center py-12">
            <p>Loading audit logs...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <Card key={log.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge className={getActionColor(log.action)}>
                        {log.action.toUpperCase()}
                      </Badge>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Database className="w-4 h-4" />
                        <span className="font-medium">{log.table_name}</span>
                        <span className="text-gray-400">#{log.record_id}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                      {log.user && (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          <span>{log.user.full_name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(log.created_at)}</span>
                      </div>
                    </div>

                    {log.ip_address && (
                      <div className="text-xs text-gray-500">
                        IP: {log.ip_address}
                      </div>
                    )}

                    {/* Show changes */}
                    {(log.old_values || log.new_values) && (
                      <details className="mt-2">
                        <summary className="text-sm text-blue-600 cursor-pointer">
                          View Changes
                        </summary>
                        <div className="mt-2 p-3 bg-gray-50 rounded text-xs">
                          {log.old_values && (
                            <div className="mb-2">
                              <strong>Old Values:</strong>
                              <pre className="mt-1 overflow-x-auto">
                                {JSON.stringify(log.old_values, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_values && (
                            <div>
                              <strong>New Values:</strong>
                              <pre className="mt-1 overflow-x-auto">
                                {JSON.stringify(log.new_values, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && filteredLogs.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No audit logs found</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
