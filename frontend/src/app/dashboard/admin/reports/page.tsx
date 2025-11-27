'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import {
  BarChart3,
  FileText,
  DollarSign,
  Users,
  Calendar,
  Clock,
  Download,
  Filter,
  ChevronDown,
  Search
} from 'lucide-react';
import { ReportModal } from '@/components/modals/ReportModals';
import { toast } from 'sonner';

export default function ReportsPage() {
  const { user } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState<'occupancy' | 'revenue' | 'housekeeping' | 'maintenance'>('occupancy');

  const reportTypes = [
    { id: 'occupancy', name: 'Occupancy Report', icon: Users },
    { id: 'revenue', name: 'Revenue Report', icon: DollarSign },
    { id: 'housekeeping', name: 'Housekeeping Report', icon: FileText },
    { id: 'maintenance', name: 'Maintenance Report', icon: FileText }
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
              <p className="text-gray-600 mt-1">View detailed reports and analytics</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                This Month
              </button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export Report
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {reportTypes.map(type => (
              <button
                key={type.id}
                onClick={() => {
                  setReportType(type.id as 'occupancy' | 'revenue' | 'housekeeping' | 'maintenance');
                  setShowReportModal(true);
                }}
                className="bg-white rounded-lg p-6 border border-gray-100 hover:border-indigo-500 hover:bg-indigo-50 transition-colors"
              >
                <type.icon className="h-8 w-8 text-indigo-600 mb-2" />
                <h3 className="font-medium text-gray-900">{type.name}</h3>
                <p className="text-sm text-gray-500 mt-1">View and generate report</p>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent Reports</h2>
              <div className="flex gap-2">
                <div className="relative">
                  <select
                    className="appearance-none pl-3 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  >
                    <option>All Types</option>
                    <option>Occupancy</option>
                    <option>Revenue</option>
                    <option>Housekeeping</option>
                    <option>Maintenance</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                </div>
                <button className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100">
                  <Filter className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                      <FileText className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">Monthly Occupancy Report</h3>
                      <p className="text-sm text-gray-500">Generated on Nov 23, 2024</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                    <Download className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Report Modal */}
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
        />
      </DashboardLayout>
    </ProtectedRoute>
  );
}
