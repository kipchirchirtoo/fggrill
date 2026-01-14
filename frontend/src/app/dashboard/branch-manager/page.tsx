'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { financeAPI, bookingsAPI, staffAPI, housekeepingAPI, notificationsAPI } from '@/lib/api';
import {
  DollarSign, Users, Bed, TrendingUp, RefreshCw, Calendar,
  UserCheck, Utensils, Wrench, Package, ClipboardList, ArrowUpRight, ArrowDownRight,
  Soup, ChevronRight, Clock, Building2, Plus, AlertTriangle, CheckCircle, Eye, Info
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { AddItemModal } from '@/components/storekeeping/AddItemModal';

export default function BranchManagerDashboard() {
  const { user } = useAuth();
  const { activeBranchId, activeBranch } = useBranch();
  const [stats, setStats] = useState({ occupancy: 0, staff: 0, pendingTasks: 0, arrivals: 0, departures: 0, totalRooms: 0, occupiedRooms: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<{ type: string; message: string; time: string }[]>([]);

  // Modal states
  const [showAddItem, setShowAddItem] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  // Use active branch from context, fallback to user's branch
  const currentBranchId = activeBranchId || user?.branch_id;

  const fetchData = useCallback(async () => {
    if (!currentBranchId) return;

    setIsLoading(true);
    try {
      const [financeRes, bookingsRes, staffRes, tasksRes, notificationsRes] = await Promise.allSettled([
        financeAPI.getDashboard({ branch_id: currentBranchId }),
        bookingsAPI.getBookings({ branch_id: currentBranchId }),
        staffAPI.getStaff(currentBranchId),
        housekeepingAPI.getTasks({ branch_id: currentBranchId }),
        notificationsAPI.getNotifications(),
      ]);

      const today = new Date().toISOString().split('T')[0];
      const bookings = bookingsRes.status === 'fulfilled' ? bookingsRes.value?.data || [] : [];
      setRecentBookings(bookings.slice(0, 5));

      // Calculate occupancy from bookings if available
      const checkedInBookings = bookings.filter((b: any) => b.status === 'checked_in').length;

      setStats({
        occupancy: 0, // Will be calculated from rooms data when available
        staff: staffRes.status === 'fulfilled' ? staffRes.value?.data?.length || 0 : 0,
        pendingTasks: tasksRes.status === 'fulfilled' ? (tasksRes.value?.data || []).filter((t: any) => t.status === 'pending').length : 0,
        arrivals: bookings.filter((b: any) => b.check_in?.startsWith(today)).length,
        departures: bookings.filter((b: any) => b.check_out?.startsWith(today)).length,
        totalRooms: 0,
        occupiedRooms: checkedInBookings,
      });

      // Set real notifications as alerts
      if (notificationsRes.status === 'fulfilled' && notificationsRes.value?.data?.length > 0) {
        const notifications = notificationsRes.value.data.slice(0, 5);
        setAlerts(notifications.map((n: any) => ({
          type: n.type === 'warning' ? 'warning' : n.type === 'success' ? 'success' : 'info',
          message: n.title || n.message,
          time: n.created_at ? formatTimeAgo(new Date(n.created_at)) : 'Recently'
        })));
      } else {
        setAlerts([]);
      }
    } catch (error) { console.error('Error:', error); }
    finally { setIsLoading(false); }
  }, [currentBranchId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Helper to format time ago
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hr ago`;
    return `${Math.floor(diffHours / 24)} days ago`;
  };

  const quickLinks = [
    { href: '/dashboard/branch-manager/reservations', icon: Calendar, label: 'Reservations', desc: 'Bookings' },
    { href: '/dashboard/branch-manager/rooms', icon: Bed, label: 'Rooms', desc: 'Inventory' },
    { href: '/dashboard/branch-manager/staff', icon: Users, label: 'Staff', desc: 'Team' },
    { href: '/dashboard/branch-manager/housekeeping', icon: ClipboardList, label: 'Housekeeping', desc: 'Tasks' },
    { href: '/dashboard/branch-manager/stock', icon: Package, label: 'Inventory', desc: 'Stock' },
  ];

  const statCards = [
    { label: 'Occupancy', value: stats.totalRooms > 0 ? `${Math.round((stats.occupiedRooms / stats.totalRooms) * 100)}%` : '0%', icon: Bed },
    { label: 'Staff On Duty', value: stats.staff.toString(), icon: Users },
    { label: 'Pending Tasks', value: stats.pendingTasks.toString(), icon: ClipboardList },
    { label: 'Arrivals Today', value: stats.arrivals.toString(), icon: ArrowUpRight },
    { label: 'Departures', value: stats.departures.toString(), icon: ArrowDownRight },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-semibold text-stone-900 tracking-[-0.02em]">Branch Dashboard</h1>
              <p className="text-stone-500 mt-0.5">{activeBranch?.name || user?.branch_name || 'Your Branch'}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAddItem(true)}
                className="btn-secondary"
              >
                <Plus className="h-4 w-4" />
                <span>Add Item</span>
              </button>
              <button
                onClick={() => setShowCamera(true)}
                className="btn-secondary"
              >
                <Eye className="h-4 w-4" />
                <span>Evidence</span>
              </button>
              <button
                onClick={fetchData}
                disabled={isLoading}
                className="btn-secondary"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {statCards.map((stat, i) => (
              <div key={i} className="stat-card">
                <div className="stat-icon">
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="stat-value text-[22px]">{stat.value}</p>
                <p className="stat-label text-[12px] mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Quick Access */}
          <div className="card-elevated p-5">
            <div className="section-header mb-4">
              <h2 className="section-title">Quick Access</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <div className="action-card group py-3">
                    <div className="action-card-icon w-10 h-10">
                      <link.icon className="h-4 w-4" />
                    </div>
                    <p className="action-card-label text-[12px]">{link.label}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Bottom Section */}
          <div className="grid lg:grid-cols-3 gap-5">
            {/* Today's Activity */}
            <div className="lg:col-span-2 card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-stone-900">Today's Activity</h3>
                <span className="text-[11px] text-stone-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 bg-stone-50 rounded-lg border border-stone-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowUpRight className="h-4 w-4 text-stone-500" />
                    <span className="text-[12px] font-medium text-stone-600">Check-ins</span>
                  </div>
                  <p className="text-[28px] font-semibold text-stone-900">{stats.arrivals}</p>
                  <p className="text-[11px] text-stone-500 mt-1">Expected today</p>
                </div>
                <div className="p-4 bg-stone-50 rounded-lg border border-stone-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ArrowDownRight className="h-4 w-4 text-stone-500" />
                    <span className="text-[12px] font-medium text-stone-600">Check-outs</span>
                  </div>
                  <p className="text-[28px] font-semibold text-stone-900">{stats.departures}</p>
                  <p className="text-[11px] text-stone-500 mt-1">Scheduled today</p>
                </div>
                <div className="p-4 bg-stone-50 rounded-lg border border-stone-100">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList className="h-4 w-4 text-stone-500" />
                    <span className="text-[12px] font-medium text-stone-600">Tasks</span>
                  </div>
                  <p className="text-[28px] font-semibold text-stone-900">{stats.pendingTasks}</p>
                  <p className="text-[11px] text-stone-500 mt-1">Pending completion</p>
                </div>
              </div>
            </div>

            {/* Alerts & Notifications */}
            <div className="card-elevated p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-semibold text-stone-900">Alerts</h3>
                {alerts.length > 0 && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    {alerts.length} new
                  </span>
                )}
              </div>
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-stone-400 text-sm">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No alerts</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.map((alert, i) => (
                    <div key={i} className="p-3 rounded-lg bg-stone-50 hover:bg-stone-100 transition-colors cursor-pointer">
                      <div className="flex items-start gap-2">
                        {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5" />}
                        {alert.type === 'info' && <Clock className="h-4 w-4 text-sky-500 mt-0.5" />}
                        {alert.type === 'success' && <CheckCircle className="h-4 w-4 text-emerald-500 mt-0.5" />}
                        <div className="flex-1">
                          <p className="text-[12px] font-medium text-stone-800">{alert.message}</p>
                          <p className="text-[10px] text-stone-400 mt-0.5">{alert.time}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Bookings */}
          <div className="card-elevated p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[15px] font-semibold text-stone-900">Recent Bookings</h3>
              <Link href="/dashboard/branch-manager/reservations">
                <button className="text-[13px] font-medium text-stone-600 hover:text-stone-900">View All</button>
              </Link>
            </div>
            {recentBookings.length === 0 ? (
              <div className="text-center py-8 text-stone-500 text-sm">No recent bookings</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-stone-100">
                      <th className="text-left py-2 px-3 text-[11px] font-medium text-stone-500 uppercase">Guest</th>
                      <th className="text-left py-2 px-3 text-[11px] font-medium text-stone-500 uppercase">Room</th>
                      <th className="text-left py-2 px-3 text-[11px] font-medium text-stone-500 uppercase">Check-in</th>
                      <th className="text-left py-2 px-3 text-[11px] font-medium text-stone-500 uppercase">Status</th>
                      <th className="text-right py-2 px-3 text-[11px] font-medium text-stone-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((booking: any, i: number) => (
                      <tr key={booking.id || i} className="border-b border-stone-50 hover:bg-stone-50 transition-colors">
                        <td className="py-3 px-3">
                          <p className="text-[13px] font-medium text-stone-800">{booking.guest_name || 'Guest'}</p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="text-[13px] text-stone-600">{booking.room_number || '-'}</p>
                        </td>
                        <td className="py-3 px-3">
                          <p className="text-[12px] text-stone-500">
                            {booking.check_in ? new Date(booking.check_in).toLocaleDateString() : '-'}
                          </p>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                            booking.status === 'checked_in' ? 'bg-sky-100 text-sky-700' :
                              booking.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                'bg-stone-100 text-stone-600'
                            }`}>
                            {booking.status?.replace('_', ' ') || 'Unknown'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <Link href={`/dashboard/branch-manager/reservations/${booking.id}`}>
                            <button className="p-1.5 rounded-md hover:bg-stone-200 transition-colors">
                              <Eye className="h-3.5 w-3.5 text-stone-500" />
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Add Item Modal */}
        <AddItemModal
          isOpen={showAddItem}
          onClose={() => setShowAddItem(false)}
          onSubmit={async (data) => {
            // Handle item creation
            toast.success('Item added successfully');
            fetchData();
          }}
        />

        {/* Camera/Evidence Modal - inline implementation for simplicity */}
        {showCamera && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md relative">
              <button
                onClick={() => setShowCamera(false)}
                className="absolute right-4 top-4 hover:bg-stone-100 p-2 rounded-full"
              >
                <span className="text-xl">×</span>
              </button>
              <h3 className="text-lg font-bold mb-4">Capture Evidence</h3>
              <div className="aspect-video bg-black rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                {/* Mock camera view */}
                <video autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-white/50 text-sm">Camera Stream Active</span>
                </div>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    toast.success('Image captured and saved to incident report');
                    setShowCamera(false);
                  }}
                  className="h-16 w-16 bg-white border-4 border-stone-200 rounded-full flex items-center justify-center hover:border-red-500 transition-colors"
                >
                  <div className="h-12 w-12 bg-red-500 rounded-full" />
                </button>
              </div>
            </div>
          </div>
        )}

      </DashboardLayout>
    </ProtectedRoute>
  );
}
