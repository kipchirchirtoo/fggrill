'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Clock,
  Calendar,
  FileText,
  Bell,
  User,
  LogOut,
  ChevronRight,
  Check,
  AlertCircle,
  Briefcase,
  DollarSign,
  GraduationCap,
  Home,
  ClipboardList,
  Loader2,
  Play,
  Square,
  RefreshCw,
  Plus,
  X,
  ChevronDown,
  Download,
  MoreHorizontal,
  Contact as IDCardIcon,
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { IDCardWidget } from '@/components/employee/portal/IDCardWidget';
import { YearlyAttendanceHeatmap } from '@/components/attendance/YearlyAttendanceHeatmap';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DashboardData {
  profile: any;
  schedules: any[];
  tasks: any[];
  announcements: any[];
  leaveBalance: { total: number; used: number; remaining: number };
  clockStatus: any;
  payslips?: any[];
}

export default function EmployeePortal() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [clockingIn, setClockingIn] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await api.employeePortal.getDashboard();
      if (response.success) {
        setData(response.data);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleClock = async (action: 'clock_in' | 'clock_out') => {
    setClockingIn(true);
    try {
      const result = await api.employeePortal.clock(action);
      if (result.success) {
        toast.success(result.message);
        fetchDashboard();
        if (action === 'clock_out') setShowHeatmap(true);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Failed to clock in/out');
    } finally {
      setClockingIn(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const isClockedIn = data?.clockStatus && !data.clockStatus.clock_out;

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: Home },
    { id: 'schedule', label: 'Schedule', icon: Calendar },
    { id: 'tasks', label: 'Tasks', icon: ClipboardList },
    { id: 'leave', label: 'Time Off', icon: Briefcase },
    { id: 'payslips', label: 'Pay', icon: DollarSign },
    { id: 'training', label: 'Training', icon: GraduationCap },
    { id: 'id_card', label: 'ID Card', icon: IDCardIcon },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  const payslipsCount = data?.payslips?.length || 0;
  return (
    <div className="min-h-screen bg-neutral-50/30">
      {/* Header */}
      <header className="border-b border-neutral-100 sticky top-0 z-50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-10 h-10 relative">
                  <Image src="/fglogo.png" alt="FG" fill className="object-contain" priority />
                </div>
                <div className="hidden sm:block">
                  <span className="font-black text-neutral-900 leading-tight block">Kyogong</span>
                  <span className="text-[10px] uppercase tracking-tighter text-neutral-500 font-bold -mt-1 block">Staff Portal</span>
                </div>
              </div>
              <nav className="hidden lg:flex items-center gap-1 ml-4 border-l border-neutral-100 pl-4">
                {navItems.slice(0, 7).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-lg transition-all ${activeTab === item.id
                      ? 'bg-neutral-900 text-white shadow-lg shadow-neutral-200'
                      : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                      }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative p-2 hover:bg-neutral-50 rounded-lg transition-colors">
                <Bell className="w-[18px] h-[18px] text-neutral-500" />
                {(data?.announcements?.length || 0) > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-neutral-900 rounded-full" />
                )}
              </button>
              <div className="h-5 w-px bg-neutral-200" />
              <button
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-2 hover:bg-neutral-50 rounded-lg px-2 py-1.5 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center overflow-hidden">
                  {user?.profilePhoto ? (
                    <Image src={user.profilePhoto} alt="Avatar" width={28} height={28} className="object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-neutral-600">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </span>
                  )}
                </div>
                <span className="text-sm text-neutral-700 hidden sm:block font-medium">{user?.firstName}</span>
                <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-neutral-50 rounded-lg transition-colors text-neutral-400 hover:text-red-600"
                title="Sign out"
              >
                <LogOut className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden border-b border-neutral-100 bg-white overflow-x-auto sticky top-16 z-40">
        <div className="flex px-4 py-3 gap-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`px-3 py-1.5 text-[10px] font-black uppercase whitespace-nowrap rounded-lg transition-all ${activeTab === item.id
                ? 'bg-neutral-900 text-white shadow-md'
                : 'text-neutral-500 bg-neutral-50'
                }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-10">
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight">
            Welcome back, {user?.firstName}!
          </h1>
          <p className="text-neutral-500 font-medium mt-1 uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
            Your Workspace
            <span className="w-1 h-1 rounded-full bg-neutral-300" />
            Manage your professional information
          </p>
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Time Clock Section */}
            <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center">
                    <Clock className="w-8 h-8 text-neutral-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-1">
                      {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    <div className="flex items-baseline gap-4">
                      <span className="text-5xl font-black text-neutral-900 tabular-nums tracking-tighter">
                        {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      {isClockedIn && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
                          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-bold uppercase">Started {formatTime(data.clockStatus.clock_in)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isClockedIn ? (
                    <button
                      onClick={() => handleClock('clock_out')}
                      disabled={clockingIn}
                      className="px-8 py-4 bg-white border border-neutral-200 text-neutral-900 rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-neutral-50 transition-all disabled:opacity-50 flex items-center gap-3 shadow-sm active:scale-95"
                    >
                      {clockingIn ? <Loader2 className="w-4 h-4 animate-spin text-neutral-400" /> : <Square className="w-4 h-4" />}
                      Clock Out
                    </button>
                  ) : (
                    <button
                      onClick={() => handleClock('clock_in')}
                      disabled={clockingIn}
                      className="px-8 py-4 bg-neutral-900 text-white rounded-xl text-sm font-bold uppercase tracking-widest hover:bg-neutral-800 transition-all disabled:opacity-50 flex items-center gap-3 shadow-xl shadow-neutral-200 active:scale-95"
                    >
                      {clockingIn ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Clock In
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Stats Row */}
            <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Open Tasks', val: data?.tasks?.length || 0, tab: 'tasks', icon: ClipboardList, color: 'text-blue-600' },
                { label: 'Upcoming Shifts', val: data?.schedules?.length || 0, tab: 'schedule', icon: Calendar, color: 'text-emerald-600' },
                { label: 'Leave Balance', val: data?.leaveBalance?.remaining || 21, tab: 'leave', icon: Briefcase, color: 'text-orange-600' },
                { label: 'Payslips', val: payslipsCount || 0, tab: 'payslips', icon: DollarSign, color: 'text-purple-600' }
              ].map((stat, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(stat.tab)}
                  className="bg-white p-6 border border-neutral-200 rounded-2xl text-left hover:border-neutral-300 transition-all group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2 rounded-lg bg-neutral-50 ${stat.color} group-hover:scale-110 transition-transform`}>
                      <stat.icon className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-4 h-4 text-neutral-300 group-hover:translate-x-1 transition-transform" />
                  </div>
                  <p className="text-3xl font-black text-neutral-900 tracking-tight">{stat.val}</p>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mt-1">{stat.label}</p>
                </button>
              ))}
            </section>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Tasks */}
              <section className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-6 py-4 bg-neutral-50/50 border-b border-neutral-100 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-neutral-900 uppercase tracking-widest">Active Tasks</h2>
                  <button onClick={() => setActiveTab('tasks')} className="text-xs font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest">
                    View all
                  </button>
                </div>
                <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100">
                  {data?.tasks && data.tasks.length > 0 ? (
                    data.tasks.slice(0, 5).map((task: any) => (
                      <div key={task.id} className="p-4 flex items-start gap-3">
                        <button className="mt-0.5 w-4 h-4 border border-neutral-300 rounded hover:border-neutral-400 transition-colors flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-neutral-900">{task.title}</p>
                          {task.due_date && (
                            <p className="text-xs text-neutral-500 mt-0.5">Due {formatDate(task.due_date)}</p>
                          )}
                        </div>
                        {task.priority === 'urgent' && (
                          <span className="text-xs text-neutral-900 bg-neutral-100 px-2 py-0.5 rounded font-medium">Urgent</span>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Check className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-sm text-neutral-500">All caught up</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Schedule */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-neutral-900">This Week</h2>
                  <button onClick={() => setActiveTab('schedule')} className="text-sm text-neutral-500 hover:text-neutral-700">
                    Full schedule
                  </button>
                </div>
                <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100">
                  {data?.schedules && data.schedules.length > 0 ? (
                    data.schedules.slice(0, 5).map((schedule: any) => (
                      <div key={schedule.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-center w-10">
                            <p className="text-xs text-neutral-500 uppercase">
                              {new Date(schedule.date).toLocaleDateString('en-US', { weekday: 'short' })}
                            </p>
                            <p className="text-lg font-semibold text-neutral-900">
                              {new Date(schedule.date).getDate()}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-neutral-900 capitalize">{schedule.shift} shift</p>
                            <p className="text-xs text-neutral-500">{schedule.notes || 'Regular hours'}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <Calendar className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                      <p className="text-sm text-neutral-500">No shifts scheduled</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Announcements */}
            {data?.announcements && data.announcements.length > 0 && (
              <section>
                <h2 className="text-sm font-medium text-neutral-900 mb-4">Announcements</h2>
                <div className="space-y-3">
                  {data.announcements.map((announcement: any) => (
                    <div key={announcement.id} className="p-4 border border-neutral-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        {announcement.priority === 'urgent' && (
                          <AlertCircle className="w-4 h-4 text-neutral-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-4">
                            <h3 className="text-sm font-medium text-neutral-900">{announcement.title}</h3>
                            <span className="text-xs text-neutral-400">{formatDate(announcement.published_at)}</span>
                          </div>
                          <p className="text-sm text-neutral-600 mt-1">{announcement.content}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {activeTab === 'schedule' && <ScheduleTab />}
        {activeTab === 'tasks' && <TasksTab onRefresh={fetchDashboard} />}
        {activeTab === 'leave' && <LeaveTab leaveBalance={data?.leaveBalance} />}
        {activeTab === 'payslips' && <PayslipsTab />}
        {activeTab === 'training' && <TrainingTab />}
        {
          activeTab === 'id_card' && (
            <div className="max-w-2xl mx-auto">
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-neutral-900">Digital Identity</h1>
                <p className="text-neutral-500">View and management your official Kyogong staff ID card.</p>
              </div>
              <IDCardWidget user={user} />
            </div>
          )
        }
        {activeTab === 'profile' && <ProfileTab user={user} profile={data?.profile} />}
      </main>
      <Dialog open={showHeatmap} onOpenChange={setShowHeatmap}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Your Attendance Overview</DialogTitle>
          </DialogHeader>
          {user && <YearlyAttendanceHeatmap staffId={user.id} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Schedule Tab Component
function ScheduleTab() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const response = await api.employeePortal.getSchedules({
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        });
        if (response.success) {
          setSchedules(response.data || []);
        }
      } catch (error) {
        console.error('Error fetching schedules:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedules();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Schedule</h1>
          <p className="text-sm text-neutral-500">Your upcoming shifts for the next 30 days</p>
        </div>
        <div className="flex items-center gap-2 border border-neutral-200 rounded-lg p-1">
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${viewMode === 'list' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500'}`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${viewMode === 'calendar' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500'}`}
          >
            Calendar
          </button>
        </div>
      </div>

      <div className="border border-neutral-200 rounded-lg overflow-hidden">
        {schedules.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {schedules.map((schedule) => (
              <div key={schedule.id} className="p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 text-center">
                    <p className="text-xs text-neutral-500 uppercase">
                      {new Date(schedule.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                    <p className="text-xl font-semibold text-neutral-900">
                      {new Date(schedule.date).getDate()}
                    </p>
                  </div>
                  <div className="h-10 w-px bg-neutral-200" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">
                      {new Date(schedule.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-sm text-neutral-500">{schedule.notes || 'Regular shift'}</p>
                  </div>
                </div>
                <span className="text-sm text-neutral-600 capitalize">{schedule.shift} shift</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Calendar className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">No shifts scheduled</p>
            <p className="text-xs text-neutral-400 mt-1">Check back later for updates</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Tasks Tab Component
function TasksTab({ onRefresh }: { onRefresh: () => void }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  const fetchTasks = useCallback(async () => {
    try {
      const response = await api.employeePortal.getTasks();
      if (response.success) {
        setTasks(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const updateTaskStatus = async (taskId: string, status: string) => {
    setUpdating(taskId);
    try {
      const response = await api.employeePortal.updateTask(taskId, { status });
      if (response.success) {
        toast.success('Task updated');
        fetchTasks();
        onRefresh();
      }
    } catch (error) {
      toast.error('Failed to update task');
    } finally {
      setUpdating(null);
    }
  };

  const filteredTasks = filter === 'all' ? tasks : tasks.filter(t => t.status === filter);
  const counts = {
    all: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Tasks</h1>
          <p className="text-sm text-neutral-500">{counts.pending + counts.in_progress} tasks need attention</p>
        </div>
        <button
          onClick={fetchTasks}
          className="p-2 hover:bg-neutral-100 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-neutral-500" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(['all', 'pending', 'in_progress', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${filter === f
              ? 'border-neutral-900 text-neutral-900 font-medium'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
          >
            {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 text-xs text-neutral-400">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="border border-neutral-200 rounded-lg overflow-hidden">
        {filteredTasks.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {filteredTasks.map((task) => (
              <div key={task.id} className="p-4 hover:bg-neutral-50 transition-colors">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => task.status !== 'completed' && updateTaskStatus(task.id, 'completed')}
                    disabled={updating === task.id || task.status === 'completed'}
                    className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors flex-shrink-0 ${task.status === 'completed'
                      ? 'bg-neutral-900 border-neutral-900'
                      : 'border-neutral-300 hover:border-neutral-400'
                      }`}
                  >
                    {task.status === 'completed' && <Check className="w-3 h-3 text-white" />}
                    {updating === task.id && <Loader2 className="w-3 h-3 animate-spin text-neutral-400" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${task.status === 'completed' ? 'text-neutral-400 line-through' : 'text-neutral-900'}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-sm text-neutral-500 mt-1">{task.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      {task.due_date && (
                        <span className="text-xs text-neutral-500">
                          Due {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {task.priority === 'urgent' && (
                        <span className="text-xs text-neutral-900 font-medium">Urgent</span>
                      )}
                      {task.priority === 'high' && (
                        <span className="text-xs text-neutral-600">High priority</span>
                      )}
                    </div>
                  </div>
                  {task.status === 'pending' && (
                    <button
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                      disabled={updating === task.id}
                      className="text-xs text-neutral-500 hover:text-neutral-700 px-2 py-1 hover:bg-neutral-100 rounded transition-colors"
                    >
                      Start
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Check className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">
              {filter === 'all' ? 'No tasks assigned' : `No ${filter.replace('_', ' ')} tasks`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Leave Tab Component
function LeaveTab({ leaveBalance }: { leaveBalance: any }) {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    leave_type: 'annual',
    start_date: '',
    end_date: '',
    reason: ''
  });

  useEffect(() => {
    const fetchLeaves = async () => {
      try {
        const response = await api.employeePortal.getLeaveRequests();
        if (response.success) {
          setLeaves(response.data || []);
        }
      } catch (error) {
        console.error('Error fetching leaves:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaves();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await api.employeePortal.requestLeave(formData);
      if (response.success) {
        toast.success('Leave request submitted');
        setShowForm(false);
        setLeaves([response.data, ...leaves]);
        setFormData({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      toast.error('Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  const total = leaveBalance?.total || 21;
  const used = leaveBalance?.used || 0;
  const remaining = leaveBalance?.remaining || 21;
  const usedPercent = (used / total) * 100;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Time Off</h1>
          <p className="text-sm text-neutral-500">Manage your leave requests</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Request Time Off
        </button>
      </div>

      {/* Balance Overview */}
      <div className="border border-neutral-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-neutral-500">Annual Leave Balance</span>
          <span className="text-sm font-medium text-neutral-900">{remaining} of {total} days remaining</span>
        </div>
        <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
          <div className="h-full bg-neutral-900 rounded-full transition-all" style={{ width: `${usedPercent}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs text-neutral-500">
          <span>{used} days used</span>
          <span>{remaining} days available</span>
        </div>
      </div>

      {/* Request Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <h2 className="font-semibold text-neutral-900">Request Time Off</h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-neutral-100 rounded">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
                <select
                  value={formData.leave_type}
                  onChange={(e) => setFormData({ ...formData, leave_type: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                >
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="maternity">Maternity Leave</option>
                  <option value="paternity">Paternity Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Start</label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">End</label>
                  <input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Notes (optional)</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                  placeholder="Any additional details..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 px-4 py-2 border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave History */}
      <div>
        <h2 className="text-sm font-medium text-neutral-900 mb-4">Request History</h2>
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          {leaves.length > 0 ? (
            <div className="divide-y divide-neutral-100">
              {leaves.map((leave) => (
                <div key={leave.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-neutral-900 capitalize">
                      {leave.leave_type?.replace('_', ' ')} Leave
                    </p>
                    <p className="text-sm text-neutral-500">
                      {new Date(leave.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(leave.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded capitalize ${leave.status === 'approved' ? 'bg-neutral-900 text-white' :
                    leave.status === 'rejected' ? 'bg-neutral-200 text-neutral-600' :
                      leave.status === 'cancelled' ? 'bg-neutral-100 text-neutral-500' :
                        'bg-neutral-100 text-neutral-700'
                    }`}>
                    {leave.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <Briefcase className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm text-neutral-500">No leave requests yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Payslips Tab Component
function PayslipsTab() {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayslip, setSelectedPayslip] = useState<any>(null);

  useEffect(() => {
    const fetchPayslips = async () => {
      try {
        const response = await api.employeePortal.getPayslips();
        if (response.success) {
          setPayslips(response.data || []);
        }
      } catch (error) {
        console.error('Error fetching payslips:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPayslips();
  }, []);

  const getMonthName = (month: number) => {
    return new Date(2000, month - 1).toLocaleString('default', { month: 'long' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Pay</h1>
        <p className="text-sm text-neutral-500">View and download your payslips</p>
      </div>

      {/* Payslip Detail Modal */}
      {selectedPayslip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-neutral-100">
              <h2 className="font-semibold text-neutral-900">
                {getMonthName(selectedPayslip.month)} {selectedPayslip.year}
              </h2>
              <button onClick={() => setSelectedPayslip(null)} className="p-1 hover:bg-neutral-100 rounded">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-sm text-neutral-500">Gross Salary</span>
                <span className="text-sm font-medium text-neutral-900">KES {(selectedPayslip.gross_salary || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-sm text-neutral-500">PAYE</span>
                <span className="text-sm text-neutral-600">- KES {(selectedPayslip.paye || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-sm text-neutral-500">NHIF</span>
                <span className="text-sm text-neutral-600">- KES {(selectedPayslip.nhif || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-neutral-100">
                <span className="text-sm text-neutral-500">NSSF</span>
                <span className="text-sm text-neutral-600">- KES {(selectedPayslip.nssf || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-3 bg-neutral-50 rounded-lg px-3">
                <span className="font-medium text-neutral-900">Net Pay</span>
                <span className="font-semibold text-neutral-900">KES {(selectedPayslip.net_salary || 0).toLocaleString()}</span>
              </div>
            </div>
            <div className="p-4 border-t border-neutral-100">
              <button className="w-full px-4 py-2 border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border border-neutral-200 rounded-lg overflow-hidden">
        {payslips.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {payslips.map((payslip) => (
              <button
                key={payslip.id}
                onClick={() => setSelectedPayslip(payslip)}
                className="w-full p-4 flex items-center justify-between hover:bg-neutral-50 transition-colors text-left"
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">{getMonthName(payslip.month)} {payslip.year}</p>
                  <p className="text-sm text-neutral-500">Paid {payslip.payment_date ? new Date(payslip.payment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-neutral-900">KES {(payslip.net_salary || 0).toLocaleString()}</p>
                  <span className={`text-xs capitalize ${payslip.status === 'paid' ? 'text-neutral-900' : 'text-neutral-500'
                    }`}>
                    {payslip.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <DollarSign className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">No payslips available yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Training Tab Component
function TrainingTab() {
  const [training, setTraining] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    const fetchTraining = async () => {
      try {
        const response = await api.employeePortal.getTraining();
        if (response.success) {
          setTraining(response.data || []);
        }
      } catch (error) {
        console.error('Error fetching training:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTraining();
  }, []);

  const filteredTraining = filter === 'all' ? training : training.filter(t => t.status === filter);
  const completedCount = training.filter(t => t.status === 'completed').length;
  const totalCount = training.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-neutral-900">Training</h1>
        <p className="text-sm text-neutral-500">Complete required training and certifications</p>
      </div>

      {/* Progress Overview */}
      {totalCount > 0 && (
        <div className="border border-neutral-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-neutral-500">Training Progress</span>
            <span className="text-sm font-medium text-neutral-900">{completedCount} of {totalCount} completed</span>
          </div>
          <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-neutral-900 rounded-full transition-all"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(['all', 'pending', 'in_progress', 'completed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors ${filter === f
              ? 'border-neutral-900 text-neutral-900 font-medium'
              : 'border-transparent text-neutral-500 hover:text-neutral-700'
              }`}
          >
            {f === 'all' ? 'All' : f === 'in_progress' ? 'In Progress' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="border border-neutral-200 rounded-lg overflow-hidden">
        {filteredTraining.length > 0 ? (
          <div className="divide-y divide-neutral-100">
            {filteredTraining.map((item) => (
              <div key={item.id} className="p-4 hover:bg-neutral-50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-neutral-900">{item.training_name}</p>
                    <p className="text-sm text-neutral-500 capitalize mt-0.5">{item.training_type}</p>
                    <div className="flex items-center gap-3 mt-2">
                      {item.due_date && (
                        <span className="text-xs text-neutral-500">
                          Due {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {item.score && (
                        <span className="text-xs text-neutral-600">Score: {item.score}%</span>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded capitalize ${item.status === 'completed' ? 'bg-neutral-900 text-white' :
                    item.status === 'in_progress' ? 'bg-neutral-200 text-neutral-700' :
                      item.status === 'expired' ? 'bg-neutral-100 text-neutral-500' :
                        'bg-neutral-100 text-neutral-700'
                    }`}>
                    {item.status?.replace('_', ' ')}
                  </span>
                </div>
                {item.status !== 'completed' && (
                  <button className="mt-3 text-sm text-neutral-600 hover:text-neutral-900 font-medium">
                    Start Training →
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <GraduationCap className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500">
              {filter === 'all' ? 'No training assigned' : `No ${filter.replace('_', ' ')} training`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Profile Tab Component
function ProfileTab({ user, profile }: { user: any; profile: any }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    phone_number: user?.phone_number || '',
    address: user?.address || '',
    emergency_contact: profile?.emergency_contact || ''
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await api.employeePortal.updateProfile(formData);
      if (response.success) {
        toast.success('Profile updated');
        setEditing(false);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">Profile</h1>
          <p className="text-sm text-neutral-500">Manage your personal information</p>
        </div>
        {editing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-neutral-600 hover:text-neutral-900 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 border border-neutral-200 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {/* Profile Header */}
      <div className="border border-neutral-200 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-neutral-200 flex items-center justify-center">
            <span className="text-xl font-medium text-neutral-600">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">{user?.firstName} {user?.lastName}</h2>
            <p className="text-sm text-neutral-500 capitalize">{profile?.department || 'Employee'} · {profile?.role || user?.role || 'Staff'}</p>
            <p className="text-sm text-neutral-400">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Employment Info */}
      <div className="border border-neutral-200 rounded-lg">
        <div className="px-4 py-3 border-b border-neutral-100">
          <h3 className="text-sm font-medium text-neutral-900">Employment</h3>
        </div>
        <div className="divide-y divide-neutral-100">
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-neutral-500">Employee ID</span>
            <span className="text-sm text-neutral-900">{profile?.id_number || '—'}</span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-neutral-500">Department</span>
            <span className="text-sm text-neutral-900 capitalize">{profile?.department || '—'}</span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-neutral-500">Shift</span>
            <span className="text-sm text-neutral-900 capitalize">{profile?.shift || '—'}</span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-neutral-500">Start Date</span>
            <span className="text-sm text-neutral-900">
              {profile?.start_date ? new Date(profile.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '—'}
            </span>
          </div>
          <div className="px-4 py-3 flex justify-between">
            <span className="text-sm text-neutral-500">Status</span>
            <span className="text-xs px-2 py-0.5 bg-neutral-900 text-white rounded capitalize">{profile?.status || 'Active'}</span>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="border border-neutral-200 rounded-lg">
        <div className="px-4 py-3 border-b border-neutral-100">
          <h3 className="text-sm font-medium text-neutral-900">Contact Information</h3>
        </div>
        <div className="divide-y divide-neutral-100">
          <div className="px-4 py-3">
            <label className="text-sm text-neutral-500 block mb-1">Phone</label>
            {editing ? (
              <input
                type="tel"
                value={formData.phone_number}
                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="Enter phone number"
              />
            ) : (
              <p className="text-sm text-neutral-900">{formData.phone_number || '—'}</p>
            )}
          </div>
          <div className="px-4 py-3">
            <label className="text-sm text-neutral-500 block mb-1">Emergency Contact</label>
            {editing ? (
              <input
                type="text"
                value={formData.emergency_contact}
                onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-900 focus:border-transparent"
                placeholder="Name and phone number"
              />
            ) : (
              <p className="text-sm text-neutral-900">{formData.emergency_contact || '—'}</p>
            )}
          </div>
          <div className="px-4 py-3">
            <label className="text-sm text-neutral-500 block mb-1">Address</label>
            {editing ? (
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-none"
                placeholder="Enter your address"
              />
            ) : (
              <p className="text-sm text-neutral-900">{formData.address || '—'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
