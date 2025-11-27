'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  BarChart3, Download, Calendar, Package, Truck,
  TrendingUp, TrendingDown, DollarSign, AlertTriangle,
  FileSpreadsheet, Loader2
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default function ReportsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalItems: 0,
    totalValue: 0,
    lowStockCount: 0,
    monthlyDispatches: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [exportingReport, setExportingReport] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/inventory/stats/overview`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data.data || stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportReport = async (reportType: string) => {
    setExportingReport(reportType);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/api/store/export_data?type=${reportType}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success('Report downloaded successfully');
      } else {
        toast.error('Failed to generate report');
      }
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setExportingReport(null);
    }
  };

  const reports = [
    {
      title: 'Inventory Summary',
      description: 'Complete overview of all inventory items and their current stock levels',
      icon: Package,
      color: 'bg-blue-500',
      type: 'inventory'
    },
    {
      title: 'Stock Movement Report',
      description: 'Track all stock movements including receipts, dispatches, and adjustments',
      icon: TrendingUp,
      color: 'bg-green-500',
      type: 'movements'
    },
    {
      title: 'Low Stock Alert Report',
      description: 'Items that are below reorder level and need restocking',
      icon: AlertTriangle,
      color: 'bg-amber-500',
      type: 'lowstock'
    },
    {
      title: 'Dispatch History',
      description: 'All dispatches sent from central warehouse to branches',
      icon: Truck,
      color: 'bg-purple-500',
      type: 'dispatches'
    },
    {
      title: 'Branch Stock Report',
      description: 'Stock levels at each branch location',
      icon: BarChart3,
      color: 'bg-indigo-500',
      type: 'branches'
    },
    {
      title: 'Valuation Report',
      description: 'Total inventory value and cost analysis',
      icon: DollarSign,
      color: 'bg-emerald-500',
      type: 'valuation'
    }
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER, UserRole.CENTRAL_STOREKEEPER, UserRole.BRANCH_STOREKEEPER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Storekeeping Reports</h1>
              <p className="text-gray-600">Generate and download inventory reports</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline">
                <Calendar className="h-4 w-4 mr-2" />
                Select Period
              </Button>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-500">Total Items</p>
                  <p className="text-2xl font-bold">{stats.totalItems}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-sm text-gray-500">Total Value</p>
                  <p className="text-2xl font-bold">KES {stats.totalValue.toLocaleString()}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm text-gray-500">Low Stock Items</p>
                  <p className="text-2xl font-bold text-amber-600">{stats.lowStockCount}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <Truck className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-500">Monthly Dispatches</p>
                  <p className="text-2xl font-bold">{stats.monthlyDispatches}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Available Reports */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Available Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.map((report) => (
                <Card key={report.title} className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${report.color}`}>
                      <report.icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{report.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{report.description}</p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => handleExportReport(report.type)}
                        disabled={exportingReport === report.type}
                      >
                        {exportingReport === report.type ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating...</>
                        ) : (
                          <><Download className="h-4 w-4 mr-2" />Generate</>
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Reports */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Reports</h2>
            <div className="text-center py-12 text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No reports generated yet</p>
              <p className="text-sm mt-2">Select a report above to generate</p>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
