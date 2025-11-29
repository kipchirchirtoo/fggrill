'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { BarChart3, FileText, Download, Calendar, TrendingUp, DollarSign, Users, Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reportsAPI, storeAPI, staffAPI, financeAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function GMReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string>('inventory');
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const reports = [
    { id: 'revenue', name: 'Revenue Report', icon: DollarSign, description: 'Financial performance across branches' },
    { id: 'occupancy', name: 'Occupancy Report', icon: TrendingUp, description: 'Room occupancy rates and trends' },
    { id: 'staff', name: 'Staff Report', icon: Users, description: 'Staff performance and attendance' },
    { id: 'inventory', name: 'Inventory Report', icon: Package, description: 'Stock levels and movements' },
  ];

  const generateReport = async () => {
    setIsLoading(true);
    try {
      let data;

      switch (selectedReport) {
        case 'revenue':
          data = await financeAPI.getDashboard();
          break;
        case 'occupancy':
          data = await reportsAPI.getOccupancyReport({ from_date: dateRange.from, to_date: dateRange.to });
          break;
        case 'staff':
          data = await staffAPI.getStaff();
          break;
        case 'inventory':
          data = await storeAPI.getBranchesWithStock();
          break;
      }
      setReportData(data);
      toast.success('Report generated successfully');
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report');
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const renderReportContent = () => {
    if (!reportData) return null;

    switch (selectedReport) {
      case 'revenue':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-emerald-50 rounded-lg">
                <p className="text-sm text-emerald-600">Total Revenue</p>
                <p className="text-2xl font-bold">KES {(reportData.total_revenue || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-red-600">Total Expenses</p>
                <p className="text-2xl font-bold">KES {(reportData.total_expenses || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600">Net Profit</p>
                <p className="text-2xl font-bold">KES {(reportData.profit || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        );
      case 'staff':
        const staffList = Array.isArray(reportData.staff) ? reportData.staff : (Array.isArray(reportData) ? reportData : []);
        return (
          <div className="space-y-2">
            <p className="font-medium">Total Staff: {staffList.length}</p>
            <div className="max-h-64 overflow-y-auto">
              {staffList.slice(0, 10).map((s: any) => (
                <div key={s.id} className="flex justify-between py-2 border-b">
                  <span>{s.name || s.first_name + ' ' + s.last_name}</span>
                  <span className="text-gray-500">{s.role}</span>
                </div>
              ))}
            </div>
          </div>
        );
      case 'inventory':
        const branches = Array.isArray(reportData.branches) ? reportData.branches : (Array.isArray(reportData) ? reportData : []);
        return (
          <div className="space-y-2">
            <p className="font-medium">Stock by Branch</p>
            {branches.map((b: any) => (
              <div key={b.id} className="flex justify-between py-2 border-b">
                <span>{b.name}</span>
                <span className="font-semibold">KES {(b.stock_value || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        );
      default:
        return <p className="text-gray-500">Report data loaded</p>;
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Reports & Analytics</h1>
            <p className="text-gray-600">Generate and view performance reports</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {reports.map((report) => (
              <Card 
                key={report.id} 
                className={`p-4 cursor-pointer transition-colors ${selectedReport === report.id ? 'ring-2 ring-indigo-500 bg-indigo-50' : 'hover:bg-gray-50'}`}
                onClick={() => { setSelectedReport(report.id); setReportData(null); }}
              >
                <report.icon className="h-8 w-8 text-indigo-600 mb-3" />
                <h3 className="font-semibold">{report.name}</h3>
                <p className="text-sm text-gray-500">{report.description}</p>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-400" />
                <input 
                  type="date" 
                  value={dateRange.from}
                  onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                  className="border rounded px-3 py-2" 
                />
              </div>
              <span className="text-gray-500">to</span>
              <input 
                type="date" 
                value={dateRange.to}
                onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                className="border rounded px-3 py-2" 
              />
              <Button onClick={generateReport} disabled={isLoading}>
                {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                Generate Report
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold">Report Results</h2>
            </div>
            {reportData ? renderReportContent() : (
              <div className="text-center py-12 text-gray-500">
                Select a report type and click Generate Report
              </div>
            )}
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
