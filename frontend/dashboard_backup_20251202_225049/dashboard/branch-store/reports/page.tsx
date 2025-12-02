'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { FileText, Download, Package, TrendingDown, TrendingUp, AlertTriangle, Utensils } from 'lucide-react';
import { toast } from 'sonner';

const reports = [
  { id: 'stock', name: 'Stock Report', icon: Package, desc: 'Current inventory levels' },
  { id: 'usage', name: 'Usage Report', icon: TrendingDown, desc: 'Consumption history' },
  { id: 'kitchen', name: 'Kitchen Usage', icon: Utensils, desc: 'Kitchen consumption' },
  { id: 'low-stock', name: 'Low Stock', icon: AlertTriangle, desc: 'Items below minimum' },
  { id: 'movements', name: 'Stock Movements', icon: TrendingUp, desc: 'In/out transactions' },
];

export default function BranchReportsPage() {
  const { user } = useAuth();

  const handleExport = (reportId: string, format: 'pdf' | 'excel') => {
    toast.success(`Exporting ${reportId} as ${format.toUpperCase()}...`);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.BRANCH_STOREKEEPER, UserRole.BRANCH_MANAGER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div><h1 className="text-2xl font-bold text-gray-900">Reports</h1><p className="text-gray-500">Branch stock reports</p></div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => (
              <IOSCard key={report.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-100 rounded-ios-lg"><report.icon className="h-6 w-6 text-blue-600" /></div>
                  <div className="flex-1">
                    <h3 className="font-bold">{report.name}</h3>
                    <p className="text-sm text-gray-500 mb-4">{report.desc}</p>
                    <div className="flex gap-2">
                      <IOSButton size="sm" variant="secondary" onClick={() => handleExport(report.id, 'pdf')}><Download className="h-3 w-3 mr-1" /> PDF</IOSButton>
                      <IOSButton size="sm" variant="secondary" onClick={() => handleExport(report.id, 'excel')}><Download className="h-3 w-3 mr-1" /> Excel</IOSButton>
                    </div>
                  </div>
                </div>
              </IOSCard>
            ))}
          </div>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
