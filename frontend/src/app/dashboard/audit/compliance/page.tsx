'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardCheck, ArrowLeft, CheckCircle, XCircle, Clock, Shield } from 'lucide-react';
import Link from 'next/link';

export default function CompliancePage() {
  const complianceChecks = [
    { name: 'Inventory Records', status: 'pass', lastCheck: '2024-01-15' },
    { name: 'Financial Reconciliation', status: 'pass', lastCheck: '2024-01-14' },
    { name: 'User Access Review', status: 'pending', lastCheck: '2024-01-10' },
    { name: 'Data Backup Verification', status: 'pass', lastCheck: '2024-01-15' },
    { name: 'Transaction Limits', status: 'pass', lastCheck: '2024-01-15' },
  ];

  return (
    <ProtectedRoute allowedRoles={[UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.AUDITOR]}>
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/audit">
              <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-amber-600" />
              Compliance Checks
            </h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-green-50">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm text-green-700">Passed</p>
                  <p className="text-2xl font-bold text-green-800">
                    {complianceChecks.filter(c => c.status === 'pass').length}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-yellow-50">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-yellow-700">Pending</p>
                  <p className="text-2xl font-bold text-yellow-800">
                    {complianceChecks.filter(c => c.status === 'pending').length}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-4 bg-red-50">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-sm text-red-700">Failed</p>
                  <p className="text-2xl font-bold text-red-800">
                    {complianceChecks.filter(c => c.status === 'fail').length}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h3 className="font-semibold mb-4">Compliance Checklist</h3>
            <div className="space-y-3">
              {complianceChecks.map((check, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    {check.status === 'pass' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : check.status === 'pending' ? (
                      <Clock className="h-5 w-5 text-yellow-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium">{check.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500">Last: {check.lastCheck}</span>
                    <span className={`px-2 py-1 text-xs rounded ${
                      check.status === 'pass' ? 'bg-green-100 text-green-700' :
                      check.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {check.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 bg-indigo-50 border-indigo-200">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-indigo-600 mt-0.5" />
              <div>
                <p className="font-medium text-indigo-800">Compliance Status: Good</p>
                <p className="text-sm text-indigo-600">All critical checks passed. Next scheduled audit: End of month.</p>
              </div>
            </div>
          </Card>
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
