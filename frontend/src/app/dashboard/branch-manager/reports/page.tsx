'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { BarChart3, FileText, Calendar, TrendingUp, DollarSign, Users, Package, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { storeAPI, staffAPI, financeAPI, bookingsAPI } from '@/lib/api';
import { toast } from 'sonner';

export default function BranchManagerReportsPage() {
  const { user } = useAuth();
  const [selectedReport, setSelectedReport] = useState<string>('inventory');
  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date().toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  const reports = [
    { id: 'revenue', name: 'Revenue Report', icon: DollarSign, description: 'Branch financial performance' },
    { id: 'occupancy', name: 'Occupancy Report', icon: TrendingUp, description: 'Room occupancy rates' },
    { id: 'staff', name: 'Staff Report', icon: Users, description: 'Staff attendance & performance' },
    { id: 'inventory', name: 'Inventory Report', icon: Package, description: 'Stock levels and usage' },
  ];

  const generateReport = async () => {
    setIsLoading(true);
    try {
      let data;
      const branchId = user?.branch_id;
      switch (selectedReport) {
        case 'revenue':
          data = await financeAPI.getDashboard(branchId);
          break;
        case 'occupancy':
          data = await bookingsAPI.getBookings({ branch_id: branchId, from_date: dateRange.from, to_date: dateRange.to });
          break;
        case 'staff':
          data = await staffAPI.getStaff(branchId);
          break;
        case 'inventory':
          data = await storeAPI.getBranchStock(branchId);
          break;
      }
      setReportData(data);
      toast.success('Report generated');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to generate report');
    } finally {
      setIsLoading(false);
    }
  };

  const renderReportContent = () => {
    if (!reportData) return null;
    switch (selectedReport) {
      case 'revenue':
        return (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg">
              <p className="text-sm text-emerald-600">Revenue</p>
              <p className="text-xl font-bold">KES {(reportData.total_revenue || 0).toLocaleString()}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-600">Expenses</p>
              <p className="text-xl font-bold">KES {(reportData.total_expenses || 0).toLocaleString()}</p>
            </div>
          </div>
        );
      case 'staff':
        const staffData = reportData?.data?.staff || reportData?.staff || (Array.isArray(reportData) ? reportData : []);
        const staffList = Array.isArray(staffData) ? staffData : [];
        return (
          <div>
            <p className="font-medium mb-2">Staff Count: {staffList.length}</p>
            {staffList.slice(0, 5).map((s: any) => (
              <div key={s.id} className="flex justify-between py-2 border-b">
                <span>{s.first_name} {s.last_name}</span>
                <span className="text-gray-500">{s.role}</span>
              </div>
            ))}
          </div>
        );
      case 'inventory':
        const stockData = reportData?.data?.stock || reportData?.stock || (Array.isArray(reportData) ? reportData : []);
        const stockList = Array.isArray(stockData) ? stockData : [];
        const totalValue = stockList.reduce((sum: number, s: any) => sum + ((s.quantity || 0) * (s.cost_price || 0)), 0);
        return (
          <div>
            <p className="font-medium mb-2">Items: {stockList.length} | Value: KES {totalValue.toLocaleString()}</p>
            {stockList.slice(0, 5).map((s: any) => (
              <div key={s.id || s.sku} className="flex justify-between py-2 border-b">
                <span>{s.item_name || s.name || s.item?.name || 'Unknown Item'}</span>
                <span>{s.quantity} units</span>
              </div>
            ))}
          </div>
        );
      case 'occupancy':
        const bookingsData = reportData?.data?.bookings || reportData?.bookings || (Array.isArray(reportData) ? reportData : []);
        const bookings = Array.isArray(bookingsData) ? bookingsData : [];
        return (
          <div>
            <p className="font-medium mb-2">Bookings in period: {bookings.length}</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_MANAGER, UserRole.GENERAL_MANAGER, UserRole.SUPER_ADMIN]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Branch Reports</h1>
            <p className="text-gray-600">Generate and view branch performance reports</p>
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
              <Calendar className="h-5 w-5 text-gray-400" />
              <input type="date" value={dateRange.from} onChange={(e) => setDateRange({...dateRange, from: e.target.value})} className="border rounded px-3 py-2" />
              <span className="text-gray-500">to</span>
              <input type="date" value={dateRange.to} onChange={(e) => setDateRange({...dateRange, to: e.target.value})} className="border rounded px-3 py-2" />
              <Button onClick={generateReport} disabled={isLoading}>
                {isLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                Generate
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-indigo-600" />
              <h2 className="font-semibold">Report Results</h2>
            </div>
            {reportData ? renderReportContent() : (
              <div className="text-center py-8 text-gray-500">Select report type and click Generate</div>
            )}
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
