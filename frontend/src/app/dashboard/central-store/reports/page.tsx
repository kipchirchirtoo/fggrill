'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card, CardHeader, CardContent, CardFooter, CardTitle, CardDescription } from "@/components/ui/minimal/card";
import { Button } from "@/components/ui/minimal/button";
import { FileText, Download, Package, Truck, TrendingUp, AlertTriangle, BarChart3, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

const reports = [
  { id: 'inventory', name: 'Inventory Report', icon: Package, desc: 'Current stock levels' },
  { id: 'movements', name: 'Stock Movements', icon: TrendingUp, desc: 'In/out transactions' },
  { id: 'dispatch', name: 'Dispatch Report', icon: Truck, desc: 'Shipments to branches' },
  { id: 'low-stock', name: 'Low Stock Report', icon: AlertTriangle, desc: 'Items below minimum' },
  { id: 'branch-stock', name: 'Branch Stock', icon: Building2, desc: 'Stock by branch' },
  { id: 'valuation', name: 'Stock Valuation', icon: BarChart3, desc: 'Inventory value' },
];

export default function CentralReportsPage() {
  const { user } = useAuth();

  const handleExport = (reportId: string, format: 'pdf' | 'excel') => {
    toast.success(`Exporting ${reportId} as ${format.toUpperCase()}...`);
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.CENTRAL_STOREKEEPER, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div><h1 className="text-2xl font-bold text-gray-900">Reports</h1><p className="text-gray-500">Stock and inventory reports</p></div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reports.map((report) => (
              <IOSCard key={report.id} className="p-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-100 rounded-ios-lg"><report.icon className="h-6 w-6 text-[#007AFF]" /></div>
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
