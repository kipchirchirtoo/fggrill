'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { DepartmentCommunication } from '@/components/communication';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { IOSBadge } from '@/components/ui/ios-badge';
import {
  Home, Sparkles, Clock, CheckCircle, AlertCircle,
  RefreshCw, Send, Users, Bed, ArrowLeft
} from 'lucide-react';
import { housekeepingAPI } from '@/lib/api';
import { toast } from 'sonner';
import Link from 'next/link';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface HousekeepingTask {
  id: string;
  room_number: string;
  task_type: string;
  status: string;
  priority: string;
  assigned_to?: string;
  created_at: string;
}

interface RoomStatus {
  room_number: string;
  status: 'clean' | 'dirty' | 'cleaning' | 'inspecting';
  last_cleaned?: string;
}

export default function ReceptionHousekeepingPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<HousekeepingTask[]>([]);
  const [roomStatuses, setRoomStatuses] = useState<RoomStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'requests' | 'status'>('requests');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch housekeeping tasks
      const tasksRes = await housekeepingAPI.getTasks({ status: 'pending', branch_id: user?.branch_id || undefined });
      const tasksData = tasksRes.data || tasksRes.tasks || tasksRes || [];
      setTasks(Array.isArray(tasksData) ? tasksData : []);

      // Fetch room grid for status
      const roomsRes = await housekeepingAPI.getRoomGrid(user?.branch_id?.toString());
      const roomsData = roomsRes.data || roomsRes.rooms || roomsRes || [];
      setRoomStatuses(Array.isArray(roomsData) ? roomsData.map((r: any) => ({
        room_number: r.room_number,
        status: r.cleaning_status || r.status || 'clean',
        last_cleaned: r.last_cleaned
      })) : []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const requestRoomCleaning = async (roomNumber: string, priority: string = 'normal') => {
    try {
      await housekeepingAPI.createGuestRequest({
        room_number: roomNumber,
        request_type: 'cleaning',
        priority: priority,
        description: 'Room cleaning requested by reception',
        source: 'reception',
        branch_id: user?.branch_id || undefined
      });
      toast.success(`Cleaning request sent for Room ${roomNumber}`);
      fetchData();
    } catch (error) {
      toast.error('Failed to send cleaning request');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'clean': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'dirty': return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'cleaning': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'inspecting': return 'bg-amber-50 text-amber-700 border-amber-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'in_progress': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const stats = {
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    dirtyRooms: roomStatuses.filter(r => r.status === 'dirty').length,
    cleaningRooms: roomStatuses.filter(r => r.status === 'cleaning').length
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.RECEPTIONIST, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/reception">
                <IOSButton variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4" />
                </IOSButton>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Housekeeping Coordination</h1>
                <p className="text-gray-600">Request cleaning and track room status</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <IOSButton variant="outline" onClick={fetchData} className="border-[rgba(60,60,67,0.12)] text-[#3C3C43] hover:bg-[#F2F2F7]">
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </IOSButton>
              <DepartmentCommunication
                fromDepartment="reception"
                branchId={user?.branch_id || undefined}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'In Progress', value: stats.inProgress, icon: Sparkles, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Completed', value: stats.completed, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Dirty Rooms', value: stats.dirtyRooms, icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50' },
              { label: 'Being Cleaned', value: stats.cleaningRooms, icon: Home, color: 'text-blue-600', bg: 'bg-blue-50' },
            ].map((stat) => (
              <IOSCard key={stat.label} className="p-4 border-none shadow-sm bg-white">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                    <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                  </div>
                </div>
              </IOSCard>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setActiveTab('requests')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'requests'
                ? 'border-[#3C3C43] text-[#3C3C43]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Active Requests
            </button>
            <button
              onClick={() => setActiveTab('status')}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${activeTab === 'status'
                ? 'border-[#3C3C43] text-[#3C3C43]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              Room Status
            </button>
          </div>

          {/* Content */}
          {activeTab === 'requests' ? (
            <IOSCard className="divide-y">
              {isLoading ? (
                <div className="p-8 text-center text-gray-500">Loading...</div>
              ) : tasks.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No active housekeeping requests</p>
                </div>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-[#F2F2F7] rounded-xl flex items-center justify-center">
                        <Bed className="h-6 w-6 text-[#3C3C43]" />
                      </div>
                      <div>
                        <p className="font-semibold font-sf-pro-display">Room {task.room_number}</p>
                        <p className="text-sm text-gray-500 capitalize">{task.task_type.replace('_', ' ')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {task.assigned_to && (
                        <span className="text-sm text-gray-500">
                          <Users className="h-4 w-4 inline mr-1" />
                          {task.assigned_to}
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTaskStatusColor(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </IOSCard>
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {roomStatuses.map(room => (
                <div
                  key={room.room_number}
                  className="p-3 rounded-xl border-2 text-center cursor-pointer transition-all hover:shadow-sm border-[rgba(60,60,67,0.12)] bg-[#FFFFFF] hover:bg-[#FAFAFA]"
                  onClick={() => room.status === 'dirty' && requestRoomCleaning(room.room_number)}
                >
                  <p className="text-lg font-bold">{room.room_number}</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getStatusColor(room.status)}`}>
                    {room.status}
                  </span>
                </div>
              ))}
              {roomStatuses.length === 0 && !isLoading && (
                <div className="col-span-full text-center py-8 text-gray-500">
                  <Home className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No room status data available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
