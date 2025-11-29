'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { motion } from 'framer-motion';
import {
  Users,
  Bed,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Package,
  Building2,
  RefreshCw,
  Home,
  UtensilsCrossed,
  Settings,
  Shield,
  UserCog,
  FileText,
  Database,
  Key,
  Bell,
  Wrench,
  Globe,
  CreditCard,
  ChevronRight,
  Server,
  Lock
} from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/date-utils';
import { BookingModal } from '@/components/modals/BookingModals';
import { GuestModal } from '@/components/modals/GuestModals';
import { CheckInModal } from '@/components/modals/CheckInModal';
import { ReportModal } from '@/components/modals/ReportModals';
import { toast } from 'sonner';
import { storeAPI, staffAPI, roomsAPI, bookingsAPI } from '@/lib/api';
import React from 'react';

type StatCardProps = {
  title: string;
  value: string | number;
  icon: React.ElementType;
  change?: string;
  changeType?: 'increase' | 'decrease';
  color?: string;
  subtext?: string;
};

interface DashboardStats {
  totalBranches: number;
  totalItems: number;
  lowStockItems: number;
  pendingRequests: number;
  totalStaff: number;
  totalStockValue: number;
  // Room stats
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  occupancyRate: number;
  // Booking stats
  todayArrivals: number;
  todayDepartures: number;
  // Revenue stats
  todayRevenue: number;
  monthRevenue: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [showAddGuest, setShowAddGuest] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showReports, setShowReports] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalBranches: 0,
    totalItems: 0,
    lowStockItems: 0,
    pendingRequests: 0,
    totalStaff: 0,
    totalStockValue: 0,
    totalRooms: 0,
    occupiedRooms: 0,
    availableRooms: 0,
    occupancyRate: 0,
    todayArrivals: 0,
    todayDepartures: 0,
    todayRevenue: 0,
    monthRevenue: 0
  });
  const [branches, setBranches] = useState<any[]>([]);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [recentBookings, setRecentBookings] = useState<any[]>([]);
  
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    
    try {
      const [branchesRes, itemsRes, pendingRes, lowStockRes, staffRes, roomsRes, bookingsRes] = await Promise.all([
        storeAPI.getBranchesWithStock().catch(() => ({ branches: [] })),
        storeAPI.getItems().catch(() => ({ items: [] })),
        storeAPI.getPendingRequests().catch(() => ({ requests: [] })),
        storeAPI.getBranchStock().catch(() => ({ items: [] })), // Use getBranchStock instead of getLowStockItems
        storeAPI.getDrivers().catch(() => ({ drivers: [] })), // Use getDrivers as staff placeholder
        roomsAPI.getRooms().catch(() => ({ rooms: [] })),
        bookingsAPI.getBookings().catch(() => ({ bookings: [] }))
      ]);

      const branchData = branchesRes.branches || branchesRes.data || branchesRes || [];
      const branchList = Array.isArray(branchData) ? branchData : [];
      const itemList = itemsRes.items || itemsRes.data || itemsRes || [];
      const pendingList = pendingRes.requests || pendingRes.data || pendingRes || [];
      const lowStockList = lowStockRes.items || lowStockRes.data || lowStockRes || [];
      const staffList = staffRes.drivers || staffRes.staff || staffRes.data || staffRes || [];
      const roomList = roomsRes.rooms || roomsRes.data || roomsRes || [];
      const bookingList = bookingsRes.bookings || bookingsRes.data || bookingsRes || [];

      // Process real data
      setBranches(branchList);
      setRecentRequests(Array.isArray(pendingList) ? pendingList.slice(0, 5) : []);
      setRecentBookings(Array.isArray(bookingList) ? bookingList.slice(0, 5) : []);

      const totalValue = Array.isArray(itemList) 
        ? itemList.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * (i.cost_price || i.unit_cost || 0)), 0)
        : 0;

      const roomsArray = Array.isArray(roomList) ? roomList : [];
      const occupiedRooms = roomsArray.filter((r: any) => r.status === 'occupied').length;

      setStats({
        totalBranches: Array.isArray(branchList) ? branchList.length : 0,
        totalItems: Array.isArray(itemList) ? itemList.length : 0,
        lowStockItems: Array.isArray(lowStockList) ? lowStockList.length : 0,
        pendingRequests: Array.isArray(pendingList) ? pendingList.length : 0,
        totalStaff: Array.isArray(staffList) ? staffList.length : 0,
        totalStockValue: totalValue,
        totalRooms: roomsArray.length,
        occupiedRooms: occupiedRooms,
        availableRooms: roomsArray.filter((r: any) => r.status === 'available').length,
        occupancyRate: roomsArray.length > 0 ? Math.round((occupiedRooms / roomsArray.length) * 100) : 0,
        todayArrivals: Array.isArray(bookingList) ? bookingList.filter((b: any) => b.status === 'confirmed').length : 0,
        todayDepartures: roomsArray.filter((r: any) => r.status === 'checkout').length,
        todayRevenue: 0,
        monthRevenue: 0
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, change, changeType }: StatCardProps) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{value}</p>
          {change && (
            <div className="flex items-center mt-2">
              {changeType === 'increase' ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className={`text-sm ml-1 ${changeType === 'increase' ? 'text-green-500' : 'text-red-500'}`}>
                {change}%
              </span>
            </div>
          )}
        </div>
        <div className={'p-3 rounded-lg ' + (changeType === 'increase' ? 'bg-green-50' : 'bg-blue-50')}>
          <Icon className={'h-6 w-6 ' + (changeType === 'increase' ? 'text-green-600' : 'text-blue-600')} />
        </div>
      </div>
    </motion.div>
  );

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                System Administration
              </h1>
              <p className="text-gray-600 mt-1">
                Welcome back, {user?.firstName}! Manage all hotel operations from here.
              </p>
            </div>
            <button onClick={fetchDashboardData} className="p-2 hover:bg-gray-100 rounded-lg">
              <RefreshCw className={`h-5 w-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Stats Grid - Room & Occupancy */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Rooms"
              value={stats.totalRooms}
              icon={Bed}
              change={`${stats.occupancyRate}`}
              changeType="increase"
            />
            <StatCard
              title="Occupied Rooms"
              value={stats.occupiedRooms}
              icon={Users}
              changeType="increase"
            />
            <StatCard
              title="Today's Arrivals"
              value={stats.todayArrivals}
              icon={Calendar}
              changeType="increase"
            />
            <StatCard
              title="Today's Revenue"
              value={`KES ${stats.todayRevenue.toLocaleString()}`}
              icon={DollarSign}
              changeType="increase"
            />
          </div>
          
          {/* Stats Grid - Operations */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Branches"
              value={stats.totalBranches}
              icon={Building2}
            />
            <StatCard
              title="Inventory Items"
              value={stats.totalItems}
              icon={Package}
            />
            <StatCard
              title="Staff Members"
              value={stats.totalStaff}
              icon={Users}
            />
            <StatCard
              title="Low Stock Alerts"
              value={stats.lowStockItems}
              icon={AlertCircle}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Pending Stock Requests */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Pending Stock Requests</h2>
                <a href="/dashboard/storekeeping/requests" className="text-sm text-indigo-600 hover:text-indigo-700">
                  View all →
                </a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b">
                      <th className="pb-3 font-medium">Request #</th>
                      <th className="pb-3 font-medium">Branch</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentRequests.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-gray-500">
                          {isLoading ? 'Loading...' : 'No pending requests'}
                        </td>
                      </tr>
                    ) : recentRequests.map((request: any) => (
                      <tr key={request.id} className="text-sm">
                        <td className="py-3">
                          <div className="font-medium text-gray-900">{request.request_number}</div>
                        </td>
                        <td className="py-3 text-gray-600">{request.branch?.name || '-'}</td>
                        <td className="py-3 text-gray-600">{formatDate(request.created_at)}</td>
                        <td className="py-3">
                          <span 
                            className={'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ' + (
                              request.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                              request.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            )}
                          >
                            {request.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* Branches Overview */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
            >
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Branches</h2>
              <div className="space-y-3">
                {(!Array.isArray(branches) || branches.length === 0) ? (
                  <p className="text-gray-500 text-center py-4">
                    {isLoading ? 'Loading...' : 'No branches found'}
                  </p>
                ) : (Array.isArray(branches) ? branches : []).slice(0, 5).map((branch: any) => (
                  <div key={branch.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{branch.name}</p>
                      <p className="text-xs text-gray-500">{branch.code}</p>
                    </div>
                    {branch.is_central_warehouse && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Central</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                <a href="/dashboard/admin/system/branches" className="text-sm text-indigo-600 hover:text-indigo-700">
                  Manage branches →
                </a>
              </div>
            </motion.div>
          </div>

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white"
          >
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <button 
                onClick={() => setShowNewBooking(true)}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors"
              >
                <Calendar className="h-6 w-6 mb-2" />
                <span className="text-sm">New Booking</span>
              </button>
              <button 
                onClick={() => setShowAddGuest(true)}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors"
              >
                <Users className="h-6 w-6 mb-2" />
                <span className="text-sm">Add Guest</span>
              </button>
              <button 
                onClick={() => setShowCheckIn(true)}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors"
              >
                <CheckCircle className="h-6 w-6 mb-2" />
                <span className="text-sm">Check-in</span>
              </button>
              <button 
                onClick={() => setShowReports(true)}
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 hover:bg-white/30 transition-colors"
              >
                <BarChart3 className="h-6 w-6 mb-2" />
                <span className="text-sm">View Reports</span>
              </button>
            </div>
          </motion.div>

          {/* System Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">System Summary</h2>
              {stats.lowStockItems > 0 && (
                <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
                  {stats.lowStockItems} alerts
                </span>
              )}
            </div>
            <div className="space-y-3">
              <div className="flex items-center p-3 bg-indigo-50 rounded-lg">
                <Building2 className="h-5 w-5 text-indigo-600 mr-3" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{stats.totalBranches} Branches Active</p>
                  <p className="text-xs text-gray-600">All systems operational</p>
                </div>
              </div>
              <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                <Package className="h-5 w-5 text-blue-600 mr-3" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{stats.totalItems} Items in Inventory</p>
                  <p className="text-xs text-gray-600">KES {stats.totalStockValue.toLocaleString()} total value</p>
                </div>
              </div>
              {stats.lowStockItems > 0 && (
                <div className="flex items-center p-3 bg-amber-50 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-amber-600 mr-3" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{stats.lowStockItems} Low Stock Items</p>
                    <p className="text-xs text-gray-600">Requires attention</p>
                  </div>
                </div>
              )}
              {stats.pendingRequests > 0 && (
                <div className="flex items-center p-3 bg-purple-50 rounded-lg">
                  <Clock className="h-5 w-5 text-purple-600 mr-3" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{stats.pendingRequests} Pending Requests</p>
                    <p className="text-xs text-gray-600">Awaiting review</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Admin Modules Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900">Administration Modules</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* User & Access Management */}
              <Link href="/dashboard/admin/staff" className="bg-white rounded-xl p-5 border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-indigo-100 rounded-lg group-hover:bg-indigo-200">
                    <UserCog className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">User Management</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">Manage staff accounts, roles, permissions and access control</p>
                <div className="flex items-center text-indigo-600 text-sm font-medium">
                  Manage Users <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Link>

              {/* System Configuration */}
              <Link href="/dashboard/admin/settings" className="bg-white rounded-xl p-5 border border-gray-100 hover:border-purple-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200">
                    <Settings className="h-5 w-5 text-purple-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">System Settings</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">Configure hotel settings, taxes, rates and preferences</p>
                <div className="flex items-center text-purple-600 text-sm font-medium">
                  Configure <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Link>

              {/* Branch Management */}
              <Link href="/dashboard/admin/system/branches" className="bg-white rounded-xl p-5 border border-gray-100 hover:border-teal-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-teal-100 rounded-lg group-hover:bg-teal-200">
                    <Building2 className="h-5 w-5 text-teal-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Branch Management</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">Manage all hotel branches, locations and departments</p>
                <div className="flex items-center text-teal-600 text-sm font-medium">
                  Manage Branches <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Link>

              {/* Room Configuration */}
              <Link href="/dashboard/admin/rooms" className="bg-white rounded-xl p-5 border border-gray-100 hover:border-blue-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200">
                    <Bed className="h-5 w-5 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Room Configuration</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">Configure room types, rates, amenities and availability</p>
                <div className="flex items-center text-blue-600 text-sm font-medium">
                  Configure Rooms <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Link>

              {/* Financial Management */}
              <Link href="/dashboard/admin/finance" className="bg-white rounded-xl p-5 border border-gray-100 hover:border-green-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200">
                    <DollarSign className="h-5 w-5 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Finance Management</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">Revenue, expenses, invoicing, payroll and budgets</p>
                <div className="flex items-center text-green-600 text-sm font-medium">
                  View Finance <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Link>

              {/* Reports & Analytics */}
              <Link href="/dashboard/admin/reports" className="bg-white rounded-xl p-5 border border-gray-100 hover:border-amber-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-amber-100 rounded-lg group-hover:bg-amber-200">
                    <BarChart3 className="h-5 w-5 text-amber-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Reports & Analytics</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">Generate reports, view analytics and track KPIs</p>
                <div className="flex items-center text-amber-600 text-sm font-medium">
                  View Reports <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Link>

              {/* Audit & Security */}
              <Link href="/dashboard/admin/audit" className="bg-white rounded-xl p-5 border border-gray-100 hover:border-red-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200">
                    <Shield className="h-5 w-5 text-red-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Audit & Security</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">Activity logs, audit trails and security monitoring</p>
                <div className="flex items-center text-red-600 text-sm font-medium">
                  View Audit Logs <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Link>

              {/* Inventory Management */}
              <Link href="/dashboard/admin/inventory" className="bg-white rounded-xl p-5 border border-gray-100 hover:border-orange-300 hover:shadow-md transition-all group">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-orange-100 rounded-lg group-hover:bg-orange-200">
                    <Package className="h-5 w-5 text-orange-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900">Inventory Management</h3>
                </div>
                <p className="text-sm text-gray-600 mb-3">Stock levels, suppliers, purchase orders and transfers</p>
                <div className="flex items-center text-orange-600 text-sm font-medium">
                  Manage Inventory <ChevronRight className="h-4 w-4 ml-1" />
                </div>
              </Link>
            </div>
          </motion.div>

          {/* Operations Modules */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900">Operations Management</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Link href="/dashboard/admin/reservations" className="bg-white rounded-lg p-4 border border-gray-100 hover:border-indigo-200 transition-all flex items-center gap-3">
                <Calendar className="h-8 w-8 text-indigo-500" />
                <div>
                  <h4 className="font-medium text-gray-900">Reservations</h4>
                  <p className="text-xs text-gray-500">Bookings & Check-ins</p>
                </div>
              </Link>
              <Link href="/dashboard/admin/guests" className="bg-white rounded-lg p-4 border border-gray-100 hover:border-blue-200 transition-all flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <h4 className="font-medium text-gray-900">Guests</h4>
                  <p className="text-xs text-gray-500">Guest Profiles</p>
                </div>
              </Link>
              <Link href="/dashboard/admin/housekeeping" className="bg-white rounded-lg p-4 border border-gray-100 hover:border-teal-200 transition-all flex items-center gap-3">
                <Home className="h-8 w-8 text-teal-500" />
                <div>
                  <h4 className="font-medium text-gray-900">Housekeeping</h4>
                  <p className="text-xs text-gray-500">Room Status</p>
                </div>
              </Link>
              <Link href="/dashboard/admin/restaurant" className="bg-white rounded-lg p-4 border border-gray-100 hover:border-orange-200 transition-all flex items-center gap-3">
                <UtensilsCrossed className="h-8 w-8 text-orange-500" />
                <div>
                  <h4 className="font-medium text-gray-900">Restaurant</h4>
                  <p className="text-xs text-gray-500">F&B Operations</p>
                </div>
              </Link>
              <Link href="/dashboard/admin/hr-payroll" className="bg-white rounded-lg p-4 border border-gray-100 hover:border-purple-200 transition-all flex items-center gap-3">
                <CreditCard className="h-8 w-8 text-purple-500" />
                <div>
                  <h4 className="font-medium text-gray-900">HR & Payroll</h4>
                  <p className="text-xs text-gray-500">Staff & Salaries</p>
                </div>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Modals */}
        <BookingModal
          isOpen={showNewBooking}
          onClose={() => setShowNewBooking(false)}
          mode="create"
        />
        <GuestModal
          isOpen={showAddGuest}
          onClose={() => setShowAddGuest(false)}
          mode="create"
        />
        <CheckInModal
          isOpen={showCheckIn}
          onClose={() => setShowCheckIn(false)}
        />
        <ReportModal
          isOpen={showReports}
          onClose={() => setShowReports(false)}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
