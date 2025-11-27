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
  UtensilsCrossed
} from 'lucide-react';
import Link from 'next/link';
import { BookingModal } from '@/components/modals/BookingModals';
import { GuestModal } from '@/components/modals/GuestModals';
import { CheckInModal } from '@/components/modals/CheckInModal';
import { ReportModal } from '@/components/modals/ReportModals';
import { toast } from 'sonner';
import { storeAPI, staffAPI } from '@/lib/api';

import React from 'react';

type StatCardProps = {
  title: string;
  value: string | number;
  icon: React.ElementType;
  change?: string;
  changeType?: 'increase' | 'decrease';
  color?: string;
};

interface DashboardStats {
  totalBranches: number;
  totalItems: number;
  lowStockItems: number;
  pendingRequests: number;
  totalStaff: number;
  totalStockValue: number;
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
    totalStockValue: 0
  });
  const [branches, setBranches] = useState<any[]>([]);
  const [recentRequests, setRecentRequests] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [branchesRes, itemsRes, pendingRes, lowStockRes, staffRes] = await Promise.all([
        storeAPI.getBranchesWithStock().catch(() => ({ branches: [] })),
        storeAPI.getItems().catch(() => ({ items: [] })),
        storeAPI.getPendingRequests().catch(() => ({ requests: [] })),
        storeAPI.getLowStockItems().catch(() => ({ items: [] })),
        staffAPI.getStaff().catch(() => ({ staff: [] }))
      ]);

      const branchData = branchesRes.branches || branchesRes || [];
      const branchList = Array.isArray(branchData) ? branchData : [];
      const itemList = itemsRes.items || itemsRes || [];
      const pendingList = pendingRes.requests || pendingRes || [];
      const lowStockList = lowStockRes.items || lowStockRes || [];
      const staffList = staffRes.staff || staffRes || [];

      setBranches(branchList);
      setRecentRequests(Array.isArray(pendingList) ? pendingList.slice(0, 5) : []);

      const totalValue = Array.isArray(itemList) 
        ? itemList.reduce((sum: number, i: any) => sum + ((i.quantity || 0) * (i.cost_price || 0)), 0)
        : 0;

      setStats({
        totalBranches: Array.isArray(branchList) ? branchList.length : 0,
        totalItems: Array.isArray(itemList) ? itemList.length : 0,
        lowStockItems: Array.isArray(lowStockList) ? lowStockList.length : 0,
        pendingRequests: Array.isArray(pendingList) ? pendingList.length : 0,
        totalStaff: Array.isArray(staffList) ? staffList.length : 0,
        totalStockValue: totalValue
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
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user?.firstName}!
              </h1>
              <p className="text-gray-600 mt-1">
                Here's what's happening at Famous Gate Hotel today
              </p>
            </div>
            <button onClick={fetchDashboardData} className="p-2 hover:bg-gray-100 rounded-lg">
              <RefreshCw className={`h-5 w-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Branches"
              value={stats.totalBranches}
              icon={Building2}
            />
            <StatCard
              title="Total Items"
              value={stats.totalItems}
              icon={Package}
            />
            <StatCard
              title="Low Stock Alerts"
              value={stats.lowStockItems}
              icon={AlertCircle}
            />
            <StatCard
              title="Stock Value (KES)"
              value={stats.totalStockValue.toLocaleString()}
              icon={DollarSign}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Staff Members"
              value={stats.totalStaff}
              icon={Users}
            />
            <StatCard
              title="Pending Requests"
              value={stats.pendingRequests}
              icon={Clock}
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
                        <td className="py-3 text-gray-600">{new Date(request.created_at).toLocaleDateString()}</td>
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

          {/* Admin Workflow Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white rounded-xl shadow-sm p-6 border border-gray-100"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Super Admin Workflows</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* User Management */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-indigo-700 mb-3">User Management</h3>
                <div className="space-y-2">
                  <Link href="/dashboard/admin/staff" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Users className="h-4 w-4" /> Manage Staff
                  </Link>
                  <Link href="/dashboard/admin/staff/attendance" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <CheckCircle className="h-4 w-4" /> Attendance
                  </Link>
                </div>
              </div>

              {/* System Config */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-purple-700 mb-3">System Config</h3>
                <div className="space-y-2">
                  <Link href="/dashboard/admin/system/branches" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Building2 className="h-4 w-4" /> Branches
                  </Link>
                  <Link href="/dashboard/admin/settings" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Package className="h-4 w-4" /> Settings
                  </Link>
                </div>
              </div>

              {/* Operations */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-emerald-700 mb-3">Operations</h3>
                <div className="space-y-2">
                  <Link href="/dashboard/admin/housekeeping" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <Home className="h-4 w-4" /> Housekeeping
                  </Link>
                  <Link href="/dashboard/admin/restaurant" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <UtensilsCrossed className="h-4 w-4" /> Restaurant
                  </Link>
                </div>
              </div>

              {/* Finance */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium text-sm text-amber-700 mb-3">Finance & Reports</h3>
                <div className="space-y-2">
                  <Link href="/dashboard/admin/finance" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <DollarSign className="h-4 w-4" /> Financial Overview
                  </Link>
                  <Link href="/dashboard/admin/reports" className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600">
                    <BarChart3 className="h-4 w-4" /> All Reports
                  </Link>
                </div>
              </div>
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
