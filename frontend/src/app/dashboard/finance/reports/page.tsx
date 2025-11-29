'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, FileText, Download, Eye, Calendar, Building2, Filter,
  TrendingUp, TrendingDown, DollarSign, PieChart, LineChart, ArrowRight,
  RefreshCw, Clock, CheckCircle, Mail, Printer, X, ChevronRight, Plus,
  FileSpreadsheet, File, Table, LayoutGrid, List, Settings, Send, Star,
  Bookmark, History, AlertCircle, ArrowUpRight, ArrowDownRight, Percent
} from 'lucide-react';
import { toast } from 'sonner';

// Report types
type ReportType = 'profit_loss' | 'balance_sheet' | 'cash_flow' | 'revenue' | 'expense' | 'tax' | 'branch' | 'custom';
type ReportFormat = 'pdf' | 'excel' | 'csv';
type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

interface ReportTemplate {
  id: string;
  type: ReportType;
  name: string;
  description: string;
  icon: any;
  color: string;
  popular?: boolean;
}

interface GeneratedReport {
  id: string;
  name: string;
  type: ReportType;
  period: string;
  branch: string;
  generatedAt: string;
  generatedBy: string;
  format: ReportFormat;
  size: string;
  status: 'ready' | 'generating' | 'failed';
}

interface ScheduledReport {
  id: string;
  name: string;
  type: ReportType;
  frequency: string;
  nextRun: string;
  recipients: string[];
  active: boolean;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  { id: '1', type: 'profit_loss', name: 'Profit & Loss Statement', description: 'Income, expenses, and net profit/loss', icon: TrendingUp, color: 'bg-green-500', popular: true },
  { id: '2', type: 'balance_sheet', name: 'Balance Sheet', description: 'Assets, liabilities, and equity', icon: FileText, color: 'bg-blue-500' },
  { id: '3', type: 'cash_flow', name: 'Cash Flow Statement', description: 'Cash inflows and outflows', icon: DollarSign, color: 'bg-purple-500', popular: true },
  { id: '4', type: 'revenue', name: 'Revenue Report', description: 'Detailed revenue breakdown by source', icon: BarChart3, color: 'bg-indigo-500' },
  { id: '5', type: 'expense', name: 'Expense Report', description: 'Expense analysis by category', icon: PieChart, color: 'bg-red-500', popular: true },
  { id: '6', type: 'tax', name: 'Tax Summary Report', description: 'VAT, withholding tax, and obligations', icon: Percent, color: 'bg-amber-500' },
  { id: '7', type: 'branch', name: 'Branch Performance', description: 'Comparative branch analysis', icon: Building2, color: 'bg-teal-500' },
  { id: '8', type: 'custom', name: 'Custom Report', description: 'Build your own custom report', icon: Settings, color: 'bg-gray-500' },
];

const BRANCHES = [
  { id: 'all', name: 'All Branches' },
  { id: 'FGB-HQ', name: 'Bomet HQ' },
  { id: 'FGB-BMT', name: 'Bomet Town' },
  { id: 'FGB-KER', name: 'Kericho' },
  { id: 'FGB-KAP', name: 'Kapsoit' },
  { id: 'FGB-MOG', name: 'Mogogosiek' },
  { id: 'FGB-LIT', name: 'Litein' },
];

