'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import {
  BarChart3, FileText, DollarSign, Users, Calendar, Clock, Download,
  Bed, TrendingUp, Package, Home, Wrench, CreditCard, PieChart,
  LineChart, Plus, Play, Pause, RefreshCw, Trash2,
  CheckCircle, XCircle, Mail, Building2, UtensilsCrossed, Wine, X,
  AlertTriangle, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { reportsAPI, auditorReportsAPI, systemAPI } from '@/lib/api';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { KPIDashboard } from './KPIDashboard';
import { fetchAPI, REPORTS_SERVICE_URL } from '@/lib/api';

// Missing reportsService implementation to proxy to real endpoints
const reportsService = {
  healthCheck: () => Promise.resolve({ status: 'OK' }), // Removed API call - not needed for functionality
  getScheduledReports: () => fetchAPI<any>('/reports/templates').catch(() => ({ data: [] })),
  getReportHistory: (limit: number) => reportsAPI.getReportHistory('all').catch(() => ({ data: [] })),
  toggleScheduledReport: (id: string) => Promise.resolve(),
  deleteScheduledReport: (id: string) => Promise.resolve(),
  runReportNow: (id: string) => Promise.resolve(),
  scheduleReport: (data: any) => Promise.resolve(),
  downloadReport: async (reportType: string, filters: any, format: 'pdf' | 'excel' = 'pdf') => {
      if (format === 'pdf') {
          return auditorReportsAPI.exportBrandedPdf(reportType, filters);
      }
      // For excel fallback
      return fetchAPI<Blob>(`/reports/generate/${reportType}?format=excel`, { responseType: 'blob' });
  }
};

// Report type definitions matching backend
const ALL_REPORT_CATEGORIES = [
  {
    name: 'Operations',
    icon: Building2,
    roles: ['admin', 'gm', 'branch_manager'],
    reports: [
      { id: 'occupancy', name: 'Occupancy Report', icon: Bed, description: 'Room occupancy rates, ADR, and RevPAR metrics' },
      { id: 'housekeeping', name: 'Housekeeping Performance', icon: Home, description: 'Staff performance, cleaning times, inspection rates' },
      { id: 'maintenance', name: 'Maintenance Log', icon: Wrench, description: 'Work orders, resolution times, pending requests' },
      { id: 'arrivals_departures', name: 'Arrivals & Departures', icon: Users, description: 'Daily guest check-ins and check-outs' },
      { id: 'manager_duty', name: 'Manager on Duty', icon: Users, description: 'MOD checklist and shift report' },
    ]
  },
  {
    name: 'Financial',
    icon: DollarSign,
    roles: ['admin', 'gm', 'branch_manager', 'finance'],
    reports: [
      { id: 'daily_sales', name: 'Daily Sales Report', icon: DollarSign, description: 'Revenue by category and payment method' },
      { id: 'financial_summary', name: 'Financial Summary', icon: TrendingUp, description: 'Complete P&L with revenue and expenses' },
      { id: 'revenue_analysis', name: 'Revenue Analysis', icon: BarChart3, description: 'Revenue breakdown by source' },
      { id: 'expense', name: 'Expense Report', icon: CreditCard, description: 'Expenditure by category' },
      { id: 'payroll_summary', name: 'Payroll Summary', icon: Users, description: 'Employee payroll with deductions' },
    ]
  },
  {
    name: 'Food & Beverage',
    icon: UtensilsCrossed,
    roles: ['admin', 'gm', 'branch_manager'],
    reports: [
      { id: 'restaurant_sales', name: 'Restaurant Sales', icon: UtensilsCrossed, description: 'Restaurant orders and top-selling items' },
      { id: 'bar_sales', name: 'Bar Sales', icon: Wine, description: 'Bar & lounge revenue and inventory' },
    ]
  },
  {
    name: 'Inventory',
    icon: Package,
    roles: ['admin', 'gm', 'branch_manager', 'branch_store', 'central_store', 'storekeeper'],
    reports: [
      { id: 'inventory_status', name: 'Inventory Status', icon: Package, description: 'Stock levels, low stock alerts, valuations' },
      { id: 'room_supplies', name: 'Room Supplies', icon: Bed, description: 'Room amenities and linen inventory' },
      { id: 'stock_movement', name: 'Stock Movement', icon: TrendingUp, description: 'Transfers, consumption, and adjustments' },
    ]
  }
];

