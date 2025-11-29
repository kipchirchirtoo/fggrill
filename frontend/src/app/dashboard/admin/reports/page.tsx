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
  Search,
  Bed,
  TrendingUp,
  Package,
  Home,
  Wrench,
  CreditCard,
  PieChart,
  LineChart,
  Plus,
  Play,
  Pause,
  Settings
} from 'lucide-react';
import { ReportModal } from '@/components/modals/ReportModals';
import { toast } from 'sonner';

export default function ReportsPage() {
  const { user } = useAuth();
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportType, setReportType] = useState<string>('occupancy');
  const [activeTab, setActiveTab] = useState<'reports' | 'scheduled' | 'kpi'>('reports');
  const [dateRange, setDateRange] = useState('this_month');

  const reportCategories = [
    {
      name: 'Operations',
      reports: [
        { id: 'occupancy', name: 'Occupancy Report', icon: Bed, description: 'Room occupancy rates and trends' },
        { id: 'housekeeping', name: 'Housekeeping Report', icon: Home, description: 'Cleaning status and staff performance' },
        { id: 'maintenance', name: 'Maintenance Report', icon: Wrench, description: 'Work orders and equipment status' },
        { id: 'arrivals_departures', name: 'Arrivals & Departures', icon: Users, description: 'Daily guest movements' },
      ]
    },
    {
      name: 'Financial',
      reports: [
        { id: 'revenue', name: 'Revenue Report', icon: DollarSign, description: 'Income by source and period' },
        { id: 'expense', name: 'Expense Report', icon: CreditCard, description: 'Expenditure breakdown' },
        { id: 'profit_loss', name: 'Profit & Loss', icon: TrendingUp, description: 'Financial performance summary' },
        { id: 'accounts_receivable', name: 'Accounts Receivable', icon: FileText, description: 'Outstanding payments' },
      ]
    },
    {
      name: 'Inventory',
      reports: [
        { id: 'stock_levels', name: 'Stock Levels', icon: Package, description: 'Current inventory status' },
        { id: 'consumption', name: 'Consumption Report', icon: BarChart3, description: 'Usage patterns and trends' },
        { id: 'low_stock', name: 'Low Stock Alert', icon: Package, description: 'Items below reorder point' },
        { id: 'purchase_orders', name: 'Purchase Orders', icon: FileText, description: 'Order history and status' },
      ]
    }
  ];

  const scheduledReports = [
    { id: 1, name: 'Daily Occupancy Summary', frequency: 'Daily', time: '8:00 AM', recipients: 'management@famousgate.com', status: 'active' },
    { id: 2, name: 'Weekly Revenue Report', frequency: 'Weekly (Mon)', time: '9:00 AM', recipients: 'finance@famousgate.com', status: 'active' },
    { id: 3, name: 'Monthly Financial Summary', frequency: 'Monthly (1st)', time: '7:00 AM', recipients: 'ceo@famousgate.com', status: 'active' },
    { id: 4, name: 'Stock Alert Report', frequency: 'Daily', time: '6:00 AM', recipients: 'store@famousgate.com', status: 'paused' },
  ];

  const kpiMetrics = [
    { name: 'Occupancy Rate', value: '72%', target: '75%', trend: '+5%', status: 'warning' },
    { name: 'ADR (Avg Daily Rate)', value: 'KES 4,850', target: 'KES 5,000', trend: '+8%', status: 'good' },
    { name: 'RevPAR', value: 'KES 3,492', target: 'KES 3,750', trend: '+12%', status: 'good' },
    { name: 'Guest Satisfaction', value: '4.6/5', target: '4.5/5', trend: '+0.2', status: 'excellent' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
              <p className="text-gray-600 mt-1">Generate reports, view KPIs and schedule automated reports</p>
            </div>
            <div className="flex gap-2">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg"
              >
                <option value="today">Today</option>
                <option value="yesterday">Yesterday</option>
                <option value="this_week">This Week</option>
                <option value="last_week">Last Week</option>
                <option value="this_month">This Month</option>
                <option value="last_month">Last Month</option>
                <option value="this_quarter">This Quarter</option>
                <option value="this_year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                <Download className="h-4 w-4" />
                Export All
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-8">
              {[
                { id: 'reports', label: 'Report Library', icon: FileText },
                { id: 'scheduled', label: 'Scheduled Reports', icon: Clock },
                { id: 'kpi', label: 'KPI Dashboard', icon: PieChart }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors ${
                    activeTab === tab.id
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Reports Library Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-8">
              {reportCategories.map(category => (
                <div key={category.name}>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">{category.name} Reports</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {category.reports.map(report => (
                      <button
                        key={report.id}
                        onClick={() => {
                          setReportType(report.id);
                          setShowReportModal(true);
                        }}
                        className="bg-white rounded-xl p-5 border border-gray-100 hover:border-indigo-300 hover:shadow-md transition-all text-left group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-indigo-100">
                            <report.icon className="h-5 w-5 text-indigo-600" />
                          </div>
                        </div>
                        <h3 className="font-semibold text-gray-900 mb-1">{report.name}</h3>
                        <p className="text-sm text-gray-500">{report.description}</p>
                        <div className="mt-3 flex items-center text-indigo-600 text-sm font-medium">
                          Generate Report
                          <Download className="h-4 w-4 ml-1" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Scheduled Reports Tab */}
          {activeTab === 'scheduled' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Scheduled Reports</h2>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  <Plus className="h-4 w-4" />
                  Schedule New Report
                </button>
              </div>
              
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Report Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipients</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {scheduledReports.map(report => (
                      <tr key={report.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{report.name}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{report.frequency}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{report.time}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{report.recipients}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            report.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {report.status}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button className="p-1 text-gray-600 hover:text-indigo-600">
                              {report.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </button>
                            <button className="p-1 text-gray-600 hover:text-indigo-600">
                              <Settings className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* KPI Dashboard Tab */}
          {activeTab === 'kpi' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {kpiMetrics.map(kpi => (
                  <div key={kpi.name} className="bg-white rounded-xl p-6 border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">{kpi.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        kpi.status === 'excellent' ? 'bg-green-100 text-green-700' :
                        kpi.status === 'good' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {kpi.trend}
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                    <p className="text-sm text-gray-500 mt-1">Target: {kpi.target}</p>
                    <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          kpi.status === 'excellent' ? 'bg-green-500' :
                          kpi.status === 'good' ? 'bg-blue-500' :
                          'bg-yellow-500'
                        }`}
                        style={{ width: kpi.status === 'excellent' ? '100%' : kpi.status === 'good' ? '85%' : '70%' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-6 border border-gray-100">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <LineChart className="h-5 w-5 text-indigo-600" />
                    Occupancy Trend (Last 30 Days)
                  </h3>
                  <div className="h-64 flex items-center justify-center text-gray-400">
                    <BarChart3 className="h-16 w-16" />
                    <span className="ml-2">Chart visualization</span>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-6 border border-gray-100">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-indigo-600" />
                    Revenue by Source
                  </h3>
                  <div className="h-64 flex items-center justify-center text-gray-400">
                    <PieChart className="h-16 w-16" />
                    <span className="ml-2">Chart visualization</span>
                  </div>
                </div>
              </div>
            </div>
          )}
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
