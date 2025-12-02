'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { housekeepingAPI } from '@/lib/api';
import { 
  Calendar, RefreshCw, ChevronLeft, ChevronRight, Users, Bed,
  Clock, User, Plus, Layers
} from 'lucide-react';
import { toast } from 'sonner';

interface Schedule {
  id: string;
  staff_id: string;
  staff_name: string;
  date: string;
  shift: 'morning' | 'afternoon' | 'night';
  floor?: number;
  rooms?: string[];
  status: 'scheduled' | 'checked_in' | 'completed' | 'absent';
}

const shiftConfig: Record<string, { label: string; time: string; color: string }> = {
  morning: { label: 'Morning', time: '6:00 AM - 2:00 PM', color: 'bg-yellow-100 text-yellow-700' },
  afternoon: { label: 'Afternoon', time: '2:00 PM - 10:00 PM', color: 'bg-blue-100 text-blue-700' },
  night: { label: 'Night', time: '10:00 PM - 6:00 AM', color: 'bg-purple-100 text-purple-700' },
};

export default function HousekeepingSchedulingPage() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [staffRes] = await Promise.all([
        housekeepingAPI.getStaff(),
      ]);

      if (staffRes.success) {
        setStaff(staffRes.data || []);
        // Generate mock schedules based on staff
        const mockSchedules: Schedule[] = (staffRes.data || []).map((s: any, i: number) => ({
          id: `sched-${i}`,
          staff_id: s.id,
          staff_name: `${s.first_name} ${s.last_name}`,
          date: selectedDate.toISOString().split('T')[0],
          shift: ['morning', 'afternoon', 'night'][i % 3] as any,
          floor: (i % 3) + 1,
          status: 'scheduled',
        }));
        setSchedules(mockSchedules);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const groupedByShift = {
    morning: schedules.filter(s => s.shift === 'morning'),
    afternoon: schedules.filter(s => s.shift === 'afternoon'),
    night: schedules.filter(s => s.shift === 'night'),
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Staff Scheduling</h1>
              <p className="text-gray-500">Manage housekeeping shifts and assignments</p>
            </div>
            <div className="flex gap-2">
              <IOSButton variant="secondary" onClick={fetchData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </IOSButton>
              <IOSButton>
                <Plus className="h-4 w-4 mr-2" />
                Add Schedule
              </IOSButton>
            </div>
          </div>

          {/* Date Navigation */}
          <IOSCard className="p-4">
            <div className="flex items-center justify-between">
              <IOSButton variant="ghost" size="sm" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="h-5 w-5" />
              </IOSButton>
              <div className="text-center">
                <p className="text-lg font-bold">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
                <p className="text-sm text-gray-500">{selectedDate.getFullYear()}</p>
              </div>
              <IOSButton variant="ghost" size="sm" onClick={() => navigateDate('next')}>
                <ChevronRight className="h-5 w-5" />
              </IOSButton>
            </div>
          </IOSCard>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <IOSCard className="p-4 text-center">
              <p className="text-sm text-gray-500">Morning Shift</p>
              <p className="text-2xl font-bold text-yellow-600">{groupedByShift.morning.length}</p>
            </IOSCard>
            <IOSCard className="p-4 text-center">
              <p className="text-sm text-gray-500">Afternoon Shift</p>
              <p className="text-2xl font-bold text-blue-600">{groupedByShift.afternoon.length}</p>
            </IOSCard>
            <IOSCard className="p-4 text-center">
              <p className="text-sm text-gray-500">Night Shift</p>
              <p className="text-2xl font-bold text-purple-600">{groupedByShift.night.length}</p>
            </IOSCard>
          </div>

          {/* Schedule by Shift */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(shiftConfig).map(([shift, config]) => (
                <IOSCard key={shift} className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`px-3 py-1 rounded-ios-lg ${config.color}`}>
                        <p className="font-medium">{config.label}</p>
                      </div>
                      <p className="text-sm text-gray-500">{config.time}</p>
                    </div>
                    <p className="text-sm text-gray-500">
                      {groupedByShift[shift as keyof typeof groupedByShift].length} staff
                    </p>
                  </div>

                  {groupedByShift[shift as keyof typeof groupedByShift].length === 0 ? (
                    <p className="text-gray-400 text-center py-4">No staff scheduled</p>
                  ) : (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {groupedByShift[shift as keyof typeof groupedByShift].map((schedule) => (
                        <div key={schedule.id} className="p-3 bg-gray-50 rounded-ios-lg flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
                            {schedule.staff_name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{schedule.staff_name}</p>
                            {schedule.floor && (
                              <p className="text-sm text-gray-500 flex items-center gap-1">
                                <Layers className="h-3 w-3" /> Floor {schedule.floor}
                              </p>
                            )}
                          </div>
                          <IOSBadge variant={schedule.status === 'checked_in' ? 'success' : 'neutral'}>
                            {schedule.status}
                          </IOSBadge>
                        </div>
                      ))}
                    </div>
                  )}
                </IOSCard>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
