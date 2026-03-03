'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { useBranch } from '@/lib/branch-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { BranchAwareDashboardLayout } from '@/components/layout/branch-aware-dashboard-layout';
import { BranchPageWrapper } from '@/components/branch/branch-page-wrapper';
import { Card } from '@/components/ui/minimal/card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { branchOperationsAPI } from '@/lib/branch-api';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  Building2, DollarSign, Users, Bed, TrendingUp, Clock, ChevronRight,
  UserCheck, Utensils, Wrench, Package, ClipboardList, ArrowUpRight,
  RefreshCw, Calendar, Boxes, Send
} from 'lucide-react';

function BranchOperationsDashboardContent() {
  const { user } = useAuth();
  const { activeBranch, activeBranchId } = useBranch();
  const [stats, setStats] = useState({
    occupancy: 0,
    staff: { total: 0, active: 0 },
    pendingTasks: 0,
    arrivals: 0,
    departures: 0,
    upcomingReservations: [] as any[]
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (activeBranchId) {
      fetchDashboardData();
    }
  }, [activeBranchId]);

  const [apiError, setApiError] = useState<any>(null);

  const fetchDashboardData = async () => {
    if (!activeBranchId) return;

    setIsLoading(true);
    setApiError(null);
    try {
      // console.log(`Fetching dashboard data with branch ID: ${activeBranchId}`);
      const response = await branchOperationsAPI.getDashboard(activeBranchId);

      // Debug response
      // console.log('API Response:', response);

      if (response.success) {
        setStats({
          occupancy: response.data?.stats?.rooms?.occupancyRate || 0,
          staff: {
            total: response.data?.stats?.staff?.total || 0,
            active: response.data?.stats?.staff?.onDuty || 0
          },
          pendingTasks: response.data?.stats?.requests?.pending || 0,
          arrivals: response.data?.stats?.reservations?.checkingInToday || 0,
          departures: response.data?.stats?.reservations?.checkingOutToday || 0,
          upcomingReservations: response.data?.upcomingReservations || []
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setApiError(error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const quickLinks = [
    { href: '/dashboard/branch-operations/inventory', icon: Package, label: 'Inventory', color: 'bg-blue-50 text-blue-600' },
    { href: '/dashboard/branch-operations/staff', icon: Users, label: 'Staff', color: 'bg-purple-50 text-purple-600' },
    { href: '/dashboard/branch-operations/operations/reservations', icon: Calendar, label: 'Reservations', color: 'bg-green-50 text-green-600' },
    { href: '/dashboard/branch-operations/operations/rooms', icon: Bed, label: 'Rooms', color: 'bg-indigo-50 text-indigo-600' },
    { href: '/dashboard/branch-operations/financials/reports', icon: TrendingUp, label: 'Reports', color: 'bg-pink-50 text-pink-600' },
    { href: '/dashboard/branch-operations/communications', icon: Send, label: 'Communications', color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <ProtectedRoute allowedRoles={[
      UserRole.BRANCH_OPERATIONS_MANAGER,
      UserRole.BRANCH_MANAGER,
      UserRole.BRANCH_STOREKEEPER,
      UserRole.SUPER_ADMIN,
      UserRole.GENERAL_MANAGER,
      UserRole.AUDITOR
    ]}>
      <BranchAwareDashboardLayout
        title="Branch Operations"
        subtitle={`Management dashboard for ${activeBranch?.name || 'your branch'}`}
        actionButton={
          <IOSButton variant="secondary" onClick={fetchDashboardData} leftIcon={<RefreshCw />}>
            Refresh
          </IOSButton>
        }
      >
        <div className="space-y-6">
          {apiError && (
            <IOSCard className="p-4 mb-4 bg-red-50 border-red-200">
              <h3 className="font-bold text-red-600 mb-2">API Error Occurred</h3>
              <pre className="text-xs overflow-auto p-2 bg-stone-50 rounded border">
                {JSON.stringify(apiError, null, 2)}
              </pre>
              <div className="mt-3">
                <p className="text-sm mb-2"><strong>Debug Info:</strong></p>
                <ul className="list-disc pl-5 text-xs text-stone-700">
                  <li>Branch ID: {activeBranchId}</li>
                  <li>Branch Name: {activeBranch?.name}</li>
                  <li>URL: {`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/branch-operations/dashboard`}</li>
                </ul>
                <IOSButton className="mt-3" onClick={fetchDashboardData} size="sm">Retry Request</IOSButton>
              </div>
            </IOSCard>
          )}
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <IOSCard className="p-4">
              <Bed className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm text-stone-500">Occupancy</p>
              <p className="text-lg font-bold">{stats.occupancy}%</p>
            </IOSCard>

            <IOSCard className="p-4">
              <Users className="h-5 w-5 text-purple-600 mb-2" />
              <p className="text-sm text-stone-500">Staff</p>
              <p className="text-lg font-bold">
                {stats.staff.active}/{stats.staff.total}
              </p>
            </IOSCard>

            <IOSCard className="p-4">
              <ClipboardList className="h-5 w-5 text-yellow-600 mb-2" />
              <p className="text-sm text-stone-500">Pending Tasks</p>
              <p className="text-lg font-bold text-yellow-600">{stats.pendingTasks}</p>
            </IOSCard>
          </div>

          {/* Second Row Stats */}
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4 max-w-md">
            <IOSCard className="p-4">
              <ArrowUpRight className="h-5 w-5 text-green-600 mb-2" />
              <p className="text-sm text-stone-500">Arrivals Today</p>
              <p className="text-lg font-bold text-green-600">{stats.arrivals}</p>
            </IOSCard>

            <IOSCard className="p-4">
              <UserCheck className="h-5 w-5 text-blue-600 mb-2" />
              <p className="text-sm text-stone-500">Departures Today</p>
              <p className="text-lg font-bold">{stats.departures}</p>
            </IOSCard>
          </div>

          {/* Quick Links */}
          <IOSCard className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold font-sf-pro-display">Quick Access</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
              {quickLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <IOSCard className={`p-4 hover:shadow-none transition cursor-pointer text-center ${link.color.split(' ')[0]}`}>
                    <link.icon className={`h-6 w-6 mx-auto mb-2 ${link.color.split(' ')[1]}`} />
                    <p className="text-sm font-medium">{link.label}</p>
                  </IOSCard>
                </Link>
              ))}
            </div>
          </IOSCard>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upcoming Reservations */}
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold font-sf-pro-display">Upcoming Reservations</h3>
                <Link href="/dashboard/branch-operations/operations/reservations">
                  <IOSButton variant="ghost" size="sm">
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </IOSButton>
                </Link>
              </div>

              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-16 bg-stone-100 rounded-lg"></div>
                  <div className="h-16 bg-stone-100 rounded-lg"></div>
                  <div className="h-16 bg-stone-100 rounded-lg"></div>
                </div>
              ) : stats.upcomingReservations && stats.upcomingReservations.length > 0 ? (
                <div className="space-y-2">
                  {stats.upcomingReservations.map((reservation: any) => {
                    const checkInDate = new Date(reservation.check_in_date);
                    const checkOutDate = new Date(reservation.check_out_date);
                    const isToday = checkInDate.toDateString() === new Date().toDateString();
                    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

                    return (
                      <div key={reservation.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between">
                          <div>
                            <p className="font-medium">{reservation.guest_name}</p>
                            <p className="text-sm text-stone-500">
                              {reservation.room_type} {reservation.room_number ? `#${reservation.room_number}` : ''} • {nights} {nights === 1 ? 'night' : 'nights'}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-stone-700">
                              {checkInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {checkOutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                            {isToday && <p className="text-xs text-blue-600">Check-in today</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Calendar className="h-12 w-12 text-stone-300 mx-auto mb-2" />
                  <p className="text-stone-500 text-sm">No upcoming reservations</p>
                  <Link href="/dashboard/branch-operations/operations/reservations">
                    <IOSButton variant="secondary" size="sm" className="mt-3">
                      Create Reservation
                    </IOSButton>
                  </Link>
                </div>
              )}
            </IOSCard>

            {/* Pending Stock Items */}
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold font-sf-pro-display">Recent Operations</h3>
                <Link href="/dashboard/branch-operations/communications">
                  <IOSButton variant="ghost" size="sm">
                    View Communications <ChevronRight className="h-4 w-4 ml-1" />
                  </IOSButton>
                </Link>
              </div>
              <div className="text-center py-8">
                <Send className="h-12 w-12 text-stone-300 mx-auto mb-2" />
                <p className="text-stone-500 text-sm">No recent notifications</p>
              </div>
            </IOSCard>
          </div>
        </div>
      </BranchAwareDashboardLayout>
    </ProtectedRoute>
  );
}

// Wrap the dashboard with BranchPageWrapper to prevent hydration errors
export default function BranchOperationsDashboard() {
  return (
    <BranchPageWrapper>
      <BranchOperationsDashboardContent />
    </BranchPageWrapper>
  );
}
