'use client';

import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, RefreshCw, ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import { auditAPI } from '@/lib/api';
import Link from 'next/link';

export default function InventoryAuditPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [auditData, setAuditData] = useState<any[]>([]);

  useEffect(() => { fetchInventoryAudit(); }, []);

  const fetchInventoryAudit = async () => {
    setIsLoading(true);
    try {
      const res = await auditAPI.getInventoryAudit();
      setAuditData(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard/audit">
                <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
              </Link>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6 text-green-600" />
                Inventory Audit
              </h1>
            </div>
            <Button onClick={fetchInventoryAudit} variant="outline" disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </div>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Stock Verification</h3>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Loading audit data...</div>
            ) : auditData.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Item</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Branch</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">System Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Physical Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Variance</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {auditData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{item.item_name || '-'}</td>
                        <td className="px-4 py-3 text-sm">{item.branch_name || '-'}</td>
                        <td className="px-4 py-3 text-right">{item.system_qty || 0}</td>
                        <td className="px-4 py-3 text-right">{item.physical_qty || 0}</td>
                        <td className={`px-4 py-3 text-right font-medium ${item.variance !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {item.variance || 0}
                        </td>
                        <td className="px-4 py-3">
                          {item.variance === 0 ? (
                            <span className="flex items-center gap-1 text-green-600 text-sm">
                              <CheckCircle className="h-4 w-4" /> Match
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-600 text-sm">
                              <AlertTriangle className="h-4 w-4" /> Discrepancy
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No inventory audit data available</p>
                <p className="text-sm mt-1">Run a stock take to generate audit data</p>
              </div>
            )}
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