export default function FinanceReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'scheduled'>('generate');
  const [isLoading, setIsLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);

  // Report generation form
  const [reportConfig, setReportConfig] = useState({
    period: 'monthly' as ReportPeriod,
    startDate: '',
    endDate: '',
    branch: 'all',
    format: 'pdf' as ReportFormat,
    includeCharts: true,
    compareLastPeriod: true,
  });

  // Quick stats
  const [quickStats, setQuickStats] = useState({
    totalRevenue: 2850000,
    totalExpenses: 1920000,
    netProfit: 930000,
    profitMargin: 32.6,
    revenueGrowth: 12.5,
    expenseGrowth: 8.2,
  });

  useEffect(() => {
    fetchReportHistory();
    fetchScheduledReports();
  }, []);

  const fetchReportHistory = async () => {
    // Mock data
    setGeneratedReports([
      { id: '1', name: 'P&L Statement - November 2024', type: 'profit_loss', period: 'Nov 2024', branch: 'All Branches', generatedAt: '2024-11-28 10:30', generatedBy: 'John Accountant', format: 'pdf', size: '2.4 MB', status: 'ready' },
      { id: '2', name: 'Cash Flow Report - Q3 2024', type: 'cash_flow', period: 'Q3 2024', branch: 'All Branches', generatedAt: '2024-11-27 14:15', generatedBy: 'Jane Finance', format: 'excel', size: '1.8 MB', status: 'ready' },
      { id: '3', name: 'Branch Performance - October', type: 'branch', period: 'Oct 2024', branch: 'All Branches', generatedAt: '2024-11-26 09:00', generatedBy: 'John Accountant', format: 'pdf', size: '3.2 MB', status: 'ready' },
      { id: '4', name: 'Expense Report - November', type: 'expense', period: 'Nov 2024', branch: 'Bomet HQ', generatedAt: '2024-11-25 16:45', generatedBy: 'Jane Finance', format: 'csv', size: '0.5 MB', status: 'ready' },
    ]);
  };

  const fetchScheduledReports = async () => {
    setScheduledReports([
      { id: '1', name: 'Monthly P&L Statement', type: 'profit_loss', frequency: 'Monthly (1st)', nextRun: '2024-12-01', recipients: ['accounts@fghotel.co.ke', 'gm@fghotel.co.ke'], active: true },
      { id: '2', name: 'Weekly Revenue Summary', type: 'revenue', frequency: 'Weekly (Monday)', nextRun: '2024-12-02', recipients: ['accounts@fghotel.co.ke'], active: true },
      { id: '3', name: 'Quarterly Tax Report', type: 'tax', frequency: 'Quarterly', nextRun: '2025-01-01', recipients: ['accounts@fghotel.co.ke', 'tax@fghotel.co.ke'], active: false },
    ]);
  };

  const handleGenerateReport = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setShowPreviewModal(true);
  };

  const generateReport = () => {
    if (!selectedTemplate) return;
    
    setIsLoading(true);
    toast.loading('Generating report...');
    
    setTimeout(() => {
      setIsLoading(false);
      toast.dismiss();
      toast.success(`${selectedTemplate.name} generated successfully!`);
      setShowPreviewModal(false);
      
      // Add to history
      const newReport: GeneratedReport = {
        id: String(generatedReports.length + 1),
        name: `${selectedTemplate.name} - ${reportConfig.period}`,
        type: selectedTemplate.type,
        period: reportConfig.period,
        branch: BRANCHES.find(b => b.id === reportConfig.branch)?.name || 'All Branches',
        generatedAt: new Date().toLocaleString(),
        generatedBy: user?.firstName || 'User',
        format: reportConfig.format,
        size: '1.5 MB',
        status: 'ready',
      };
      setGeneratedReports(prev => [newReport, ...prev]);
    }, 2000);
  };

  const downloadReport = (report: GeneratedReport) => {
    toast.success(`Downloading ${report.name}`);
  };

  const emailReport = (report: GeneratedReport) => {
    toast.success(`Email sent with ${report.name}`);
  };

  const formatIcon = (format: ReportFormat) => {
    switch (format) {
      case 'pdf': return <File className="h-4 w-4 text-red-500" />;
      case 'excel': return <FileSpreadsheet className="h-4 w-4 text-green-500" />;
      case 'csv': return <Table className="h-4 w-4 text-blue-500" />;
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.ACCOUNTANT]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Financial Reports</h1>
              <p className="text-gray-600 mt-1">Generate, schedule, and analyze financial reports</p>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowScheduleModal(true)}>
                <Clock className="h-4 w-4 mr-2" />
                Schedule Report
              </Button>
              <Button variant="outline" size="sm">
                <History className="h-4 w-4 mr-2" />
                View History
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <p className="text-xs text-green-600 font-medium">Total Revenue</p>
              <p className="text-xl font-bold text-green-700">KES {quickStats.totalRevenue.toLocaleString()}</p>
              <div className="flex items-center text-xs text-green-600 mt-1">
                <ArrowUpRight className="h-3 w-3" />
                <span>{quickStats.revenueGrowth}% vs last period</span>
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <p className="text-xs text-red-600 font-medium">Total Expenses</p>
              <p className="text-xl font-bold text-red-700">KES {quickStats.totalExpenses.toLocaleString()}</p>
              <div className="flex items-center text-xs text-red-600 mt-1">
                <ArrowUpRight className="h-3 w-3" />
                <span>{quickStats.expenseGrowth}% vs last period</span>
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <p className="text-xs text-blue-600 font-medium">Net Profit</p>
              <p className="text-xl font-bold text-blue-700">KES {quickStats.netProfit.toLocaleString()}</p>
              <div className="flex items-center text-xs text-blue-600 mt-1">
                <TrendingUp className="h-3 w-3 mr-1" />
                <span>Healthy</span>
              </div>
            </Card>
            <Card className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <p className="text-xs text-purple-600 font-medium">Profit Margin</p>
              <p className="text-xl font-bold text-purple-700">{quickStats.profitMargin}%</p>
              <div className="flex items-center text-xs text-purple-600 mt-1">
                <CheckCircle className="h-3 w-3 mr-1" />
                <span>Above target</span>
              </div>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500">Reports Generated</p>
              <p className="text-2xl font-bold">{generatedReports.length}</p>
              <p className="text-xs text-gray-400 mt-1">This month</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-gray-500">Scheduled Reports</p>
              <p className="text-2xl font-bold">{scheduledReports.filter(r => r.active).length}</p>
              <p className="text-xs text-gray-400 mt-1">Active schedules</p>
            </Card>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
            {['generate', 'history', 'scheduled'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab === 'generate' && 'Generate Report'}
                {tab === 'history' && 'Report History'}
                {tab === 'scheduled' && 'Scheduled Reports'}
              </button>
            ))}
          </div>

          {/* Generate Report Tab */}
          {activeTab === 'generate' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {REPORT_TEMPLATES.map(template => {
                const Icon = template.icon;
                return (
                  <motion.div
                    key={template.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className="p-5 cursor-pointer hover:shadow-lg transition-all border-2 border-transparent hover:border-indigo-200 relative overflow-hidden"
                      onClick={() => handleGenerateReport(template)}
                    >
                      {template.popular && (
                        <Badge className="absolute top-2 right-2 bg-amber-100 text-amber-700">
                          <Star className="h-3 w-3 mr-1" /> Popular
                        </Badge>
                      )}
                      <div className={`w-12 h-12 rounded-xl ${template.color} flex items-center justify-center mb-4`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                      <div className="mt-4 flex items-center text-indigo-600 text-sm font-medium">
                        Generate <ArrowRight className="h-4 w-4 ml-1" />
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Report History Tab */}
          {activeTab === 'history' && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold">Recent Reports</h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <Filter className="h-4 w-4 mr-1" /> Filter
                  </Button>
                </div>
              </div>
              <div className="divide-y">
                {generatedReports.map(report => (
                  <div key={report.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        {formatIcon(report.format)}
                      </div>
                      <div>
                        <p className="font-medium">{report.name}</p>
                        <p className="text-sm text-gray-500">
                          {report.branch} • {report.generatedAt} • {report.size}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={report.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}>
                        {report.status === 'ready' ? <CheckCircle className="h-3 w-3 mr-1" /> : <Clock className="h-3 w-3 mr-1" />}
                        {report.status}
                      </Badge>
                      <Button variant="ghost" size="sm" onClick={() => downloadReport(report)}>
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => emailReport(report)}>
                        <Mail className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Scheduled Reports Tab */}
          {activeTab === 'scheduled' && (
            <Card className="overflow-hidden">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold">Scheduled Reports</h3>
                <Button size="sm" onClick={() => setShowScheduleModal(true)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Schedule
                </Button>
              </div>
              <div className="divide-y">
                {scheduledReports.map(schedule => (
                  <div key={schedule.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${schedule.active ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <Clock className={`h-5 w-5 ${schedule.active ? 'text-green-600' : 'text-gray-400'}`} />
                      </div>
                      <div>
                        <p className="font-medium">{schedule.name}</p>
                        <p className="text-sm text-gray-500">
                          {schedule.frequency} • Next: {schedule.nextRun}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Recipients: {schedule.recipients.join(', ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={schedule.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                        {schedule.active ? 'Active' : 'Paused'}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Preview/Generate Modal */}
          <AnimatePresence>
            {showPreviewModal && selectedTemplate && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setShowPreviewModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="bg-white rounded-xl shadow-xl w-full max-w-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="p-6 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg ${selectedTemplate.color} flex items-center justify-center`}>
                          <selectedTemplate.icon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold">{selectedTemplate.name}</h2>
                          <p className="text-sm text-gray-500">{selectedTemplate.description}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setShowPreviewModal(false)}>
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Period Selection */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Report Period</label>
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                        {(['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'] as ReportPeriod[]).map(period => (
                          <button
                            key={period}
                            onClick={() => setReportConfig(prev => ({ ...prev, period }))}
                            className={`px-3 py-2 rounded-lg border text-sm capitalize transition-all ${
                              reportConfig.period === period
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {period}
                          </button>
                        ))}
                      </div>
                    </div>

                    {reportConfig.period === 'custom' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Start Date</label>
                          <input
                            type="date"
                            value={reportConfig.startDate}
                            onChange={e => setReportConfig(prev => ({ ...prev, startDate: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">End Date</label>
                          <input
                            type="date"
                            value={reportConfig.endDate}
                            onChange={e => setReportConfig(prev => ({ ...prev, endDate: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                      </div>
                    )}

                    {/* Branch Selection */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Branch</label>
                      <select
                        value={reportConfig.branch}
                        onChange={e => setReportConfig(prev => ({ ...prev, branch: e.target.value }))}
                        className="w-full px-3 py-2 border rounded-lg"
                      >
                        {BRANCHES.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Format Selection */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Export Format</label>
                      <div className="flex gap-3">
                        {(['pdf', 'excel', 'csv'] as ReportFormat[]).map(format => (
                          <button
                            key={format}
                            onClick={() => setReportConfig(prev => ({ ...prev, format }))}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
                              reportConfig.format === format
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {formatIcon(format)}
                            <span className="uppercase text-sm font-medium">{format}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Options */}
                    <div className="space-y-3">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={reportConfig.includeCharts}
                          onChange={e => setReportConfig(prev => ({ ...prev, includeCharts: e.target.checked }))}
                          className="rounded"
                        />
                        <span className="text-sm">Include charts and visualizations</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={reportConfig.compareLastPeriod}
                          onChange={e => setReportConfig(prev => ({ ...prev, compareLastPeriod: e.target.checked }))}
                          className="rounded"
                        />
                        <span className="text-sm">Compare with previous period</span>
                      </label>
                    </div>
                  </div>

                  <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setShowPreviewModal(false)}>Cancel</Button>
                    <Button variant="outline">
                      <Eye className="h-4 w-4 mr-2" /> Preview
                    </Button>
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700"
                      onClick={generateReport}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Generate Report
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Schedule Modal */}
          <AnimatePresence>
            {showScheduleModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setShowScheduleModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="bg-white rounded-xl shadow-xl w-full max-w-lg"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="p-6 border-b">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xl font-bold">Schedule Report</h2>
                      <Button variant="ghost" size="sm" onClick={() => setShowScheduleModal(false)}>
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Report Type</label>
                      <select className="w-full px-3 py-2 border rounded-lg">
                        {REPORT_TEMPLATES.map(t => (
                          <option key={t.id} value={t.type}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Frequency</label>
                      <select className="w-full px-3 py-2 border rounded-lg">
                        <option>Daily</option>
                        <option>Weekly (Monday)</option>
                        <option>Monthly (1st)</option>
                        <option>Monthly (Last day)</option>
                        <option>Quarterly</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Email Recipients</label>
                      <input
                        type="text"
                        placeholder="email@example.com, email2@example.com"
                        className="w-full px-3 py-2 border rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Format</label>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm"><File className="h-4 w-4 mr-1" /> PDF</Button>
                        <Button variant="outline" size="sm"><FileSpreadsheet className="h-4 w-4 mr-1" /> Excel</Button>
                      </div>
                    </div>
                  </div>
                  <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setShowScheduleModal(false)}>Cancel</Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => { toast.success('Schedule created!'); setShowScheduleModal(false); }}>
                      <Clock className="h-4 w-4 mr-2" /> Create Schedule
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
