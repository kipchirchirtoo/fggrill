'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useBranch } from '../../hooks/useBranch';
import { financeAPI, bookingsAPI, staffAPI, housekeepingAPI, notificationsAPI } from '../../services/api/api';
import {
  DollarSign, Users, Bed, TrendingUp, RefreshCw, Calendar,
  UserCheck, Utensils, Wrench, Package, ClipboardList, ArrowUpRight, ArrowDownRight,
  ChevronRight, Clock, Building2, Plus, AlertTriangle, CheckCircle, Info, Eye
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { toast } from 'sonner';

export function BranchManagerDashboard() {
  const { session } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [stats, setStats] = useState({ 
    occupancy: 0, 
    staff: 0, 
    pendingTasks: 0, 
    arrivals: 0, 
    departures: 0, 
    totalRooms: 0, 
    occupiedRooms: 0 
  });
  const [isLoading, setIsLoading] = useState(true);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    const currentBranchId = Number(activeBranchId);
    if (!currentBranchId) return;

    setIsLoading(true);
    try {
      const [financeRes, bookingsRes, staffRes, tasksRes, notificationsRes] = await Promise.allSettled([
        financeAPI.getDashboard(currentBranchId),
        bookingsAPI.getBookings({ branch_id: currentBranchId }),
        staffAPI.getStaff(currentBranchId),
        housekeepingAPI.getTasks({ branch_id: currentBranchId }),
        notificationsAPI.getNotifications(),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const bookings = bookingsRes.status === 'fulfilled' ? (bookingsRes.value as any).data || [] : [];
      setRecentBookings(bookings.slice(0, 5));

      const checkedInBookings = bookings.filter((b: any) => b.status === 'checked_in').length;

      setStats({
        occupancy: 0, 
        staff: staffRes.status === 'fulfilled' ? (staffRes.value as any).data?.length || 0 : 0,
        pendingTasks: tasksRes.status === 'fulfilled' ? ((tasksRes.value as any).data || []).filter((t: any) => t.status === 'pending').length : 0,
        arrivals: bookings.filter((b: any) => b.check_in?.startsWith(today)).length,
        departures: bookings.filter((b: any) => b.check_out?.startsWith(today)).length,
        totalRooms: 0,
        occupiedRooms: checkedInBookings,
      });

      if (notificationsRes.status === 'fulfilled' && (notificationsRes.value as any).data?.length > 0) {
        setAlerts((notificationsRes.value as any).data.slice(0, 5));
      }
    } catch (error) { 
      console.error('Error fetching branch manager data:', error); 
    } finally { 
      setIsLoading(false); 
    }
  }, [activeBranchId]);

  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);

  const quickLinks = [
    { label: 'Reservations', icon: Calendar },
    { label: 'Rooms', icon: Bed },
    { label: 'Staff', icon: Users },
    { label: 'Housekeeping', icon: ClipboardList },
    { label: 'Inventory', icon: Package },
  ];

  return (
    <div className="h-full bg-stone-50 overflow-y-auto no-scrollbar p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-stone-900 flex items-center justify-center text-white shadow-xl">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-stone-900 tracking-tight">Branch Manager</h1>
              <p className="text-stone-500 text-sm font-medium">{activeBranch?.name || 'Local Operations'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button className="h-11 px-6 rounded-xl bg-stone-900 text-white font-bold text-sm flex items-center gap-2 hover:bg-black transition-all shadow-lg active:scale-95">
                <Plus className="h-4 w-4" />
                <span>Action</span>
             </button>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="h-11 px-6 rounded-xl bg-white border border-stone-200 font-bold text-sm flex items-center gap-2 hover:bg-stone-50 transition-all shadow-sm"
            >
              <RefreshCw className={cn("h-4 w-4 text-stone-600", isLoading && "animate-spin")} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: 'Staff', value: stats.staff, icon: Users },
            { label: 'Tasks', value: stats.pendingTasks, icon: ClipboardList },
            { label: 'Arrivals', value: stats.arrivals, icon: ArrowUpRight },
            { label: 'Departures', value: stats.departures, icon: ArrowDownRight },
            { label: 'Occupancy', value: '0%', icon: Bed }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm transition-transform hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2 rounded-xl bg-stone-50 text-stone-600">
                  <stat.icon className="h-5 w-5" />
                </div>
              </div>
              <p className="text-2xl font-black text-stone-900 tracking-tighter">{stat.value}</p>
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Quick Access */}
        <div className="bg-white border border-stone-200 rounded-[2.5rem] p-8 shadow-sm">
           <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {quickLinks.map((link, i) => (
                <div key={i} className="group cursor-pointer">
                  <div className="h-32 rounded-[2rem] bg-stone-50 border border-stone-100 flex flex-col items-center justify-center gap-3 group-hover:bg-stone-900 group-hover:border-stone-900 transition-all active:scale-95">
                    <link.icon className="h-6 w-6 text-stone-600 group-hover:text-white transition-colors" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-stone-900 group-hover:text-white transition-colors">{link.label}</p>
                  </div>
                </div>
              ))}
           </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Recent Bookings Feed */}
          <div className="lg:col-span-2 bg-white border border-stone-200 rounded-[2.5rem] p-8 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">Recent Activity</h2>
              <button className="text-[10px] font-black text-stone-900 hover:underline tracking-widest uppercase">View All</button>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-stone-100">
                    <th className="pb-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Guest</th>
                    <th className="pb-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Status</th>
                    <th className="pb-4 text-[10px] font-black text-stone-400 uppercase tracking-widest">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {recentBookings.length > 0 ? recentBookings.map((booking, i) => (
                    <tr key={i} className="group hover:bg-stone-50/50 transition-colors">
                      <td className="py-4">
                         <p className="text-sm font-bold text-stone-900">{booking.guest_name || 'Walk-in Guest'}</p>
                         <p className="text-[10px] text-stone-400 font-medium">Room {booking.room_number || '-'}</p>
                      </td>
                      <td className="py-4">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-stone-100 text-[10px] font-black text-stone-600 uppercase tracking-widest">
                          {booking.status}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                         <button className="p-2 rounded-xl bg-stone-50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="h-4 w-4 text-stone-400" />
                         </button>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="py-12 text-center text-stone-300 italic text-xs">No recent activity found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Alerts Feed */}
          <div className="bg-white border border-stone-200 rounded-[2.5rem] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xs font-black text-stone-400 uppercase tracking-[0.2em]">Live Alerts</h2>
              <Info className="h-4 w-4 text-stone-300" />
            </div>
            <div className="space-y-6">
               {alerts.length > 0 ? alerts.map((alert, i) => (
                 <div key={i} className="flex gap-4">
                    <div className="w-1 h-8 rounded-full bg-amber-400 mt-1" />
                    <div>
                      <p className="text-sm font-bold text-stone-900 leading-tight">{alert.title || alert.message}</p>
                      <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest mt-1">Recently</p>
                    </div>
                 </div>
               )) : (
                 <div className="py-12 text-center opacity-20 flex flex-col items-center gap-3">
                    <CheckCircle className="h-10 w-10" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Zero Critical Alerts</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
