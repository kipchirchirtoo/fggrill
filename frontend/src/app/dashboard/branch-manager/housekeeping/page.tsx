'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Home, RefreshCw, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { housekeepingAPI } from '@/lib/api';

export default function BranchManagerHousekeepingPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchTasks(); }, [user]);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const res = await housekeepingAPI.getTasks(user?.branch_id);
      setTasks(res.tasks || res || []);
    } catch (error) { console.error('Error:', error); } 
    finally { setIsLoading(false); }
  };

  const stats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Housekeeping Status</h1>
              <p className="text-gray-600">Monitor cleaning tasks</p>
            </div>
            <Button onClick={fetchTasks} variant="outline">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 bg-amber-50"><Clock className="h-6 w-6 text-amber-600 mb-2" /><p className="text-2xl font-bold">{stats.pending}</p><p className="text-sm text-amber-700">Pending</p></Card>
            <Card className="p-4 bg-blue-50"><AlertCircle className="h-6 w-6 text-blue-600 mb-2" /><p className="text-2xl font-bold">{stats.inProgress}</p><p className="text-sm text-blue-700">In Progress</p></Card>
            <Card className="p-4 bg-green-50"><CheckCircle className="h-6 w-6 text-green-600 mb-2" /><p className="text-2xl font-bold">{stats.completed}</p><p className="text-sm text-green-700">Completed</p></Card>
          </div>

          <Card>
            <div className="divide-y">
              {tasks.map((t: any) => (
                <div key={t.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Home className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">Room {t.room_number}</p>
                      <p className="text-sm text-gray-500">{t.task_type}</p>
                    </div>
                  </div>
                  <Badge className={t.status === 'completed' ? 'bg-green-100 text-green-800' : t.status === 'in_progress' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}>{t.status}</Badge>
                </div>
              ))}
              {tasks.length === 0 && <div className="p-8 text-center text-gray-500">{isLoading ? 'Loading...' : 'No tasks'}</div>}
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