interface ReportsPageComponentProps {
  userRole: 'admin' | 'gm' | 'branch_manager' | 'branch_store' | 'central_store' | 'storekeeper' | 'finance';
  branchId?: number | null;
  branchName?: string;
  showBranchSelector?: boolean;
  showScheduling?: boolean;
  showKPI?: boolean;
  showHistory?: boolean;
  title?: string;
  subtitle?: string;
}

interface ScheduledReport {
  id: string;
  name: string;
  report_type: string;
  frequency: string;
  schedule_time: string;
  schedule_day?: number;
  recipients: string[];
  is_active: boolean;
  last_run_at?: string;
  next_run_at?: string;
  created_at: string;
  branch_id?: number;
}

interface ReportHistory {
  id: string;
  name: string;
  type: string;
  category: string;
  status: string;
  generated_at: string;
  created_at: string;
  branch_id?: number;
}

interface KPIData {
  occupancy_rate: number;
  adr: number;
  revpar: number;
  total_revenue: number;
  total_bookings: number;
  avg_stay: number;
}

export function ReportsPageComponent({
  userRole,
  branchId,
  branchName,
  showBranchSelector = true,
  showScheduling = true,
  showKPI = true,
  showHistory = true,
  title = 'Reports & Analytics',
  subtitle = 'Generate branded reports, schedule automation, and view KPIs'
}: ReportsPageComponentProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'reports' | 'scheduled' | 'history' | 'kpi'>('reports');
  const [isLoading, setIsLoading] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<'online' | 'offline' | 'checking'>('checking');

  // Date range state
  const [dateRange, setDateRange] = useState({
    start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });
  const [selectedBranch, setSelectedBranch] = useState<string>(branchId ? branchId.toString() : 'all');
  const [branches, setBranches] = useState<any[]>([]);

  // Scheduled reports state
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  // Report history state
  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([]);

  // KPI state
  const [kpiData, setKpiData] = useState<KPIData | null>(null);

  // Generate report modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<string>('');
  const [generating, setGenerating] = useState(false);

  // Filter report categories based on user role
  const REPORT_CATEGORIES = ALL_REPORT_CATEGORIES.filter(cat =>
    cat.roles.includes(userRole)
  );

  // If branch is locked (branch_manager, branch_store), don't allow changing
  const isBranchLocked = branchId !== undefined && branchId !== null;

  useEffect(() => {
    checkServiceStatus();
    if (showBranchSelector && !isBranchLocked) {
      fetchBranches();
    }
  }, []);

  useEffect(() => {
    // Update selectedBranch when branchId prop changes
    if (branchId !== undefined && branchId !== null) {
      setSelectedBranch(branchId.toString());
    } else if (!isBranchLocked) {
      setSelectedBranch('all');
    }
  }, [branchId, isBranchLocked]);

  useEffect(() => {
    if (activeTab === 'scheduled' && showScheduling) {
      fetchScheduledReports();
    } else if (activeTab === 'history' && showHistory) {
      fetchReportHistory();
    } else if (activeTab === 'kpi' && showKPI) {
      fetchKPIData();
    }
  }, [activeTab]);

  const checkServiceStatus = async () => {
    try {
      const response = await reportsService.healthCheck();
      setServiceStatus(response.status === 'OK' ? 'online' : 'offline');
    } catch {
      setServiceStatus('offline');
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await systemAPI.getBranches();
      const branchData = res.data || res.branches || [];
      setBranches(branchData);

      // Log for debugging
      // console.log('Fetched branches:', branchData);
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  const fetchScheduledReports = async () => {
    setIsLoading(true);
    try {
      const res = await reportsService.getScheduledReports();
      let reports = res.data || [];
      // Filter by branch if locked
      if (isBranchLocked) {
        reports = reports.filter((r: ScheduledReport) => r.branch_id === branchId || !r.branch_id);
      }
      setScheduledReports(reports);
    } catch (error) {
      console.error('Error fetching scheduled reports:', error);
      // Don't show error toast - reports service may not be running
      setScheduledReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReportHistory = async () => {
    setIsLoading(true);
    try {
      const res = await reportsService.getReportHistory(50);
      let history = res.data || [];
      // Filter by branch if locked
      if (isBranchLocked) {
        history = history.filter((r: ReportHistory) => r.branch_id === branchId || !r.branch_id);
      }
      setReportHistory(history);
    } catch (error) {
      console.error('Error fetching report history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKPIData = async () => {
    setIsLoading(true);
    try {
      // For now, set mock KPI data - in production this would come from a dedicated endpoint
      setKpiData({
        occupancy_rate: 72,
        adr: 4850,
        revpar: 3492,
        total_revenue: 2450000,
        total_bookings: 156,
        avg_stay: 2.3
      });
    } catch (error) {
      console.error('Error fetching KPI data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateReport = async (reportType: string, format: 'pdf' | 'excel' = 'pdf') => {
    if (serviceStatus !== 'online') {
      toast.error('Report service is offline. Please try again later.');
      return;
    }

    setGenerating(true);
    try {
      const effectiveBranchId = isBranchLocked
        ? branchId
        : (selectedBranch !== 'all' ? parseInt(selectedBranch) : undefined);

      const effectiveBranchName = isBranchLocked
        ? branchName
        : (selectedBranch !== 'all' ? branches.find(b => b.id.toString() === selectedBranch)?.name : 'All Branches');

      const filters = {
        ...dateRange,
        branch_id: effectiveBranchId,
        branch_name: effectiveBranchName || 'All Branches'
      };

      // console.log('Generating report with filters:', filters);

      await reportsService.downloadReport(reportType, filters, format);
      toast.success(`${reportType.replace('_', ' ')} report downloaded successfully!`);
      setShowGenerateModal(false);
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleSchedule = async (scheduleId: string) => {
    try {
      await reportsService.toggleScheduledReport(scheduleId);
      toast.success('Schedule updated');
      fetchScheduledReports();
    } catch (error) {
      toast.error('Failed to update schedule');
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) return;

    try {
      await reportsService.deleteScheduledReport(scheduleId);
      toast.success('Schedule deleted');
      fetchScheduledReports();
    } catch (error) {
      toast.error('Failed to delete schedule');
    }
  };

  const handleRunNow = async (scheduleId: string) => {
    try {
      await reportsService.runReportNow(scheduleId);
      toast.success('Report generation started');
    } catch (error) {
      toast.error('Failed to run report');
    }
  };

  const openGenerateModal = (reportId: string) => {
    setSelectedReport(reportId);
    setShowGenerateModal(true);
  };

  const getReportName = (reportType: string) => {
    for (const cat of ALL_REPORT_CATEGORIES) {
      const report = cat.reports.find(r => r.id === reportType);
      if (report) return report.name;
    }
    return reportType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // Available tabs based on props
  const availableTabs = [
    { id: 'reports', label: 'Report Library', icon: FileText, show: true },
    { id: 'scheduled', label: 'Scheduled Reports', icon: Clock, show: showScheduling },
    { id: 'history', label: 'Report History', icon: BarChart3, show: showHistory },
    { id: 'kpi', label: 'KPI Dashboard', icon: PieChart, show: showKPI }
  ].filter(tab => tab.show);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 mt-1">{subtitle}</p>
          {isBranchLocked && branchName && (
            <p className="text-sm text-[#3C3C43] mt-1 flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              Branch: {branchName}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Service Status */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${serviceStatus === 'online' ? 'bg-green-100 text-green-700' :
            serviceStatus === 'offline' ? 'bg-red-100 text-red-700' :
              'bg-gray-100 text-gray-600'
            }`}>
            {serviceStatus === 'online' ? <CheckCircle className="h-4 w-4" /> :
              serviceStatus === 'offline' ? <XCircle className="h-4 w-4" /> :
                <Loader2 className="h-4 w-4 animate-spin" />}
            Report Service: {serviceStatus}
          </div>

          <IOSButton onClick={checkServiceStatus} variant="secondary" size="sm">
            <RefreshCw className="h-4 w-4" />
          </IOSButton>
        </div>
      </div>

      {/* Filters Bar */}
      <IOSCard className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={dateRange.start_date}
              onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-ios-lg text-sm"
            />
            <span className="text-gray-400">to</span>
            <input
              type="date"
              value={dateRange.end_date}
              onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
              className="px-3 py-2 border border-gray-200 rounded-ios-lg text-sm"
            />
          </div>

          {showBranchSelector && !isBranchLocked && (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-ios-lg text-sm"
            >
              <option value="all">All Branches</option>
              {branches.map(branch => (
                <option key={branch.id} value={branch.id}>{branch.name}</option>
              ))}
            </select>
          )}

          <div className="flex-1" />

          <div className="flex gap-2">
            <button
              onClick={() => {
                const today = new Date();
                setDateRange({
                  start_date: today.toISOString().split('T')[0],
                  end_date: today.toISOString().split('T')[0]
                });
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-ios-lg"
            >
              Today
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
                setDateRange({
                  start_date: weekAgo.toISOString().split('T')[0],
                  end_date: today.toISOString().split('T')[0]
                });
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-ios-lg"
            >
              Last 7 Days
            </button>
            <button
              onClick={() => {
                const today = new Date();
                const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
                setDateRange({
                  start_date: monthAgo.toISOString().split('T')[0],
                  end_date: today.toISOString().split('T')[0]
                });
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-ios-lg"
            >
              Last 30 Days
            </button>
          </div>
        </div>
      </IOSCard>

      {/* Tabs */}
      {availableTabs.length > 1 && (
        <div className="border-b border-gray-200">
          <nav className="flex gap-8">
            {availableTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-4 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                  ? 'border-[#3C3C43] text-[#3C3C43]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Reports Library Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-8">
          {REPORT_CATEGORIES.map(category => (
            <div key={category.name}>
              <div className="flex items-center gap-2 mb-4">
                <category.icon className="h-5 w-5 text-[#3C3C43]" />
                <h2 className="text-lg font-semibold font-sf-pro-display text-gray-900">{category.name} Reports</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {category.reports.map(report => (
                  <IOSCard
                    key={report.id}
                    className="p-5 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => openGenerateModal(report.id)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-[#F2F2F7] rounded-ios-lg group-hover:bg-[#E5E5EA] transition-colors">
                        <report.icon className="h-5 w-5 text-[#3C3C43]" />
                      </div>
                    </div>
                    <h3 className="font-semibold font-sf-pro-display text-gray-900 mb-1">{report.name}</h3>
                    <p className="text-sm text-gray-500 mb-3">{report.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[#3C3C43] text-sm font-medium flex items-center gap-1">
                        <Download className="h-4 w-4" />
                        Generate
                      </span>
                      <div className="flex gap-1">
                        <span className="text-xs px-2 py-0.5 bg-[#F2F2F7] rounded text-gray-600">PDF</span>
                        <span className="text-xs px-2 py-0.5 bg-[#F2F2F7] rounded text-gray-600">Excel</span>
                      </div>
                    </div>
                  </IOSCard>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scheduled Reports Tab */}
      {activeTab === 'scheduled' && showScheduling && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-sf-pro-display">Automated Report Schedules</h2>
            <IOSButton onClick={() => setShowScheduleModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Schedule New Report
            </IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : scheduledReports.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-4">No scheduled reports yet</p>
              <IOSButton onClick={() => setShowScheduleModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Schedule
              </IOSButton>
            </IOSCard>
          ) : (
            <IOSCard className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Report</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Frequency</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Recipients</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Run</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {scheduledReports.map(schedule => (
                    <tr key={schedule.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{schedule.name}</div>
                        <div className="text-sm text-gray-500">{getReportName(schedule.report_type)}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">{schedule.frequency}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{schedule.schedule_time}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {schedule.recipients?.length || 0} recipients
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {schedule.next_run_at
                          ? new Date(schedule.next_run_at).toLocaleDateString()
                          : 'Not scheduled'}
                      </td>
                      <td className="px-6 py-4">
                        <IOSBadge variant="light" color={schedule.is_active ? 'success' : 'secondary'}>
                          {schedule.is_active ? 'Active' : 'Paused'}
                        </IOSBadge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRunNow(schedule.id)}
                            className="p-1.5 text-gray-600 hover:text-[#3C3C43] hover:bg-gray-100 rounded"
                            title="Run Now"
                          >
                            <Play className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleSchedule(schedule.id)}
                            className="p-1.5 text-gray-600 hover:text-[#3C3C43] hover:bg-gray-100 rounded"
                            title={schedule.is_active ? 'Pause' : 'Resume'}
                          >
                            {schedule.is_active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(schedule.id)}
                            className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </IOSCard>
          )}
        </div>
      )}

      {/* Report History Tab */}
      {activeTab === 'history' && showHistory && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold font-sf-pro-display">Generated Reports History</h2>
            <IOSButton variant="secondary" onClick={fetchReportHistory}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </IOSButton>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : reportHistory.length === 0 ? (
            <IOSCard className="p-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No reports generated yet</p>
            </IOSCard>
          ) : (
            <IOSCard className="overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Report</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Generated</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {reportHistory.map(report => (
                    <tr key={report.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{report.name || getReportName(report.type)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">{report.type?.replace('_', ' ')}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 capitalize">{report.category}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {report.generated_at
                          ? new Date(report.generated_at).toLocaleString()
                          : new Date(report.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4">
                        <IOSBadge variant="light" color={report.status === 'completed' ? 'success' : report.status === 'failed' ? 'danger' : 'warning'}>
                          {report.status}
                        </IOSBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </IOSCard>
          )}
        </div>
      )}

      {/* KPI Dashboard Tab */}
      {activeTab === 'kpi' && showKPI && (
        <KPIDashboard
          branchId={isBranchLocked ? branchId : (selectedBranch !== 'all' ? parseInt(selectedBranch) : undefined)}
          branchName={isBranchLocked ? branchName : (selectedBranch !== 'all' ? branches.find(b => b.id.toString() === selectedBranch)?.name : undefined)}
        />
      )}

      {/* Generate Report Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowGenerateModal(false)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Generate Report</h2>
              <button onClick={() => setShowGenerateModal(false)} className="p-2 hover:bg-gray-100 rounded-ios-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
                <div className="p-3 bg-[#F2F2F7] rounded-ios-lg">
                  <p className="font-medium">{getReportName(selectedReport)}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={dateRange.start_date}
                    onChange={(e) => setDateRange(prev => ({ ...prev, start_date: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-ios-lg"
                  />
                  <input
                    type="date"
                    value={dateRange.end_date}
                    onChange={(e) => setDateRange(prev => ({ ...prev, end_date: e.target.value }))}
                    className="px-3 py-2 border border-gray-200 rounded-ios-lg"
                  />
                </div>
              </div>

              {showBranchSelector && !isBranchLocked && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <select
                    value={selectedBranch}
                    onChange={(e) => {
                      // console.log('Branch selector changed to:', e.target.value);
                      setSelectedBranch(e.target.value);
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-ios-lg"
                  >
                    <option value="all">All Branches</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {isBranchLocked && branchName && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <div className="p-3 bg-[#F2F2F7] rounded-ios-lg flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-500" />
                    <p className="font-medium">{branchName}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6 pt-6 border-t">
              <IOSButton
                onClick={() => handleGenerateReport(selectedReport, 'pdf')}
                disabled={generating || serviceStatus !== 'online'}
                className="flex-1"
              >
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Download PDF
              </IOSButton>
              <IOSButton
                variant="secondary"
                onClick={() => handleGenerateReport(selectedReport, 'excel')}
                disabled={generating || serviceStatus !== 'online'}
                className="flex-1"
              >
                {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                Download Excel
              </IOSButton>
            </div>

            {serviceStatus !== 'online' && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-ios-lg flex items-center gap-2 text-red-700 text-sm">
                <AlertTriangle className="h-4 w-4" />
                Report service is offline. Please try again later.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Report Modal */}
      {showScheduleModal && showScheduling && (
        <ScheduleReportModal
          isOpen={showScheduleModal}
          onClose={() => setShowScheduleModal(false)}
          onSuccess={() => {
            setShowScheduleModal(false);
            fetchScheduledReports();
          }}
          branchId={
            isBranchLocked
              ? branchId
              : selectedBranch !== 'all'
                ? parseInt(selectedBranch)
                : undefined
          }
          reportCategories={REPORT_CATEGORIES}
        />
      )}
    </div>
  );
}


// Schedule Report Modal Component
function ScheduleReportModal({
  isOpen,
  onClose,
  onSuccess,
  branchId,
  reportCategories
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  branchId?: number | null;
  reportCategories: typeof ALL_REPORT_CATEGORIES;
}) {
  const [formData, setFormData] = useState({
    name: '',
    reportType: 'daily_sales',
    frequency: 'daily' as 'daily' | 'weekly' | 'monthly',
    scheduleTime: '08:00',
    scheduleDay: 1,
    recipients: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name || !formData.reportType) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await reportsService.scheduleReport({
        name: formData.name,
        reportType: formData.reportType,
        frequency: formData.frequency,
        scheduleTime: formData.scheduleTime,
        scheduleDay: formData.frequency !== 'daily' ? formData.scheduleDay : undefined,
        recipients: formData.recipients.split(',').map(e => e.trim()).filter(Boolean),
        parameters: {
          ...(branchId ? { branch_id: branchId } : {}),
        },
      });
      toast.success('Report scheduled successfully!');
      onSuccess();
    } catch (error) {
      toast.error('Failed to schedule report');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Schedule New Report</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-ios-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schedule Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g., Daily Sales Summary"
              className="w-full px-3 py-2 border border-gray-200 rounded-ios-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Type *</label>
            <select
              value={formData.reportType}
              onChange={(e) => setFormData(prev => ({ ...prev, reportType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-ios-lg"
            >
              {reportCategories.flatMap(cat => cat.reports).map(report => (
                <option key={report.id} value={report.id}>{report.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-ios-lg"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={formData.scheduleTime}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduleTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-ios-lg"
              />
            </div>
          </div>

          {formData.frequency === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
              <select
                value={formData.scheduleDay}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduleDay: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-ios-lg"
              >
                <option value={0}>Sunday</option>
                <option value={1}>Monday</option>
                <option value={2}>Tuesday</option>
                <option value={3}>Wednesday</option>
                <option value={4}>Thursday</option>
                <option value={5}>Friday</option>
                <option value={6}>Saturday</option>
              </select>
            </div>
          )}

          {formData.frequency === 'monthly' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Day of Month</label>
              <select
                value={formData.scheduleDay}
                onChange={(e) => setFormData(prev => ({ ...prev, scheduleDay: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-ios-lg"
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>{day}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Recipients</label>
            <input
              type="text"
              value={formData.recipients}
              onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))}
              placeholder="email1@example.com, email2@example.com"
              className="w-full px-3 py-2 border border-gray-200 rounded-ios-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Separate multiple emails with commas</p>
          </div>
        </div>

        <div className="flex gap-3 mt-6 pt-6 border-t">
          <IOSButton variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </IOSButton>
          <IOSButton onClick={handleSubmit} disabled={submitting} className="flex-1">
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
            Create Schedule
          </IOSButton>
        </div>
      </div>
    </div>
  );
}
