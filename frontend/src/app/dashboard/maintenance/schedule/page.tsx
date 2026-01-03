'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import { Calendar, RefreshCw, ChevronLeft, ChevronRight, Wrench, Clock, CheckCircle } from 'lucide-react';
import { maintenanceAPI } from '@/lib/api';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface ScheduledTask { id: string; title: string; asset?: string; date: string; time: string; type: 'preventive' | 'inspection' | 'repair'; status: 'scheduled' | 'completed' | 'overdue'; }

export default function MaintenanceSchedulePage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const response = await maintenanceAPI.getRequests();
      if (response.success) {
        // Map maintenance requests to scheduled tasks format
        const mappedTasks = (response.data || []).map((r: any) => ({
          id: r.id,
          title: r.title || r.description,
          asset: r.asset_name,
          date: r.scheduled_date || r.created_at?.split('T')[0],
          time: r.scheduled_time || '09:00',
          type: r.type || 'repair',
          status: r.status === 'completed' ? 'completed' : r.status === 'overdue' ? 'overdue' : 'scheduled',
        }));
        setTasks(mappedTasks);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const todayTasks = tasks.filter(t => t.date === selectedDate.toISOString().split('T')[0]);
  const typeColors: Record<string, string> = { preventive: 'bg-blue-100 text-blue-700', inspection: 'bg-purple-100 text-purple-700', repair: 'bg-orange-100 text-orange-700' };

  return (
    <ProtectedRoute allowedRoles={[UserRole.MAINTENANCE, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div><h1 className="text-2xl font-bold text-gray-900">Maintenance Schedule</h1><p className="text-gray-500">Planned maintenance tasks</p></div>
          </div>

          <IOSCard className="p-4">
            <div className="flex items-center justify-between">
              <IOSButton variant="ghost" size="sm" onClick={() => navigateDate('prev')}><ChevronLeft className="h-5 w-5" /></IOSButton>
              <div className="text-center">
                <p className="text-lg font-bold">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                <p className="text-sm text-gray-500">{selectedDate.getFullYear()}</p>
              </div>
              <IOSButton variant="ghost" size="sm" onClick={() => navigateDate('next')}><ChevronRight className="h-5 w-5" /></IOSButton>
            </div>
          </IOSCard>

          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4 text-center"><p className="text-sm text-gray-500">Scheduled</p><p className="text-2xl font-bold">{tasks.filter(t => t.status === 'scheduled').length}</p></IOSCard>
            <IOSCard className="p-4 text-center"><p className="text-sm text-gray-500">Completed</p><p className="text-2xl font-bold">{tasks.filter(t => t.status === 'completed').length}</p></IOSCard>
            <IOSCard className="p-4 text-center"><p className="text-sm text-gray-500">Overdue</p><p className="text-2xl font-bold">{tasks.filter(t => t.status === 'overdue').length}</p></IOSCard>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12"><RefreshCw className="h-8 w-8 animate-spin text-gray-400" /></div>
          ) : todayTasks.length === 0 ? (
            <IOSCard className="p-12 text-center"><Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" /><p className="text-gray-500">No tasks scheduled for this day</p></IOSCard>
          ) : (
            <div className="space-y-3">
              {todayTasks.map((task) => (
                <IOSCard key={task.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-ios-lg bg-gray-100 flex items-center justify-center"><Wrench className="h-6 w-6 text-gray-600" /></div>
                      <div>
                        <p className="font-bold">{task.title}</p>
                        {task.asset && <p className="text-sm text-gray-500">{task.asset}</p>}
                        <p className="text-sm text-gray-400 flex items-center gap-1"><Clock className="h-3 w-3" /> {task.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <IOSBadge className={typeColors[task.type]}>{task.type}</IOSBadge>
                      {task.status === 'scheduled' && <IOSButton size="sm" leftIcon={<CheckCircle />}>Complete</IOSButton>}
                    </div>
                  </div>
                </IOSCard>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
